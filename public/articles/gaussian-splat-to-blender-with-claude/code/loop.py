"""A render-compare-refine loop with no LLM in it (a toy, numpy only).

Target: three oriented boxes (main building, annex, tower). The 'splat render'
is the silhouette of the target seen from C cameras. The 'modeller' is a
stochastic local search: pick one box parameter, nudge it, re-render the model,
keep the edit when the mean silhouette IoU does not get worse. We count the
renders (evaluations) it takes to reach IoU 0.9, from scratch and from a start
that the deterministic extraction (extract.py) would give for the main box,
with 1, 3 or 6 cameras. We also measure the 3D IoU of the result against the
target: a silhouette can be right while the model is wrong.

Run: python3 -I loop.py > loop.json
"""
import json
import sys

import numpy as np

IMG = 40
FOV = np.radians(40.0)
BUDGET = 2500
STOP_IOU = 0.9
LO = np.array([-8, -8, 2, 2, 2, 0.0])
HI = np.array([8, 8, 16, 16, 16, np.pi / 2])
RANGE = HI - LO
PIX = (np.stack(np.meshgrid(np.arange(IMG) + 0.5, np.arange(IMG) + 0.5), -1).reshape(-1, 2) / IMG) * 2 - 1


def cameras(n):
    az = {1: [0.0], 3: [0, 120, 240], 6: [0, 60, 120, 180, 240, 300]}[n]
    out = []
    for a in az:
        a = np.radians(a + 20)  # offset so no camera looks exactly along an axis
        pos = np.array([45 * np.cos(a), 45 * np.sin(a), 12.0])
        f = np.array([0, 0, 4.0]) - pos
        f /= np.linalg.norm(f)
        r = np.cross(f, [0, 0, 1.0])
        r /= np.linalg.norm(r)
        u = np.cross(r, f)
        out.append((pos, np.stack([r, u, f])))
    return out


def silhouette(params, cam):
    """Exact silhouette of the union of boxes: a pixel is on if its ray hits any box (slab test)."""
    pos, Rm = cam
    t = np.tan(FOV / 2)
    d = Rm[2][None, :] + (PIX[:, 0:1] * t) * Rm[0][None, :] + (PIX[:, 1:2] * t) * Rm[1][None, :]
    mask = np.zeros(IMG * IMG, bool)
    for cx, cy, w, dd, h, yaw in params.reshape(3, 6):
        c, s = np.cos(yaw), np.sin(yaw)
        Rb = np.array([[c, s, 0], [-s, c, 0], [0, 0, 1.0]])  # world -> box frame
        o = Rb @ (pos - np.array([cx, cy, h / 2]))
        dl = d @ Rb.T
        half = np.array([w / 2, dd / 2, h / 2])
        with np.errstate(divide="ignore", invalid="ignore"):
            t1 = (-half - o) / dl
            t2 = (half - o) / dl
        tmin = np.minimum(t1, t2).max(1)
        tmax = np.maximum(t1, t2).min(1)
        mask |= tmax >= np.maximum(tmin, 0)
    return mask


def score(params, cams, target):
    ious = []
    for cam, tg in zip(cams, target):
        m = silhouette(params, cam)
        inter = (m & tg).sum()
        union = (m | tg).sum()
        ious.append(inter / union if union else 0.0)
    return float(np.mean(ious))


def occupancy(params, pts):
    occ = np.zeros(len(pts), bool)
    for cx, cy, w, d, h, yaw in params.reshape(3, 6):
        c, s = np.cos(yaw), np.sin(yaw)
        x, y = pts[:, 0] - cx, pts[:, 1] - cy
        lx, ly = c * x + s * y, -s * x + c * y
        occ |= (np.abs(lx) <= w / 2) & (np.abs(ly) <= d / 2) & (pts[:, 2] >= 0) & (pts[:, 2] <= h)
    return occ


def iou3d(a, b, rng, n=60000):
    pts = np.c_[rng.uniform(-22, 22, (n, 2)), rng.uniform(0, 18, n)]
    oa, ob = occupancy(a, pts), occupancy(b, pts)
    return float((oa & ob).sum() / max(1, (oa | ob).sum()))


