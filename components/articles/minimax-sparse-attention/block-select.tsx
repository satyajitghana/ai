"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MiniMax Sparse Attention — the core move, drawn as a real diagram. For a given query,
// a lightweight Index Branch scores every past KV *block*; the Main Branch then attends
// only to the top-k highest-scoring blocks (plus the local block the query sits in).
// The score is per GQA group, so different groups fan out to different blocks over the
// SAME keys/values. Curved arrows connect the query only to the blocks it actually
// attends. Scrub the query, flip the group, step score → select → attend. Illustrative.

const SEL = "oklch(0.60 0.15 255)"
const LOCAL = "oklch(0.72 0.15 60)"
const NB = 18
const BLK = 128
const K = 4 // shown; real config selects 16 blocks

function rel(group: number, b: number) {
  const s = Math.sin((b + 1) * (group === 0 ? 1.7 : 2.9) + group * 2.1)
  const t = Math.cos((b + 1) * (group === 0 ? 0.6 : 0.35))
  return Math.min(1, Math.max(0, (s * 0.6 + t * 0.4 + 1) / 2))
}

type Phase = "score" | "select" | "attend"

// scene geometry (viewBox units)
const W = 760
const H = 300
const MX = 40
const BW = 30
const GAP = (W - 2 * MX - NB * BW) / (NB - 1)
const BY = 44 // block top
const BH = 30
const QY = 236 // query node top
const QH = 40
const bx = (b: number) => MX + b * (BW + GAP)
const cx = (b: number) => bx(b) + BW / 2

export function BlockSelect() {
  const [qb, setQb] = useState(NB - 1)
  const [group, setGroup] = useState(0)
  const [phase, setPhase] = useState<Phase>("select")

  const ranked = Array.from({ length: qb }, (_, b) => b).sort((a, b) => rel(group, b) - rel(group, a))
  const top = new Set(ranked.slice(0, K))
  const chosen = new Set<number>([qb, ...top])
  const qx = W / 2

  const curve = (x2: number, y2: number) => {
    const x1 = qx, y1 = QY
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sparse attention · one query, its blocks</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A query at block ${qb}, GQA group ${group + 1}, attends to ${chosen.size} of ${qb + 1} visible key blocks`}>
          <defs>
            <marker id="msa-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL} strokeWidth={1.5} />
            </marker>
            <marker id="msa-arrow-local" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={LOCAL} strokeWidth={1.5} />
            </marker>
            <filter id="msa-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* section labels */}
          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>key blocks · 128 tokens each →</text>

          {/* connectors (drawn first, behind nodes) */}
          {phase !== "score" &&
            [...chosen].map((b) => {
              const local = b === qb
              return (
                <path
                  key={b}
                  d={curve(cx(b), BY + BH)}
                  fill="none"
                  stroke={local ? LOCAL : SEL}
                  strokeWidth={1.5}
                  markerEnd={`url(#${local ? "msa-arrow-local" : "msa-arrow"})`}
                  opacity={phase === "attend" ? 0.9 : 0.6}
                />
              )
            })}

          {/* KV blocks */}
          {Array.from({ length: NB }, (_, b) => {
            const visible = b <= qb
            const local = b === qb
            const isChosen = chosen.has(b)
            const r = rel(group, b)
            let fill = "var(--muted)"
            let op = 0.3
            let stroke = "transparent"
            if (!visible) { op = 0.12 }
            else if (phase === "score") { fill = SEL; op = 0.1 + 0.55 * r }
            else if (phase === "select") {
              if (local) { fill = LOCAL; op = 0.9 }
              else if (isChosen) { fill = SEL; op = 0.85; stroke = SEL }
              else { fill = SEL; op = 0.12 + 0.2 * r }
            } else {
              if (local) { fill = LOCAL; op = 0.95 }
              else if (isChosen) { fill = SEL; op = 0.9 }
              else { fill = "var(--muted)"; op = 0.14 }
            }
            return (
              <g key={b}>
                <rect x={bx(b)} y={BY} width={BW} height={BH} rx={5} fill={fill} opacity={op} stroke={stroke} strokeWidth={1.5} filter={isChosen && phase !== "score" ? "url(#msa-soft)" : undefined} className="transition-all duration-300" />
                <text x={cx(b)} y={BY + BH + 12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>{b}</text>
              </g>
            )
          })}

          {/* query node */}
          <g>
            <rect x={qx - 82} y={QY} width={164} height={QH} rx={8} fill="var(--background)" stroke={SEL} strokeWidth={1.5} filter="url(#msa-soft)" />
            <text x={qx} y={QY + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>query · block {qb}</text>
            <text x={qx} y={QY + 31} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>index scores → top-{K} + local</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">group</span>
            {[0, 1].map((g) => (
              <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", group === g ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={group === g ? { background: SEL } : undefined}>
                {g + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {(["score", "select", "attend"] as Phase[]).map((p) => (
              <button key={p} type="button" onClick={() => setPhase(p)} aria-pressed={phase === p}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", phase === p ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {p}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            attends <span style={{ color: SEL }}>{chosen.size}</span> of {qb + 1} blocks · {chosen.size * BLK} tokens
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">query position (drag)</div>
          <input type="range" min={K + 1} max={NB - 1} value={qb} onChange={(e) => setQb(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          However far back the context runs, the query attends to a <span className="text-foreground">fixed</span> handful
          of blocks — top-{K} by index score, plus its local block. Flip the GQA group and the arrows swing to{" "}
          <span style={{ color: SEL }}>different blocks</span> over identical keys and values: each group of query heads
          keeps its own sparse view of the past. (Real config: block 128, top-16 = 2,048 tokens per query.)
        </p>
      </div>
    </figure>
  )
}
