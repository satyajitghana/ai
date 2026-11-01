"""Run the real baidu/Unlimited-OCR-2 on CPU, weights streamed from the Hub straight into RAM (no disk copy),
with a hook on the decode attention that counts the keys each query really reads.
usage: run_real.py <modeldir(code+config+tokenizer)> <pagesdir> <out.json> job [job ...]
jobs: single:<page>  multi  gundam:<page>
The save/visualise path (which eval()s model output) is never called: save_results stays False."""
import json, os, re, struct, sys, time, resource, math
sys.path.insert(0, os.environ.get("TF_DEPS", "")); sys.path.append(os.environ.get("EXTRA_DEPS", ""))
import numpy as np, requests, torch
torch.set_num_threads(int(os.environ.get("THREADS", "2")))
# The model code calls .cuda() on the image-token mask (modeling_unlimitedocr.py lines 785 and 789); on CPU that is the only edit needed.
torch.Tensor.cuda = lambda self, *a, **k: self
MODEL_DIR, PAGES, OUT = sys.argv[1:4]; JOBS = sys.argv[4:]
REPO = "baidu/Unlimited-OCR-2"; BASE = f"https://huggingface.co/{REPO}/resolve/main/"
DT = {"BF16": torch.bfloat16, "F32": torch.float32, "F16": torch.float16, "I64": torch.int64}
sess = requests.Session()
rss = lambda: resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e6  # GB (linux: KB)
def cur_rss():
    return int(open("/proc/self/statm").read().split()[1]) * 4096 / 1e9
def rng(url, a, b):
    for attempt in range(8):  # the stream drops now and then; a range read is idempotent
        try:
            r = sess.get(url, headers={"Range": f"bytes={a}-{b}"}, timeout=600); r.raise_for_status(); return r.content
        except (requests.exceptions.RequestException, OSError):
            if attempt == 7: raise
            time.sleep(2 * (attempt + 1))
def header(url):
    n = struct.unpack("<Q", rng(url, 0, 7))[0]; h = json.loads(rng(url, 8, 8 + n - 1)); h.pop("__metadata__", None); return h, 8 + n

from transformers import AutoConfig, AutoModel, AutoTokenizer
from transformers.modeling_utils import no_init_weights
t0 = time.time()
cfg = AutoConfig.from_pretrained(MODEL_DIR, trust_remote_code=True)
DRY = bool(os.environ.get("DRY"))  # DRY=1: 2-layer random-weight model, only to exercise the code path
if DRY:
    lc = cfg.language_config
    if isinstance(lc, dict): lc["num_hidden_layers"] = 2
    else: lc.num_hidden_layers = 2
    cfg.num_hidden_layers = 2
tok = AutoTokenizer.from_pretrained(MODEL_DIR, trust_remote_code=True)
torch.set_default_dtype(torch.bfloat16)
with no_init_weights():
    model = AutoModel.from_config(cfg, trust_remote_code=True, torch_dtype=torch.bfloat16)
