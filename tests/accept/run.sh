#!/usr/bin/env bash
# Acceptance gate. Run from anywhere inside the repo:
#   bash tests/accept/run.sh [evidence-dir]
# Exit 0 only if every implemented gate check passed. results.json says whether the
# gate is "complete" (all checks in CRITERIA.md implemented). Missing checks are listed,
# never counted as passed.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1

BASELINE="${BASELINE:-acceptance-v1}"
IMAGE="${IMAGE:-doom-capstone-toolchain}"
OUT="${1:-artifacts/accept-latest}"
mkdir -p "$OUT"
TSV="$OUT/checks.tsv"
: > "$TSV"

record() { printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$TSV"; }

EXCL=(':!artifacts' ':!build' ':!dist')
REV=$(git rev-parse HEAD)
DIRTY=$(git status --porcelain -- . "${EXCL[@]}" | wc -l | tr -d ' ')
DIGEST=$(git ls-files -co --exclude-standard -- . "${EXCL[@]}" | LC_ALL=C sort \
  | xargs shasum -a 256 2>/dev/null | shasum -a 256 | cut -d' ' -f1)

# ---- B1 clean build ----
if [ ! -f build.sh ]; then
  record B1 fail "build.sh does not exist"
else
  bash ./build.sh > "$OUT/B1_build.log" 2>&1
  rc=$?
  if [ $rc -ne 0 ]; then
    record B1 fail "build.sh exit $rc (see B1_build.log)"
  elif [ ! -f dist/index.html ] || ! ls dist/*.wasm >/dev/null 2>&1; then
    record B1 fail "build exited 0 but dist/index.html or a .wasm file is missing"
  else
    record B1 pass "build.sh exit 0; dist/index.html and .wasm present"
  fi
fi
( cd dist 2>/dev/null && find . -type f | LC_ALL=C sort | xargs shasum -a 256 ) > "$OUT/dist_inventory.txt" 2>/dev/null

# ---- B2 protected inputs unchanged ----
if ! git rev-parse -q --verify "refs/tags/$BASELINE" >/dev/null; then
  record B2 fail "baseline tag $BASELINE not found; commit and tag the checks first"
else
  D1=$(git diff "$BASELINE" -- loop assets third_party tests/accept | wc -l | tr -d ' ')
  D2=$(git status --porcelain -- loop assets third_party tests/accept | wc -l | tr -d ' ')
  git diff "$BASELINE" -- loop assets third_party tests/accept > "$OUT/B2_protected.diff" 2>&1
  if [ "$D1" = "0" ] && [ "$D2" = "0" ]; then
    record B2 pass "loop, assets, third_party, tests/accept match $BASELINE"
  else
    record B2 fail "protected paths differ from $BASELINE (see B2_protected.diff)"
  fi
fi

# ---- Browser checks (B3 R1 R2 T1), run in the supplied container from a clean copy of the checks ----
BROWSER_JSON="$OUT/browser_results.json"
rm -f "$BROWSER_JSON"
BROWSER_IDS="B3 R1 R2 R3 T1 I1 I2 A1 G1 M1 S1"
if [ ! -f dist/index.html ]; then
  for id in $BROWSER_IDS; do record $id fail "no dist/index.html"; done
elif ! command -v docker >/dev/null || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  for id in $BROWSER_IDS; do record $id fail "docker image $IMAGE not available (docker build -t $IMAGE .)"; done
elif ! git rev-parse -q --verify "refs/tags/$BASELINE" >/dev/null; then
  for id in $BROWSER_IDS; do record $id fail "baseline tag $BASELINE not found; cannot take a clean copy of the checks"; done
else
  TMP=$(mktemp -d)
  git archive "$BASELINE" tests/accept | tar -x -C "$TMP"
  ABS_OUT="$(cd "$OUT" && pwd)"
  docker run --rm --network none \
    -v "$PWD/dist":/site:ro \
    -v "$PWD/assets":/assets:ro \
    -v "$TMP/tests/accept":/checks:ro \
    -v "$ABS_OUT":/evidence \
    "$IMAGE" node /checks/browser.spec.js /site /evidence /assets/doom1.wad > "$OUT/browser_stdout.log" 2>&1
  rm -rf "$TMP"
  if [ ! -f "$BROWSER_JSON" ]; then
    for id in $BROWSER_IDS; do record $id fail "browser run produced no results (see browser_stdout.log)"; done
  fi
fi

# ---- Merge and decide ----
python3 - "$TSV" "$BROWSER_JSON" "$OUT/results.json" "$REV" "$DIRTY" "$DIGEST" "$BASELINE" <<'PY'
import json, sys, os, datetime
tsv, bjson, outp, rev, dirty, digest, baseline = sys.argv[1:8]
checks = []
for line in open(tsv):
    parts = line.rstrip("\n").split("\t")
    if len(parts) == 3:
        checks.append({"id": parts[0], "status": parts[1], "detail": parts[2]})
if os.path.exists(bjson):
    for c in json.load(open(bjson)):
        checks.append(c)
implemented = {c["id"] for c in checks}
planned = ["B1","B2","B3","R1","R2","R3","I1","I2","T1","G1","A1","M1","S1"]
not_impl = [i for i in planned if i not in implemented]
ok = all(c["status"] == "pass" for c in checks)
res = {
    "time_utc": datetime.datetime.utcnow().isoformat() + "Z",
    "source_revision": rev,
    "uncommitted_files": int(dirty),
    "source_digest": digest,
    "baseline_tag": baseline,
    "verdict": "PASS" if ok else "FAIL",
    "complete": ok and not not_impl,
    "not_implemented": not_impl,
    "checks": checks,
}
json.dump(res, open(outp, "w"), indent=2)
for c in checks:
    print(f'{c["status"].upper():5} {c["id"]:3} {c["detail"]}')
print("NOT IMPLEMENTED (not counted as passed):", ", ".join(not_impl) or "none")
print("VERDICT:", res["verdict"], "| complete:", res["complete"], "| rev", rev[:10], "| digest", digest[:12])
sys.exit(0 if ok else 1)
PY
