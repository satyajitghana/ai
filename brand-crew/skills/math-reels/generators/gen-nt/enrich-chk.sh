#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
# regenerate, then check + plan every spec of this group (optionally only the ids given)
R=$ROOT/brand-crew/skills/math-reels/generators
cd $R/gen-nt && for f in a b c d; do python3 $f.py >/dev/null || exit 1; done
cd $ROOT
if [ $# -gt 0 ]; then ids="$*"; else ids=$(python3 -c "import json;print(' '.join(f['id'] for f in json.load(open('$R/group-number-theory-logic-groups.json'))))"); fi
files=(); for i in $ids; do files+=("$ROOT/data/math-reels/$i.json"); done
nice -n 19 node brand-crew/skills/math-reels/check.mjs "${files[@]}" --reviews=$MATH_REVIEWS | grep -v "^ok"
nice -n 19 node brand-crew/skills/math-reels/render.mjs plan "${files[@]}" 2>&1
