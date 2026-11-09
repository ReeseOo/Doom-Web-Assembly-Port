
## Resume 20261104T064207Z — B2 / protected baseline prerequisite

Evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/resumes/20261104T064207Z/tests/B2_protected.diff`, `artifacts/runs/20261103T051033Z-audio-c5ca21/resumes/20261104T064207Z/tests/results.json`.

B2 fails because student-owned loop/agents.yaml, tests/accept/CRITERIA.md, and tests/accept/browser.spec.js differ from acceptance-v1. All 12 other implemented checks pass. Updating or reverting protected paths, committing student changes, or moving the baseline tag is outside agent authority. The gate executes the tagged checks, not the newly edited working-tree checks; current controls contract is therefore not certified.

## Attempt 013: B2 protected configuration prerequisite

- Check: B2. Evidence: `tests/013/B2_protected.diff`, `tests/013/results.json`, `logs/013-gate.log` under this run.
- The only failing check is a pre-existing student change to `loop/agents.yaml`: attempt limit 12 -> 20. Recorded before coding in the resume source-status evidence. All other gate checks passed; explicit build exited 0.
- This is not a port-code defect or a claim the integrity check is incorrect. Restoring or accepting this protected configuration requires student action; agents must not edit loop/, reset user changes, change the baseline, or weaken B2. No compliant coder fix exists for the remaining failure.
- UI change is retained in web/index.html and build output. No milestone commit or review/QA claims: the full gate did not exit 0.
