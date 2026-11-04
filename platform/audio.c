/* Browser-native Doom DMX effects and MUS score synthesis. No external assets.
 * Enable FEATURE_SOUND in the engine build to register these modules.
 */
#include "audio.h"
#include "i_sound.h"
#include "w_wad.h"
#include "z_zone.h"
#include <emscripten.h>
#include <stdio.h>
#include <stdint.h>

#define AUDIO_CHANNELS 64

/* These config bindings are referenced by i_sound.c with FEATURE_SOUND.
 * WebAudio performs sample-rate conversion; libsamplerate is not used. */
int use_libsamplerate = 0;
float libsamplerate_scale = 1.0f;
static boolean sfx_prefix;

EM_JS(void, AudioInstall, (void), {
    if (Module['doomAudio']) return;
    var a = Module['doomAudio'] = {
        ctx: null, master: null, buffers: new Map(), channels: [], enabled: true
    };
    a.resume = function() {
        if (!a.enabled) return;
        try {
            if (!a.ctx) {
                var AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return;
                a.ctx = new AC();
                a.master = a.ctx.createGain();
                a.master.gain.value = 0.65;
                a.master.connect(a.ctx.destination);
            }
            if (a.ctx.state === 'suspended') {
                a.ctx.resume().catch(function() {});
            }
            if (a.music && a.music.kick) a.music.kick();
        } catch (e) { console.warn('Doom audio unavailable:', e); }
    };
    a.stop = function(ch) {
        var voice = a.channels[ch];
        if (!voice) return;
        a.channels[ch] = null;
        try { voice.source.stop(); } catch (e) {}
        voice.source.disconnect();
        voice.gain.disconnect();
        voice.pan.disconnect();
    };
    a.params = function(ch, vol, sep) {
        var voice = a.channels[ch];
        if (!voice) return;
        voice.gain.gain.setValueAtTime(Math.max(0, Math.min(127, vol)) / 127, a.ctx.currentTime);
        voice.pan.pan.setValueAtTime(Math.max(-1, Math.min(1, (sep - 128) / 127)), a.ctx.currentTime);
    };
    // Capture runs even when game handlers consume a key or stop propagation.
    // Retain handlers so a later browser suspension can be resumed, too.
    window.addEventListener('keydown', a.resume, true);
    window.addEventListener('pointerdown', a.resume, true);
    window.addEventListener('click', a.resume, true);
});

EM_JS(void, AudioResume, (void), {
    var a = Module['doomAudio'];
    if (a) a.resume();
});

void DG_AudioInit(void) { AudioInstall(); }
void DG_AudioResume(void) { DG_AudioInit(); AudioResume(); }

static boolean InitSound(boolean use_prefix)
{
    sfx_prefix = use_prefix;
    DG_AudioInit();
    /* Context creation is deferred to a trusted gesture, not engine startup. */
    return true;
}

static int GetSfxLumpNum(sfxinfo_t *sfx)
{
    char name[16];
    if (!sfx) return -1;
    if (sfx->link) sfx = sfx->link;
    snprintf(name, sizeof(name), "%s%.8s", sfx_prefix ? "ds" : "", sfx->name);
    return W_CheckNumForName(name);
}

EM_JS(void, StopSound, (int channel), {
    var a = Module['doomAudio'];
    if (a) a.stop(channel);
});

EM_JS(void, UpdateSoundParams, (int channel, int vol, int sep), {
    var a = Module['doomAudio'];
    if (a) a.params(channel, vol, sep);
});

EM_JS(int, AudioIsPlaying, (int channel), {
    var a = Module['doomAudio'];
    if (!a || !a.ctx) return 0;
    var voice = a.channels[channel];
    return voice && a.ctx.currentTime < voice.end ? 1 : 0;
});

