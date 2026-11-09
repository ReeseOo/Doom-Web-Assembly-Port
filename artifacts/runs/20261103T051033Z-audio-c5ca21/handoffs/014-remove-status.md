# 014 — remove redundant ready/running status instructions

## Scope and changes
- Source revision: `fb509763dc01bc6af19ac66aadd44fb1d65757ca` (initial working tree clean).
- Only implementation file changed: `web/index.html`; no commit made.
- Cleared the ready status text, including the specifically requested “Ready. Click Start Doom, then follow the instructions above the game.”
- Cleared the redundant running instructional status text.
- Added `#status:empty { display: none; }` so empty ready/running status does not leave a reserved blank row. The status element remains in the DOM with its live-region attributes and dataset.
- Preserved loading text, error feedback, `loading` → `ready` → `running` and `error` state behavior, disabled-button handling, synthetic/repeated-click start guard, and adjacent compact startup instructions.
- No build-script, asset-reference, platform, protected-path, test-file, or generated-output changes.

## Verification
- Inline Node VM diagnostic against the actual page script: PASS. Verified loading rejects start; runtime initialization/restoration reaches ready with empty text and enables Start; first start reaches running with empty text and calls main once; repeated start is ignored; failure displays error feedback and disables Start; early failure prevents initialization from enabling Start.
- Static assertions in the same diagnostic: PASS for empty-status CSS, removal of both redundant strings, and retention of the adjacent any-key startup guidance.
- `git diff --check`: PASS.
- No browser rendering test or full Emscripten build performed for this bounded HTML-only fix. Existing build/toolchain and relative paths are unchanged; these checks do not establish compiled-runtime or visual-layout success.

## Handoff
Task complete; no known unresolved implementation issue. Root should rebuild with Emscripten 4.0.18 before publishing so `dist/index.html` incorporates the source change, and may run browser/acceptance checks. No server or process left running. This report is the only additional file written. Token/cost usage unavailable.
