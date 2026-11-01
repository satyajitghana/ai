"""Tiny CPU comparison of NTP / hard MTP / explicit-KL MTP / Soft-MTP on public-domain text.

Model: pre-norm causal transformer trunk (d=64, 2 layers, 4 heads), untied LM head W, K=3 DeepSeek-style
sequential MTP heads (each one transformer block that takes the previous head's state and the embedding of the
token k positions ahead). Objectives follow the paper's Table 1:
  ntp   : CE on the NTP head only
  mtp   : NTP CE + lambda/K * sum_k CE_k          (CE gradient everywhere)
  kl    : NTP CE + lambda/K * sum_k KL(sg(q)||p_k) (KL gradient everywhere, incl. the shared head)
  soft  : mtp + straight-through coupling on the NTP hidden (KL gradient into heads + trunk, CE into W)
Toy scale: 542,232 BPE tokens of three public-domain books, 300 steps per run. Not a replication of the paper's scale.

Corpus (download next to this file):
  https://www.gutenberg.org/cache/epub/1342/pg1342.txt  (Pride and Prejudice)
  https://www.gutenberg.org/cache/epub/84/pg84.txt      (Frankenstein)
  https://www.gutenberg.org/cache/epub/1661/pg1661.txt  (The Adventures of Sherlock Holmes)
Run: python train_toy.py --objective {ntp,mtp,kl,soft} --seed N --steps 300 [--snr]
"""
import json, math, os, resource, sys, time, argparse
import torch, torch.nn as nn, torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = ["pg1342.txt", "pg84.txt", "pg1661.txt"]
VOCAB = 2048


def load_tokens():
    cache = os.path.join(HERE, "tokens.pt")
    if os.path.exists(cache):
        return torch.load(cache)
    from tokenizers import Tokenizer, models, trainers, pre_tokenizers, decoders
    texts = []
    for f in CORPUS:
        t = open(os.path.join(HERE, f), encoding="utf-8", errors="ignore").read()
        a = t.find("*** START"); b = t.find("*** END")
        a = t.find("\n", a) if a >= 0 else 0
        texts.append(t[a:b if b > 0 else len(t)])
    tok = Tokenizer(models.BPE())
    tok.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tok.decoder = decoders.ByteLevel()
    tok.train_from_iterator(texts, trainers.BpeTrainer(vocab_size=VOCAB, special_tokens=["<pad>"],
                                                       initial_alphabet=pre_tokenizers.ByteLevel.alphabet()))
    ids = []
    for t in texts:
        ids.extend(tok.encode(t).ids)
    data = torch.tensor(ids, dtype=torch.long)
    torch.save(data, cache)
    return data


