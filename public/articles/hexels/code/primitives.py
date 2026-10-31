"""2D image fitting with N optimised primitives (CPU, torch).
Kinds: g_const / g_lin (Gaussian, Image-GS style) and h_const / h_lin (hexagonal support, paper Eq. 22-24).
Dense normalised blend  c(x) = sum_i w_i c_i(x) / (sum_i w_i + eps)  (no top-K): a deliberate simplification."""
import json, math, sys, time, numpy as np, torch
sys.path.insert(0, '.')
from toy_images import IMAGES, grid, psnr

torch.set_num_threads(1)
SQ3 = math.sqrt(3.0)
KAPPA = 10.0          # scale of the linear colour terms (colour change per image width per unit coefficient)
PARAMS = {"g_const": 8, "g_lin": 14, "h_const": 8, "h_lin": 15, "d_const": 8, "s_const": 8}   # scalars stored per primitive (see article)

def hex_d(u, v):
    return torch.maximum(v.abs(), torch.maximum((SQ3 / 2 * u + 0.5 * v).abs(), (SQ3 / 2 * u - 0.5 * v).abs())) - 1.0

class Prims(torch.nn.Module):
    def __init__(self, kind, img, N, seed):
        super().__init__()
        g = torch.Generator().manual_seed(seed)
        n = img.shape[0]
        self.kind = kind
        # image-gradient-weighted placement with 30% uniform (as the paper / Image-GS)
        gy = np.abs(np.diff(img, axis=0, prepend=img[:1])).sum(-1); gx = np.abs(np.diff(img, axis=1, prepend=img[:, :1])).sum(-1)
        w = (gx + gy).reshape(-1) + 1e-6; w = w / w.sum()
        n_g = int(round(0.7 * N))
        idx_g = torch.multinomial(torch.tensor(w, dtype=torch.float32), n_g, replacement=False, generator=g)
        idx_u = torch.randint(0, n * n, (N - n_g,), generator=g)
        idx = torch.cat([idx_g, idx_u])
        ys, xs = idx // n, idx % n
        self.m = torch.nn.Parameter(torch.stack([(xs + 0.5) / n, (ys + 0.5) / n], 1).float())
        s0 = 0.5 / math.sqrt(N)
        self.log_s = torch.nn.Parameter(torch.full((N, 2), math.log(s0)))
        self.theta = torch.nn.Parameter(torch.zeros(N))
        c0 = torch.tensor(img[ys.numpy(), xs.numpy()], dtype=torch.float32)
        self.c0 = torch.nn.Parameter(c0)
        if kind.endswith("_lin"):
            self.g = torch.nn.Parameter(torch.zeros(N, 2, 3))
        if kind == "h_lin":
            self.b_raw = torch.nn.Parameter(torch.full((N,), math.log(math.expm1(10.0))))   # softplus^-1(10)
        px, py = grid(n)
        self.register_buffer("px", torch.tensor(px.reshape(-1), dtype=torch.float32))
        self.register_buffer("py", torch.tensor(py.reshape(-1), dtype=torch.float32))

    def render(self):
        dx = self.px[None, :] - self.m[:, 0:1]; dy = self.py[None, :] - self.m[:, 1:2]       # (N,P)
        c, s = torch.cos(self.theta)[:, None], torch.sin(self.theta)[:, None]
        rx = c * dx + s * dy; ry = -s * dx + c * dy
        sc = torch.exp(self.log_s)
        u = rx / sc[:, 0:1]; v = ry / sc[:, 1:2]
        if self.kind.startswith("g"):
            wgt = torch.exp(-0.5 * (u * u + v * v))
        elif self.kind == "d_const":            # control: round support, same sigmoid edge and fixed beta = 10
            wgt = torch.sigmoid(-10.0 * (torch.sqrt(u * u + v * v + 1e-12) - 1.0))
        elif self.kind == "s_const":            # control: square support, same sigmoid edge and fixed beta = 10
            wgt = torch.sigmoid(-10.0 * (torch.maximum(u.abs(), v.abs()) - 1.0))
        else:
            beta = torch.nn.functional.softplus(self.b_raw)[:, None] if self.kind == "h_lin" else 10.0
            wgt = torch.sigmoid(-beta * hex_d(u, v))
        col = self.c0[:, None, :].expand(-1, dx.shape[1], -1)
        if self.kind.endswith("_lin"):
            col = col + u[..., None] * self.g[:, 0:1, :] + v[..., None] * self.g[:, 1:2, :]     # paper Eq. 4: c0 + u g_u + v g_v in scale-normalised local coordinates (v2)
        num = (wgt[..., None] * col).sum(0); den = wgt.sum(0)[:, None] + 1e-4
        return num / den

def fit(kind, img, N, seed, steps):
    torch.manual_seed(seed)
    model = Prims(kind, img, N, seed)
    tgt = torch.tensor(img.reshape(-1, 3), dtype=torch.float32)
    groups = [dict(params=[model.m], lr=2e-3), dict(params=[model.log_s], lr=1e-2), dict(params=[model.theta], lr=1e-2), dict(params=[model.c0], lr=1e-2)]
    if kind.endswith("_lin"): groups.append(dict(params=[model.g], lr=1e-2))
    if kind == "h_lin": groups.append(dict(params=[model.b_raw], lr=2e-2))
    opt = torch.optim.Adam(groups)
    base = [g['lr'] for g in groups]
    best = 0.0
    for it in range(steps):
        f = 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * it / steps))
        for g, b in zip(opt.param_groups, base): g['lr'] = b * f
        opt.zero_grad()
        out = model.render()
        loss = ((out - tgt) ** 2).mean() + 0.1 * (out - tgt).abs().mean()
        loss.backward(); opt.step()
    with torch.no_grad():
        out = model.render().clamp(0, 1)
    return psnr(out.numpy(), tgt.numpy()), out.reshape(img.shape).numpy()

if __name__ == "__main__":
    n = 64
    img = IMAGES[sys.argv[1] if len(sys.argv) > 1 else "poster"](n)
    N = int(sys.argv[2]) if len(sys.argv) > 2 else 32
    steps = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    for kind in ("g_const", "g_lin", "h_const", "h_lin"):
        t = time.time(); p, _ = fit(kind, img, N, 0, steps)
        print(f"{kind:8s} N={N} steps={steps}  PSNR {p:.2f} dB  {time.time()-t:.1f}s  params {PARAMS[kind]*N}")
