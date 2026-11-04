# Acceptance criteria: DOOM to WebAssembly port

Status: DRAFT. Not frozen until committed and tagged by the student (see "Freeze procedure").
Owner: student. Test code may be drafted with AI assistance but is reviewed by the student.
Intended location: `tests/accept/CRITERIA.md` (protected from coder edits).

## How to read this document

- Every check has an ID. The same ID appears in `results.json` written by `tests/accept/run.sh`.
- "Gate" checks decide pass/fail through scripts. They are deterministic (or flake-tolerant with a recorded retry count).
- "Evidence-only" checks (agent-observed) support the write-up but never decide pass/fail.
- Thresholds below are proposals. After the first real run, record the observed values and tune them, logging every change in the Change log with a reason.
- Every result must record the git revision and a source digest, plus paths to saved evidence.
- Each check lists a fault to inject. A check that has never been seen failing on a deliberately broken build is not trusted.

## Environment

- Browser: [CHOOSE ONE and pin version, e.g. Chromium via Playwright 1.56.1 from the supplied Dockerfile]
- Toolchain: Emscripten 4.0.18 (supplied image)
- Network during checks: none, except the loopback server serving `dist/`
- Game data: supplied `assets/doom1.wad` only

## Gate checks: build and integrity (script)

### B1 Clean build
- Measures: the port builds from a clean checkout.
- Pass: `bash ./build.sh` exits 0, and `dist/` contains the HTML, JS, Wasm, and data files the build documents.
- Evidence: command, cwd, start/end time, exit code, stdout/stderr, inventory of `dist/` with digests.
- Could be fooled by: a `build.sh` that exits 0 without compiling (for example it copies stale files).
- Does not prove: the game runs.
- Fault to inject: introduce a C syntax error. B1 must fail.

### B2 Protected inputs unchanged
- Measures: agents did not alter what they must not alter.
- Pass: SHA-256 of `assets/doom1.wad` and a tree hash of `third_party/doomgeneric/` match the baseline; `git diff <baseline-tag> -- loop assets third_party tests/accept` is empty.
- Evidence: baseline tag, hashes, diff output (expected empty).
- Could be fooled by: an agent editing the baseline tag itself. Mitigation: student verifies the tag outside the agent session.
- Does not prove: anything about behavior.
- Fault to inject: change one byte in a third_party file. B2 must fail.

### B3 Serving
- Measures: the build deploys as static files.
- Pass: `.wasm` is served as `application/wasm`; the game loads when served from a subpath such as `/doom/`. Evaluated after the start gesture, since the port may fetch the wasm only when Start is clicked.
- Evidence: HTTP response headers, load result.
- Could be fooled by: testing only at the site root, which hides absolute-path bugs.
- Does not prove: gameplay.
- Fault to inject: hardcode an absolute asset path. The subpath load must fail.

## Gate checks: browser (Playwright)

### R1 Boots cleanly
- Pass: after the start gesture (the check clicks a visible Start/Play control if the page has one, else the canvas), the canvas is present and nonblank within [N=15] seconds, with zero console errors and zero page errors.
- Evidence: console log, screenshot, timings.
- Could be fooled by: a page that draws a static image and swallows errors.
- Does not prove: the engine is running.
- Fault to inject: stop packaging the WAD. R1 must fail.

### R2 Not frozen
- Pass: after the start gesture, canvas pixels differ between samples taken once per second across a [12]-second window. The Doom title screen is static for about 5 seconds before the demo begins, so a shorter window can false-fail.
- Evidence: frame hashes with timestamps.
- Could be fooled by: any animated element, such as a blinking cursor.
- Does not prove: simulation correctness.
- Fault to inject: draw the frame once and never again. R2 must fail.

### R3 Colors correct
- Pass: among the frames captured during R1 and R2, the best one matches TITLEPIC (decoded by the test from the supplied `assets/doom1.wad` and its PLAYPAL palette, not from the port) with a mean absolute error below [30] per channel (0-255) after scaling to 320x200, and the error is lower than it would be if red and blue were swapped.
- Evidence: the decoded reference image, the best-matching canvas frame, both error numbers.
- Could be fooled by: capturing a moment when the attract mode is showing something else. The test must wait for or navigate to the title screen.
- Does not prove: in-game rendering is correct.
- Fault to inject: swap red and blue channels. R3 must fail.

