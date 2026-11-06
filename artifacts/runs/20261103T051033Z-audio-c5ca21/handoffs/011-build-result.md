# 011 — UI controls consistency result

## Scope and revision
- Source HEAD: `4f121835de161f6bd1c189513beb9d775500f21c` (input fix committed).
- Only production edit: `web/index.html:37`, one user-facing help paragraph. No commit made.
- No engine, platform, build script, protected checks, assets, third_party, or loop files changed. Existing unrelated untracked files were left untouched.

## Change
Replaced obsolete arrows-move/Ctrl-fire/Space-use instructions with the implemented contract:
- W/S: forward/back; A/D: strafe; Left/Right arrows: turn.
- Space: fire; E: use; Shift: run; 1–7: weapons.
- Escape: menu; Enter: select; Up/Down arrows: menu navigation.

No executable behavior, asset paths, layout rules, or build configuration changed.

## Validation and evidence
- `git diff --check`: PASS.
- Inline Python assertion check: PASS, all ten control descriptions present and obsolete `Ctrl: fire`, `Space: use`, and `Arrows: move/turn` descriptions absent.
- `git diff --stat`: only `web/index.html`, one insertion/one deletion (before this report).
- Read actual prior gate: `artifacts/runs/20261103T051033Z-audio-c5ca21/tests/010/results.json`: complete PASS for B1/B2/R1/B3/R2/R3/T1/I1/I2/A1/G1/M1/S1. That evidence records revision `10d8e70ac214f69c12a506e26ac7fd9777c94714` plus uncommitted files; it is prior evidence, not a fresh test of this documentation edit.
- No new build/browser acceptance run performed for this text-only task. Existing build script remains unchanged, including Emscripten 4.0.18 enforcement, fail-fast compile/link handling, WAD preloading, and relative browser asset references.

## Handoff
Bounded task complete; no unresolved controls-copy findings. Next action: root may review the one-line diff and rebuild to propagate updated copy to generated `dist/index.html` before publishing. No server/background process started; no tests added; no commit created.
