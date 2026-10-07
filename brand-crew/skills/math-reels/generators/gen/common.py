import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, math
OUT=_OUT
def W(spec):
    spec={"$schema":"../../brand-crew/skills/math-reels/schema.json",**spec}
    json.dump(spec,open(f"{OUT}/{spec['id']}.json",'w'),indent=2,ensure_ascii=False)
RCA="Real and complex analysis"
def S(ref,q): return {"ref":ref,"quote":q}
