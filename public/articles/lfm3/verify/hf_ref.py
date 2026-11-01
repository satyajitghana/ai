"""Run the real HF modelling code (trust_remote_code) in bf16 on CPU.
usage: hf_ref.py MODEL_DIR OUT_PREFIX [--logits] [--decode CTX,CTX,...]
--logits: save full-position logits for the fixed prompts (npz) + greedy text.
--decode: time per-token decode at each context length (chunked prefill, then median of N decode steps)."""
import sys, time, json, statistics, numpy as np, torch
from transformers import AutoModelForCausalLM, AutoTokenizer, DynamicCache
torch.set_num_threads(2)
d, out = sys.argv[1], sys.argv[2]
tok = AutoTokenizer.from_file if False else AutoTokenizer.from_pretrained(d, trust_remote_code=True)
m = AutoModelForCausalLM.from_pretrained(d, trust_remote_code=True, dtype=torch.bfloat16).eval()
print("loaded", type(m).__name__, torch.__version__, flush=True)
PROMPTS = ["What is C. elegans?", "Give me three tips for a good night's sleep.", "Translate to French: The library closes at six.",
           "Write a Python function that returns the n-th Fibonacci number."]
def fmt(p):
    return f"<|startoftext|><|im_start|>user\n{p}<|im_end|>\n<|im_start|>assistant\n<think></think>"
res = {}
if "--logits" in sys.argv:
    arrs = {}
    for i, p in enumerate(PROMPTS):
        ids = tok(fmt(p), add_special_tokens=False, return_tensors="pt").input_ids
        with torch.no_grad():
            lg = m(ids).logits[0].float().numpy()
        arrs[f"p{i}"] = lg; arrs[f"ids{i}"] = ids[0].numpy()
        g = m.generate(ids, max_new_tokens=30, do_sample=False)
        res[p] = {"n": ids.shape[1], "greedy": tok.decode(g[0, ids.shape[1]:], skip_special_tokens=True)}
        print(p, "->", res[p], flush=True)
    np.savez(out + "_logits.npz", **arrs)
    json.dump(res, open(out + "_greedy.json", "w"), indent=1, ensure_ascii=False)
if "--long" in sys.argv:  # 320 tokens: past the 256-token sliding window
    base = tok(("The quick brown fox jumps over the lazy dog while the river runs quietly past an old stone bridge. " * 40), add_special_tokens=False).input_ids[:320]
    ids = torch.tensor([base])
    with torch.no_grad():
        lg = m(ids).logits[0].float().numpy()
    np.savez(out + "_long.npz", p0=lg, ids0=ids[0].numpy())
if "--decode" in sys.argv:
    ctxs = [int(x) for x in sys.argv[sys.argv.index("--decode") + 1].split(",")]
    text = ("The quick brown fox jumps over the lazy dog while the river runs quietly past an old stone bridge. " * 2000)
    base = tok(text, add_special_tokens=False).input_ids
    timing = {}
    for c in ctxs:
        ids = torch.tensor([base[:c]])
        cache = DynamicCache(config=m.config)
        t0 = time.time()
        with torch.no_grad():
            for a in range(0, c, 512):
                o = m(ids[:, a:a + 512], past_key_values=cache, use_cache=True)
                cache = o.past_key_values
            t1 = time.time()
            nxt = o.logits[:, -1:].argmax(-1)
            ts = []
            for _ in range(7):
                s = time.time()
                o = m(nxt, past_key_values=cache, use_cache=True)
                cache = o.past_key_values
                nxt = o.logits[:, -1:].argmax(-1)
                ts.append((time.time() - s) * 1000)
        timing[c] = {"prefill_s": round(t1 - t0, 1), "decode_ms": [round(x, 1) for x in ts], "median_ms": round(statistics.median(ts[1:]), 1), "min_ms": round(min(ts[1:]), 1)}
        print(c, timing[c], flush=True)
        json.dump(timing, open(out + "_decode.json", "w"), indent=1)
