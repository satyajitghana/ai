#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
W=$ROOT
O=$ROOT/brand-crew/skills/math-reels/generators
cd $W
F=""; for i in "$@"; do F="$F $ROOT/data/math-reels/$i.json"; done
nice -n 19 node brand-crew/skills/math-reels/check.mjs $F --reviews=$MATH_REVIEWS
nice -n 19 node brand-crew/skills/math-reels/render.mjs plan $F 2>&1 | cut -c1-220 | grep -v '^{"id"'
true
