"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// One real packet of Mirai S, decoded the way the CUDA kernel decodes it.
//
// The bytes are row 0, packet 0 of layers.10.mlp.down_proj in the vLLM sidecar
// (trellis.mirai), read by HTTP range request: one entry byte, then 16 symbol
// bytes. The same row's first 17 bytes in the uzu package (model.safetensors)
// hold the same bits, and the GGUF copies the sidecar's bytes verbatim.
//
// Format V4T8: a 16-bit state, 8 new bits per step, 4 weights per step, so 2 bits
// per weight, plus the 8-bit entry every 64 weights (2.125). Per step:
//   state = (state << 8 | symbol) & 0xFFFF
//   h     = fmix32(state)                     (kernels.cu, fmix_hash)
//   level = 8 * pairs(byte) + ((3 * (byte & 15)) & 15) - 54
//   w_j   = c * level_j + d_j                 (c, d from mirai.codebook.v4)
// Integer ops only for the hash (Math.imul, >>> 0), then one multiply and one
// add per weight, so server and client render the same numbers.

const ENTRY = 0x34
const SYMBOLS = [
  0x23, 0x4e, 0x31, 0xc0, 0xac, 0xcf, 0xd4, 0x65, 0x47, 0xc6, 0xa8, 0x28, 0x52, 0xf4, 0x0b, 0x46,
]
const C = 0.05203747749328613
const D = [-0.08205971866846085, -0.0775885358452797, -0.07814357429742813, -0.08109892904758453]

const ACC = "oklch(0.60 0.16 265)"
const ACC2 = "oklch(0.66 0.14 160)"

function fmix(state: number): number {
  let x = (Math.imul(state, 0xcfccb83f) + 0x584b4aa3) >>> 0
  x = (x ^ (x >>> 16)) >>> 0
  x = Math.imul(x, 0x85ebca6b) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}

const pairsOf = (b: number) => (b & 3) + ((b >> 2) & 3) + ((b >> 4) & 3) + ((b >> 6) & 3)
const ditherOf = (b: number) => (3 * (b & 15)) & 15

type Step = {
  state: number
  hash: number
  bytes: number[]
  levels: number[]
  weights: number[]
}

function decodeAll(): Step[] {
  const out: Step[] = []
  let state = ENTRY
  for (const sym of SYMBOLS) {
    state = ((state << 8) | sym) & 0xffff
    const hash = fmix(state)
    const bytes = [0, 1, 2, 3].map((j) => (hash >>> (8 * j)) & 255)
    const levels = bytes.map((b) => 8 * pairsOf(b) + ditherOf(b) - 54)
    const weights = levels.map((l, j) => C * l + D[j])
    out.push({ state, hash, bytes, levels, weights })
  }
  return out
}

const STEPS = decodeAll()
const hex = (n: number, w: number) => n.toString(16).padStart(w, "0")
const bin16 = (n: number) => {
  const s = n.toString(2).padStart(16, "0")
  return `${s.slice(0, 8)} ${s.slice(8)}`
}

// geometry
const W = 640
const H = 264
const TAPE_Y = 18
const CHIP_W = 32
const CHIP_H = 24
const CHIP_GAP = 3
const TAPE_X = (W - (17 * CHIP_W + 16 * CHIP_GAP)) / 2
const STEM_Y0 = 190 // zero line of the stem plot
const STEM_SCALE = 24 // px per code unit
const STEM_X0 = 36
const STEM_DX = (W - STEM_X0 - 12) / 64

