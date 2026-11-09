# Attempt 013 — compact any-key instructions

## Scope and source
- Base revision: `88fd8508e4eedacb05209e4bbedd5b8b4b804ce3`.
- Only implementation file changed: `web/index.html`. No commit made.
- Read required repository docs and prior run summaries / attempt 012 handoff and integration review.
- Preserved pre-existing dirty `loop/agents.yaml`, `artifacts/state.json`, and untracked resume artifacts. No C, behavioral, build-script, test, protected-directory, or generated-output edits.

## Exact change summary
- Moved the existing accessible instruction aside above the Start Doom and Fullscreen buttons; kept its IDs and the canvas's `aria-describedby` references.
- Replaced the oversized yellow banner (thick border, background, padding, large bold type) with compact .875rem text, modest spacing, and yellow key labels. Removed redundant mobile banner overrides; canvas sizing is unchanged.
- Main instruction now reads: “Click Start Doom, then click the game to focus. The title/demo is normal: press any key to open the menu.”
- Follow-up reads: “Use Up/Down to navigate and Enter to select: New Game → Knee-Deep in the Dead → skill. Only the first episode is available in shareware.”
- Running status now reads: “Running Doom. Click the game to focus, then press any key for the title/demo menu. Use Up/Down to navigate and Enter to select New Game.”
- Controls retain Enter for selection and now explicitly label Escape as “menu/back during gameplay.”
- All script logic, relative asset references, and build configuration are unchanged.

## Verification
- `git diff --check`: PASS (exit 0).
- Inline Python static assertions: PASS (exit 0), confirming instructions precede Start Doom, both title/demo instructions use any key, exact episode/skill route and shareware restriction exist, Escape/Enter guidance remains, and oversized banner declarations are gone.
- Compared inline script blocks to `HEAD:web/index.html` after normalizing only the running-status string: identical. Compared all src/href references to HEAD: identical.
- Reviewed `git diff -- web/index.html` and `git status --short`; no unrelated implementation edits introduced.
- No persistent tests added. No build, browser rendering check, or acceptance gate run: orchestrator owns the real Emscripten 4.0.18 build and gate for this bounded copy milestone. Static checks do not establish visual layout or runtime success.

## Handoff
Task complete; stopped at requested copy/presentation boundary. Next: orchestrator runs real build and gate, optionally inspects the compact instructions above Start Doom in browser. No known unresolved copy findings. Token/cost usage unavailable.
