# User gameplay investigation: "no enemies? doors won't open"

Source revision tested: `b75fd6d` (branch `loop-run-2`), served from `dist/` over `python3 -m http.server 8765`.
Browser: Playwright Chromium. No protected files or code were modified; the WAD was only parsed read-only
(`parse_e1m1_readonly.py`, copy of the script used).

## Verdict

**Not reproduced. Enemies spawn, attack, and take shots; doors open on Space. No port defect found.**
The complaint is most consistent with (a) E1M1's start area being genuinely empty, (b) door/enemies being
a long walk away, and (c) pressing Space while not facing the door (see "Why the user probably failed").
One residual risk is listed under "Untested / caveats". It is not a confirmed defect.

## Setup verified
- Title -> Esc -> New Game -> Episode menu `Knee Deep` -> skill menu with cursor on **Hurt Me Plenty** (`01`-`03` screenshots) -> E1M1 "Hangar", 100% health, 50 bullets (`05-automap.png`).
  Not Nightmare, not demo.
- Key mapping checked in source: `platform/video_input.c` maps Space -> `KEY_USE` (0xa2), Ctrl -> `KEY_FIRE` (0xa3).
  These equal `key_use`/`key_fire` in `third_party/doomgeneric/m_controls.c`. Mapping is correct.

## Map facts (parsed from `assets/doom1.wad`, E1M1, offline)
- Player start (1056,-3616). Start hall is empty: the nearest monsters are far away.
- Monsters present on skill 3: zombiemen at (2912,-2816), (3056,-3584), (2272,-2432), (2272,-2352); imps at (3440,-3472), (3008,-4416). Many more (sergeants, etc.) are hard-only.
- Nearest door: linedefs 151/152, special 1 (DR door), texture BIGDOOR2, at x=1536..1552, y=-2560..-2432
  (centre -2496). It sits in a 64-unit tunnel (x 1472..1536) and must be used **from the west, facing east, within 64 units**.
  Zombiemen at (2272,-2432) etc. are in the room behind it.

## Reproduction (evidence)
1. Walked from start (steps `06`-`14`): north hall, around a barrel (a barrel at the hall's NE blocks a straight run - `09`/`10` show being stuck on it), then north.
2. Used the iddt automap (cheat; see caveats) to locate myself: inside the door tunnel at ~(1520,-2457) (`15`, `20`, `29`-`42`). The `idspispopd` cheat was toggled on then off before moving again, so later movement is normally clipped.
3. Door: with the automap arrow facing ~east/ENE at ~16 units from the door line, held **Space for 120 ms**. Door opened; two zombiemen visible beyond (`44-after-use2-1.png`). Earlier attempts `18`/`19`, `25`, `28`, `33`, `36`, `41` did nothing because the view/arrow showed I was facing a side wall (north wall STARTAN3, or oblique corner), not the door. Those are navigation/facing failures, not evidence of a defect.
4. Walked through (`46-through-door.png`): a zombieman immediately beside the door; **health 100% -> 88%**, then 79% (`48-firing.png`): enemies are alive and attacking.
5. Fire: held Ctrl (`48-firing.png`, `49-after-fire.png`): muzzle flash, **ammo 50 -> 49 -> 48**. Another zombieman visible at distance.
   I did not land a kill, so "enemy dies" is untested.

## Exact player instructions
1. Open the served `dist/index.html`, click **Start Doom**, click the canvas.
2. Esc -> **New Game** (Enter) -> **Knee Deep** (Enter) -> **Hurt Me Plenty** (Enter).
3. The start hall is empty by design. Leave it going north then east (use Tab automap); expect ~10-15 s of walking, a barrel to walk around.
   Reference coordinates: the door is at map (1536,-2496), ~1100 units north and ~480 east of the start.
4. In the short tunnel, face the door squarely (east). Press and hold Space ~100 ms. Door slides up, zombiemen are beyond.
5. Ctrl fires. Shift runs. Space = use (not Enter).

## Why the user probably failed
- No monsters in the start hall, and doors only respond when you face them within 64 units. A wall (STARTAN3, same grey tone as the door) next to the door looks identical in the 640x400 canvas, and my own first three attempts failed that way.
- Nothing on the page tells the user what the use key does, and Space only opens the door if aimed at it.
- Suggestion (non-defect, `web/index.html` copy): say "face a door within arm's length and press Space; E1M1's start hall has no monsters, the first ones are behind the door north-east".

## Untested / caveats
- **Instant taps**: my Playwright `keyboard.press('Space')` (down+up in the same tick) never opened a door, but every such attempt was also facing a wall, so this is inconclusive. Doom samples the key state per 35 Hz tic, so a sub-28 ms tap may drop; vanilla does the same. Not a port defect unless a human tap under ~30 ms is lost; recommend a future check press a facing-door with 0 ms vs 120 ms hold. Owning file if ever needed: `platform/video_input.c` (`keydown`/`keyup` queueing), not changed.
- Cheats used for navigation only: `idspispopd` (noclip toggled on, then off), `iddt` (map reveal). They set the cheat flag but do not affect door/monster logic.
- Not tested: kill, pickup, other doors, sound of doors, Ultra-Violence/Nightmare difficulty differences, `-nomonsters` (not passed: `index.html` args are only `-iwad /doom1.wad`).
- Prior QA lesson: "movement works" never exercised door or enemy logic; these now have screenshot evidence.

## Evidence files (this directory)
`01-menu`..`05-automap` setup; `06`-`14` walk; `15`,`20`,`23`,`26`,`29`-`31`,`37`-`39`,`42` automap/arrow positioning;
`16`-`19`,`24`,`25`,`27`,`28`,`32`-`36`,`40`,`41` failed attempts (not facing door);
`43`,`44-after-use2-*`,`45` door opens; `46` through door, damage; `47`-`49` firing.