def make_target(rng):
    yaw = rng.uniform(0, np.pi / 2)
    main = [rng.uniform(-4, 4), rng.uniform(-4, 4), rng.uniform(8, 14), rng.uniform(6, 10), rng.uniform(5, 9), yaw]
    annex = [rng.uniform(-8, 8), rng.uniform(-8, 8), rng.uniform(3, 7), rng.uniform(3, 7), rng.uniform(2, 5), yaw]
    tower = [rng.uniform(-8, 8), rng.uniform(-8, 8), rng.uniform(2, 4), rng.uniform(2, 4), rng.uniform(10, 16), rng.uniform(0, np.pi / 2)]
    return np.clip(np.array([main, annex, tower]), LO, HI).ravel()


def init(rng, target, mode):
    x = np.tile(LO, 3) + rng.uniform(0, 1, 18) * np.tile(RANGE, 3)
    if mode == "extract":
        m = target[:6].copy()
        m[2:5] *= 1 + rng.normal(0, 0.02, 3)       # dimensions within ~2%, like extract.py
        m[5] += np.radians(rng.normal(0, 0.5))     # yaw within ~0.5 degrees
        m[:2] += rng.normal(0, 0.3, 2)             # centre within ~0.3 m
        x[:6] = np.clip(m, LO, HI)
    return x


def search(rng, x, cams, tg):
    s = score(x, cams, tg)
    step, fails, trace = 0.15, 0, []
    for ev in range(1, BUDGET + 1):
        j = rng.integers(18)
        y = x.copy()
        y[j] = np.clip(y[j] + rng.normal(0, step * RANGE[j % 6]), LO[j % 6], HI[j % 6])
        sy = score(y, cams, tg)
        if sy >= s:
            if sy > s:
                fails = 0
            x, s = y, sy
        else:
            fails += 1
            if fails >= 80:
                step, fails = max(0.01, step * 0.6), 0
        if ev % 50 == 0:
            trace.append(round(s, 4))
        if s >= STOP_IOU:
            return x, s, ev, trace
    return x, s, None, trace


def run_variant(mode, ncam, seeds):
    rows = []
    for sd in seeds:
        rng = np.random.default_rng(1000 + sd)
        target = make_target(rng)
        cams = cameras(ncam)
        tg = [silhouette(target, c) for c in cams]
        x0 = init(rng, target, mode)
        x, s, ev, trace = search(np.random.default_rng(2000 + sd), x0, cams, tg)
        rows.append(dict(seed=sd, evals=ev, final_sil_iou=round(s, 4), iou3d=round(iou3d(x, target, np.random.default_rng(3000 + sd)), 4), iou3d_start=round(iou3d(x0, target, np.random.default_rng(3000 + sd)), 4), trace=trace))
    reached = [r["evals"] for r in rows if r["evals"] is not None]
    return dict(
        init=mode,
        cameras=ncam,
        reached=len(reached),
        seeds=len(seeds),
        evals_median=float(np.median(reached)) if reached else None,
        evals_all=[r["evals"] for r in rows],
        sil_iou_median=float(np.median([r["final_sil_iou"] for r in rows])),
        iou3d_median=float(np.median([r["iou3d"] for r in rows])),
        iou3d_start_median=float(np.median([r["iou3d_start"] for r in rows])),
        traces=[r["trace"] for r in rows[:3]],
    )


VARIANTS = [(m, c) for m in ("scratch", "extract") for c in (1, 3, 6)]


def main():
    """python3 -I loop.py <variant 0-5> writes loop_<i>.json; python3 -I loop.py merge prints the table."""
    import os

    here = os.path.dirname(os.path.abspath(__file__))
    seeds = list(range(10))
    if len(sys.argv) > 1 and sys.argv[1] == "merge":
        cells = [json.load(open(os.path.join(here, "loop_%d.json" % i))) for i in range(len(VARIANTS))]
        note = "toy: silhouette-IoU local search on 3 oriented boxes; not an LLM measurement; 10 targets per cell; budget %d renders; stop at IoU %.2f" % (BUDGET, STOP_IOU)
        json.dump(dict(note=note, cells=cells), sys.stdout, indent=1)
        return
    i = int(sys.argv[1])
    mode, ncam = VARIANTS[i]
    cell = run_variant(mode, ncam, seeds)
    json.dump(cell, open(os.path.join(here, "loop_%d.json" % i), "w"), indent=1)
    print(mode, ncam, cell["reached"], "/", len(seeds), "median evals", cell["evals_median"], "iou3d", round(cell["iou3d_median"], 3), file=sys.stderr)


if __name__ == "__main__":
    main()