EM_JS(int, PlaySample, (int lump, int channel, const unsigned char *data,
                      int count, int rate, int vol, int sep), {
    var a = Module['doomAudio'];
    if (!a || !a.ctx || a.ctx.state !== 'running') return -1;
    try {
        var buffer = a.buffers.get(lump);
        if (!buffer) {
            buffer = a.ctx.createBuffer(1, count, rate);
            var samples = buffer.getChannelData(0);
            // WAD DMX PCM is unsigned 8-bit mono. Copy before C releases lump.
            for (var i = 0; i < count; ++i) samples[i] = (HEAPU8[data + i] - 128) / 128;
            a.buffers.set(lump, buffer);
        }
        a.stop(channel);
        var source = a.ctx.createBufferSource();
        var gain = a.ctx.createGain();
        var pan = a.ctx.createStereoPanner();
        source.buffer = buffer;
        source.connect(gain);
        gain.connect(pan);
        pan.connect(a.master);
        var voice = {source: source, gain: gain, pan: pan,
                     end: a.ctx.currentTime + buffer.duration};
        a.channels[channel] = voice;
        a.params(channel, vol, sep);
        source.onended = function() {
            // A replaced voice must not clear its successor's channel.
            if (a.channels[channel] === voice) a.channels[channel] = null;
            source.disconnect(); gain.disconnect(); pan.disconnect();
        };
        source.start();
        return channel;
    } catch (e) {
        a.stop(channel);
        console.warn('Doom sample playback failed:', e);
        return -1;
    }
});

static boolean SoundIsPlaying(int channel)
{
    return AudioIsPlaying(channel) ? true : false;
}

static int StartSound(sfxinfo_t *sfx, int channel, int vol, int sep)
{
    int lump, length, rate, result;
    unsigned int count;
    const unsigned char *data;
    if (channel < 0 || channel >= AUDIO_CHANNELS) return -1;
    lump = GetSfxLumpNum(sfx);
    if (lump < 0) return -1;
    length = W_LumpLength((unsigned int)lump);
    if (length < 8) return -1;
    data = W_CacheLumpNum(lump, PU_STATIC);
    /* DMX header: format 3, u16 sample rate, u32 byte count (little endian).
     * Vanilla/Chocolate Doom discard the 16 padded bytes at each end. */
    rate = data[2] | ((unsigned int)data[3] << 8);
    count = data[4] | ((unsigned int)data[5] << 8)
          | ((unsigned int)data[6] << 16) | ((unsigned int)data[7] << 24);
    result = -1;
    if (data[0] == 3 && data[1] == 0 && rate >= 3000 && rate <= 192000
        && count > 48 && count <= (unsigned int)(length - 8))
        result = PlaySample(lump, channel, data + 24, (int)(count - 32), rate, vol, sep);
    W_ReleaseLumpNum(lump);
    return result;
}

static void UpdateSound(void) { /* Audio clock schedules playback independently. */ }
static void ShutdownSound(void)
{
    int i;
    for (i = 0; i < AUDIO_CHANNELS; ++i) StopSound(i);
}

static snddevice_t devices[] = { SNDDEVICE_SB };
sound_module_t DG_sound_module = {
    devices, 1, InitSound, ShutdownSound, GetSfxLumpNum, UpdateSound,
    UpdateSoundParams, StartSound, StopSound, SoundIsPlaying, NULL
};

/* Decode the supplied MUS score, not a substitute tune. Render on demand at
 * 22050 Hz in a cancellable worker into a looping WebAudio buffer. Playback uses the audio clock,
 * independently of engine tics, browser timer throttling and screen wipes.
 * This is a small GM-family synthesizer, not an OPL/GENMIDI emulator. */
