"""A from-scratch, single-token-at-a-time LFM3-1.7B forward pass.

Written by reading modeling_lfm3.py (never executing it). Weights are streamed from the Hugging Face
checkpoint over HTTP Range requests and the linear layers are held as per-row int8 and run with
PyTorch's dynamic int8 kernel, so this is NOT a bf16 reference: it is a check that the block
structure is understood, and a harness for timing the three layer types.
"""
import json, math, os, struct, sys, time
import requests, torch, torch.nn as nn, torch.nn.functional as F

torch.set_num_threads(int(os.environ.get("THREADS", "2")))
REPO = "LiquidAI/LFM3-1.7B"
BASE = f"https://huggingface.co/{REPO}/resolve/main/"
HERE = os.path.dirname(os.path.abspath(__file__))
sess = requests.Session()


def rg(url, a, b):
    r = sess.get(url, headers={"Range": f"bytes={a}-{b}"}, timeout=300)
    r.raise_for_status()
    return r.content


class QLinear(nn.Module):
    def __init__(self, w):  # w: [out, in] float
        super().__init__()
        w = w.float()
        sc = w.abs().amax(dim=1).clamp_min(1e-8) / 127.0
        q = torch.round(w / sc[:, None]).clamp_(-127, 127).to(torch.int8)
        self.out_features, self.in_features = q.shape
        qw = torch._make_per_channel_quantized_tensor(q, sc, torch.zeros(q.shape[0], dtype=torch.int64), 0)
        self.pk = torch.ops.quantized.linear_prepack(qw, None)

    def forward(self, x):
        return torch.ops.quantized.linear_dynamic(x.reshape(-1, self.in_features).float(), self.pk, False).reshape(
            *x.shape[:-1], self.out_features
        )


def rms(x, w, eps=1e-5):
    x = x.float()
    return w * (x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + eps))


def rot_half(x):
    h = x.shape[-1] // 2
    return torch.cat((-x[..., h:], x[..., :h]), dim=-1)


