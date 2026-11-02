"""Logit lens of every MLP neuron: push the neuron's down_proj column through the final RMSNorm weight and the tied
unembedding, keep the top-6 tokens it promotes (up) and suppresses (down).  Direction only: the final norm's
1/rms(residual) factor is a positive scalar and does not change the ranking.  Vocabulary: real text tokens only
(ids < 151643, no byte-fragment tokens that do not decode to valid text).
Writes $NL_SCRATCH/lens/L{LL}.json (up/down per neuron).  usage: data_logitlens.py"""
from data_common import *

K = 6
from transformers import AutoTokenizer
from safetensors import safe_open
tok = AutoTokenizer.from_pretrained(MODEL)
SF = safe_open(checkpoint_file(), framework="pt")   # read only embed, final norm and down_proj: ~1.5 GB peak instead of the whole fp32 model
VOCAB = SF.get_slice(f"{ST}.embed_tokens.weight").get_shape()[0]
os.makedirs(os.path.join(SCRATCH, "lens"), exist_ok=True)
nreal = tok.vocab_size  # base vocabulary; the special/added tokens above it are not shown
ok = torch.zeros(VOCAB, dtype=torch.bool)
strs = [None] * VOCAB
for i in range(nreal):
    s = tok.decode([i])
    if "�" in s:
        continue
    if not s.strip() and len(s) > 8:  # long whitespace runs are noise in a display list
        continue
    ok[i] = True
    strs[i] = display_token(s)
print("usable tokens", int(ok.sum()))
E = SF.get_tensor(f"{ST}.embed_tokens.weight").float()  # lm_head is tied with embed_tokens
Ereal = E[ok].contiguous()         # [V',1024]
vid = torch.nonzero(ok).squeeze(1)
nw = SF.get_tensor(f"{ST}.norm.weight").float() + NORM_OFFSET   # effective final-norm scale
del E
for L in range(NL):
    p = os.path.join(SCRATCH, "lens", f"L{L:02d}.json")
    if os.path.exists(p):
        continue
    W = SF.get_tensor(f"{ST}.layers.{L}.mlp.down_proj.weight").float() * nw[:, None]  # [1024,3072]
    up, dn = [], []
    for c in range(0, NN, 384):
        lg = Ereal @ W[:, c:c + 384]                      # [V',384]
        tu = lg.topk(K, 0).indices.T                       # [384,K]
        td = (-lg).topk(K, 0).indices.T
        up += [[strs[int(vid[j])] for j in r] for r in tu]
        dn += [[strs[int(vid[j])] for j in r] for r in td]
    json.dump({"up": up, "down": dn}, open(p, "w"), ensure_ascii=False)
    print("layer", L, flush=True)