EM_JS(void, MusicInstall, (void), {
    var a = Module['doomAudio'];
    if (a.music) return;
    var m = a.music = {songs: new Map(), next: 1, volume: 1, current: null,
                      source: null, offset: 0, paused: false, looping: false};
    m.decode = function(d) {
        if (d.length < 16 || d[0] !== 77 || d[1] !== 85 || d[2] !== 83 || d[3] !== 26)
            throw new Error('Not a MUS score');
        var size = d[4] | d[5] << 8, pos = d[6] | d[7] << 8;
        var end = pos + size, tick = 0, events = [], velocity = new Array(16).fill(127);
        if (pos < 16 || end > d.length) throw new Error('Truncated MUS header');
        function byte() {
            if (pos >= end) throw new Error('Truncated MUS event');
            return d[pos++];
        }
        while (pos < end && events.length < 100000) {
            var desc = byte(), type = (desc >> 4) & 7, ch = desc & 15;
            var x = 0, y = 0;
            if (type === 6) {
                if (tick <= 0 || tick > 168000) throw new Error('Invalid MUS duration');
                return {events: events, duration: tick / 140};
            }
            if (type === 0 || type === 2 || type === 3) x = byte();
            else if (type === 1) {
                x = byte();
                if (x & 128) velocity[ch] = byte() & 127;
                x &= 127; y = velocity[ch];
            } else if (type === 4) { x = byte(); y = byte(); }
            else throw new Error('Invalid MUS event');
            events.push({time: tick / 140, type: type, ch: ch, x: x, y: y});
            if (desc & 128) {
                var delta = 0, b, n = 0;
                do {
                    b = byte(); delta = delta * 128 + (b & 127);
                    if (++n > 4) throw new Error('Invalid MUS delay');
                } while (b & 128);
                tick += delta;
                if (tick > 168000) throw new Error('MUS exceeds 20 minutes');
            }
        }
        throw new Error('Missing MUS end');
    };
    m.render = function(song) {
        var rate = 22050, frames = Math.ceil(song.duration * rate);
        var pcm = new Float32Array(frames), channels = [], voices = [], at = 0;
        for (var c = 0; c < 16; ++c)
            channels.push({program: 0, vol: 1, expression: 1, bend: 1, sustain: false});
        function release(v) { if (v.release < 0) v.release = v.age; }
        function segment(to) {
            to = Math.min(frames, to);
            for (var j = 0; j < voices.length; ++j) {
                var v = voices[j], ch = channels[v.ch];
                var step = v.freq * ch.bend / rate;
                var level = v.velocity * ch.vol * ch.expression * 0.10;
                for (var i = at; i < to; ++i) {
                    var env = Math.min(1, v.age / 0.006);
                    if (v.release >= 0) env *= Math.max(0, 1 - (v.age - v.release) / 0.12);
                    if (v.drum) env *= Math.exp(-v.age * v.decay);
                    else if (v.family === 0 || v.family === 1 || v.family === 3)
                        env *= 0.25 + 0.75 * Math.exp(-v.age * 3);
                    if (env < 0.0001 && v.age > 0.02 && (v.drum || v.release >= 0)) { v.dead = true; break; }
                    var phase = v.phase * Math.PI * 2, sample;
                    if (v.drum) {
                        v.seed = (Math.imul(v.seed, 1664525) + 1013904223) | 0;
                        sample = v.noise * (v.seed / 2147483648)
                               + (1 - v.noise) * Math.sin(phase);
                    } else {
                        // Harmonics selected by GM instrument family. Smooth and
                        // band limited (at most three harmonics), no sample bank.
                        var h = v.family;
                        sample = Math.sin(phase);
                        if (v.freq * 3 < rate / 2) {
                            sample += (h === 9 ? 0.6 : h === 4 || h === 5 ? 0.35 : 0.15) * Math.sin(phase * 2);
                            sample += (h === 10 ? 0 : 0.15) * Math.sin(phase * 3);
                        }
                    }
                    pcm[i] += sample * env * level;
                    v.phase = (v.phase + step) % 1; v.age += 1 / rate;
                }
            }
            voices = voices.filter(function(v) {
                return !v.dead && !(v.release >= 0 && v.age - v.release >= 0.12)
                    && !(v.drum && v.age * v.decay > 10);
            });
            at = to;
        }
        song.events.forEach(function(e) {
            segment(Math.round(e.time * rate));
            var ch = channels[e.ch];
            if (e.type === 1 && e.y > 0) {
                voices.filter(function(v) { return v.ch === e.ch && v.note === e.x; }).forEach(release);
                var drum = e.ch === 15, kick = e.x === 35 || e.x === 36;
                voices.push({ch: e.ch, note: e.x, velocity: e.y / 127,
                    freq: drum ? (kick ? 65 : 180) : 440 * Math.pow(2, (e.x - 69) / 12),
                    phase: 0, age: 0, release: -1, held: true, family: ch.program >> 3,
                    drum: drum, noise: kick ? 0.08 : 0.85,
                    decay: kick ? 14 : e.x >= 42 ? 32 : 18, seed: 12345 + e.x});
                // Defensive polyphony bound; bundled scores stay well below it.
                if (voices.length > 96) voices.shift();
            } else if (e.type === 0 || (e.type === 1 && e.y === 0)) {
                voices.forEach(function(v) {
                    if (v.ch === e.ch && v.note === e.x) {
                        v.held = false; if (!ch.sustain) release(v);
                    }
                });
            } else if (e.type === 2) ch.bend = Math.pow(2, (e.x - 128) / 64 / 12);
            else if (e.type === 3) {
                if (e.x === 10 || e.x === 11) voices.forEach(function(v) {
                    if (v.ch === e.ch) { v.held = false; release(v); }
                });
                if (e.x === 14) { ch.vol = ch.expression = ch.bend = 1; ch.sustain = false;
                    voices.forEach(function(v) { if (v.ch === e.ch && !v.held) release(v); }); }
            } else if (e.type === 4) {
                if (e.x === 0) ch.program = e.y & 127;
                if (e.x === 3) ch.vol = e.y / 127;
                if (e.x === 5) ch.expression = e.y / 127;
                if (e.x === 8) {
                    ch.sustain = e.y >= 64;
                    if (!ch.sustain) voices.forEach(function(v) {
                        if (v.ch === e.ch && !v.held) release(v);
                    });
                }
            }
        });
        segment(frames);
        // Soft limiter keeps dense chords below clipping without pumping SFX.
        for (var i = 0; i < frames; ++i) pcm[i] = pcm[i] / (1 + Math.abs(pcm[i]));
        return pcm;
    };
    // Only the worker executes the sample loop. Its function has no closure
    // dependencies: serializing it keeps the worker embedded in this owned TU.
    // One active job, no queue: replacing/stopping/unregistering terminates it
    // immediately, releasing its intermediate PCM and decoded event copy.
    m.cancel = function() {
        var job = m.job;
        m.job = null;
        if (job) { job.worker.terminate(); URL.revokeObjectURL(job.url); }
    };
    m.prepare = function(song) {
        if (m.job || song.failed) return;
        var url, worker;
        try {
            var code = 'var render = ' + m.render.toString() + ';' +
                'onmessage = function(e) { try { var pcm = render(e.data);' +
                'postMessage({pcm: pcm}, [pcm.buffer]);' +
                '} catch(e) { postMessage({error: String(e)}); } };';
            url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            worker = new Worker(url);
            var job = m.job = {worker: worker, url: url, song: song};
            function fail(error) {
                if (m.job !== job) return;
                song.failed = true;
                m.cancel();
                console.warn('Doom music worker failed:', error);
            }
            worker.onerror = function(e) { fail(e.message); };
            worker.onmessage = function(e) {
                if (m.job !== job) return;
                m.cancel();
                if (m.current !== song) return;
                if (e.data.error) {
                    song.failed = true;
                    console.warn('Doom music render failed:', e.data.error);
                    return;
                }
                try {
                    // Transferred PCM is owned here, never a view of WASM/WAD
                    // storage. AudioBuffer copies it; the temporary is then GC'd.
                    var pcm = e.data.pcm;
                    song.buffer = a.ctx.createBuffer(1, pcm.length, 22050);
                    song.buffer.getChannelData(0).set(pcm);
                    m.kick();
                } catch (error) {
                    song.failed = true;
                    console.warn('Doom music buffer failed:', error);
                }
            };
            worker.postMessage({events: song.events, duration: song.duration});
        } catch (error) {
            song.failed = true;
            if (worker) worker.terminate();
            if (url) URL.revokeObjectURL(url);
            m.job = null;
            console.warn('Doom music worker unavailable:', error);
        }
    };
    m.halt = function() {
        m.cancel();
        if (m.source) { m.source.onended = null; m.source.stop(); m.source.disconnect(); m.source = null; }
    };
    m.kick = function() {
        if (!a.ctx || !m.current || m.paused || m.source) return;
        var song = m.current;
        if (!song.buffer) {
            m.prepare(song);
            return;
        }
        if (!m.gain) { m.gain = a.ctx.createGain(); m.gain.connect(a.master); }
        m.gain.gain.value = m.volume;
        var source = m.source = a.ctx.createBufferSource();
        source.buffer = song.buffer; source.loop = m.looping; source.connect(m.gain);
        m.started = a.ctx.currentTime;
        source.onended = function() {
            if (m.source === source) { m.source = null; m.current = null; }
            source.disconnect();
        };
        source.start(0, m.offset % song.buffer.duration);
    };
});

