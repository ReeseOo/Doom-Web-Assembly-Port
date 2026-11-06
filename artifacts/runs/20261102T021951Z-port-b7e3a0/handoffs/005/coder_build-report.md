# Attempt 005 — build/browser startup assessment

## Outcome: no source changes warranted

Inspected current HEAD `5160d88` and the existing dirty working tree. **No edits to `build.sh` or `web/` were made in this invocation.** No platform, protected, or acceptance files were edited. Existing uncommitted work was preserved. Only this report and diagnostic evidence under `artifacts/` were written, besides regenerated `build/` / `dist/` output. No delegation.

Read AGENTS.md, README.md, loop/README.md, artifacts/README.md, platform/README.md, the attempt-005 task, current protected criteria/browser script/build runner, and prior attempt-004 build report and actual gate results.

## Current startup contract

The current protected browser script explicitly finds and clicks Start/Play, then checks R1 and B3. R2 now samples 12 seconds; I1/I2/A1 are implemented. The prior report's absent-Start and unimplemented-I1/I2/A1 explanations do **not** describe the current checks.

The existing page correctly implements user-gesture startup:

- Defines Module before loading relative `doom.js`, with `noInitialRun: true`.
- Enables Start only on runtime initialization, with explicit ready/running/error states.
- On Start, disables repeat startup, focuses the canvas, and calls the exported `callMain` with `-iwad /doom1.wad`.
- Exposes load/startup errors rather than hiding them. The running label appropriately denotes requested startup, not independently verified gameplay.

Fresh diagnostic verification confirmed ready → real Start click → running, canvas focused, rendered framebuffer, and no console/page errors under `/doom/`. No startup fix, autoplay change, fake rendering, or gate-specific workaround is justified.

## Build assessment and evidence

Evidence directory (relative to repository): `artifacts/runs/20261102T021951Z-port-b7e3a0/tests/005-coder-build/`.

- `./build.sh` with local Emscripten **4.0.18**: **exit 0**; output in `build.log`.
- Outputs `dist/index.html`, `dist/doom.js`, `dist/doom.wasm`, `dist/doom.data`; hashes recorded in `sha256.txt`, alongside current owned-source hashes.
- Script uses `set -euo pipefail`, directly invokes the compiler/linker, and copies the HTML only after successful compilation/linking. Compiler/linker failures propagate. No error-masking pipeline is present.
- WAD preload is `--preload-file assets/doom1.wad@/doom1.wad`, consistent with runtime arguments. Runtime methods include `callMain` and `FS`.
- Relative JS and Emscripten companion-asset loading supports subpath deployment.

An inline diagnostic ran in `doom-capstone-toolchain` with `--network none`, read-only dist mounted at `/site`, and an HTTP server serving **only `/doom/`**. It waited for ready, clicked the actual Start button with Playwright, and inspected the page after two seconds. Evidence: `startup.log`, `startup.json`, `normal-start.png`.

Observed:

- Before click: ready, Start enabled, no error text.
- After click: running, Start disabled, canvas focused, no error text.
- 256,000 nonblack framebuffer pixels.
- Zero console errors and zero page errors.
- `/doom/doom.js`, `/doom/doom.data`, `/doom/doom.wasm`: HTTP 200; Wasm MIME `application/wasm`. No root-absolute companion asset requests.

## Remaining blockers / next action

No owned startup/build blocker was found. This diagnostic is **not** a full acceptance verdict: the orchestrator must run the current actual gates and independently verify source integrity and gameplay.

A1 remains a known functional gap outside this bounded startup repair: the existing build does not enable FEATURE_SOUND, and the page accurately states that sound is disabled. The current gate requires real engine-triggered sound effects; normal startup alone cannot satisfy it. Do not reinterpret the old report as implying A1 is unimplemented or exempt. R3/G1 are still described as not implemented in the browser script; broader completion must be assessed by the orchestrator.

Stopped after a successful rebuild and bounded startup verification because no legitimate owned defect was demonstrated. No source repair or new tests were needed. Full gates intentionally left to the orchestrator as assigned; exact token usage is unavailable.
