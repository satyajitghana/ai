"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the low bits actually go. Most post-training quantization keeps the
// sensitive parts — embeddings, attention, the LM head — at higher precision and
// only squeezes the MLPs, so the footprint only partly shrinks. Bonsai pushes the
// low-bit representation end to end, through every block plus a 4-bit vision
// tower, which is what lets the whole model collapse to a few GB. Flip the toggle.

const LOW = "oklch(0.6 0.17 300)" // low-bit (ternary / 1-bit)
const MID = "oklch(0.7 0.14 75)" // 4-bit
const HIGH = "oklch(0.62 0.02 260)" // FP16 / higher precision, muted

type Prec = "low" | "mid" | "high"
const label: Record<Prec, string> = { low: "1-bit / ternary", mid: "4-bit", high: "FP16" }
const color: Record<Prec, string> = { low: LOW, mid: MID, high: HIGH }

type Block = { id: string; name: string; x: number; bonsai: Prec; partial: Prec }
const W = 760
const H = 220
const BW = 132
const BH = 46
const ROW_Y = 96

// main language path, left to right
const BLOCKS: Block[] = [
  { id: "emb", name: "Embeddings", x: 24, bonsai: "low", partial: "high" },
  { id: "attn", name: "Attention", x: 208, bonsai: "low", partial: "high" },
  { id: "mlp", name: "MLPs", x: 392, bonsai: "low", partial: "low" },
  { id: "head", name: "LM head", x: 576, bonsai: "low", partial: "high" },
]
const VISION = { x: 208, y: 24, name: "Vision tower", bonsai: "mid" as Prec, partial: "mid" as Prec }

const cx = (b: { x: number }) => b.x + BW / 2

export function PrecisionMap() {
  const [mode, setMode] = useState<"bonsai" | "partial">("bonsai")
  const precOf = (b: Block) => (mode === "bonsai" ? b.bonsai : b.partial)
  const visPrec = mode === "bonsai" ? VISION.bonsai : VISION.partial
  const highCount = BLOCKS.filter((b) => precOf(b) === "high").length

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>precision across the network</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${mode === "bonsai" ? "Bonsai keeps every block low-bit" : "Typical partial PTQ keeps embeddings, attention and the LM head at FP16"}`}>
          <defs>
            <marker id="pm-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="pm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* connectors along the language path */}
          {BLOCKS.slice(1).map((b, i) => {
            const prev = BLOCKS[i]
            return (
              <path key={b.id} d={curve(prev.x + BW, ROW_Y + BH / 2, b.x, ROW_Y + BH / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#pm-arr)" opacity={0.7} />
            )
          })}
          {/* vision tower into attention */}
          <path d={curve(VISION.x + BW / 2, VISION.y + BH, cx(BLOCKS[1]), ROW_Y)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#pm-arr)" opacity={0.5} strokeDasharray="4 3" />

          {/* vision tower node */}
          <g>
            <rect x={VISION.x} y={VISION.y} width={BW} height={BH} rx={9} fill="var(--background)" stroke={color[visPrec]} strokeWidth={1.5} filter="url(#pm-soft)" />
            <text x={VISION.x + BW / 2} y={VISION.y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{VISION.name}</text>
            <text x={VISION.x + BW / 2} y={VISION.y + 35} textAnchor="middle" className="font-mono" fontSize={9} fill={color[visPrec]}>{label[visPrec]}</text>
          </g>

          {/* language blocks */}
          {BLOCKS.map((b) => {
            const p = precOf(b)
            return (
              <g key={b.id}>
                <rect x={b.x} y={ROW_Y} width={BW} height={BH} rx={9} fill="var(--background)" stroke={color[p]} strokeWidth={p === "high" ? 1.5 : 2} filter="url(#pm-soft)" className="transition-all duration-300" />
                <text x={cx(b)} y={ROW_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{b.name}</text>
                <text x={cx(b)} y={ROW_Y + 35} textAnchor="middle" className="font-mono transition-all" fontSize={9} fill={color[p]}>{label[p]}</text>
              </g>
            )
          })}

          <text x={24} y={ROW_Y + BH + 26} className="fill-muted-foreground/70 font-mono" fontSize={9}>token embeddings → hybrid attention → MLPs → output logits</text>
        </svg>

        {/* toggle */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setMode("bonsai")} aria-pressed={mode === "bonsai"} className={cn("cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors", mode === "bonsai" ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            Bonsai · end to end
          </button>
          <button type="button" onClick={() => setMode("partial")} aria-pressed={mode === "partial"} className={cn("cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors", mode === "partial" ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            Typical partial PTQ
          </button>
          <span className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: LOW }} />low-bit</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: MID }} />4-bit</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: HIGH }} />FP16</span>
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "bonsai" ? (
            <>Bonsai runs the low-bit representation through <span className="text-foreground">every block</span> —
            embeddings, attention, MLPs and the LM head — with a 4-bit vision tower alongside. Nothing is left at
            FP16, which is what lets the whole model reach 3.9 GB.</>
          ) : (
            <>Typical PTQ keeps the sensitive parts — embeddings, attention, the LM head ({highCount} of 4 blocks
            here) — at <span className="text-foreground">FP16</span> and only squeezes the MLPs, so the footprint
            only partly shrinks. The hard part Bonsai solves is quantizing the parts everyone else protects.</>
          )}{" "}
          Compare with the mixed-precision approach of{" "}
          <a href="/articles/nemotron-nvfp4" className="text-foreground underline underline-offset-4">native FP4 training</a>,
          which deliberately keeps some layers higher precision.
        </p>
      </div>
    </figure>
  )
}
