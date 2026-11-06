# 009 — responsive viewport / focus

## Outcome and ownership

Implemented a bounded web-only responsive layout fix. No commit. Source HEAD at verification: `29abdf01c4df9e66673eb234f979797a46a60f2b` plus dirty working tree (platform audio changes pre-existed and belong to another owner). Changed `web/index.html`; added `tests/dev/viewport_test.cjs`. `build.sh` and `web/persistence.js` unchanged. Rebuilt generated `dist/` with Emscripten 4.0.18. No protected checks, platform runtime/input/audio, loop, assets, or third-party changes.

## Root cause and fix

Original canvas scaled only by available width, up to 960×600, in addition to the heading/status/buttons/help. Consequently an ordinary 1000×700 window needed substantial document scrolling and the HUD did not fit. Informational PageDown then moved the game outside the visible viewport, consistent with G1's empty/outside screenshot error.

The page now budgets vertical space for chrome/help and scales the entire 8:5 canvas according to both viewport height and available width. Uses stable viewport units where supported, with vh fallback. Tighter but readable heading/help spacing and hidden empty error text avoid wasted room. Fullscreen keeps the framebuffer's aspect ratio using contain. Startup updates the status before focusing/revealing the canvas, preventing focus scrolling based on pre-start layout. No keyboard listeners or PageDown suppression were added. Normal document scrolling remains available on short screens and outside the game; no overflow locking, forced focus on blur, or screenshot/check-specific behavior.

## Verification (development diagnostics, NOT authoritative gate)

Evidence under `artifacts/runs/20261103T051033Z-audio-c5ca21/logs/`:

- `009-build-viewport.log`: `./build.sh`, exit 0 with Emscripten **4.0.18**. Outputs dist/index.html, doom.js, doom.wasm, doom.data, persistence.js. Existing strict error propagation/version check and packaged `/doom1.wad` preserved.
- `009-viewport-test.json`, `.log`, `.png`: PASS in network-disabled `doom-capstone-toolchain` Chromium, served under `/doom/`. Zero browser/console errors. All HTTP asset requests relative to `/doom/`; audio worker blob requests excluded from HTTP-path assertion.
- At **1000×700**, complete canvas is **672×420**, y **126.8–546.8**. Entire document fits (scrollHeight 700). Start focuses canvas; ArrowDown, Space, and PageDown leave scrollY 0 and the whole canvas visible.
- Resize coverage: 1280×720, 800×600, 640×480, then 1000×700: full canvas remains visible with 8:5 ratio.
- At deliberately short 640×300, focus outside game + PageDown causes native document scrolling. No global key interception.
- `bash -n build.sh`, `git diff --check`: PASS.

Reproduction:

```sh
docker run --rm --network none \
  -v "$PWD/dist":/site:ro -v "$PWD/tests/dev":/devtests:ro \
  -v "$PWD/artifacts/runs/20261103T051033Z-audio-c5ca21/logs":/evidence \
  doom-capstone-toolchain node /devtests/viewport_test.cjs /site /evidence/009-viewport-test.json
```

The first diagnostic run passed all geometry/scroll assertions but failed its overly broad request-path assertion on legitimate blob workers from audio. The diagnostic now checks HTTP assets rather than treating blob URLs as external assets; final evidence is passing.

## S1 inspection and unresolved boundary

Inspected gate 008 `S1_saved.png` and `S1_after_reload_load.png`. The purported saved screenshot visibly shows **NEW GAME / CHOOSE SKILL LEVEL**, not normal turned gameplay. After reload the Load Game menu shows **EMPTY SLOT** in all slots. Thus this failed attempt did not establish a successful gameplay save before reload; it is not evidence of a committed save being lost. The incomplete menu progression predates the save sequence. Gate helper starts input immediately after clicking Start (before waiting for engine startup), and takes four timed Enters; startup/screen-wipe timing is a plausible race, especially under intermittent load. There is no observed page-level save-restore race: Start remains gated on IDBFS restore and main is called only once. I did not add artificial startup delays, synthetic input, or engine-timing/input changes to conceal this uncertainty. The viewport/focus change removes browser scroll/layout interference, but **S1 remains unproven and may still fail** for engine/startup timing reasons outside ownership.

Coordinator next action: authoritative rebuild/gate, inspect whether S1 reaches actual gameplay before saving. If it again shows a skill menu, assign startup/input lifecycle timing to the proper owner rather than modifying persistence based on this visual-difference failure. No authoritative acceptance run consumed by this work.
