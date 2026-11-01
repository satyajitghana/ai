"""Run OUR from-scratch forward pass (../lfm3_ref.py structure) on the local bf16 weights with bf16 matmuls
(no int8) and compare per-position logits with the real HF output saved by hf_ref.py --logits.
usage: ours_vs_hf.py MODEL_DIR HF_LOGITS.npz OUT.json"""
import sys, os, json, numpy as np, torch, torch.nn as nn
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
import lfm3_ref
from lfm3_ref import Lfm3
from safetensors import safe_open
torch.set_num_threads(2)
d, npz, outp = sys.argv[1:4]

class BLinear(nn.Module):
    def __init__(self, w):
        super().__init__(); self.w = w  # bf16 [out,in]
    def forward(self, x):
        return (x.reshape(-1, self.w.shape[1]).to(torch.bfloat16) @ self.w.T).float().reshape(*x.shape[:-1], self.w.shape[0])

class M(Lfm3):
    def load(self):
        self.W = {}
        with safe_open(d + "/model.safetensors", "pt") as f:
            for k in f.keys():
                t = f.get_tensor(k)
                if k == "model.embed_tokens.weight":
                    self.embed = t; self.lm_head = BLinear(t)
                elif k.endswith("conv.conv.weight"):
                    self.W[k] = t.float().reshape(t.shape[0], -1)
                elif t.dim() == 2 and "norm" not in k:
                    self.W[k] = BLinear(t)
                else:
                    self.W[k] = t.float()
m = M(cfg_path=d + "/config.json")
ref = np.load(npz)
res = []
for i in range(len([k for k in ref.files if k.startswith("ids")])):
    ids = ref[f"ids{i}"].tolist(); R = ref[f"p{i}"]
    cache = m.new_cache(); L = []
    with torch.no_grad():
        for pos, t in enumerate(ids):
            L.append(m.step(t, pos, cache).numpy())
    L = np.stack(L)
    cos = [float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))) for a, b in zip(L, R)]
    top1 = [int(a.argmax() == b.argmax()) for a, b in zip(L, R)]
    top5 = [len(set(np.argsort(-a)[:5]) & set(np.argsort(-b)[:5])) for a, b in zip(L, R)]
    pa = torch.log_softmax(torch.tensor(L), -1); pb = torch.log_softmax(torch.tensor(R), -1)
    kl = (pb.exp() * (pb - pa)).sum(-1)
    r = {"prompt_idx": i, "n_tokens": len(ids), "max_abs_diff": float(np.abs(L - R).max()), "mean_abs_diff": float(np.abs(L - R).mean()),
         "ref_logit_std": float(R.std()), "min_cosine": min(cos), "mean_cosine": float(np.mean(cos)), "top1_agree": f"{sum(top1)}/{len(top1)}",
         "mean_top5_overlap": float(np.mean(top5)), "mean_KL_ref_to_ours": float(kl.mean()), "max_KL": float(kl.max())}
    print(r, flush=True); res.append(r)
    json.dump(res, open(outp, "w"), indent=1)
