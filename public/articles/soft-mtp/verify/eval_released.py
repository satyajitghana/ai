"""Load the authors' released 167M checkpoints into the authors' own model class and measure, on public-domain text,
next-token loss and (teacher-forced) draft agreement of the MTP heads with the NTP head.

usage (from the Soft-MTP checkout root, PYTHONPATH=.):
  python eval_released.py <name> <dir with config.json model.safetensors tokenizer.json> <book.txt> [<book.txt> ...]
Appends one JSON line to released_eval.jsonl next to this file.
"""
import json, os, sys, math
import torch, torch.nn.functional as F
from safetensors.torch import load_file
from tokenizers import Tokenizer
from src.models.config import HFMTPConfig
from src.models.model import HFMTPForCausalLM

name, d, books = sys.argv[1], sys.argv[2], sys.argv[3:]
torch.set_num_threads(2)
cfg = json.load(open(os.path.join(d, "config.json")))
for k in ("architectures", "auto_map", "model_type", "transformers_version", "dtype", "torch_dtype"):
    cfg.pop(k, None)
m = HFMTPForCausalLM(HFMTPConfig(**cfg))
sd = load_file(os.path.join(d, "model.safetensors"))
missing, unexpected = m.load_state_dict(sd, strict=False)
m.eval()
tok = Tokenizer.from_file(os.path.join(d, "tokenizer.json"))
ids = []
for b in books:
    t = open(b, encoding="utf-8", errors="ignore").read()
    a = t.find("*** START"); a = t.find("\n", a) if a >= 0 else 0
    e = t.find("*** END")
    ids += tok.encode(t[a:e if e > 0 else len(t)]).ids
data = torch.tensor(ids)
T, B, nb, K = 256, 4, 12, m.config.n_mtp
g = torch.Generator().manual_seed(7)
ntp = 0.0; ce = [0.0] * K; kl = [0.0] * K; ag = [0.0] * K
with torch.no_grad():
    for _ in range(nb):
        ix = torch.randint(0, data.numel() - T - 2, (B,), generator=g)
        c = torch.stack([data[i:i + T + 1] for i in ix]); x, y = c[:, :T], c[:, 1:]
        H = m.trunk_forward(x); hs = m.all_head_hiddens(H, x)
        l0 = m.logits(hs[0], 0)
        ntp += float(F.cross_entropy(l0.reshape(-1, l0.size(-1)), y.reshape(-1)))
        for k in range(1, K + 1):
            n = T - k; lk = m.logits(hs[k], k)
            ce[k-1] += float(F.cross_entropy(lk.reshape(-1, lk.size(-1)), y[:, k:k+n].reshape(-1)))
            lq = F.log_softmax(l0[:, k:k+n], -1); lp = F.log_softmax(lk, -1)
            kl[k-1] += float((lq.exp() * (lq - lp)).sum(-1).mean())
            ag[k-1] += float((lk.argmax(-1) == l0[:, k:k+n].argmax(-1)).float().mean())
f = lambda v: [a / nb for a in v]; ag = f(ag)
run = 1.0; L = 1.0
for a in ag: run *= a; L += run
rec = {"name": name, "n_params": sum(p.numel() for p in m.parameters()), "missing": list(missing)[:5], "unexpected": list(unexpected)[:5],
       "tokens": int(data.numel()), "eval_tokens_per_head": nb * B * T, "val_ntp": ntp / nb, "mtp_ce": f(ce), "kl_to_verifier": f(kl),
       "agree_with_verifier": ag, "exp_accept_len_chain": L}
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "released_eval.jsonl"), "a").write(json.dumps(rec) + "\n")
print(json.dumps(rec))
