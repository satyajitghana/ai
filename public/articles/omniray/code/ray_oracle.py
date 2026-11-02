"""A small oracle test of the OmniRay ray representation (our re-implementation of the idea, not the authors' code).

Each representation is fitted directly to analytic ground-truth rays of a synthetic camera, as in the paper's Sec. 4.1:
  stage 1  monotone radial base: K=16 piecewise-linear knots over r in [0, 1.3] (half-diagonal units),
           principal-point offset c, axis-angle rotation w, upper-triangular map A  -> 16 + 2 + 3 + 3 = 24 parameters
  stage 2  spherical-harmonic residual, L=7: 3*(L+1)^2 = 192 coefficients, evaluated at the inverse-stereographic lift of m,
           applied as a tangent rotation on S^2 (exp map)
  stage 3  free-form residual: a coarse grid of tangent vectors, bilinearly interpolated to pixels (stand-in for the paper's conv decoder)
Stages are fitted one after the other (earlier stages frozen), like the paper's staged training, and the error after each is reported.

Usage: python3 -I ray_oracle.py [out.json]    (numpy + torch, CPU, single thread)
"""
import json, math, sys, time
import numpy as np
import torch

torch.set_num_threads(1)
DT = torch.float64
K = 16
R_MAX = 1.3
L_SH = 7
THR_DEG = 0.25
MULTISTART = True   # orientation multi-start in fit_radial; switched off for the perturbed-fisheye sweeps, whose axis is already right


# ---------------------------------------------------------------- real spherical harmonics (no scipy)
def real_sh(L, xyz):
    x, y, z = xyz[:, 0], xyz[:, 1], xyz[:, 2]
    phi = np.arctan2(y, x)
    ct = np.clip(z, -1, 1)
    st = np.sqrt(np.maximum(1 - ct * ct, 0))
    n = len(z)
    out = np.zeros((n, (L + 1) ** 2))
    P = {}
    for m in range(L + 1):
        P[(m, m)] = ((-1) ** m) * np.prod(np.arange(1, 2 * m, 2, dtype=float)) * st ** m if m > 0 else np.ones(n)
        if m + 1 <= L:
            P[(m + 1, m)] = ct * (2 * m + 1) * P[(m, m)]
        for l in range(m + 2, L + 1):
            P[(l, m)] = ((2 * l - 1) * ct * P[(l - 1, m)] - (l + m - 1) * P[(l - 2, m)]) / (l - m)
    for l in range(L + 1):
        for m in range(-l, l + 1):
            am = abs(m)
            K_lm = math.sqrt((2 * l + 1) / (4 * math.pi) * math.factorial(l - am) / math.factorial(l + am))
            if m == 0:
                out[:, l * l + l] = K_lm * P[(l, 0)]
            elif m > 0:
                out[:, l * l + l + m] = math.sqrt(2) * K_lm * np.cos(m * phi) * P[(l, m)]
            else:
                out[:, l * l + l + m] = math.sqrt(2) * K_lm * np.sin(am * phi) * P[(l, am)]
    return out


# ---------------------------------------------------------------- cameras: pixel grid -> analytic ground-truth rays
class Cam:
    def __init__(self, name, H, W, rays, valid):
        self.name, self.H, self.W = name, H, W
        yy, xx = np.mgrid[0:H, 0:W]
        cx, cy = (W - 1) / 2, (H - 1) / 2
        hd = math.hypot(W, H) / 2
        self.m_all = np.stack([(xx - cx) / hd, (yy - cy) / hd], -1).reshape(-1, 2)
        self.valid = valid.reshape(-1)
        self.m = self.m_all[self.valid]
        self.d_gt = rays.reshape(-1, 3)[self.valid]
        self.n = int(self.valid.sum())
        mm = self.m
        b = np.concatenate([2 * mm, (1 - (mm ** 2).sum(1, keepdims=True))], 1) / (1 + (mm ** 2).sum(1, keepdims=True))
        self.Phi = real_sh(L_SH, b)


def _grid(H, W):
    yy, xx = np.mgrid[0:H, 0:W]
    return (xx - (W - 1) / 2), (yy - (H - 1) / 2)


def cam_fisheye(H=64, W=64, fov_deg=180.0):
    x, y = _grid(H, W)
    R = min(H, W) / 2
    r = np.hypot(x, y) / R
    th = r * math.radians(fov_deg) / 2
    ph = np.arctan2(y, x)
    d = np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], -1)
    return Cam("fisheye", H, W, d, r <= 1.0)