EM_JS(int, MusicRegister, (const unsigned char *data, int length), {
    var m = Module['doomAudio'].music;
    try {
        var song = m.decode(HEAPU8.slice(data, data + length)), id = m.next++;
        m.songs.set(id, song); return id;
    } catch (e) { console.warn('Doom MUS registration failed:', e); return 0; }
});

/* Commands keep score ownership separate from the WAD cache. Registration
 * copies/decodes bytes before the engine releases the lump. */
EM_JS(int, MusicCommand, (int command, int value), {
    var a = Module['doomAudio'];
    if (!a || !a.music) return 0;
    var m = a.music;
    if (command === 0) {
        m.halt(); m.current = null; m.offset = 0; m.paused = false;
    } else if (command === 1) {
        m.volume = Math.max(0, Math.min(127, value)) / 127;
        if (m.gain) m.gain.gain.setValueAtTime(m.volume, a.ctx.currentTime);
    } else if (command === 2 && !m.paused) {
        if (m.source) m.offset += a.ctx.currentTime - m.started;
        m.paused = true; m.halt();
    } else if (command === 3) { m.paused = false; m.kick(); }
    else if (command === 4) {
        var song = m.songs.get(value);
        if (song === m.current) { m.halt(); m.current = null; }
        m.songs.delete(value);
    } else if (command === 5) {
        m.halt(); m.current = m.songs.get(value) || null;
        m.offset = 0; m.paused = false;
    } else if (command === 6) { m.looping = !!value; m.kick(); }
    return m.current ? 1 : 0;
});

static boolean InitMusic(void) { DG_AudioInit(); MusicInstall(); return true; }
static void StopSong(void) { MusicCommand(0, 0); }
static void ShutdownMusic(void) { StopSong(); }
static void MusicVolume(int volume) { InitMusic(); MusicCommand(1, volume); }
static void PauseMusic(void) { MusicCommand(2, 0); }
static void ResumeMusic(void) { MusicCommand(3, 0); }
static void *RegisterSong(void *data, int length)
{
    InitMusic();
    return (void *)(uintptr_t)MusicRegister(data, length);
}
static void UnregisterSong(void *handle) { MusicCommand(4, (int)(uintptr_t)handle); }
static void PlaySong(void *handle, boolean looping)
{
    MusicCommand(5, (int)(uintptr_t)handle);
    MusicCommand(6, looping);
}
static boolean MusicIsPlaying(void) { return MusicCommand(7, 0) ? true : false; }
static void PollMusic(void) { /* BufferSource uses the audio clock, no polling. */ }
music_module_t DG_music_module = {
    devices, 1, InitMusic, ShutdownMusic, MusicVolume, PauseMusic, ResumeMusic,
    RegisterSong, UnregisterSong, PlaySong, StopSong, MusicIsPlaying, PollMusic
};
