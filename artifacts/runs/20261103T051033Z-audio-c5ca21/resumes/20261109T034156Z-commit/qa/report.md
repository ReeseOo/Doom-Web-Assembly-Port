# Browser QA report — verdict: PASS

Source revision under test: 334193053c2052b0fcc5241124bff4a14f5fc7f6 plus the pending uncommitted `web/index.html` change.
Served `dist/` at http://localhost:8765/ and drove it with Playwright (Chromium).
Gate evidence: `../tests/results.json` has verdict PASS, complete=true. I read this file but did not re-run the gate.

| Step | Evidence | Result |
|---|---|---|
| Startup instructions (Start Doom, click the game, press any key, New Game > Knee-Deep in the Dead > skill) | qa/01-startup.png | pass |
| Start Doom, then the title/demo runs | qa/02-after-start.png | pass |
| Any key opens the main menu | qa/03-menu.png | pass |
| New Game, then skill screen (the Enter after New Game went straight to skill selection, no episode screen was captured) | qa/05-skill.png (04-episode.png was captured at the same point) | pass |
| Episode 1 starts: 100% health, 0% armor, 50 bullets | qa/06-e1m1-start.png, qa/07-before-move.png | pass |
| Move forward (W held 1.5 s) changes the view | qa/08-after-forward.png | pass |
| Turn left (ArrowLeft) changes the view | qa/09-after-turn.png | pass |
| Fire (Space) takes ammo from 50 to 49 | qa/10-firing.png, qa/11-after-fire.png | pass |

Blocking failures: none.

Notes:
- I did not check audio output.
- Screenshots 06 and 07 showed stable E1M1 frames.
- 01-startup.png and 04-episode.png were captured but not opened.
- Console error check: no errors were returned.
