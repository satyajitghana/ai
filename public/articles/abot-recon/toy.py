"""CPU toys of ABot-Recon's mechanism, re-implemented from reading the released code
(the sandbox would not execute the repository's own modules).

A. windowed vs full-history causal attention over a stream: KV held and ms/frame.
B. 3D RoPE frame axis (fhw=(20,22,22), theta=1e4, float64 angle table like rope3d.py):
   is a (query,key) score the same at frame 11 and at frame 20,000 for the same offset?
C. pose-chain drift: compose noisy adjacent SE(3) increments along a KITTI-02-sized
   trajectory (4,661 frames, ~5.1 km), Sim(3)-align, report ATE for rotation-only and
   translation-only noise of the same "size".
"""
import json, math, sys, time
import numpy as np
import torch

torch.set_num_threads(2)
OUT = sys.argv[1]
res = {}

# ---------------- A ----------------
TPF, D = 64, 64  # toy: 64 tokens per frame, one head of width 64
W = 12


def run(nframes, window):
    torch.manual_seed(0)
    ks, vs = [], []
    times, held = [], []
    for t in range(nframes):
        x = torch.randn(TPF, D)
        q, k, v = x, x * 0.5, x
        ks.append(k)
        vs.append(v)
        if window is not None and len(ks) > window:
            ks.pop(0)
            vs.pop(0)
        t0 = time.perf_counter()
        K = torch.cat(ks)
        V = torch.cat(vs)
        a = torch.softmax(q @ K.T / 8.0, dim=-1) @ V
        times.append(time.perf_counter() - t0)
        held.append(len(ks))
    return times, held


rowsA = []
N = 3000
tw, hw = run(N, W)
tf, hf = run(N, None)
for at in (12, 100, 500, 1000, 2000, 3000):
    sl = slice(max(0, at - 50), at)
    rowsA.append({
        "frame": at,
        "window_frames_held": hw[at - 1],
        "full_frames_held": hf[at - 1],
        "window_ms": round(1e3 * float(np.median(tw[sl])), 3),
        "full_ms": round(1e3 * float(np.median(tf[sl])), 3),
    })
res["A_toy_attention"] = {"tpf": TPF, "dim": D, "window": W, "rows": rowsA}

