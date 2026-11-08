# 012 — prominent focus / Enter menu prompt

## Outcome and scope
Completed bounded web-only task. Source HEAD: `f2b1306d40af15e10d9bd70cdd86791747a1d148` plus this edit. Only implementation file changed by this agent: `web/index.html`. This report is the only additional file written. Pre-existing `artifacts/state.json` changes and untracked resume artifacts were left alone. No commit or push; no protected files changed.

## Change
- Added a large bold yellow/near-black instruction panel immediately above the canvas: “Click the game to focus, then press Enter to open the menu.”
- Explained Start Doom → title/demo → Enter → New Game → episode/skill, with arrow navigation.
- Associated both instruction paragraphs with the focusable canvas via `aria-describedby`; semantic aside and keyboard labels, no blinking/live repeated announcements.
- Aligned ready/running status wording. Preserved all existing controls, event handlers, save functionality, fullscreen and relative asset paths.
- Increased vertical canvas budget for the new panel and added narrow-screen sizing. Panel remains normal document flow, never an overlay over the HUD. Entire framebuffer retains its 8:5 aspect ratio. Deliberately short viewports retain ordinary document scrolling.

## Read-only engine verification
- `third_party/doomgeneric/g_game.c:749–762`: when no game action is pending and title/demo is active (not singledemo), any keydown calls `M_StartControlPanel()`. Thus Enter opens the menu from the normal title/demo screen.
- `third_party/doomgeneric/m_controls.c:150,156`: Escape is menu activation, Enter is menu forward/select. `m_menu.c:1755–1765` retains Escape activation outside menus. No promise that Enter opens menus during active gameplay; existing Escape help remains.
- `platform/video_input.c:34`: Enter/NumpadEnter map to Doom key 13. No input or platform changes made.

## Checks
- Read required repository documents and prior run/handoff evidence (including 009 viewport and 011 controls reports).
- `git diff --check`: PASS.
- Ran inline Node/Playwright Chromium diagnostic in existing `doom-capstone-toolchain` container, network disabled, repository mounted read-only. Served current `web/index.html` plus existing `dist/` runtime assets at `/doom/`. No test files added or modified.
- Initial diagnostic caught canvas bottom extending past 320×568 viewport. Added narrow-screen sizing, then reran successfully.
- Final geometry PASS: panel above canvas, no horizontal overflow, full canvas visible, 8:5 aspect ratio at 1000×700, 1280×720, 800×600, 640×480, 375×667, 320×568. Canvas top/bottom respectively: 289.17/589.17; 289.17/609.17; 278.77/478.77; 307.38/467.38; 364.53/571.52; 428.31/536.30 pixels.
- Browser startup reached ready/running; clicking canvas then Enter changed title/demo framebuffer and retained canvas focus; zero page errors. This framebuffer-change diagnostic is supporting evidence, not menu OCR; definitive Enter behavior verified from engine source above.
- Yellow `#ffd54f` panel with `#101010` text; primary instruction computed at 20–28px across tested sizes.

## Limits / next action
No full rebuild or protected acceptance suite run for this HTML/CSS-only milestone. Browser checks used existing compiled runtime with the newly edited source HTML; generated `dist/index.html` intentionally unchanged under the bounded edit instruction. Root should review and rebuild before publishing to propagate source HTML. Existing build.sh Emscripten 4.0.18 enforcement, packaged WAD, compiler/linker fail-fast behavior and asset paths were not touched. No persistent server/container left running. Task complete; no unresolved implementation issue.
