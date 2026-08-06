"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// One byte, two weights. K3_E2M1_PAIR maps a whole byte to its two E2M1 values, so the
// matmul's inner loop does one 8-byte load instead of masking and looking up each nibble
// separately. Drag the byte and watch both nibbles resolve through the 16-entry table at
// once. The scale here is fixed for legibility -- in the real kernel one E8M0 byte covers
// a whole 32-element group (16 packed bytes) and is applied once to the group's sum, not
// once per element.

const ACCENT = "oklch(0.64 0.17 45)"
const ACCENT2 = "oklch(0.62 0.14 200)"

// OCP MX E2M1, in nibble order -- exactly K3_E2M1[16] in k3_ops.c.
const E2M1 = [0.0, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, -0.0, -0.5, -1.0, -1.5, -2.0, -3.0, -4.0, -6.0]

const GROUP_SCALE = 0.25 // illustrative: one E8M0 byte, 2^(125-127)

const W = 640
const H = 258
const TABLE_X = 40
const TABLE_Y = 150
const CELL_W = 36
const CELL_GAP = 2

function bits(n: number, w: number): string {
  return n.toString(2).padStart(w, "0")
}

export function Mxfp4Decode() {
  const [byte, setByte] = useState(163)
  const lowIdx = byte & 0x0f
  const highIdx = (byte >> 4) & 0x0f
  const lowVal = E2M1[lowIdx]
  const highVal = E2M1[highIdx]
  const scaledLow = lowVal * GROUP_SCALE
  const scaledHigh = highVal * GROUP_SCALE

  const cellX = (idx: number) => TABLE_X + idx * (CELL_W + CELL_GAP)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mxfp4 decode · one byte, two weights</span>
        <span>
          0x{byte.toString(16).padStart(2, "0").toUpperCase()} = 0b{bits(byte, 8)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Byte ${bits(byte, 8)} splits into a low nibble ${bits(lowIdx, 4)} indexing E2M1 entry ${lowIdx} (value ${lowVal}), the even weight, and a high nibble ${bits(highIdx, 4)} indexing entry ${highIdx} (value ${highVal}), the odd weight. Scaled by an illustrative group factor of ${GROUP_SCALE}, the two decoded weights are ${scaledLow} and ${scaledHigh}.`}
        >
          {/* byte, split into nibbles */}
          <rect x={228} y={8} width={184} height={30} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={320} y={28} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            byte 0x{byte.toString(16).padStart(2, "0").toUpperCase()}
          </text>

          <path d="M 300 38 C 300 56, 140 56, 140 68" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.4} />
          <path d="M 340 38 C 340 56, 500 56, 500 68" fill="none" stroke={ACCENT2} strokeWidth={1.4} />

          {/* low nibble (even element) */}
          <rect x={70} y={68} width={140} height={40} rx={8} fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth={1.3} />
          <text x={140} y={84} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            low nibble · even
          </text>
          <text x={140} y={99} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            0b{bits(lowIdx, 4)} = {lowIdx}
          </text>

          {/* high nibble (odd element) */}
          <rect x={430} y={68} width={140} height={40} rx={8} fill="var(--muted)" stroke={ACCENT2} strokeWidth={1.3} />
          <text x={500} y={84} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
            high nibble &middot; odd
          </text>
          <text x={500} y={99} textAnchor="middle" className="font-mono" fontSize={10} style={{ fill: ACCENT2 }}>
            0b{bits(highIdx, 4)} = {highIdx}
          </text>

          <path d="M 140 108 C 140 128, 158 128, 158 148" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} />
          <path d="M 500 108 C 500 128, 482 128, 482 148" fill="none" stroke={ACCENT2} strokeWidth={1.3} />

          {/* E2M1 lookup strip */}
          <text x={TABLE_X} y={144} className="fill-muted-foreground font-mono" fontSize={9.5}>
            K3_E2M1[16] &mdash; shared lookup, built once
          </text>
          {E2M1.map((v, idx) => {
            const isLow = idx === lowIdx
            const isHigh = idx === highIdx
            return (
              <g key={idx}>
                <rect
                  x={cellX(idx)}
                  y={TABLE_Y}
                  width={CELL_W}
                  height={30}
                  rx={5}
                  fill={isLow || isHigh ? "var(--background)" : "var(--muted)"}
                  stroke={isLow ? ACCENT : isHigh ? ACCENT2 : "var(--border)"}
                  strokeWidth={isLow || isHigh ? 1.8 : 1}
                />
                <text
                  x={cellX(idx) + CELL_W / 2}
                  y={TABLE_Y + 19}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9.5}
                  fill={isLow ? ACCENT : isHigh ? ACCENT2 : "var(--muted-foreground)"}
                >
                  {v}
                </text>
                <text x={cellX(idx) + CELL_W / 2} y={TABLE_Y - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>
                  {idx}
                </text>
              </g>
            )
          })}

          {/* outputs */}
          <path d={`M ${cellX(lowIdx) + CELL_W / 2} ${TABLE_Y + 30} C ${cellX(lowIdx) + CELL_W / 2} ${TABLE_Y + 46}, 160 ${TABLE_Y + 46}, 160 ${TABLE_Y + 58}`} fill="none" stroke={ACCENT} strokeWidth={1.3} />
          <path d={`M ${cellX(highIdx) + CELL_W / 2} ${TABLE_Y + 30} C ${cellX(highIdx) + CELL_W / 2} ${TABLE_Y + 46}, 480 ${TABLE_Y + 46}, 480 ${TABLE_Y + 58}`} fill="none" stroke={ACCENT2} strokeWidth={1.3} />

          <rect x={70} y={TABLE_Y + 58} width={180} height={32} rx={7} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} />
          <text x={160} y={TABLE_Y + 73} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            w[2i] = {lowVal} &times; {GROUP_SCALE}
          </text>
          <text x={160} y={TABLE_Y + 86} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: ACCENT }}>
            {scaledLow}
          </text>

          <rect x={390} y={TABLE_Y + 58} width={180} height={32} rx={7} fill="var(--background)" stroke={ACCENT2} strokeWidth={1.5} />
          <text x={480} y={TABLE_Y + 73} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            w[2i+1] = {highVal} &times; {GROUP_SCALE}
          </text>
          <text x={480} y={TABLE_Y + 86} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: ACCENT2 }}>
            {scaledHigh}
          </text>
        </svg>

        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">byte</span>
          <Range
            min={0}
            max={255}
            step={1}
            value={byte}
            onChange={(e) => setByte(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted"
            aria-label="Choose a packed MXFP4 byte from 0 to 255"
            accent={ACCENT}
          />
          <span className="w-12 shrink-0 text-right font-mono text-xs text-foreground">{byte}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The matmul never masks or shifts a nibble out of a byte. It loads the byte once and uses it as an index
          into <span className="font-mono">K3_E2M1_PAIR[256][2]</span>, a 2&nbsp;KB table built once at startup that
          already holds both decoded values for every possible byte. The scale shown here is fixed for one byte;
          in the kernel one E8M0 exponent covers a whole 32-element group — 16 packed bytes — and is multiplied in
          once per group, after the group&apos;s dot product, not once per weight.
        </p>
      </div>
    </figure>
  )
}
