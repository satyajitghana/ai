"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Solar Open 2's distinctive move, drawn as a real diagram. The 48-layer stack
// repeats a four-layer block twelve times: one SOFTMAX attention layer (GQA,
// keeps a KV cache) followed by THREE LINEAR attention layers (KDA, fixed-size
// recurrent state, no growing cache). So only 12 of 48 layers hold a KV cache —
// long-context memory collapses to ~1/4 of an all-softmax stack of the same shape.
//
// The reader drives two things: a mode toggle (Solar Open 2 hybrid vs an
// all-softmax baseline) that lights the caching layers, and a context-length
// scrubber that reports the KV-cache footprint each config carries at that length.
// Fully deterministic — no Date, no random — so SSR and client agree exactly.

const ACCENT = "oklch(0.58 0.21 293)" // Upstage / Solar violet
const MUT = "var(--muted-foreground)"

// KV-cache bytes per token, per softmax layer: K and V, 8 GQA KV heads, head_dim
// 128, fp16 (2 bytes). = 2 * 8 * 128 * 2 = 4096 bytes. Linear layers keep a
// fixed-size recurrent state that does NOT grow with sequence length, so they add
// no per-token KV term — that small constant is omitted here for clarity.
const BYTES_PER_TOKEN_PER_SOFTMAX = 2 * 8 * 128 * 2
const HYBRID_SOFTMAX = 12
const TOTAL_LAYERS = 48

type Mode = "hybrid" | "softmax"

// context scrubber stops: 4K, 8K, ... 1M (= 4096 * 2^i)
const CTX = Array.from({ length: 9 }, (_, i) => 4096 * 2 ** i)
const ctxLabel = (v: number) => (v >= 1_048_576 ? "1M" : `${v / 1024}K`)
const gib = (bytes: number) => bytes / 1024 ** 3
const fmtGiB = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(2))

// scene geometry (viewBox units)
const W = 760
const H = 300

// detail block — one [S · L · L · L] block, left→right
const DB_Y = 44
const DB_H = 34
const DB_W = 66
const DB_X0 = 30
const DB_PITCH = 104
const dbx = (i: number) => DB_X0 + i * DB_PITCH

// full 48-layer strip — 12 groups of 4 cells
const ST_Y = 168
const ST_H = 46
const G_X0 = 40
const CELL_W = 11
const CELL_PITCH = 12
const GROUP_PITCH = 55
const gx = (g: number, c: number) => G_X0 + g * GROUP_PITCH + c * CELL_PITCH

