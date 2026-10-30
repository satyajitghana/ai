"""Assemble public/neuron-lab/qwen3-0.6b/{meta.json, layers/L*.json, contexts.json, links.json} from the scratch
artefacts of data_stats.py and data_logitlens.py plus the model weights (for colNorm and the feeds edges).

Definitions (also written into the files):
  peak(L,n)   = max(actMax, -actMin): largest |activation| of neuron n over the corpus (positions >= 1).
  top-256     = the 256 neurons of a layer with the largest peak.
  feeds edge  = for source neuron n of layer L (top-256) and target m of layer L+1 (top-256):
                gate = cos( w_ln2[L+1] * W_down[L][:, n] ,  W_gate[L+1][m, :] )   (also `up` with W_up)
                i.e. how well the direction n writes, seen through the next layer's post-attention RMSNorm weight,
                lines up with the row that decides whether m fires.  Weight-only, not a causal measurement.
                Each source keeps its 3 targets with largest |gate|.
"""
from data_common import *
from datetime import date

TOPN = 256
tok, model = load()
st = torch.load(os.path.join(SCRATCH, "stats.pt"))
assert st["done"] >= 548, "stats incomplete"
corp = torch.load(os.path.join(SCRATCH, "corpus.pt"))
ids, langs = corp["ids"], corp["lang"]
os.makedirs(os.path.join(OUT, "layers"), exist_ok=True)

rn = [float(torch.cat(st["rn"][L]).median()) for L in range(NL)]
cn = col_norms(model)
peak = torch.maximum(st["mx"], -st["mn"])
mean = st["sm"] / st["cnt"]

meta = dict(model=MODEL, layers=NL, neurons=NN, hidden=HID, vocab=model.config.vocab_size,
            resNormMedian=[round(x, 3) for x in rn],
            colNorm=[[round(float(v), 3) for v in cn[L]] for L in range(NL)],
            corpus=dict(name="WikiText-103 raw train (English Wikipedia, 440 x 128-token chunks) + French/Spanish/German Wikipedia (wikimedia/wikipedia 20231101, 36 chunks each)",
                        tokens=int(st["cnt"]), license="CC BY-SA 3.0 (Wikipedia text; contexts are short quoted windows)"),
            generated=date.today().isoformat(),
            notes="resNormMedian[L] = median ||residual leaving decoder layer L|| over corpus tokens at positions >= 1; "
                  "steer delta = dose * resNormMedian[L] / colNorm[L][n] added to silu(gate)*up of neuron n at every position.")
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), separators=(",", ":"))

r3 = lambda t: [round(float(v), 3) for v in t]
ctx = {}
top = {}
for L in range(NL):
    lens = json.load(open(os.path.join(SCRATCH, "lens", f"L{L:02d}.json")))
    json.dump(dict(up=lens["up"], down=lens["down"], actMax=r3(st["mx"][L]), actMin=r3(st["mn"][L]), actMean=r3(mean[L])),
              open(os.path.join(OUT, "layers", f"L{L:02d}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    top[L] = peak[L].topk(TOPN).indices.tolist()
    for n in top[L]:
        lst = []
        for k in range(5):
            c = int(st["tc"][L, n, k]); p = int(st["tp"][L, n, k])
            if c < 0:
                continue
            lo = max(0, p - 8); hi = min(ids.shape[1], p + 3)   # <= 11 tokens: 8 before, the token, 2 after
            pre = tok.decode(ids[c, lo:p].tolist()).lstrip("�")
            t = tok.decode([int(ids[c, p])])
            post = tok.decode(ids[c, p + 1:hi].tolist()).rstrip("�")
            text = (pre + t + post).replace("\n", " ")
            pre = pre.replace("\n", " ")
            lst.append(dict(text=text, tokenIndex=p - lo, act=round(float(st["tv"][L, n, k]), 3), at=len(pre), len=len(t), lang=langs[c]))
        ctx[f"{L}.{n}"] = lst
json.dump(ctx, open(os.path.join(OUT, "contexts.json"), "w"), ensure_ascii=False, separators=(",", ":"))

edges = {}
for L in range(NL - 1):
    W = model.model.layers[L].mlp.down_proj.weight.float()            # [1024,3072]
    w2 = model.model.layers[L + 1].post_attention_layernorm.weight.float()
    D = (W[:, top[L]] * w2[:, None]).T                               # [256,1024]
    D = D / D.norm(dim=1, keepdim=True)
    G = model.model.layers[L + 1].mlp.gate_proj.weight.float()[top[L + 1]]  # [256,1024]
    U = model.model.layers[L + 1].mlp.up_proj.weight.float()[top[L + 1]]
    cg = D @ (G / G.norm(dim=1, keepdim=True)).T                      # [256,256]
    cu = D @ (U / U.norm(dim=1, keepdim=True)).T
    es = []
    for i, n in enumerate(top[L]):
        for j in cg[i].abs().topk(3).indices.tolist():
            es.append([n, top[L + 1][j], round(float(cg[i, j]), 3), round(float(cu[i, j]), 3)])
    edges[str(L)] = es
json.dump(dict(definition=__doc__.split("Definitions")[1].strip(), topN=TOPN, k=3,
               fields=["fromNeuron(layer L)", "toNeuron(layer L+1)", "gateCos", "upCos"], layers=edges),
          open(os.path.join(OUT, "links.json"), "w"), separators=(",", ":"))
print("resNorm", [round(x, 1) for x in rn[:3]], "...", round(rn[-1], 1))
