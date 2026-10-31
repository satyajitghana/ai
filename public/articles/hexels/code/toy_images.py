"""Three synthetic test images for the hexel toys (numpy only, deterministic)."""
import numpy as np

def grid(n):
    ys, xs = np.mgrid[0:n, 0:n].astype(np.float64)
    return (xs + 0.5) / n, (ys + 0.5) / n

def _masks(n):
    x, y = grid(n)
    m = {}
    m["circle"] = (x - 0.70) ** 2 + (y - 0.22) ** 2 < 0.10 ** 2
    # pyramid: triangle (0.05,0.70) (0.30,0.30) (0.55,0.70)
    def tri(ax, ay, bx, by, cx, cy):
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d
        l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d
        return (l1 >= 0) & (l2 >= 0) & (1 - l1 - l2 >= 0)
    m["tri"] = tri(0.05, 0.70, 0.30, 0.30, 0.55, 0.70)
    arch = ((x > 0.58) & (x < 0.85) & (y > 0.40) & (y < 0.80)) | ((x - 0.715) ** 2 + (y - 0.40) ** 2 < 0.135 ** 2) & (y <= 0.40)
    m["arch"] = arch
    inner = ((x > 0.64) & (x < 0.79) & (y > 0.45) & (y < 0.80)) | ((x - 0.715) ** 2 + (y - 0.45) ** 2 < 0.075 ** 2) & (y <= 0.45)
    m["inner"] = inner
    m["ground"] = y >= 0.80
    m["stripe"] = (y >= 0.80) & (((y - 0.80) * 40).astype(int) % 2 == 0)
    return x, y, m

def poster(n):
    x, y, m = _masks(n)
    img = np.empty((n, n, 3)); img[:] = (0.93, 0.88, 0.78)
    img[m["circle"]] = (0.85, 0.30, 0.20)
    img[m["tri"]] = (0.20, 0.45, 0.50)
    img[m["arch"]] = (0.95, 0.75, 0.35)
    img[m["inner"]] = (0.10, 0.25, 0.35)
    img[m["ground"]] = (0.15, 0.35, 0.45)
    img[m["stripe"]] = (0.10, 0.25, 0.35)
    return img

def shaded(n):
    x, y, m = _masks(n)
    img = np.empty((n, n, 3))
    img[:] = (0.93, 0.88, 0.78) + np.stack([0.06 * y, 0.04 * y, -0.10 * y], -1) - 0.03 * x[..., None]
    def put(mask, base, gx, gy):
        c = np.array(base)[None, None, :] + x[..., None] * np.array(gx) + y[..., None] * np.array(gy)
        img[mask] = c[mask]
    put(m["circle"], (0.95, 0.40, 0.25), (-0.30, -0.05, 0.0), (-0.35, -0.20, 0.0))
    put(m["tri"], (0.30, 0.65, 0.70), (-0.35, -0.25, -0.20), (0.10, 0.0, 0.05))
    put(m["arch"], (0.80, 0.55, 0.20), (0.35, 0.40, 0.45), (0.0, 0.0, 0.0))
    put(m["inner"], (0.05, 0.20, 0.30), (0.40, 0.45, 0.50), (0.0, 0.05, 0.1))
    put(m["ground"], (0.30, 0.50, 0.60), (-0.10, -0.10, -0.10), (-0.20, -0.20, -0.25))
    hl = 0.18 * np.exp(-(((x - 0.30) ** 2 + (y - 0.55) ** 2) / 0.02))
    img = img + hl[..., None] * m["tri"][..., None]
    return np.clip(img, 0, 1)

def texture(n, seed=3):
    rng = np.random.default_rng(seed)
    x, y = grid(n)
    img = np.stack([0.5 + 0.25 * x - 0.1 * y, 0.45 + 0.1 * x + 0.2 * y, 0.5 - 0.2 * x + 0.1 * y], -1)
    for _ in range(8):
        f = rng.uniform(8, 30); th = rng.uniform(0, np.pi); ph = rng.uniform(0, 2 * np.pi)
        amp = rng.uniform(0.04, 0.10, size=3)
        wave = np.sin(2 * np.pi * f * (x * np.cos(th) + y * np.sin(th)) + ph)
        img += wave[..., None] * amp
    noise = rng.normal(size=(n, n, 3))
    F = np.fft.fft2(noise, axes=(0, 1))
    fy = np.fft.fftfreq(n)[:, None] * n; fx = np.fft.fftfreq(n)[None, :] * n
    r = np.sqrt(fx ** 2 + fy ** 2)
    band = ((r > 8) & (r < 24)).astype(float)[..., None]
    img += 0.10 * np.real(np.fft.ifft2(F * band, axes=(0, 1))) / (np.std(noise) + 1e-9) * 0.5
    return np.clip(img, 0, 1)

IMAGES = {"poster": poster, "shaded": shaded, "texture": texture}

def psnr(a, b):
    mse = float(np.mean((np.asarray(a) - np.asarray(b)) ** 2))
    return 10 * np.log10(1.0 / max(mse, 1e-12))
