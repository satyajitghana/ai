"""Simulated block-scaled E4M3 attention, forward and backward, for the Delta-Matching toy.

Our own re-implementation of the quantities defined in the paper's Section 3 and Appendix B.6 (not the authors'
kernel): E4M3 codes with an FP32 scale per block (scale = max|X| / 448), P quantized in 64-key groups, V in 64-key
blocks, Q and dO in 128-row blocks, FP32 accumulation, the output stored in BF16.
"""
import torch

E4M3_MAX = 448.0


def q8_blocks(x, block, dim):
    """Round x to E4M3 with one FP32 scale per `block` entries along `dim` (all other dims of that slice together
    for 2-D matrices: blocks span all channels, as in the paper). Returns the dequantized FP32 tensor."""
    x = x.float()
    n = x.shape[dim]
    assert n % block == 0
    shp = list(x.shape)
    xs = x.movedim(dim, -2)                      # (..., n, c)
    lead = xs.shape[:-2]
    xs = xs.reshape(*lead, n // block, block, xs.shape[-1])
    amax = xs.abs().amax(dim=(-2, -1), keepdim=True).clamp_min(1e-30)
    s = (amax / E4M3_MAX).to(torch.float32)
    code = (xs / s).clamp(-E4M3_MAX, E4M3_MAX).to(torch.float8_e4m3fn).to(torch.float32)
    out = (code * s).reshape(*lead, n, xs.shape[-1]).movedim(-2, dim)
    return out.reshape(shp)


def q8_rowgroups(p, group):
    """E4M3 for the probability matrix: one FP32 scale per (row, `group` keys)."""
    p = p.float()
    t = p.shape[-1]
    pg = p.reshape(*p.shape[:-1], t // group, group)
    amax = pg.abs().amax(dim=-1, keepdim=True).clamp_min(1e-30)
    s = amax / E4M3_MAX
    code = (pg / s).clamp(-E4M3_MAX, E4M3_MAX).to(torch.float8_e4m3fn).to(torch.float32)
    return (code * s).reshape(p.shape)


def q8_tiles(x, tr, tc):
    """E4M3 for dS: one FP32 scale per tr x tc tile of the last two dims."""
    x = x.float()
    a, b = x.shape[-2], x.shape[-1]
    xt = x.reshape(*x.shape[:-2], a // tr, tr, b // tc, tc)
    amax = xt.abs().amax(dim=(-3, -1), keepdim=True).clamp_min(1e-30)
    s = amax / E4M3_MAX
    code = (xt / s).clamp(-E4M3_MAX, E4M3_MAX).to(torch.float8_e4m3fn).to(torch.float32)
    return (code * s).reshape(x.shape)


def attention_fp8(q, k, v, dO, mode, quant_dS=False, tile=(64, 64)):
    """One attention head batch. q,k,v,dO: (B, H, T, D) FP32 holding BF16-representable values.
    Returns dict with O (BF16-rounded), dS (FP32 before any cast), dS_cast (if quant_dS), dq, dk, dv and diagnostics.
    mode: 'stale' | 'consistent' | 'matched'."""
    B, H, T, D = q.shape
    tau = D ** -0.5
    Qh = q8_blocks(q * tau, 128 if T % 128 == 0 else 64, dim=-2)      # tau folded into the query operand
    Kh = q8_blocks(k, 64, dim=-2)
    Vh = q8_blocks(v, 64, dim=-2)
    S = Qh @ Kh.transpose(-1, -2)
    mask = torch.ones(T, T, dtype=torch.bool).tril()
    S = S.masked_fill(~mask, float("-inf"))
    P = torch.softmax(S, dim=-1)                                      # FP32 probabilities before the cast
    Ph = q8_rowgroups(P, 64)                                          # what the forward multiplies with V
    O32 = Ph @ Vh
    Ob = O32.to(torch.bfloat16).float()                               # output stored in BF16
    dO_b = dO.to(torch.bfloat16).float()
    dOh = q8_blocks(dO_b, 128 if T % 128 == 0 else 64, dim=-2)
    dPh = dOh @ Vh.transpose(-1, -2)                                  # FP32 product of FP8 operands
    if mode == "stale":
        delta = (dO_b * Ob).sum(-1, keepdim=True)                     # rowsum(dO * O): BF16 dO and saved BF16 O
    elif mode == "consistent":
        delta = (dOh * Ob).sum(-1, keepdim=True)                      # dequantized dO in the shortcut
    elif mode == "matched":
        delta = (P * dPh).sum(-1, keepdim=True)                       # from the backward's own P and dP
    else:
        raise ValueError(mode)
    dS = P * (dPh - delta)
    dS = dS.masked_fill(~mask, 0.0)
    dSc = q8_tiles(dS, *tile) if quant_dS else dS
    dq = (dSc @ Kh) * tau
    dk = dSc.transpose(-1, -2) @ Qh
    dv = Ph.transpose(-1, -2) @ dOh
    return dict(O=Ob, P=P, dS=dS, dS_cast=dSc, dq=dq, dk=dk, dv=dv)


def row_residual(dS, skip=16):
    """Normalized row-sum residual |sum_j dS_ij| / sum_j |dS_ij| per row (paper eq. 23), skipping the first rows."""
    num = dS.sum(-1).abs()
    den = dS.abs().sum(-1)
    r = num / den.clamp_min(1e-30)
    return r[..., skip:][den[..., skip:] > 0]
