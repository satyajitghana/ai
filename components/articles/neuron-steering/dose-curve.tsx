"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

import { DOSE_ROWS, FINE, NEURON_A, PROMPTS } from "./data"

// The dose sweep for Qwen3-0.6B, layer 16, neuron 477 (picked by the contrast
// ranking), steered along its down_proj column by dose x the layer's median
// residual norm. Every number and every string below was printed by the run:
// the held-out perplexity is on one 100-word English paragraph; the "random"
// band is six random neurons of the same layer pushed the same dose in a
// random sign; the generations are greedy, 40 tokens, trimmed to 120
// characters here. Nothing is interpolated except the line between points.

const ACCENT = "oklch(0.62 0.16 35)"
const BAND = "oklch(0.60 0.15 255)"

const W = 640
const H = 250
const PX = 52
const PY = 14
const PW = W - PX - 14
const PH = H - PY - 34
const XMIN = -0.6
const XMAX = 1.6
const YMIN = 1.3 // 10^1.3 ~ 20
const YMAX = 4.2

const sx = (d: number) => PX + ((d - XMIN) / (XMAX - XMIN)) * PW
const sy = (p: number) => PY + PH - ((mlog10(p) - YMIN) / (YMAX - YMIN)) * PH

const FINE_A = FINE["A_L16N477"]

export function DoseCurve() {
  const [idx, setIdx] = useState(4)
  const row = DOSE_ROWS[idx]

  const line = [
    ...DOSE_ROWS.filter((r) => r.dose < 0).map((r) => ({ dose: r.dose, ppl: r.ppl })),
    ...FINE_A.map((r) => ({ dose: r.dose, ppl: r.ppl })),
    ...DOSE_ROWS.filter((r) => r.dose > 1.0).map((r) => ({ dose: r.dose, ppl: r.ppl })),
  ].sort((a, b) => a.dose - b.dose)
  const path = line.map((p, i) => `${i ? "L" : "M"}${sx(p.dose).toFixed(1)} ${sy(p.ppl).toFixed(1)}`).join(" ")
  const bandPts = DOSE_ROWS.filter((r) => r.dose >= 0)
  const band =
    bandPts.map((r, i) => `${i ? "L" : "M"}${sx(r.dose).toFixed(1)} ${sy(r.randMax).toFixed(1)}`).join(" ") +
    " " +
    [...bandPts].reverse().map((r) => `L${sx(r.dose).toFixed(1)} ${sy(r.randMin).toFixed(1)}`).join(" ") +
    " Z"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          dose sweep · L{NEURON_A.layer} N{NEURON_A.n} · Qwen3-0.6B · measured
        </span>
        <span className="font-mono text-xs">dose {row.dose.toFixed(2)}</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Held-out perplexity against dose for the steered neuron (orange line) and for six random neurons of the
            same layer (blue band), log scale. The neuron stays at the baseline of 29 until about 0.1, jumps above 600
            by 0.15, peaks near 5,000 at 0.3 and comes back to 99 at 0.5 and 87 at 0.75.
          </title>
          {[20, 100, 1000, 10000].map((t) => (
            <g key={t}>
              <line x1={PX} x2={PX + PW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={PX - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
                {t >= 1000 ? `${t / 1000}k` : t}
              </text>
            </g>
          ))}
          {[-0.5, 0, 0.5, 1, 1.5].map((t) => (
            <text key={t} x={sx(t)} y={H - 14} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
              {t.toFixed(1)}
            </text>
          ))}
          <text x={PX + PW / 2} y={H - 2} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55}>
            dose (x median residual norm)
          </text>
          <text x={12} y={PY + PH / 2} fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.55} transform={`rotate(-90 12 ${PY + PH / 2})`} textAnchor="middle">
            held-out perplexity
          </text>
          <path d={band} fill={BAND} fillOpacity={0.18} />
          <path d={path} fill="none" stroke={ACCENT} strokeWidth={2} />
          {line.map((p) => (
            <circle key={p.dose} cx={sx(p.dose)} cy={sy(p.ppl)} r={2.2} fill={ACCENT} />
          ))}
          <line x1={sx(row.dose)} x2={sx(row.dose)} y1={PY} y2={PY + PH} stroke="currentColor" strokeOpacity={0.5} strokeDasharray="3 3" />
          <circle cx={sx(row.dose)} cy={sy(row.ppl)} r={5} fill={ACCENT} stroke="var(--background)" strokeWidth={1.5} />
        </svg>

        <label className="mt-1 flex items-center gap-3 font-mono text-xs">
          <span className="text-muted-foreground">dose</span>
          <Range min={0} max={DOSE_ROWS.length - 1} step={1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} aria-label="Dose" accent={ACCENT} />
        </label>

        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["steered neuron, perplexity", row.ppl.toFixed(1)],
            ["six random neurons, mean", row.randMean.toFixed(1)],
            ["English function words", `${(row.enShare * 100).toFixed(0)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-3 space-y-2">
          {row.outs.map((o, i) => (
            <li key={i} className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed">
              <span className="text-muted-foreground">{PROMPTS[i]}</span>
              <span className="break-words">{o}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Greedy decoding, 40 new tokens, text cut at 120 characters; &ldquo;&#9166;&rdquo; marks a line break.
        </p>
      </div>
    </figure>
  )
}
