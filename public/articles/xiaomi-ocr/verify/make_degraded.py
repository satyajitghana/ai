# Degrade the two-column page the way the Real5 recaptures do, mildly: skew, blur, uneven light, noise, JPEG.
import os, numpy as np
from PIL import Image, ImageFilter
H = os.path.dirname(os.path.abspath(__file__)); rng = np.random.default_rng(0)
im = Image.open(f"{H}/pages/M_twocol.png").convert("RGB")
im = im.rotate(2.5, resample=Image.BICUBIC, expand=True, fillcolor=(235, 235, 230)).filter(ImageFilter.GaussianBlur(1.3))
a = np.asarray(im).astype(np.float32); h, w, _ = a.shape
grad = np.linspace(0.62, 1.05, w)[None, :, None] * np.linspace(1.0, 0.85, h)[:, None, None]   # uneven light
a = a * grad + rng.normal(0, 10, a.shape)
Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f"{H}/pages/M_degraded.jpg", quality=35)
print(Image.open(f"{H}/pages/M_degraded.jpg").size)
