import json, re, os
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(H)
truth = json.load(open(f"{H}/pages/truth2.json")); runs = json.load(open(f"{H}/vlm_out.json"))["runs"]
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]
def clean(t): return re.sub(r"<\|[^|]*\|>", "", t).strip()
def words(t): return re.sub(r"\s+", " ", re.sub(r"[#*]+", "", t)).strip()
TAG = re.compile(r"<(fcel|ecel|lcel|ucel|xcel|nl)>")
def decode(src):
    rows = []
    for line in src.split("<nl>"):
        hits = list(TAG.finditer(line)); parts = []
        for k, m in enumerate(hits):
            end = hits[k + 1].start() if k + 1 < len(hits) else len(line); parts.append((m.group(1), line[m.end():end].strip()))
        if parts: rows.append(parts)
    cols = max((len(r) for r in rows), default=0); grid = [r + [("ecel", "")] * (cols - len(r)) for r in rows]; cells = []
    for r, row in enumerate(grid):
        for c, (tag, text) in enumerate(row):
            if tag not in ("fcel", "ecel"): continue
            cs = 1
            while c + cs < cols and grid[r][c + cs][0] in ("lcel", "xcel"): cs += 1
            rs = 1
            while r + rs < len(grid) and grid[r + rs][c][0] in ("ucel", "xcel"): rs += 1
            cells.append((r, c, rs, cs, text))
    return rows and (len(grid), cols, cells) or (0, 0, [])
def truth_cells(t):
    cells = {(0, 0, 1, 3, t["title"])}
    for r, row in enumerate(t["rows"], 1):
        for c, x in enumerate(row): cells.add((r, c, 1, 1, x))
    return len(t["rows"]) + 1, 3, cells
def norm_tex(s):
    s = re.sub(r"^\$+|\$+$", "", clean(s).strip()); s = re.sub(r"\\\[|\\\]|\\\(|\\\)", "", s)
    for c in ("\\,", "\\!", "\\;", "\\left", "\\right", "\\displaystyle"): s = s.replace(c, "")
    s = re.sub(r"\s+", "", s.replace("\\dfrac", "\\frac")); prev = None
    while prev != s: prev = s; s = re.sub(r"([_^])\{([^{}\\]|\\[a-zA-Z]+)\}", r"\1\2", s)
    return s
def pull_table(text):  # first OTSL run in a markdown answer
    m = re.search(r"(<(?:fcel|ecel|lcel|ucel|xcel)>.*?<nl>)+", text.replace("\n", ""), re.S); return m.group(0) if m else ""
def pull_formula(text):
    m = re.search(r"\\\[(.*?)\\\]", text.replace("\n", " "), re.S) or re.search(r"\$\$(.*?)\$\$", text.replace("\n", " "), re.S); return m.group(1) if m else ""
out = {}
for page in ["T_tableformula", "M_twocol", "M_degraded"]:
    pr = [r for r in runs if r["page"] == page]; single = next((r for r in pr if r["mode"] == "single"), None); two = [r for r in pr if r["mode"] == "two"]
    o = {}
    if page.startswith("M_"):
        t = truth["M_twocol"]; gt_two = words(t["title"] + " " + t["left"] + " " + t["right"]); gt_flip = words(t["title"] + " " + t["right"] + " " + t["left"])
        def sc(txt):
            x = words(clean(txt)); d = lev(x, gt_two); return {"chars_truth": len(gt_two), "edit": d, "cer": round(d / len(gt_two), 4), "cer_if_columns_swapped": round(lev(x, gt_flip) / len(gt_flip), 4), "exact": x == gt_two}
        if single: o["single"] = {**sc(single["text"]), "new_tokens": single["new_tokens"], "image_tokens": single["image_tokens"], "sec": single["sec"], "hit_limit": single["hit_limit"], "text": clean(single["text"])}
        if len(two) >= 3:
            joined = " ".join(clean(r["text"]) for r in two); o["two"] = {**sc(joined), "regions": len(two), "new_tokens": sum(r["new_tokens"] for r in two), "image_tokens": sum(r["image_tokens"] for r in two), "sec": round(sum(r["sec"] for r in two), 1), "text": joined}
    else:
        t = truth[page]; g = truth_cells(t["rows"] and t)
        gt_text = words(t["p1"] + " " + t["p2"]); gtf = norm_tex(t["formula"])
        def score(table_src, formula_src, text_src):
            d = decode(table_src) if table_src else (0, 0, []); pc = set(d[2]); x = words(text_src)
            return {"table_grid_pred": [d[0], d[1]], "table_grid_truth": [g[0], g[1]], "cells_exact_with_span": len(g[2] & pc), "cells_truth": len(g[2]), "cells_pred": len(pc),
                    "formula_norm_dist": lev(norm_tex(formula_src), gtf) if formula_src else None, "formula_exact_after_norm": norm_tex(formula_src) == gtf if formula_src else False,
                    "paragraph_cer": round(lev(x, gt_text) / len(gt_text), 4), "paragraph_text": x}
        if single:
            txt = clean(single["text"]); body = re.sub(r"<(?:fcel|ecel|lcel|ucel|xcel|nl)>[^<\n]*", "", txt); body = re.sub(r"\\\[.*?\\\]|\$\$.*?\$\$", "", body.replace("\n", " "), flags=re.S)
            o["single"] = {**score(pull_table(txt), pull_formula(txt), body), "new_tokens": single["new_tokens"], "image_tokens": single["image_tokens"], "sec": single["sec"], "hit_limit": single["hit_limit"], "text": txt}
        tw = {r["task"] + str(r["region"]): r for r in two}
        if len(two) >= 4:
            tab = next(r for r in two if r["task"] == "table"); fo = next(r for r in two if r["task"] == "formula"); tx = " ".join(clean(r["text"]) for r in two if r["task"] == "text")
            o["two"] = {**score(clean(tab["text"]), clean(fo["text"]), tx), "regions": len(two), "new_tokens": sum(r["new_tokens"] for r in two), "image_tokens": sum(r["image_tokens"] for r in two), "sec": round(sum(r["sec"] for r in two), 1), "text": [clean(r["text"]) for r in two]}
    out[page] = o
json.dump(out, open(f"{H}/eval2.json", "w"), indent=1, ensure_ascii=False)
for p, o in out.items():
    for m, v in o.items(): print(p, m, {k: x for k, x in v.items() if k not in ("text", "paragraph_text")})
