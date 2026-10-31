# Render three 1024x1024 test pages with known ground truth. PYTHONPATH must include matplotlib.
import json, textwrap, sys
from PIL import Image, ImageDraw, ImageFont
out = sys.argv[1]
F = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
FB = "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"
truth = {}

# page 1: text
title = "The Lighthouse Keeper's Ledger"
body = ("Each evening the keeper climbed ninety-two steps to light the lamp, then wrote the weather in a "
        "narrow green ledger. Fog came in from the north on most nights in autumn, and the horn sounded "
        "every thirty seconds until dawn. A supply boat arrived on the first Tuesday of each month, "
        "bringing flour, lamp oil, and letters from the mainland. In 1931 the ledger records a storm that "
        "lasted four days; the keeper counted eleven ships passing safely and one fishing boat that did not.")
im = Image.new("RGB", (1024, 1024), "white"); d = ImageDraw.Draw(im)
d.text((72, 80), title, font=ImageFont.truetype(FB, 40), fill="black")
f = ImageFont.truetype(F, 31); y = 170
lines = textwrap.wrap(body, 52)
for ln in lines:
    d.text((72, y), ln, font=f, fill="black"); y += 46
im.save(f"{out}/p1-text.png")
truth["p1-text"] = {"kind": "text", "text": title + "\n" + body}

# page 2: table
rows = [["Region", "Q1", "Q2", "Q3"], ["North", "120", "135", "150"], ["South", "98", "104", "117"],
        ["East", "143", "129", "161"], ["West", "87", "92", "99"], ["Total", "448", "460", "527"]]
im = Image.new("RGB", (1024, 1024), "white"); d = ImageDraw.Draw(im)
d.text((72, 80), "Quarterly units shipped", font=ImageFont.truetype(FB, 40), fill="black")
f = ImageFont.truetype(F, 34); x0, y0, cw, rh = 72, 200, [260, 200, 200, 200], 90
for r, row in enumerate(rows):
    x = x0
    for c, cell in enumerate(row):
        d.rectangle([x, y0 + r * rh, x + cw[c], y0 + (r + 1) * rh], outline="black", width=2)
        d.text((x + 24, y0 + r * rh + 26), cell, font=ImageFont.truetype(FB if r in (0, 5) else F, 34), fill="black")
        x += cw[c]
im.save(f"{out}/p2-table.png")
truth["p2-table"] = {"kind": "table", "title": "Quarterly units shipped", "rows": rows,
                     "text": "Quarterly units shipped\n" + "\n".join(" ".join(r) for r in rows)}

# page 3: formulas via matplotlib mathtext
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
eqs = [r"$E = mc^2$", r"$\int_0^1 x^2\,dx = \frac{1}{3}$", r"$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$",
       r"$a^2 + b^2 = c^2$", r"$\frac{d}{dx}\sin x = \cos x$"]
fig = plt.figure(figsize=(10.24, 10.24), dpi=100); fig.patch.set_facecolor("white")
fig.text(0.07, 0.92, "Five identities", fontsize=30, family="serif", weight="bold")
for i, e in enumerate(eqs):
    fig.text(0.07, 0.78 - i * 0.16, e, fontsize=34)
fig.savefig(f"{out}/p3-formula.png", dpi=100); plt.close(fig)
truth["p3-formula"] = {"kind": "formula", "latex": [e.strip("$") for e in eqs], "title": "Five identities",
                       "text": "Five identities\n" + "\n".join(e.strip("$") for e in eqs)}
json.dump(truth, open(f"{out}/truth.json", "w"), indent=1)
print({k: Image.open(f"{out}/{k}.png").size for k in truth})
