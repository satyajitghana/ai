import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os

OUT = _OUT

NT, LOGIC, GROUP = 'Number theory', 'Mathematical logic', 'Group theory'

# shared sources
S_HOW = {"ref": "article, How I checked", "quote": "read each family's summary and abstracts and the introduction and main theorem of every principal paper"}
S_NOBUILD = {"ref": "article, How I checked", "quote": "I compiled nothing."}
S_AXIOMS = {"ref": "article, How I checked", "quote": "only `propext`, `Quot.sound` and `Classical.choice` for every family here"}
S_TARGETS = {"ref": "article, How I checked", "quote": "the target `.lean` statements for the families discussed above"}

OC_NONE = "We read the main theorem and caveats; nothing was checked independently"
OC_DOCS = "We read the Lean docs and allowed axioms; we did not build it"
OC_TARGET = "We read the Lean target statement; we did not build it"


def cat(id, path):
    return {"ref": f"catalogue, family {id} manuscript path", "quote": path}


def rv(id, field, quote):
    return {"ref": f"review {id}, {field}", "quote": quote}


def art(section, quote):
    return {"ref": f"article, {section}", "quote": quote}


def beat(at, text):
    return {"at": at, "text": text}


# --- enrichment pass: plain line, proof scene, narration (enrich.py) ---------
TIME_KEYS = {'at', 'dur', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'stagger'}


def _scale(v, f, key=None):
    """Scale every animation time inside a panel (not values such as a slide's from/to)."""
    if key in TIME_KEYS and isinstance(v, (int, float)) and not isinstance(v, bool):
        return round(v * f, 2)
    if isinstance(v, dict):
        return {k: (round(x * f, 2) if k in TIME_KEYS and isinstance(x, (int, float)) and not isinstance(x, bool)
                    else _scale(x, f, k)) for k, x in v.items()}
    if isinstance(v, list):
        return [_scale(x, f, key) for x in v]
    return v


def retime(obj, dur):
    """Fit an object scene written for ~8.6 s into `dur` s (a proof scene needs the room)."""
    f = dur / obj['dur']
    out = {}
    for k, v in obj.items():
        if k == 'dur':
            out[k] = dur
        elif k == 'beats':
            out[k] = [dict(b, at=round(max(0.15, b['at'] * f), 2)) for b in v]
        elif k == 'panels':
            out[k] = [{pk: (round(pv * f, 2) if pk in ('from', 'until') else _scale(pv, f, pk)) for pk, pv in p.items()} for p in v]
        elif k in ('heading', 'layout', 'primitive'):
            out[k] = v
        else:
            out[k] = _scale(v, f, k)
    return out


def enrich(s):
    from enrich import E
    e = E.get(s['id'])
    if not e:
        return s
    if 'plain' in e:
        s['plain'] = e['plain']
    if 'proof' in e:
        s['proof'] = e['proof']
        s['object'] = retime(s['object'], e.get('odur', 6.0))
    if 'voice' in e:
        s['voice'] = [{"scene": sc, "text": t} for sc, t in e['voice']]
    s['sources'] = s.get('sources', []) + e.get('sources', [])
    return s


def write(spec):
    s = {"$schema": "../../brand-crew/skills/math-reels/schema.json"}
    s.update(spec)
    s = enrich(s)
    src = s.get('sources', [])
    # de-duplicate sources, keep order
    seen, out = set(), []
    for q in src:
        k = (q['ref'], q['quote'])
        if k not in seen:
            seen.add(k); out.append(q)
    s['sources'] = out
    with open(os.path.join(OUT, s['id'] + '.json'), 'w') as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
        f.write('\n')
