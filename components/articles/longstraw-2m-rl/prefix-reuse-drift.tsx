"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The refresh knob. Capturing a 2M-token prompt state is the dominant cost, so
// LongStraw reuses one capture across several optimizer steps — but after each
// update the parameters change and the cached prompt state goes stale. The
// paper's 1M fresh-prefix oracle measures the drift: tiny after 1–2 steps,
// large by step 4–8. So "how many steps can I reuse a prefix" becomes a
// measured control, not a guess. These four points are the paper's measurements.

const OK = "oklch(0.64 0.15 155)"
const BAD = "oklch(0.62 0.19 25)"

// paper's measured 1M fresh-vs-reused oracle (steps 1, 2, 4, 8)
const STEPS = [1, 2, 4, 8]
const LOSS = [0.1236, 0.0378, 22.81, 9.33] // GRPO loss difference, %
const LOGP = [0.0137, 0.025, 3.136, 3.774] // mean |Δ| policy log-prob
const SAFE = [true, true, false, false]

export function PrefixReuseDrift() {
  const [idx, setIdx] = useState(1)
  const step = STEPS[idx]
  const safe = SAFE[idx]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        stale-prefix drift · reuse one 1M capture across optimizer steps
      </div>
      <div className="p-3 sm:p-4">
        {/* the four measured points as a strip */}
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          GRPO loss drift vs. a freshly recaptured prefix — measured at steps 1 · 2 · 4 · 8
        </div>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {STEPS.map((s, i) => {
            // log scale so 0.04% and 22% both read
            const h = Math.max(4, (Math.log10(LOSS[i] + 0.01) - Math.log10(0.01)) / (Math.log10(30) - Math.log10(0.01)) * 100)
            const on = i === idx
            return (
              <button
                key={s}
                type="button"
                onClick={() => setIdx(i)}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                aria-label={`step ${s}`}
                style={{ height: "100%" }}
              >
                <span className="font-mono text-[10px] tabular-nums" style={{ color: SAFE[i] ? OK : BAD }}>
                  {LOSS[i] < 1 ? LOSS[i].toFixed(2) : LOSS[i].toFixed(1)}%
                </span>
                <span
                  className="w-full rounded-t transition-all"
                  style={{
                    height: `${h}%`,
                    background: SAFE[i] ? OK : BAD,
                    opacity: on ? 1 : 0.4,
                    outline: on ? `2px solid ${SAFE[i] ? OK : BAD}` : "none",
                    outlineOffset: 2,
                  }}
                />
                <span className={`font-mono text-[10px] tabular-nums ${on ? "text-foreground" : "text-muted-foreground"}`}>
                  step {s}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">loss drift</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: safe ? OK : BAD }}>
              {LOSS[idx] < 1 ? LOSS[idx].toFixed(2) : LOSS[idx].toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">mean |Δ| log-prob</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: safe ? OK : BAD }}>{LOGP[idx].toFixed(3)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">verdict</div>
            <div className="mt-0.5 text-sm font-medium" style={{ color: safe ? OK : BAD }}>
              {safe ? "reuse cache" : "recapture"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>optimizer steps since the prefix was captured</span>
            <span className="tabular-nums text-foreground">{step}</span>
          </div>
          <Range
            min={0}
            max={STEPS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(+e.target.value)}
            className="w-full"
            aria-label="optimizer steps since capture"
            accent={safe ? OK : BAD}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Reuse is nearly free for a <span style={{ color: OK }}>step or two</span> — the loss moves a
          tenth of a percent — but by step four the cached prompt state has drifted far from what the
          updated parameters would produce, so it needs a <span style={{ color: BAD }}>recapture</span>.
          The systems question is never &ldquo;does response-only replay produce gradients&rdquo; but
          &ldquo;how many updates can one expensive prefix serve&rdquo; — and the paper turns that into a
          measured refresh interval rather than a guess. (Drift is noisy: the step-4 reading exceeds
          step-8; the point is the regime, not a smooth curve.)
        </p>
      </div>
    </figure>
  )
}
