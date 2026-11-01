"""Numerical check of the KL gradient-recovery trick (float64, CPU).

Setup: a shared output head W (V x d), an NTP hidden state h0[t] per position and K MTP hidden states
hk[k][t] (k = 1..K). Position t of head k predicts token x[t+k+1] (so NTP at position t predicts x[t+1]).
The position-aligned NTP distribution for head k at position t is q = softmax(W h0[t+k]).

We check, over many random instances:
  A. forward value of the augmented NTP loss == plain NTP loss (bit-exact).
  B. grad wrt h0 is unchanged by the augmentation.
  C. grad wrt every hk[k][t] of (augmented NTP + hard MTP) == W^T (p - q) (= grad of KL(sg(q) || p)).
  D. the same with the repo's per-head mean normalisation and lambda/K weighting (scale s_k).
  E. through a trunk (parameters theta): trunk gradient of soft == trunk gradient of an explicit
     CE_ntp + lambda/K * sum_k KL(sg(q)||p) objective; and W gradient of soft == W gradient of hard MTP
     (CE), which differs from the explicit-KL objective's W gradient.
"""
import json, sys, time
import torch

torch.set_default_dtype(torch.float64)


def ce_sum(logits, y):
    return torch.nn.functional.cross_entropy(logits, y, reduction="sum")


def instance(seed, V, d, T, K):
    g = torch.Generator().manual_seed(seed)
    W = (torch.randn(V, d, generator=g) * 0.5).requires_grad_(True)
    h0 = torch.randn(T, d, generator=g).requires_grad_(True)
    hk = [torch.randn(T - k, d, generator=g).requires_grad_(True) for k in range(1, K + 1)]
    x = torch.randint(0, V, (T + 1,), generator=g)  # x[0..T]; NTP at t predicts x[t+1]
    return W, h0, hk, x


def losses_hard(W, h0, hk, x, T, K, lam, mean=True):
    ntp = ce_sum(h0 @ W.T, x[1:T + 1])
    parts = []
    for k in range(1, K + 1):
        n = T - k
        # head k at position t predicts x[t+k+1]  for t = 0..T-k-1 ; last needed index T
        lk = ce_sum(hk[k - 1][:n] @ W.T, x[k + 1:k + 1 + n])
        parts.append(lk)
    return ntp, parts


def aligned_q(W, h0, k, n):
    return torch.softmax(h0[k:k + n] @ W.T, dim=-1)


