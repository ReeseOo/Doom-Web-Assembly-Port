# Action log (QA 009) — commit f0937a2, dist served via `python3 -m http.server 8765` from dist/, Playwright MCP, Chromium 1200x900
Each action chosen after viewing the preceding screenshot. t = seconds since level start (Enter on skill menu).
| # | Prior screenshot / observation | Action | Result (screenshot) |
|---|---|---|---|
| 1 | 25-ready page, Start enabled | click Start Doom | 01 title screen |
| 2 | 01 title/demo | Escape | 02 main menu, cursor on New Game |
| 3 | 02 | Enter | 03 episode menu |
| 4 | 03 | Enter (Episode 1) | 04 skill menu, cursor on Hurt me plenty |
| 5 | 04 | Up, Up | 05 cursor on "I'm too young to die" |
| 6 | 05 | Enter | 06 E1M1 start, ammo 50 HP 100 (t=0) |
| 7 | 06 open water room | hold Up 1.2s | 07 view advanced |
| 8 | 07 | hold Left 0.5s | 08 view rotated |
| 9 | 08 | Ctrl 120ms | 10 ammo 50->49; WebAudio source started (+1) |
| 10 | 10 | hold Left 0.6s (look for exit) | 11 |
| 11 | 11 doorway/lamps right | Shift+Up 2s | 12 |
| 12 | 12 wall + stairs right | Right 0.6s, Shift+Up 1.5s | 13 stuck on wall/lamp (obstacle) |
| 13 | 13 obstacle | Down 0.7s, Right 0.7s | 14 corridor visible (t=37s) |
| 14 | 14 | Shift+Up 2s | 15 armor bonus picked up, wall |
| 15 | 15 | Down 0.5s, Left 0.8s | 16 open room, no door |
| 16 | 16 | Shift+Up 2.5s | 17 armor bonus, wall |
| 17 | 17 | Space (use) then Right 1.2s | 18, 19 (t=60s) no door |
| 18 | 19 | Shift+Up 2.5s | 20 along wall; door not found |
| 19 | 20 | Escape, Down x3, Enter | 21 menu -> 22 Save Game, 6 empty slots |
| 20 | 22 | Enter, type q a 9, Enter | 23 "QA9_" -> 24 "GAME SAVED." |
| 21 | 24 | reload page, Start, Escape | 25, 26 title+menu (fresh session) |
| 22 | 26 | Down x2, Enter | 27 Load Game lists "QA9" |
| 23 | 27 | Enter | 28 same view/HUD as save (49 ammo, 2% armor) |
| 24 | 28 | hold Left, blur canvas+window | 29/30 frames byte-identical => turn stopped |
| 25 | 30 | click canvas, hold Right 0.4s | 31 view changed; input works after refocus |
