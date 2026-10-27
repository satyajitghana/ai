#!/usr/bin/env python3
"""A simplified two-level pose graph on synthetic chunked trajectories.

NOT the HiP3R code. A re-implementation of the idea in arXiv 2610.31635 sec. 3
(chunk-level Sim(3) graph, then one shared SE(3) camera per frame) on a
simulated backend whose errors we control, so ground truth is known.

    python3 chunkgraph.py --seeds 10 --out results.json

needs numpy + scipy; CPU only; about a minute per seed on one thread.
"""
import argparse, json, time
import numpy as np
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix
from scipy.spatial.transform import Rotation as Rot

T, C, O = 800, 40, 20  # frames, chunk size, overlap (paper: 60 / 30)
NPT = 12  # simulated "pointmap" points per frame


# ---------------------------------------------------------------- ground truth
def gt_path():
    """Two laps of a closed loop, 1 m a frame, gentle height change. Returns R (T,3,3), c (T,3)."""
    u = np.linspace(0, 4 * np.pi, T, endpoint=False)  # two laps
    rad = 64.0
    c = np.stack([rad * np.cos(u) * (1 + 0.25 * np.sin(2 * u)), rad * np.sin(u), 3 * np.sin(3 * u)], 1)
    d = np.gradient(c, axis=0)
    f = d / np.linalg.norm(d, axis=1, keepdims=True)
    up = np.array([0, 0, 1.0])
    r = np.cross(f, up); r /= np.linalg.norm(r, axis=1, keepdims=True)
    dn = np.cross(f, r)
    R = np.stack([r, dn, f], 2)  # camera-to-world, columns = camera axes
    return R, c


def chunks():
    out, s = [], 0
    while True:
        out.append(np.arange(s, min(s + C, T)))
        if s + C >= T:
            break
        s += C - O
    return out


# ------------------------------------------------------------------ sim(3) maths
def rv(R):
    return Rot.from_matrix(R).as_rotvec()


def umeyama(src, dst, w=None):
    """Sim(3) (s, R, t) with dst ~ s R src + t."""
    w = np.ones(len(src)) if w is None else w
    w = w / w.sum()
    mu_s, mu_d = (w[:, None] * src).sum(0), (w[:, None] * dst).sum(0)
    xs, xd = src - mu_s, dst - mu_d
    S = (w[:, None] * xd).T @ xs
    U, D, Vt = np.linalg.svd(S)
    E = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        E[2, 2] = -1
    R = U @ E @ Vt
    var = (w * (xs ** 2).sum(1)).sum()
    s = (D * np.diag(E)).sum() / var
    return s, R, mu_d - s * R @ mu_s


def sim_inv(a):
    s, R, t = a
    return 1 / s, R.T, -R.T @ t / s


def sim_mul(b, a):  # b o a
    sb, Rb, tb = b
    sa, Ra, ta = a
    return sb * sa, Rb @ Ra, sb * Rb @ ta + tb