def run_case(seed, V, d, T, K, lam=1.0):
    out = {}
    W, h0, hk, x = instance(seed, V, d, T, K)
    d = W.shape[1]
    # ---- hard (unnormalised sums, so the algebra is exactly the paper's) ----
    ntp, parts = losses_hard(W, h0, hk, x, T, K, lam)
    hard_total = ntp + sum(parts)
    g_hard = torch.autograd.grad(hard_total, [h0] + hk + [W], retain_graph=True)

    # ---- soft: augmented NTP hidden ----
    h0a = h0.clone()
    for k in range(1, K + 1):
        n = T - k
        # sum form of the paper (eq. 4): NTP hidden at t+k receives sg(h^k_t) - h^k_t
        pad = torch.zeros_like(h0)
        pad = torch.cat([torch.zeros(k, d), hk[k - 1].detach() - hk[k - 1]], dim=0)[:T]
        h0a = h0a + pad
    ntp_aug = ce_sum(h0a @ W.T, x[1:T + 1])
    soft_total = ntp_aug + sum(parts)
    out["A_forward_value_diff"] = float((ntp_aug - ntp).abs())
    g_soft = torch.autograd.grad(soft_total, [h0] + hk + [W], retain_graph=True)
    out["B_h0_grad_maxabs_diff"] = float((g_soft[0] - g_hard[0]).abs().max())

    # ---- reference: gradient of KL(sg(q) || p) wrt hk, with W held fixed for the hk path ----
    worst = 0.0
    rel = 0.0
    for k in range(1, K + 1):
        n = T - k
        q = aligned_q(W, h0, k, n).detach()
        p = torch.softmax(hk[k - 1][:n] @ W.T, dim=-1)
        # closed form g_KL = W^T (p - q)
        g_kl_closed = (p - q) @ W
        # autograd of the explicit KL
        logp = torch.log_softmax(hk[k - 1][:n] @ W.T, dim=-1)
        kl = (q * (torch.log(q) - logp)).sum()
        g_kl_auto = torch.autograd.grad(kl, hk[k - 1], retain_graph=True)[0][:n]
        gs = g_soft[k][:n]
        worst = max(worst, float((gs - g_kl_auto).abs().max()), float((g_kl_closed - g_kl_auto).abs().max()))
        rel = max(rel, float((gs - g_kl_auto).norm() / g_kl_auto.norm().clamp_min(1e-300)))
    out["C_hk_grad_maxabs_diff"] = worst
    out["C_hk_grad_max_relative_diff"] = rel

    # ---- hard gradient vs KL + residual split ----
    shares = []
    for k in range(1, K + 1):
        n = T - k
        q = aligned_q(W, h0, k, n).detach()
        p = torch.softmax(hk[k - 1][:n] @ W.T, dim=-1).detach()
        onehot = torch.nn.functional.one_hot(x[k + 1:k + 1 + n], V).to(p.dtype)
        g_kl = (p - q) @ W
        g_res = (q - onehot) @ W
        g_h = (p - onehot) @ W
        shares.append(float((g_h - (g_kl + g_res)).abs().max()))
    out["decomp_identity_maxabs"] = max(shares)

    # ---- D. repo-style normalisation: NTP mean over T, head-k mean over T-k, lambda/K weighting ----
    h0b = h0.clone()
    heads_mean = []
    for k in range(1, K + 1):
        n = T - k
        heads_mean.append(ce_sum(hk[k - 1][:n] @ W.T, x[k + 1:k + 1 + n]) / n)
    for k in range(1, K + 1):
        n = T - k
        s_k = lam * T / (K * n)  # repo: mtp_weight * n_ntp_supervised / (n_heads * n_head_supervised)
        pad = torch.cat([torch.zeros(k, d), s_k * (hk[k - 1].detach() - hk[k - 1])], dim=0)[:T]
        h0b = h0b + pad
    ntp_b = ce_sum(h0b @ W.T, x[1:T + 1]) / T
    total_b = ntp_b + lam * torch.stack(heads_mean).mean()
    g_b = torch.autograd.grad(total_b, hk, retain_graph=True)
    worst_d = 0.0
    for k in range(1, K + 1):
        n = T - k
        q = aligned_q(W, h0, k, n).detach()
        p = torch.softmax(hk[k - 1][:n] @ W.T, dim=-1).detach()
        target = (lam / (K * n)) * ((p - q) @ W)
        worst_d = max(worst_d, float((g_b[k - 1][:n] - target).abs().max()))
    out["D_normalised_hk_grad_maxabs_diff"] = worst_d
    return out


