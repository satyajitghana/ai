"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Every number below is transcribed from the paper's own tables, not re-measured:
// Table 1 (non-speech hallucination rate, ESC-50/UrbanSound8K/FSD50K, tau=0.6),
// Table 2 (LibriSpeech WER, test-clean/test-other), Table 3 (LibriSpeech speech
// false-rejection rate, same splits). "hr" below is the mean of a model+method's
// three Table 1 cells -- exactly how the abstract's headline 31.31% -> 2.44%
// (always-on) and -> 3.74% (gated) are computed: the mean of all 9 (model x
// dataset) original cells and all 9 projected cells in Table 1. WER/FRR "cost" is
// computed here as (projected - original) on the same split, which is how the
// abstract's own 0.33-4.39 percentage-point range and 0.41-9.97% FRR range are
// stated. Nothing here is estimated or interpolated.

type Variant = {
  hr: number
  werClean: number
  werOther: number
  frrClean: number
  frrOther: number
}

type ModelRow = {
  name: string
  short: string
  layer: number
  rank: number
  alpha: number
  gamma: number
  origHR: number
  origWERClean: number
  origWEROther: number
  origFRRClean: number
  origFRROther: number
  always: Variant
  gated: Variant
}

const MODELS: ModelRow[] = [
  {
    name: "Whisper small",
    short: "small",
    layer: 10,
    rank: 1,
    alpha: 1.0,
    gamma: 0.15,
    origHR: (23.5 + 12.33 + 21.35) / 3,
    origWERClean: 4.04,
    origWEROther: 8.38,
    origFRRClean: 0.0,
    origFRROther: 0.0,
    always: { hr: (1.5 + 0.81 + 6.68) / 3, werClean: 4.51, werOther: 11.48, frrClean: 0.64, frrOther: 4.86 },
    gated: { hr: (1.53 + 0.84 + 6.84) / 3, werClean: 4.37, werOther: 9.13, frrClean: 0.41, frrOther: 2.58 },
  },
  {
    name: "Whisper medium",
    short: "medium",
    layer: 24,
    rank: 2,
    alpha: 0.75,
    gamma: 0.1,
    origHR: (26.5 + 14.52 + 41.95) / 3,
    origWERClean: 3.66,
    origWEROther: 7.29,
    origFRRClean: 0.03,
    origFRROther: 0.27,
    always: { hr: (1.82 + 0.62 + 8.02) / 3, werClean: 6.4, werOther: 15.06, frrClean: 5.68, frrOther: 16.87 },
    gated: { hr: (2.75 + 0.66 + 8.78) / 3, werClean: 5.47, werOther: 11.68, frrClean: 4.07, frrOther: 9.97 },
  },
  {
    name: "Whisper large-v3",
    short: "large-v3",
    layer: 28,
    rank: 4,
    alpha: 1.0,
    gamma: 0.05,
    origHR: (44.25 + 76.08 + 21.35) / 3,
    origWERClean: 4.06,
    origWEROther: 5.87,
    origFRRClean: 0.04,
    origFRROther: 0.0,
    always: { hr: (1.5 + 0.87 + 0.18) / 3, werClean: 12.95, werOther: 13.13, frrClean: 10.5, frrOther: 11.47 },
    gated: { hr: (8.38 + 2.74 + 1.15) / 3, werClean: 6.17, werOther: 6.57, frrClean: 2.86, frrOther: 1.4 },
  },
]

const COLORS: Record<string, string> = {
  small: "oklch(0.62 0.13 220)",
  medium: "oklch(0.58 0.16 300)",
  "large-v3": "oklch(0.6 0.19 27)",
}

const W = 700
const H = 300
const PAD_L = 46
const PAD_R = 18
const PAD_T = 14
const PAD_B = 40
const X_MAX = 10 // pp, fixed across both toggle states on purpose
const Y_MAX = 5 // %, fixed likewise

const xScale = (v: number) => PAD_L + (v / X_MAX) * (W - PAD_L - PAD_R)
const yScale = (v: number) => H - PAD_B - (v / Y_MAX) * (H - PAD_T - PAD_B)

type VariantKey = "always" | "gated"