def cam_equirect(H=64, W=128):
    x, y = _grid(H, W)
    lon = x / (W / 2) * math.pi
    lat = -y / (H / 2) * math.pi / 2
    d = np.stack([np.cos(lat) * np.sin(lon), np.sin(lat), np.cos(lat) * np.cos(lon)], -1)
    return Cam("equirectangular", H, W, d, np.ones((H, W), bool))


def cam_catadioptric(H=64, W=64, inner=40.0, rim=155.0):
    x, y = _grid(H, W)
    R = min(H, W) / 2
    r = np.hypot(x, y) / R
    t = math.tan(math.radians(rim) / 2)
    th = 2 * np.arctan(r * t)
    ph = np.arctan2(y, x)
    d = np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], -1)
    r_in = math.tan(math.radians(inner) / 2) / t
    return Cam("catadioptric", H, W, d, (r <= 1.0) & (r >= r_in))


def cam_pinhole(H=64, W=64, fov_deg=90.0):
    x, y = _grid(H, W)
    f = (W / 2) / math.tan(math.radians(fov_deg) / 2)
    d = np.stack([x / f, y / f, np.ones_like(x)], -1)
    d /= np.linalg.norm(d, axis=-1, keepdims=True)
    return Cam("pinhole", H, W, d, np.ones((H, W), bool))


# ---------------------------------------------------------------- torch helpers
def T(a):
    return torch.as_tensor(np.asarray(a), dtype=DT)


def rodrigues(w):
    th = torch.sqrt((w * w).sum() + 1e-18)
    k = w / th
    Kx = torch.stack([torch.stack([torch.zeros((), dtype=DT), -k[2], k[1]]),
                      torch.stack([k[2], torch.zeros((), dtype=DT), -k[0]]),
                      torch.stack([-k[1], k[0], torch.zeros((), dtype=DT)])])
    I = torch.eye(3, dtype=DT)
    return I + torch.sin(th) * Kx + (1 - torch.cos(th)) * (Kx @ Kx)


def exp_map(d, w):
    t = w - (w * d).sum(1, keepdim=True) * d
    n = torch.sqrt((t * t).sum(1, keepdim=True) + 1e-18)
    return torch.cos(n) * d + torch.sin(n) / n * t


def ang_deg(d, dg):
    c = (d * dg).sum(1).clamp(-1, 1)
    return torch.rad2deg(torch.acos(c))


def loss_fn(d, dg):
    return (1 - (d * dg).sum(1)).mean()


def lbfgs(params, closure, iters):
    opt = torch.optim.LBFGS(params, lr=1.0, max_iter=iters, tolerance_grad=1e-14, tolerance_change=1e-15,
                            history_size=20, line_search_fn="strong_wolfe")
    def c():
        opt.zero_grad()
        l = closure()
        l.backward()
        return l
    opt.step(c)
    return float(closure().detach())


# ---------------------------------------------------------------- stage 1: monotone radial base
RK = torch.linspace(0, R_MAX, K + 1, dtype=DT)


def radial_rays(p, m):
    s, c, w, a = p["s"], p["c"], p["w"], p["a"]
    A = torch.stack([torch.stack([torch.exp(a[0]), a[2]]), torch.stack([torch.zeros((), dtype=DT), torch.exp(a[1])])])
    mp = (m - c) @ A.T
    r = torch.sqrt((mp * mp).sum(1) + 1e-18)
    ph = torch.atan2(mp[:, 1], mp[:, 0])
    thk = torch.cat([torch.zeros(1, dtype=DT), torch.cumsum(torch.nn.functional.softplus(s), 0)])
    t = r.clamp(0, R_MAX) / R_MAX * K
    i = t.floor().clamp(max=K - 1)
    fr = t - i
    ii = i.long()
    th = thk[ii] * (1 - fr) + thk[ii + 1] * fr
    d0 = torch.stack([torch.sin(th) * torch.cos(ph), torch.sin(th) * torch.sin(ph), torch.cos(th)], 1)
    return d0 @ rodrigues(w).T


