#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
R=$ROOT/brand-crew/skills/math-reels/generators
T=${TMPDIR:-/tmp}/math-reels/tmpchk
mkdir -p $T
cd $ROOT
files=(); for i in "$@"; do files+=("$ROOT/data/math-reels/$i.json"); done
nice -n 19 node brand-crew/skills/math-reels/check.mjs "${files[@]}" --reviews=$MATH_REVIEWS | grep -v "^ok"
for f in "${files[@]}"; do out=$(nice -n 19 node brand-crew/skills/math-reels/render.mjs frame "$f" --t=1 --out=$T/x.png 2>&1); if echo "$out" | grep -q "Error"; then echo "ENGINE FAIL $(basename $f): $(echo "$out" | grep -m1 Error)"; fi; done