class Block(nn.Module):
    def __init__(self, d, nh):
        super().__init__()
        self.n1 = nn.RMSNorm(d); self.n2 = nn.RMSNorm(d)
        self.qkv = nn.Linear(d, 3 * d, bias=False); self.o = nn.Linear(d, d, bias=False)
        self.up = nn.Linear(d, 4 * d, bias=False); self.down = nn.Linear(4 * d, d, bias=False)
        self.nh = nh

    def forward(self, x):
        B, T, D = x.shape
        q, k, v = self.qkv(self.n1(x)).view(B, T, 3, self.nh, D // self.nh).permute(2, 0, 3, 1, 4)
        a = F.scaled_dot_product_attention(q, k, v, is_causal=True).transpose(1, 2).reshape(B, T, D)
        x = x + self.o(a)
        return x + self.down(F.gelu(self.up(self.n2(x))))


class LM(nn.Module):
    def __init__(self, V=VOCAB, d=64, L=2, nh=4, K=3, T=64):
        super().__init__()
        self.K, self.d = K, d
        self.emb = nn.Embedding(V, d)
        self.pos = nn.Embedding(T, d)
        self.blocks = nn.ModuleList([Block(d, nh) for _ in range(L)])
        self.norms = nn.ModuleList([nn.RMSNorm(d) for _ in range(K + 1)])     # per-head final norms
        self.proj = nn.ModuleList([nn.Linear(2 * d, d, bias=False) for _ in range(K)])
        self.hn_prev = nn.ModuleList([nn.RMSNorm(d) for _ in range(K)])
        self.hn_emb = nn.ModuleList([nn.RMSNorm(d) for _ in range(K)])
        self.mtp_blocks = nn.ModuleList([Block(d, nh) for _ in range(K)])
        self.head = nn.Linear(d, V, bias=False)                                 # shared output head W

    def trunk_params(self):
        ps = list(self.emb.parameters()) + list(self.pos.parameters())
        for b in self.blocks: ps += list(b.parameters())
        return ps

    def hiddens(self, x, heads=True):
        """x: [B, T] inputs. returns list [h0 (B,T,d), h1 (B,T-1,d), ..., hK (B,T-K,d)] post-norm."""
        B, T = x.shape
        e = self.emb(x)
        z = e + self.pos(torch.arange(T))[None]
        for b in self.blocks:
            z = b(z)
        out = [self.norms[0](z)]
        if not heads:
            return out
        prev = z
        for k in range(1, self.K + 1):
            n = T - k
            cat = torch.cat([self.hn_prev[k - 1](prev[:, :n]), self.hn_emb[k - 1](e[:, k:k + n])], dim=-1)
            prev = self.mtp_blocks[k - 1](self.proj[k - 1](cat))
            out.append(self.norms[k](prev))
        return out


def objective_loss(model, hs, y, objective, lam=1.0):
    """hs from model.hiddens(x); y: [B, T+? ] targets chunk[:,1:T+1] aligned with NTP positions. Head k at position t
    predicts y[:, t+k] (token x_{t+k+1})."""
    B, T = y.shape
    W = model.head.weight
    K = model.K
    ce = lambda h, t: F.cross_entropy((h @ W.T).reshape(-1, W.size(0)), t.reshape(-1))
    if objective == "ntp":
        return ce(hs[0], y), {"ntp": float(ce(hs[0], y)), "mtp": 0.0}
    n_ntp = y.numel()
    h0 = hs[0]
    mtp_terms, kl_terms = [], []
    for k in range(1, K + 1):
        n = T - k
        hk = hs[k]
        tgt = y[:, k:k + n]
        mtp_terms.append(ce(hk, tgt))
        if objective == "soft":
            s_k = lam * n_ntp / (K * (B * n))
            h0 = torch.cat([h0[:, :k], h0[:, k:] + s_k * (hk.detach() - hk)], dim=1)
        if objective == "kl":
            teacher = (hs[0][:, k:k + n].detach() @ W.T).detach()
            student = hk @ W.T
            kl = (F.softmax(teacher, -1) * (F.log_softmax(teacher, -1) - F.log_softmax(student, -1))).sum(-1).mean()
            kl_terms.append(kl)
    ntp = ce(h0, y)
    if objective == "kl":
        total = ntp + lam * torch.stack(kl_terms).mean()
    else:
        total = ntp + lam * torch.stack(mtp_terms).mean()
    return total, {"ntp": float(ntp.detach()), "mtp": float(torch.stack(mtp_terms).detach().mean())}


def batches(data, T, B, gen):
    n = data.numel() - T - 2
    while True:
        ix = torch.randint(0, n, (B,), generator=gen)
        chunk = torch.stack([data[i:i + T + 1] for i in ix])
        yield chunk[:, :T], chunk[:, 1:T + 1], chunk


@torch.no_grad()
def evaluate(model, val, T=64, B=32, nb=24):
    model.eval()
    gen = torch.Generator().manual_seed(1234)
    it = batches(val, T, B, gen)
    ntp = mtp = [0.0] * 0
    sums = {"ntp": 0.0, "acc": 0.0}
    kl_h = [0.0] * model.K; tv_h = [0.0] * model.K; ce_h = [0.0] * model.K; agree = [0.0] * model.K
    for _ in range(nb):
        x, y, _c = next(it)
        hs = model.hiddens(x)
        W = model.head.weight
        l0 = hs[0] @ W.T
        sums["ntp"] += float(F.cross_entropy(l0.reshape(-1, l0.size(-1)), y.reshape(-1)))
        sums["acc"] += float((l0.argmax(-1) == y).float().mean())
        for k in range(1, model.K + 1):
            n = x.size(1) - k
            lk = hs[k] @ W.T
            tgt = y[:, k:k + n]
            ce_h[k - 1] += float(F.cross_entropy(lk.reshape(-1, lk.size(-1)), tgt.reshape(-1)))
            q = F.softmax(l0[:, k:k + n], -1); p = F.softmax(lk, -1)
            kl_h[k - 1] += float((q * (q.clamp_min(1e-12).log() - p.clamp_min(1e-12).log())).sum(-1).mean())
            tv_h[k - 1] += float(0.5 * (q - p).abs().sum(-1).mean())
            agree[k - 1] += float((lk.argmax(-1) == l0[:, k:k + n].argmax(-1)).float().mean())
    f = lambda v: [x / nb for x in v]
    model.train()
    ntp_l = sums["ntp"] / nb
    agree = f(agree)
    # teacher-forced expected accepted draft length (chain of per-head agreement, independence approximation)
    exp_len = 1.0; run = 1.0
    for a in agree:
        run *= a; exp_len += run
    return {"val_ntp": ntp_l, "val_acc": sums["acc"] / nb, "val_mtp_ce": f(ce_h), "kl_to_verifier": f(kl_h),
            "tv_to_verifier": f(tv_h), "agree_with_verifier": agree, "exp_accept_len_chain": exp_len}


def flat_grad(params):
    return torch.cat([(p.grad if p.grad is not None else torch.zeros_like(p)).reshape(-1) for p in params])


def snr_analysis(model, val, M=40, T=64, B=8, lam=1.0):
    """Toy analogue of the paper's Fig. 3: SNR of g_hard, g_KL and g_res w.r.t. the trunk parameters."""
    model.eval()
    gen = torch.Generator().manual_seed(77)
    it = batches(val, T, B, gen)
    ps = model.trunk_params()
    acc = {k: [] for k in ["hard", "kl", "res"]}
    for _ in range(M):
        x, y, _c = next(it)
        gs = {}
        for name in ["hard", "kl"]:
            model.zero_grad(set_to_none=True)
            hs = model.hiddens(x)
            hs = [hs[0].detach()] + hs[1:]    # only the MTP-head path reaches the trunk
            W = model.head.weight
            K = model.K
            terms = []
            for k in range(1, K + 1):
                n = T - k
                hk = hs[k]
                if name == "hard":
                    terms.append(F.cross_entropy((hk @ W.T).reshape(-1, W.size(0)), y[:, k:k + n].reshape(-1)))
                else:
                    teacher = (hs[0][:, k:k + n] @ W.T)
                    student = hk @ W.T
                    terms.append((F.softmax(teacher, -1) * (F.log_softmax(teacher, -1) - F.log_softmax(student, -1))).sum(-1).mean())
            (lam * torch.stack(terms).mean()).backward()
            gs[name] = flat_grad(ps).clone()
        acc["hard"].append(gs["hard"]); acc["kl"].append(gs["kl"]); acc["res"].append(gs["hard"] - gs["kl"])
    out = {}
    for k, gl in acc.items():
        G = torch.stack(gl)
        mean = G.mean(0)
        e_sq = float((G ** 2).sum(-1).mean())
        s_biased = float((mean ** 2).sum())
        # unbiased signal estimate (McCandlish et al.): remove tr(Sigma)/M
        tr_sigma = (e_sq - s_biased) * M / (M - 1)
        s = s_biased - tr_sigma / M
        n = e_sq - s
        out[k] = {"snr": s / n if n > 0 else float("nan"), "signal": s, "noise": n, "rms_norm": math.sqrt(e_sq)}
    hs_norm = out["hard"]["rms_norm"]
    out["residual_norm_share"] = out["res"]["rms_norm"] / hs_norm
    out["kl_norm_share"] = out["kl"]["rms_norm"] / hs_norm
    model.train()
    return out


def run(objective, seed, steps, B=16, T=64, lr=3e-3, outfile="results.jsonl", do_snr=False):
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    data = load_tokens()
    cut = int(0.9 * data.numel())
    train, val = data[:cut], data[cut:]
    model = LM(K=3 if objective != "ntp" else 3)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, betas=(0.9, 0.95), weight_decay=0.1)
    gen = torch.Generator().manual_seed(1000 + seed)
    it = batches(train, T, B, gen)
    warm = 40
    t0 = time.time(); curve = []
    for step in range(steps):
        cur = lr * min(1.0, (step + 1) / warm) * (0.5 * (1 + math.cos(math.pi * step / steps)) * 0.9 + 0.1)
        for g in opt.param_groups: g["lr"] = cur
        x, y, _c = next(it)
        hs = model.hiddens(x, heads=(objective != "ntp"))
        loss, parts = objective_loss(model, hs, y, objective)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        if (step + 1) % 100 == 0:
            curve.append({"step": step + 1, "train_ntp": parts["ntp"], "train_mtp": parts["mtp"]})
    secs = time.time() - t0
    rec = {"objective": objective, "seed": seed, "steps": steps, "seconds": round(secs, 1), "sec_per_step": round(secs / steps, 4),
           "peak_rss_mb": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1),
           "n_params": sum(p.numel() for p in model.parameters()), "val": evaluate(model, val), "curve": curve}
    if do_snr:
        rec["snr"] = snr_analysis(model, val)
    with open(os.path.join(HERE, outfile), "a") as f:
        f.write(json.dumps(rec) + "\n")
    print(objective, seed, rec["val"]["val_ntp"], rec["sec_per_step"], flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--objective"); ap.add_argument("--seed", type=int); ap.add_argument("--steps", type=int, default=500)
    ap.add_argument("--snr", action="store_true"); ap.add_argument("--out", default="results.jsonl")
    a = ap.parse_args()
    run(a.objective, a.seed, a.steps, outfile=a.out, do_snr=a.snr)