export function WerCostTradeoff() {
  const [variant, setVariant] = useState<VariantKey>("gated")
  const [selected, setSelected] = useState<string>("medium")

  const points = useMemo(
    () =>
      MODELS.map((m) => {
        const v = m[variant]
        const clean = v.werClean - m.origWERClean
        const other = v.werOther - m.origWEROther
        return { model: m, hr: v.hr, clean, other, lo: Math.min(clean, other), hi: Math.max(clean, other) }
      }),
    [variant]
  )

  const lo = Math.min(...points.map((p) => p.lo))
  const hi = Math.max(...points.map((p) => p.hi))
  const loPoint = points.find((p) => p.lo === lo)!
  const hiPoint = points.find((p) => p.hi === hi)!

  // Model rows can land within a percentage point of each other (medium and
  // large-v3's gated HR differ by 0.03pp) — pixel-adjacent enough that their
  // row labels collide. Dots and connecting lines stay at the true y; only
  // the text label gets nudged apart, with a short leader tick when it moves.
  const LABEL_MIN_GAP = 14
  const labelY = useMemo(() => {
    const order = points.map((p, i) => ({ i, y: yScale(p.hr) })).sort((a, b) => a.y - b.y)
    for (let k = 1; k < order.length; k++) {
      if (order[k].y - order[k - 1].y < LABEL_MIN_GAP) order[k].y = order[k - 1].y + LABEL_MIN_GAP
    }
    const out: number[] = new Array(points.length)
    order.forEach((o) => (out[o.i] = o.y))
    return out
  }, [points])

  const active = MODELS.find((m) => m.short === selected)!
  const activePoint = points.find((p) => p.model.short === selected)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">hallucination reduction vs. WER cost · Tables 1-3</span>
        <div className="flex gap-1">
          {(["gated", "always"] as VariantKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setVariant(k)}
              aria-pressed={variant === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                variant === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {k === "gated" ? "gated (deployed)" : "always-on (uncapped)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of hallucination rate against LibriSpeech WER cost for three Whisper scales under ${variant === "gated" ? "gated" : "always-on"} projection. WER cost ranges from ${lo.toFixed(2)} to ${hi.toFixed(2)} percentage points across the six model/split combinations shown.`}
        >
          {/* gridlines */}
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <g key={`y${v}`}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yScale(v)} y2={yScale(v)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
              <text x={PAD_L - 8} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {v}
              </text>
            </g>
          ))}
          {[0, 2, 4, 6, 8, 10].map((v) => (
            <g key={`x${v}`}>
              <line x1={xScale(v)} x2={xScale(v)} y1={PAD_T} y2={H - PAD_B} stroke="var(--border)" strokeWidth={1} opacity={0.25} />
              <text x={xScale(v)} y={H - PAD_B + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {v}
              </text>
            </g>
          ))}
          <text x={(PAD_L + W - PAD_R) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
            LibriSpeech WER cost vs. original Whisper (percentage points)
          </text>
          <text
            x={12}
            y={(PAD_T + H - PAD_B) / 2}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
            transform={`rotate(-90 12 ${(PAD_T + H - PAD_B) / 2})`}
          >
            avg. non-speech hallucination rate (%)
          </text>

          {/* min-max band for the current variant */}
          <rect
            x={xScale(lo)}
            width={Math.max(1, xScale(hi) - xScale(lo))}
            y={PAD_T}
            height={H - PAD_T - PAD_B}
            fill="oklch(0.65 0.16 40)"
            opacity={0.08}
          />
          <line x1={xScale(lo)} x2={xScale(lo)} y1={PAD_T} y2={H - PAD_B} stroke="oklch(0.65 0.16 40)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <line x1={xScale(hi)} x2={xScale(hi)} y1={PAD_T} y2={H - PAD_B} stroke="oklch(0.65 0.16 40)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <text x={(xScale(lo) + xScale(hi)) / 2} y={PAD_T + 12} textAnchor="middle" className="font-mono" fontSize={9.5} fill="oklch(0.55 0.16 40)" fontWeight={600}>
            Δ {lo.toFixed(2)} – {hi.toFixed(2)} pts
          </text>

          {/* model rows */}
          {points.map((p, idx) => {
            const color = COLORS[p.model.short]
            const y = yScale(p.hr)
            const ly = labelY[idx]
            const labelX = xScale(Math.max(p.clean, p.other)) + 10
            const isSel = p.model.short === selected
            return (
              <g key={p.model.short} opacity={isSel ? 1 : 0.4} className="transition-opacity duration-200">
                <line x1={xScale(p.clean)} x2={xScale(p.other)} y1={y} y2={y} stroke={color} strokeWidth={isSel ? 2.5 : 1.5} />
                <circle cx={xScale(p.clean)} cy={y} r={isSel ? 5 : 4} fill={color} />
                <circle cx={xScale(p.other)} cy={y} r={isSel ? 5 : 4} fill="var(--background)" stroke={color} strokeWidth={2} />
                {isSel ? (
                  <>
                    <text x={xScale(p.clean)} y={y - 10} textAnchor="middle" className="font-mono" fontSize={9} fill={color}>
                      clean
                    </text>
                    <text x={xScale(p.other)} y={y - 10} textAnchor="middle" className="font-mono" fontSize={9} fill={color}>
                      other
                    </text>
                  </>
                ) : null}
                {Math.abs(ly - y) > 3 ? (
                  <line x1={labelX - 4} x2={labelX - 4} y1={y} y2={ly} stroke={color} strokeWidth={1} opacity={0.4} />
                ) : null}
                <text x={labelX} y={ly + 3} textAnchor="start" className="font-mono" fontSize={9.5} fill={color} fontWeight={isSel ? 700 : 500}>
                  {p.model.short}
                </text>
              </g>
            )
          })}
        </svg>

        {/* model select */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">model</span>
          {MODELS.map((m) => (
            <button
              key={m.short}
              type="button"
              onClick={() => setSelected(m.short)}
              aria-pressed={selected === m.short}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                selected === m.short ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={selected === m.short ? { background: COLORS[m.short] } : undefined}
            >
              {m.short}
            </button>
          ))}
        </div>

        {/* readout for selected model */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-muted/20 px-3 py-2 font-mono text-[10.5px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">config</div>
            <div className="text-foreground">
              ℓ={active.layer}, r={active.rank}, α={active.alpha}, γ={active.gamma}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">HR: original → {variant}</div>
            <div className="text-foreground">
              {active.origHR.toFixed(1)}% → {activePoint.hr.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">WER cost (clean / other)</div>
            <div className="text-foreground">
              +{activePoint.clean.toFixed(2)} / +{activePoint.other.toFixed(2)} pts
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">speech FRR (clean / other)</div>
            <div className="text-foreground">
              {active[variant].frrClean.toFixed(2)}% / {active[variant].frrOther.toFixed(2)}%
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {variant === "gated" ? (
            <>
              This is the paper&rsquo;s recommended deployment setting &mdash; each scale at its own tuned{" "}
              (<span className="text-foreground">ℓ, r, α, γ</span>) from Section 5.1. Every point sits under{" "}
              <span className="text-foreground">5% average hallucination rate</span>, down from originals between{" "}
              {Math.min(...MODELS.map((m) => m.origHR)).toFixed(0)}% and {Math.max(...MODELS.map((m) => m.origHR)).toFixed(0)}%
              {" "}(off this chart&rsquo;s scale). Now look at the horizontal spread of each row: for one fixed
              operating point, the WER cost still swings just from choosing test-clean over test-other &mdash; and
              across scales the two ends of that swing are{" "}
              <span className="font-semibold" style={{ color: COLORS[loPoint.model.short] }}>
                +{lo.toFixed(2)} pts ({loPoint.model.short}, test-{lo === loPoint.clean ? "clean" : "other"})
              </span>{" "}
              and{" "}
              <span className="font-semibold" style={{ color: COLORS[hiPoint.model.short] }}>
                +{hi.toFixed(2)} pts ({hiPoint.model.short}, test-{hi === hiPoint.other ? "other" : "clean"})
              </span>
              , the paper&rsquo;s own abstract range of &ldquo;0.33&ndash;4.39 percentage points.&rdquo; No single
              rank, layer, or threshold explains that 13x span &mdash; model scale and test split do.
            </>
          ) : (
            <>
              {(() => {
                const hiIsOther = hi === hiPoint.other
                const resultWER = hiIsOther ? hiPoint.model.always.werOther : hiPoint.model.always.werClean
                const origWER = hiIsOther ? hiPoint.model.origWEROther : hiPoint.model.origWERClean
                const mult = resultWER / origWER
                return (
                  <>
                    This is the price of skipping the gate. Every segment stretches far to the right of the gated
                    view &mdash; the worst always-on cost,{" "}
                    <span className="font-semibold" style={{ color: COLORS[hiPoint.model.short] }}>
                      {hiPoint.model.short} test-{hiIsOther ? "other" : "clean"} at +{hi.toFixed(2)} pts
                    </span>
                    , takes WER from {origWER.toFixed(2)}% to {resultWER.toFixed(2)}% &mdash; {mult.toFixed(1)}x the
                    original. The hallucination payoff for accepting that cost is uneven, too: dropping the gate
                    barely moves HR for small ({MODELS[0].gated.hr.toFixed(2)}% &rarr; {MODELS[0].always.hr.toFixed(2)}%)
                    or medium ({MODELS[1].gated.hr.toFixed(2)}% &rarr; {MODELS[1].always.hr.toFixed(2)}%), while for
                    large-v3 it is transformative: {MODELS[2].gated.hr.toFixed(2)}% down to{" "}
                    {MODELS[2].always.hr.toFixed(2)}%. The gate is not free insurance &mdash; it is a bet that most
                    inputs are ordinary speech, and for large-v3 specifically that bet is the more expensive side of
                    the trade.
                  </>
                )
              })()}
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
