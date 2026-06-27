"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// DSpark's second idea: don't verify the whole draft block blindly. A confidence
// head scores each drafted position; a hardware-aware scheduler keeps only the
// prefix whose cumulative confidence clears a threshold τ, and routes scarce
// target-batch capacity to those tokens. Drag τ — and flip the load — to see the
// verify length trade against wasted compute. Illustrative confidences (a plausible
// decay along the block); the real head is trained end-to-end and post-hoc calibrated.

// per-position confidence, decaying down the W=5 block (drafts get less certain)
const CONF = [0.97, 0.88, 0.74, 0.58, 0.41]
const TOK = ["E", "F", "G", "H", "I"]

export function ConfidenceScheduler() {
  const [tau, setTau] = useState(0.55)
  const [heavy, setHeavy] = useState(false)

  // keep the leading run of positions whose confidence clears τ
  let kept = 0
  for (const c of CONF) {
    if (c >= tau) kept++
    else break
  }
  // expected accepted length ≈ sum of kept confidences + the free bonus token
  const expected = CONF.slice(0, kept).reduce((a, b) => a + b, 0) + 1
  // wasted = drafts we'd have verified at τ=0 that the target would reject
  const verifiedAtZero = CONF.length
  const wasted = heavy ? verifiedAtZero - kept : 0
  const recommend = heavy ? 0.7 : 0.2

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">confidence-scheduled verification</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "light load" },
            { v: true, label: "heavy load" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setHeavy(o.v)}
              aria-pressed={heavy === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                heavy === o.v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4">
        {/* draft block with confidence bars */}
        <div className="flex items-end gap-2">
          {CONF.map((c, i) => {
            const inPrefix = i < kept
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {c.toFixed(2)}
                </span>
                <div className="flex h-20 w-full items-end overflow-hidden rounded bg-muted">
                  <div
                    className="w-full transition-all"
                    style={{
                      height: `${c * 100}%`,
                      background: inPrefix
                        ? "oklch(0.72 0.15 150)"
                        : "oklch(0.6 0.015 260)",
                      opacity: inPrefix ? 1 : 0.4,
                    }}
                  />
                </div>
                <span
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-xs",
                    inPrefix ? "text-foreground" : "text-muted-foreground line-through opacity-50"
                  )}
                >
                  {TOK[i]}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">
                  {inPrefix ? "verify" : "drop"}
                </span>
              </div>
            )
          })}
        </div>

        {/* threshold slider */}
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>confidence threshold τ</span>
            <span className="text-foreground tabular-nums">{tau.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={0.99}
            step={0.01}
            value={tau}
            onChange={(e) => setTau(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-foreground"
            aria-label="confidence threshold"
          />
        </div>

        {/* readout */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="prefix verified" value={`${kept}/${CONF.length}`} />
          <Stat label="expected accepted" value={`~${expected.toFixed(1)} tok`} />
          <Stat
            label={heavy ? "wasted verifies" : "spare capacity"}
            value={heavy ? `${wasted}` : "ample"}
          />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {heavy ? (
            <>
              Under heavy concurrency, target-batch slots are precious. Verifying
              the low-confidence tail just burns them on tokens that will be
              rejected — so the scheduler raises τ (try{" "}
              <button
                type="button"
                onClick={() => setTau(recommend)}
                className="cursor-pointer underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
              >
                τ ≈ {recommend}
              </button>
              ), trims the block to its confident head, and spends the freed
              capacity on more requests.
            </>
          ) : (
            <>
              With GPUs underutilized, verification is nearly free — so the
              scheduler drops τ (try{" "}
              <button
                type="button"
                onClick={() => setTau(recommend)}
                className="cursor-pointer underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
              >
                τ ≈ {recommend}
              </button>
              ), verifies the whole block, and squeezes out every accepted token
              it can. The length is chosen per request, from live engine load.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  )
}
