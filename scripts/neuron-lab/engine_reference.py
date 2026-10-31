"""PyTorch reference for the in-browser engine (components/neuron-lab/engine).

Writes, into --out:
  ref.json          tokenizer ids for the test set, prompt token ids, summary numbers
  logits.f32        last-position logits, float32 [n_prompts, vocab]
  logits_steer.f32  same for the steering cases (neuron hook on down_proj's input)
  act_max.f32       max-over-tokens MLP hidden activation, float32 [n_texts, 28*3072]
  calibration.json  {resNormMedian, colNorm} of this checkout's own small corpus (test use only)

The model is run in float32 (or bfloat16 with --dtype, for the 0.8B on a small box) from the original
safetensors, the engine in Q8_0: any disagreement is the quantization (and bf16 rounding), nothing else.
Run: nice -n 19 python engine_reference.py --arch qwen3|qwen35 [--dtype bfloat16] \
  --model <dir with model.safetensors, config.json, tokenizer.json> --out <dir> [--prompts test-prompts-q35.json]
"""
import argparse, json, os
import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoModelForImageTextToText, AutoTokenizer

torch.set_num_threads(2)
ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--arch", default="qwen3", choices=["qwen3", "qwen35"])
ap.add_argument("--dtype", default="float32", choices=["float32", "bfloat16"])
ap.add_argument("--prompts", default=os.path.join(os.path.dirname(__file__), "test-prompts.json"))
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
T = json.load(open(a.prompts))

tok = AutoTokenizer.from_pretrained(a.model)
dt = getattr(torch, a.dtype)
model = (AutoModelForImageTextToText if a.arch == "qwen35" else AutoModelForCausalLM).from_pretrained(a.model, dtype=dt).eval()
cfg = getattr(model.config, "text_config", model.config)
LAYERS = model.model.language_model.layers if a.arch == "qwen35" else model.model.layers
NL, NI = cfg.num_hidden_layers, cfg.intermediate_size

ref = {"tokenizer": [], "prompts": [], "steers": [], "n_layers": NL, "inter": NI, "vocab": cfg.vocab_size}
for s in T["prompts"] + T["tokenizerExtra"] + [p["prompt"] for p in T["steers"]] + T["activationTexts"]:
    ref["tokenizer"].append({"text": s, "ids": tok(s, add_special_tokens=False)["input_ids"]})

# ---- calibration on a small corpus (this is only for the parity test; the site uses meta.json)
CORPUS = T["activationTexts"] + T["prompts"]
res = [[] for _ in range(NL)]
hooks = []
for l, layer in enumerate(LAYERS):
    hooks.append(layer.register_forward_hook(lambda m, i, o, l=l: res[l].append((o[0] if isinstance(o, tuple) else o)[0, 1:].norm(dim=-1))))
with torch.no_grad():
    for s in CORPUS:
        ids = tok(s, return_tensors="pt", add_special_tokens=False)
        model(**ids)
for h in hooks: h.remove()
resNorm = [float(torch.cat(r).median()) for r in res]
colNorm = [layer.mlp.down_proj.weight.float().norm(dim=0).tolist() for layer in LAYERS]
json.dump({"resNormMedian": resNorm, "colNorm": colNorm}, open(os.path.join(a.out, "calibration.json"), "w"))

def run(prompt, steers):
    hs = []
    by_layer = {}
    for s in steers:
        by_layer.setdefault(s["layer"], []).append(s)
    for l, ss in by_layer.items():
        def pre(m, args, ss=ss, l=l):
            x = args[0].clone()
            for s in ss:
                x[..., s["neuron"]] += s["dose"] * resNorm[l] / colNorm[l][s["neuron"]]
            return (x,)
        hs.append(LAYERS[l].mlp.down_proj.register_forward_pre_hook(pre))
    ids = tok(prompt, return_tensors="pt", add_special_tokens=False)
    with torch.no_grad():
        lg = model(**ids).logits[0, -1].float().numpy()
    for h in hs: h.remove()
    return lg

L = np.stack([run(p, []) for p in T["prompts"]])
L.astype(np.float32).tofile(os.path.join(a.out, "logits.f32"))
LS, LB = [], []
for c in T["steers"]:
    LB.append(run(c["prompt"], []))
    LS.append(run(c["prompt"], c["steers"]))
np.stack(LS).astype(np.float32).tofile(os.path.join(a.out, "logits_steer.f32"))
np.stack(LB).astype(np.float32).tofile(os.path.join(a.out, "logits_steer_base.f32"))

# activations: max over tokens of silu(gate)*up, i.e. the input of down_proj
AM = []
for s in T["activationTexts"]:
    mx = np.full((NL, NI), -np.inf, dtype=np.float32)
    hs = []
    for l, layer in enumerate(LAYERS):
        def pre(m, args, l=l):
            v = args[0][0].max(dim=0).values.float().numpy()
            mx[l] = np.maximum(mx[l], v)
        hs.append(layer.mlp.down_proj.register_forward_pre_hook(pre))
    with torch.no_grad():
        model(**tok(s, return_tensors="pt", add_special_tokens=False))
    for h in hs: h.remove()
    AM.append(mx.reshape(-1))
np.stack(AM).astype(np.float32).tofile(os.path.join(a.out, "act_max.f32"))

# greedy continuations (float32) for a first-divergence comparison with the engine
gen = []
for p in T["prompts"][:8]:
    ids = tok(p, return_tensors="pt", add_special_tokens=False)
    with torch.no_grad():
        o = model.generate(**ids, max_new_tokens=24, do_sample=False)
    gen.append({"prompt": p, "ids": o[0, ids["input_ids"].shape[1]:].tolist()})
ref["greedy"] = gen
json.dump(ref, open(os.path.join(a.out, "ref.json"), "w"))
print("ok", len(ref["tokenizer"]), "tokenizer cases;", L.shape, "logits")
