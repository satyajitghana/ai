#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
R=$ROOT/brand-crew/skills/math-reels/generators
T=${TMPDIR:-/tmp}/math-reels/tmpchk
cd $ROOT
ids=$(python3 -c "import json;print(' '.join(f['id'] for f in json.load(open('$R/group-number-theory-logic-groups.json'))))")
n=0
for id in $ids; do
  out=$(nice -n 19 node brand-crew/skills/math-reels/render.mjs frame $ROOT/data/math-reels/$id.json --t=${TIMES:-6,9.5,10.9,14.2,16.4} --out=$T/$id.png 2>&1)
  n=$((n+1)); echo "$out" | grep -q Error && echo "FAIL $id: $(echo "$out" | grep -m1 Error)"
done
echo "rendered $n"
