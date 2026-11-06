# 002 build — bounded audio build integration

## Result / changes

Applied the exact integration requested by `handoffs/001-audio.md` to `build.sh` only:

- Generate `build/audio-include/SDL_mixer.h` on each build, containing only a comment (no declarations or SDL dependency).
- Add `-DFEATURE_SOUND -Ibuild/audio-include` to the existing Emscripten command.
- Correct the adjacent comment to no longer claim FEATURE_SOUND is disabled.

No web, platform, protected source, asset, or acceptance-test edits were made by this agent. Existing Emscripten 4.0.18 enforcement, `set -euo pipefail`, WAD preload, ASYNCIFY, filesystem settings, relative output paths, exports, and platform source glob remain unchanged. No startup sound-disabling flags were added.

## Verification / source identity

Source HEAD: `206d765f31fa3ce673a35ea3726379267ae821ad`, with pre-existing uncommitted port work. `build.sh` itself is currently untracked, so ordinary `git diff -- build.sh` does not show its contents.

- `bash -n build.sh`: PASS.
- `git diff --check`: PASS (tracked changes only; build.sh is untracked).
- Read prior attempt 005 summary and current attempt 001 results: both identify A1 missing AudioContext; current other implemented gates pass. These are baseline evidence, not evidence for this change.

No full compile/link or browser acceptance run was performed in this bounded task: coordinator explicitly owns the subsequent build/gate. No claim of A1 success or regression-free browser behavior is made.

## Next action / limits / stopping reason

Coordinator: activate Emscripten 4.0.18, run `./build.sh`, then run the real gate with fresh evidence. Verify generated shim and dist outputs and measure A1 after a trusted gesture. Music remains intentionally silent per audio-owner scope. `platform/README.md` still describes sound as disabled; left untouched because this task owns build.sh and web only.

Stopped after one minimal edit and one syntax/diff validation command; no acceptance attempt consumed. Existing evidence preserved, no new tests added.
