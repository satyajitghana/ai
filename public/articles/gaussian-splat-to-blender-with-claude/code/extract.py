"""Deterministic extraction on a synthetic SfM-like capture (a toy, numpy only).

A building (an oriented box, 12 x 8 x 6 m) stands on a ground plane. The SfM
frame is arbitrary: unknown rotation, unknown scale s, the cloud is noisy and
carries floater outliers. Two camera centres are a known real distance apart.
From the points alone we recover: up (the ground normal), the box yaw, the box
width / depth / height, and the scale (from the camera baseline).

Run: python3 -I extract.py > extract.json
"""
import json
import sys

import numpy as np

W, D, H = 12.0, 8.0, 6.0  # true box, metres
N_GROUND, N_WALL, N_ROOF, N_CLUTTER = 4000, 1200, 1500, 800
AREA = 60.0  # ground patch side, metres
BASELINE = 2.0  # true metres between the two known camera centres


def rot(axis, ang):
    axis = np.asarray(axis, float)
    axis /= np.linalg.norm(axis)
    a, (x, y, z) = ang, axis
    c, s = np.cos(a), np.sin(a)
    return np.array(
        [
            [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
            [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
            [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)],
        ]
    )


def make_scene(rng, sigma, outlier_frac):
    yaw = rng.uniform(0, np.pi / 2)
    cx, cy = rng.uniform(-6, 6, 2)
    R = rot([0, 0, 1], yaw)
    R2 = R[:2, :2]
    pts = []
    # ground (the building footprint is left empty: points there are hidden)
    g = rng.uniform(-AREA / 2, AREA / 2, (N_GROUND, 2))
    local = (g - [cx, cy]) @ R2  # footprint test in the box frame
    keep = ~((np.abs(local[:, 0]) < W / 2) & (np.abs(local[:, 1]) < D / 2))
    g = g[keep]
    pts.append(np.c_[g, np.zeros(len(g))])
    # four walls and a flat roof, in the box frame, then placed
    box = []
    for sx, sy, fixed_axis, half_u, half_v in (
        (1, 0, 0, D / 2, H / 2),
        (-1, 0, 0, D / 2, H / 2),
        (0, 1, 1, W / 2, H / 2),
        (0, -1, 1, W / 2, H / 2),
    ):
        u = rng.uniform(-half_u, half_u, N_WALL)
        v = rng.uniform(0, H, N_WALL)
        if fixed_axis == 0:
            box.append(np.c_[np.full(N_WALL, sx * W / 2), u, v])
        else:
            box.append(np.c_[u, np.full(N_WALL, sy * D / 2), v])
    ru = rng.uniform(-W / 2, W / 2, N_ROOF)
    rv = rng.uniform(-D / 2, D / 2, N_ROOF)
    box.append(np.c_[ru, rv, np.full(N_ROOF, H)])
    box = np.vstack(box)
    box_world = box.copy()
    box_world[:, :2] = box[:, :2] @ R2.T + [cx, cy]
    pts.append(box_world)
    # non-planar clutter (shrubs) near the building
    pts.append(
        np.c_[rng.normal([cx + 12, cy - 9], 2.0, (N_CLUTTER, 2)), np.abs(rng.normal(0, 1.2, N_CLUTTER))]
    )
    P = np.vstack(pts)
    # noise along a random direction per point (SfM triangulation noise)
    P = P + rng.normal(0, sigma, P.shape)
    # floaters: uniform in a large volume
    n_out = int(outlier_frac * len(P) / (1 - outlier_frac))
    out = np.c_[rng.uniform(-AREA / 2, AREA / 2, (n_out, 2)), rng.uniform(-2, 18, n_out)]
    P = np.vstack([P, out])
    # two known camera centres, BASELINE apart, 1.6 m above ground, near the scene edge
    cams = np.array([[-20.0, 18.0, 1.6], [-20.0 + BASELINE, 18.0, 1.6]])
    # arbitrary SfM frame: rotation, scale, translation
    Rf = rot(rng.normal(size=3), rng.uniform(0, np.pi))
    s = float(np.exp(rng.uniform(np.log(0.3), np.log(3.0))))
    t = rng.normal(0, 5, 3)
    Pf = s * (P @ Rf.T) + t
    camf = s * (cams @ Rf.T) + t
    truth = dict(yaw=yaw, up=Rf @ np.array([0, 0, 1.0]), s=s)
    return Pf, camf, truth


def fit_plane(P):
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    n = vt[2]
    return n, -n @ c


def ransac_plane(P, rng, tau, iters=400, constraint=None):
    best, best_cnt = None, -1
    N = len(P)
    for _ in range(iters):
        i = rng.choice(N, 3, replace=False)
        a, b, c = P[i]
        n = np.cross(b - a, c - a)
        nn = np.linalg.norm(n)
        if nn < 1e-9:
            continue
        n /= nn
        if constraint is not None and not constraint(n):
            continue
        d = -n @ a
        cnt = int((np.abs(P @ n + d) < tau).sum())
        if cnt > best_cnt:
            best, best_cnt = (n, d), cnt
    if best is None:
        return None
    n, d = best
    inl = np.abs(P @ n + d) < tau
    if inl.sum() >= 3:
        n, d = fit_plane(P[inl])
        inl = np.abs(P @ n + d) < tau
    return n, d, inl


def extract(P, camf, rng):
    med = np.median(P, 0)
    scale_ref = np.percentile(np.linalg.norm(P - med, axis=1), 90)
    tau = 0.012 * scale_ref
    # 1. ground = the biggest plane
    g = ransac_plane(P, rng, tau)
    n_up, d_g, inl = g
    rest = P[~inl]
    # sign of up: the side where most of the remaining points are
    if np.median(rest @ n_up + d_g) < 0:
        n_up, d_g = -n_up, -d_g
    # 2. roof = the biggest plane parallel to the ground among the rest
    roof = ransac_plane(rest, rng, tau, constraint=lambda n: abs(n @ n_up) > 0.97)
    height_sfm = None
    if roof is not None and roof[2].sum() > 100:
        # height above the ground along the up axis: mean height of the roof inliers
        height_sfm = float(np.mean(rest[roof[2]] @ n_up + d_g))
        rest = rest[~roof[2]]
    # 3. walls = vertical planes
    walls = []
    for _ in range(4):
        if len(rest) < 50:
            break
        w = ransac_plane(rest, rng, tau, constraint=lambda n: abs(n @ n_up) < 0.1)
        if w is None or w[2].sum() < 100:
            break
        walls.append((w[0], w[1]))
        rest = rest[~w[2]]
    out = dict(up=n_up, walls=len(walls), height_sfm=height_sfm)
    # 4. yaw: wall normals live in the horizontal plane; fold angles mod 90 degrees
    if len(walls) >= 2:
        e1 = np.cross(n_up, [1.0, 0.0, 0.0])
        if np.linalg.norm(e1) < 1e-6:
            e1 = np.cross(n_up, [0.0, 1.0, 0.0])
        e1 /= np.linalg.norm(e1)
        e2 = np.cross(n_up, e1)
        ang = np.array([np.arctan2(w[0] @ e2, w[0] @ e1) for w in walls])
        z = np.exp(4j * ang).mean()  # circular mean of 4*angle: 90-degree symmetric
        yaw_est = np.angle(z) / 4
        out["yaw_frame"] = (e1, e2, yaw_est)
        # extents: separation of the two parallel wall planes in each family
        fam = {0: [], 1: []}
        for n, d in walls:
            a = np.arctan2(n @ e2, n @ e1) - yaw_est
            k = int(np.round(a / (np.pi / 2))) % 2
            sign = 1.0 if np.cos(a - k * np.pi / 2) > 0 else -1.0
            fam[k].append((sign * n, sign * d))
        dims = []
        for k in (0, 1):
            if len(fam[k]) == 2:
                (n1, d1), (n2, d2) = fam[k]
                # parallel planes: distance = |d1 - d2| after aligning normals
                if n1 @ n2 < 0:
                    n2, d2 = -n2, -d2
                dims.append(abs(d1 - d2))
            else:
                dims.append(None)
        out["dims_sfm"] = dims
    return out


def run(seed, sigma, outlier_frac):
    rng = np.random.default_rng(seed)
    P, camf, truth = make_scene(rng, sigma, outlier_frac)
    ex = extract(P, camf, np.random.default_rng(seed + 10_000))
    # scale from the camera baseline, which a human measured to +-1%
    base_meas = BASELINE * (1 + rng.normal(0, 0.01))
    base_sfm = float(np.linalg.norm(camf[1] - camf[0]))
    s_est = base_sfm / base_meas  # SfM units per metre
    rec = dict(ok=False)
    up_err = float(np.degrees(np.arccos(np.clip(abs(ex["up"] @ truth["up"]), 0, 1))))
    rec.update(up_err_deg=up_err, scale_err_pct=float(abs(s_est / truth["s"] - 1) * 100), walls=ex["walls"])
    if ex["walls"] >= 4 and ex.get("height_sfm") and all(d is not None for d in ex.get("dims_sfm", [None])):
        e1, e2, yaw_est = ex["yaw_frame"]
        dims = sorted([d / s_est for d in ex["dims_sfm"]], reverse=True)
        h = ex["height_sfm"] / s_est
        true_dims = [W, D]
        e_w, e_d, e_h = (dims[0] - W) / W, (dims[1] - D) / D, (h - H) / H
        rec.update(
            dim_err_pct=float(np.mean(np.abs([e_w, e_d, e_h])) * 100),
            w_err_pct=float(e_w * 100),
            d_err_pct=float(e_d * 100),
            h_err_pct=float(e_h * 100),
        )
        rec["ok"] = bool(max(abs(e_w), abs(e_d), abs(e_h)) < 0.10 and up_err < 3.0)
    return rec


def main():
    sigmas = [0.02, 0.05, 0.10, 0.20]
    fracs = [0.0, 0.10, 0.25, 0.40]
    seeds = list(range(12))
    table = []
    for sg in sigmas:
        for fr in fracs:
            recs = [run(s, sg, fr) for s in seeds]
            ok = [r for r in recs if r.get("dim_err_pct") is not None]
            table.append(
                dict(
                    sigma=sg,
                    outliers=fr,
                    seeds=len(seeds),
                    success=sum(r["ok"] for r in recs),
                    found4=sum(1 for r in recs if r["walls"] >= 4),
                    up_err_deg_median=float(np.median([r["up_err_deg"] for r in recs])),
                    dim_err_pct_median=float(np.median([r["dim_err_pct"] for r in ok])) if ok else None,
                    scale_err_pct_median=float(np.median([r["scale_err_pct"] for r in recs])),
                )
            )
            print(sg, fr, table[-1]["success"], "/", len(seeds), file=sys.stderr)
    json.dump(
        dict(
            note="toy: synthetic SfM-like cloud, not a real capture; 12 seeds per cell",
            box=[W, D, H],
            baseline_m=BASELINE,
            cells=table,
        ),
        sys.stdout,
        indent=1,
    )


if __name__ == "__main__":
    main()
