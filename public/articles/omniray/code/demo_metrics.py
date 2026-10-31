"""Metrics on the OmniRay project page's own demo point clouds.

Input: a checkout of github.com/nam1410/omniray (project page only: demo/assets/benchmark/<camera>/{gt,omniray,da3,unik3d}.ply).
The four clouds of an example are sampled at the same pixels, so vertex i is the same pixel in every file.
Usage: python3 -I demo_metrics.py <path-to-omniray-checkout> [out.json]
"""
import json, sys, os
import numpy as np

CAMS = ["pinhole", "fisheye", "panorama", "gopro", "catadioptric"]
METHODS = ["omniray", "unik3d", "da3"]

def load_ply(path):
    raw = open(path, "rb").read()
    end = raw.index(b"end_header\n") + len(b"end_header\n")
    head = raw[:end].decode()
    n = int([l for l in head.split("\n") if l.startswith("element vertex")][0].split()[-1])
    dt = np.dtype([("x", "<f4"), ("y", "<f4"), ("z", "<f4"), ("r", "u1"), ("g", "u1"), ("b", "u1")])
    a = np.frombuffer(raw, dtype=dt, count=n, offset=end)
    xyz = np.stack([a["x"], a["y"], a["z"]], 1).astype(np.float64)
    rgb = np.stack([a["r"], a["g"], a["b"]], 1)
    return xyz, rgb

def nn_median(a, b, chunk=2000):
    """median over a of the nearest-neighbour distance to b (brute force, chunked)."""
    out = np.empty(len(a))
    b2 = (b * b).sum(1)
    for i in range(0, len(a), chunk):
        x = a[i:i + chunk]
        d2 = (x * x).sum(1)[:, None] - 2 * x @ b.T + b2[None, :]
        out[i:i + chunk] = np.sqrt(np.maximum(d2.min(1), 0))
    return float(np.median(out))

def main(root, out=None):
    res = {}
    for cam in CAMS:
        d = os.path.join(root, "demo/assets/benchmark", cam)
        gt, gtc = load_ply(os.path.join(d, "gt.ply"))
        valid = np.isfinite(gt).all(1) & (np.linalg.norm(gt, axis=1) > 1e-9)
        rho_gt = np.linalg.norm(gt, axis=1)
        row = {"n_vertices": int(len(gt)), "n_valid_gt": int(valid.sum())}
        for m in METHODS:
            p, pc = load_ply(os.path.join(d, m + ".ply"))
            same_pixels = bool((pc == gtc).mean() > 0.99)
            ok = valid & np.isfinite(p).all(1) & (np.linalg.norm(p, axis=1) > 1e-9)
            rho = np.linalg.norm(p, axis=1)
            dg = gt[ok] / rho_gt[ok, None]
            dp = p[ok] / rho[ok, None]
            ang = np.degrees(np.arccos(np.clip((dg * dp).sum(1), -1, 1)))
            s = np.median(rho_gt[ok]) / np.median(rho[ok])
            ps = p[ok] * s
            z = rho_gt[ok].mean()
            pt_err = np.linalg.norm(ps - gt[ok], axis=1) / z
            rng = np.random.default_rng(0)
            sub = rng.choice(ok.sum(), size=min(8000, ok.sum()), replace=False)
            acc = nn_median(ps[sub], gt[ok]) / z          # pred -> gt
            comp = nn_median(gt[ok][sub], ps) / z         # gt -> pred
            absrel = np.abs(s * rho[ok] - rho_gt[ok]) / rho_gt[ok]
            row[m] = {
                "same_pixels_as_gt": same_pixels,
                "ray_mean_deg": float(ang.mean()), "ray_median_deg": float(np.median(ang)), "ray_p95_deg": float(np.percentile(ang, 95)),
                "scale": float(s), "radial_absrel_median": float(np.median(absrel)),
                "point_err_median_rel": float(np.median(pt_err)),
                "acc": acc, "comp": comp, "chamfer": (acc + comp) / 2,
                "n_used": int(ok.sum()),
            }
        res[cam] = row
    if out:
        json.dump(res, open(out, "w"), indent=1)
    return res

if __name__ == "__main__":
    r = main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    for cam, row in r.items():
        print(cam, row["n_vertices"], row["n_valid_gt"])
        for m in METHODS:
            x = row[m]
            print(f"  {m:8s} ray mean {x['ray_mean_deg']:7.3f}  med {x['ray_median_deg']:7.3f}  p95 {x['ray_p95_deg']:7.3f}  absrel {x['radial_absrel_median']:.3f}  CD {x['chamfer']:.4f}  samepx={x['same_pixels_as_gt']}")
