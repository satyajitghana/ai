"""E3: does the rectangle 3DGUT builds from unscented-transform sigma points cover every pixel whose ray reaches the Gaussian?
Exact support: pixels whose ray has minimum Mahalanobis distance <= r (r = min(3, sqrt(2 ln(255 o))) = 3 for o = 0.9)."""
import numpy as np
from fisheye_toys import *

rng = np.random.default_rng(37818)
P, valid, n = pixel_grid()
Pv = P[valid]
dirs = unproject(Pv)
theta_pix = np.arccos(np.clip(dirs[:, 2], -1, 1))
R_SUPPORT = 3.0
angles = [0, 20, 40, 60, 80, 90, 100]
sizes = [0.05, 0.1, 0.2]
rows = []
for th in angles:
    for rs in sizes:
        rec, miss_gauss, tile_miss, beyond80, nsup = [], 0, [], [], []
        for _ in range(25):
            mu, S = random_gaussian(rng, np.deg2rad(th), rs)
            d2 = ray_support_delta2(mu, S, dirs)
            sup = d2 <= R_SUPPORT ** 2
            if not sup.any():
                continue
            m, ext = ut_rect(mu, S)
            inside = (np.abs(Pv[:, 0] - m[0]) <= ext[0]) & (np.abs(Pv[:, 1] - m[1]) <= ext[1])
            rec.append(float((sup & inside).sum() / sup.sum()))
            miss_gauss += int((sup & ~inside).any())
            tx, ty = (Pv[sup] // TILE).astype(int).T
            tiles = set(zip(tx.tolist(), ty.tolist()))
            x0 = int(np.floor((m[0] - 0.5 - ext[0]) / TILE)); x1 = int(np.ceil((m[0] - 0.5 + ext[0]) / TILE))
            y0 = int(np.floor((m[1] - 0.5 - ext[1]) / TILE)); y1 = int(np.ceil((m[1] - 0.5 + ext[1]) / TILE))
            hit = [t for t in tiles if x0 <= t[0] < x1 and y0 <= t[1] < y1]
            tile_miss.append(1 - len(hit) / len(tiles))
            beyond80.append(float((theta_pix[sup] > np.deg2rad(80)).mean()))
            nsup.append(int(sup.sum()))
        rows.append(dict(theta_deg=th, rel_size=rs, gaussians=len(rec),
                         pixel_recall_mean=round(float(np.mean(rec)), 4), pixel_recall_min=round(float(np.min(rec)), 4),
                         frac_gaussians_with_missed_pixels=round(miss_gauss / len(rec), 3),
                         tile_miss_mean=round(float(np.mean(tile_miss)), 4),
                         support_beyond_80deg_mean=round(float(np.mean(beyond80)), 4),
                         support_pixels_median=int(np.median(nsup))))
        print(rows[-1])
dump('results-tiles.json', dict(note='25 random Gaussians per cell; recall = exact-support pixels inside the UT rectangle / exact-support pixels; tile_miss = share of 16x16 tiles holding exact-support pixels that fall outside the UT tile range',
                                camera=dict(model='OPENCV_FISHEYE, FIORD Hall_In camera 1 at 1/4 resolution', theta_max_deg=100), support_radius=R_SUPPORT, rows=rows))
