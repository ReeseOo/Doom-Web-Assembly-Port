# 011 Integration review (independent) — HEAD 8648028

**Verdict: PASS (with provenance limitations)**

## Evidence checked
- tests/011/gate.log + results.json: 14 checks (B1,B2,R1,B3,R2,R3,T1,I1,I2,A1,G1,M1,S1) PASS, none NOT IMPLEMENTED, verdict PASS.
- dist/ on disk (built 22:59) SHA-256s equal dist_inventory.txt for all 5 files; dist/index.html and persistence.js are byte-identical to web/ (cp in build.sh).
- Protected paths: `git diff acceptance-v1 HEAD -- loop assets third_party tests/accept` is empty; `git status` shows no changes in loop/assets/third_party/tests/accept/platform/web. Matches B2.
- build.sh: pins Emscripten 4.0.18, compiles supplied engine + platform/*.c once, removes stale dist outputs first, copies web files, preloads assets/doom1.wad; no protected files edited (SDL_mixer shim is generated in build/).
- Packaging: dist has index.html, doom.js/.wasm/.data, persistence.js; wasm served as application/wasm (B3). dist/build are gitignored (not committed, as intended).
- Controls: tests/dev/controls_contract_test.cjs covers Space/E/WASD/arrows/Shift/digits, menu key identities, blur/hidden release, scroll prevention; I2/A1/G1 acceptance exercise the same scheme in a real browser.

## Findings / limitations
1. **Provenance gap (non-blocking):** results.json records source_revision 4f12183 with 6 uncommitted files, not 8648028. The only committed delta 4f12183→8648028 is one line in web/index.html (help text). dist/index.html hash equals current web/index.html, so the gated dist already contains the new help text — evidence reflects the shipped content, but the revision label is stale and "uncommitted" state is not pinned. Recommend re-running the gate on a clean tree at HEAD, or noting this explicitly.
2. Untracked artifacts: tests/dev/controls_contract_test.* , audio_keyboard_test.cjs, artifacts/runs, state.json, evals/, .playwright-mcp/ are uncommitted; evidence is not reproducible from git alone until committed.
3. The help-text change is not asserted by any acceptance check (only dev test); wording correctness is unverified by the gate. I did not re-run build or tests (read-only inspection); results rely on the recorded logs plus hash match.
4. Acceptance relies on the moved tag acceptance-v1 (= 5609322); acceptance-v2 tag points to an unrelated/older tree and is not used — potential confusion.
5. Audio levels (A1 fire 0.041→0.094) and M1 are heuristic thresholds; they prove audibility, not correctness. Build still emits an upstream -Wabsolute-value warning (harmless).

## Blockers
None.
