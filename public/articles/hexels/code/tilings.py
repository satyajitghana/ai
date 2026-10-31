"""Equal-area tilings (square / hexagon / triangle) fitted with per-cell constant or affine colour.
No optimisation: least-squares per cell on a fixed lattice. Isolates cell shape + colour model."""
import json, sys, numpy as np
sys.path.insert(0, '.')
from toy_images import IMAGES, grid, psnr

def cell_ids(kind, n, area, theta=0.0):
    x, y = grid(n)                              # unit square image; `area` = nominal cell area
    if theta:
        c, s_ = np.cos(theta), np.sin(theta)
        x, y = c * (x - 0.5) - s_ * (y - 0.5) + 0.5, s_ * (x - 0.5) + c * (y - 0.5) + 0.5
    if kind == "square":
        s = np.sqrt(area)
        i = np.floor(x / s).astype(np.int64); j = np.floor(y / s).astype(np.int64)
        ids = i * 10007 + j
    elif kind == "hexagon":                    # pointy-top regular hexagons, area = 3*sqrt(3)/2 R^2
        R = np.sqrt(2 * area / (3 * np.sqrt(3)))
        q = (np.sqrt(3) / 3 * x - 1.0 / 3 * y) / R
        r = (2.0 / 3 * y) / R
        cx = q; cz = r; cy = -cx - cz          # cube rounding
        rx, ry, rz = np.round(cx), np.round(cy), np.round(cz)
        dx, dy, dz = np.abs(rx - cx), np.abs(ry - cy), np.abs(rz - cz)
        fix_x = (dx > dy) & (dx > dz); fix_y = (~fix_x) & (dy > dz)
        rx = np.where(fix_x, -ry - rz, rx); rz = np.where((~fix_x) & (~fix_y), -rx - ry, rz)
        ids = rx.astype(np.int64) * 10007 + rz.astype(np.int64)
    elif kind == "triangle":                   # equilateral triangles, area = sqrt(3)/4 a^2
        a = np.sqrt(4 * area / np.sqrt(3)); h = a * np.sqrt(3) / 2
        t = y / h; s_ = (x - t * a / 2) / a
        i = np.floor(s_).astype(np.int64); j = np.floor(t).astype(np.int64)
        up = ((s_ - i) + (t - j)) >= 1.0
        ids = (i * 10007 + j) * 2 + up.astype(np.int64)
    else:
        raise ValueError(kind)
    return ids

def match_cells(kind, n, target, theta=0.0):
    """Bisect the nominal cell area until the number of non-empty cells equals `target` (border cells make
    a fixed nominal area give different counts for different shapes)."""
    lo, hi = 0.25 / target, 4.0 / target
    best = None
    for _ in range(40):
        mid = np.sqrt(lo * hi)
        ids = cell_ids(kind, n, mid, theta)
        c = len(np.unique(ids))
        if best is None or abs(c - target) < abs(best[1] - target): best = (ids, c)
        if c == target: break
        if c > target: lo = mid
        else: hi = mid
    return best

def fit(img, ids, model):
    n = img.shape[0]
    x, y = grid(n)
    flat_ids = ids.reshape(-1)
    uniq, inv = np.unique(flat_ids, return_inverse=True)
    C = len(uniq)
    col = img.reshape(-1, 3)
    if model == "const":
        s = np.zeros((C, 3)); np.add.at(s, inv, col)
        cnt = np.bincount(inv, minlength=C).astype(np.float64)
        mean = s / cnt[:, None]
        rec = mean[inv]
        params = 3 * C
    else:                                       # affine: c = a + bx*x + by*y per channel, per cell
        X = np.stack([np.ones(n * n), (x - 0.5).reshape(-1), (y - 0.5).reshape(-1)], 1)   # (P,3)
        A = np.zeros((C, 3, 3)); B = np.zeros((C, 3, 3))
        np.add.at(A, inv, X[:, :, None] * X[:, None, :])
        np.add.at(B, inv, X[:, :, None] * col[:, None, :])
        A += 1e-9 * np.eye(3)[None]
        # cells with a degenerate/small footprint: fall back to the mean (still a valid affine field)
        W = np.zeros((C, 3, 3))
        cnt = np.bincount(inv, minlength=C)
        for k in range(C):
            if cnt[k] >= 3 and np.linalg.cond(A[k]) < 1e8:
                W[k] = np.linalg.solve(A[k], B[k])
            else:
                W[k, 0] = B[k, 0] / max(A[k, 0, 0], 1e-12)
        rec = np.einsum('pk,pkc->pc', X, W[inv])
        params = 9 * C
    rec = np.clip(rec, 0, 1).reshape(n, n, 3)
    return rec, C, params

def main():
    n = 128
    out = []
    for iname, f in IMAGES.items():
        img = f(n)
        for kind in ("square", "hexagon", "triangle"):
            for target in (8, 16, 32, 64, 128, 256, 512):
                ids, _c = match_cells(kind, n, target)
                for model in ("const", "affine"):
                    rec, C, params = fit(img, ids, model)
                    out.append(dict(image=iname, shape=kind, model=model, target_cells=target, cells=int(C), params=int(params), psnr=round(psnr(rec, img), 3)))
    period = {"square": 90, "hexagon": 60, "triangle": 120}
    for iname, f in IMAGES.items():
        img = f(n)
        for kind in ("square", "hexagon", "triangle"):
            angles = np.deg2rad(np.linspace(0, period[kind], 10, endpoint=False))
            for target in (8, 16, 32, 64, 128, 256, 512):
                for model in ("const", "affine"):
                    best = None
                    for th in angles:
                        ids, _c = match_cells(kind, n, target, th)
                        rec, C, params = fit(img, ids, model)
                        p = psnr(rec, img)
                        if best is None or p > best[0]: best = (p, C, params, float(np.rad2deg(th)))
                    out.append(dict(image=iname, shape=kind, model=model, target_cells=target, cells=int(best[1]), params=int(best[2]), psnr=round(best[0], 3), oracle_angle=round(best[3], 1), variant='best-rotation'))
    for o in out: o.setdefault('variant', 'axis-aligned')
    json.dump(out, open('tilings.json', 'w'), indent=0)
    # quick print: at cells ~ 64 and ~ 256
    for iname in IMAGES:
        print('==', iname)
        for target in (16, 64, 256):
            row = []
            for kind in ("square", "hexagon", "triangle"):
                for model in ("const", "affine"):
                    r = [o for o in out if o['image'] == iname and o['shape'] == kind and o['model'] == model and o['target_cells'] == target and o['variant']=='axis-aligned'][0]
                    row.append(f"{kind[:3]}-{model[:1]} {r['cells']:3d}c {r['psnr']:.2f}")
            print(target, ' | '.join(row))
main()
