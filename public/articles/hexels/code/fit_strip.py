import sys, numpy as np
sys.path.insert(0, '.')
from PIL import Image, ImageDraw, ImageFont
from primitives import fit, IMAGES, psnr
SIZE, N, STEPS, UP = 48, 32, 200, 4
kinds = [("g_const", "Gaussian"), ("g_lin", "Gaussian + ramp"), ("d_const", "Round, sharp edge"), ("h_const", "Hexagon"), ("h_lin", "Hexel + ramp")]
tiles = []
for im in ("poster", "shaded"):
    img = IMAGES[im](SIZE)
    row = [("Reference", img, None)]
    for k, name in kinds:
        p, out = fit(k, img, N, 0, STEPS)
        row.append((name, out, p))
    tiles.append(row)
cw = SIZE * UP + 6; ch = SIZE * UP + 26
W = cw * 6 + 6; H = ch * 2 + 6
canvas = Image.new("RGB", (W, H), (255, 255, 255)); d = ImageDraw.Draw(canvas)
try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
except Exception: font = ImageFont.load_default()
for r, row in enumerate(tiles):
    for c, (name, arr, p) in enumerate(row):
        im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)).resize((SIZE * UP, SIZE * UP), Image.NEAREST)
        x = 6 + c * cw; y = 6 + r * ch
        canvas.paste(im, (x, y))
        label = name if p is None else f"{name}  {p:.1f} dB"
        d.text((x, y + SIZE * UP + 4), label, fill=(30, 30, 30), font=font)
canvas.save("fit_strip.png", optimize=True); print(canvas.size)
