"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the compression costs — and how unevenly. PrismML's headline is "~95% /
// ~90% of full precision retained," but that overall number hides the spread:
// math barely moves while agentic tool-calling and vision fall much harder,
// especially at 1-bit. Pick a category to see the three-precision comparison,
// and read the per-category 1-bit retention strip below to see the unevenness.
// All scores are PrismML's 15-benchmark suite in thinking mode.

const FP = "oklch(0.62 0.02 260)" // baseline, muted
const TER = "oklch(0.62 0.15 255)" // ternary, blue
const ONE = "oklch(0.6 0.17 300)" // 1-bit, violet

type Cat = { key: string; fp16: number; ter: number; one: number }
const CATS: Cat[] = [
  { key: "Overall", fp16: 85.0, ter: 80.5, one: 76.1 },
  { key: "Math", fp16: 95.3, ter: 93.4, one: 91.7 },
  { key: "Coding", fp16: 88.7, ter: 86.0, one: 81.9 },
  { key: "Agentic", fp16: 80.0, ter: 74.0, one: 66.0 },
  { key: "Instruct", fp16: 78.4, ter: 71.8, one: 65.8 },
  { key: "Knowledge", fp16: 83.1, ter: 77.0, one: 73.4 },
  { key: "Vision", fp16: 72.6, ter: 65.2, one: 59.6 },
]
const ret = (c: Cat, v: "ter" | "one") => (c[v] / c.fp16) * 100

// retention color: >=95 green, 90-95 amber, <90 red-ish
const retColor = (pct: number) =>
  pct >= 95 ? "oklch(0.64 0.15 150)" : pct >= 90 ? "oklch(0.72 0.15 75)" : "oklch(0.63 0.19 30)"

const W = 760
const H = 150
const AX0 = 150
const AX1 = W - 120
const scaleX = (v: number) => AX0 + (v / 100) * (AX1 - AX0)

export function Retention() {
  const [sel, setSel] = useState("Agentic")
  const c = CATS.find((x) => x.key === sel)!
  const bars = [
    { label: "FP16", v: c.fp16, color: FP, r: 100 },
    { label: "Ternary", v: c.ter, color: TER, r: ret(c, "ter") },
    { label: "1-bit", v: c.one, color: ONE, r: ret(c, "one") },
  ]

  // strip geometry (1-bit retention across all categories)
  const SW = 760
  const stripCats = CATS.filter((x) => x.key !== "Overall")
  const cw = (SW - 2 * 20) / stripCats.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>quality kept · full precision vs ternary vs 1-bit</span>
        <span className="text-muted-foreground/50">PrismML suite · thinking mode</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* category control */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {CATS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                sel === x.key ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {x.key}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${sel} scores: FP16 ${c.fp16}, ternary ${c.ter}, 1-bit ${c.one}`}>
          <defs>
            <filter id="rt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>
          {[0, 25, 50, 75, 100].map((g) => (
            <line key={g} x1={scaleX(g)} x2={scaleX(g)} y1={16} y2={H - 20} stroke="var(--border)" strokeWidth={1} opacity={g === 0 ? 1 : 0.4} />
          ))}
          {bars.map((b, i) => {
            const y = 26 + i * 34
            return (
              <g key={b.label}>
                <text x={AX0 - 12} y={y + 16} textAnchor="end" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{b.label}</text>
                <rect x={AX0} y={y} width={scaleX(b.v) - AX0} height={22} rx={5} fill={b.color} filter="url(#rt-soft)" className="transition-all duration-300" />
                <text x={scaleX(b.v) + 8} y={y + 16} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{b.v.toFixed(1)}</text>
                {i > 0 ? (
                  <text x={W - 14} y={y + 16} textAnchor="end" className="font-mono" fontSize={10} fill={retColor(b.r)}>{b.r.toFixed(0)}% kept</text>
                ) : null}
              </g>
            )
          })}
          <text x={AX0} y={H - 6} className="fill-muted-foreground/60 font-mono" fontSize={9}>score (higher is better) →</text>
        </svg>

        {/* per-category 1-bit retention strip */}
        <div className="mt-2 font-mono text-[10px] text-muted-foreground">1-bit retention by category — the drop is uneven:</div>
        <svg viewBox={`0 0 ${SW} 74`} className="mt-1 w-full" role="img" aria-label="1-bit retention percentage for each benchmark category">
          {stripCats.map((x, i) => {
            const pct = ret(x, "one")
            const bx = 20 + i * cw
            const bh = ((pct - 75) / 25) * 40 // 75%..100% -> 0..40px
            const active = x.key === sel
            return (
              <g key={x.key} opacity={active ? 1 : 0.7}>
                <rect x={bx + 4} y={54 - Math.max(bh, 2)} width={cw - 12} height={Math.max(bh, 2)} rx={3} fill={retColor(pct)} stroke={active ? "var(--foreground)" : "none"} strokeWidth={active ? 1.2 : 0} />
                <text x={bx + cw / 2 - 4} y={54 - Math.max(bh, 2) - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>{pct.toFixed(0)}%</text>
                <text x={bx + cw / 2 - 4} y={68} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>{x.key}</text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Averaged over everything, the 1-bit model keeps ~<span className="text-foreground">90%</span> of
          full precision and ternary ~<span className="text-foreground">95%</span> — but that average is
          the story&apos;s villain. <span className="text-foreground">Math</span> survives almost intact
          (~96% at 1-bit), while <span style={{ color: ONE }}>agentic tool-calling</span> and{" "}
          <span style={{ color: ONE }}>vision</span> shed ~18% each. If your workload is the reasoning that
          quantizes gracefully, this is a great trade; if it&apos;s multi-step tool use, read the fine print.
        </p>
      </div>
    </figure>
  )
}
