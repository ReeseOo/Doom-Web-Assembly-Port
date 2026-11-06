# 008 — nonblocking music synthesis and browser timing evidence

## Result

Implemented the correctness-blocker repair in **platform/audio.c and platform/audio.h only**, plus developer tests under tests/dev. No commit made. No protected paths or other owner's implementation files edited.

Tested source base HEAD: `29abdf01c4df9e66673eb234f979797a46a60f2b`, with uncommitted owned-file changes. Exact owned source SHA256s and tracked patch: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/008/source-sha256.txt` and `source.patch`. New test is separately hashed. Existing unrelated/untracked artifacts were left alone. Required READMEs and previous handoffs/evidence (including 006 and 007) reviewed.

## Implementation / handoff to coder_build and coder_runtime

- `platform/audio.c`: `MusicInstall` now supplies `m.prepare(song)` and `m.cancel()`. `m.kick()` no longer calls `m.render(song)` on the browser main thread. It launches an embedded **Blob Web Worker** containing the closure-free renderer; the entire sample loop and PCM allocation run there. Worker returns the Float32Array with an ArrayBuffer transfer list (no PCM serialization copy).
- Main thread only copies received PCM into a WebAudio AudioBuffer, then starts the original source/gain/audio-clock playback. This copy was included in measured gaps, including the 272-second E1M3 score. Original rendering algorithm, voices/controllers, looping and audio graph are preserved.
- One active job, no synthesis queue. `m.halt()` calls `m.cancel()`, which clears the job reference, terminates the worker, and revokes its Blob URL. Stop, replacement, pause, and current-song unregister already route through halt. Resume starts a fresh job if needed. Completion checks job identity and current-song identity, preventing cancelled/stale completions from starting or caching another song. Success/error paths terminate workers/revoke URLs too. Failures warn and mark the score failed, avoiding repeated worker retry leaks; SFX stay available.
- Registration owns decoded event objects copied from WAD bytes, never retained WASM views. Worker receives its own structured event copy. Returned PCM storage is transferred, copied to AudioBuffer, then temporary references become collectible. Unregister deletes registered score/buffer ownership. No extra persistent PCM cache or new asset files.
- `platform/audio.h`: documents worker/CSP requirement. **Build owner:** no build changes, exports, dependencies, worker file deployment, or flags needed. Host CSP must permit `worker-src blob:`. There is deliberately no synchronous-render fallback if worker creation fails.
- **Runtime owner:** `DG_AudioInit(void)` and `DG_AudioResume(void)` remain unchanged. Existing synchronous capture-phase key/pointer/click handlers still create/resume the shared AudioContext. No await is inserted before context resume. `DG_music_module` remains engine integration; no runtime edits needed.

## Real browser evidence

Evidence directory: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/008/`.

`tests/dev/music_worker_browser.cjs` loads actual rebuilt WASM in headless Chromium in `doom-capstone-toolchain`, with network disabled. It starts measurement before the first unlocking key (no earlier canvas click), navigates New Game using real Enter events, then types actual engine cheat `idclev13` to load cold E1M3. Each phase records continuous rAF and 10-ms event-loop timer gaps and dispatches trusted Shift key probes until music plays (minimum two seconds). CDP send-to-key-completion round trip includes transport overhead. All probes also have a capture listener delivery count.

| Phase | Score duration | Max rAF gap | Max event-loop gap | Max input round trip | Delivered/sent |
|---|---:|---:|---:|---:|---:|
| First activation | 6.857 s | 16.8 ms | 29.7 ms | 3 ms | 52/52 |
| New Game, cold E1M1 | 96 s | 16.8 ms | 26.5 ms | 4 ms | 52/52 |
| Cold long E1M3 transition | 272 s | 16.8 ms | 27.7 ms | 4 ms | 53/53 |

All phases **PASS <=250 ms**. Context running, actual music source present, buffer duration matched selected score, no pending job at completion, no page errors. Also passed replacement cancellation, synthetic stale-worker-message rejection, pause cancellation/resume restart, stop cleanup. Raw results: `worker-browser.json`, `worker-browser.log`.

Reproduction (from repository root):

```sh
./build.sh
docker run --rm --network none \
  -v "$PWD/dist":/site:ro -v "$PWD/tests/dev":/devtests:ro \
  -v "$PWD/artifacts/runs/20261103T051033Z-audio-c5ca21/tests/008":/evidence \
  doom-capstone-toolchain node /devtests/music_worker_browser.cjs
```

## Regression results and limits

- Build PASS with Emscripten 4.0.18: `build.log`.
- `node tests/dev/audio_test.cjs`: PASS, 55 real SFX samples, graph/gesture/lifecycle (`audio-unit.log`).
- `node tests/dev/music_test.cjs`: PASS, all 13 scores finite/non-silent plus async first-gesture lifecycle; updated mock worker to run asynchronously. Rendering time printed here is Node VM unit-test time, **not** browser main-thread time (`music-unit.log`).
- Real existing `tests/accept/browser.spec.js` run against rebuilt dist in supplied container: **A1 PASS**, running context; firing RMS peak baseline .0414 -> .0879; menu .0363 -> .0850. **M1 PASS**, 100% audible samples, peak .0344 while idle. Raw `A1_audio_levels.json`, `M1_levels.json`, `browser_results.json`, `browser_stdout.log`.
- Other browser checks R1/B3/R2/R3/T1/I1/I2/S1 passed. **G1 failed with screenshot clipped-area harness error**. This is not an overall acceptance-pass claim; no out-of-scope harness repair attempted.
- `git diff --check` PASS; `git diff -- loop assets third_party tests/accept` empty.

Timing evidence is one real Chromium/container run, not a universal hardware guarantee. Buffer allocation/copy and event decoding remain on main thread but measured well below target for the supplied long score. Music is silent while a cold score is being synthesized; gameplay, input, and sound effects continue. No streaming or immediate cold-song-start guarantee claimed. Worker denial/CSP failure leaves music unavailable with warning, not a blocking fallback. Input probes establish browser dispatch responsiveness, not per-tic engine-state latency.

Stop reason: scoped implementation, rebuilt browser timing, A1/M1 regression evidence, and handoff complete. Next action: reviewer inspect cancellation/ownership and coordinator decide whether to rerun broader G1 independently. No pending audio blocker observed.