### I1 Keydown and keyup
- Pass: in a started level, holding Left (turning, which a wall cannot block) changes the 3D view area; after release the view stops changing. Measured as distinct view-area frames: idle baseline vs while turning (at least max(4, idle+2)) vs after release (at most idle+1).
- Informational, not gating: whether a held key is released when the window loses focus (a synthetic blur event is dispatched).
- Evidence: view-frame hash counts, screenshots during the turn and after release.
- Could be fooled by: animated sprites or lighting changing the view region. Test in a quiet spot and record the baseline noise.
- Does not prove: controls feel right.
- Fault to inject: drop the keyup handler. I1 must fail.

### I2 No page scroll
- Pass: pressing arrows and Space for the duration of a run leaves `window.scrollY` unchanged. The result names any key that scrolled the page. PageDown is recorded for information only (it is not a game control).
- Evidence: scroll positions before and after.
- Could be fooled by: a page too short to scroll. Make the test page scrollable.
- Fault to inject: remove `preventDefault`. I2 must fail.

### T1 Responsive
- Pass: `requestAnimationFrame` averages at least [30] fps over [10] seconds with no single gap over [250] ms.
- Evidence: frame timing series.
- Could be fooled by: rAF running while the engine is stalled. Pair with R2 and I1.
- Does not prove: smooth gameplay.
- Fault to inject: make `DG_SleepMs` busy-wait. T1 must fail.

### T2 Simulation rate (evidence-only, non-gating)
- Observation: if a tick counter or demo duration is available, record the rate over [10] seconds against the 35 tics per second target. If none is available, the QA agent notes whether movement speed looks plausible.
- Evidence: counter readings with timestamps, or the QA observation.
- Does not prove: correct timing. This is not a gate (see scope decisions).

### G1 Gameplay
- Pass: start E1M1 from the menu; the status-bar ammo number is stable while idle; the view changes while moving forward or back; the ammo number region changes after 3 pistol shots; at least [60] seconds of play pass with no new console or page errors. Turning is covered by I1.
- Not gating: opening a door. A route to a door cannot be verified without a real run, so the check walks forward pressing Space and saves before/after screenshots only.
- Evidence: view-frame counts, before/after images of the ammo region, door screenshots, console log.
- Could be fooled by: scripted inputs that coincidentally change pixels. Each action needs a specific expected effect.
- Does not prove: all of Episode 1 works.
- Fault to inject: break fire handling. The ammo assertion must fail.

## Gate check: audio (Playwright)

Audio is in scope and a goal for the MVP. Sound effects are gated. Music is a goal but evidence-only (see scope decisions).

### A1 Sound effects are output
- Measures: the page produces audible output when the game triggers a sound effect.
- Pass: after the first user input (browsers require a gesture), an `AudioContext` exists and reaches `running`; and for each of two triggers (firing the weapon with Ctrl, and moving through the menu with Escape/Down/Up) the peak output RMS in the trigger window is at least [0.003] and at least [1.5x] the peak in a baseline window just before it (or the baseline is below [0.0005], or the trigger peak exceeds the baseline peak by at least [0.01] absolute, which matters once music is playing). The ratio is 1.5x, not 10x, because music may already be playing in the baseline. Tune after observing real values.
- How to measure: before the page loads, inject a script (`page.addInitScript`) that wraps `AudioNode.prototype.connect` so anything connected to `ctx.destination` also feeds an `AnalyserNode`, then sample it. This avoids needing the port to export anything.
- Evidence: context state, baseline and trigger-window levels with timestamps, the trigger action, console log.
- Could be fooled by: constant noise or a DC offset, which is why the check compares against a silent baseline and ties the rise to an action. Also by a context that plays one test tone unrelated to the game; run the check with two different triggers.
- Does not prove: the correct sound plays, sounds are in sync with events, volume or mixing is right, or music works.
- Fault to inject: disable sound output (or never resume the context). A1 must fail.

## Gate check: music (Playwright)

### M1 Music plays
- Measures: continuous background audio during play, with no input and no sound effects.
- Pass: an `AudioContext` is running and, over a 4-second idle window in the level, at least [50%] of 50 ms samples have RMS above [0.0008] with a peak of at least [0.002].
- Evidence: per-sample levels in `M1_levels.json`.
- Could be fooled by: any steady hum or noise. It cannot tell the right tune from a wrong one.
- Does not prove: the correct music plays, plays in tune, or changes per level.
- Fault to inject: disable music output. M1 must fail.

