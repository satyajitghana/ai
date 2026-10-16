"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { KEPT } from "./kept-data"

// Which of Nemotron 3.5 Super VL's 512 routed experts per MoE block survive in
// Comet 60B. Measured: each of Comet's 256 router rows (gate.weight) was matched
// to the parent's 512 by cosine similarity, read from both BF16 checkpoints by
// HTTP range request. See kept-data.ts for the method and the per-block numbers.

const N = 512
const ROWS = KEPT.length // 40 backbone MoE blocks + the MTP block

function bits(hex: string): boolean[] {
  const out: boolean[] = []
  for (const ch of hex) {
    const v = parseInt(ch, 16)
    out.push(Boolean(v & 8), Boolean(v & 4), Boolean(v & 2), Boolean(v & 1))
  }
  return out
}

const cellW = 1.4
const cellH = 5
const left = 44

// One path per row and state: runs of consecutive experts merged into a single
// rectangle each, so the map is 123 paths rather than 20,992 rects.
function rowPaths(mask: boolean[], r: number): { keep: string; cut: string } {
  const y = r * (cellH + 1)
  let keep = ""
  let cut = ""
  let start = 0
  for (let e = 1; e <= mask.length; e++) {
    if (e === mask.length || mask[e] !== mask[start]) {
      const x = (left + start * cellW).toFixed(1)
      const w = ((e - start) * cellW - 0.2).toFixed(1)
      const d = `M${x} ${y}h${w}v${cellH}h-${w}z`
      if (mask[start]) keep += d
      else cut += d
      start = e
    }
  }
  return { keep, cut }
}

const KEEP = "oklch(0.62 0.14 200)"
const CUT = "oklch(0.62 0.19 27)"

export function ExpertMap() {
  const [model, setModel] = useState<"parent" | "comet">("comet")
  const [row, setRow] = useState(39)
  const masks = useMemo(() => KEPT.map((k) => bits(k.kept)), [])
  const runs = useMemo(() => masks.map((m, r) => rowPaths(m, r)), [masks])
  const sel = KEPT[row]
  const selMask = masks[row]

  const W = left + N * cellW + 6
  const H = ROWS * (cellH + 1) + 22

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>routed experts per MoE block · 41 blocks × 512</span>
        <span className="text-muted-foreground/60">measured from router rows</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(["parent", "comet"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModel(m)}
              aria-pressed={model === m}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                model === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "parent" ? "Nemotron 3.5 Super VL: 512 per block" : "Comet 60B: 256 per block"}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A grid of 41 rows, one per MoE block, each with 512 expert cells. In Comet 60B exactly 256 cells in every row survive, scattered across the row with no visible pattern; the other 256 are cut."
        >
          {KEPT.map((k, r) => {
            const y = r * (cellH + 1)
            return (
              <g key={k.block} onClick={() => setRow(r)} className="cursor-pointer">
                <text
                  x={left - 6}
                  y={y + cellH}
                  textAnchor="end"
                  fontSize={5.5}
                  className={cn("font-mono", r === row ? "fill-foreground" : "fill-muted-foreground")}
                >
                  {k.block === "mtp" ? "MTP" : `#${k.block}`}
                </text>
                <path d={runs[r].keep} fill={KEEP} opacity={r === row ? 1 : 0.75} />
                <path d={model === "parent" ? runs[r].cut : ""} fill={KEEP} opacity={r === row ? 1 : 0.75} />
                <path d={model === "parent" ? "" : runs[r].cut} fill={CUT} opacity={r === row ? 0.45 : 0.18} />
                {r === row && (
                  <rect
                    x={left - 1}
                    y={y - 0.6}
                    width={N * cellW + 1.6}
                    height={cellH + 1.2}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth={0.5}
                  />
                )}
              </g>
            )
          })}
          <text x={left} y={H - 6} fontSize={6} className="fill-muted-foreground font-mono">
            parent expert 0
          </text>
          <text x={left + N * cellW} y={H - 6} textAnchor="end" fontSize={6} className="fill-muted-foreground font-mono">
            511
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="comet-row" className="font-mono text-[11px] text-muted-foreground">
            block
          </label>
          <Range
            id="comet-row"
            min={0}
            max={ROWS - 1}
            step={1}
            value={row}
            onChange={(e) => setRow(Number(e.target.value))}
            className="w-56"
            aria-label="MoE block to inspect"
          />
          <span className="font-mono text-[11px] text-foreground">
            {sel.block === "mtp" ? "MTP draft block" : `backbone block ${sel.block}`}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <svg viewBox="0 0 228 116" className="w-full max-w-[260px]" role="img" aria-label="The selected block's 512 experts as a 32 by 16 grid, kept experts filled and cut ones faded.">
            {selMask.map((on, e) => {
              const keep = model === "parent" || on
              return (
                <rect
                  key={e}
                  x={2 + (e % 32) * 7}
                  y={2 + Math.floor(e / 32) * 7}
                  width={6}
                  height={6}
                  rx={1}
                  fill={keep ? KEEP : CUT}
                  opacity={keep ? 0.95 : 0.25}
                />
              )
            })}
          </svg>
          <div className="space-y-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div>
              experts: <span className="text-foreground">{model === "parent" ? "512" : "256 of 512 kept"}</span>
            </div>
            <div>
              expert width:{" "}
              <span className="text-foreground">{model === "parent" ? "2,688 channels" : "2,432 of 2,688 channels kept"}</span>
            </div>
            <div>
              params per expert:{" "}
              <span className="text-foreground">{model === "parent" ? "5,505,024" : "4,980,736"}</span>
            </div>
            {model === "comet" && (
              <div>
                router-row match, median / min cosine:{" "}
                <span className="text-foreground">
                  {sel.cos.toFixed(4)} / {sel.cosMin.toFixed(4)}
                </span>
              </div>
            )}
            <div className="pt-1 text-muted-foreground/70">
              {model === "comet"
                ? "Each block keeps its own 256, in the parent's order. Deeper blocks' routers moved further during healing."
                : "Every block of the parent has 512 routed experts plus one shared expert."}
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}
