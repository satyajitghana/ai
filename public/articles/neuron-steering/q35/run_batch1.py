import json, os, struct, sys, time, resource
import numpy as np, requests, torch

torch.set_num_threads(int(os.environ.get("THREADS", "3")))
REPO = "Qwen/Qwen3.5-4B"
BASE = f"https://huggingface.co/{REPO}/resolve/main/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results.json")
DT = {"BF16": torch.bfloat16, "F32": torch.float32, "F16": torch.float16, "I64": torch.int64}
sess = requests.Session()

def rng_get(url, a, b):
    r = sess.get(url, headers={"Range": f"bytes={a}-{b}"}, timeout=300)
    r.raise_for_status()
    return r.content

def shard_header(url):
    n = struct.unpack("<Q", rng_get(url, 0, 7))[0]
    h = json.loads(rng_get(url, 8, 8 + n - 1))
    h.pop("__metadata__", None)
    return h, 8 + n

def stream_tensor(url, base, info):
    a, b = info["data_offsets"]
    buf = bytearray(b - a)
    mv = memoryview(buf)
    pos, CH = 0, 256 * 1024 * 1024
    while pos < b - a:
        e = min(pos + CH, b - a)
        r = sess.get(url, headers={"Range": f"bytes={base + a + pos}-{base + a + e - 1}"}, stream=True, timeout=600)
        r.raise_for_status()
        got = 0
        for chunk in r.iter_content(1 << 20):
            mv[pos + got: pos + got + len(chunk)] = chunk
            got += len(chunk)
        pos += got
    t = torch.frombuffer(buf, dtype=DT[info["dtype"]]).reshape(info["shape"])
    return t

import torch.nn as nn, torch.nn.functional as F

class QLinear(nn.Module):
    def __init__(self, q, sc, need_col=False):
        super().__init__()
        self.out_features, self.in_features = q.shape
        self.colnorm = (q.float() * sc[:, None]).norm(dim=0) if need_col else None
        qw = torch._make_per_channel_quantized_tensor(q, sc, torch.zeros(q.shape[0], dtype=torch.int64), 0)
        self.pk = torch.ops.quantized.linear_prepack(qw, None)
    def forward(self, x):
        x2 = x.reshape(-1, self.in_features).float()
        y = torch.ops.quantized.linear_dynamic(x2, self.pk, False)
        return y.reshape(*x.shape[:-1], self.out_features).to(x.dtype)

def quantize(t):
    t = t.float()
    sc = t.abs().amax(dim=1).clamp_min(1e-8) / 127.0
    q = torch.round(t / sc[:, None]).clamp_(-127, 127).to(torch.int8)
    return q, sc

def set_module(root, path, mod):
    parts = path.split(".")
    for p in parts[:-1]:
        root = getattr(root, p)
    setattr(root, parts[-1], mod)

def load_model():
    from transformers import AutoConfig, AutoModelForImageTextToText
    cfg = AutoConfig.from_pretrained(REPO)
    with torch.device("meta"):
        model = AutoModelForImageTextToText.from_config(cfg, dtype=torch.bfloat16)
    idx = json.loads(rng_get(BASE + "model.safetensors.index.json", 0, 10_000_000).decode()) if False else requests.get(BASE + "model.safetensors.index.json", timeout=60).json()
    shards = sorted(set(idx["weight_map"].values()))
    CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache.pt")
    sd = {}
    qmods = {}
    lin_names = {n for n, m in model.named_modules() if isinstance(m, nn.Linear) and n not in ("lm_head",) and not n.startswith("model.visual")}
    t0 = time.time()
    if os.path.exists(CACHE):
        c = torch.load(CACHE, mmap=True)
        sd = c["sd"]
        qmods = {}
        for k in list(c["q"].keys()):
            q, sc = c["q"].pop(k)
            qmods[k] = QLinear(q, sc, k.endswith("down_proj"))
            del q, sc
        del c
        shards = []
        print(f"cache loaded in {time.time()-t0:.0f}s", flush=True)
    for s in shards:
        url = BASE + s
        hdr, base = shard_header(url)
        for k, info in sorted(hdr.items(), key=lambda kv: kv[1]["data_offsets"][0]):
            if k.startswith("model.visual") or k.startswith("mtp"):
                continue
            t = stream_tensor(url, base, info)
            mp = k[:-len(".weight")] if k.endswith(".weight") else None
            if mp in lin_names and t.dim() == 2:
                qmods[mp] = QLinear(*quantize(t), need_col=mp.endswith("down_proj"))
                del t
            else:
                sd[k] = t
        print(f"shard {s}: {len(hdr)} tensors, {time.time()-t0:.0f}s, rss {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1e6:.1f} GB", flush=True)
    if not os.path.exists(CACHE):
        pass
        print("cache saved", flush=True)
    for mp, qm in qmods.items():
        set_module(model, mp, qm)
    missing, unexpected = model.load_state_dict(sd, strict=False, assign=True)
    missing = [m for m in missing if not m.startswith("model.visual") and not m.startswith("mtp")]
    print("missing", len(missing), missing[:5], "unexpected", len(unexpected), unexpected[:5], flush=True)
    if "lm_head.weight" in missing or any("lm_head" in m for m in missing):
        model.tie_weights()
    # rotary buffers etc. were on meta: re-init non-persistent buffers
    for name, mod in list(model.named_modules()):
        if name.startswith("model.visual"): continue
        if "rotary" in type(mod).__name__.lower() and any(b.is_meta for b in mod.buffers(recurse=False)):
            print("re-init", name, type(mod).__name__, flush=True)
            set_module(model, name, type(mod)(config=cfg.text_config))
    for name, mod in model.named_modules():
        if name.startswith("model.visual"): continue
        for bn, b in list(mod.named_buffers(recurse=False)):
            if b.is_meta:
                raise RuntimeError(f"meta buffer left: {name}.{bn}")
        for pn, p in list(mod.named_parameters(recurse=False)):
            if p.is_meta:
                raise RuntimeError(f"meta param left: {name}.{pn}")
    model.eval()
    return model