class Lfm3:
    def __init__(self, cfg_path=None, load=True):
        self.cfg = json.load(open(cfg_path or os.path.join(HERE, "config.json")))
        c = self.cfg
        self.H, self.nh, self.nkv, self.hd = c["hidden_size"], c["num_attention_heads"], c["num_key_value_heads"], c["head_dim"]
        self.types = c["layer_types"]
        self.win = c["sliding_window"]
        self.eps = c["norm_eps"]
        self.inv = {}
        for lt, rp in c["rope_parameters"].items():
            ang = int(rp.get("partial_rotary_factor", 1.0) * self.hd) // 2
            f = 1.0 / (rp["rope_theta"] ** (torch.arange(0, 2 * ang, 2, dtype=torch.float) / self.hd))
            self.inv[lt] = torch.cat((f, torch.zeros(self.hd // 2 - ang)))
        if load:
            self.load()

    def load(self):
        url = BASE + "model.safetensors"
        n = struct.unpack("<Q", rg(url, 0, 7))[0]
        hdr = json.loads(rg(url, 8, 8 + n - 1))
        hdr.pop("__metadata__", None)
        base = 8 + n
        self.W = {}
        t0 = time.time()
        for k, info in sorted(hdr.items(), key=lambda kv: kv[1]["data_offsets"][0]):
            a, b = info["data_offsets"]
            buf = bytearray(b - a)
            mv = memoryview(buf)
            pos = 0
            while pos < b - a:
                e = min(pos + (256 << 20), b - a)
                r = sess.get(url, headers={"Range": f"bytes={base + a + pos}-{base + a + e - 1}"}, stream=True, timeout=600)
                r.raise_for_status()
                got = 0
                for ch in r.iter_content(1 << 20):
                    mv[pos + got: pos + got + len(ch)] = ch
                    got += len(ch)
                pos += got
            t = torch.frombuffer(buf, dtype=torch.bfloat16).reshape(info["shape"])
            if k == "model.embed_tokens.weight":
                self.embed = t.clone()
                self.lm_head = QLinear(t)
            elif k.endswith("conv.conv.weight"):
                self.W[k] = t.float().reshape(t.shape[0], -1)
            elif t.dim() == 2 and "norm" not in k:
                self.W[k] = QLinear(t)
            else:
                self.W[k] = t.float()
            del buf, mv
        print(f"loaded in {time.time()-t0:.0f}s", flush=True)

    def new_cache(self):
        return [None] * len(self.types)

    def layer(self, i, x, pos, cache):
        W, lt = self.W, self.types[i]
        p = f"model.layers.{i}."
        res = x
        h = rms(x, W[p + "operator_norm.weight"], self.eps)
        if lt == "conv":
            bcx = W[p + "conv.in_proj.weight"](h)
            B, C, xx = bcx.chunk(3, dim=-1)
            hh = B * xx
            st = cache[i] if cache[i] is not None else torch.zeros(self.H, 6)
            win = torch.cat((st, hh.reshape(-1, 1)), dim=1)
            conv = (win * W[p + "conv.conv.weight"]).sum(-1)
            cache[i] = win[:, 1:].clone()
            o = W[p + "conv.out_proj.weight"](C * conv)
        else:
            a = p + "self_attn."
            q = W[a + "q_proj.weight"](h).reshape(self.nh, self.hd)
            k = W[a + "k_proj.weight"](h).reshape(self.nkv, self.hd)
            v = W[a + "v_proj.weight"](h).reshape(self.nkv, self.hd)
            q, k = rms(q, W[a + "q_norm.weight"], self.eps), rms(k, W[a + "k_norm.weight"], self.eps)
            fr = pos * self.inv[lt]
            emb = torch.cat((fr, fr))
            cos, sin = emb.cos(), emb.sin()
            q, k = q * cos + rot_half(q) * sin, k * cos + rot_half(k) * sin
            if cache[i] is None:
                K, V = k[None], v[None]
            else:
                K, V = torch.cat((cache[i][0], k[None])), torch.cat((cache[i][1], v[None]))
            if lt == "sliding_attention" and K.shape[0] > self.win:
                K, V = K[-self.win:], V[-self.win:]
            cache[i] = (K, V)
            rep = self.nh // self.nkv
            Kx, Vx = K.repeat_interleave(rep, dim=1), V.repeat_interleave(rep, dim=1)  # [T, nh, hd]
            s = torch.einsum("hd,thd->ht", q, Kx) / math.sqrt(self.hd)
            pr = torch.softmax(s, dim=-1)
            ao = torch.einsum("ht,thd->hd", pr, Vx)
            gate = torch.sigmoid(W[a + "gate_proj.weight"](h)).reshape(self.nh, 1)
            o = W[a + "o_proj.weight"]((ao * gate).reshape(-1))
        x = rms(o, W[p + "post_operator_norm.weight"], self.eps) + res
        f = rms(x, W[p + "ffn_norm.weight"], self.eps)
        ff = W[p + "feed_forward.w2.weight"](F.silu(W[p + "feed_forward.w1.weight"](f)) * W[p + "feed_forward.w3.weight"](f))
        return x + rms(ff, W[p + "post_ffn_norm.weight"], self.eps)

    def step(self, tok, pos, cache):
        x = self.embed[tok].float()
        for i in range(len(self.types)):
            x = self.layer(i, x, pos, cache)
        x = rms(x, self.W["model.embedding_norm.weight"], self.eps)
        return self.lm_head(x).reshape(-1)


def main():
    from tokenizers import Tokenizer
    tkp = os.path.join(HERE, "tokenizer.json")
    tk = Tokenizer.from_file(tkp)
    m = Lfm3()
    out = {"model": REPO, "note": "own re-implementation, int8 weights, dynamic int8 activations", "runs": []}
    prompts = ["What is C. elegans?", "Give me three tips for a good night's sleep.", "Translate to French: The library closes at six."]
    for p in prompts:
        text = f"<|startoftext|><|im_start|>user\n{p}<|im_end|>\n<|im_start|>assistant\n<think></think>"
        ids = tk.encode(text, add_special_tokens=False).ids
        cache = m.new_cache()
        t0 = time.time()
        for pos, t in enumerate(ids):
            logits = m.step(t, pos, cache)
        gen = []
        t1 = time.time()
        for j in range(60):
            nxt = int(logits.argmax())
            if nxt == 124900:
                break
            gen.append(nxt)
            logits = m.step(nxt, len(ids) + j, cache)
        txt = tk.decode(gen)
        out["runs"].append({"prompt": p, "n_prompt_tokens": len(ids), "text": txt, "prefill_s": round(t1 - t0, 1), "ms_per_token": round((time.time() - t1) / max(1, len(gen)) * 1000)})
        json.dump(out, open(os.path.join(HERE, "gen.json"), "w"), indent=1, ensure_ascii=False)
        print(repr(p), "->", repr(txt[:200]), flush=True)


if __name__ == "__main__":
    main()
