import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
# Apply enrich.py in place to the specs with no generator to re-run (071-086 are final JSON; 322-332, 362-365 have none).
import json, sys
sys.path.insert(0, _o.path.join(GEN, 'enrich-ap'))
import enrich
OUT = _OUT
IDS = [f'{i:03d}' for i in range(71, 87)] + [str(i) for i in range(322, 333)] + [str(i) for i in range(362, 366)]
for id in IDS:
    p = f'{OUT}/{id}.json'; s = json.load(open(p))
    enrich.apply(s)
    json.dump(s, open(p, 'w'), indent=2, ensure_ascii=False); open(p, 'a').write('\n') if False else None
print('applied', len(IDS))
