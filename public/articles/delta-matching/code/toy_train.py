"""Toy 2: a tiny char-level transformer trained with exact attention vs simulated-FP8 attention (three delta variants).

Usage: nice -n 19 python -I toy_train.py --mode {ref,stale,consistent,matched} --seed S --steps N --out out.json
Corpus: the site's own article text (any text file works). Two layers, d=128, 4 heads of 32, QK-RMSNorm with learnable gains.
"""
import argparse, json, math, os, time
import torch, torch.nn as nn, torch.nn.functional as F
from fp8_autograd import FP8Attn, STATS

torch.set_num_threads(2)
ap = argparse.ArgumentParser()
ap.add_argument("--mode", required=True); ap.add_argument("--seed", type=int, default=0); ap.add_argument("--steps", type=int, default=1000)
ap.add_argument("--corpus", default="corpus.txt"); ap.add_argument("--out", required=True); ap.add_argument("--lr", type=float, default=3e-3)
a = ap.parse_args()
B, T, D, H, L = 4, 64, 128, 4, 2
text = open(a.corpus, encoding="utf-8", errors="ignore").read()
chars = sorted(set(text)); stoi = {c: i for i, c in enumerate(chars)}; V = len(chars)
data = torch.tensor([stoi[c] for c in text], dtype=torch.long)
n_val = len(data) // 20
train, val = data[:-n_val], data[-n_val:]


class RMS(nn.Module):
    def __init__(self, d):
        super().__init__(); self.g = nn.Parameter(torch.ones(d))
    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + 1e-6) * self.g


class Block(nn.Module):
    def __init__(self):
        super().__init__()
        self.ln1, self.ln2 = nn.LayerNorm(D), nn.LayerNorm(D)
        self.qkv = nn.Linear(D, 3 * D, bias=False); self.o = nn.Linear(D, D, bias=False)
        self.qn, self.kn = RMS(D // H), RMS(D // H)
        self.mlp = nn.Sequential(nn.Linear(D, 4 * D), nn.GELU(), nn.Linear(4 * D, D))
    def forward(self, x):
        Bn, Tn, _ = x.shape
        q, k, v = self.qkv(self.ln1(x)).view(Bn, Tn, 3, H, D // H).permute(2, 0, 3, 1, 4)
        q, k = self.qn(q), self.kn(k)
        if a.mode == "ref":
            y = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        else:
            y = FP8Attn.apply(q, k, v, a.mode)
        x = x + self.o(y.transpose(1, 2).reshape(Bn, Tn, D))
        return x + self.mlp(self.ln2(x))


class LM(nn.Module):
    def __init__(self):
        super().__init__()
        self.emb = nn.Embedding(V, D); self.pos = nn.Embedding(T, D)
        self.blocks = nn.ModuleList([Block() for _ in range(L)]); self.lnf = nn.LayerNorm(D); self.head = nn.Linear(D, V, bias=False)
    def forward(self, idx):
        x = self.emb(idx) + self.pos(torch.arange(idx.shape[1]))
        for b in self.blocks: x = b(x)
        return self.head(self.lnf(x))


def batch(src, g):
    ix = torch.randint(0, len(src) - T - 1, (B,), generator=g)
    return torch.stack([src[i:i + T] for i in ix]), torch.stack([src[i + 1:i + T + 1] for i in ix])


torch.manual_seed(a.seed)
m = LM()
opt = torch.optim.AdamW(m.parameters(), lr=a.lr, betas=(0.9, 0.95), weight_decay=0.01)
gtr = torch.Generator().manual_seed(1000 + a.seed); gva = torch.Generator().manual_seed(7)


def gain_conc():
    out = []
    for b in m.blocks:
        w = (b.qn.g * b.kn.g).detach().pow(2)
        out.append({"max_gain_prod": float((b.qn.g * b.kn.g).detach().abs().max()), "top_channel_share": float(w.max() / w.sum())})
    return out


log = {"mode": a.mode, "seed": a.seed, "steps": a.steps, "vocab": V, "params": sum(p.numel() for p in m.parameters()), "curve": [], "gains": [], "resid": []}
t0 = time.time()
for step in range(a.steps):
    lr = a.lr * min(1.0, (step + 1) / 50) * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * step / a.steps)))
    for g_ in opt.param_groups: g_["lr"] = lr
    x, y = batch(train, gtr)
    loss = F.cross_entropy(m(x).view(-1, V), y.view(-1))
    opt.zero_grad(set_to_none=True); loss.backward()
    torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step()
    if step % 25 == 0 or step == a.steps - 1:
        log["curve"].append([step, float(loss.detach())])
    if step % 100 == 0 or step == a.steps - 1:
        log["gains"].append([step, gain_conc()])
        if STATS["pre"]:
            log["resid"].append([step, sum(STATS["pre"][-8:]) / len(STATS["pre"][-8:]), sum(STATS["post"][-8:]) / len(STATS["post"][-8:])])
        print(a.mode, a.seed, step, "%.4f" % float(loss.detach()), "%.0fs" % (time.time() - t0), flush=True)
m.eval()
with torch.no_grad():
    vl = [float(F.cross_entropy(m(x).view(-1, V), y.view(-1))) for x, y in (batch(val, gva) for _ in range(30))]
log["val_ce"] = sum(vl) / len(vl); log["seconds"] = time.time() - t0
json.dump(log, open(a.out, "w"))
print("done", a.mode, a.seed, "val_ce %.4f" % log["val_ce"])
