# 007 Integration review — rev 29abdf01c4df9e66673eb234f979797a46a60f2b

Verdict: **PASS** (with findings; none blocking)

## Evidence I produced (independent)
- HEAD = 29abdf0; tracked tree clean (only untracked artifacts/evals/.playwright-mcp).
- emcc 4.0.18 verified; `bash build.sh` exit 0 (twice). Only warning: supplied r_segs.c abs().
- `bash tests/accept/run.sh /tmp/rev007/accept` (Docker): exit 0, all 13 checks PASS (B1 B2 R1 B3 R2 R3 T1 I1 I2 A1 G1 M1 S1), complete=True, rev 29abdf01c4, digest 59858a883d37. Logs: /tmp/rev007/gate.log.
- Not run: tests/dev/*.cjs (host has no playwright module; gate runs them in container).

## Findings
1. (Medium, evidence provenance) Authoritative `tests/007/results.json` records `source_revision: b62d607…` with `uncommitted_files: 9`, i.e. the gate ran on the pre-commit working tree, not 29abdf0. Digest (59858a88…) equals my HEAD re-run digest, so content matches, but the file itself does not name the tested revision. `tests/final-committed/` is an older run. Action: cite my re-run or re-run the gate on committed HEAD and store it.
2. (Low, reproducibility) dist/doom.js is not byte-reproducible: two builds differ in 48 bytes of one line (likely emitted package id/hash); doom.wasm, doom.data, index.html, persistence.js hashes match the gate inventory. Gate inventory doom.js hash differs from mine. Action: don't use whole-dist hashes as reproducibility evidence; compare wasm/data.
3. (Low, build) build.sh `-g2`, `-sASSERTIONS=1`, `-sFS_DEBUG=1` ship in the deliverable. FS_DEBUG is deliberately required by persistence.js (trackingDelegate), so persistence depends on a debug flag; add a comment/test guarding it. No rm of stale doom.data side files other than listed ones is needed.
4. (Low, saves lifecycle) persistence.js: sync failure retries forever every 1 s with no cap; beforeunload only warns (cannot guarantee flush); restore failure stops startup (good, protects saves). Saves live under IDBFS at /.savegame keyed to origin, so the `/doom/` subpath and other apps on the same origin share the DB name. S1 verifies one-profile reload only (documented in CRITERIA).
5. (Info, assets) All references relative (`persistence.js`, `doom.js`, data via locateFile default); gate B3 loads from `/doom/` subpath successfully. PASS.
6. (Info, scope/tests) Changes limited to build.sh, platform/, web/, tests/dev; protected paths match acceptance-v1 (B2). Dev tests persistence_test/music_test are diagnostics only, not gating; S1 and M1 are gated and S1 has a fresh-vs-saved discrimination. Not shown: that a broken persistence.js makes S1 fail (check for a recorded fault-injection run).
