# Attempt 004 — browser startup diagnosis

## Outcome

**No source repair warranted by the reproduced failure. Normal user Start boots DOOM. The protected browser gate still fails due to its startup assumptions.** No source files changed, no protected checks changed, no commits made. Existing user changes preserved. Generated `dist/` was rebuilt successfully.

Source revision: `9339d0c857eb227fcbf1d6db61bacb12b9ac4b00` with the pre-existing dirty working tree. Tested source hashes: build.sh `9f8c492c348e7e5465508f811c98eced08a9acfb8db92c3881a0177d99a6f54c`; web/index.html `018e676bc714034151daa919beb6b930b0858e1730a4816c5ed85bb712def387`. Full generated inventory: `artifacts/runs/20261102T021951Z-port-b7e3a0/tests/004/sha256.txt`.

## Actual diagnosis

Read the required repository instructions, prior attempt 003 evidence and handoffs, the failing resume evidence, and the actual protected browser script. Reproduced all four browser results using the supplied `doom-capstone-toolchain` container (Chromium 141.0.7390.37).

1. **B3 is a response-observation timing race, not a broken relative asset URL.** The protected script evaluates its Wasm response list immediately after `page.goto(..., {waitUntil: 'load'})`. Emscripten initiates an asynchronous fetch: document load does not wait for that fetch. In direct instrumentation, only HTML and JS responses existed at load; by runtime ready, `/doom/doom.wasm` had returned HTTP 200 with `application/wasm`. `/doom/doom.data` also loaded successfully. No root-absolute game asset requests occurred.
2. **R1 does not perform the page's required Start interaction.** `Module.noInitialRun=true` deliberately leaves the canvas blank until Start. The protected script only finds/screenshots the canvas; it never clicks Start. Its 15-second blank result is therefore expected, not evidence of a broken Start handler.
3. **R2 likewise samples an unstarted canvas**, so its one distinct frame is expected. Even after Start, the initial title can legitimately remain static over the short sample window; earlier development evidence explicitly documents this.
4. **Normal Start succeeds in the same container browser.** Waited for `#status[data-state=ready]`, clicked the real `#start` button through Playwright, then observed the running status, engine initialization including `/doom1.wad`, an actually drawn framebuffer (256,000 nonblack pixels after two seconds), and zero console errors/page errors. Screenshot saved. There was no demonstrated browser startup bug to minimally repair.

Autoplay, a fake canvas animation, or changing lifecycle timing solely to satisfy these checks would mask the mismatch and change the existing Start contract. None was implemented. Errors remain visible.

## Commands and evidence

All paths below are relative to the repository root. Evidence directory: `artifacts/runs/20261102T021951Z-port-b7e3a0/tests/004/`.

- Container diagnostic using `docker run --rm -i --network none -v "$PWD/dist":/site:ro doom-capstone-toolchain node` with a temporary in-process HTTP server restricted to `/doom/` and Playwright: `diagnostic-before.json`. Shows successful relative asset requests and engine logs after normal Start.
- Exact current protected browser script executed read-only:
  ```sh
  docker run --rm --network none \
    -v "$PWD/dist":/site:ro -v "$PWD/tests/accept":/checks:ro \
    -v "$PWD/artifacts/runs/20261102T021951Z-port-b7e3a0/tests/004":/evidence \
    doom-capstone-toolchain node /checks/browser.spec.js /site /evidence
  ```
  Output `browser-before.log`, `browser_results.json`, `R1_canvas.png`, `R2_canvas_last.png`: B3/R1/R2 fail as before, T1 passes (60.1 fps, max gap 17 ms). This reproduction mounts current checks; `git diff acceptance-v1 -- loop assets third_party tests/accept` is empty.
- Additional inline container instrumentation saved `start-proof.json` and `normal-start.png`. Records response lists at document load versus runtime ready, real Start click, pixels, and error list. Its diagnostic server labels `.data` as text/html (unimportant for fetch/preload); the acceptance server correctly uses application/octet-stream. Wasm MIME is application/wasm in both servers.
- `emcc --version`: Emscripten 4.0.18.
- `./build.sh > artifacts/runs/20261102T021951Z-port-b7e3a0/tests/004/build.log 2>&1`: **exit 0**, producing dist/index.html, doom.js, doom.wasm and doom.data. Existing engine warnings retained; no compiler/linker errors. Build already uses `set -euo pipefail`, packages `assets/doom1.wad@/doom1.wad`, exports callMain/FS, and uses relative output loading. No build.sh edits needed.

## Remaining blockers / next action

- Protected browser gate remains red. Owner should reconcile its no-click startup assumption and premature Wasm sampling with the existing click-to-start contract. This agent did not modify or weaken checks and does not claim acceptance success.
- R3/I1/I2/G1/A1 remain student-owned/unimplemented acceptance checks; no work attempted on them.
- Orchestrator should independently verify the diagnosis and normal Start evidence before deciding whether to assign any lifecycle-contract change. No platform ownership blocker or actual failed user startup was found in this investigation.