## Gate check: saved games (Playwright)

### S1 Saves survive a reload
- Measures: a game saved from the menu persists in browser storage across a page reload and loads back.
- Pass: in a fresh page, the test starts E1M1, turns the player so the view is clearly different from the start (difference above [8]), saves to slot 1 through Escape > Save Game with a typed name, reloads the page, then loads slot 1 through Load Game. The view after loading is close to the view at save time (difference below [8]) and closer to it than to the fresh-start view.
- Evidence: the fresh, saved, and loaded-after-reload views and the three difference numbers.
- Could be fooled by: a menu that appears to load but returns to the same default view. The turn makes the saved view differ from the fresh one, which guards against that.
- Does not prove: saves persist across browsers, devices, or after clearing site data, that every slot works, or that all game state (monsters, items) is restored.
- Fault to inject: skip flushing saves to browser storage. S1 must fail.

## Scope decisions (resolved)

- Audio: in scope and an MVP goal. Sound effects are gated by A1, and music is gated by M1.
- Saved games (S1): in scope and gated. Saves must persist in browser storage across a page reload.
- Enemy death (G2): evidence-only. The QA agent attempts to kill an enemy and saves before/after screenshots and its action log. It does not gate the pass. Limit: enemy behavior, damage, and level progression are not gated.
- Simulation rate (T2): evidence-only. It is not required to expose a tick counter. Limit: a wrong game speed is only caught if it also breaks T1, R2, I1, or G1.

Any change to these decisions goes in the change log with a reason.

## Regression demonstration (at least two, after initial success)

Purpose: show the loop detects and repairs faults it was never told about, then verifies the fix.
Precondition: a revision that passed every gate check, with its PASS evidence and a tag (for example `pass-v1`).

### Protocol
1. Injector: a teammate or instructor, not the student if at all possible. If you must do it yourself, say so in the write-up. The injector applies the changes to port code only (`platform/`, `web/`, `build.sh`), never to `loop/`, `assets/`, `third_party/`, or `tests/accept/`.
2. Inject at least two regressions that affect different checks. Make at least one of them subtle enough that you are not sure the checks will catch it. A missed regression is valuable evidence and goes in the write-up.
3. Disclosure: the repair agents get no description of what was changed. They see only the run state, failing check IDs, and saved evidence from the checks. Use a neutral commit message (for example "update"). Do not mention the injection in any file under `artifacts/` or in prompts.
4. Sealed record: the injector writes what was changed, where, and which check should catch it into a note kept outside the repo and outside the agent's reach. Store its SHA-256 in the manifest before the run, and reveal the note only after the repair is accepted. This lets you prove the loop did not get hints.
5. Start a new run ID from the injected revision. Do not hand-edit state to help it.
6. Budget: [5] attempts per regression. Record tokens or cost where available, wall time, and any manual intervention.
7. Acceptance of a repair: the full gate suite passes (not only the check that failed), on a new source digest that differs from the injected revision, with B2 still passing and each fix traceable from finding to repair task to verification.
8. Record the stopping decision for each regression: repaired, budget exhausted, or blocked, with the reason.

### Candidate regressions (pick at least two, keep the rest in reserve)

| ID | Injected fault | Expected detector | Notes |
|---|---|---|---|
| X1 | Swap red and blue channels in the framebuffer conversion | R3 | Visible and deterministic. A good first one. |
| X2 | Remove the keyup handler so keys stick | I1 | Needs the held-key and release assertions to be sharp. |
| X3 | Make `DG_SleepMs` busy-wait, or block the browser loop | T1, possibly R2 | Tests whether the responsiveness check bites. |
| X4 | Change the tick rate (for example halve it) | none expected (T2 is evidence-only) | Deliberate missed-fault test. Record whether anything catches it; likely only the QA agent's observation. |
| X9 | Disable sound output or never resume the audio context | A1, M1 | Tests the audio gates. |
| X10 | Disable music only, leaving sound effects on | M1 | A1 should still pass, which shows the two checks are separate. |
| X11 | Skip flushing saves to browser storage | S1 | Saving looks fine until the page reloads. |
| X12 | Remove the ammo decrement on firing | G1 | The ammo region must stop changing. |
| X5 | Stop packaging the WAD, or break its virtual path | R1 | Fails at boot. Easy to detect. |
| X6 | Remove `preventDefault` on arrow keys or Space | I2 | Easy to miss without a scrollable page. |
| X7 | Break fire handling (fire key mapped to nothing) | G1 | Tests whether the gameplay check asserts specific effects. |
| X8 | Subtle: wrong color only in one palette range, or a small input delay | none expected | Intentional stretch test. Record whether anything caught it. |

