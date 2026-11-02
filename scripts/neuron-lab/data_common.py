"""Shared helpers for the neuron-lab DATA pipeline, driven by a model config (CPU, fp32).

Choose the model with NL_MODEL (default qwen3-0.6b).  Run with:
  NL_MODEL=qwen3.5-0.8b HF_HOME=<cache> NL_SCRATCH=<scratch> nice -n 19 /root/kokoro-venv/bin/python scripts/neuron-lab/<script>.py
Scratch (activations, caches) lives under $NL_SCRATCH, never in the repo.  For qwen3-0.6b the scratch files sit directly in
$NL_SCRATCH (the layout the first run used); every other model gets its own $NL_SCRATCH/<slug>/ folder.
"""
import os, json, glob, math, random
import torch

torch.set_num_threads(int(os.environ.get("NL_THREADS", "2")))

# layers/neurons/hidden: MLP intermediate size is the neuron count per layer.
# norm_offset: RMSNorm computes x * (offset + weight): 0 for Qwen3, 1 for Qwen3.5 (zero-centred weights).
# st_prefix: tensor-name prefix of the text model inside the safetensors checkpoint.
MODELS = {
    "qwen3-0.6b":   dict(id="Qwen/Qwen3-0.6B",   layers=28, neurons=3072, hidden=1024, norm_offset=0.0, st_prefix="model"),
    "qwen3.5-0.8b": dict(id="Qwen/Qwen3.5-0.8B", layers=24, neurons=3584, hidden=1024, norm_offset=1.0, st_prefix="model.language_model"),
}
SLUG = os.environ.get("NL_MODEL", "qwen3-0.6b")
CFG = MODELS[SLUG]
MODEL = CFG["id"]
NL = CFG["layers"]       # layers
NN = CFG["neurons"]      # MLP neurons per layer
HID = CFG["hidden"]
NORM_OFFSET = CFG["norm_offset"]
ST = CFG["st_prefix"]
# discovery screens the middle of the network (layers 8..26 of 28 for the first model), scaled to the depth
LAYER_LO, LAYER_HI = round(8 * NL / 28), round(27 * NL / 28)
_BASE = os.environ.get("NL_SCRATCH", "/tmp/nl-scratch")
SCRATCH = _BASE if SLUG == "qwen3-0.6b" else os.path.join(_BASE, SLUG)
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(REPO, "public", "neuron-lab", SLUG)
FINDINGS = os.path.join(os.path.dirname(OUT), f"{SLUG}-findings.json")
os.makedirs(SCRATCH, exist_ok=True)


def checkpoint_file():
    """Local path of the (single) safetensors file of the text model; downloads it if the cache is empty."""
    from huggingface_hub import snapshot_download
    d = snapshot_download(MODEL, allow_patterns=["*.safetensors", "*.json", "merges.txt"])
    fs = sorted(glob.glob(os.path.join(d, "*.safetensors")))
    assert len(fs) == 1, fs
    return fs[0]


DTYPE = getattr(torch, os.environ.get("NL_DTYPE", "float32"))   # float32 for the first model; bfloat16 keeps the 0.8B run under the shared memory limit


def load(dtype=None):
    dtype = dtype or DTYPE
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=dtype)
    model.eval()
    for p in model.parameters():
        p.requires_grad_(False)
    # the checkpoint's tensor names may not match this class (Qwen3.5 ships a multimodal checkpoint): check, do not assume
    from safetensors import safe_open
    ref = safe_open(checkpoint_file(), framework="pt").get_tensor(f"{ST}.layers.{NL // 2}.mlp.down_proj.weight").float()
    got = model.model.layers[NL // 2].mlp.down_proj.weight.detach().float()
    assert torch.allclose(ref, got, atol=1e-2), "model weights did not load into this class: check the checkpoint key mapping"
    return tok, model


def dose_unit(res_norm_median, col_norm):
    """delta = dose * median||residual leaving layer L|| / ||W_down[:, n]||."""
    return res_norm_median / col_norm


def col_norms(model):
    return torch.stack([l.mlp.down_proj.weight.float().norm(dim=0) for l in model.model.layers])  # [layers, neurons]


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