torch.set_default_dtype(torch.float32)
model = model.to(torch.bfloat16).eval()
print(f"built {type(model).__name__} in {time.time()-t0:.0f}s rss={cur_rss():.2f}GB", flush=True)
sd = model.state_dict(); idx = json.load(open(f"{MODEL_DIR}/model.safetensors.index.json"))["weight_map"]
missing = [] if DRY else [k for k in sd if k not in idx]; unexpected = [] if DRY else [k for k in idx if k not in sd]
print("state_dict keys", len(sd), "index keys", len(idx), "missing_in_ckpt", len(missing), "unexpected", len(unexpected), flush=True)
print("missing sample", missing[:5], "unexpected sample", unexpected[:5], flush=True)
nparam = sum(p.numel() for p in model.parameters()); print("parameters (module)", nparam, flush=True)
loaded = 0; t1 = time.time()
for shard in ([] if DRY else sorted(set(idx.values()))):
    url = BASE + shard; hdr, base = header(url)
    for name, info in sorted(hdr.items(), key=lambda kv: kv[1]["data_offsets"][0]):
        if name not in sd: continue
        a, b = info["data_offsets"]; buf = rng(url, base + a, base + b - 1) if b - a < (1 << 28) else None
        if buf is None:
            buf = bytearray(b - a); mv = memoryview(buf); pos = 0
            while pos < b - a:
                e = min(pos + (1 << 27), b - a); mv[pos:e] = rng(url, base + a + pos, base + a + e - 1); pos = e
        t = torch.frombuffer(bytearray(buf) if isinstance(buf, bytes) else buf, dtype=DT[info["dtype"]]).reshape(info["shape"])
        with torch.no_grad(): sd[name].copy_(t)
        loaded += 1
    print(f"shard {shard} done, {loaded} tensors, {time.time()-t1:.0f}s, rss={cur_rss():.2f}GB", flush=True)
load_s = time.time() - t0; load_rss = rss()
print(f"loaded: {load_s:.0f}s, peak rss so far {load_rss:.2f}GB", flush=True)

# --- attention hook ---
import types
mod = next(m for n, m in list(sys.modules.items()) if isinstance(m, types.ModuleType) and "modeling_" in n and not n.startswith("torch") and hasattr(m, "_decode_attend") and hasattr(m, "configure_dash_inference"))
orig = mod._decode_attend; STATE = {"img": None, "rec": []}
def hooked(q, k_all, v_all, topi, bias, valid, q_pos, block_size, local_window, scale):
    S = k_all.shape[2]; kpos = torch.arange(S)
    nblk = (S + block_size - 1) // block_size
    blk = torch.full((1, 1, nblk), mod._MASK_NEG, dtype=torch.float32).scatter(-1, topi.long(), torch.where(valid, bias, bias.new_full((), mod._MASK_NEG)).float())
    base_ = blk.index_select(-1, kpos // block_size); qp = q_pos[:, :, None]
    causal = kpos[None, None, :] <= qp; local = causal & (kpos[None, None, :] > (qp - local_window))
    keep = (causal & (local | (base_ > mod._MASK_NEG * 0.5)))[0, 0]
    img = STATE["img"]
    STATE["rec"].append((int(S), int(keep.sum()), int((keep & torch.nn.functional.pad(img[:S], (0, max(0, S - img.numel())))).sum()) if img is not None else -1,
                         int(local[0, 0].sum()), int(valid.sum())))
    return orig(q, k_all, v_all, topi, bias, valid, q_pos, block_size, local_window, scale)
mod._decode_attend = hooked

def lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1): cur.append(min(prev[j] + 1, cur[j-1] + 1, prev[j-1] + (ca != cb)))
        prev = cur
    return prev[-1]
def clean(s):
    s = re.sub(r"<\|ref\|>.*?<\|/ref\|>|<\|det\|>.*?<\|/det\|>|<PAGE>", " ", s, flags=re.S)
    return s
