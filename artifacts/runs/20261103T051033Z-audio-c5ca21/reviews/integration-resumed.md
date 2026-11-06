# Integration / test-quality review (resumed, independent)

Revision reviewed: b75fd6d8578ad3c9a5a9765d088057464f4acd90 (HEAD confirmed)
Evidence: artifacts/runs/20261103T051033Z-audio-c5ca21/tests/final-committed/
Method: read-only static review of build.sh, web/index.html, platform/*.c, tests/accept/CRITERIA.md and the saved gate output. I did not rebuild or rerun the gate.

## Verdict: PASS (with non-blocking findings)

The gate results.json reports B1, B2, R1, B3, R2, T1, I1, I2 and A1 all pass, and the source revision matches HEAD. R3 and G1 are listed as not_implemented, with "complete": false, and are not counted as failures. B2_protected.diff is empty (0 bytes).

## What checked out
- build.sh pins Emscripten 4.0.18 and checks the WAD exists. It removes stale dist outputs before compiling, so a failed build cannot leave a usable-looking dist. It compiles only supplied engine sources plus platform/*.c, and it does not edit third_party. The SDL_mixer.h shim is generated under build/ (not in a protected directory).
- Packaging: the WAD is preloaded at /doom1.wad and matches the `-iwad /doom1.wad` argument. dist/ holds index.html, doom.js, doom.wasm and doom.data. All asset paths are relative (B3 passed from the /doom/ subpath with application/wasm).
- Browser lifecycle (web/index.html):
  - The Start button is gated on onRuntimeInitialized and a state guard, so a repeated click cannot call main twice. main() also has a `started` guard.
  - The start click is a user gesture, and the audio context resumes on capture-phase keydown, pointerdown and click.
  - Failures surface through onAbort, window error, unhandledrejection and script onerror.
  - argv is copied to heap storage that outlives the Asyncify suspension, which is correct.
- Input: keys are released on keyup, canvas blur, window blur and visibilitychange. preventDefault is applied, and I2 confirms no scroll.
- Audio: the context is created lazily on a gesture. PlaySample returns -1 when the context is not running. The music module supplies every callback.

## Findings (all non-blocking)
1. Stale comment: platform/doomgeneric_runtime.c line 2 says "Sound is disabled for this MVP", but the build now defines FEATURE_SOUND. Fix the comment (platform/ is editable).
2. A1 is a weak test. It shows only that peak RMS rises above a zero baseline after fire and after a menu action. It does not check that the right sample played, that panning and volume are correct, or that there are no clicks. It also does not test the autoplay-blocked path (no gesture, so the context stays suspended and no sound plays). Treat it as "audio is produced", not "audio is correct". Music is not implemented, which the page states.
3. The status "running" only means callMain was requested, as the code comment admits. The real signal is R1/R2/T1. T1 measures a 60 fps rAF cadence, not the engine's 35 Hz tick rate (T2 is evidence-only by design), so a wrong game speed would not be caught.
4. The build log has one third-party warning (r_segs.c:399, -Wabsolute-value). It is benign and in a protected file. The build uses -O2 -g2 with ASSERTIONS=1, which is fine for a demo but makes dist larger and slower than a release build.
5. The checks.tsv in the evidence folder lists only B1 and B2. The full list is in results.json and browser_results.json, so use those. results.json shows "uncommitted_files": 2 (untracked artifacts/evals only, with no tracked-file changes), but the folder is named "final-committed". Source identity relies on source_revision and source_digest, which are recorded.
6. Remaining test gaps: R3 (colour correctness) and G1 (gameplay, such as ammo and doors) are not implemented. Nothing gates in-game rendering or save/load. Fault-injection results for the listed X-cases were not part of this evidence, so I could not confirm that each check fails on a broken build.

## Next action
No blocker. Optionally fix finding 1 and implement R3/G1 before claiming completeness.
