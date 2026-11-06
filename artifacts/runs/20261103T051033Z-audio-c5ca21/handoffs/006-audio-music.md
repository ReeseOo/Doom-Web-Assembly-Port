# 006 — supplied MUS music implementation

## Scope / source

Implemented bounded music task on HEAD `b62d60778a48d95ec5a77fe109e69b5b254b6e9b`, with uncommitted changes. No commit made. Read required repository/platform docs, prior run summaries and audio/build handoffs, and updated-baseline/results.json (M1 0% audible, A1 passing). Did not address S1 or G1.

Changed only `platform/audio.c`, `platform/audio.h`, added `tests/dev/music_test.cjs`, and wrote this report/evidence. No protected-path edits, build wiring edits, external engine, downloads, or additional assets.

## Implementation

- Replaced silent `DG_music_module` callbacks with real registration, playback, volume, pause/resume, stop, unregister, playing-query and shutdown behavior.
- `MusicInstall` installs the JS score decoder and renderer. `m.decode` reads actual MUS events, variable-length delays at 140 ticks/sec, per-channel remembered velocities, note on/off, pitch wheel, instrument/controller/system changes and score end. Invalid/truncated streams are rejected with a warning and null registration handle.
- `m.render` synthesizes the decoded score into mono 22050-Hz PCM using GM-family harmonic instruments, note attack/release/decay, channel volume/expression, sustain, pitch bend and channel-15 synthesized percussion. It is genuine score-driven music, not a replacement tune or repeated tone. It is **not** an OPL/GENMIDI emulator and will not sound identical to original Doom hardware.
- `m.kick` starts a WebAudio BufferSource through a dedicated music gain and the existing master/destination. Continuous playback and exact score-duration looping use the audio clock, not game tics or JS polling. Song data/buffers are released on unregister.
- Pending songs survive initialization before user activation. Existing key/pointer/click handlers create/resume the shared context; resume is requested before rendering the pending score. Effects and music retain separate volume control.
- Preserved SFX decoding/playback and its graph; the only change in the common initialization path is starting pending music after context resume.

## Interfaces for coder_build and coder_runtime

All implementation is in `platform/audio.c`; gesture entrypoints remain `DG_AudioInit(void)` / `DG_AudioResume(void)` in `platform/audio.h`. No new exported C functions or runtime integration needed. Engine `DG_music_module` now handles MUS registration internally through `InitMusic`, `RegisterSong`, `PlaySong`, `MusicVolume`, `PauseMusic`, `ResumeMusic`, `StopSong`, `UnregisterSong`, `MusicIsPlaying`, `ShutdownMusic`, `PollMusic`.

Inspected `build.sh`: its existing `FEATURE_SOUND`, generated SDL include shim, platform source glob, supplied WAD preload and existing engine hooks suffice. No flags/dependencies/assets must be added. Keep the existing first-key/click behavior and do not disable music with `-nomusic`.

## Developer checks / evidence

Evidence directory: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/music-dev/`.

- `emcc -c platform/audio.c -Ithird_party/doomgeneric -std=gnu11 -Wall -Wextra -Werror -o build/audio-music-check.o`: PASS, Emscripten 4.0.18.
- `node tests/dev/audio_test.cjs`: PASS, all 55 real WAD DS samples plus gesture/graph/channel lifecycle assertions.
- `node tests/dev/music_test.cjs`: PASS, all 13 actual MUS scores decode/render to finite non-silent PCM. Checks 100-ms windows: all scores >95% audible with RMS threshold .002; E1M1 duration 96 seconds, PCM RMS ~.067, peak ~.277, 100% windows audible. This measures generated PCM, **not browser output or protected M1**.
- Music developer tests also cover pending playback before gesture, destination graph, volume, pause offset/resume, looping/nonlooping replacement, natural end query, unregister cleanup and malformed score rejection.
- `git diff --check`: PASS.

Logs: `compile-sfx.log`, `music-unit.log`. Final tests rerun after the resume-order adjustment. No authoritative full build, acceptance run, or live-browser audibility claim made; coordinator owns those.

## Caveats / next action

Rendering a song is synchronous at its first playback, then the buffer is reused until unregister. Node VM test timings were roughly 0.4–12 seconds per complete song (E1M1 ~5 seconds); these include VM overhead and are not browser timings, but first-play/track-transition main-thread stalls are a known risk to inspect. Memory is bounded by current registered score duration (longest supplied song ~24 MB of mono Float32 PCM before temporary render storage is collected). The context is resumed before rendering to preserve gesture activation. Subsequent playback is independent of the engine/main thread.

Mono synthesis does not implement stereo pan, reverb/chorus, exact GM patches or GENMIDI FM instruments. SFX still use the existing stereo positioning. Music can overlap menu/gun sounds, so A1 must be rechecked with nonzero music baseline; developer SFX tests alone do not prove browser gate preservation.

Next: coordinator rebuilds and runs updated A1/M1 in browser with fresh evidence, checks initial/track-change latency and continuous idle music. Stop reason: bounded implementation and local tests complete; authoritative build/gate delegated as requested. S1/G1 intentionally untouched.
