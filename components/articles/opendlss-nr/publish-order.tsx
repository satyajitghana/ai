"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// "A value is rounded to half first, then to E4M3 from the half, never f32
// straight to E4M3" — OpenDLSS-NR, docs/numerics.md. This widget shows why that
// line is a specification and not a detail.
//
// E4M3 has 3 mantissa bits, so in [1, 2) its codes sit 1/8 apart and the
// rounding boundary between two codes is the midpoint 1/16 above the lower one.
// IEEE half has 10 mantissa bits: the midpoint itself is a half value. A float
// within half a half-ulp (2^-11) of a midpoint therefore rounds onto the
// midpoint in f16 — and then the E4M3 rounding sees an exact tie and goes to
// the even code, which is on the wrong side for half of those floats.
//
// Everything below is exact binary arithmetic on bit patterns (the same
// algorithms as shaders/common.glsl's roundF16 and e4m3CodeFromF16Bits, cut
// down to the normal range this widget stays in). x = midpoint + j * 2^-16 has
// at most 16 fractional bits, so it is an exact float32 at every slider step.

const SPEC = "oklch(0.60 0.15 155)"
const DIRECT = "oklch(0.62 0.17 30)"
const GRID = "oklch(0.62 0.14 250)"

const F32 = new Float32Array(1)
const U32 = new Uint32Array(F32.buffer)
const f32Bits = (x: number) => {
  F32[0] = x
  return U32[0]
}

const pow2 = (k: number) => {
  let v = 1
  for (let i = 0; i < Math.abs(k); i++) v *= 2
  return k < 0 ? 1 / v : v
}

const shiftRne = (value: number, shift: number) => {
  const q = value >>> shift
  const rem = value & ((1 << shift) - 1)
  const half = 1 << (shift - 1)
  return q + (rem > half || (rem === half && (q & 1) === 1) ? 1 : 0)
}

// float32 -> IEEE half bits, round to nearest even (normal range).
function f16Bits(x: number) {
  const b = f32Bits(x)
  let e = ((b >>> 23) & 0xff) - 127 + 15
  let m = shiftRne(b & 0x7fffff, 13)
  if (m === 0x400) {
    m = 0
    e += 1
  }
  return (e << 10) | m
}
const halfValue = (h: number) => (1 + (h & 0x3ff) / 1024) * pow2(((h >>> 10) & 0x1f) - 15)

// half bits -> E4M3 code (the specified path), normal range.
function e4m3FromHalf(h: number) {
  let e = ((h >>> 10) & 0x1f) - 8
  let m = shiftRne(h & 0x3ff, 7)
  if (m === 8) {
    m = 0
    e += 1
  }
  return (e << 3) | m
}

// float32 -> E4M3 code in one rounding (what the specification forbids).
function e4m3Direct(x: number) {
  const b = f32Bits(x)
  let e = ((b >>> 23) & 0xff) - 127 + 7
  let m = shiftRne(b & 0x7fffff, 20)
  if (m === 8) {
    m = 0
    e += 1
  }
  return (e << 3) | m
}
const e4m3Value = (c: number) => (1 + (c & 7) / 8) * pow2(((c >>> 3) & 0xf) - 7)

const hex = (v: number, digits: number) => `0x${v.toString(16).toUpperCase().padStart(digits, "0")}`

// Midpoints between neighbouring E4M3 codes in [1, 2): 1 + (2k + 1) / 16.
const MIDS = [0, 1, 2, 3].map((k) => ({ k, mid: 1 + (2 * k + 1) / 16, lo: 1 + k / 8, hi: 1 + (k + 1) / 8 }))

const U16 = 1 / 65536 // slider step, 2^-16
const HALF_ULP = 1 / 1024 // f16 step in [1, 2)
const SPAN = 128 // slider reaches +/- 2^-9 = +/- two half-ulps

