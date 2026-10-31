"""Compare Xiaomi-OCR-0 with Qwen3.5-0.8B-Base and the post-trained Qwen3.5-0.8B, tensor by tensor,
reading only the bytes it needs over HTTP range requests (no checkpoint is downloaded).
Needs: python3, numpy. About 150 MB of traffic, a minute or two.  Output: weights_compare.json
"""
import json, math, random, struct, urllib.request
import numpy as np

X = "https://huggingface.co/xiaomi-research/Xiaomi-OCR-0/resolve/main/model.safetensors"
BASE = "https://huggingface.co/Qwen/Qwen3.5-0.8B-Base/resolve/main/model.safetensors-00001-of-00001.safetensors"
POST = "https://huggingface.co/Qwen/Qwen3.5-0.8B/resolve/main/model.safetensors-00001-of-00001.safetensors"

def rng(url, a, b):
    r = urllib.request.Request(url, headers={"Range": f"bytes={a}-{b}"})
    return urllib.request.urlopen(r, timeout=200).read()

def header(url):
    n = struct.unpack("<Q", rng(url, 0, 7))[0]
    h = json.loads(rng(url, 8, 8 + n - 1)); h.pop("__metadata__", None)
    return h, 8 + n

def raw(url, h, base, k):
    a, b = h[k]["data_offsets"]; return rng(url, base + a, base + b - 1)

def f32(buf, shape):
    return (np.frombuffer(buf, dtype=np.uint16).astype(np.uint32) << 16).view(np.float32).reshape(shape)

H = {n: header(u) for n, u in (("x", X), ("base", BASE), ("post", POST))}
U = {"x": X, "base": BASE, "post": POST}
size = lambda sh: math.prod(sh)

hx = H["x"][0]
groups = {"embed": 0, "language_model": 0, "visual": 0, "mtp": 0}
for k, v in hx.items():
    g = "visual" if ".visual." in k else "mtp" if k.startswith("mtp") else "embed" if "embed_tokens" in k else "language_model"
    groups[g] += size(v["shape"])
print("tensors", len(hx), "values", sum(groups.values()), groups)
print("same names and shapes as Qwen3.5-0.8B:", sum(1 for k in hx if k in H["post"][0] and H["post"][0][k]["shape"] == hx[k]["shape"]), "of", len(hx))

KEYS = ["model.language_model.layers.0.mlp.down_proj.weight", "model.language_model.layers.3.self_attn.q_proj.weight",
        "model.language_model.layers.12.mlp.gate_proj.weight", "model.language_model.layers.12.linear_attn.in_proj_qkv.weight",
        "model.language_model.layers.23.mlp.down_proj.weight", "model.language_model.layers.23.mlp.up_proj.weight",
        "model.visual.blocks.0.attn.qkv.weight", "model.visual.blocks.6.mlp.linear_fc1.weight", "model.visual.blocks.11.mlp.linear_fc2.weight",
        "model.visual.merger.linear_fc1.weight", "model.visual.merger.linear_fc2.weight", "mtp.fc.weight", "mtp.layers.0.mlp.down_proj.weight"]
rows = []
for k in KEYS:
    T = {n: f32(raw(U[n], *H[n], k), H[n][0][k]["shape"]) for n in U}
    rel = lambda a, b: float(np.linalg.norm(T[a] - T[b]) / (np.linalg.norm(T[b]) + 1e-12))
    r = {"tensor": k, "post_vs_base": rel("post", "base"), "x_vs_base": rel("x", "base"), "x_vs_post": rel("x", "post")}
    a, c, d = r["post_vs_base"], r["x_vs_base"], r["x_vs_post"]
    if a > 0:
        r["cos_at_base"] = (a * a + c * c - d * d) / (2 * a * c)   # cosine between (post-base) and (x-base)
        r["cos_if_started_from_post"] = a / c
    rows.append(r)

# vision tensors byte for byte, Qwen post-trained vs Base: 10 random block weights, the patch embedding, the position embedding
hb, hp = H["base"][0], H["post"][0]
vis = [k for k in hb if ".visual.blocks." in k and k.endswith("weight")]
chosen = random.Random(1).sample(vis, 10) + ["model.visual.patch_embed.proj.weight", "model.visual.pos_embed.weight"]
same = {k: raw(BASE, *H["base"], k) == raw(POST, *H["post"], k) for k in chosen}
print("vision tensors identical between Qwen Base and post-trained:", sum(same.values()), "of", len(same), [k for k, v in same.items() if not v])

# embedding rows: 600 random rows, Xiaomi vs Base
k = "model.language_model.embed_tokens.weight"; shp = hx[k]["shape"]; rowb = shp[1] * 2
ids = sorted(random.Random(0).sample(range(shp[0]), 600)); diff = 0
for i in ids:
    xo = H["x"][1] + hx[k]["data_offsets"][0] + i * rowb; bo = H["base"][1] + hb[k]["data_offsets"][0] + i * rowb
    diff += rng(X, xo, xo + rowb - 1) != rng(BASE, bo, bo + rowb - 1)
print("embedding rows that differ:", diff, "of", len(ids))
json.dump({"groups": groups, "tensors": rows, "vision_identical": same, "embedding_rows_differing": diff}, open("weights_compare.json", "w"), indent=1)
