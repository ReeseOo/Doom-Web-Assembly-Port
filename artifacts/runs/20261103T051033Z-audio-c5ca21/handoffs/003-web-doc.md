# 003 web help — documentation-only polish

## Result

Updated only the help paragraph in `web/index.html` to read:

> Keyboard play. WAD sound effects are enabled and unlock after a keypress or click. Music and persistent saves are not implemented.

This resolves the web-help finding in `artifacts/runs/20261103T051033Z-audio-c5ca21/reviews/correctness-002.md`. No behavior, scripts, styles, asset paths, build settings, or tests changed. `platform/README.md` remains untouched because it is outside this task's ownership; its stale sound statement is not resolved here. Protected directories and prior evidence were not modified.

## Verification

Source revision: `1734e8057d05ceb522021c1d49db3af99f923414`, plus this one-paragraph web edit. Existing untracked artifacts and other workspace files were left untouched.

- `git diff --check`: PASS.
- `git diff -- web/index.html`: exactly one help-paragraph replacement.
- Inline Python comparison against `git show HEAD:web/index.html`: PASS; asserted the entire current file equals the original with only that exact paragraph replaced. Scripts, styles, asset paths and markup structure are unchanged.

No compiler, build, browser, or acceptance run was performed: this bounded task changes documentation only. Prior passing gates are prior evidence, not newly rerun results.

## Handoff / stop

Task complete; no further implementation needed for the web-help finding. Coordinator may review the single-line diff and incorporate it. Any platform README correction requires its owner. Stopped after one text edit and static verification; no tests added and no acceptance attempt consumed.
