"""Autograd wrapper around the simulated FP8 attention of fp8sim.py: FP8 forward, backward with a chosen delta."""
import torch
from fp8sim import q8_blocks, q8_rowgroups, q8_tiles, row_residual

STATS = {"pre": [], "post": []}
CAUSAL = {}


def _mask(T):
    if T not in CAUSAL:
        CAUSAL[T] = torch.ones(T, T, dtype=torch.bool).tril()
    return CAUSAL[T]


def _fwd_ops(q, k, v):
    B, H, T, D = q.shape
    tau = D ** -0.5
    blk = 128 if T % 128 == 0 else 64
    Qh = q8_blocks(q * tau, blk, -2)
    Kh = q8_blocks(k, 64, -2)
    Vh = q8_blocks(v, 64, -2)
    S = (Qh @ Kh.transpose(-1, -2)).masked_fill(~_mask(T), float("-inf"))
    P = torch.softmax(S, -1)
    Ph = q8_rowgroups(P, 64)
    return Qh, Kh, Vh, P, Ph, tau, blk


class FP8Attn(torch.autograd.Function):
    @staticmethod
    def forward(ctx, q, k, v, mode):
        Qh, Kh, Vh, P, Ph, tau, blk = _fwd_ops(q.detach(), k.detach(), v.detach())
        Ob = (Ph @ Vh).to(torch.bfloat16).float()
        ctx.save_for_backward(q, k, v, Ob)
        ctx.mode = mode
        return Ob

    @staticmethod
    def backward(ctx, dO):
        q, k, v, Ob = ctx.saved_tensors
        Qh, Kh, Vh, P, Ph, tau, blk = _fwd_ops(q, k, v)
        T = q.shape[-2]
        dO_b = dO.to(torch.bfloat16).float()
        dOh = q8_blocks(dO_b, blk, -2)
        dPh = dOh @ Vh.transpose(-1, -2)
        if ctx.mode == "stale":
            delta = (dO_b * Ob).sum(-1, keepdim=True)
        elif ctx.mode == "consistent":
            delta = (dOh * Ob).sum(-1, keepdim=True)
        else:
            delta = (P * dPh).sum(-1, keepdim=True)
        dS = (P * (dPh - delta)).masked_fill(~_mask(T), 0.0)
        dSc = q8_tiles(dS, 64, 64)
        if len(STATS["pre"]) < 100000:
            STATS["pre"].append(float(row_residual(dS, skip=8).median()))
            STATS["post"].append(float(row_residual(dSc, skip=8).median()))
        dq = (dSc @ Kh) * tau
        dk = dSc.transpose(-1, -2) @ Qh
        dv = Ph.transpose(-1, -2) @ dOh
        return dq, dk, dv, None
