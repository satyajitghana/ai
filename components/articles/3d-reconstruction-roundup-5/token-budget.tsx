"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { evaluate, FINE, FULL, layout, realizable, type Block } from "./budget-math"

// Two layouts of the same token budget over the same image: one that opens the
// blocks whose contents vary most, one that ignores content. Each token is the
// mean of what it covers; error is against the 100% result. Computed live in
// budget-math.ts.

const CELL = 14
const SIDE = FINE * CELL

function Panel({ title, blocks, recon, psnr }: { title: string; blocks: Block[]; recon: number[]; psnr: number }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 font-mono text-[11px] text-muted-foreground">
        {title}:{" "}
        <span className="text-foreground">{Number.isFinite(psnr) ? `${psnr.toFixed(1)} dB` : "identical to 100%"}</span>
      </div>
      <svg viewBox={`0 0 ${SIDE} ${SIDE}`} className="h-auto w-full rounded border" role="img" aria-label={`${title}, ${blocks.length} tokens`}>
        {recon.map((v, i) => {
          const g = Math.round(245 - v * 200)
          return (
            <rect
              key={i}
              x={(i % FINE) * CELL}
              y={Math.floor(i / FINE) * CELL}
              width={CELL}
              height={CELL}
              fill={`rgb(${g},${g},${Math.min(255, g + 12)})`}
            />
          )
        })}
        {blocks.map((b, i) => (
          <rect
            key={`b${i}`}
            x={b.x * CELL + 0.5}
            y={b.y * CELL + 0.5}
            width={b.size * CELL - 1}
            height={b.size * CELL - 1}
            fill="none"
            stroke={b.size === 4 ? "oklch(0.62 0.19 30)" : b.size === 2 ? "oklch(0.75 0.15 80)" : "oklch(0.55 0.15 255)"}
            strokeWidth={b.size === 1 ? 0.6 : 1.2}
            opacity={0.85}
          />
        ))}
      </svg>
    </div>
  )
}

export function TokenBudget() {
  const [pct, setPct] = useState(40)
  const n = realizable((pct / 100) * FULL)
  const sal = useMemo(() => {
    const b = layout(n, true)
    return { b, e: evaluate(b) }
  }, [n])
  const uni = useMemo(() => {
    const b = layout(n, false)
    return { b, e: evaluate(b) }
  }, [n])
  const count = (bs: Block[], s: number) => bs.filter((b) => b.size === s).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one budget, two ways to spend it</span>
        <span className="text-muted-foreground/60">a 2D toy, computed live; not Budget3D&apos;s model</span>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4 pt-3">
        <Panel title="by content spread" blocks={sal.b} recon={sal.e.recon} psnr={sal.e.psnr} />
        <Panel title="content-blind" blocks={uni.b} recon={uni.e.recon} psnr={uni.e.psnr} />
      </div>
      <div className="px-4 pb-2 pt-3">
        <label className="block font-mono text-[11px] text-muted-foreground">
          budget: {n} of {FULL} tokens ({((n / FULL) * 100).toFixed(1)}%)
          <Range min={6.25} max={100} step={0.5} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        </label>
      </div>
      <figcaption className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>
          by spread: {count(sal.b, 4)} coarse, {count(sal.b, 2)} medium, {count(sal.b, 1)} fine;{" "}
          {(sal.e.emptyShare * 100).toFixed(0)}% of tokens on empty space
        </span>
        <span>
          blind: {count(uni.b, 4)} coarse, {count(uni.b, 2)} medium, {count(uni.b, 1)} fine;{" "}
          {(uni.e.emptyShare * 100).toFixed(0)}% on empty space
        </span>
        <span className="sm:col-span-2">
          token count = 16 + 3 × (blocks opened); red: coarse, amber: medium, blue: fine. Attention cost grows with the
          square of the count.
        </span>
      </figcaption>
    </figure>
  )
}