def fit_radial(cam, iters=250):
    m, dg = T(cam.m), T(cam.d_gt)
    best = None
    for total in (1.4, 2.8, 4.6):
        inc = total / K
        s0 = math.log(math.expm1(inc))
        p = {"s": torch.full((K,), s0, dtype=DT, requires_grad=True),
             "c": torch.zeros(2, dtype=DT, requires_grad=True),
             "w": torch.tensor([1e-3, 1e-3, 1e-3], dtype=DT, requires_grad=True),
             "a": torch.zeros(3, dtype=DT, requires_grad=True)}
        clo = lambda: loss_fn(radial_rays(p, m), dg)
        l = lbfgs(list(p.values()), clo, iters)
        if best is None or l < best[0]:
            best = (l, p)
    if MULTISTART and best[0] > 4e-5:   # worse than ~0.5 deg: add the paper's multi-start over the optical-axis orientation
        h = math.pi / 2
        for w0 in ([h, 0, 0], [-h, 0, 0], [0, h, 0], [0, -h, 0], [0, 0, h], [h, h, 0], [-h, h, 0]):
            for total in (2.0, 3.5, 5.0):
                inc = total / K
                p = {"s": torch.full((K,), math.log(math.expm1(inc)), dtype=DT, requires_grad=True),
                     "c": torch.zeros(2, dtype=DT, requires_grad=True),
                     "w": torch.tensor(w0, dtype=DT, requires_grad=True),
                     "a": torch.zeros(3, dtype=DT, requires_grad=True)}
                clo = lambda: loss_fn(radial_rays(p, m), dg)
                l = lbfgs(list(p.values()), clo, iters)
                if l < best[0]:
                    best = (l, p)
    p = {k: v.detach() for k, v in best[1].items()}
    return p, radial_rays(p, m).detach()


# ---------------------------------------------------------------- pinhole (6 params: f, c, rotation)
def fit_pinhole(cam, iters=200):
    m, dg = T(cam.m), T(cam.d_gt)
    best = None
    for f0 in (0.4, 0.8, 1.6):
        p = {"f": torch.tensor(math.log(f0), dtype=DT, requires_grad=True), "c": torch.zeros(2, dtype=DT, requires_grad=True),
             "w": torch.tensor([1e-3, 1e-3, 1e-3], dtype=DT, requires_grad=True)}
        def rays():
            v = torch.cat([(m - p["c"]) / torch.exp(p["f"]), torch.ones(len(m), 1, dtype=DT)], 1)
            v = v / v.norm(dim=1, keepdim=True)
            return v @ rodrigues(p["w"]).T
        l = lbfgs(list(p.values()), lambda: loss_fn(rays(), dg), iters)
        if best is None or l < best[0]:
            best = (l, rays().detach())
    return best[1]


# ---------------------------------------------------------------- stage 2 and 3
def fit_sh_residual(cam, d0, iters=200):
    dg, Phi = T(cam.d_gt), T(cam.Phi)
    W = torch.zeros(Phi.shape[1], 3, dtype=DT, requires_grad=True)
    l = lbfgs([W], lambda: loss_fn(exp_map(d0, Phi @ W), dg), iters)
    return exp_map(d0, Phi @ W).detach()


def interp_matrix(cam, gh, gw):
    """bilinear weights from a (gh x gw) grid spanning the image to the valid pixels."""
    yy, xx = np.mgrid[0:cam.H, 0:cam.W]
    u = (xx / max(cam.W - 1, 1) * (gw - 1)).reshape(-1)[cam.valid]
    v = (yy / max(cam.H - 1, 1) * (gh - 1)).reshape(-1)[cam.valid]
    u0 = np.clip(np.floor(u).astype(int), 0, gw - 2); v0 = np.clip(np.floor(v).astype(int), 0, gh - 2)
    fu, fv = u - u0, v - v0
    M = np.zeros((cam.n, gh * gw))
    r = np.arange(cam.n)
    for du, dv, wgt in ((0, 0, (1 - fu) * (1 - fv)), (1, 0, fu * (1 - fv)), (0, 1, (1 - fu) * fv), (1, 1, fu * fv)):
        M[r, (v0 + dv) * gw + (u0 + du)] += wgt
    return T(M)


def fit_free_residual(cam, d1, gh, gw, iters=200):
    dg = T(cam.d_gt)
    M = interp_matrix(cam, gh, gw)
    W = torch.zeros(gh * gw, 3, dtype=DT, requires_grad=True)
    l = lbfgs([W], lambda: loss_fn(exp_map(d1, M @ W), dg), iters)
    return exp_map(d1, M @ W).detach()


