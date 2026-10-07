#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
# fr.sh <id> <t,t,...>
W=$ROOT
O=$ROOT/brand-crew/skills/math-reels/generators
P=${TMPDIR:-/tmp}/math-reels/combinatorics
cd $W; nice -n 19 node brand-crew/skills/math-reels/render.mjs frame $ROOT/data/math-reels/$1.json --t=$2 --out=$P/$1.png 2>&1 | grep -o '"file":"[^"]*"'