export function PublishOrder() {
  const [k, setK] = useState(0)
  const [j, setJ] = useState(8)

  const { mid, lo, hi } = MIDS[k]
  const x = mid + j * U16
  const h = f16Bits(x)
  const hv = halfValue(h)
  const spec = e4m3FromHalf(h)
  const direct = e4m3Direct(x)
  const same = spec === direct
  const lowerEven = k % 2 === 0

  // Line A: the E4M3 interval [lo, hi].
  const W = 640
  const AX0 = 40
  const AX1 = 600
  const ax = (v: number) => AX0 + ((v - lo) / (hi - lo)) * (AX1 - AX0)
  // Line B: the zoom, mid +/- 2 half-ulps.
  const zlo = mid - 2 * HALF_ULP
  const zhi = mid + 2 * HALF_ULP
  const bx = (v: number) => AX0 + ((v - zlo) / (zhi - zlo)) * (AX1 - AX0)
  const win0 = lowerEven ? mid : mid - HALF_ULP / 2
  const win1 = lowerEven ? mid + HALF_ULP / 2 : mid

  const specV = e4m3Value(spec)
  const directV = e4m3Value(direct)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">one value, two orders of rounding</span>
        <span className="font-mono text-[10px] text-muted-foreground">exact bit arithmetic · after shaders/common.glsl</span>
      </div>

      <div className="space-y-3 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">boundary between E4M3 codes</span>
          {MIDS.map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => setK(m.k)}
              aria-pressed={k === m.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums transition-colors",
                k === m.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {m.lo.toFixed(3)} | {m.hi.toFixed(3)}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            x = {mid.toFixed(4)} {j < 0 ? "−" : "+"} <span className="tabular-nums text-foreground">{Math.abs(j)}</span>
            {" "}× 2<sup>−16</sup>
          </span>
          <Range
            min={-SPAN}
            max={SPAN}
            step={1}
            value={j}
            onChange={(e) => setJ(Number(e.target.value))}
            aria-label="distance of x from the rounding boundary, in steps of 2 to the minus 16"
            accent={GRID}
            className="mt-1 w-full"
          />
        </label>
      </div>

      <div className="px-4 py-3">
        <svg
          viewBox={`0 0 ${W} 190`}
          className="w-full"
          role="img"
          aria-label={`x is ${x.toFixed(8)}. Rounded to half first it becomes ${hv.toFixed(8)} and then E4M3 code ${hex(spec, 2)}, value ${specV}. Rounded straight to E4M3 it becomes code ${hex(direct, 2)}, value ${directV}. ${same ? "The two paths agree." : "The two paths publish different bytes."}`}
        >
          {/* Line A: E4M3 codes */}
          <text x={AX0} y={14} className="fill-muted-foreground font-mono" fontSize={10}>
            E4M3 codes (1/8 apart)
          </text>
          <line x1={AX0} x2={AX1} y1={42} y2={42} stroke="currentColor" className="text-border" strokeWidth={1.5} />
          {[lo, hi].map((v) => {
            const hit = v === specV || v === directV
            return (
              <g key={v}>
                <line x1={ax(v)} x2={ax(v)} y1={32} y2={52} stroke="currentColor" className="text-foreground" strokeWidth={2} />
                <text x={ax(v)} y={68} textAnchor="middle" className={hit ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"} fontSize={10.5}>
                  {v.toFixed(3)} · {hex(e4m3Direct(v), 2)}
                </text>
              </g>
            )
          })}
          <line x1={ax(mid)} x2={ax(mid)} y1={34} y2={50} stroke="currentColor" className="text-muted-foreground" strokeDasharray="2 2" />
          <text x={ax(mid)} y={28} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            boundary {mid.toFixed(4)}
          </text>
          <circle cx={ax(x)} cy={42} r={3.5} fill={GRID} />
          {/* where each path lands */}
          <path
            d={`M ${ax(x).toFixed(2)} 44 Q ${((ax(x) + ax(specV)) / 2).toFixed(2)} 84 ${ax(specV).toFixed(2)} 54`}
            fill="none"
            stroke={SPEC}
            strokeWidth={2}
          />
          <path
            d={`M ${ax(x).toFixed(2)} 40 Q ${((ax(x) + ax(directV)) / 2).toFixed(2)} 4 ${ax(directV).toFixed(2)} 30`}
            fill="none"
            stroke={DIRECT}
            strokeWidth={2}
            strokeDasharray="5 3"
          />

          {/* Line B: the half grid around the boundary */}
          <text x={AX0} y={104} className="fill-muted-foreground font-mono" fontSize={10}>
            zoom ×32: the float16 grid around the boundary (2<tspan baselineShift="super" fontSize={7}>−10</tspan> apart)
          </text>
          <rect x={bx(win0)} y={122} width={bx(win1) - bx(win0)} height={22} fill={DIRECT} fillOpacity={0.14} />
          <line x1={AX0} x2={AX1} y1={133} y2={133} stroke="currentColor" className="text-border" strokeWidth={1.5} />
          {[-2, -1, 0, 1, 2].map((t) => (
            <g key={t}>
              <line
                x1={bx(mid + t * HALF_ULP)}
                x2={bx(mid + t * HALF_ULP)}
                y1={124}
                y2={142}
                stroke="currentColor"
                className={t === 0 ? "text-foreground" : "text-muted-foreground"}
                strokeWidth={t === 0 ? 2 : 1.2}
              />
              <text x={bx(mid + t * HALF_ULP)} y={158} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {t === 0 ? "boundary" : `${t > 0 ? "+" : "−"}${Math.abs(t)}`}
              </text>
            </g>
          ))}
          <circle cx={bx(x)} cy={133} r={4} fill={GRID} />
          <circle cx={bx(hv)} cy={133} r={6} fill="none" stroke={SPEC} strokeWidth={2} />
          <text x={AX0} y={180} className="fill-muted-foreground font-mono" fontSize={9.5}>
            shaded: where the two orders disagree, {lowerEven ? "just above" : "just below"} the boundary, 2
            <tspan baselineShift="super" fontSize={7}>−11</tspan> wide
          </text>
        </svg>

        <div className="mt-2 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          <div className="rounded-md border px-3 py-2" style={{ borderColor: SPEC }}>
            <div style={{ color: SPEC }}>specified: f32 → f16 → E4M3</div>
            <div className="mt-1 text-muted-foreground tabular-nums">
              f16 <span className="text-foreground">{hv.toFixed(8)}</span> ({hex(h, 4)})
            </div>
            <div className="text-muted-foreground tabular-nums">
              E4M3 <span className="text-foreground">{hex(spec, 2)}</span> = {specV}
            </div>
          </div>
          <div className="rounded-md border border-dashed px-3 py-2" style={{ borderColor: DIRECT }}>
            <div style={{ color: DIRECT }}>forbidden: f32 → E4M3</div>
            <div className="mt-1 text-muted-foreground tabular-nums">
              f32 <span className="text-foreground">{x.toFixed(8)}</span> ({hex(f32Bits(x), 8)})
            </div>
            <div className="text-muted-foreground tabular-nums">
              E4M3 <span className="text-foreground">{hex(direct, 2)}</span> = {directV}
            </div>
          </div>
        </div>

        <p className="mb-0 mt-3 text-xs text-muted-foreground">
          {same
            ? "Same byte. Away from the shaded strip the order of the roundings does not matter."
            : `Different bytes: ${hex(spec, 2)} against ${hex(direct, 2)}. The half grid has the boundary itself as a value, so x lands exactly on it, and the E4M3 rounding breaks the tie toward the even code, ${specV}.`}{" "}
          Over all 8,388,608 float32 values in [1, 2), 32,768 of them, one in 256, publish a different byte through the two
          paths.
        </p>
      </div>
    </figure>
  )
}
