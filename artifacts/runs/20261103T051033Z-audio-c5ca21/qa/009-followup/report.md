# QA 009 follow-up: door + enemy (commit f0937a2)

Source revision: f0937a2 (no port changes). Served `dist/` via `python3 -m http.server 8765`. Playwright Chromium. Fresh session started from the title screen through the real menu (Esc → New Game → Episode → Skill "I'm too young to die") → E1M1.
No cheats, no injected state, no canned route. Every move/turn was a short key hold (Playwright keyboard down/up), followed by a screenshot that I viewed before choosing the next action. The Tab automap (a normal in-game feature) was used 5 times to locate doors after I got lost; one move+use combo (Space then Up, step 84) was sent together after the door had already been observed opening twice.

## Door (required) — PASS (true evidence)
- 76-face-door.png: facing a gray panel (closed door) in the corridor north of the start room.
- 77-use-1.png: Space tapped (key press ~0ms) -> no change. Adaptation: Space needs a longer hold (~150 ms) to be polled by the game.
- 78-use-2.png: after 150 ms Space hold, the door opened and a new room (computer room with blue pillars, red ceiling lights) became visible.
- 80-turnR17.png: door seen closed again (auto-close). 81-reopen.png: Space again -> door open again (second independent confirmation).
- 84-entered.png: passed through the door into the room.

## Enemy — observational
- 84–86: took damage after entering (health 104 → 94 → 74 → 62 → 60 → 50, armor 1 → 0).
- 87-find-shooter.png: a zombieman (former human) was at point-blank on my right.
- 88-aim2 / 89-fire2: turned to it and fired (ammo 47 → 45, damage stopped at 50%).
- 89/90: enemy no longer on screen; no corpse found in the view. Kill NOT confirmed (it may have died out of view or moved); health stopped dropping afterward.
- Also fired 3 bursts earlier (86-fire1) at a distance toward the alcove (ammo 50 → 47).

## Other observations
- Both Space-use and Ctrl-fire work through the port's keyboard input.
- Console: 0 errors, 0 warnings (33 log lines, all engine startup).
- Audio state at end: AudioContext `running`, `Module.doomAudio.music` present (observation only; not audible in headless).
- No keys left held (all actions ended with keyup).
- Attract-demo footage is rendered behind the menu while the menu is open; this is normal Doom behavior (not a defect).
- Earlier 009 checks (menu, move/turn/fire, save/load, focus loss, SFX, music) stay valid.

## Evidence
Screenshots 01–91 in this directory. Note: `.playwright-mcp/` holds Playwright's own snapshots/console logs.
