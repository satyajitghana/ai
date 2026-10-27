#!/usr/bin/env python3
"""Extensions to chunkgraph.py after reading the authors' code (HiP3Rs/HiP3R, commit a46f185).

NOT the HiP3R code. Three things the first version lacked, re-implemented from reading
`long_reconstruction/{runner,postprocess,hierarchical_pose_graph}.py`:

  1. loop edges built the way the authors build them: a "joint" prediction over a 20-frame window
     around each revisit, registered to each chunk's own prediction of that window, edge = the
     composition of the two Sim(3) fits (postprocess.estimate_loop_edge), with a bounded weight
     1 / (1 + r / 0.05) clipped to [0.05, 1] from the registration residual (residual_edge_weight);
  2. a keyframe subgraph for the per-frame stage (uniform stride 5, chunk ends, >= 3 per overlap),
     corrections interpolated back to the other frames (hierarchical_pose_graph._select_keyframes);
  3. a synthetic place-recognition model with a controlled number of false positives.

    python3 chunkgraph_ext.py --seeds 6 --out ext.json

needs numpy + scipy; CPU only. Imports chunkgraph.py from the same directory.
"""
import argparse, json, time
import numpy as np
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix
from scipy.spatial.transform import Rotation as Rot, Slerp

import chunkgraph as cg_
from chunkgraph import (T, C, O, PARAMS, gt_path, chunks, simulate, overlap_measure, chain_init, progressive,
                        place, layout_traj, refine, metrics, umeyama, sim_inv, sim_mul, rv)

WIN = 20  # loop window, frames (the authors' preset: loop_window_size=20)


# ------------------------------------------------------------ authors-style loop edge
def fit(S, D):
    """Huber-IRLS Sim(3) S -> D, same recipe as overlap_measure; also returns the p95 residual."""
    w = np.ones(len(S))
    for _ in range(5):
        z = umeyama(S, D, w)
        r = np.linalg.norm(D - (z[0] * (S @ z[1].T) + z[2]), axis=1)
        d = max(np.median(r), 1e-6) * 1.5
        w = np.where(r < d, 1.0, d / r)
    return z, float(np.percentile(r, 95))


