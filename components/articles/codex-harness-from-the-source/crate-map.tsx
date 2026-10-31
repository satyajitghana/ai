"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { LAYERS, NODES } from "./data"
import { Chip, Panel, TEXT, fmt, type Tone } from "./ui"

// Six layers, drawn bottom to top. Each box is one crate; its height is the square root of its Rust lines.
// Projection uses the literal isometric factors 0.866 and 0.5 (no runtime trigonometry).
const NAMES = ["Protocol & schema", "Services & I/O", "Execution & sandbox", "Core engine", "Extensibility", "Hosts & front ends"]
const TONES: Tone[] = ["slate", "sky", "rose", "emerald", "violet", "amber"]
const CELL = 34
const COLS = 4
const ROWS = 3
const OX = 360
const GAP = 122

const iso = (x: number, y: number, z: number, oy: number): [number, number] => [OX + (x - y) * 0.866, oy + (x + y) * 0.5 - z]
const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`

type Box = { name: string; lines: number; tests: number; fanIn: number; fanOut: number; layer: number }

export function CrateMap() {
  const [pick, setPick] = useState<Box | null>(null)
  const [layer, setLayer] = useState<number | null>(null)

  const byLayer = useMemo(() => {
    const out: Box[][] = NAMES.map(() => [])
    for (const [name, l, lines, tests, fanIn, fanOut] of NODES) out[l].push({ name, lines, tests, fanIn, fanOut, layer: l })
    return out.map((l) => l.sort((a, b) => b.lines - a.lines))
  }, [])

  const height = 40 + NAMES.length * GAP + 40
  return (
    <Panel title="The workspace as a stack: 117 crates, six layers" sub="box height = square root of the crate's Rust lines; click a box or a name">
      <svg viewBox={`0 0 720 ${height}`} className="w-full" role="img" aria-label="Isometric stack of the six crate layers of the Codex workspace">
        {NAMES.map((label, l) => {
          const oy = height - 74 - l * GAP
          const top = byLayer[l].slice(0, COLS * ROWS)
          const cells = top.map((b, i) => ({ b, cx: (i % COLS) * CELL, cy: Math.floor(i / COLS) * CELL })).sort((p, q) => p.cx + p.cy - (q.cx + q.cy))
          const W = COLS * CELL
          const D = ROWS * CELL
          const slab = [iso(-6, -6, 0, oy), iso(W + 6, -6, 0, oy), iso(W + 6, D + 6, 0, oy), iso(-6, D + 6, 0, oy)]
          const dim = layer !== null && layer !== l
          return (
            <g key={label} opacity={dim ? 0.28 : 1} className={TEXT[TONES[l]]}>
              <polygon points={slab.map(pt).join(" ")} fill="currentColor" opacity={0.12} stroke="currentColor" strokeOpacity={0.4} />
              {cells.map(({ b, cx, cy }) => {
                const h = 4 + Math.sqrt(b.lines) / 10
                const x0 = cx + 3
                const y0 = cy + 3
                const x1 = cx + CELL - 3
                const y1 = cy + CELL - 3
                const topFace = [iso(x0, y0, h, oy), iso(x1, y0, h, oy), iso(x1, y1, h, oy), iso(x0, y1, h, oy)]
                const left = [iso(x0, y1, h, oy), iso(x1, y1, h, oy), iso(x1, y1, 0, oy), iso(x0, y1, 0, oy)]
                const right = [iso(x1, y0, h, oy), iso(x1, y1, h, oy), iso(x1, y1, 0, oy), iso(x1, y0, 0, oy)]
                const on = pick?.name === b.name
                return (
                  <g key={b.name} onClick={() => setPick(b)} style={{ cursor: "pointer" }}>
                    <title>{`${b.name}: ${fmt(b.lines)} lines`}</title>
                    <polygon points={left.map(pt).join(" ")} fill="currentColor" opacity={0.62} stroke="currentColor" strokeOpacity={0.3} />
                    <polygon points={right.map(pt).join(" ")} fill="currentColor" opacity={0.42} stroke="currentColor" strokeOpacity={0.3} />
                    <polygon points={topFace.map(pt).join(" ")} fill="currentColor" opacity={on ? 1 : 0.9} stroke={on ? "currentColor" : "none"} strokeWidth={on ? 2 : 0} />
                  </g>
                )
              })}
              <text x={OX - (W + D) * 0.433 - 34} y={oy + (W + D) * 0.25 - 4} textAnchor="end" className="fill-foreground text-[11px] font-medium">{label}</text>
              <text x={OX - (W + D) * 0.433 - 34} y={oy + (W + D) * 0.25 + 9} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {LAYERS[l].crates} crates · {fmt(LAYERS[l].lines)} lines
              </text>
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {NAMES.map((n, l) => (
          <Chip key={n} tone={TONES[l]} active={layer === l} onClick={() => setLayer(layer === l ? null : l)}>{n}</Chip>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px]">
        {pick ? (
          <>
            <code className="font-mono font-medium">codex-{pick.name}</code>
            <span className="text-muted-foreground"> · {NAMES[pick.layer]} · {fmt(pick.lines)} lines of Rust · {fmt(pick.tests)} test attributes · used by {pick.fanIn} workspace crates · depends on {pick.fanOut}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Pick a box. The two tallest are the engine (<code>core</code>) and the terminal UI (<code>tui</code>), at about 489k and 479k lines.</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {byLayer.flatMap((l) => l.slice(0, 3)).map((b) => (
          <button key={b.name} type="button" onClick={() => setPick(b)} className={cn("rounded border border-border px-1.5 py-0.5 font-mono text-[11px] hover:bg-muted", pick?.name === b.name && "bg-muted")}>{b.name}</button>
        ))}
      </div>
    </Panel>
  )
}