def main():
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(REPO)
    t0 = time.time()
    model = load_model()
    print(f"loaded in {time.time()-t0:.0f}s", flush=True)
    lm = model.model.language_model
    layers = lm.layers
    L = len(layers)

    ref = ("The lighthouse keeper climbed the stairs each evening, counted the steps out of habit, and lit the lamp "
           "just as the last boat turned toward the harbour. Below him the sea kept its own accounts: tides, "
           "currents, the slow wearing of the rock. He wrote the weather in a notebook and went to bed.")
    ids = tok(ref, return_tensors="pt")
    norms = [None] * L
    hs = []
    def mk(i):
        def fh(mod, inp, out):
            o = out[0] if isinstance(out, tuple) else out
            hs.append((i, o.detach().float().norm(dim=-1)[0, 1:]))
        return fh
    hooks = [layers[i].register_forward_hook(mk(i)) for i in range(L)]
    with torch.no_grad():
        model(**ids)
    for h in hooks: h.remove()
    med = [None] * L
    for i, n in hs: med[i] = float(n.median())
    print("median resid norm L0/L14/L31:", med[0], med[14], med[L - 1], flush=True)

    steer = {}  # layer -> list of (neuron, delta)
    def set_recipe(recipe):
        steer.clear()
        for (l, n, dose) in recipe:
            col = float(layers[l].mlp.down_proj.colnorm[n])
            steer.setdefault(l, []).append((n, dose * med[l] / col))
    def mkpre(l):
        def pre(mod, args):
            x = args[0]
            if l in steer:
                x = x.clone()
                for n, d in steer[l]:
                    x[..., n] += d
                return (x,)
        return pre
    for l in range(L):
        layers[l].mlp.down_proj.register_forward_pre_hook(mkpre(l))

    RECIPES = {
        "baseline": [],
        "villain (L14 N8949 +1, L13 N7956 -1)": [(14, 8949, 1.0), (13, 7956, -1.0)],
        "golden-gate (L6 N7448 -0.8, L5 N6203 -0.75, L25 N8324 -0.4)": [(6, 7448, -0.8), (5, 6203, -0.75), (25, 8324, -0.4)],
    }
    PROMPTS = ["write about whatever you want", "Who are you, and what do you want?", "Give me three tips for a good night's sleep."]
    res = {"model": REPO, "layers": L, "median_resid_norm": med, "runs": []}
    if os.path.exists(OUT):
        try: res["runs"] = json.load(open(OUT))["runs"]
        except Exception: pass
    done = {(r["recipe"], r["prompt"]) for r in res["runs"]}
    for rname, rec in RECIPES.items():
        set_recipe(rec)
        for p in PROMPTS:
            if (rname, p) in done: continue
            msgs = [{"role": "user", "content": p}]
            try:
                text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
            except TypeError:
                text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
            enc = tok(text, return_tensors="pt")
            t1 = time.time()
            with torch.no_grad():
                out = model.generate(**enc, max_new_tokens=int(os.environ.get("NEW", "70")), do_sample=False)
            dt = time.time() - t1
            gen = tok.decode(out[0, enc["input_ids"].shape[1]:], skip_special_tokens=True)
            n_new = out.shape[1] - enc["input_ids"].shape[1]
            res["runs"].append({"recipe": rname, "prompt": p, "text": gen, "new_tokens": int(n_new), "sec": round(dt, 1)})
            json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)
            print(f"[{rname[:12]}] {p[:30]!r}: {n_new} tok {dt:.0f}s :: {gen[:140]!r}", flush=True)
    print("peak rss GB", resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6, flush=True)

main()
