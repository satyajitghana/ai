"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Multi-token prediction, made adjustable. From one position t, the model predicts
// the next n tokens at once: a shared trunk feeds n output heads (Meta's parallel
// heads) or n sequential modules that keep the causal chain (DeepSeek-V3). Pick n,
// flip the flavor, and read off the training loss as a sum of cross-entropies.
// Drawn as an SVG: trunk fans to the heads; sequential adds the chain between them.

const ACCENT = "oklch(0.62 0.16 285)"
const CTX = ["The", "cat", "sat", "on", "the"]
const FUTURE = ["mat", "and", "the", "dog"] // x_{t+1..t+4}

// scene geometry (viewBox units)
const W = 580
const H = 288
const PADX = 44
const UW = W - 2 * PADX
const CTX_Y = 22
const CTX_H = 26
const TRUNK_Y = 74
const TRUNK_H = 34
const TRUNK_W = 260
const HEAD_Y = 176
const HEAD_H = 36
const PRED_Y = 240
const PRED_H = 30

const ctxW = 48
const ctxGap = 8
const ctxTotal = CTX.length * ctxW + (CTX.length - 1) * ctxGap
const ctxX0 = (W - ctxTotal) / 2
const ctxCx = (i: number) => ctxX0 + i * (ctxW + ctxGap) + ctxW / 2

const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}
const hcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function MTPHeads() {
  const [n, setN] = useState(4)
  const [sequential, setSequential] = useState(false)

  const headCx = (i: number) => PADX + ((i + 0.5) * UW) / n
  const headW = Math.min(112, UW / n - 14)
  const trunkX = (W - TRUNK_W) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">multi-token prediction · n heads</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "parallel (Meta)" },
            { v: true, label: "sequential (DeepSeek)" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setSequential(o.v)}
              aria-pressed={sequential === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                sequential === o.v ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={sequential === o.v ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A shared transformer trunk feeds ${n} ${sequential ? "sequential modules keeping a causal chain" : "parallel heads"}, each predicting one of the next ${n} tokens.`}>
          <defs>
            <marker id="mh-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mh-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* context tokens fan into trunk */}
          {CTX.map((_, i) => (
            <path key={i} d={vcurve(ctxCx(i), CTX_Y + CTX_H, W / 2, TRUNK_Y)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} opacity={0.3} />
          ))}
          {CTX.map((w, i) => {
            const isT = i === CTX.length - 1
            return (
              <g key={i}>
                <rect x={ctxCx(i) - ctxW / 2} y={CTX_Y} width={ctxW} height={CTX_H} rx={6} fill={isT ? ACCENT : "var(--background)"} fillOpacity={isT ? 0.14 : 1} stroke={isT ? ACCENT : "var(--border)"} strokeWidth={1.5} />
                <text x={ctxCx(i)} y={CTX_Y + CTX_H / 2 + 3} textAnchor="middle" fill={isT ? ACCENT : "var(--foreground)"} className="font-mono" fontSize={10}>
                  {w}
                </text>
              </g>
            )
          })}
          <text x={ctxCx(CTX.length - 1) + ctxW / 2 + 6} y={CTX_Y + CTX_H / 2 + 3} fill="var(--muted-foreground)" className="font-mono" fontSize={9}>
            t
          </text>

          {/* trunk → heads connectors */}
          {FUTURE.slice(0, n).map((_, i) => (
            <path key={i} d={vcurve(W / 2, TRUNK_Y + TRUNK_H, headCx(i), HEAD_Y)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#mh-arrow)" opacity={0.8} />
          ))}

          {/* trunk */}
          <rect x={trunkX} y={TRUNK_Y} width={TRUNK_W} height={TRUNK_H} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#mh-soft)" />
          <text x={W / 2} y={TRUNK_Y + TRUNK_H / 2 + 4} textAnchor="middle" fill="var(--foreground)" className="font-mono" fontSize={11} fontWeight={600}>
            shared transformer trunk → z_t
          </text>

          {/* sequential chain between heads */}
          {sequential &&
            FUTURE.slice(0, n).map((_, i) =>
              i < n - 1 ? (
                <path key={i} d={hcurve(headCx(i) + headW / 2, HEAD_Y + HEAD_H / 2, headCx(i + 1) - headW / 2, HEAD_Y + HEAD_H / 2)} fill="none" stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#mh-arrow)" opacity={0.7} />
              ) : null
            )}

          {/* heads + head→pred connectors + predicted tokens */}
          {FUTURE.slice(0, n).map((tok, i) => (
            <g key={i}>
              <path d={vcurve(headCx(i), HEAD_Y + HEAD_H, headCx(i), PRED_Y)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#mh-arrow)" opacity={0.7} />
              <rect x={headCx(i) - headW / 2} y={HEAD_Y} width={headW} height={HEAD_H} rx={8} fill={ACCENT} fillOpacity={0.16} stroke={ACCENT} strokeWidth={1.5} filter="url(#mh-soft)" />
              <text x={headCx(i)} y={HEAD_Y + HEAD_H / 2 - 2} textAnchor="middle" fill="var(--foreground)" className="font-mono" fontSize={10} fontWeight={600}>
                {sequential ? `module ${i + 1}` : `head ${i + 1}`}
              </text>
              <text x={headCx(i)} y={HEAD_Y + HEAD_H / 2 + 11} textAnchor="middle" fill="var(--muted-foreground)" className="font-mono" fontSize={8}>
                x_t+{i + 1}
              </text>

              <rect x={headCx(i) - headW / 2} y={PRED_Y} width={headW} height={PRED_H} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#mh-soft)" />
              <text x={headCx(i)} y={PRED_Y + PRED_H / 2 + 4} textAnchor="middle" fill="var(--foreground)" className="font-mono" fontSize={11}>
                {tok}
              </text>
            </g>
          ))}
        </svg>

        {/* loss */}
        <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          <span className="text-foreground">L</span> ={" "}
          {FUTURE.slice(0, n).map((_, i) => (
            <span key={i}>
              {i > 0 ? " − " : "− "}log P(x<sub>t+{i + 1}</sub> | z<sub>t</sub>
              {sequential && i > 0 ? <>, x<sub>t+{i}</sub></> : null})
            </span>
          ))}
        </div>

        {/* n selector */}
        <div className="mt-3 flex items-center gap-2 font-mono text-xs">
          <span className="text-muted-foreground">n =</span>
          {[1, 2, 3, 4].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setN(k)}
              aria-pressed={n === k}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                n === k ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:border-foreground/40"
              )}
            >
              {k}
            </button>
          ))}
          {n === 4 ? <span className="text-muted-foreground">· n=4 is the sweet spot for ~7B on code</span> : null}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {sequential
            ? "DeepSeek-V3 keeps the full causal chain: module k feeds its hidden state and the already-known token forward, so depth-2 conditions on depth-1's prediction. Heavier, but the drafts are coherent."
            : "Meta's heads are independent off the same trunk — they don't see each other's predictions. Cheaper, and at inference you can discard the extra heads for a zero-overhead next-token model, or keep them to self-speculate."}
        </p>
      </div>
    </figure>
  )
}