def stats(d, cam):
    e = ang_deg(d, T(cam.d_gt)).numpy()
    return {"mean_deg": float(e.mean()), "p95_deg": float(np.percentile(e, 95)), "frac_over_thr": float((e > THR_DEG).mean())}


def staged(cam, gh=16, gw=None):
    gw = gw or (gh * cam.W // cam.H)
    out = {}
    p, d0 = fit_radial(cam)
    out["radial"] = stats(d0, cam)
    d1 = fit_sh_residual(cam, d0)
    out["radial+SH"] = stats(d1, cam)
    d2 = fit_free_residual(cam, d1, gh, gw)
    out["radial+SH+free"] = stats(d2, cam)
    return out


def sh_only(cam):
    Phi = cam.Phi
    W, *_ = np.linalg.lstsq(Phi, cam.d_gt, rcond=None)
    d = Phi @ W
    d /= np.linalg.norm(d, axis=1, keepdims=True)
    return stats(T(d), cam)


# ---------------------------------------------------------------- perturbed fisheye: a smooth non-radial part (A deg) and local bumps (B deg)
def perturbed_fisheye(smooth_deg, local_deg, seed, H=64, W=64):
    base = cam_fisheye(H, W)
    rng = np.random.default_rng(seed)
    d = base.d_gt.copy()
    m = base.m
    w = np.zeros_like(d)
    if smooth_deg > 0:
        Phi = real_sh(3, np.concatenate([2 * m, 1 - (m ** 2).sum(1, keepdims=True)], 1) / (1 + (m ** 2).sum(1, keepdims=True)))[:, 1:]
        coef = rng.normal(size=(Phi.shape[1], 3))
        w += Phi @ coef
        w *= math.radians(smooth_deg) / max(np.sqrt((w ** 2).sum(1).mean()), 1e-12)
    if local_deg > 0:
        for _ in range(6):
            c = m[rng.integers(len(m))]
            g = np.exp(-((m - c) ** 2).sum(1) / (2 * 0.06 ** 2))[:, None]
            w += g * rng.normal(size=3)[None, :] * math.radians(local_deg)
    dn = exp_map(T(d), T(w)).numpy()
    cam = cam_fisheye(H, W)
    cam.d_gt = dn
    cam.name = f"fisheye+A{smooth_deg}+B{local_deg}"
    return cam


def main(out=None):
    global MULTISTART
    import os
    t0 = time.time()
    res = {"geometries": {}, "smooth_sweep": {}, "local_sweep": {}}
    if out and os.path.exists(out):
        res = json.load(open(out))      # resume: skip what is already there

    def save():
        if out:
            json.dump(res, open(out, "w"), indent=1)

    MULTISTART = True
    for cam in [cam_fisheye(), cam_equirect(), cam_catadioptric(), cam_pinhole()]:
        if cam.name in res["geometries"]:
            continue
        row = {"n_pixels": cam.n}
        row["pinhole(6)"] = stats(fit_pinhole(cam), cam)
        row["SH only (L=7)"] = sh_only(cam)
        row.update(staged(cam))
        res["geometries"][cam.name] = row
        save()
        print(cam.name, {k: round(v["mean_deg"], 5) for k, v in row.items() if isinstance(v, dict)}, f"{time.time() - t0:.0f}s", flush=True)
    MULTISTART = False
    seeds = [0, 1, 2, 3, 4]
    for key, mk in (("smooth_sweep", lambda a, s: perturbed_fisheye(a, 0, s)), ("local_sweep", lambda a, s: perturbed_fisheye(0, a, s))):
        for amp in (0, 0.5, 1, 2, 4, 8):
            if str(amp) in res[key]:
                continue
            rows = [staged(mk(amp, s)) for s in seeds]
            res[key][str(amp)] = {st: {k: float(np.mean([r[st][k] for r in rows])) for k in rows[0][st]} for st in rows[0]}
            save()
            print(key, amp, {st: (round(v["mean_deg"], 5), round(v["frac_over_thr"], 3)) for st, v in res[key][str(amp)].items()}, f"{time.time() - t0:.0f}s", flush=True)
    res["seconds"] = res.get("seconds", 0) + time.time() - t0
    save()
    return res


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
