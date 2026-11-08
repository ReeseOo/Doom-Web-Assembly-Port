# Browser QA 012 — prominent menu prompt

**Verdict: PASS** (with limitations below)

Source revision: HEAD f2b1306 + uncommitted web/index.html. `dist/index.html` is byte-identical to `web/index.html` (diff clean); dist files dated Nov 8 12:32. Served via `python3 -m http.server` on dist, driven with Playwright Chromium. No port/protected edits, no commit/push.

## Results
| Check | Result | Evidence |
|---|---|---|
| Prompt prominent/readable pre-start (1366x768) | PASS: yellow #ffd54f panel, dark bold text, ~28px headline "Click the game to focus, then press Enter to open the menu." plus New Game / episode / skill follow-up | 01_desktop_prestart_full.png |
| Enter opens menu from title/demo after Start Doom + canvas click | PASS: main menu (New Game, Options, ...) drawn over running demo | 02, 03 (desktop); 09 (narrow) |
| New Game -> episode -> skill via Enter | PASS: "Which Episode?" then "Choose Skill Level" screens | 04, 05 |
| Game starts; move (W) and fire (Space) | PASS: view moved; ammo 50 -> 49 after one shot, HUD 100% health | 06, 07 (desktop); 10 (narrow, ammo 50 start) |
| 1366x768 layout | PASS: no scroll (docH 768); prompt y129-243, canvas y253-621 (bottom of canvas incl. HUD fully inside viewport); 10px gap, no overlap | 01-07 |
| 375x667 layout | PASS: prompt y147-282, canvas y292-499, 10px gap, no horizontal overflow (docW 375); full HUD visible; help text reachable by scrolling (docH 740) | 08-10 |

Screenshots (this dir): 01_desktop_prestart_full, 02_desktop_running_demo_full, 03_desktop_after_enter_menu, 04_desktop_episode, 05_desktop_skill, 06_desktop_game_start, 07_desktop_after_move_fire, 08_narrow_prestart_full, 09_narrow_after_enter_menu_full, 10_narrow_ingame_full.

## Limitations
- I did not re-run build.sh or the tests/012 gate. The saved gate.log in artifacts/runs/.../tests/012 shows "B1 build.sh exit 0" and "VERDICT: PASS | complete: True | rev f2b1306d40", but it records no process exit code for the gate itself. I couldn't independently confirm "gate exited 0" beyond that log.
- Interaction was done with synthetic Playwright keypresses in one browser (Chromium), with no real device, Safari or Firefox. Skill was left at the default; no other skill was chosen.
- Narrow in-game test did not capture a before/after move diff (only the HUD and fire at 50 ammo); movement/fire was verified on desktop.
- Console log was not audited for errors in detail.
- Prompt copy stays static after Start Doom ("After Start Doom: ..."), which is slightly stale but not misleading.
