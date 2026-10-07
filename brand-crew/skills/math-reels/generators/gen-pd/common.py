import os as _o, sys as _s; _s.path.insert(0, _o.path.dirname(_o.path.dirname(_o.path.abspath(__file__))) if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) != 'generators' else _o.path.dirname(_o.path.abspath(__file__))); from _paths import GEN, REPO, OUT as _OUT, REVIEWS as _REV  # repo-relative paths (generators/_paths.py)
import json, re, os, math, random
from enrich import apply as enrich_apply

SP = GEN
OUT = _OUT
WT = REPO


def norm(s):
    s = str(s).replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', s).strip()


ROWS = [json.loads(l) for l in open(_REV + '/probability-dynamics.jsonl') if l.strip()]
REVT = {}
for r in ROWS:
    REVT.setdefault(r['id'], []).append(norm(' \n '.join(str(v) for v in r.values())))
ARTICLE = norm(open(WT + '/content/articles/openai-math.mdx').read())
_cat = open(WT + '/components/articles/openai-math/catalogue-data.ts').read()
DISC = json.loads(re.search(r'export const DISCIPLINES = (\[.*?\]) as const', _cat, re.S).group(1))
FAM = json.loads(re.sub(r',\s*\]$', ']', re.search(r'export const FAMILIES: Family\[\] = (\[[\s\S]*?\n\])', _cat).group(1)))
CAT = {f['id']: f for f in FAM}
CATN = norm(_cat)
LEANS = ['main', 'part', 'none']


def R(fid, field, q):
    assert any(norm(q) in t for t in REVT[fid]), f'review {fid} quote missing: {q}'
    return {'ref': f'review {fid}, {field}', 'quote': q}


def A(section, q):
    assert norm(q) in ARTICLE, f'article quote missing: {q}'
    return {'ref': f'article, {section}', 'quote': q}


def CP(fid):
    return {'ref': f'catalogue, family {fid} manuscript path', 'quote': CAT[fid]['p']}


def C(fid, q):
    assert norm(q) in CATN, f'catalogue quote missing: {q}'
    return {'ref': f'catalogue, family {fid}', 'quote': q}


NOBUILD = A('How I checked', 'I did not build the Lean library, run Comparator or execute any code from the release.')
READ_ALL = A('How I checked', 'each of whom read the catalogue summary, every abstract, and the introduction and main theorem statements of every principal manuscript in their group')
READ_FAITHFUL = A('What I would believe today', 'all have short formal statements that I read and found faithful')

OUR_LEAN = 'We read the abstracts and main statements; we did not build the Lean'
OUR_NONE = 'We read the abstracts and main statements; nothing here is machine-checked'
OUR_FAITH = 'We read the formal statement and found it faithful; we did not build it'


def spec(fid, kind, short, title, subtitle, obj, ach, detail, our, sources):
    f = CAT[fid]
    s = {
        '$schema': '../../brand-crew/skills/math-reels/schema.json',
        'id': fid,
        'discipline': DISC[f['d']],
        'kind': kind,
        'short': short,
        'title': {'title': title, 'subtitle': subtitle},
        'object': obj,
        'achievement': ach,
        'verify': {'lean': LEANS[f['l']], 'detail': detail, 'ourCheck': our},
        'sources': sources,
    }
    s = enrich_apply(s)
    os.makedirs(OUT, exist_ok=True)
    with open(f'{OUT}/{fid}.json', 'w') as fh:
        json.dump(s, fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    return s


# ---- geometry helpers (stage = the 1088 x 448 object box) -----------------
BW, BH = 1088, 448


def node(i, x, y, **kw):
    """x, y in pixels inside the box -> 0-1 stage coordinates."""
    d = {'id': str(i), 'x': round(x / BW, 4), 'y': round(y / BH, 4)}
    d.update(kw)
    return d


