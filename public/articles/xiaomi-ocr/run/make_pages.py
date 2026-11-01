import json, os
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages")
font_path = font_manager.findfont("DejaVu Sans")
def F(sz): return ImageFont.truetype(font_path, sz)

# A: paragraph
lines = ["The harbour master kept a ledger of every vessel that",
         "crossed the bar, noting the tide, the weather and the name",
         "of the pilot. In winter the entries grew shorter, and by",
         "February the pages were mostly blank except for the cold."]
img = Image.new("RGB", (860, 40 + 44 * len(lines) + 30), "white"); d = ImageDraw.Draw(img)
for i, l in enumerate(lines): d.text((30, 30 + 44 * i), l, font=F(26), fill="black")
img.save(f"{OUT}/A_text.png")

# B: table with a merged header
rows = [["Model", "Params", "Score"], ["Alpha", "0.8B", "96.8"], ["Bravo", "0.9B", "96.3"], ["Charlie", "1.2B", "96.9"], ["Delta", "0.8B", "96.6"]]
title = "Benchmark results"
cw, rh, x0, y0 = [220, 160, 160], 54, 30, 30
W = x0 * 2 + sum(cw); H = y0 * 2 + rh * (len(rows) + 1)
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
d.rectangle([x0, y0, x0 + sum(cw), y0 + rh], outline="black", width=2)
tw = d.textlength(title, font=F(26)); d.text((x0 + (sum(cw) - tw) / 2, y0 + 12), title, font=F(26), fill="black")
for r, row in enumerate(rows):
    y = y0 + rh * (r + 1); x = x0
    for c, cell in enumerate(row):
        d.rectangle([x, y, x + cw[c], y + rh], outline="black", width=2)
        d.text((x + 14, y + 12), cell, font=F(26), fill="black"); x += cw[c]
img.save(f"{OUT}/B_table.png")

# C: formulas (matplotlib mathtext)
def formula(name, tex):
    fig = plt.figure(figsize=(6.4, 1.3), dpi=130); fig.text(0.5, 0.5, f"${tex}$", fontsize=34, ha="center", va="center"); fig.savefig(f"{OUT}/{name}.png", facecolor="white"); plt.close(fig)
formula("C1_formula", r"\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt{\pi}}{2}")
formula("C2_formula", r"\sum_{k=1}^{n} k=\frac{n(n+1)}{2}")
truth = {"A_text": " ".join(lines), "B_table": {"title": title, "rows": rows},
         "C1_formula": r"\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt{\pi}}{2}", "C2_formula": r"\sum_{k=1}^{n} k=\frac{n(n+1)}{2}"}
json.dump(truth, open(f"{OUT}/truth.json", "w"), indent=1)
print({p: Image.open(f"{OUT}/{p}").size for p in sorted(os.listdir(OUT)) if p.endswith(".png")})
