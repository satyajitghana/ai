#!/bin/bash
# paths: the repo this script sits in; MATH_REVIEWS = the folder of review *.jsonl (not in the repo)
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel); : "${MATH_REVIEWS:=$ROOT/../oaimath/reviews}"
# frame --check previews: object end, proof mid/end, achievement (proof specs); object mid/end, achievement (others)
R=$ROOT/brand-crew/skills/math-reels/generators
O=${TMPDIR:-/tmp}/scratch/math-reels/enrich/number-theory
mkdir -p $O; cd $ROOT
for id in "$@"; do
  if grep -q '"proof": {' $ROOT/data/math-reels/$id.json; then T=6.0,8.2,11.6,13.8,16.9; else T=7,10.8,14.8; fi
  nice -n 19 node brand-crew/skills/math-reels/render.mjs frame $ROOT/data/math-reels/$id.json --t=$T --out=$O/$id.png --check 2>&1 | grep -v '"file"'
  python3 - $O $id $T <<'PY'
import sys
from PIL import Image
o,i,T=sys.argv[1],sys.argv[2],sys.argv[3].split(',')
ims=[Image.open(f"{o}/{i}-{float(t):.2f}s.png").convert('RGB').resize((640,360)) for t in T]
cols=3; rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(640*cols,360*rows),(0,0,0))
for k,im in enumerate(ims): sh.paste(im,((k%cols)*640,(k//cols)*360))
sh.save(f"{o}/{i}-sheet.jpg",quality=82)
PY
done
