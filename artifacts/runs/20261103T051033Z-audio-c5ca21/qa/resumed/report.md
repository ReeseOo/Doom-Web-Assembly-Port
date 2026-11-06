# Browser gameplay QA (resumed) — revision b75fd6d8578ad3c9a5a9765d088057464f4acd90

Method: `python3 -m http.server 8765` on `dist/`, Playwright MCP Chromium, real screenshots (this dir), adaptive keyboard actions. No code edited.
Console/page errors captured during both sessions: **0**.

## Verdict: PASS (with enemy-kill not achieved, see limitations)

| Area | Result | Evidence |
|---|---|---|
| Page load / Start button enabled | PASS | 01-before-start.png |
| Start click -> game running | PASS | 02-after-start.png |
| Not frozen (12 samples, 1/s) | PASS: 11 distinct frames | 03-attract.png |
| Menu (Enter -> New Game -> Episode -> Skill) | PASS | 04,05,06 |
| New level starts (ammo 50, health 100%) | PASS | 07-level-start.png |
| Turning (hold Left) changes view; stops on release | PASS | 08, 09 |
| Forward movement | PASS | 10-forward.png |
| Firing (Ctrl): ammo 50->48, bullet decal on wall | PASS | 11-firing.png |
| Use (Space) / exploration; pickups collected (health bonus, armor bonus; health 103%) | PASS (no door actually opened/observed) | 12, 13, 17 |
| Escape menu opens over game, resumes with Escape | PASS | 14-pause-menu.png, 15 |
| Blur/focus: canvas blurred + blur event while ArrowUp held -> player stopped, view unchanged; refocus + turn works | PASS | 15-after-blur.png, 16 |
| Enemy kill attempt | NOT ACHIEVED: no enemy encountered in ~1 min of blind exploration | 17-hunt.png |

## Action log
1. Load /index.html, reload, screenshot; click #start; wait 3s; sample canvas hash 12x.
2. Enter x4 through menu to level start; hold Left 700ms; hold Up 1.5s; hold Right 0.5s; 4x Ctrl taps; Space.
3. 8 cycles of (Up 1.2s, Space, Left 0.35s, 2x Ctrl); Escape (menu), Escape (close); held ArrowUp + dispatched window blur + canvas.blur(); refocus; Right; 10 cycles of walk/turn/fire.

## Observations / defects
- No gameplay defects observed. Not-yet-tested: music (not implemented per page text), saves, fullscreen.
- Minor note: the "paused" frame-static hash check returned false because the menu overlay over a live level still animates (Doom menu does not pause in this port's frame sampling, or sprites/pickup text animate); screenshot 14 shows menu rendered correctly. Not judged a defect without further tests (movement-while-menu not verified).
- Menu "New Game" is reached via Enter from the demo (demo input opens menu) — works; the page hint says Escape.

## Limitations
- Keyboard events are synthetic Playwright events; no real window-switch focus loss, no audio audibility check (headless), no door observed opened, no enemy kill (R3/G1 known not_implemented, not counted).
- Time-based blind navigation, not map-aware.
