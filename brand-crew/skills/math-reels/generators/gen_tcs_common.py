import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, os, math, itertools

OUT = _OUT
DISC = 'Theoretical computer science'
CHECK_LEAN = 'We did not build the Lean or referee the proof'
CHECK_NONE = 'We did not referee the proof; nothing here is machine-checked'


def src(ref, quote):
    return {'ref': ref, 'quote': quote}


PANEL_TK = {'from', 'until'}  # times only on a panel; elsewhere 'from' is a value (slide, range, region, relation)
TK = {'at', 'edgeAt', 'edgeDur', 'sweepAt', 'sweep', 'flowAt', 'cellAt', 'cellStagger', 'stagger'}


def scale_times(v, f, top=True):
    # rescale every time key of an object scene (beats, panels, slides) by f
    if isinstance(v, dict):
        tk = TK | PANEL_TK if 'primitive' in v else TK
        return {k: (round(x * f, 2) if (k in tk or (k == 'dur' and not top)) and isinstance(x, (int, float))
                    else scale_times(x, f, False)) for k, x in v.items()}
    if isinstance(v, list):
        return [scale_times(x, f, False) for x in v]
    return v


def write(id, kind, short, title, subtitle, obj, ach, verify, sources):
    from gen_tcs_enrich import ENRICH, PROOF_OBJ_DUR
    e = ENRICH.get(id, {})
    if e.get('proof') and obj['dur'] > PROOF_OBJ_DUR:
        obj = scale_times(obj, PROOF_OBJ_DUR / obj['dur'])
        obj['dur'] = PROOF_OBJ_DUR
    s = {
        '$schema': '../../brand-crew/skills/math-reels/schema.json',
        'id': id,
        'discipline': DISC,
        'kind': kind,
        'short': short,
        'title': {'title': title, 'subtitle': subtitle},
    }
    if e.get('plain'):
        s['plain'] = e['plain']
    s['object'] = obj
    if e.get('proof'):
        s['proof'] = e['proof']
    s['achievement'] = ach
    s['verify'] = verify
    if e.get('voice'):
        s['voice'] = e['voice']
    s['sources'] = sources + e.get('sources', [])
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f'{id}.json'), 'w') as f:
        json.dump(s, f, indent=2, ensure_ascii=False)
        f.write('\n')