def unpack(x):
    return [(np.exp(x[7 * k + 6]), Rot.from_rotvec(x[7 * k:7 * k + 3]).as_matrix(), x[7 * k + 3:7 * k + 6])
            for k in range(len(x) // 7)]


def pack(A):
    return np.concatenate([np.concatenate([rv(R), t, [np.log(s)]]) for s, R, t in A])


# ----------------------------------------------------------- the simulated backend
def simulate(rng, Rg, cg, ch, p):
    """Per chunk: predicted camera poses and point maps in an arbitrary local frame with errors.

    Errors: random Sim(3) local frame (not an error, just the gauge), per-frame rotation random walk
    inside the chunk, per-frame iid pose noise, a scale that drifts linearly inside the chunk, and
    depth noise on the points. Each frame sees the same NPT world points whichever chunk predicts it.
    """
    pts_cam = np.stack([rng.uniform(-6, 6, (T, NPT)), rng.uniform(-3, 3, (T, NPT)), rng.uniform(6, 25, (T, NPT))], 2)
    Xw = np.einsum('tij,tpj->tpi', Rg, pts_cam) + cg[:, None, :]
    true_A, preds = [], []
    for k, idx in enumerate(ch):
        w = np.exp(rng.normal(0, 0.4))
        Rk = Rot.random(random_state=int(rng.integers(1 << 31))).as_matrix()
        ok = cg[idx[0]] + rng.normal(0, 30, 3)
        A = (w, Rk, ok)  # local -> world
        true_A.append(A)
        Ai = sim_inv(A)
        n = len(idx)
        walk = np.cumsum(rng.normal(0, p['rot_walk'], (n, 3)), 0)  # rad
        walk -= walk[0]
        eps = rng.normal(0, p['scale_drift'])
        P_R, P_c, X = [], [], []
        for j, t in enumerate(idx):
            u = j / (n - 1)
            e = Rot.from_rotvec(walk[j] + rng.normal(0, p['rot_noise'], 3)).as_matrix()
            Rw = Rg[t] @ e  # erroneous camera in world
            cw = cg[t] + rng.normal(0, p['trans_noise'], 3)
            sl = 1 + eps * u
            # to local frame, then scale drift applied about the chunk's first camera
            s_, R_, t_ = Ai
            Rl = R_ @ Rw
            cl = (s_ * R_ @ cw + t_) * sl
            d = rng.normal(1, p['depth_noise'], NPT)
            # point = camera centre + rotated cam-frame point, in local coords (scaled with the same sl)
            Xl = cl[None] + sl * s_ * (Rl @ (pts_cam[t] * d[:, None]).T).T
            P_R.append(Rl); P_c.append(cl); X.append(Xl)
        preds.append(dict(idx=idx, R=np.array(P_R), c=np.array(P_c), X=np.array(X),
                          s_eff=np.array([w / (1 + eps * j / (n - 1)) for j in range(n)]),
                          Xw=Xw[idx]))  # s_eff: true local->world scale per frame; Xw: true world points (used by chunkgraph_ext.py only)
    return true_A, preds


# ------------------------------------------------------------ stage I: chunk graph
def overlap_measure(preds, k, rng, p):
    """Z_k: Sim(3) taking chunk k's local coordinates to chunk k+1's, from the shared frames' points."""
    a, b = preds[k], preds[k + 1]
    common = np.intersect1d(a['idx'], b['idx'])
    ia = np.searchsorted(a['idx'], common); ib = np.searchsorted(b['idx'], common)
    S = a['X'][ia].reshape(-1, 3); D = b['X'][ib].reshape(-1, 3)
    # sample at most 200 correspondences (the paper bounds this too), IRLS with Huber weights
    sel = rng.choice(len(S), min(200, len(S)), replace=False)
    S, D = S[sel], D[sel]
    w = np.ones(len(S))
    for _ in range(5):
        z = umeyama(S, D, w)
        r = np.linalg.norm(D - (z[0] * (S @ z[1].T) + z[2]), axis=1)
        d = max(np.median(r), 1e-6) * 1.5
        w = np.where(r < d, 1.0, d / r)
    return z


def chain_init(Z):
    A = [(1.0, np.eye(3), np.zeros(3))]
    for z in Z:  # A_{k+1} = A_k o Z_k^{-1}
        A.append(sim_mul(A[-1], sim_inv(z)))
    return A


def edge_res(Ai, Aj, Zij):
    rel = sim_mul(sim_inv(Aj), Ai)
    E = sim_mul(sim_inv(Zij), rel)
    # translation in metres of the current estimate (chunk j's scale), so chunks of different gauge scale weigh alike
    return np.concatenate([rv(E[1]) / 0.01, E[2] * Aj[0] / 0.5, [np.log(E[0]) / 0.02]])


def solve_layout(A0, edges, huber=3.0):
    """edges: list of (i, j, Z, weight). Chunk 0 fixed. Robust least squares, sparse Jacobian."""
    K = len(A0)
    x0 = pack(A0)[7:]

    def f(x):
        A = [A0[0]] + unpack(x)
        return np.concatenate([np.sqrt(w) * edge_res(A[i], A[j], Z) for i, j, Z, w in edges])

    n = 7 * len(edges)
    sp = lil_matrix((n, len(x0)), dtype=int)
    for e, (i, j, _, _) in enumerate(edges):
        for kk in (i, j):
            if kk > 0:
                sp[7 * e:7 * e + 7, 7 * (kk - 1):7 * kk] = 1
    r = least_squares(f, x0, jac_sparsity=sp, loss='huber', f_scale=huber, x_scale='jac', max_nfev=200)
    return [A0[0]] + unpack(r.x)


def progressive(A0, seq_edges, loop_edges, stages=3):
    """Adjacent edges always on; loops enter in order of increasing temporal span, a third at a time."""
    loop_edges = sorted(loop_edges, key=lambda e: abs(e[0] - e[1]))
    A = A0
    for s in range(1, stages + 1):
        take = loop_edges[:int(np.ceil(len(loop_edges) * s / stages))]
        A = solve_layout(A, seq_edges + take)
    return A


# ----------------------------------------------------- stage II: shared camera graph
def place(A, preds):
    """Q_{k,i}: each prediction in the world frame (eq. 3)."""
    Q = []
    for k, pr in enumerate(preds):
        s, R, t = A[k]
        Q.append((np.einsum('ij,njk->nik', R, pr['R']), s * (pr['c'] @ R.T) + t))
    return Q


def layout_traj(Q, preds):
    """First available prediction per frame, chunk order."""
    Rt, ct = np.zeros((T, 3, 3)), np.zeros((T, 3))
    seen = np.zeros(T, bool)
    for (R, c), pr in zip(Q, preds):
        for j, t in enumerate(pr['idx']):
            if not seen[t]:
                Rt[t], ct[t], seen[t] = R[j], c[j], True
    return Rt, ct


def refine(Q, preds, mode, sig_t=0.2, sig_r=0.01):
    """One SE(3) variable per frame. mode: 'shared' (priors + motion), 'unary', 'motion'."""
    R0, c0 = layout_traj(Q, preds)
    x0 = np.concatenate([np.stack([rv(R0[t]) for t in range(T)]).ravel(), c0.ravel()])
    pri = [(k, j, t) for k, pr in enumerate(preds) for j, t in enumerate(pr['idx'])]
    mot = [(k, j, pr['idx'][j], pr['idx'][j + 1]) for k, pr in enumerate(preds) for j in range(len(pr['idx']) - 1)]
    use_p = mode in ('shared', 'unary')
    use_m = mode in ('shared', 'motion')
    QR = [q[0] for q in Q]; Qc = [q[1] for q in Q]

    def f(x):
        Fr = Rot.from_rotvec(x[:3 * T].reshape(T, 3)); Fc = x[3 * T:].reshape(T, 3)
        out = []
        if use_p:
            k_, j_, t_ = map(np.array, zip(*pri))
            qR = Rot.from_matrix(np.array([QR[k][j] for k, j in zip(k_, j_)]))
            qc = np.array([Qc[k][j] for k, j in zip(k_, j_)])
            rr = (qR.inv() * Fr[t_]).as_rotvec() / sig_r
            tt = qR.inv().apply(Fc[t_] - qc) / sig_t
            out += [rr.ravel(), tt.ravel()]
        if use_m:
            k_, j_, a_, b_ = map(np.array, zip(*mot))
            qa = Rot.from_matrix(np.array([QR[k][j] for k, j in zip(k_, j_)]))
            qb = Rot.from_matrix(np.array([QR[k][j + 1] for k, j in zip(k_, j_)]))
            ca = np.array([Qc[k][j] for k, j in zip(k_, j_)])
            cb = np.array([Qc[k][j + 1] for k, j in zip(k_, j_)])
            # relative motion from frame a to b, in a's camera frame: measured vs estimated
            mr = qa.inv() * qb; mt = qa.inv().apply(cb - ca)
            er = Fr[a_].inv() * Fr[b_]; et = Fr[a_].inv().apply(Fc[b_] - Fc[a_])
            rr = (mr.inv() * er).as_rotvec() / sig_r
            tt = mr.inv().apply(et - mt) / sig_t
            out += [rr.ravel(), tt.ravel()]
        return np.concatenate(out)

    m0 = f(x0).size
    # sparsity pattern: residual blocks are ordered rotations then translations, per item
    sp = lil_matrix((m0, x0.size), dtype=int)
    row = 0
    def block(items, getcols):
        nonlocal row
        for it in items:
            sp[row:row + 3, getcols(it)] = 1
            row += 3
    def cols_p(it):
        t = it[2]
        return [3 * t + i for i in range(3)] + [3 * T + 3 * t + i for i in range(3)]
    def cols_m(it):
        a, b = it[2], it[3]
        return [3 * a + i for i in range(3)] + [3 * b + i for i in range(3)] + \
               [3 * T + 3 * a + i for i in range(3)] + [3 * T + 3 * b + i for i in range(3)]
    if use_p:
        block(pri, cols_p); block(pri, cols_p)
    if use_m:
        block(mot, cols_m); block(mot, cols_m)
    # motion-only has six free gauge dof; the Huber loss and x_scale keep the solve well posed.
    r = least_squares(f, x0, jac_sparsity=sp, loss='huber', f_scale=1.5, x_scale='jac', max_nfev=15)
    Fr = Rot.from_rotvec(r.x[:3 * T].reshape(T, 3)).as_matrix()
    return Fr, r.x[3 * T:].reshape(T, 3)


# ----------------------------------------------------------------------- metrics
def metrics(Rg, cg, Re, ce):
    s, R, t = umeyama(ce, cg)
    ca = s * ce @ R.T + t
    Ra = np.einsum('ij,njk->nik', R, Re)
    ate = float(np.sqrt(((ca - cg) ** 2).sum(1).mean()))
    # relative errors, delta = 1 frame, in the camera frame of frame t
    def rel(Rm, cm):
        return np.stack([Rm[t].T @ (cm[t + 1] - cm[t]) for t in range(T - 1)])
    rot = []
    for t in range(T - 1):
        e = (Rg[t].T @ Rg[t + 1]).T @ (Ra[t].T @ Ra[t + 1])
        rot.append(np.degrees(np.linalg.norm(rv(e))))
    tg, te = rel(Rg, cg), rel(Ra, ca)
    return dict(ate=ate, rpe_rot=float(np.mean(rot)), rpe_trans=float(np.linalg.norm(te - tg, axis=1).mean())), ca


def loops_from_truth(true_A, ch, preds, Rg, cg, rng, p):
    """Loop candidates: chunk pairs >= 150 frames apart whose middle frames are within 8 m, one per
    chunk. Stands in for place recognition + joint-window inference (paper sec. 3.2): it hands the
    graph the relative pose G between the two revisit frames (truth plus noise), and the Sim(3)
    between the two chunks' local frames is then solved so that THEIR OWN predicted cameras at those
    frames obey it. A fraction of candidates are false matches (large random G error)."""
    mid = [len(c) // 2 for c in ch]
    pairs = []
    for i in range(len(ch)):
        for j in range(i + 1, len(ch)):
            ti, tj = ch[i][mid[i]], ch[j][mid[j]]
            if tj - ti >= 150 and np.linalg.norm(cg[ti] - cg[tj]) < 8:
                pairs.append((i, j))
    used, keep = set(), []
    for i, j in pairs:
        if i in used or j in used:
            continue
        used |= {i, j}
        keep.append((i, j))
    out = []
    for i, j in keep:
        ti, tj = ch[i][mid[i]], ch[j][mid[j]]
        bad = rng.random() < p['false_loop']
        Gr = Rg[ti].T @ Rg[tj] @ Rot.from_rotvec(rng.normal(0, np.radians(0.3 if not bad else 20), 3)).as_matrix()
        Gt = Rg[ti].T @ (cg[tj] - cg[ti]) + rng.normal(0, 0.5 if not bad else 20, 3)
        si, sj = preds[i]['s_eff'][mid[i]], preds[j]['s_eff'][mid[j]]
        sz = (si / sj) * np.exp(rng.normal(0, 0.005))
        Rpi, cpi = preds[i]['R'][mid[i]], preds[i]['c'][mid[i]]
        Rpj, cpj = preds[j]['R'][mid[j]], preds[j]['c'][mid[j]]
        Rz = Rpj @ Gr.T @ Rpi.T
        qi = cpi + Rpi @ Gt / si  # where frame tj's camera sits in chunk i's local frame
        out.append((i, j, (sz, Rz, cpj - sz * Rz @ qi), 1.0, bad))
    return out


def run(seed, p, keep_traj=False):
    rng = np.random.default_rng(seed)
    Rg, cg = gt_path()
    ch = chunks()
    true_A, preds = simulate(rng, Rg, cg, ch, p)
    Z = [overlap_measure(preds, k, rng, p) for k in range(len(ch) - 1)]
    A_chain = chain_init(Z)
    seq = [(k, k + 1, Z[k], 1.0) for k in range(len(ch) - 1)]
    lp = loops_from_truth(true_A, ch, preds, Rg, cg, rng, p)
    loops = [(i, j, z, w) for i, j, z, w, _ in lp]
    res, trajs = {}, {}
    def record(name, Re, ce):
        m, ca = metrics(Rg, cg, Re, ce)
        res[name] = m
        if keep_traj:
            trajs[name] = ca[::4].round(2).tolist()
    t0 = time.time()
    record('1 chain', *layout_traj(place(A_chain, preds), preds))
    A_all = solve_layout(A_chain, seq + loops)
    record('2 + loops, all at once', *layout_traj(place(A_all, preds), preds))
    A_prog = progressive(A_chain, seq, loops)
    Qp = place(A_prog, preds)
    record('3 + loops, progressive', *layout_traj(Qp, preds))
    for mode in ('unary', 'motion', 'shared'):
        record('4 ' + mode, *refine(Qp, preds, mode))
    res['_meta'] = dict(chunks=len(ch), loops=len(lp), false_loops=int(sum(b for *_, b in lp)), secs=round(time.time() - t0, 1))
    if keep_traj:
        res['_gt'] = cg[::4].round(2).tolist()
        res['_traj'] = trajs
        # per-frame error of each chunk's placed prediction vs the shared camera, in one overlap
        Fr, Fc = refine(Qp, preds, 'shared')
        k = 14
        a, b = preds[k], preds[k + 1]
        common = np.intersect1d(a['idx'], b['idx'])
        ia = np.searchsorted(a['idx'], common); ib = np.searchsorted(b['idx'], common)
        s, R, t = umeyama(Fc, cg)
        al = lambda c: s * c @ R.T + t
        res['_overlap'] = dict(k=k, frames=common.tolist(),
                               chunk_a=np.linalg.norm(al(Qp[k][1][ia]) - cg[common], axis=1).round(3).tolist(),
                               chunk_b=np.linalg.norm(al(Qp[k + 1][1][ib]) - cg[common], axis=1).round(3).tolist(),
                               shared=np.linalg.norm(al(Fc[common]) - cg[common], axis=1).round(3).tolist(),
                               gap=np.linalg.norm(Qp[k][1][ia] - Qp[k + 1][1][ib], axis=1).round(3).tolist())
    return res


PARAMS = dict(rot_walk=np.radians(0.12), rot_noise=np.radians(0.08), trans_noise=0.04, scale_drift=0.03,
              depth_noise=0.01, false_loop=0.0)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--seeds', type=int, default=5)
    ap.add_argument('--false-loop', type=float, default=0.0)
    ap.add_argument('--drift', type=float, default=1.0, help='multiplies rot_walk and scale_drift')
    ap.add_argument('--out', default='results.json')
    a = ap.parse_args()
    p = dict(PARAMS, false_loop=a.false_loop)
    p['rot_walk'] *= a.drift; p['scale_drift'] *= a.drift
    allr = []
    for s in range(a.seeds):
        r = run(s, p, keep_traj=(s == 0))
        allr.append(r)
        print(s, {k: round(v['ate'], 2) for k, v in r.items() if not k.startswith('_')}, r['_meta'], flush=True)
    names = [k for k in allr[0] if not k.startswith('_')]
    summ = {n: {m: [float(np.mean([r[n][m] for r in allr])), float(np.min([r[n][m] for r in allr])), float(np.max([r[n][m] for r in allr]))]
                for m in ('ate', 'rpe_rot', 'rpe_trans')} for n in names}
    json.dump(dict(params={k: float(v) for k, v in p.items()}, T=T, C=C, O=O, seeds=a.seeds, summary=summ, first=allr[0],
                   meta=[r['_meta'] for r in allr]), open(a.out, 'w'))
    for n in names:
        print(f"{n:28s}", *[f"{m}={summ[n][m][0]:.4g} [{summ[n][m][1]:.3g},{summ[n][m][2]:.3g}]" for m in summ[n]])