def norm_text(s): return re.sub(r"\s+", "", re.sub(r"<[^>]+>|[|#*\\$]|-{2,}|\\\(|\\\)", "", clean(s)))
def norm_tex(s): return re.sub(r"\s+|\\left|\\right|\\,|\\!|\;|\\displaystyle", "", s.replace("\\dfrac", "\\frac"))
truth = json.load(open(f"{PAGES}/truth.json"))
from PIL import Image
res = json.load(open(OUT)) if os.path.exists(OUT) else {}
for job in JOBS:
    kind, _, arg = job.partition(":")
    pages = [arg] if kind in ("single", "gundam") else sorted(truth)
    ims = [Image.open(f"{PAGES}/{p}.png").convert("RGB") for p in pages]
    STATE["rec"] = []
    # image-token mask is built inside infer; recompute it the same way to classify kept keys
    import importlib; um = next(m for n, m in list(sys.modules.items()) if isinstance(m, types.ModuleType) and n.endswith("modeling_unlimitedocr") and hasattr(m, "_uocr_build_inputs"))
    crop = (kind == "gundam")
    pr = ("<PAGE><image>" * len(ims) + "Multi page parsing.")
    ids, imgs, seq_mask, spatial = um._uocr_build_inputs(tok, pr, ims, crop_mode=crop)
    STATE["img"] = seq_mask.clone()
    n_in = int(ids.numel()); n_img = int(seq_mask.sum())
    maxnew = 6 if DRY else {"single": 700, "gundam": 700, "multi": 1500}[kind]
    ru0 = cur_rss(); t = time.time()
    out = model.infer(tok, prompt=pr, image_file=ims, crop_mode=crop, max_new_tokens=maxnew, return_dict=True,
                      eval_mode=True, save_results=False, no_repeat_ngram_size=35, ngram_window=1024)
    wall = time.time() - t
    rec = np.array(STATE["rec"]) if STATE["rec"] else np.zeros((0, 5), int)
    ntok = len(out["token_ids"]); nl = 12
    R = dict(job=job, pages=pages, prompt_tokens=n_in, image_tokens=n_img, output_tokens=ntok, finish=out["finish_reason"],
             wall_s=round(wall, 1), prefill_s=round(out["prefill_time"] or 0, 1), peak_rss_gb=round(rss(), 2),
             decode_tok_s=round(ntok / max(wall - (out["prefill_time"] or 0), 1e-6), 3), text=out["text"],
             num_pages_out=out["num_pages_out"], expected_pages=out["expected_pages"])
    if len(rec):
        R["decode_calls"] = int(len(rec)); R["layers_hooked"] = int(len(rec) / max(ntok, 1) + 0.5)
        R["keys_read"] = dict(min=int(rec[:, 1].min()), max=int(rec[:, 1].max()), mean=float(rec[:, 1].mean()),
                              hist={int(k): int(v) for k, v in zip(*np.unique(rec[:, 1], return_counts=True))})
        R["image_keys_read"] = dict(min=int(rec[:, 2].min()), max=int(rec[:, 2].max()), mean=float(rec[:, 2].mean()))
        R["local_keys"] = dict(min=int(rec[:, 3].min()), max=int(rec[:, 3].max()))
        R["valid_blocks"] = dict(min=int(rec[:, 4].min()), max=int(rec[:, 4].max()), mean=float(rec[:, 4].mean()))
        R["cache_len"] = dict(first=int(rec[0, 0]), last=int(rec[-1, 0]))
        R["per_step_keys_layer0"] = [int(x) for x in rec[0::max(R["layers_hooked"], 1), 1]][:2000]
    # CER per page
    parts = re.split(r"<PAGE>", out["text"]); parts = [p for p in parts if p.strip()]
    cers = {}
    for i, p in enumerate(pages):
        got = parts[i] if i < len(parts) else ""
        tr = truth[p]
        if tr["kind"] == "formula":
            g = norm_tex(re.sub(r"<[^>]+>|<\|.*?\|>", "", clean(got))); r_ = norm_tex(tr["text"])
            g2 = re.sub(r"\\\[|\\\]|\$\$?|\\\(|\\\)", "", g)
            cers[p] = round(lev(g2, r_) / len(r_), 4)
        else:
            g = norm_text(got); r_ = norm_text(tr["text"]); cers[p] = round(lev(g, r_) / len(r_), 4)
    R["cer"] = cers; R["page_texts"] = parts
    res[job] = R; json.dump(res, open(OUT, "w"), indent=1)
    print(job, {k: R[k] for k in ("prompt_tokens", "image_tokens", "output_tokens", "wall_s", "prefill_s", "decode_tok_s", "peak_rss_gb", "cer", "finish") if k in R}, R.get("keys_read", {}).get("min"), R.get("keys_read", {}).get("max"), flush=True)
