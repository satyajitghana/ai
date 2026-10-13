"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import {
  attnShare,
  blockFlopRatio,
  DENSE,
  entropies,
  fitBudget,
  scene,
  SIDE,
  TAU_2P,
  TAU_4P,
  type Cell,
} from "./quadtree-core"

// The budget dial on a scene drawn in code. The split rule, the 512-bin luma
// entropy, the thresholds (tau_2p = 6.0, tau_4p = 4.0 bits) and budget mode
// (bisect the offset delta until the layout fits) are the paper's
// (arXiv 2610.12307, Sec. 3.2, App. B.5 and C.4). The scene is mine. The FLOP
// ratios are my arithmetic for one standard transformer block (MLP ratio 4),
// using each parent's width D and dense token count N from the paper's
// Tables 16 and 21; they ignore conditioning tokens and the added modules.

const COL: Record<number, string> = {
  16: "oklch(0.76 0.16 75)",
  32: "oklch(0.68 0.17 350)",
  64: "oklch(0.62 0.13 165)",
}
const NAME: Record<number, string> = { 16: "p", 32: "2p", 64: "4p" }

const PARENTS = [
  { name: "JiT-L/32, 512²", n: 256, d: 1024 },
  { name: "MiniT2I-L/16, 512²", n: 1024, d: 1248 },
  { name: "PixelDiT-T2I, 1024²", n: 4096, d: 1536 },
]

type DecidedCell = Cell & { h: number | null }

// Which entropy decided each token: a kept 4p cell its own 64-px entropy, a
// kept 2p cell its 32-px entropy, and a p token the (too high) entropy of the
// 2p cell it was split from.
function decided(cells: Cell[]): DecidedCell[] {
  const { h4, h2 } = entropies()
  return cells.map((c) => {
    if (c.s === 64) return { ...c, h: h4[(c.y / 64) * 4 + c.x / 64] }
    const px = Math.floor(c.x / 32)
    const py = Math.floor(c.y / 32)
    return { ...c, h: c.s === 32 ? h2[py * 8 + px] : null }
  })
}

