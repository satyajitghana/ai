"""loop_closure_toy.py (run: python loop_closure_toy.py out.json; numpy only, imports lie.py beside it).
E2: ABot-Recon's loop-closure back end, re-implemented on CPU from loop_closure.py,
sparse_loop/{retrieval,sparse_keyframes,graph,gpu_pgo}.py (commit 6e3b2e1).
Released defaults kept: min_frame_separation 30, nms_radius 25, max_reinfer_candidates 50,
pose_graph_keyframe_stride 50, loop weight 0.01*sqrt(default_inliers 128 / rigid_min_inliers 24),
odometry weight 1, trans/rot weight 1, LM 30 iters, lambda 1e-6 halve/double, node 0 fixed,
residual Log(Z @ Exp(x_src) @ Exp(x_dst)^-1) on w2c log-coordinates, slerp/linear correction
interpolation to every frame. Not re-implemented: SALAD retrieval (candidates come from ground-truth
positions) and the re-inference (loop measurement = truth + small noise, an assumption)."""
import json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lie import so3_exp, so3_log, se3_exp, se3_log, inv, ate

STEP = 1.094
def route():
    # KITTI-00-like: one rectangular loop (1,300 m x 900 m), then 640 frames back over the start.
    legs = [1300, 900, 1300, 900]
    yaw = []
    for L in legs:
        n = int(round(L / STEP)); yaw += [0.0] * (n - 60) + [np.deg2rad(90) / 60] * 60
    yaw += [0.0] * 4661
    return np.array(yaw[:4660])
YAW = route(); NF = len(YAW) + 1

def chain(rels):
    T = np.eye(4); out = [T]
    for d in rels: T = T @ d; out.append(T)
    return np.array(out)

def rel(yaw, dt):
    T = np.eye(4); T[:3, :3] = so3_exp(np.array([0, yaw, 0])); T[:3, 3] = dt; return T

GT_REL = [rel(y, [0, 0, STEP]) for y in YAW]
GT = chain(GT_REL)
Gp = GT[:, :3, 3]

def candidates(r, sep=30, nms=25, cap=50, radius=4.0):
    # every frame's nearest earlier frame at least `sep` away; score falls with distance (stand-in for SALAD)
    cands = []
    for i in range(NF):
        j0 = i - sep - 1
        if j0 < 0: continue
        d = np.linalg.norm(Gp[:j0 + 1] - Gp[i], axis=1); j = int(d.argmin())
        if d[j] < radius:
            score = 0.95 - 0.02 * d[j] + r.normal(0, 0.01)
            if score > 0.85: cands.append((score, i, j))
    cands.sort(reverse=True)
    kept, sup = [], set()
    maxpos = max(max(c[1], c[2]) for c in cands) if cands else 0
    for s, hi, lo in cands:
        if lo in sup or hi in sup: continue
        kept.append((hi, lo)); sup.update(range(max(0, lo - nms), min(lo + nms + 1, hi)))
        sup.update(range(max(lo + 1, hi - nms), min(hi + nms + 1, maxpos + 1)))
        if len(kept) >= cap: break
    return kept, len(cands)

def Z(src, dst):  # relative_measurement(source_c2w, destination_c2w)
    return inv(dst) @ src

def pgo(poses, edges, weights, iters=30, lam=1e-6):
    n = len(poses); x = np.array([se3_log(inv(P)) for P in poses])
    def res(x):
        out = []
        for (s, d, M), w in zip(edges, weights):
            out.append(w * se3_log(M @ se3_exp(x[s]) @ inv(se3_exp(x[d]))))
        return np.concatenate(out)
    cost = lambda x: float((res(x) ** 2).mean())
    for _ in range(iters):
        r0 = res(x); J = np.zeros((len(r0), 6 * n)); eps = 1e-6
        for e, ((s, d, M), w) in enumerate(zip(edges, weights)):
            for node in (s, d):
                if node == 0: continue
                for k in range(6):
                    xp = x.copy(); xp[node, k] += eps; xm = x.copy(); xm[node, k] -= eps
                    rp = w * se3_log(M @ se3_exp(xp[s]) @ inv(se3_exp(xp[d])))
                    rm = w * se3_log(M @ se3_exp(xm[s]) @ inv(se3_exp(xm[d])))
                    J[6 * e:6 * e + 6, 6 * node + k] = (rp - rm) / (2 * eps)
        J = J[:, 6:]
        H = J.T @ J; g = J.T @ r0
        dx = -np.linalg.solve(H + lam * np.diag(np.diag(H)) + 1e-12 * np.eye(len(H)), g)
        xn = x.copy(); xn[1:] += dx.reshape(-1, 6)
        if cost(xn) <= cost(x) + 1e-12: x = xn; lam = max(lam / 2, 1e-12)
        else: lam = min(lam * 2, 1e8)
    return np.array([inv(se3_exp(v)) for v in x])

