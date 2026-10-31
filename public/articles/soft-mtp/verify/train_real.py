"""Tiny CPU comparison using the AUTHORS' OWN model and loss code (JaydenTeoh/Soft-MTP @ 4e1cf66).

Run from the repo root:  PYTHONPATH=. python train_real.py --objective {ntp,hard_mtp,soft_mtp,direct_kl} --seed N --tokens tokens.pt
Only our data loop, optimiser (AdamW, same hyper-parameters as code/train_toy.py) and evaluation are ours;
the model (HFMTPForCausalLM, RoPE + RMSNorm + SwiGLU, DeepSeek-style sequential heads, per-head final norms)
and the four losses (src/models/loss.py via model(input_ids, labels=...)) are the repository's.
Tokens: tokens.pt from code/train_toy.py (2048-entry BPE over three public-domain books).
"""
import argparse, json, math, os, resource, sys, time
import torch, torch.nn.functional as F
from src.models.config import HFMTPConfig
from src.models.model import HFMTPForCausalLM

HERE = os.path.dirname(os.path.abspath(__file__))
V, T, B, K = 2048, 64, 16, 3

def make(obj, seed):
    torch.manual_seed(seed)
    return HFMTPForCausalLM(HFMTPConfig(vocab_size=V, hidden_size=64, num_hidden_layers=2, num_heads=4,
        intermediate_size=256, max_position_embeddings=T, n_mtp=K, mtp_arch="deepseek", mtp_per_head_norm=True,
        objective=obj, mtp_weight=1.0))

def batches(data, gen):
    n = data.numel() - T - 2
    while True:
        ix = torch.randint(0, n, (B,), generator=gen)
        c = torch.stack([data[i:i + T + 1] for i in ix])
        yield c[:, :T], c[:, 1:T + 1]

@torch.no_grad()
def evaluate(m, val, nb=24):
    m.eval(); gen = torch.Generator().manual_seed(1234); it = batches(val, gen)
    ntp = 0.0; ce = [0.0] * K; kl = [0.0] * K; ag = [0.0] * K
    for _ in range(nb):
        x, y = next(it)
        H = m.trunk_forward(x); hs = m.all_head_hiddens(H, x)
        l0 = m.logits(hs[0], 0)
        ntp += float(F.cross_entropy(l0.reshape(-1, V), y.reshape(-1)))
        for k in range(1, K + 1):
            n = T - k; lk = m.logits(hs[k], k)
            ce[k-1] += float(F.cross_entropy(lk.reshape(-1, V), y[:, k:k+n].reshape(-1)))
            q = F.softmax(l0[:, k:k+n], -1); p = F.softmax(lk, -1)
            kl[k-1] += float((q * (q.clamp_min(1e-12).log() - p.clamp_min(1e-12).log())).sum(-1).mean())
            ag[k-1] += float((lk.argmax(-1) == l0[:, k:k+n].argmax(-1)).float().mean())
    f = lambda v: [a / nb for a in v]; ag = f(ag)
    run = 1.0; L = 1.0
    for a in ag: run *= a; L += run
    return {"val_ntp": ntp / nb, "val_mtp_ce": f(ce), "kl_to_verifier": f(kl), "agree_with_verifier": ag, "exp_accept_len_chain": L}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--objective"); ap.add_argument("--seed", type=int)
    ap.add_argument("--steps", type=int, default=300); ap.add_argument("--tokens"); ap.add_argument("--out", default=os.path.join(HERE, "results_real.jsonl"))
    a = ap.parse_args(); torch.set_num_threads(1)
    data = torch.load(a.tokens); cut = int(0.9 * data.numel()); train, val = data[:cut], data[cut:]
    m = make(a.objective, a.seed); m.train(); lr = 3e-3; steps = a.steps
    opt = torch.optim.AdamW(m.parameters(), lr=lr, betas=(0.9, 0.95), weight_decay=0.1)
    it = batches(train, torch.Generator().manual_seed(1000 + a.seed)); t0 = time.time(); curve = []
    for s in range(steps):
        cur = lr * min(1.0, (s + 1) / 40) * (0.5 * (1 + math.cos(math.pi * s / steps)) * 0.9 + 0.1)
        for g in opt.param_groups: g["lr"] = cur
        x, y = next(it)
        out = m(input_ids=x, labels=y)     # the repository's combined_mtp_loss for config.objective
        opt.zero_grad(set_to_none=True); out.loss.backward()
        torch.nn.utils.clip_grad_norm_(m.parameters(), 1.0); opt.step()
        if (s + 1) % 100 == 0: curve.append({"step": s + 1, "ntp": float(out.ntp_loss)})
    secs = time.time() - t0
    rec = {"objective": a.objective, "seed": a.seed, "steps": steps, "seconds": round(secs, 1), "n_params": sum(p.numel() for p in m.parameters()),
           "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1), "val": evaluate(m, val), "curve": curve}
    open(a.out, "a").write(json.dumps(rec) + "\n"); print(a.objective, a.seed, round(rec["val"]["val_ntp"], 4), rec["seconds"], flush=True)
main()
