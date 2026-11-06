# QA 011 — Browser gameplay QA (revision 8648028)

Build: `dist/` served via `python3 -m http.server 8765`, driven with Playwright (Chromium) keyboard events; every claim below was checked by viewing the screenshots in this directory. No port/protected/loop files were edited (only files under this QA dir were added).

## Verdict: PASS (with limits below)

| Check | Result | Evidence |
|---|---|---|
| Page loads, Start Doom runs, controls text lists W/S, A/D, arrows, Space, E, Shift, 1–7, Esc/Enter | PASS | 01-load, 02-after-start |
| Menu via Enter / Up-Down arrows (New Game → skill → game) | PASS | 03–06 |
| W forward / S back | PASS (view changed) | 07, 08 |
| A / D strafe | PASS (view translated, no rotation) | 09, 10 |
| Left/Right arrows turn | PASS | 11, 12 |
| Shift run | PASS (further travel, qualitative) | 13 |
| Space fire, ammo decrements | PASS: 50 → 48 (held Space) → 47 (80 ms tap); HUD BULL 47/200 | 15, 17, 18 |
| Digits switch weapons | PASS-weak: 1/2/3 pressed with no crash; weapon sprite changed to fist at 1 and back with 2; 3 unowned | 19, 28 |
| Escape opens menu; arrows+Enter navigate to Save Game | PASS | 21–23 |
| Save-name letters type correctly (w,a,s,d,e,q,z) | PASS: slot shows "WASDEQZ" | 24 |
| Save persists across page reload, Load restores state | PASS: after reload, Load Game lists QA9 + WASDEQZ; loading restored ammo 47 and the same view | 26, 27 |
| Console errors | PASS: 0 errors, 0 warnings across 66 messages | console.log, console-full.log |

## Not verified / honest limits
- **E door interaction: NOT verified.** I ran/walked from the start area (28–30) and pressed E (31) but never reached a door; no visible effect. Key delivery for E was shown only indirectly (it typed correctly in the save-name box, and the contract harness covers it).
- **Combat against enemies: NOT verified.** No enemy encountered; fire was verified by ammo only, not hits/kills.
- Playwright `keyboard.press('Space')` (~0 ms hold) did NOT fire (ammo stayed 50, shots at 14/15). Taps of 80 ms and holds do fire. Likely sub-tic key down/up in the same game tick; real keyboard taps are ≥50 ms, so probably not a user-facing bug, but it is an observation worth knowing.
- Pre-existing "QA9" save in slot 1 came from earlier runs in this browser profile (persistence across sessions, incidentally).
- Movement distances judged visually; no exact coordinates. Single browser (Chromium), no audio audibility check, no gate re-run (gate result 011/results.json taken as given).