# real-size arithmetic from the released code
tpf_real = (280 // 14) * (504 // 14) + 5  # 725
layers_global = 36 // 2  # odd decoder blocks attend across frames
bytes_per_frame = layers_global * 2 * tpf_real * 16 * 64 * 2  # K+V, bf16
res["A_real_kv"] = {
    "tokens_per_frame": tpf_real,
    "global_layers": layers_global,
    "bytes_per_frame": bytes_per_frame,
    "MiB_per_frame": round(bytes_per_frame / 2**20, 2),
    "paged_pool_pages": 12 + 16,
    "paged_pool_GiB": round(28 * bytes_per_frame / 2**30, 3),
    "window_11_GiB": round(11 * bytes_per_frame / 2**30, 3),
    "full_history_GiB": {n: round(n * bytes_per_frame / 2**30, 1) for n in (4661, 18846, 22000)},
}

# ---------------- B ----------------
fdim = 20
inv = 1.0 / (10000.0 ** (np.arange(0, fdim, 2, dtype=np.float64) / fdim))


def rot(x, pos, dtype):
    ang = pos * inv  # float64, as rope3d.py builds its table
    c = torch.tensor(np.cos(ang)).to(dtype)
    s = torch.tensor(np.sin(ang)).to(dtype)
    x = x.to(dtype)
    x1, x2 = x[..., 0::2], x[..., 1::2]
    return torch.stack([x1 * c - x2 * s, x1 * s + x2 * c], -1).reshape(x.shape).float()


torch.manual_seed(1)
q = torch.randn(725, fdim)
k = torch.randn(725, fdim)
rowsB = []
for dtype in (torch.float32, torch.bfloat16):
    for d in (1, 6, 11):
        s_early = rot(q, 11, dtype) @ rot(k, 11 - d, dtype).T
        s_late = rot(q, 20000, dtype) @ rot(k, 20000 - d, dtype).T
        s_ref = rot(q.double(), 11, torch.float64) @ rot(k.double(), 11 - d, torch.float64).T
        rowsB.append({
            "dtype": str(dtype).split(".")[-1], "offset": d,
            "max_abs_diff_early_vs_late": float((s_early - s_late).abs().max()),
            "max_abs_err_early_vs_fp64": float((s_early - s_ref.float()).abs().max()),
            "mean_abs_score": float(s_ref.abs().mean()),
        })
res["B_rope"] = {"rows": rowsB}

# ---------------- C ----------------
rng = np.random.default_rng(0)
NF = 4661
step = 5100.0 / NF  # metres per frame


def so3_exp(w):
    th = np.linalg.norm(w)
    if th < 1e-12:
        return np.eye(3)
    kx = np.array([[0, -w[2], w[1]], [w[2], 0, -w[0]], [-w[1], w[0], 0]]) / th
    return np.eye(3) + math.sin(th) * kx + (1 - math.cos(th)) * kx @ kx


# ground truth: drive forward along z with gentle yaw turns
yaw_rate = np.zeros(NF)
for c in rng.integers(200, NF - 200, 12):
    yaw_rate[c - 60:c + 60] += np.deg2rad(90) / 120 * rng.choice([-1, 1])
gt_rel = []
for i in range(NF - 1):
    R = so3_exp(np.array([0, yaw_rate[i], 0]))
    gt_rel.append((R, np.array([0, 0, step])))


def compose(rels):
    R = np.eye(3); t = np.zeros(3); P = [t.copy()]
    for dR, dt in rels:
        t = t + R @ dt
        R = R @ dR
        P.append(t.copy())
    return np.array(P)


def umeyama_ate(P, G):
    mp, mg = P.mean(0), G.mean(0)
    X, Y = P - mp, G - mg
    U, S, Vt = np.linalg.svd(Y.T @ X / len(P))
    Sg = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        Sg[2, 2] = -1
    R = U @ Sg @ Vt
    s = np.trace(np.diag(S) @ Sg) / (X ** 2).sum(1).mean()
    A = s * (R @ X.T).T + mg
    return float(np.sqrt(((A - G) ** 2).sum(1).mean()))


G = compose(gt_rel)


def noisy(rot_deg, trans_frac, seeds=8):
    out = []
    for sd in range(seeds):
        r = np.random.default_rng(100 + sd)
        rels = []
        for dR, dt in gt_rel:
            w = r.normal(0, np.deg2rad(rot_deg), 3)
            n = r.normal(0, trans_frac * step, 3)
            rels.append((dR @ so3_exp(w), dt + n))
        out.append(umeyama_ate(compose(rels), G))
    return float(np.mean(out)), float(np.std(out))


rowsC = []
for rd in (0.0, 0.02, 0.05, 0.1):
    for tf_ in (0.0, 0.05):
        if rd == 0 and tf_ == 0:
            continue
        m, s = noisy(rd, tf_)
        rowsC.append({"rot_noise_deg_per_frame": rd, "trans_noise_frac_of_step": tf_,
                      "ATE_m_mean": round(m, 2), "ATE_m_std": round(s, 2)})


# multi-gap: how error at gap g grows for rotation noise 0.05 deg
def gap_err(rot_deg, gaps, seeds=4):
    out = {g: [] for g in gaps}
    for sd in range(seeds):
        r = np.random.default_rng(200 + sd)
        rels = [(dR @ so3_exp(r.normal(0, np.deg2rad(rot_deg), 3)), dt) for dR, dt in gt_rel]
        P = compose(rels)
        for g in gaps:
            idx = np.arange(0, NF - g, 7)
            e = np.linalg.norm((P[idx + g] - P[idx]) - (G[idx + g] - G[idx]), axis=1)
            out[g].append(float(np.sqrt((e ** 2).mean())))
    return {g: round(float(np.mean(v)), 3) for g, v in out.items()}


res["C_drift"] = {"frames": NF, "metres_per_frame": round(step, 3), "rows": rowsC,
                  "gap_rmse_m_rot0.05": gap_err(0.05, (1, 11, 100, 1000))}


# ---------------- D: one seed's paths, Sim(3)-aligned, every 25th frame ----------------
def aligned(P, G):
    mp, mg = P.mean(0), G.mean(0)
    X, Y = P - mp, G - mg
    U, S, Vt = np.linalg.svd(Y.T @ X / len(P))
    Sg = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        Sg[2, 2] = -1
    R = U @ Sg @ Vt
    s = np.trace(np.diag(S) @ Sg) / (X ** 2).sum(1).mean()
    return s * (R @ X.T).T + mg


def path(rot_deg, trans_frac, seed=100):
    r = np.random.default_rng(seed)
    rels = []
    for dR, dt in gt_rel:
        w = r.normal(0, np.deg2rad(rot_deg), 3)
        n = r.normal(0, trans_frac * step, 3)
        rels.append((dR @ so3_exp(w), dt + n))
    return aligned(compose(rels), G)


def xz(P):
    return [[round(float(p[0]), 1), round(float(p[2]), 1)] for p in P[::25]]


res["D_paths"] = {"gt": xz(G), "rot005": xz(path(0.05, 0.0)), "trans005": xz(path(0.0, 0.05))}
json.dump(res, open(OUT, "w"), indent=1)
print(json.dumps(res, indent=1))
