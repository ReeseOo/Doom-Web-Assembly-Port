# 010 video/input repair result

## Scope and source
- Source HEAD: `10d8e70ac214f69c12a506e26ac7fd9777c94714`; changes are uncommitted. No commit made.
- Production files edited: **only** `platform/video_input.c` and `platform/video_input.h`.
- Added development tests under `tests/dev/controls_contract_test.py` and `tests/dev/controls_contract_test.cjs`.
- Read repository instructions, root/loop/artifacts/platform READMEs, protected controls criteria, task handoff, and actual gate evidence at `artifacts/runs/20261103T051033Z-audio-c5ca21/resumes/20261104T065026Z/tests/results.json`.
- No protected files, engine, assets, loop, build scripts, or web files changed.

## Findings
The failing gate reports Space firing without an audio rise (A1) and without ammo change (G1). `platform/video_input.c` still mapped browser Space to `KEY_USE` (0xa2), and Ctrl to `KEY_FIRE` (0xa3). This directly conflicts with Space-as-fire. The supplied engine's `i_input.c::TranslateKey` returns key identities unchanged. `m_controls.c` exposes writable action bindings; its supplied defaults are arrow movement and dedicated action codes. W/S/A/D/E were arriving as ordinary letters, but this adapter did not set their gameplay bindings.

Startup order matters: `doomgeneric_Create` calls DG_Init **before** D_DoomMain; the latter calls M_LoadDefaults, which may overwrite control globals with an older persistent config. Applying bindings only in DG_Init would not reliably migrate existing browser profiles.

## Changes
- Browser layer now emits literal ASCII Space (32), not an action code. Letters and digits remain plain characters. Ctrl emits the actual Doom Ctrl identity (0x9d); optional Ctrl-as-secondary-fire is not retained.
- Added a C `bind_controls` helper setting engine-owned `key_up='w'`, `key_down='s'`, `key_strafeleft='a'`, `key_straferight='d'`, `key_fire=' '`, `key_use='e'`, Left/Right arrow turn, and Shift run.
- Invoke helper at DG_Init and before DG_GetKey consumption, so loaded legacy config cannot undo the contract. Menu identities and weapon digits are untouched.
- Updated owned header control documentation.
- Existing framebuffer conversion (0x00RRGGBB -> opaque RGBA), title handling, held-key tracking, down/up delivery, repeat suppression, blur/visibility release and scroll prevention are unchanged.

## Validation
Command: `python3 tests/dev/controls_contract_test.py` (exit 0).
Output:
```
PASS: 30 real engine input/action checkpoints
PASS: plain letters/Space, menu identities, Shift/digits, repeat/hold, blur/hidden releases, scroll prevention
```
Evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/handoffs/010-video-input-validation.txt`.
`git diff --check` also passed.

The development harness extracts current EM_JS functions and current C binding helper, compiles read-only real engine units (`i_input`, `d_event`, `g_game`, `m_controls`, `doomstat`) with host clang, and feeds browser events through I_GetEvent -> G_Responder -> G_BuildTiccmd. It verifies Space attack, E use, W/S movement, A/D strafe, arrow turning, repeated/held state, releases, focus-loss cleanup, and raw menu/letter/Shift/digit identities. It is **not** a browser acceptance run, audio test, ammo test, or complete save-menu test. Real gates remain the orchestrator's next action.

## Remaining handoff actions
1. Rebuild and run the real acceptance suite, especially A1/G1/S1 and existing input checks. No full-gate PASS claimed here.
2. `web/index.html:37` still advertises the old arrows/Ctrl/Space controls. It needs W/S forward/back, A/D strafe, Left/Right turn, Space fire, E use, Shift run, digits weapons, and Up/Down/Enter/Escape menu guidance. This is outside this task's ownership, so left untouched for the orchestrator/web owner.
3. The older `tests/dev/video_input_test.cjs` and its harness encode the old Ctrl/Space contract. They were not altered or used to claim current success; the new controls-contract test supersedes those action expectations for this repair.

Stopping reason: bounded repair and focused validation complete; awaiting orchestrator-owned browser gates. No server or background process started.
