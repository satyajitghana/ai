"""composition.py (run: python composition.py out.json; numpy only, imports lie.py beside it).
E1: what the composition-aware loss (Eqs 12-14) can see that an adjacent-pair loss cannot.
Rotation errors per step are AR(1) with a fixed marginal std (0.05 deg per axis); only rho changes.
Same KITTI-02-sized drive as toy.py. Reports adjacent loss, composed loss, ATE."""
import json, math, sys
import numpy as np
sys.path.insert(0, __import__('os').path.dirname(__file__))
from lie import so3_exp, angle, ate

NF = 4661; step = 5100.0 / NF
rng = np.random.default_rng(0)
yaw = np.zeros(NF)
for c in rng.integers(200, NF - 200, 12):
    yaw[c - 60:c + 60] += np.deg2rad(90) / 120 * rng.choice([-1, 1])
gtR = [so3_exp(np.array([0, yaw[i], 0])) for i in range(NF - 1)]
gtt = np.tile([0, 0, step], (NF - 1, 1))

def compose(Rs, ts):
    R = np.eye(3); t = np.zeros(3); P = [t.copy()]; Ws = [R]
    for dR, dt in zip(Rs, ts):
        t = t + R @ dt; R = R @ dR; P.append(t.copy()); Ws.append(R)
    return np.array(P), Ws

G, _ = compose(gtR, gtt)
K = 12

def alphas(N, gamma):
    gaps = np.array([j - i for i in range(N) for j in range(i + 1, min(N, i + K))])
    w = gaps.astype(float) ** gamma
    return gaps, w / w.mean()

def ar1(n, rho, sigma, r):
    e = np.zeros((n, 3)); e[0] = r.normal(0, sigma, 3)
    s = sigma * math.sqrt(1 - rho ** 2)
    for i in range(1, n): e[i] = rho * e[i - 1] + r.normal(0, s, 3)
    return e

def comp_loss(errR, N=128, gamma=0.5, clips=30, r=None):
    # rotation term of Eq 14 on random 128-frame clips: geodesic angle of composed predicted vs gt
    gaps, a = alphas(N, gamma)
    pairs = [(i, j) for i in range(N) for j in range(i + 1, min(N, i + K))]
    tot = []; adj = []
    for _ in range(clips):
        s0 = int(r.integers(0, NF - 1 - N))
        pr = [gtR[s0 + k] @ so3_exp(errR[s0 + k]) for k in range(N - 1)]
        g = [gtR[s0 + k] for k in range(N - 1)]
        # prefix products
        Pp = [np.eye(3)]; Pg = [np.eye(3)]
        for k in range(N - 1): Pp.append(Pp[-1] @ pr[k]); Pg.append(Pg[-1] @ g[k])
        ang = np.array([angle((Pg[i].T @ Pg[j]).T @ (Pp[i].T @ Pp[j])) for i, j in pairs])
        tot.append(float((a * ang).mean())); adj.append(float(ang[gaps == 1].mean()))
    return float(np.degrees(np.mean(adj))), float(np.degrees(np.mean(tot)))

sig = np.deg2rad(0.05)
rows = []
for rho in (-0.5, 0.0, 0.5, 0.9, 0.98):
    A = []; La = []; Lc = []
    for sd in range(6):
        r = np.random.default_rng(300 + sd)
        e = ar1(NF - 1, rho, sig, r)
        P, _ = compose([g @ so3_exp(x) for g, x in zip(gtR, e)], gtt)
        A.append(ate(P, G))
        la, lc = comp_loss(e, r=r); La.append(la); Lc.append(lc)
    rows.append({"rho": rho, "adj_loss_deg": round(np.mean(La), 4), "comp_loss_deg": round(np.mean(Lc), 4),
                 "ATE_m": round(float(np.mean(A)), 2), "ATE_std": round(float(np.std(A)), 2)})
    print(rows[-1], flush=True)

# weight per gap under Eq 13
wt = {}
for N in (32, 128):
    for gamma in (0.25, 0.5, 0.75):
        gaps, a = alphas(N, gamma)
        wt[f"N{N}_g{gamma}"] = {"pairs": int(len(gaps)), "frac_pairs_gap1": round(float((gaps == 1).mean()), 3),
                                "alpha_gap1": round(float(a[gaps == 1][0]), 3), "alpha_gap11": round(float(a[gaps == 11][0]), 3),
                                "rot_weight_share_gap1": round(float(a[gaps == 1].sum() / a.sum()), 3)}
json.dump({"sigma_deg": 0.05, "rows": rows, "alpha": wt}, open(sys.argv[1], "w"), indent=1)
print(json.dumps(wt, indent=1))
