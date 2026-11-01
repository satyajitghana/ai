# Two multi-region test pages with known ground truth, rendered with PIL + matplotlib.
import json, os
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pages")
fp = font_manager.findfont("DejaVu Serif"); fb = font_manager.findfont("DejaVu Serif:bold"); fs = font_manager.findfont("DejaVu Sans")
F = lambda s, p=fp: ImageFont.truetype(p, s)
truth = {}
# --- Page M: title + two text columns (reading order: whole left column, then right) ---
W, H = 1000, 560
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
title = "Notes from the Harbour"
tw = d.textlength(title, font=F(40, fb)); d.text(((W - tw) / 2, 30), title, font=F(40, fb), fill="black")
left = ["The harbour master kept a", "ledger of every vessel that", "crossed the bar, noting the", "tide and the weather. In", "winter the entries grew", "shorter and then stopped."]
right = ["By spring the ledger was", "found under a coil of rope.", "Its last page held only the", "name of a pilot and a date", "that nobody could place in", "the history of the town."]
for col, lines, x in ((0, left, 50), (1, right, 530)):
    for i, l in enumerate(lines): d.text((x, 120 + 54 * i), l, font=F(28), fill="black")
img.save(f"{OUT}/M_twocol.png")
truth["M_twocol"] = {"title": title, "left": " ".join(left), "right": " ".join(right)}
# --- Page T: paragraph, merged-header table, display formula, paragraph ---
W, H = 900, 700
img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
p1 = ["We compare three detectors on the same pages.", "The results are summarised in the table below."]
for i, l in enumerate(p1): d.text((50, 30 + 42 * i), l, font=F(28), fill="black")
rows = [["Model", "Params", "Score"], ["Alpha", "0.8B", "96.8"], ["Bravo", "0.9B", "96.3"], ["Charlie", "1.2B", "96.9"]]
ttl = "Benchmark results"; cw, rh, x0, y0 = [300, 200, 200], 50, 50, 140
d.rectangle([x0, y0, x0 + sum(cw), y0 + rh], outline="black", width=2)
t = d.textlength(ttl, font=F(26, fs)); d.text((x0 + (sum(cw) - t) / 2, y0 + 11), ttl, font=F(26, fs), fill="black")
for r, row in enumerate(rows):
    y = y0 + rh * (r + 1); x = x0
    for c, cell in enumerate(row):
        d.rectangle([x, y, x + cw[c], y + rh], outline="black", width=2); d.text((x + 14, y + 11), cell, font=F(26, fs), fill="black"); x += cw[c]
tex = r"\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt{\pi}}{2}"
fig = plt.figure(figsize=(6.0, 1.1), dpi=100); fig.text(0.5, 0.5, f"${tex}$", fontsize=32, ha="center", va="center"); fig.savefig("/tmp/_f.png", facecolor="white"); plt.close(fig)
f = Image.open("/tmp/_f.png").convert("RGB"); img.paste(f, ((W - f.width) // 2, 410))
p2 = ["The integral above is the Gaussian integral, and", "it equals half the square root of pi."]
for i, l in enumerate(p2): d.text((50, 560 + 42 * i), l, font=F(28), fill="black")
img.save(f"{OUT}/T_tableformula.png")
truth["T_tableformula"] = {"p1": " ".join(p1), "title": ttl, "rows": rows, "formula": tex, "p2": " ".join(p2)}
json.dump(truth, open(f"{OUT}/truth2.json", "w"), indent=1)
print({k: Image.open(f"{OUT}/{k}.png").size for k in truth})