def trunk_case(seed, V=40, d=12, T=20, K=2, lam=0.7):
    """E: a tiny trunk so the gradient reaches parameters theta."""
    g = torch.Generator().manual_seed(seed)
    din = 9
    Xin = torch.randn(T, din, generator=g)
    x = torch.randint(0, V, (T + 1,), generator=g)
    A0 = (torch.randn(din, d, generator=g) * 0.4).requires_grad_(True)           # trunk
    Ak = [(torch.randn(d, d, generator=g) * 0.4).requires_grad_(True) for _ in range(K)]  # MTP heads
    W = (torch.randn(V, d, generator=g) * 0.5).requires_grad_(True)             # shared output head

    def forward():
        z = torch.tanh(Xin @ A0)           # shared trunk output
        h0 = z                              # NTP hidden
        hk = [torch.tanh(z @ Ak[k]) for k in range(K)]   # MTP hiddens (position t)
        return h0, hk

    def hard_obj():
        h0, hk = forward()
        L = ce_sum(h0 @ W.T, x[1:T + 1]) / T
        for k in range(1, K + 1):
            n = T - k
            L = L + lam / K * ce_sum(hk[k - 1][:n] @ W.T, x[k + 1:k + 1 + n]) / n
        return L

    def soft_obj():
        h0, hk = forward()
        h0a = h0
        for k in range(1, K + 1):
            n = T - k
            s_k = lam * T / (K * n)
            h0a = h0a + torch.cat([torch.zeros(k, d), s_k * (hk[k - 1].detach() - hk[k - 1])], 0)[:T]
        L = ce_sum(h0a @ W.T, x[1:T + 1]) / T
        for k in range(1, K + 1):
            n = T - k
            L = L + lam / K * ce_sum(hk[k - 1][:n] @ W.T, x[k + 1:k + 1 + n]) / n
        return L

    def klmtp_obj():
        h0, hk = forward()
        L = ce_sum(h0 @ W.T, x[1:T + 1]) / T
        for k in range(1, K + 1):
            n = T - k
            q = torch.softmax(h0[k:k + n] @ W.T, -1).detach()   # sg teacher
            logp = torch.log_softmax(hk[k - 1][:n] @ W.T, -1)
            L = L + lam / K * (q * (torch.log(q) - logp)).sum() / n
        return L

    params = [A0] + Ak + [W]
    gs = torch.autograd.grad(soft_obj(), params)
    gh = torch.autograd.grad(hard_obj(), params)
    gk = torch.autograd.grad(klmtp_obj(), params)
    names = ["trunk A0"] + [f"head{k}" for k in range(1, K + 1)] + ["W"]
    res = {}
    for nme, a, b, c in zip(names, gs, gh, gk):
        res[nme] = {"soft_vs_klmtp_maxabs": float((a - c).abs().max()), "soft_vs_hard_maxabs": float((a - b).abs().max()),
                    "klmtp_vs_hard_maxabs": float((c - b).abs().max()), "scale": float(a.abs().max())}
    return res


if __name__ == "__main__":
    t0 = time.time()
    cases = []
    rng = torch.Generator().manual_seed(2610)
    for i in range(300):
        V = int(torch.randint(8, 400, (1,), generator=rng))
        d = int(torch.randint(4, 64, (1,), generator=rng))
        T = int(torch.randint(6, 40, (1,), generator=rng))
        K = int(torch.randint(1, min(5, T - 2), (1,), generator=rng))
        lam = float(torch.rand(1, generator=rng) * 1.5 + 0.25)
        r = run_case(i, V, d, T, K, lam)
        r.update(dict(V=V, d=d, T=T, K=K, lam=lam))
        cases.append(r)
    keys = ["A_forward_value_diff", "B_h0_grad_maxabs_diff", "C_hk_grad_maxabs_diff", "C_hk_grad_max_relative_diff",
            "decomp_identity_maxabs", "D_normalised_hk_grad_maxabs_diff"]
    summary = {k: {"max": max(c[k] for c in cases), "median": sorted(c[k] for c in cases)[len(cases) // 2]} for k in keys}
    trunk = [trunk_case(s) for s in range(40)]
    tsum = {}
    for nme in trunk[0]:
        tsum[nme] = {m: max(t[nme][m] for t in trunk) for m in ["soft_vs_klmtp_maxabs", "soft_vs_hard_maxabs", "klmtp_vs_hard_maxabs", "scale"]}
    json.dump({"n_cases": len(cases), "dtype": "float64", "summary": summary, "trunk_summary": tsum, "seconds": round(time.time() - t0, 1)},
              open(sys.argv[1] if len(sys.argv) > 1 else "verify_trick.json", "w"), indent=1)
    print(json.dumps({"summary": summary, "trunk_summary": tsum}, indent=1))
