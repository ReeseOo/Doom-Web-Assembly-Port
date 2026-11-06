# 007 — build/web persistent saves

## Outcome and scope

Implemented real IndexedDB-backed saves using Emscripten IDBFS. No commit made. Changed only `build.sh`, `web/index.html`, new `web/persistence.js`, and optional new `tests/dev/persistence_test.cjs` (plus generated build/dist and this run's evidence). Existing `platform/audio.c` / `platform/audio.h` changes belong to the audio owner and were not edited.

Source HEAD: `b62d60778a48d95ec5a77fe109e69b5b254b6e9b`, dirty working tree including the pre-existing music implementation. Read required repository docs, prior run summaries/build handoffs/current results, and the engine save implementation. Gate 006's S1 loaded screenshot visibly shows EMPTY SLOT after reload; all its other checks passed. Prior evidence remains unchanged.

## Actual paths and implementation

- `m_config.c:GetDefaultConfigDir()` returns `.`. Non-ORIGCODE `M_GetSaveGameDir()` returns `./.savegame/`, **not** upstream `savegame/doom1.wad/` or HOME.
- `p_saveg.c` writes `temp.dsg` there, and names final slots `doomsavN.dsg`. `g_game.c:G_DoSaveGame()` closes the temporary file, removes the old slot, then renames the temporary file to the slot.
- Web startup fixes cwd at `/`, creates/mounts IDBFS at `/.savegame`, and awaits `FS.syncfs(true)` before enabling Start. `noInitialRun` still prevents main before the user's click. Restore failure blocks startup visibly rather than silently overwriting existing data with an empty filesystem.
- Build links `-lidbfs.js`, exports IDBFS alongside existing FS/callMain, and enables `FS_DEBUG` for supported filesystem tracking callbacks. WAD remains preloaded at `/doom1.wad`; strict compiler version and error propagation remain intact.
- Write/close/mkdir/delete/rename callbacks schedule persistence at the next event-loop turn, batching the engine's complete save sequence. Exactly one sync runs at a time; mutations during a sync force a subsequent pass. Failed syncs show an error and retry instead of claiming success.
- The page shows pending/committed storage status and warns on unload with pending writes. No reliance on asynchronous unload flushing. New `persistence.js`, engine JS/data/Wasm paths are relative, so `/doom/` works.
- No engine, runtime, audio, input, protected acceptance, assets, loop, or third-party edits. Engine continues to perform all save serialization and restoration normally.

## Verification and evidence

1. `./build.sh` with Emscripten **4.0.18**: exit 0. Evidence: `logs/007-build-persistence.log` under this run. Outputs include index.html, doom.js, doom.wasm, doom.data, persistence.js. Supplied-engine compiler warnings remain; no compile/link failures were masked. A later build-script-only cleanup also removes stale persistence.js on failed builds; this did not change emitted application code.
2. Development browser diagnostic in existing `doom-capstone-toolchain`, network disabled, read-only dist/devtests mounts: **PASS**, zero page/console errors. Evidence: `logs/007-persistence-test.json` and `.log`.
   - HTTP served only at `/doom/`; all requests stayed under that subpath.
   - Restore completed before Start became ready.
   - Wrote and renamed a save-shaped file, started a transaction, replaced the slot while persistence was in flight, awaited automatic committed status, reloaded, and recovered the latest contents with no temp file.
   - Removed synthetic data, awaited flush, then started the actual engine successfully.
3. `bash -n build.sh`, JS syntax checks for both new files, and `git diff --check`: PASS.

Reproduction (from repo root):

```sh
docker run --rm --network none \
  -v "$PWD/dist":/site:ro -v "$PWD/tests/dev":/devtests:ro \
  -v "$PWD/artifacts/runs/20261103T051033Z-audio-c5ca21/logs":/evidence \
  doom-capstone-toolchain node /devtests/persistence_test.cjs /site /evidence/007-persistence-test.json
```

Owned source SHA256 at handoff:

```
0987cb60a14ff4b9316878bf1821e467f5f05d1c2eafc65a9804af07a70f4dfb  build.sh
db78f5bcdd3a7708885013022f6f3d9e4f138144ead1d612fa2ad578b21f7bec  web/index.html
0c4701d1256ccf1b17a619ed89210cc1ab2e865d5c55311c2d0723f512a8c2cd  web/persistence.js
5f9c712d658efebec82d0ea2345f68673601f9b2010415e8baeb1d4f8ea2a231  tests/dev/persistence_test.cjs
```

## Limits / next action

Coordinator must rebuild/run gate 007, specifically S1's real gameplay save/reload view comparison and audio/gameplay regressions. The development test is filesystem/startup evidence, **not** a claim that protected S1 or the full gate passed. No acceptance attempt consumed here. Saves are per browser/site origin; clearing site data removes them. Sudden process termination before IndexedDB commit cannot be guaranteed; the pending indicator and unload warning make that boundary explicit. Cross-tab conflict resolution and config persistence are outside this bounded save milestone.

Stopped after implementation, one successful full build and one successful bounded browser diagnostic. Resource/token usage not available. No known owned blocker remains; full acceptance belongs to coordinator.
