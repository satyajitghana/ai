import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, re, math, os, random

S = GEN
OUT = _OUT
REV = {}
for line in open(_REV + '/combinatorics.jsonl'):
    if line.strip():
        r = json.loads(line)
        REV[r['id']] = r


def norm(s):
    s = re.sub('[‘’]', "'", s)
    s = re.sub('[“”]', '"', s)
    return re.sub(r'\s+', ' ', s).strip()


ART = norm(open(REPO + '/content/articles/openai-math.mdx').read())
CAT = norm(open(REPO + '/components/articles/openai-math/catalogue-data.ts').read())


def R(fid, field, quote):
    txt = norm(' \n '.join(str(v) for v in REV[fid].values()))
    assert norm(quote) in txt, f'review {fid} missing: {quote}'
    return {'ref': f'review {fid}, {field}', 'quote': quote}


def A(section, quote):
    assert norm(quote) in ART, f'article missing: {quote}'
    return {'ref': f'article, {section}', 'quote': quote}


def C(fid, quote):
    assert norm(quote) in CAT, f'catalogue missing: {quote}'
    return {'ref': f'catalogue, family {fid}', 'quote': quote}


# box in pixels (no heading)
BX, BY, BW, BH = 96, 128, 1088, 448


def frac(px, py, heading=False):
    by, bh = (BY + 14, BH - 14) if heading else (BY, BH)
    return round((px - BX) / BW, 4), round((py - by) / bh, 4)


def place(points, cx=640, cy=352, scale=100, heading=False):
    """points in math coords (y up) -> stage fractions."""
    out = []
    for (x, y) in points:
        out.append(frac(cx + x * scale, cy - y * scale, heading))
    return out


LEAN_MAIN_CHECK = 'We read the Lean statement; we did not build it'
NONE_CHECK = 'Nothing formal to check; this rests on the manuscript'


TIMEKEYS = {'at', 'dur', 'edgeAt', 'edgeDur', 'flowAt', 'sweepAt', 'sweep', 'stagger', 'until'}


def _scale(o, f, top=False):
    """Scale every time-valued key (seconds) in a panel by f."""
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, (int, float)) and not isinstance(v, bool) and (k in TIMEKEYS or (top and k == 'from')):
                o[k] = round(v * f, 2)
            elif isinstance(v, (dict, list)):
                _scale(v, f)
    elif isinstance(o, list):
        for x in o:
            _scale(x, f)


def retime(obj, dur):
    """Fit the object scene into `dur` seconds (a proof scene needs ~6 s)."""
    f = dur / obj.get('dur', 8)
    for k, v in obj.items():
        if k in ('dur',):
            continue
        if k == 'beats':
            for b in v:
                b['at'] = max(0.2, round(b['at'] * f, 1))
        elif k == 'panels':
            for p in v:
                _scale(p, f, top=True)
        elif isinstance(v, (int, float)) and not isinstance(v, bool) and k in TIMEKEYS:
            obj[k] = round(v * f, 2)
        elif isinstance(v, (dict, list)):
            _scale(v, f)
    obj['dur'] = dur
    bs = obj.get('beats', [])
    if len(bs) == 3:
        # keep ~1.9 s between captions and ~1.4 s of read time on the last
        bs[1]['at'] = min(bs[1]['at'], round(dur - 3.4, 1))
        bs[2]['at'] = min(max(bs[2]['at'], round(bs[1]['at'] + 1.9, 1)), round(dur - 1.4, 1))


def vis(s):
    s = re.sub(r'\$[^$]+\$', 'x', s)
    return len(s.replace('==', '').replace('**', ''))


def enrich(spec):
    from enrich import ENRICH
    e = ENRICH.get(spec['id'])
    if not e:
        return spec
    obj = spec['object']
    if 'proof' in e:
        retime(obj, e.get('dur', 6.0))
    if 'object' in e:
        obj.update(e['object'])
    assert vis(e['plain']) <= 110, (spec['id'], vis(e['plain']), e['plain'])
    out = {}
    for k, v in spec.items():
        if k == 'object':
            out['plain'] = e['plain']
        out[k] = v
        if k == 'object' and 'proof' in e:
            pr = e['proof']
            for st in pr['steps']:
                assert vis(st) <= 72, (spec['id'], vis(st), st)
            out['proof'] = pr
        if k == 'verify':
            out['voice'] = [{'scene': a, 'text': b} for a, b in e['voice']]
    lim = {'title': 5, 'object': 15 if 'proof' in e else 22, 'proof': 14, 'achievement': 8 if 'proof' in e else 11, 'verify': 4}
    n = 0
    per = {}
    for l in out['voice']:
        w = len(l['text'].split()); n += w
        assert len(l['text']) <= 96, (spec['id'], len(l['text']), l['text'])
        per[l['scene']] = per.get(l['scene'], 0) + w
    for sc, w in per.items():
        assert w <= lim[sc], (spec['id'], sc, w)
    assert 40 <= n <= 55, (spec['id'], n)
    return out


def write(spec):
    spec = {'$schema': '../../brand-crew/skills/math-reels/schema.json', **spec}
    spec.setdefault('discipline', 'Combinatorics')
    spec = enrich(spec)
    with open(f"{OUT}/{spec['id']}.json", 'w') as f:
        json.dump(spec, f, indent=2, ensure_ascii=False)
        f.write('\n')