export function HybridStack() {
  const [mode, setMode] = useState<Mode>("hybrid")
  const [ci, setCi] = useState(CTX.length - 1) // default 1M

  const ctx = CTX[ci]
  const hybridBytes = HYBRID_SOFTMAX * BYTES_PER_TOKEN_PER_SOFTMAX * ctx
  const allBytes = TOTAL_LAYERS * BYTES_PER_TOKEN_PER_SOFTMAX * ctx
  const litCells = mode === "hybrid" ? HYBRID_SOFTMAX : TOTAL_LAYERS

  // horizontal S-curve between two node edges at the same y
  const curveH = (x1: number, x2: number, y: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2} ${y}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>hybrid attention stack · [Softmax, Linear×3] × 12</span>
        <span className="text-muted-foreground/50">250B-A15B</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Solar Open 2 has 48 layers in twelve blocks of one softmax and three linear layers. In ${mode === "hybrid" ? "hybrid" : "all-softmax"} mode ${litCells} of 48 layers keep a KV cache; at ${ctxLabel(ctx)} tokens that is ${fmtGiB(gib(mode === "hybrid" ? hybridBytes : allBytes))} gibibytes.`}
        >
          <defs>
            <marker id="so2-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="so2-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- detail block: one [S · L · L · L] ---- */}
          <text x={DB_X0} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            one block · softmax first, then three linear
          </text>

          {/* recurrent-state bracket over the three linear nodes */}
          <path
            d={`M ${dbx(1)} ${DB_Y - 8} L ${dbx(1)} ${DB_Y - 12} L ${dbx(3) + DB_W} ${DB_Y - 12} L ${dbx(3) + DB_W} ${DB_Y - 8}`}
            fill="none"
            stroke={MUT}
            strokeWidth={1}
            opacity={0.5}
          />
          <text x={(dbx(1) + dbx(3) + DB_W) / 2} y={DB_Y - 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            recurrent state · no KV cache
          </text>

          {/* connectors S→L→L→L */}
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={curveH(dbx(i) + DB_W, dbx(i + 1), DB_Y + DB_H / 2)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
              opacity={0.55}
              markerEnd="url(#so2-arrow)"
            />
          ))}

          {/* the four nodes */}
          {[
            { i: 0, label: "Softmax", sub: "GQA", soft: true },
            { i: 1, label: "Linear", sub: "KDA", soft: false },
            { i: 2, label: "Linear", sub: "KDA", soft: false },
            { i: 3, label: "Linear", sub: "KDA", soft: false },
          ].map((n) => (
            <g key={n.i}>
              <rect
                x={dbx(n.i)}
                y={DB_Y}
                width={DB_W}
                height={DB_H}
                rx={7}
                fill={n.soft ? ACCENT : "var(--muted)"}
                opacity={n.soft ? 0.92 : 0.5}
                stroke={n.soft ? ACCENT : "var(--border)"}
                strokeWidth={1.5}
                filter={n.soft ? "url(#so2-soft)" : undefined}
              />
              <text x={dbx(n.i) + DB_W / 2} y={DB_Y + 15} textAnchor="middle" fontSize={10} fontWeight={600} className={n.soft ? "fill-background font-mono" : "fill-foreground font-mono"}>
                {n.label}
              </text>
              <text x={dbx(n.i) + DB_W / 2} y={DB_Y + 27} textAnchor="middle" fontSize={8} className={n.soft ? "fill-background/70 font-mono" : "fill-muted-foreground font-mono"}>
                {n.sub}
              </text>
            </g>
          ))}

          {/* KV badge on the softmax node */}
          <g>
            <rect x={dbx(0) + DB_W + 8} y={DB_Y + 6} width={34} height={22} rx={5} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} />
            <text x={dbx(0) + DB_W + 8 + 17} y={DB_Y + 20} textAnchor="middle" fontSize={9} fontWeight={600} style={{ fill: ACCENT }} className="font-mono">
              KV
            </text>
          </g>

          {/* NoPE tag on the block input */}
          <text x={DB_X0} y={DB_Y + DB_H + 16} className="font-mono" fontSize={9} style={{ fill: ACCENT }}>
            NoPE · no positional encoding
          </text>

          {/* dashed "×12" connector down to the strip */}
          <path
            d={`M ${dbx(0) + DB_W / 2} ${DB_Y + DB_H + 22} C ${dbx(0) + DB_W / 2} ${ST_Y - 24}, ${gx(0, 0) + 22} ${ST_Y - 24}, ${gx(0, 0) + 22} ${ST_Y - 6}`}
            fill="none"
            stroke={MUT}
            strokeWidth={1.2}
            strokeDasharray="4 3"
            opacity={0.6}
            markerEnd="url(#so2-arrow)"
          />
          <text x={dbx(1)} y={ST_Y - 14} className="fill-muted-foreground font-mono" fontSize={10}>
            × 12 blocks = 48 layers
          </text>

          {/* ---- full 48-layer strip: 12 groups of 4 ---- */}
          {Array.from({ length: 12 }, (_, g) =>
            Array.from({ length: 4 }, (_, c) => {
              const isSoft = c === 0
              const lit = mode === "hybrid" ? isSoft : true
              return (
                <rect
                  key={`${g}-${c}`}
                  x={gx(g, c)}
                  y={ST_Y}
                  width={CELL_W}
                  height={ST_H}
                  rx={2.5}
                  fill={lit ? ACCENT : "var(--muted-foreground)"}
                  opacity={lit ? 0.9 : 0.16}
                  filter={lit ? "url(#so2-soft)" : undefined}
                  className="transition-all duration-300"
                />
              )
            })
          )}

          {/* strip axis labels */}
          <text x={G_X0} y={ST_Y + ST_H + 16} className="fill-muted-foreground/70 font-mono" fontSize={9}>
            layer 1
          </text>
          <text x={gx(11, 3) + CELL_W} y={ST_Y + ST_H + 16} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>
            layer 48
          </text>
          <text x={W / 2} y={ST_Y + ST_H + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            {mode === "hybrid" ? "12 softmax layers hold a KV cache" : "all 48 layers hold a KV cache"}
          </text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stack</span>
            {(
              [
                ["hybrid", "Solar Open 2"],
                ["softmax", "all-softmax"],
              ] as [Mode, string][]
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={mode === m ? { background: ACCENT } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            caching layers <span style={{ color: ACCENT }}>{litCells}</span> of {TOTAL_LAYERS}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>context length (drag)</span>
            <span className="text-foreground">{ctxLabel(ctx)} tokens</span>
          </div>
          <Range min={0} max={CTX.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
        </div>

        {/* readout */}
        <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">Solar Open 2 · 12 softmax</div>
            <div className="font-mono text-sm" style={{ color: ACCENT }}>
              {fmtGiB(gib(hybridBytes))} GiB
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">all-softmax · 48</div>
            <div className="font-mono text-sm text-foreground">{fmtGiB(gib(allBytes))} GiB</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="font-mono text-[10px] text-muted-foreground">KV cache at {ctxLabel(ctx)}</div>
            <div className="font-mono text-sm text-foreground">4× smaller</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every block runs <span className="text-foreground">one softmax layer then three linear ones</span>, twelve times over. Only the{" "}
          <span style={{ color: ACCENT }}>softmax</span> layers keep a KV cache that grows with the sequence; the linear (KDA) layers fold the past into a
          fixed-size recurrent state, so long-context memory rides on just <span className="text-foreground">12 of 48</span> layers — about a quarter of an
          all-softmax stack. (fp16 KV; linear-state memory is a small constant left out here.)
        </p>
      </div>
    </figure>
  )
}