def slerp_interp(base, kf, opt):
    corr = np.array([o @ inv(base[k]) for o, k in zip(opt, kf)])
    out = np.empty_like(base)
    for a in range(len(kf) - 1):
        ka, kb = kf[a], kf[a + 1]; Ra, Rb = corr[a][:3, :3], corr[b := a + 1][:3, :3]
        w = so3_log(Ra.T @ Rb)
        for f in range(ka, kb + 1):
            u = (f - ka) / (kb - ka); C = np.eye(4)
            C[:3, :3] = Ra @ so3_exp(u * w); C[:3, 3] = (1 - u) * corr[a][:3, 3] + u * corr[b][:3, 3]
            out[f] = C @ base[f]
    out[kf] = opt
    return out

def loop_close(base, loops, lw, stride=50, meas_noise=(0.05, 0.05), r=None, false_loops=()):
    kf = sorted(set(range(0, NF, stride)) | {0, NF - 1} | {i for e in loops for i in e} | {i for e in false_loops for i in e})
    node = {f: k for k, f in enumerate(kf)}
    P = base[kf]
    edges = [(k - 1, k, Z(P[k - 1], P[k])) for k in range(1, len(kf))]
    w = [1.0] * len(edges)
    for hi, lo in loops:
        M = Z(GT[hi], GT[lo]); N = np.eye(4)
        N[:3, :3] = so3_exp(r.normal(0, np.deg2rad(meas_noise[0]), 3)); N[:3, 3] = r.normal(0, meas_noise[1], 3)
        edges.append((node[hi], node[lo], M @ N)); w.append(lw)
    for hi, lo in false_loops:  # perceptual aliasing: re-inference says "same place" (identity)
        edges.append((node[hi], node[lo], np.eye(4))); w.append(lw)
    opt = pgo(P, edges, w)
    return slerp_interp(base, np.array(kf), opt), len(kf)

def drifted(seed, rot_deg=0.05, trans_frac=0.02):
    r = np.random.default_rng(seed); rels = []
    for d in GT_REL:
        N = np.eye(4); N[:3, :3] = so3_exp(r.normal(0, np.deg2rad(rot_deg), 3)); N[:3, 3] = r.normal(0, trans_frac * STEP, 3)
        rels.append(d @ N)
    return chain(rels)

W0 = 0.01 * math.sqrt(128 / 24)
out = {"frames": NF, "W0": W0, "rows": []}
SEEDS = (500, 501, 502, 503)
r0 = np.random.default_rng(1)
loops, ncand = candidates(r0)
out["n_raw_candidates"] = ncand; out["n_kept"] = len(loops); out["loops"] = loops
print("candidates", ncand, "kept", len(loops), loops[:5], flush=True)
configs = [("none", None, None, ()), ("default", W0, None, ()), ("w0.1", 0.1 * math.sqrt(128 / 24), None, ()),
           ("w1", 1.0 * math.sqrt(128 / 24), None, ()), ("default_1edge", W0, 1, ()), ("default_5edges", W0, 5, ()),
           ("w1_1edge", 1.0 * math.sqrt(128 / 24), 1, ()),
           ("default_false", W0, None, ((2300, 900),)), ("w1_false", 1.0 * math.sqrt(128 / 24), None, ((2300, 900),))]
paths = {}
for name, lw, nl, fl in configs:
    vals = []
    for sd in SEEDS:
        base = drifted(sd)
        if lw is None: est = base
        else:
            L = loops if nl is None else loops[:nl]
            est, nk = loop_close(base, L, lw, r=np.random.default_rng(sd + 1000), false_loops=fl)
        vals.append(ate(est[:, :3, 3], Gp))
        if sd == SEEDS[0] and name in ("none", "default", "w1", "w1_false"):
            paths[name] = [[round(float(p[0]), 1), round(float(p[2]), 1)] for p in
                           __import__("lie").umeyama(est[:, :3, 3], Gp)[::25]]
    row = {"config": name, "loop_weight": lw, "edges": (len(loops) if nl is None else nl) if lw else 0,
           "false_edges": len(fl), "ATE_m": round(float(np.mean(vals)), 2), "ATE_std": round(float(np.std(vals)), 2)}
    out["rows"].append(row); print(row, flush=True)
paths["gt"] = [[round(float(p[0]), 1), round(float(p[2]), 1)] for p in Gp[::25]]
out["paths"] = paths
json.dump(out, open(sys.argv[1], "w"))
