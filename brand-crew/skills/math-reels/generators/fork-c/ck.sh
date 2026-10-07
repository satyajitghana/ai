#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
# usage: ck.sh id...
cd $ROOT
S=$ROOT/data/math-reels
for id in "$@"; do
  nice -n 19 node brand-crew/skills/math-reels/check.mjs $S/$id.json --reviews=$MATH_REVIEWS | grep -v "specs,"
  nice -n 19 node brand-crew/skills/math-reels/render.mjs plan $S/$id.json 2>&1 | grep -iv '^{"id"' | head -5
done
