
## Resume 20261104T064207Z — B2 / protected baseline prerequisite

Evidence: `artifacts/runs/20261103T051033Z-audio-c5ca21/resumes/20261104T064207Z/tests/B2_protected.diff`, `artifacts/runs/20261103T051033Z-audio-c5ca21/resumes/20261104T064207Z/tests/results.json`.

B2 fails because student-owned loop/agents.yaml, tests/accept/CRITERIA.md, and tests/accept/browser.spec.js differ from acceptance-v1. All 12 other implemented checks pass. Updating or reverting protected paths, committing student changes, or moving the baseline tag is outside agent authority. The gate executes the tagged checks, not the newly edited working-tree checks; current controls contract is therefore not certified.
