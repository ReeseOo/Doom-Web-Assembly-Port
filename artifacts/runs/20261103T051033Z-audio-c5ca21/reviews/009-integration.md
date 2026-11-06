# 009 final integration re-review — PASS

Commit reviewed: f0937a2c16f589adc9948e6c5888c5aee85b0c83 (tracked tree clean; no code edits made).

## Source equivalence
- Authoritative `tests/009/results.json` was taken at rev 29abdf0 + 8 dirty files, digest `fd600b6f…989`, PASS/complete, all 13 checks.
- 29abdf0..f0937a2 changes: platform/audio.c/.h, web/index.html, tests/dev/{music_test,music_worker_browser,viewport_test}.cjs.
- Committed gate re-run: `bash tests/accept/run.sh artifacts/runs/20261103T051033Z-audio-c5ca21/tests/009-committed` → exit 0, rev f0937a2, **identical source_digest fd600b6f9f63…2468e989**, VERDICT PASS, complete True (B1 B2 R1 B3 R2 R3 T1 I1 I2 A1 G1 M1 S1 all pass; B2 protected paths match acceptance-v1). Log: `logs/009-committed-gate.log`.
- Note: committed run reports uncommitted_files 2 (untracked evals/ etc. outside the gate-relevant diff), digest still equal, so the evaluated sources are byte-identical to the authoritative evidence.

## Review of changes
- audio.c: MUS synthesis moved to an embedded Blob worker; single job, cancelled on halt/replace/stop/unregister; stale completion ignored (`m.current !== song`); failures mark song failed and warn, no crash. No new build dependencies. Requires CSP worker-src blob: (documented in audio.h; page has no CSP).
- index.html: canvas sized by viewport height budget with 8:5 aspect, svh fallback, fullscreen rule; focus uses preventScroll + scrollIntoView after status update. Start-gating unchanged.
- Build: Emscripten build exits 0, outputs dist/index.html, doom.js/.wasm/.data (one pre-existing third_party warning).

## Dev tests (against rebuilt dist, docker, --network none; outputs in tests/009-committed/dev/)
- music_test.cjs: PASS (13 MUS scores, lifecycle).
- audio_test.cjs: PASS (55 DS lumps, channel lifecycle).
- music_worker_browser.cjs: pass=true (worker lifecycle, real WASM in Chromium).
- viewport_test.cjs: status pass (geometry, no scroll on game keys, PageDown scrolls short page).

## Caveats
- Music synthesis is not OPL-accurate (documented). S1 passed here; earlier-noted startup timing flakiness was not observed in the authoritative or committed run (single run each).

Verdict: **PASS**
