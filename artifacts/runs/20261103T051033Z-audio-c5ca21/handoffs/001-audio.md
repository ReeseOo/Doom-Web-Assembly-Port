# 001 audio — WAD effects backend implemented; build integration pending

## Task / result

Implemented genuine Doom WAD sampled effects through WebAudio, within assigned port ownership (`platform/audio.*` only). Added a developer test under `tests/dev/`. No other port/build files or protected files were edited. No prior run evidence was overwritten. **Not a final gate PASS:** coordinator must enable registration, rebuild, and run the real browser checks.

Source HEAD at implementation: `206d765f31fa3ce673a35ea3726379267ae821ad`. Working tree already contained uncommitted runtime/video/web/build work; this is not evidence for a clean committed revision. Reviewed repository instructions, referenced READMEs, engine registration and WAD APIs, protected A1 implementation, prior run outcome (`artifacts/runs/20261102T021951Z-port-b7e3a0/summary-attempt-005.md`) and manual audio evidence (`artifacts/manual-check/A1_audio_levels.json`: zero contexts). A1 requires both firing and menu signal rises, not just context construction.

## Changes

- `platform/audio.h`: public idempotent `DG_AudioInit(void)` and gesture-callable `DG_AudioResume(void)`.
- `platform/audio.c`: defines `DG_sound_module`, `DG_music_module`, plus `use_libsamplerate` and `libsamplerate_scale` config symbols referenced by sound-enabled engine.
- Engine SFX callbacks resolve DS lump names (including linked effects), validate DMX format-3 little-endian header and bounds, use WAD sample rate, discard vanilla 16-byte padding at both ends, convert unsigned 8-bit mono PCM to float, then play a copied/cached AudioBuffer. Lump release follows synchronous copy; no stale heap views retained across memory growth.
- Browser graph: BufferSource -> per-channel Gain -> StereoPanner -> master Gain (0.65) -> actual context destination. Engine-provided volume/separation honored, up to 64 channel handles, channel replacement/stop, duration-based playing query, source cleanup with stale-onended protection. WebAudio resamples original WAD rate; no oscillators or synthetic substitute effects.
- Installs capture-phase keydown, pointerdown and click listeners. They synchronously construct/resume AudioContext in the trusted gesture; retained listeners support later suspended-context recovery. No continuous baseline audio is generated. `Module.doomAudio` contains backend state only; protected-check instrumentation is neither accessed nor altered.
- Full safe no-op music callback table: music synthesis intentionally not implemented in this SFX milestone. No SDL playback library or new sound assets.
- `tests/dev/audio_test.cjs`: executes actual EM_JS bodies using mocked WebAudio nodes and all 55 real bundled DS lumps; verifies conversion, output connection, resume, channel replacement/expiry/stop. This is a unit test, **not proof of audible browser output**.

## Exact required integration — coder_build / coordinator

Current `build.sh` glob already compiles `platform/audio.c`, but **engine sound remains disabled until build flags change**. Audio owner did not change build.sh.

1. Add `-DFEATURE_SOUND` to the existing emcc command.
2. The protected `third_party/doomgeneric/i_sound.c:21-22` includes `<SDL_mixer.h>` when that flag is enabled, although it invokes no SDL API. Generate a shim under build output, e.g. before compilation:
   ```sh
   mkdir -p build/audio-include
   printf '%s\n' '/* WebAudio backend: no SDL mixer API required. */' > build/audio-include/SDL_mixer.h
   ```
   Add `-Ibuild/audio-include` to the emcc command. No supplied source edits or SDL downloads required. Do not globally define `__DJGPP__` to evade this include.
3. Do not add `-nosound` or `-nosfx` at startup. Default `snd_sfxdevice` is supported `SNDDEVICE_SB`. `-nomusic` is optional, not necessary for safe operation.
4. No additional exports or JS-library files needed: EM_JS helpers are linked from the glob-compiled backend. Keep existing ASYNCIFY, filesystem, runtime-lifetime settings.

The actual enabled `i_sound.c` + backend compilation/link was checked with this empty shim, without editing protected source.

## Runtime handoff — coder_runtime

No runtime change mandatory: `DG_sound_module.Init` calls `DG_AudioInit()` to install gesture listeners. Optional early integration: `#include "audio.h"`, then call `DG_AudioInit()` before `doomgeneric_Create` in `platform/doomgeneric_runtime.c`. `DG_AudioResume()` may be called synchronously by any existing trusted C/JS input gesture hook, but this is redundant with backend capture listeners. Do not invoke it after an await and assume user activation persists.

Existing HTML loads WASM asynchronously after Start, so that initial click may precede backend availability. The first subsequent key/click resumes sound (acceptance flow supplies these). Backend intentionally drops pre-unlock sound requests rather than queueing stale effects. If product requires sound immediately on the original Start click, web owner would need an earlier context/gesture bridge; that is outside audio-only ownership and not needed for first-key behavior.

## Checks / evidence

Emscripten version: 4.0.18.

- `emcc -c platform/audio.c -Ithird_party/doomgeneric -std=gnu11 -Wall -Wextra -Werror -o build/audio-check/audio.o`: PASS after correcting an initial unsigned Doom `boolean` callback type mismatch. Initial diagnostic preserved in `tests/audio-compile.log` below.
- `node tests/dev/audio_test.cjs`: PASS, all 55 actual DS lumps, graph and lifecycle assertions. Evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/audio-unit.log`.
- Enabled engine `i_sound.c` compile with generated empty SDL header and `-DFEATURE_SOUND`, then `emcc -r` relocatable link with backend: PASS. Evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/audio-integration-compile.log`.
- `git diff --check`: PASS (new untracked files additionally compiled/tested above).
- Initial compile failure evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/audio-compile.log`; fixed in current source.

## Limits / next action / stopping reason

No full game build, real-browser playback measurement, final acceptance run or regression claim made by audio owner. Real A1 context-running and RMS rises remain coordinator validation work after build integration. Music is intentionally silent; effects alone are intended to pass this milestone. WebAudio requires modern AudioContext and StereoPanner support, and user activation; unavailable APIs return failed playback rather than crash engine. Cache retains decoded buffers for module lifetime (55 bundled effects); no persistent audio/assets changes.

Stopping because bounded implementation and unit/registration checks are complete and the remaining build-file edits belong to another owner. Next action: coder_build/coordinator applies flags/shim above, rebuilds and runs protected checks; retain new evidence separately from previous runs. Resource usage: one implementation iteration plus one callback-type compile repair; no browser/gate attempt consumed here.
