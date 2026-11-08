# 012 Integration review: focus-then-Enter menu prompt

Source: f2b1306 plus uncommitted web/index.html. Reviewer: independent, read-only. No code or protected files changed.

## Verdict: PASS (with limitations)

## Evidence checked
- `git diff web/index.html`: adds a high-contrast (#ffd54f on #101010) `<aside class="menu-prompt">` between the buttons and the canvas. It says "Click the game to focus, then press Enter to open the menu" and a second line says to pick New Game, then episode and skill.
- The canvas gets `aria-describedby` for both prompt paragraphs. The status text is updated to match.
- Production packaging: `tests/012/dist_inventory.txt` has `index.html` sha256 1b7fe8a9..., which equals `web/index.html` (checked with shasum). `dist/index.html` contains the new prompt (9 `menu-prompt` matches). `build.log` ends "Built dist/…". The only warning is the pre-existing third_party `abs` one.
- `results.json` and `gate.log`: all checks PASS (B1, B2, B3, R1-R3, T1, I1, I2, A1, G1, M1, S1), nothing unimplemented. The B2 protected-file check passes, and revision f2b1306 and the source digest are recorded.
- The "Start Doom" click gesture still works (`start_gesture.txt`), so the new aside did not break control discovery.

## Findings
1. Discoverability: good. The prompt is large (1.25-1.75rem, bold), placed before the canvas, and described by aria. Pressing Enter on the title/demo opens the menu, which matches Doom behavior. It also matches `CRITERIA.md` (Enter = menu select). The old status text told players to press Escape, and the new text no longer says that. The help paragraph still lists Escape: menu, so the two stay consistent.
2. Minor: the prompt says "Click the game to focus" and the line below says "After Start Doom". Start already focuses the canvas via `focus({preventScroll:true})`, so the order is slightly redundant. The first line could be read as skipping the Start button. This is not blocking.
3. Responsive layout, a trade-off: the canvas height budget grew from 100vh-280px to 100vh-400px (460px at 480px width or less). On a 700px-tall window the canvas shrinks from about 672px to 480px wide. On 800px it shrinks from 832px to 640px. Short windows hit the 160px (or 96px) floor and rely on scrolling. The HUD stays visible, which was the earlier goal, but the game is noticeably smaller on laptops. The prompt's own height is only an estimate (it wraps to more lines on narrow screens), so the fixed offsets may not always match.
4. The `@supports` nested inside `@media` is valid CSS. Old browsers fall back to the `vh` rule.

## Test limitations
- Nothing in the gate asserts that the prompt exists, that it is visible, or that it does not overlap the canvas. All checks use the acceptance harness's own flow.
- I did not run a browser or check the layout visually. The screenshots in `tests/012/` (R1_canvas.png etc.) are canvas captures and say nothing about the page layout.
- The responsive checks were not run at mobile or short viewports. `uncommitted_files: 1` means the run tested a dirty tree. The digest ties the evidence to the exact `index.html`, and the hash comparison confirms dist matches it.
- Touch devices have no Enter key. Prompt wording is keyboard-only, which is consistent with the project's keyboard-play scope.

## Recommendation
Accept. Optionally add a layout check at about 1366x768 and 375x667 that asserts the canvas and HUD are visible. Optionally trim the redundant "Click the game to focus" wording.
