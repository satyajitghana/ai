"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { LAYERS } from "./router-data"

// One MoE layer's 896 experts as a 32 x 28 grid, expert 0 top-left. Each cell says which
// calibration-free score keeps it: the signed row sum the checkpoint used, the L1 default it
// replaced, both, or neither. Masks are measured from the two repos' router weights.

const COLS = 32
const ROWS = 28
const CELL = 14
const GAP = 2

function bits(hex: string): boolean[] {
  const out: boolean[] = []
  for (const ch of hex) {
    const v = parseInt(ch, 16)
    out.push((v & 8) !== 0, (v & 4) !== 0, (v & 2) !== 0, (v & 1) !== 0)
  }
  return out
}

const COLORS = {
  both: "oklch(0.58 0.15 150)",
  signed: "oklch(0.62 0.15 250)",
  l1: "oklch(0.72 0.14 60)",
  none: "oklch(0.55 0.01 260 / 0.18)",
}

type View = "both" | "signed" | "l1"

export function RouterGrid() {
  const [i, setI] = useState(44)
  const [view, setView] = useState<View>("both")
  const row = LAYERS[i]
  const cells = useMemo(() => {
    const s = bits(row.signed)
    const l = bits(row.l1)
    return s.map((sv, k) => (sv && l[k] ? "both" : sv ? "signed" : l[k] ? "l1" : "none"))
  }, [row])

  const meanOverlap = useMemo(() => LAYERS.reduce((a, r) => a + r.overlap, 0) / LAYERS.length, [])

  const shown = (c: string) => {
    if (c === "none") return COLORS.none
    if (view === "both") return COLORS[c as keyof typeof COLORS]
    if (view === "signed") return c === "both" || c === "signed" ? COLORS.signed : COLORS.none
    return c === "both" || c === "l1" ? COLORS.l1 : COLORS.none
  }

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )

  const W = COLS * (CELL + GAP) - GAP
  const H = ROWS * (CELL + GAP) - GAP
  const sparkH = 36

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>which 224 of 896 experts survive, layer {row.layer}</span>
        <span className="text-muted-foreground/60">measured from both repos&apos; routers</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="k31p-layer" className="font-mono text-[11px] text-muted-foreground">
            MoE layer
          </label>
          <Range
            id="k31p-layer"
            min={0}
            max={LAYERS.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            className="w-56"
            aria-label="MoE layer"
          />
          <span className="font-mono text-[11px] text-foreground">{row.layer}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn(view === "both")} aria-pressed={view === "both"} onClick={() => setView("both")}>
              compare
            </button>
            <button type="button" className={btn(view === "signed")} aria-pressed={view === "signed"} onClick={() => setView("signed")}>
              signed sum (shipped)
            </button>
            <button type="button" className={btn(view === "l1")} aria-pressed={view === "l1"} onClick={() => setView("l1")}>
              L1 (default)
            </button>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Layer ${row.layer}: ${row.overlap} of 224 experts kept by both scores`}>
          {cells.map((c, k) => (
            <rect
              key={k}
              x={(k % COLS) * (CELL + GAP)}
              y={Math.floor(k / COLS) * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={shown(c)}
            >
              <title>{`expert ${k}: ${c === "none" ? "dropped by both" : c === "both" ? "kept by both" : c === "signed" ? "kept by signed sum only" : "kept by L1 only"}`}</title>
            </rect>
          ))}
        </svg>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(["both", "signed", "l1", "none"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[k] }} />
              {k === "both" ? "kept by both" : k === "signed" ? "signed sum only" : k === "l1" ? "L1 only" : "dropped"}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">kept by both scores</div>
            <div className="text-base text-foreground">{row.overlap} of 224</div>
            <div className="text-muted-foreground/80">chance would be 56</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">mean over 92 layers</div>
            <div className="text-base text-foreground">{meanOverlap.toFixed(1)} of 224</div>
            <div className="text-muted-foreground/80">range 51 to 90</div>
          </div>
          <div className="rounded-md border px-3 py-2">
            <div className="text-muted-foreground">signed sum vs balance bias</div>
            <div className="text-base text-foreground">ρ = {row.rho.toFixed(3)}</div>
            <div className="text-muted-foreground/80">Spearman, this layer</div>
          </div>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">overlap per layer (click a bar)</div>
          <svg viewBox={`0 0 ${LAYERS.length * 6} ${sparkH}`} className="h-9 w-full" preserveAspectRatio="none" role="img" aria-label="Overlap of the two scores in every MoE layer">
            {LAYERS.map((r, k) => {
              const h = (r.overlap / 100) * sparkH
              return (
                <rect
                  key={r.layer}
                  x={k * 6}
                  y={sparkH - h}
                  width={5}
                  height={h}
                  fill={k === i ? "oklch(0.58 0.15 150)" : "oklch(0.55 0.01 260 / 0.45)"}
                  onClick={() => setI(k)}
                  className="cursor-pointer"
                />
              )
            })}
          </svg>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Blue and green together are the 224 experts the pruned checkpoint kept in this layer, expert 0 at top left. Orange and green are
        the 224 the converter&apos;s default L1 score would have kept. The two calibration-free scores agree on about 69 experts per layer, a little above the 56 two random picks would share.
      </figcaption>
    </figure>
  )
}
