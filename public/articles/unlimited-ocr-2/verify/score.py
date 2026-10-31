"""Rescore results.json. run_real.py's own CER left the <BLOCK>type<LEVEL1>[x0,y0,x1,y1]<FORK> markup in the output,
which counts as errors against the plain-text truth; this strips it first. Both numbers are reported in the article."""
import json, re, sys
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (ca != cb)))
        prev = cur
    return prev[-1]
def strip(s):
    s = re.sub(r"<PAGE>", "\n", s)
    s = re.sub(r"<BLOCK>[a-z_]*(<LEVEL\d>)?\[[^\]]*\]<FORK>", "\n", s)
    s = re.sub(r"</t[dh]>", " ", s); s = re.sub(r"</tr>", "\n", s); s = re.sub(r"<[^>]+>", "", s)
    return s
def plain(s): return re.sub(r"\s+", "", s)
def tex(s): return re.sub(r"\s+|\\left|\\right|\\,|\\!|\\displaystyle|\$|\{|\}", "", s.replace("\\dfrac", "\\frac"))
res = json.load(open(sys.argv[1])); truth = json.load(open(sys.argv[2])); out = {}
for job, R in res.items():
    parts = [p for p in re.split(r"<PAGE>", R["text"]) if p.strip()]
    for i, p in enumerate(R["pages"]):
        got = strip(parts[i] if i < len(parts) else ""); tr = truth[p]
        f = tex if tr["kind"] == "formula" else plain
        g, r_ = f(got), f(tr["text"]); out[f"{job}/{p}"] = dict(cer=round(lev(g, r_) / len(r_), 4), edits=lev(g, r_), ref_chars=len(r_))
json.dump(out, open("scored.json", "w"), indent=1); [print(k, v) for k, v in out.items()]
