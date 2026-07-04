"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two models, two weight classes, same MoE bet: carry a lot of parameters, pay for a
// small slice per token. M.1 is the ~200B-class flagship; XS.2 the ~30B-class open
// model. Each bar is total parameters (to scale between the two); the filled, shadowed
// segment is what's actually activated per token. Both are ~10× sparse — the point of
// MoE. Toggle to compare. Cross-links to the mixture-of-experts explainer.

const MODELS = [
  { key: "m1", name: "Laguna M.1", total: 225.8, active: 23.4, cls: "~200B class · flagship", open: "API / weights per report" },
  { key: "xs2", name: "Laguna XS.2", total: 33.4, active: 3.0, cls: "~30B class · open", open: "Apache-2.0 open weights" },
] as const

const MAX = 225.8
const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.72 0.05 230)"

// scene geometry (viewBox units)
const W = 680
const H = 176
const AX0 = 150 // axis / bar origin (x)
const AX1 = 654 // axis end (x)
const SPAN = AX1 - AX0
const BH = 34 // bar height
const ROW_Y = [40, 104] // bar top per model

export function TwoModels() {
  const [i, setI] = useState(0)
  const m = MODELS[i]
  const sparsity = (m.total / m.active).toFixed(1)
  const activePct = ((m.active / m.total) * 100).toFixed(0)
  const px = (b: number) => (b / MAX) * SPAN

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">two weight classes · total vs activated parameters</span>
        <div className="flex gap-1">
          {MODELS.map((mm, k) => (
            <button
              key={mm.key}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={i === k}
              className={cn("cursor-pointer rounded px-2 py-1 font-mono transition-colors", i === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {mm.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${MODELS[0].name} carries ${MODELS[0].total}B parameters and activates ${MODELS[0].active}B per token; ${MODELS[1].name} carries ${MODELS[1].total}B and activates ${MODELS[1].active}B — both about ten times sparse`}>
          <defs>
            <filter id="tm-soft" x="-20%" y="-40%" width="140%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* axis gridlines + ticks */}
          {[0, 50, 100, 150, 200].map((t) => (
            <g key={t}>
              <line x1={AX0 + px(t)} x2={AX0 + px(t)} y1={28} y2={H - 26} stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.6} />
              <text x={AX0 + px(t)} y={H - 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{t}</text>
            </g>
          ))}
          <text x={AX1} y={H - 12} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>billion params →</text>

          {/* bars, drawn to shared scale */}
          {MODELS.map((mm, k) => {
            const on = mm.key === m.key
            const y = ROW_Y[k]
            const totalW = px(mm.total)
            const activeW = px(mm.active)
            return (
              <g key={mm.key} opacity={on ? 1 : 0.42} className="transition-opacity duration-300">
                <text x={AX0 - 12} y={y + BH / 2 - 3} textAnchor="end" className={cn("font-mono", on ? "fill-foreground" : "fill-muted-foreground")} fontSize={11} fontWeight={600}>{mm.name}</text>
                <text x={AX0 - 12} y={y + BH / 2 + 11} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>{mm.cls}</text>
                {/* total (dormant) track */}
                <rect x={AX0} y={y} width={totalW} height={BH} rx={6} fill={MUTED} opacity={0.5} />
                {/* activated slice */}
                <rect x={AX0} y={y} width={activeW} height={BH} rx={6} fill={ACCENT} filter={on ? "url(#tm-soft)" : undefined} />
                {/* activated value tag */}
                <text x={AX0 + activeW + 6} y={y + BH / 2 + 3.5} className="font-mono" fontSize={9.5} fontWeight={600} fill={on ? "var(--foreground)" : "var(--muted-foreground)"}>{mm.active}B</text>
                {/* total value tag at bar end */}
                <text x={AX0 + totalW - 6} y={y + BH / 2 + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{mm.total}B total</text>
              </g>
            )
          })}
        </svg>

        {/* legend */}
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: ACCENT }} /> activated per token</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded" style={{ background: MUTED }} /> total (mostly dormant)</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">activated / token</div>
            <div className="font-medium" style={{ color: ACCENT }}>{m.active}B ({activePct}%)</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">sparsity</div>
            <div className="font-medium text-foreground">{sparsity}× total : active</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">class</div>
            <div className="font-medium text-foreground">{m.cls}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {m.name} carries <span className="text-foreground">{m.total}B</span> parameters but activates only{" "}
          <span className="text-foreground">{m.active}B</span> per token — about {sparsity}× sparse, the whole
          point of a <a className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground" href="/articles/mixture-of-experts-from-scratch">mixture of experts</a>.
          Same recipe, scaled down: XS.2 is the {" "}{MODELS[1].open}.
        </p>
      </div>
    </figure>
  )
}