### Results table (fill in as you go)

| Regression | Source revision | Detected by (check IDs) | Attempts | Repair revision | Full suite passed | Manual interventions | Stopping decision |
|---|---|---|---|---|---|---|---|
| X? | | | | | | | |
| X? | | | | | | | |

### What to write up
- For each regression: how long detection took, what the agents concluded, whether the finding matched the sealed note, and what the repair changed.
- Any regression the checks missed, and why.
- Any case where an agent "fixed" it by editing a check or the build script instead of the port. That counts as a failure of the loop even if the suite then passes, and B2 plus the clean-copy run should catch it.

## Evidence-only (agent-observed, non-gating)
- QA agent screenshots and action log for menu, level start, movement, turning, firing, and doors.
- G2: the QA agent's enemy-kill attempt (before/after screenshots, action log).
- T2: simulation rate observation, if available.
- Door opening: G1's attempt saves before/after screenshots only.
- Reviewer findings from correctness and integration reviews.
- A visual "looks like original DOOM" impression. There is no numeric threshold for this, and R3 is the only scripted proxy.

## What these checks cannot establish
- That play feels right (latency, input feel, pacing).
- That every level, enemy, and weapon behaves like the original.
- Audio correctness: A1 shows sound effects are output, not that the right sounds play at the right times. M1 shows something audible plays continuously, not that it is the right music.
- Saves: S1 checks one browser profile across a page reload, not other browsers, devices, or cleared site data.
- Gameplay depth: G1 does not check doors, enemy behavior, or progress past the first room.
- Enemy behavior and level progression (G2 is evidence-only).
- Correct game speed (T2 is evidence-only).
- Behavior in other browsers or on other hardware.
- That the checks catch faults nobody thought to inject.

## Freeze procedure
1. Read every check and run the suite against a deliberately broken build for each fault listed above.
2. Commit this file and `tests/accept/` yourself.
3. Tag the commit (`git tag acceptance-v1`) and record the tag and commit ID below.
4. Run verification from a clean copy of the tagged checks, not from the working folder.
5. Re-verify the tag yourself, outside any agent session, before accepting a PASS.

Baseline tag: _____  Commit: _____  Date: _____

## Change log (criteria changes only, with reason)

| Date | Check ID | Change | Reason |
|---|---|---|---|
| 2026-11-02 | R1, R2 | Checks now perform the start gesture (click a Start/Play control, else the canvas) before sampling; R2 window changed from 3 s to 12 s. Moved the acceptance-v1 tag to the commit containing the fixed checks. | Run attempt 004 found the port gates the game behind a Start click (needed for browser audio), and the original checks sampled the unstarted canvas. The Doom title screen is also static for about 5 s. The agents did not edit the protected check; they reported the mismatch. This is a defect in my check, not in the port. |
| 2026-11-02 | I1, I2, A1 | Implemented in browser.spec.js. I1 uses holding Left (turning) instead of Up, and blur-release is informational only. A1 compares trigger-window level to baseline at 1.5x plus an absolute floor, instead of 10x. | Needed concrete, testable definitions. Turning cannot be blocked by a wall; music may be audible in the baseline. |
| 2026-11-02 | R3, G1, M1, S1 | Implemented R3 and G1. Added M1 (music, gated) and S1 (saved games persist across reload, gated). G1 no longer gates door opening (screenshots only). A1 also passes if the trigger peak exceeds the baseline by 0.01 absolute. | The student asked for these to be in scope and tested. A door route cannot be verified without a real run. With music playing, the 1.5x ratio alone could false-fail A1. |
| 2026-11-02 | B3, I2 | B3 is evaluated after the start gesture. I2 reports per key and gates only on arrows and Space; PageDown is informational. Moved the acceptance-v1 tag again. | First full manual run: the port loads its wasm after Start is clicked, so B3 looked too early. I2 included PageDown, which the criteria never required; per-key reporting keeps real arrow/Space scroll bugs visible. |
