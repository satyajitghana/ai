# Runs the WeVisOne-VL-4B vision tower alone on CPU (bf16) at three image sizes and records patch/token counts,
# the shapes at layers 5/11/17/23, counted FLOPs and seconds. Weights are streamed by HTTP range request from
# tencent/WeVisOne-VL-4B/model.safetensors (only the 315 model.visual.* tensors, 415,347,712 values).
# Needs st_header.json (the safetensors header, saved with one range request), config.json and a Qwen3-VL-aware transformers (5.x).
import json, os, resource, struct, sys, time, urllib.request
import numpy as np
import torch
from PIL import Image, ImageDraw

torch.set_num_threads(2)
D = os.path.dirname(os.path.abspath(__file__))
REPO = "tencent/WeVisOne-VL-4B"
URL = f"https://huggingface.co/{REPO}/resolve/main/model.safetensors"
hdr = json.load(open(os.path.join(D, "hf", "st_header.json")))
cfg = json.load(open(os.path.join(D, "hf", "config.json")))
pcfg = json.load(open(os.path.join(D, "hf", "processor_config.json")))["image_processor"]
base = 8 + len(json.dumps(hdr))  # placeholder, recomputed below


def rng(a, b):
    r = urllib.request.Request(URL, headers={"Range": f"bytes={a}-{b}"})
    return urllib.request.urlopen(r, timeout=600).read()


n = struct.unpack("<Q", rng(0, 7))[0]
base = 8 + n
DT = {"BF16": torch.bfloat16, "F32": torch.float32, "F16": torch.float16}
sd = {}
t0 = time.time()
CACHE = os.path.join(D, "vit_weights_bf16.pt")
if os.path.exists(CACHE):
    _m = torch.load(CACHE, mmap=True)
    for _k in list(_m.keys()):
        sd[_k] = _m.pop(_k)
    del _m
for k, v in ([] if sd else hdr.items()):
    if not k.startswith("model.visual."):
        continue
    a, b = v["data_offsets"]
    buf = bytearray(rng(base + a, base + b - 1))
    t = torch.frombuffer(buf, dtype=DT[v["dtype"]]).reshape(v["shape"]).float()
    sd[k[len("model.visual."):]] = t.clone()
if not os.path.exists(CACHE):
    torch.save({k: v.to(torch.bfloat16) for k, v in sd.items()}, CACHE)
print(f"streamed {len(sd)} visual tensors, {sum(t.numel() for t in sd.values()):,} params in {time.time()-t0:.0f}s", flush=True)

from transformers import Qwen3VLConfig
from transformers.models.qwen3_vl.modeling_qwen3_vl import Qwen3VLVisionModel

vc = Qwen3VLConfig.from_dict(cfg).vision_config
vc._attn_implementation = "sdpa"
with torch.device("meta"):
    vit = Qwen3VLVisionModel(vc)
missing, unexpected = vit.load_state_dict(sd, strict=False, assign=True)
print("missing", missing, "unexpected", unexpected, flush=True)
for name, mod in list(vit.named_modules()):
    if "rotary" in type(mod).__name__.lower() and any(b.is_meta for b in mod.buffers(recurse=False)):
        print("re-init", name, type(mod).__name__, flush=True)
        setattr(vit, name, type(mod)(vc))
for name, mod in vit.named_modules():
    for bn, b in list(mod.named_buffers(recurse=False)):
        if b.is_meta:
            print("meta buffer left", name, bn, flush=True)
vit.eval()

def patchify(im, p=16, m=2, tp=2):
    x = np.asarray(im, dtype=np.float32) / 255.0
    x = (x - 0.5) / 0.5
    x = x.transpose(2, 0, 1)                      # C,H,W
    C, H, W = x.shape
    x = np.tile(x[None], (tp, 1, 1, 1))           # tp,C,H,W (single frame repeated)
    gh, gw = H // p, W // p
    x = x.reshape(1, tp, C, gh // m, m, p, gw // m, m, p)
    x = x.transpose(0, 3, 6, 4, 7, 2, 1, 5, 8)
    pv = x.reshape(gh * gw, C * tp * p * p)
    return torch.from_numpy(np.ascontiguousarray(pv)), torch.tensor([[1, gh, gw]])

def synth(w, h):
    im = Image.new("RGB", (w, h), (235, 235, 230))
    d = ImageDraw.Draw(im)
    rs = np.random.RandomState(7)
    for _ in range(14):
        x0, y0 = rs.randint(0, w - 40), rs.randint(0, h - 40)
        x1, y1 = x0 + rs.randint(20, w // 4), y0 + rs.randint(20, h // 4)
        col = tuple(int(c) for c in rs.randint(30, 220, 3))
        (d.ellipse if rs.rand() < 0.5 else d.rectangle)([x0, y0, min(x1, w - 1), min(y1, h - 1)], fill=col)
    return im

feats = {}
hooks = []
for li in (5, 11, 17, 23):
    def mk(li):
        def fh(mod, inp, out):
            o = out[0] if isinstance(out, tuple) else out
            feats[li] = tuple(o.shape)
        return fh
    hooks.append(vit.blocks[li].register_forward_hook(mk(li)))

from torch.utils.flop_counter import FlopCounterMode
res = []
SIZES = [int(x) for x in os.environ.get("SIZES", "448,672,896,1120").split(",")]
for s in SIZES:
    im = synth(s, s)
    pv, thw = patchify(im)
    pv = pv.to(torch.bfloat16)
    n_patch = pv.shape[0]
    feats.clear()
    with torch.no_grad():
        # warm-up + FLOP count
        with FlopCounterMode(display=False) as fc:
            o = vit(pv, grid_thw=thw)
        flops = fc.get_total_flops()
        ts = []
        for _ in range(2):
            t1 = time.time(); o = vit(pv, grid_thw=thw); ts.append(time.time() - t1)
    pooled = o.pooler_output if hasattr(o, "pooler_output") else (o[0] if isinstance(o, tuple) else o)
    ds = getattr(o, "deepstack_features", None) or getattr(o, "deepstack_feature_lists", None)
    row = dict(side=s, grid_thw=thw.tolist()[0], patches=int(n_patch), llm_tokens=int(pooled.shape[0]),
               pooled_shape=list(pooled.shape), deepstack=[list(x.shape) for x in ds] if ds else None,
               hooked=dict((k, list(v)) for k, v in feats.items()), flops=int(flops), sec_median=float(np.median(ts)),
               sec_all=[round(x, 3) for x in ts], rss_gb=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6)
    res.append(row)
    json.dump(res, open(os.path.join(D, "vit_results.json"), "w"), indent=1)
    print(json.dumps(row), flush=True)
