"""Write public/neuron-lab/qwen3-0.6b/meta.json from the scratch stats (residual-norm medians, down_proj column norms).
Needs data_stats.py to have finished.  data_assemble.py writes the same file again together with the lens-dependent files."""
from data_common import *
from datetime import date

st = torch.load(os.path.join(SCRATCH, "stats.pt"))
assert st["done"] >= 548, "stats incomplete"
tok, model = load()
rn = [float(torch.cat(st["rn"][L]).median()) for L in range(NL)]
cn = col_norms(model)
meta = dict(model=MODEL, layers=NL, neurons=NN, hidden=HID, vocab=model.config.vocab_size,
            resNormMedian=[round(x, 3) for x in rn],
            colNorm=[[round(float(v), 3) for v in cn[L]] for L in range(NL)],
            corpus=dict(name="WikiText-103 raw train (English Wikipedia, 440 x 128-token chunks) + French/Spanish/German Wikipedia (wikimedia/wikipedia 20231101, 36 chunks each)",
                        tokens=int(st["cnt"]), license="CC BY-SA 3.0 (Wikipedia text; contexts are short quoted windows)"),
            generated=date.today().isoformat(),
            notes="resNormMedian[L] = median ||residual leaving decoder layer L|| over corpus tokens at positions >= 1; "
                  "steer delta = dose * resNormMedian[L] / colNorm[L][n] added to silu(gate)*up of neuron n at every position.")
os.makedirs(OUT, exist_ok=True)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), separators=(",", ":"))
print("meta written; resNorm L0/L14/L27", [round(rn[i], 2) for i in (0, 14, 27)], "colNorm range", round(float(cn.min()), 3), round(float(cn.max()), 3))
