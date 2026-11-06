# Adaptive gameplay QA 009 — commit f0937a2
**Verdict: PASS (with 2 inconclusive items, 1 minor observation, no blocking defects).**
Gate reference: committed all13 PASS at ../tests/009-committed/results.json (not re-run). No code/protected files edited.
Setup: dist/ served over HTTP (localhost:8765), Playwright Chromium 1200x900, init script only *observing* AudioContext/keyevents (no game-state injection, no cheats). Every action chosen from the previous screenshot (see action-log.md; screenshots 01–32 in this dir). Live gameplay ≈ 70s after level start (t0 → blur tests ≈ 2+ min total session).

| Check | Result | Evidence |
|---|---|---|
| Menu → New Game → Episode → Skill | PASS | 01–06 |
| Level started (E1M1, 50 ammo/100% HP) | PASS | 06 |
| Move forward / run | PASS | 07, 12, 15 |
| Turn L/R | PASS | 08, 11, 19 |
| Fire, ammo change | PASS 50→49 | 09/10; WebAudio sources 56→57 on the shot |
| Pickups | PASS armor bonus (0→1→2%) | 15, 17 |
| Obstacle adaptation | PASS: hit wall (13), backed off/turned, found corridor (14) | 13,14 |
| Open/use door | INCONCLUSIVE — no door reached in ~70s; Space on wall (18) did nothing, expected | 16–20 |
| Kill enemy | NOT ATTEMPTED — no enemy encountered | — |
| Key release / focus | PASS: Left held, canvas+window blur → frames byte-identical (turn stopped); refocus click → input works; no keys stuck at end (key log) | 29–31 |
| SFX | PASS: AudioContext `running`, 59 BufferSource starts in session 1 | — |
| Music | PASS: Module.doomAudio.music has looping source, 2,116,800-sample buffer (~96s@22050), vol 0.50, ctx running; still playing after load | evaluate output |
| Save via menu | PASS: slot 1 "QA9", "GAME SAVED." | 22–24 |
| Reload + Load | PASS: slot listed after reload; loaded view/HUD identical to saved (49 ammo, 2% armor, same wall) | 27, 28 vs 24 |
| Console errors | 0 errors, 0 warnings | console log |

## Defects / observations
1. (Minor, likely not a defect) Frames occasionally differ while idle with no keys held (32 series); consistent with E1M1 flickering sectors/animations — view position unchanged, key log shows nothing held. Not reproduced as drift.
2. Page copy says status "Running Doom. Title/demo is normal; press Escape…" remains after the level starts (cosmetic, status text is not updated during play).
3. Audio is only evidenced via WebAudio API state/source counts, not audible output (headless limitation).
No reproducible functional defects found. Re-test suggestion for door/enemy: continue from E1M1 start toward the first door north of the start room (needs longer exploration).
