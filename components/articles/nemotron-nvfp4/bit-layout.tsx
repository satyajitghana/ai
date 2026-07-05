"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// NVFP4 vs BF16 vs MXFP4, drawn as a bit-layout scene. Every number is a 4-bit
// E2M1 element (1 sign, 2 exponent, 1 mantissa) — but 4 bits alone can't span a
// weight tensor's dynamic range, so the range lives in a *shared block scale*.
// NVFP4 shares one FP8 (E4M3) scale across every 16 elements plus one FP32
// per-tensor scale (two levels); MXFP4 shares a coarser power-of-2 (E8M0) scale
// across 32 elements. BF16 needs no block scale — each value is self-describing.
// Flip the format and watch the element fields, the block size, and the effective
// bits-per-element change.

const ELT = "oklch(0.60 0.15 255)" // element bits
const SCALE = "oklch(0.72 0.16 60)" // shared scale

type Fmt = "bf16" | "mxfp4" | "nvfp4"

const FORMATS: Record<
  Fmt,
  {
    name: string
    elt: number
    block: number
    scaleName: string
    scaleKind: string
    eff: number
    fields: { k: string; n: number }[]
    note: string
  }
> = {
  bf16: {
    name: "BF16",
    elt: 16,
    block: 0,
    scaleName: "—",
    scaleKind: "no block scale",
    eff: 16,
    fields: [
      { k: "sign", n: 1 },
      { k: "exp", n: 8 },
      { k: "mant", n: 7 },
    ],
    note: "16-bit baseline — every value carries its own exponent",
  },
  mxfp4: {
    name: "MXFP4",
    elt: 4,
    block: 32,
    scaleName: "E8M0",
    scaleKind: "power-of-2 (8b)",
    eff: 4.25,
    fields: [
      { k: "sign", n: 1 },
      { k: "exp", n: 2 },
      { k: "mant", n: 1 },
    ],
    note: "32-element block, coarse power-of-2 scale",
  },
  nvfp4: {
    name: "NVFP4",
    elt: 4,
    block: 16,
    scaleName: "E4M3",
    scaleKind: "FP8 (8b) + FP32/tensor",
    eff: 4.5,
    fields: [
      { k: "sign", n: 1 },
      { k: "exp", n: 2 },
      { k: "mant", n: 1 },
    ],
    note: "16-element block, fine FP8 scale + FP32 per-tensor (two levels)",
  },
}

const ORDER: Fmt[] = ["bf16", "mxfp4", "nvfp4"]

// ── scene geometry ──
const W = 720
const H = 288

