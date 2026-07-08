"use client"

import { useState } from "react"

// The healing half of a6b-k-expansion: ESFT-style selective expert fine-tuning.
// Profile the router at k=32, keep the experts carrying the top-p 0.2 of token
// routing frequency (833 of 40*256 = 10,240 layer-experts), and train ONLY residual
// deltas on those experts' FFN slices — 2.62B of 35B params (7.5%). Router and every
// other weight stay frozen. The deltas are toggleable: turn them off and the exact
// stock model returns.
//
// Each cell = one layer-expert; the grid subsamples the real 40x256. ~8.1% light up
// as "selected for delta training". A deterministic hash picks them (single bounded
// pass, no randomness, no timers) so the first server render is stable.

const COLS = 40
const ROWS = 16
const CELLS = COLS * ROWS
const SELECT_PPT = 81 // per-thousand → 8.1% ≈ 833 / 10,240

const SEL = "oklch(0.64 0.15 150)" // healed deltas — green (matches the shared-expert accent)
const OFFC = "var(--muted-foreground)"

// Deterministic "high routing-frequency" mask — one bounded pass, no while-loops.
function selected(): boolean[] {
  const out: boolean[] = []
  for (let i = 0; i < CELLS; i++) {
    let x = ((i + 1) * 2654435761) >>> 0
    x = (x ^ (x << 13)) >>> 0
    x = (x ^ (x >>> 7)) >>> 0
    out.push(x % 1000 < SELECT_PPT)
  }
  return out
}
const MASK = selected()
const COUNT = MASK.filter(Boolean).length

// Gap to base@k8 (README / METHOD.md, Gen 0 vs Gen 2, exact McNemar).
const NUMS = {
  off: {
    label: "deltas off · naive k32 (Gen 0)",
    mmlu: "−3.7 pt",
    mmluP: "p=0.002 · significant loss",
    gsm: "−2.8 pt",
    gsmP: "p=0.016 · significant loss",
  },
  on: {
    label: "deltas on · mixed ESFT (Gen 2)",
    mmlu: "−2.0 pt",
    mmluP: "p=0.141 · statistical tie",
    gsm: "−2.2 pt",
    gsmP: "p=0.263 · statistical tie",
  },
} as const

export function EsftSelect() {
  const [on, setOn] = useState(true)
  const cur = on ? NUMS.on : NUMS.off

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>selective expert fine-tune · router frozen</span>
        <span className="text-muted-foreground/50">833 / 10,240 layer-experts</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* the layer-expert grid */}
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          role="img"
          aria-label={`A grid of layer-experts; ${COUNT} of ${CELLS} shown are selected for residual-delta training, ${on ? "currently applied" : "currently dormant"}. The router and all other weights stay frozen.`}
        >
          {MASK.map((sel, i) => (
            <span
              key={i}
              className="aspect-square rounded-[2px] transition-colors duration-300"
              style={{
                background: sel ? (on ? SEL : "transparent") : OFFC,
                border: sel && !on ? `1px solid ${SEL}` : undefined,
                opacity: sel ? (on ? 0.95 : 1) : 0.12,
              }}
            />
          ))}
        </div>

        {/* toggle + legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => setOn((v) => !v)}
            aria-pressed={on}
            className="cursor-pointer rounded-md px-3 py-1.5 font-mono text-[11px] text-background transition-colors"
            style={{ background: on ? SEL : "var(--muted-foreground)" }}
          >
            deltas: {on ? "on" : "off"}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">{cur.label}</span>
          <div className="ml-auto flex items-center gap-4 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SEL }} /> trained delta
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm opacity-30" style={{ background: OFFC }} /> frozen
            </span>
          </div>
        </div>

        {/* readout — gap to base@k8 flips with the toggle */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 font-mono text-xs sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-muted-foreground">trainable</div>
            <div className="text-foreground">2.62B / 35B · 7.5%</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">artifact</div>
            <div className="text-foreground">5.2 GB · toggleable</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">MMLU vs base@k8</div>
            <div style={{ color: on ? SEL : "var(--muted-foreground)" }}>{cur.mmlu}</div>
            <div className="text-[10px] text-muted-foreground/70">{cur.mmluP}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">GSM8K vs base@k8</div>
            <div style={{ color: on ? SEL : "var(--muted-foreground)" }}>{cur.gsm}</div>
            <div className="text-[10px] text-muted-foreground/70">{cur.gsmP}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Healing trains <em>only</em> residual deltas on the{" "}
          <span style={{ color: SEL }}>{COUNT}</span> highest routing-frequency experts shown here (the real run selects{" "}
          <span className="text-foreground">833 of 10,240</span> by top-p 0.2) — <span className="text-foreground">2.62B</span>{" "}
          of 35B params, router and everything else frozen. The deltas ship as one 5.2 GB artifact you patch on or off at load
          time; toggle them <span className="text-foreground">off</span> and the exact stock model returns. On heals a
          significant loss into a statistical tie — a repair, not a win. The point estimate stays negative.
        </p>
      </div>
    </figure>
  )
}