export function QuadtreeDial() {
  const [pct, setPct] = useState(30)
  const [view, setView] = useState<"picture" | "entropy">("picture")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const budget = Math.round((pct / 100) * DENSE)
  const { delta, cells } = useMemo(() => fitBudget(budget), [budget])
  const shown = useMemo(() => decided(cells), [cells])
  const n = cells.length
  const f = n / DENSE
  const count = (s: number) => cells.filter((c) => c.s === s).length

  // split p tokens shown as their parent 2p block in the entropy view
  const splitBlocks = useMemo(() => {
    const { h2 } = entropies()
    const seen = new Set<string>()
    const out: { x: number; y: number; h: number }[] = []
    for (const c of cells) {
      if (c.s !== 16) continue
      const bx = Math.floor(c.x / 32) * 32
      const by = Math.floor(c.y / 32) * 32
      const k = `${bx},${by}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ x: bx, y: by, h: h2[(by / 32) * 8 + bx / 32] })
    }
    return out
  }, [cells])

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const { rgb } = scene()
    const img = ctx.createImageData(SIDE, SIDE)
    for (let i = 0; i < SIDE * SIDE; i++) {
      img.data[i * 4] = Math.round(rgb[i * 3] * 255)
      img.data[i * 4 + 1] = Math.round(rgb[i * 3 + 1] * 255)
      img.data[i * 4 + 2] = Math.round(rgb[i * 3 + 2] * 255)
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
  }, [])

  const light = (h: number) => 0.97 - (h / 9) * 0.72
  const shade = (h: number) => `oklch(${light(h).toFixed(3)} 0.02 250)`
  const ink = (h: number) => (light(h) < 0.62 ? "oklch(0.98 0 0)" : "oklch(0.22 0.02 250)")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">entropy quadtree · budget mode</span>
        <div className="flex gap-1.5">
          {(["picture", "entropy"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setView(m)}
              aria-pressed={view === m}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <label className="block">
          <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-xs">
            <span className="text-muted-foreground">token budget B</span>
            <span>
              {pct}% · {budget} of {DENSE} tokens
            </span>
          </div>
          <Range
            min={10}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label="Token budget as a percentage of the dense grid"
            accent={COL[32]}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,320px)_1fr]">
          <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-md border bg-muted">
            <canvas
              ref={canvasRef}
              width={SIDE}
              height={SIDE}
              className="absolute inset-0 h-full w-full"
              style={{ imageRendering: "pixelated" }}
              aria-hidden="true"
            />
            <svg
              viewBox={`0 0 ${SIDE} ${SIDE}`}
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={`A meadow scene tiled by ${n} tokens: ${count(16)} of 16 px, ${count(32)} of 32 px and ${count(64)} of 64 px.`}
            >
              {view === "entropy" && (
                <g>
                  {shown
                    .filter((c) => c.h !== null)
                    .map((c) => (
                      <g key={`e${c.x},${c.y},${c.s}`}>
                        <rect x={c.x} y={c.y} width={c.s} height={c.s} fill={shade(c.h as number)} opacity={0.9} />
                        <text
                          x={c.x + c.s / 2}
                          y={c.y + c.s / 2 + 3.5}
                          textAnchor="middle"
                          fontSize={c.s === 64 ? 12 : 9.5}
                          fontFamily="ui-monospace, monospace"
                          fill={ink(c.h as number)}
                        >
                          {(c.h as number).toFixed(1)}
                        </text>
                      </g>
                    ))}
                  {splitBlocks.map((b) => (
                    <g key={`s${b.x},${b.y}`}>
                      <rect x={b.x} y={b.y} width={32} height={32} fill={shade(b.h)} opacity={0.9} />
                      <text
                        x={b.x + 16}
                        y={b.y + 19.5}
                        textAnchor="middle"
                        fontSize={9.5}
                        fontFamily="ui-monospace, monospace"
                        fill={ink(b.h)}
                        fontWeight={700}
                      >
                        {b.h.toFixed(1)}
                      </text>
                    </g>
                  ))}
                </g>
              )}
              {cells.map((c) => (
                <rect
                  key={`${c.x},${c.y},${c.s}`}
                  x={c.x + 0.75}
                  y={c.y + 0.75}
                  width={c.s - 1.5}
                  height={c.s - 1.5}
                  fill="none"
                  stroke={COL[c.s]}
                  strokeWidth={c.s === 16 ? 1 : 1.5}
                  opacity={0.95}
                />
              ))}
            </svg>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="grid grid-cols-3 gap-2">
              {[16, 32, 64].map((s) => (
                <div key={s} className="rounded-md border px-2 py-1.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL[s] }} />
                    {NAME[s]} · {s}px
                  </div>
                  <div className="text-base text-foreground">{count(s)}</div>
                </div>
              ))}
            </div>

            <div className="rounded-md border px-3 py-2 leading-relaxed">
              <div>
                tokens <span className="text-foreground">{n}</span> of {DENSE} ({(f * 100).toFixed(1)}%)
              </div>
              <div className="text-muted-foreground">
                offset δ* = {delta <= -10 ? "none needed" : `${delta.toFixed(2)} bits`}
              </div>
              <div className="text-muted-foreground">
                keep a 4p cell if H ≤ {delta <= -10 ? "—" : (TAU_4P + delta).toFixed(2)}; a 2p cell if H ≤{" "}
                {delta <= -10 ? "—" : (TAU_2P + delta).toFixed(2)}
              </div>
              <div className="text-muted-foreground">uniform patchify can only do 256, 64 or 16</div>
            </div>

            <div className="rounded-md border">
              <div className="border-b px-3 py-1.5 text-muted-foreground">
                one DiT block at {(f * 100).toFixed(0)}% of the tokens (reasoned)
              </div>
              <table className="w-full text-left">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-3 py-1 font-normal">parent</th>
                    <th className="px-2 py-1 text-right font-normal">attn share</th>
                    <th className="px-3 py-1 text-right font-normal">FLOPs</th>
                  </tr>
                </thead>
                <tbody>
                  {PARENTS.map((p) => (
                    <tr key={p.name} className="border-t">
                      <td className="px-3 py-1">{p.name}</td>
                      <td className="px-2 py-1 text-right text-muted-foreground">
                        {(attnShare(p.n, p.d) * 100).toFixed(0)}%
                      </td>
                      <td className="px-3 py-1 text-right">{(blockFlopRatio(f, p.n, p.d) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The scene is drawn in code; the rule is the paper&apos;s: 512-bin luma entropy, τ<sub>4p</sub> = 4.0 and τ
        <sub>2p</sub> = 6.0 bits, and δ bisected until the layout fits the budget. The entropy view shows the number each
        merge decision was made on; bold figures are 2p cells that split into four p tokens. FLOPs per block assume an
        MLP ratio of 4 and ignore conditioning tokens.
      </figcaption>
    </figure>
  )
}