export function BitLayout() {
  const [fmt, setFmt] = useState<Fmt>("nvfp4")
  const f = FORMATS[fmt]

  // element bit cells
  const cw = Math.min(34, 500 / f.elt)
  const cellH = 34
  const rowW = f.elt * cw
  const x0 = (W - rowW) / 2
  const eltY = 58

  // per-bit field opacity (encode field by opacity, not hue)
  const opFor = (k: string) => (k === "sign" ? 0.9 : k === "exp" ? 0.5 : 0.28)
  const bits: { k: string; first: boolean }[] = []
  for (const fld of f.fields)
    for (let i = 0; i < fld.n; i++) bits.push({ k: fld.k, first: i === 0 })

  // block strip
  const stripY = 150
  const stripW = 540
  const sx0 = (W - stripW) / 2
  const N = f.block || 4
  const pitch = stripW / N
  const sq = Math.min(pitch - 3, 15)
  const stripMidX = sx0 + stripW / 2
  const scaleBoxW = 190
  const scaleY = 226

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>4-bit number formats · element + shared block scale</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${f.name}: ${f.elt}-bit element, ${
            f.block ? `${f.block}-element block sharing one ${f.scaleName} scale` : "no block scale"
          }, effective ${f.eff} bits per element`}
        >
          <defs>
            <filter id="bl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ── one element ── */}
          <text x={x0} y={eltY - 12} className="fill-muted-foreground font-mono" fontSize={11}>
            one element · {f.elt} bits {f.elt === 4 ? "(E2M1)" : "(1·8·7)"}
          </text>
          {bits.map((b, i) => (
            <rect
              key={i}
              x={x0 + i * cw}
              y={eltY}
              width={cw - 1.5}
              height={cellH}
              rx={3}
              fill={ELT}
              opacity={opFor(b.k)}
              className="transition-all duration-300"
            />
          ))}
          {/* field brackets + labels */}
          {(() => {
            let start = 0
            return f.fields.map((fld) => {
              const cx = x0 + (start + fld.n / 2) * cw
              const bx = x0 + start * cw
              const bw = fld.n * cw - 1.5
              const el = (
                <g key={fld.k}>
                  <line
                    x1={bx}
                    y1={eltY + cellH + 6}
                    x2={bx + bw}
                    y2={eltY + cellH + 6}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text
                    x={cx}
                    y={eltY + cellH + 19}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    fontSize={9}
                  >
                    {fld.k} ({fld.n})
                  </text>
                </g>
              )
              start += fld.n
              return el
            })
          })()}

          {/* ── one block ── */}
          <text x={sx0} y={stripY - 12} className="fill-muted-foreground font-mono" fontSize={11}>
            {f.block ? `one block · ${f.block} elements share one scale` : "no block · each value is self-describing"}
          </text>

          {Array.from({ length: N }, (_, i) => (
            <rect
              key={i}
              x={sx0 + i * pitch + (pitch - sq) / 2}
              y={stripY}
              width={sq}
              height={sq}
              rx={2.5}
              fill={ELT}
              opacity={0.75}
            />
          ))}

          {f.block ? (
            <>
              {/* brace from element row down to the scale box */}
              <path
                d={`M ${sx0 + pitch / 2} ${stripY + sq + 4} C ${sx0 + pitch / 2} ${stripY + sq + 22}, ${stripMidX} ${scaleY - 20}, ${stripMidX} ${scaleY}`}
                fill="none"
                stroke={SCALE}
                strokeWidth={1.25}
                opacity={0.55}
              />
              <path
                d={`M ${sx0 + stripW - pitch / 2} ${stripY + sq + 4} C ${sx0 + stripW - pitch / 2} ${stripY + sq + 22}, ${stripMidX} ${scaleY - 20}, ${stripMidX} ${scaleY}`}
                fill="none"
                stroke={SCALE}
                strokeWidth={1.25}
                opacity={0.55}
              />
              {/* the shared scale box */}
              <rect
                x={stripMidX - scaleBoxW / 2}
                y={scaleY}
                width={scaleBoxW}
                height={34}
                rx={7}
                fill="var(--background)"
                stroke={SCALE}
                strokeWidth={1.5}
                filter="url(#bl-soft)"
              />
              <text
                x={stripMidX}
                y={scaleY + 14}
                textAnchor="middle"
                className="font-mono"
                fontSize={11}
                fontWeight={600}
                style={{ fill: SCALE }}
              >
                shared scale · {f.scaleName}
              </text>
              <text
                x={stripMidX}
                y={scaleY + 27}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {f.scaleKind}
              </text>
            </>
          ) : (
            <text
              x={stripMidX}
              y={scaleY + 4}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              each 16-bit value spans the full range on its own — no shared scale needed
            </text>
          )}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">format</span>
            {ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFmt(k)}
                aria-pressed={fmt === k}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                  fmt === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={fmt === k ? { background: ELT } : undefined}
              >
                {FORMATS[k].name}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            effective <span style={{ color: ELT }}>{f.eff}</span> bits/element
            {f.block ? ` · ${f.elt} + ${f.block === 16 ? "8/16" : "8/32"} scale` : ""}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every format above stores each value in the same <span className="text-foreground">4-bit E2M1</span> cell (1
          sign, 2 exponent, 1 mantissa) — {f.name === "BF16" ? "except BF16, the 16-bit baseline. " : ""}the difference is
          the <span style={{ color: SCALE }}>shared scale</span> that restores dynamic range.{" "}
          {fmt === "nvfp4" ? (
            <>
              NVFP4 shares a fine <span style={{ color: SCALE }}>FP8 (E4M3)</span> scale across every{" "}
              <span className="text-foreground">16</span> elements — plus one FP32 per-tensor scale — for an effective{" "}
              <span className="text-foreground">4.5 bits/element</span> and an E6M4-like range from 4-bit storage.
            </>
          ) : fmt === "mxfp4" ? (
            <>
              MXFP4 shares a coarser <span style={{ color: SCALE }}>power-of-2 (E8M0)</span> scale across{" "}
              <span className="text-foreground">32</span> elements — cheaper (4.25 bits/element) but blunter, so a single
              outlier drags a wider block.
            </>
          ) : (
            <>Without a block scale, BF16 costs 16 bits — 3.6× the storage of NVFP4&apos;s 4.5.</>
          )}
        </p>
      </div>
    </figure>
  )
}
