import { Fragment } from "react"

// Static, zero-JS comparison of the two abliterations this site has now checked
// end to end: orcarouter/GLM-5.3-Flash-Uncensored-FP8 (a weight edit, published
// as a new Hugging Face repo, verified there by an exact tensor-inventory match
// against the base model) versus this repo (a runtime hook, nothing published,
// verified here by reading every line that touches the pack directory and
// finding no write call in any of it).

type Row = { dim: string; weights: string; runtime: string; edge?: "weights" | "runtime" }

const ROWS: Row[] = [
  {
    dim: "what changes",
    weights: "the weight tensors — W ← W − r(rᵗW), saved as a new checkpoint",
    runtime: "nothing on disk — a forward hook on 129 module outputs, applied per call",
  },
  {
    dim: "on a ternary / QAT base",
    weights: "dequantize → edit → re-quantize: a new quantization step on top of the original one",
    runtime: "no quantization step — the hook runs in float32 on activations already produced",
    edge: "runtime",
  },
  {
    dim: "added quantization error",
    weights: "nonzero if the base is low-bit; the whole reason this repo exists",
    runtime: "none — packed weights are bit-identical, checkable against the pack's own Hub metadata",
    edge: "runtime",
  },
  {
    dim: "per-token cost",
    weights: "zero — identical forward pass to the unmodified base model",
    runtime: "129 extra dot-product + AXPY ops/token; not benchmarked by either repo",
    edge: "weights",
  },
  {
    dim: "published checkpoint",
    weights: "yes — e.g. orcarouter/GLM-5.3-Flash-Uncensored-FP8, a new 321B-parameter Hub repo",
    runtime: "no — no orcarouter Bonsai repo on the Hub; bring the original pack + this runtime",
  },
  {
    dim: "alpha=0 / reverting",
    weights: "not available from the edited checkpoint alone — keep the original file too",
    runtime: "the same weights, one flag: --alpha 0 skips the hook entirely",
    edge: "runtime",
  },
  {
    dim: "how this site verified it",
    weights: "safetensors dtype/shape counts match the base model exactly, per-tensor",
    runtime: "no write() call to the pack directory anywhere in bonsai_abliterate/ or run.py",
  },
]

const RUNTIME_GOOD = "oklch(0.55 0.16 155)"
const WEIGHTS_GOOD = "oklch(0.60 0.14 255)"

export function WeightsVsRuntime() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          weight-space edit vs. runtime hook · same technique, same paper, two implementations
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="hidden font-mono text-[10px] tracking-wide text-muted-foreground uppercase sm:block" />
          <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            weight-space edit <span className="text-foreground/60">(GLM-5.3-Flash-Uncensored)</span>
          </div>
          <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            runtime hook <span className="text-foreground/60">(this repo)</span>
          </div>

          {ROWS.map((r) => (
            <Fragment key={r.dim}>
              <div className="pt-2 font-mono text-xs font-medium text-foreground sm:border-t sm:pt-3">
                {r.dim}
              </div>
              <div
                className="rounded-lg border px-3 py-2 text-sm leading-5 sm:border-t-0 sm:pt-3"
                style={
                  r.edge === "weights"
                    ? { borderColor: `color-mix(in oklch, ${WEIGHTS_GOOD} 35%, transparent)`, background: `color-mix(in oklch, ${WEIGHTS_GOOD} 8%, transparent)` }
                    : undefined
                }
              >
                {r.weights}
              </div>
              <div
                className="rounded-lg border px-3 py-2 text-sm leading-5 sm:border-t-0 sm:pt-3"
                style={
                  r.edge === "runtime"
                    ? { borderColor: `color-mix(in oklch, ${RUNTIME_GOOD} 35%, transparent)`, background: `color-mix(in oklch, ${RUNTIME_GOOD} 8%, transparent)` }
                    : undefined
                }
              >
                {r.runtime}
              </div>
            </Fragment>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Neither column is free. The weight-space edit costs nothing at inference and ships a normal,
          drop-in checkpoint — but on a QAT ternary base it can only get there by re-quantizing, which is the
          exact step this repo exists to avoid. The runtime hook keeps the packed weights untouched and stays
          reversible — but it pays for that on every token, at all 129 sites, in a cost neither release has
          actually measured.
        </p>
      </div>
    </figure>
  )
}
