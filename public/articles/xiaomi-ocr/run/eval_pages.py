import json, re, os
H = os.path.dirname(os.path.abspath(__file__))
truth = json.load(open(f"{H}/pages/truth.json")); res = json.load(open(f"{H}/results_pages.json"))
def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]
def clean(t):
    t = re.sub(r"<\|[^|]*\|>", "", t)
    return t.replace("<|im_end|>", "").strip()
TAG = re.compile(r"<(fcel|ecel|lcel|ucel|xcel|nl)>")
def decode(src):
    rows = []
    for line in src.split("<nl>"):
        hits = list(TAG.finditer(line)); parts = []
        for k, m in enumerate(hits):
            end = hits[k + 1].start() if k + 1 < len(hits) else len(line)
            parts.append((m.group(1), line[m.end():end].strip()))
        if parts: rows.append(parts)
    cols = max((len(r) for r in rows), default=0)
    grid = [r + [("ecel", "")] * (cols - len(r)) for r in rows]
    cells = []
    for r, row in enumerate(grid):
        for c, (tag, text) in enumerate(row):
            if tag not in ("fcel", "ecel"): continue
            cs = 1
            while c + cs < cols and grid[r][c + cs][0] in ("lcel", "xcel"): cs += 1
            rs = 1
            while r + rs < len(grid) and grid[r + rs][c][0] in ("ucel", "xcel"): rs += 1
            cells.append({"r": r, "c": c, "rs": rs, "cs": cs, "text": text})
    return {"rows": len(grid), "cols": cols, "cells": cells}
def truth_cells():
    t = truth["B_table"]; cells = [{"r": 0, "c": 0, "rs": 1, "cs": 3, "text": t["title"]}]
    for r, row in enumerate(t["rows"], 1):
        for c, x in enumerate(row): cells.append({"r": r, "c": c, "rs": 1, "cs": 1, "text": x})
    return {"rows": len(t["rows"]) + 1, "cols": 3, "cells": cells}
def norm_tex(s):
    s = clean(s); s = re.sub(r"^\$+|\$+$", "", s.strip()); s = re.sub(r"\\\[|\\\]|\\\(|\\\)", "", s)
    for cmd in ("\\,", "\\!", "\\;", "\\left", "\\right", "\\displaystyle"): s = s.replace(cmd, "")
    s = s.replace("\\dfrac", "\\frac")
    s = re.sub(r"\s+", "", s)
    prev = None
    while prev != s:  # drop braces that wrap a single token after _ or ^, so _{0} and _0 compare equal
        prev = s; s = re.sub(r"([_^])\{([^{}\\]|\\[a-zA-Z]+)\}", r"\1\2", s)
    return s
out = []
for r in res["runs"]:
    img, task, text = r["image"], r["task"], clean(r["text"]); row = {"image": img, "task": task, "prompt_tokens": r["prompt_tokens"], "image_tokens": r["image_tokens"], "new_tokens": r["new_tokens"], "sec": r["sec"], "sec_per_new_token": round(r["sec"] / max(1, r["new_tokens"]), 2)}
    if img.startswith("A_"):
        gt = re.sub(r"\s+", " ", truth["A_text"]).strip(); pr = re.sub(r"\s+", " ", re.sub(r"[#*]+", "", text)).strip()
        d = lev(pr, gt); row.update({"chars_truth": len(gt), "edit_distance": d, "cer": round(d / len(gt), 4), "exact": pr == gt})
    elif img.startswith("B_"):
        p = decode(text); g = truth_cells(); key = lambda c: (c["r"], c["c"], c["rs"], c["cs"], c["text"])
        gs = {key(c) for c in g["cells"]}; ps = {key(c) for c in p["cells"]}
        gp = {(c["r"], c["c"]): c["text"] for c in g["cells"]}; pp = {(c["r"], c["c"]): c["text"] for c in p["cells"]}
        row.update({"grid_pred": [p["rows"], p["cols"]], "grid_truth": [g["rows"], g["cols"]], "cells_truth": len(g["cells"]), "cells_pred": len(p["cells"]), "cells_exact_with_span": len(gs & ps), "text_match_at_position": sum(1 for k, v in gp.items() if pp.get(k) == v), "title_colspan_pred": next((c["cs"] for c in p["cells"] if c["r"] == 0 and c["c"] == 0), None)})
    elif img.startswith("C"):
        gt = norm_tex(truth[img.replace(".png", "")]); pr = norm_tex(text); d = lev(pr, gt)
        row.update({"truth_norm": gt, "pred_norm": pr, "norm_edit_distance": d, "norm_rate": round(d / len(gt), 4), "exact_after_norm": pr == gt})
    row["text_head"] = text[:300]; out.append(row)
json.dump(out, open(f"{H}/eval_pages.json", "w"), indent=1, ensure_ascii=False)
for o in out: print({k: v for k, v in o.items() if k != "text_head"}); print("   ", repr(o["text_head"][:220]))