def window(n, mid):
    s = max(0, min(mid - WIN // 2, n - WIN))
    return np.arange(s, s + WIN)


def joint_edge(rng, preds, ch, Rg, cg, i, j, false_mode=None, noise=0.2):
    """Edge i -> j from a simulated joint prediction over the two windows.

    The joint model sees both windows in one pass and returns their points in its own frame. For a
    true revisit it returns the true world points plus `noise` metres of point error. For a false
    place-recognition hit (`false_mode`) it believes the two places overlap: window B is overlaid on
    window A with a random yaw (sd 15 deg) and 2 m of slack. 'coherent' keeps the points rigid (the
    registration residual stays small); 'incoherent' also jitters B's points by 1.5 m (the joint model
    could not make the views agree, so the residual rises). Both are my assumptions, not measurements.
    Returns (i, j, Z, weight, residual)."""
    ai = window(len(ch[i]), len(ch[i]) // 2); bj = window(len(ch[j]), len(ch[j]) // 2)
    XA, XB = preds[i]['Xw'][ai].reshape(-1, 3).copy(), preds[j]['Xw'][bj].reshape(-1, 3).copy()
    if false_mode:
        ca, cb = cg[ch[i][ai]].mean(0), cg[ch[j][bj]].mean(0)
        yaw = Rot.from_rotvec([0, 0, rng.normal(0, np.radians(15))]).as_matrix()
        XB = (XB - cb) @ yaw.T + ca + rng.normal(0, 2.0, 3)
    XA += rng.normal(0, noise, XA.shape)
    XB += rng.normal(0, 1.5 if false_mode == 'incoherent' else noise, XB.shape)
    s = np.exp(rng.normal(0, 0.4)); R = Rot.random(random_state=int(rng.integers(1 << 31))).as_matrix(); t = rng.normal(0, 30, 3)
    J = lambda X: s * X @ R.T + t
    LA = preds[i]['X'][ai].reshape(-1, 3); LB = preds[j]['X'][bj].reshape(-1, 3)
    za, ra = fit(J(XA), LA); zb, rb = fit(J(XB), LB)
    Z = sim_mul(zb, sim_inv(za))  # chunk i local -> chunk j local
    rad = lambda L: float(np.median(np.linalg.norm(L - L.mean(0), axis=1)))
    r = max(ra / rad(LA), rb / rad(LB))
    return i, j, Z, float(np.clip(1.0 / (1.0 + r / 0.05), 0.05, 1.0)), r


# --------------------------------------------------------------- place recognition
def true_pairs(ch, cg):
    mid = [len(c) // 2 for c in ch]
    pairs = [(i, j) for i in range(len(ch)) for j in range(i + 1, len(ch))
             if ch[j][mid[j]] - ch[i][mid[i]] >= 150 and np.linalg.norm(cg[ch[i][mid[i]]] - cg[ch[j][mid[j]]]) < 8]
    used, keep = set(), []
    for i, j in pairs:
        if i in used or j in used:
            continue
        used |= {i, j}; keep.append((i, j))
    return keep


def retrieve(rng, ch, cg, recall, fp_per_true):
    """Synthetic retrieval: each true loop is returned with probability `recall`; then
    round(fp_per_true * n_returned_true) pairs from different places (>= 25 m apart, >= 150 frames apart) are added."""
    tp = [p for p in true_pairs(ch, cg) if rng.random() < recall]
    mid = [len(c) // 2 for c in ch]
    far = [(i, j) for i in range(len(ch)) for j in range(i + 1, len(ch))
           if ch[j][mid[j]] - ch[i][mid[i]] >= 150 and np.linalg.norm(cg[ch[i][mid[i]]] - cg[ch[j][mid[j]]]) > 25]
    nfp = int(round(fp_per_true * len(tp)))
    fp = [far[k] for k in rng.choice(len(far), nfp, replace=False)] if nfp else []
    return tp, fp


# ------------------------------------------------------------- keyframe subgraph
def pick_keyframes(preds, stride=5, min_overlap=3):
    sel = set(range(0, T, stride)) | {0, T - 1}
    for pr in preds:
        sel |= {int(pr['idx'][0]), int(pr['idx'][-1])}
    for a, b in zip(preds, preds[1:]):
        ov = np.intersect1d(a['idx'], b['idx'])
        if sum(int(t) in sel for t in ov) < min(min_overlap, len(ov)):
            sel |= {int(ov[q]) for q in np.linspace(0, len(ov) - 1, min(min_overlap, len(ov))).astype(int)}
    return np.array(sorted(sel))


def refine_sub(Q, preds, frames, sig_t=0.2, sig_r=0.01, nfev=15):
    """Same factors as chunkgraph.refine(mode='shared') but one SE(3) variable only per frame in
    `frames`; motion edges join consecutive kept frames inside a chunk. The corrections are then
    interpolated (slerp / linear) to the frames not kept, as in the authors' keyframe path."""
    R0, c0 = layout_traj(Q, preds)
    frames = np.asarray(frames); n = len(frames); pos = {int(t): i for i, t in enumerate(frames)}
    x0 = np.concatenate([np.stack([rv(R0[t]) for t in frames]).ravel(), c0[frames].ravel()])
    pri, mot = [], []
    for k, pr in enumerate(preds):
        kept = [(j, pos[int(t)]) for j, t in enumerate(pr['idx']) if int(t) in pos]
        pri += [(k, j, v) for j, v in kept]
        mot += [(k, j1, j2, v1, v2) for (j1, v1), (j2, v2) in zip(kept, kept[1:])]
    pk, pj, pv = map(np.array, zip(*pri)); mk, mj1, mj2, mv1, mv2 = map(np.array, zip(*mot))
    QR = [q[0] for q in Q]; Qc = [q[1] for q in Q]
    qR = Rot.from_matrix(np.array([QR[k][j] for k, j in zip(pk, pj)])); qc = np.array([Qc[k][j] for k, j in zip(pk, pj)])
    qa = Rot.from_matrix(np.array([QR[k][j] for k, j in zip(mk, mj1)])); qb = Rot.from_matrix(np.array([QR[k][j] for k, j in zip(mk, mj2)]))
    ca = np.array([Qc[k][j] for k, j in zip(mk, mj1)]); cb = np.array([Qc[k][j] for k, j in zip(mk, mj2)])
    mr = qa.inv() * qb; mt = qa.inv().apply(cb - ca)

    def f(x):
        Fr = Rot.from_rotvec(x[:3 * n].reshape(n, 3)); Fc = x[3 * n:].reshape(n, 3)
        r1 = (qR.inv() * Fr[pv]).as_rotvec() / sig_r; t1 = qR.inv().apply(Fc[pv] - qc) / sig_t
        er = Fr[mv1].inv() * Fr[mv2]; et = Fr[mv1].inv().apply(Fc[mv2] - Fc[mv1])
        r2 = (mr.inv() * er).as_rotvec() / sig_r; t2 = mr.inv().apply(et - mt) / sig_t
        return np.concatenate([r1.ravel(), t1.ravel(), r2.ravel(), t2.ravel()])

    m0 = f(x0).size
    sp = lil_matrix((m0, x0.size), dtype=int); row = 0
    for rep in range(2):
        for v in pv:
            sp[row:row + 3, [3 * v + i for i in range(3)] + [3 * n + 3 * v + i for i in range(3)]] = 1; row += 3
    for rep in range(2):
        for a, b in zip(mv1, mv2):
            sp[row:row + 3, [3 * a + i for i in range(3)] + [3 * b + i for i in range(3)] +
               [3 * n + 3 * a + i for i in range(3)] + [3 * n + 3 * b + i for i in range(3)]] = 1; row += 3
    r = least_squares(f, x0, jac_sparsity=sp, loss='huber', f_scale=1.5, x_scale='jac', max_nfev=nfev)
    Fr = Rot.from_rotvec(r.x[:3 * n].reshape(n, 3)); Fc = r.x[3 * n:].reshape(n, 3)
    if n == T:
        return Fr.as_matrix(), Fc, n
    dR = Fr * Rot.from_matrix(R0[frames]).inv()  # world-left rotation correction at each kept frame
    dc = Fc - c0[frames]
    allt = np.arange(T)
    dRi = Slerp(frames, dR)(allt)
    dci = np.stack([np.interp(allt, frames, dc[:, q]) for q in range(3)], 1)
    return (dRi * Rot.from_matrix(R0)).as_matrix(), c0 + dci, n


# --------------------------------------------------------------------------- driver
def run(seed, p):
    rng = np.random.default_rng(seed)
    Rg, cg = gt_path(); ch = chunks()
    true_A, preds = simulate(rng, Rg, cg, ch, p)  # same stream as chunkgraph.run: chain numbers must match
    Z = [overlap_measure(preds, k, rng, p) for k in range(len(ch) - 1)]
    A_chain = chain_init(Z)
    seq = [(k, k + 1, Z[k], 1.0) for k in range(len(ch) - 1)]
    out = {}; T0 = time.time()
    rr = np.random.default_rng(10_000 + seed)
    ate = lambda Q: metrics(Rg, cg, *layout_traj(Q, preds))[0]
    out['chain'] = ate(place(A_chain, preds))

    def stage1(loops, weighted):
        print('  stage1', len(loops), weighted, round(time.time() - T0, 1), flush=True)
        L = [(i, j, z, (w if weighted else 1.0)) for i, j, z, w, _ in loops]
        return progressive(A_chain, seq, L)

    # (a) authors-style loops, perfect retrieval
    tp, _ = retrieve(rr, ch, cg, 1.0, 0.0)
    loops = [joint_edge(rr, preds, ch, Rg, cg, i, j) for i, j in tp]
    out['n_true'] = len(tp)
    out['resid_true'] = [round(l[4], 4) for l in loops]
    out['w_true'] = [round(l[3], 3) for l in loops]
    A = stage1(loops, False); Q = place(A, preds); out['joint_loops'] = ate(Q)
    A = stage1(loops, True); Qw = place(A, preds); out['joint_loops_weighted'] = ate(Qw)
    # (b) stage II: all frames vs keyframes
    t0 = time.time(); Rf, cf, nv = refine_sub(Q, preds, np.arange(T)); t_full = time.time() - t0
    out['shared_full'] = metrics(Rg, cg, Rf, cf)[0]; out['shared_full']['vars'] = nv; out['shared_full']['secs'] = round(t_full, 1)
    kf = pick_keyframes(preds)
    t0 = time.time(); Rk, ck, nk = refine_sub(Q, preds, kf); t_kf = time.time() - t0
    out['shared_keyframe'] = metrics(Rg, cg, Rk, ck)[0]; out['shared_keyframe']['vars'] = nk; out['shared_keyframe']['secs'] = round(t_kf, 1)
    print('  stage2 done', round(time.time() - T0, 1), flush=True)
    Rc, cc = refine(Q, preds, 'shared')  # chunkgraph.py's own solver, as a check on refine_sub
    out['shared_original_solver'] = metrics(Rg, cg, Rc, cc)[0]
    # (c) retrieval with false positives
    out['fp'] = {}
    for fpt in (0.25, 0.5):
        tp, fp = retrieve(rr, ch, cg, 0.85, fpt)
        for mode in ('coherent', 'incoherent'):
            ls = [joint_edge(rr, preds, ch, Rg, cg, i, j) for i, j in tp] + [joint_edge(rr, preds, ch, Rg, cg, i, j, mode) for i, j in fp]
            ntp = len(tp)
            res = dict(n_true=ntp, n_false=len(fp), w_false=[round(l[3], 3) for l in ls[ntp:]], w_true=[round(l[3], 3) for l in ls[:ntp]])
            res['unweighted'] = ate(place(stage1(ls, False), preds))
            res['weighted'] = ate(place(stage1(ls, True), preds))
            out['fp'][f'{fpt}_{mode}'] = res
    return out



def run_control(seed, p, fpt=0.5, mode='coherent'):
    """Control for the weights: is a residual-based weight doing anything beyond making every loop
    weigh ~0.32 against adjacent edges' 1.0? Same loops, three solves: weight 1, weight = the mean
    of the residual-based weights of this run's loops (uniform), and the residual-based weights."""
    rng = np.random.default_rng(seed)
    Rg, cg = gt_path(); ch = chunks()
    true_A, preds = simulate(rng, Rg, cg, ch, p)
    Z = [overlap_measure(preds, k, rng, p) for k in range(len(ch) - 1)]
    A_chain = chain_init(Z); seq = [(k, k + 1, Z[k], 1.0) for k in range(len(ch) - 1)]
    rr = np.random.default_rng(20_000 + seed)
    tp, fp = retrieve(rr, ch, cg, 0.85, fpt)
    ls = [joint_edge(rr, preds, ch, Rg, cg, i, j) for i, j in tp] + [joint_edge(rr, preds, ch, Rg, cg, i, j, mode) for i, j in fp]
    ate = lambda A: metrics(Rg, cg, *layout_traj(place(A, preds), preds))[0]['ate']
    wm = float(np.mean([l[3] for l in ls]))
    out = dict(seed=seed, n_true=len(tp), n_false=len(fp), mean_w=wm, w_true=float(np.mean([l[3] for l in ls[:len(tp)]])),
               w_false=float(np.mean([l[3] for l in ls[len(tp):]])), chain=metrics(Rg, cg, *layout_traj(place(A_chain, preds), preds))[0]['ate'])
    for name, wf in (('w1', lambda l: 1.0), ('uniform', lambda l: wm), ('residual', lambda l: l[3])):
        out[name] = ate(progressive(A_chain, seq, [(i, j, z, wf((i, j, z, w, r))) for i, j, z, w, r in ls]))
        print(' ', seed, name, round(out[name], 2), flush=True)
    return out

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--seeds', type=int, default=6)
    ap.add_argument('--first', type=int, default=0)
    ap.add_argument('--out', default='ext.json')
    ap.add_argument('--control', action='store_true', help='weights control (coherent false loops, 0.5 per true loop)')
    a = ap.parse_args()
    if a.control:
        res = []
        for s in range(a.first, a.first + a.seeds):
            res.append(run_control(s, PARAMS)); json.dump(res, open(a.out, 'w'))
        raise SystemExit
    allr = []
    for s in range(a.first, a.first + a.seeds):
        t0 = time.time(); r = run(s, PARAMS); r['seed'] = s; r['secs'] = round(time.time() - t0, 1)
        allr.append(r); print(s, json.dumps({k: (round(v['ate'], 3) if isinstance(v, dict) and 'ate' in v else v) for k, v in r.items() if k not in ('fp', 'resid_true', 'w_true')}), flush=True)
        json.dump(allr, open(a.out, 'w'))