export function TrellisDecode() {
  const [k, setK] = useState(0)
  const cur = STEPS[k]
  const prevByte = k === 0 ? ENTRY : SYMBOLS[k - 1]

  const chipX = (i: number) => TAPE_X + i * (CHIP_W + CHIP_GAP)
  const tape = [ENTRY, ...SYMBOLS]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one 64-weight packet, decoded like the kernel does it
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          layers.10 ffn_down · row 0 · V4T8 · bytes from trellis.mirai
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Step ${k + 1} of 16: state 0x${hex(cur.state, 4)}, hash 0x${hex(cur.hash, 8)}, levels ${cur.levels.join(", ")}, weights ${cur.weights.map((w) => w.toFixed(3)).join(", ")}.`}
        >
          <defs>
            <marker id="td-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACC} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* the tape: entry byte + 16 symbol bytes */}
          {tape.map((b, i) => {
            const inWindow = i === k || i === k + 1
            const done = i < k
            return (
              <g key={i}>
                <rect
                  x={chipX(i)}
                  y={TAPE_Y}
                  width={CHIP_W}
                  height={CHIP_H}
                  rx={5}
                  fill={inWindow ? ACC : "var(--background)"}
                  fillOpacity={inWindow ? 0.18 : 1}
                  stroke={inWindow ? ACC : "var(--border)"}
                  strokeWidth={inWindow ? 1.8 : 1}
                  opacity={done ? 0.45 : 1}
                />
                <text
                  x={chipX(i) + CHIP_W / 2}
                  y={TAPE_Y + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--foreground)"
                  className="font-mono"
                  opacity={done ? 0.55 : 1}
                >
                  {hex(b, 2)}
                </text>
              </g>
            )
          })}
          <text x={chipX(0) + CHIP_W / 2} y={TAPE_Y + CHIP_H + 13} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            entry
          </text>
          <text x={chipX(9)} y={TAPE_Y + CHIP_H + 13} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            16 symbols, 8 bits each
          </text>

          {/* window -> state -> hash */}
          <path
            d={`M ${chipX(k) + CHIP_W + CHIP_GAP / 2} ${TAPE_Y + CHIP_H + 2} C ${chipX(k) + CHIP_W} ${TAPE_Y + 52}, ${W / 2 - 150} ${TAPE_Y + 48}, ${W / 2 - 150} ${TAPE_Y + 66}`}
            fill="none"
            stroke={ACC}
            strokeWidth={1.5}
            markerEnd="url(#td-arrow)"
          />
          <text x={W / 2 - 150} y={TAPE_Y + 84} textAnchor="middle" fontSize={11} fill="var(--foreground)" className="font-mono">
            state 0x{hex(cur.state, 4)}
          </text>
          <text x={W / 2 - 150} y={TAPE_Y + 98} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            {bin16(cur.state)}
          </text>
          <path d={`M ${W / 2 - 78} ${TAPE_Y + 80} L ${W / 2 - 18} ${TAPE_Y + 80}`} fill="none" stroke={ACC} strokeWidth={1.5} markerEnd="url(#td-arrow)" />
          <text x={W / 2 - 48} y={TAPE_Y + 74} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            fmix32
          </text>
          <text x={W / 2 + 40} y={TAPE_Y + 84} textAnchor="middle" fontSize={11} fill="var(--foreground)" className="font-mono">
            0x{hex(cur.hash, 8)}
          </text>
          {cur.bytes.map((b, j) => (
            <text
              key={j}
              x={W / 2 + 118 + j * 44}
              y={TAPE_Y + 84}
              textAnchor="middle"
              fontSize={11}
              fill={ACC2}
              className="font-mono"
            >
              {cur.levels[j] > 0 ? "+" : ""}
              {cur.levels[j]}
            </text>
          ))}
          <text x={W / 2 + 184} y={TAPE_Y + 98} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            levels, one per hash byte
          </text>

          {/* stem plot of the 64 decoded weights */}
          <line x1={STEM_X0} x2={W - 8} y1={STEM_Y0} y2={STEM_Y0} stroke="var(--border)" />
          {[-2, -1, 1, 2].map((g) => (
            <g key={g}>
              <line x1={STEM_X0} x2={W - 8} y1={STEM_Y0 - g * STEM_SCALE} y2={STEM_Y0 - g * STEM_SCALE} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={STEM_X0 - 6} y={STEM_Y0 - g * STEM_SCALE + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" className="font-mono">
                {g > 0 ? `+${g}` : g}
              </text>
            </g>
          ))}
          {STEPS.flatMap((st, si) =>
            st.weights.map((w, j) => {
              const i = si * 4 + j
              const x = STEM_X0 + (i + 0.5) * STEM_DX
              const y = STEM_Y0 - w * STEM_SCALE
              const active = si === k
              const future = si > k
              return (
                <g key={i} opacity={future ? 0.18 : active ? 1 : 0.7}>
                  <line x1={x} x2={x} y1={STEM_Y0} y2={y} stroke={active ? ACC2 : ACC} strokeWidth={active ? 3 : 2} />
                  <circle cx={x} cy={y} r={active ? 3 : 2} fill={active ? ACC2 : ACC} />
                </g>
              )
            })
          )}
          <text x={STEM_X0} y={H - 6} fontSize={9.5} fill="var(--muted-foreground)" className="font-mono">
            64 decoded weights, code units (x rowscale 0.0109 for the stored row)
          </text>
        </svg>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setK((v) => Math.max(0, v - 1))}
            className="rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted/40"
            aria-label="previous step"
          >
            ◀
          </button>
          <Range
            min={0}
            max={15}
            step={1}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            accent={ACC}
            className="flex-1"
            aria-label="trellis step"
          />
          <button
            type="button"
            onClick={() => setK((v) => Math.min(15, v + 1))}
            className="rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted/40"
            aria-label="next step"
          >
            ▶
          </button>
          <span className="w-20 text-right font-mono text-[11px] tabular-nums">step {k + 1} / 16</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">weight</th>
                <th className="py-1 pr-2 font-normal">hash byte</th>
                <th className="py-1 pr-2 font-normal">8 x pairs</th>
                <th className="py-1 pr-2 font-normal">dither</th>
                <th className="py-1 pr-2 font-normal">level</th>
                <th className="py-1 font-normal">c x level + d</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {cur.bytes.map((b, j) => (
                <tr key={j} className="border-t border-border/60">
                  <td className="py-1 pr-2">{k * 4 + j}</td>
                  <td className="py-1 pr-2">
                    0x{hex(b, 2)} <span className="text-muted-foreground">{b.toString(2).padStart(8, "0")}</span>
                  </td>
                  <td className="py-1 pr-2">{8 * pairsOf(b)}</td>
                  <td className="py-1 pr-2">{ditherOf(b)}</td>
                  <td className="py-1 pr-2">{cur.levels[j]}</td>
                  <td className="py-1" style={{ color: ACC2 }}>
                    {cur.weights[j].toFixed(3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        The state is the last 16 bits of the tape: step {k + 1} reads 0x{hex(prevByte, 2)} and
        0x{hex(SYMBOLS[k], 2)}. Each step shifts in 8 bits and yields 4 weights, so 2 bits per
        weight, plus the entry byte per 64 weights: 2.125. No table is read. The hash spreads the
        state over 32 bits, each byte becomes an integer level from −54 to 57, and one multiply-add
        per weight maps it to the codebook&apos;s scale. The kernel never does that multiply-add
        per weight: it keeps the integer levels for dp4a and applies c and d once per output value.
      </figcaption>
    </figure>
  )
}
