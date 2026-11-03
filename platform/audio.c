/* Browser-native Doom DMX sound effects. No SDL or external sound assets.
 * Enable FEATURE_SOUND in the engine build to register these modules.
 */
#include "audio.h"
#include "i_sound.h"
#include "w_wad.h"
#include "z_zone.h"
#include <emscripten.h>
#include <stdio.h>

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

/* Music synthesis is deliberately outside this SFX milestone. Supply every
 * callback: the engine selects DG_music_module even without calling its Init. */
static boolean InitMusic(void) { return false; }
static void MusicNoop(void) {}
static void MusicVolume(int volume) { (void)volume; }
static void *RegisterSong(void *data, int length)
{ (void)data; (void)length; return NULL; }
static void UnregisterSong(void *handle) { (void)handle; }
static void PlaySong(void *handle, boolean looping) { (void)handle; (void)looping; }
static boolean MusicIsPlaying(void) { return false; }
music_module_t DG_music_module = {
    devices, 1, InitMusic, MusicNoop, MusicVolume, MusicNoop, MusicNoop,
    RegisterSong, UnregisterSong, PlaySong, MusicNoop, MusicIsPlaying, MusicNoop
};
