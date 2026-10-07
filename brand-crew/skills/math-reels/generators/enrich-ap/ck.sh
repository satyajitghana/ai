#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
# usage: ck.sh [id...]  (default: all analysis-pde ids)
SP=${TMPDIR:-/tmp}
cd $ROOT
if [ $# -eq 0 ]; then set -- $(python3 -c "import json;print(' '.join(x['id'] for x in json.load(open('$ROOT/brand-crew/skills/math-reels/generators/group-analysis-pde.json'))))"); fi
F=(); for i in "$@"; do F+=("$ROOT/data/math-reels/$i.json"); done
nice -n 19 node brand-crew/skills/math-reels/check.mjs "${F[@]}" --reviews=$MATH_REVIEWS | grep -v '^ok'
nice -n 19 node brand-crew/skills/math-reels/render.mjs plan "${F[@]}" > $ROOT/brand-crew/skills/math-reels/generators/enrich-ap/plan.out 2>&1; echo "plan exit $?"
