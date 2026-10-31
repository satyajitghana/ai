"""Write public/neuron-lab/qwen3-0.6b/meta.json from the scratch stats (residual-norm medians, down_proj column norms).
Needs data_stats.py to have finished.  data_assemble.py writes the same file again together with the lens-dependent files."""
from data_common import *
from datetime import date

st = torch.load(os.path.join(SCRATCH, "stats.pt"))
corp = torch.load(os.path.join(SCRATCH, "corpus.pt"))
langs = corp["lang"]
assert st["done"] >= corp["ids"].shape[0], "stats incomplete"
n_en, n_fr, n_es, n_de = (langs.count(x) for x in ("en", "fr", "es", "de"))
tok, model = load()
rn = [float(torch.cat(st["rn"][L]).median()) for L in range(NL)]
cn = col_norms(model)
meta = dict(model=MODEL, layers=NL, neurons=NN, hidden=HID, vocab=model.config.vocab_size,
            resNormMedian=[round(x, 3) for x in rn],
            colNorm=[[round(float(v), 3) for v in cn[L]] for L in range(NL)],
            corpus=dict(name=f"({SLUG} tokenizer) {n_en} x 128-token chunks of WikiText-103 raw train (English Wikipedia) + {n_fr}/{n_es}/{n_de} chunks of French/Spanish/German Wikipedia (wikimedia/wikipedia 20231101)",
                        tokens=int(st["cnt"]), license="CC BY-SA 3.0 (Wikipedia text; contexts are short quoted windows)"),
            generated=date.today().isoformat(),
            notes="resNormMedian[L] = median ||residual leaving decoder layer L|| over corpus tokens at positions >= 1; "
                  "steer delta = dose * resNormMedian[L] / colNorm[L][n] added to silu(gate)*up of neuron n at every position.")
os.makedirs(OUT, exist_ok=True)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), separators=(",", ":"))
print("meta written; resNorm first/middle/last layer", [round(rn[i], 2) for i in (0, NL // 2, NL - 1)], "colNorm range", round(float(cn.min()), 3), round(float(cn.max()), 3))
