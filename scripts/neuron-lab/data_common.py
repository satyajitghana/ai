"""Shared helpers for the neuron-lab DATA pipeline (Qwen3-0.6B, CPU, fp32).

Run with:  HF_HOME=<scratch> nice -n 19 /root/kokoro-venv/bin/python scripts/neuron-lab/<script>.py
Scratch (activations, caches) lives under $NL_SCRATCH, never in the repo.
"""
import os, json, glob, math, random
import torch

torch.set_num_threads(int(os.environ.get("NL_THREADS", "2")))
MODEL = "Qwen/Qwen3-0.6B"
NL = 28          # layers
NN = 3072        # MLP neurons per layer
HID = 1024
SCRATCH = os.environ.get("NL_SCRATCH", "/tmp/nl-scratch")
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(REPO, "public", "neuron-lab", "qwen3-0.6b")
os.makedirs(SCRATCH, exist_ok=True)


def load(dtype=torch.float32):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=dtype)
    model.eval()
    for p in model.parameters():
        p.requires_grad_(False)
    return tok, model


def dose_unit(res_norm_median, col_norm):
    """delta = dose * median||residual leaving layer L|| / ||W_down[:, n]||."""
    return res_norm_median / col_norm


def col_norms(model):
    return torch.stack([l.mlp.down_proj.weight.float().norm(dim=0) for l in model.model.layers])  # [28,3072]


class Steer:
    """Forward pre-hooks on every down_proj. `rows` is a list (len = batch) of
    [(layer, neuron, dose), ...]; each batch row gets its own steers, added to the MLP hidden
    activation (silu(gate)*up) of that neuron at EVERY position (the neuron-explorer recipe).
    Works with KV-cache generation because the add is position independent."""

    def __init__(self, model, res_norm_median, colnorm):
        self.model = model
        self.rn = res_norm_median
        self.cn = colnorm
        self.deltas = {}
        self.hooks = []
        for L, layer in enumerate(model.model.layers):
            self.hooks.append(layer.mlp.down_proj.register_forward_pre_hook(self._mk(L)))

    def _mk(self, L):
        def hook(mod, args):
            d = self.deltas.get(L)
            if d is None:
                return None
            x = args[0]
            return (x + d.to(x.dtype)[: x.shape[0], None, :],) + tuple(args[1:])
        return hook

    def set(self, rows):
        self.deltas = {}
        B = len(rows)
        for r, steers in enumerate(rows):
            for (L, n, dose) in steers:
                if L not in self.deltas:
                    self.deltas[L] = torch.zeros(B, NN)
                self.deltas[L][r, n] += dose * float(self.rn[L]) / float(self.cn[L][n])

    def clear(self):
        self.deltas = {}

    def remove(self):
        for h in self.hooks:
            h.remove()


@torch.no_grad()
def generate_rows(tok, model, steerer, prompts, rows, max_new=40):
    """Greedy generation; prompts[i] steered by rows[i]. Left-padded batch. Returns list[str]."""
    tok.padding_side = "left"
    enc = tok(prompts, return_tensors="pt", padding=True)
    steerer.set(rows)
    out = model.generate(**enc, max_new_tokens=max_new, do_sample=False, pad_token_id=tok.pad_token_id,
                         temperature=None, top_p=None, top_k=None)
    steerer.clear()
    return [tok.decode(o[enc.input_ids.shape[1]:], skip_special_tokens=True) for o in out]


def load_meta():
    with open(os.path.join(OUT, "meta.json")) as f:
        return json.load(f)


def display_token(s):
    """Render a decoded token for display: visible whitespace markers, no control characters."""
    s = s.replace("\n", "\\n").replace("\t", "\\t").replace("\r", "\\r")
    return s if s.strip() or s == "" else s.replace(" ", "\u2423")
