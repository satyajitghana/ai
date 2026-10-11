"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2, mlog10, mpow } from "@/lib/dmath"

// What "two-level accumulation" buys, as arithmetic.
//
// DeepSeek-V3 reports that FP8 GEMM accumulation inside the Hopper tensor core
// retains about 14 bits. Keep adding into a 14-bit significand and every add
// discards whatever falls below the running sum's own quantum, so the error
// grows with K. DeepGEMM's answer is to drain the tensor-core accumulator into
// an FP32 register on the CUDA cores every block of K, and start again.
//
// This simulates that: an inner accumulator rounded to 14 significant bits,
// drained every N terms into an outer accumulator rounded to 24 (FP32's
// significand), against an exact double-precision sum. Products have a positive
// mean so the sum does not cancel and the relative error stays readable; the
// curve is the RMS over eight independent streams. It models the effect; it is
// not a measurement of a GPU.

const INNER_BITS = 14
const OUTER_BITS = 24
const KS = [128, 256, 512, 1024, 2048, 4096, 8192]
const KMAX = KS[KS.length - 1]
const TRIALS = 8
const NS = [16, 32, 64, 128, 256, 512, 1024]

const PLAIN = "oklch(0.68 0.17 35)" // no promotion
const PROMO = "oklch(0.62 0.13 250)" // promote every N

function roundBits(x: number, bits: number): number {
  if (x === 0) return 0
  const e = Math.floor(mlog2(Math.abs(x)))
  const q = mpow(2, e - (bits - 1))
  return Math.round(x / q) * q
}

type Row = { K: number; plain: number; promoted: number }

function sweep(n: number): Row[] {
  const acc = KS.map(() => ({ p: 0, q: 0 }))
  for (let t = 0; t < TRIALS; t++) {
    let s = (19700101 + t * 7919) % 2147483648
    let exact = 0
    let plain = 0
    let inner = 0
    let outer = 0
    let ci = 0
    for (let i = 0; i < KMAX; i++) {
      // deterministic, SSR-safe products with a positive mean
      s = (s * 1103515245 + 12345) % 2147483648
      const u = s / 2147483648
      s = (s * 1103515245 + 12345) % 2147483648
      const v = s / 2147483648
      const p = u + v - 0.7

      exact += p
      plain = roundBits(plain + p, INNER_BITS)
      inner = roundBits(inner + p, INNER_BITS)
      if ((i + 1) % n === 0) {
        outer = roundBits(outer + inner, OUTER_BITS)
        inner = 0
      }
      if (i + 1 === KS[ci]) {
        const drained = roundBits(outer + inner, OUTER_BITS)
        const ep = Math.abs(plain - exact) / Math.abs(exact)
        const eq = Math.abs(drained - exact) / Math.abs(exact)
        acc[ci].p += ep * ep
        acc[ci].q += eq * eq
        ci++
      }
    }
  }
  return KS.map((K, i) => ({
    K,
    plain: Math.sqrt(acc[i].p / TRIALS),
    promoted: Math.sqrt(acc[i].q / TRIALS),
  }))
}

const W = 720
const H = 250
const L = 54
const R = 16
const T = 14
const B = 36
const FLOOR = 1e-7

const xAt = (K: number) =>
  L + ((mlog2(K) - mlog2(KS[0])) / (mlog2(KMAX) - mlog2(KS[0]))) * (W - L - R)
const yAt = (e: number) => {
  const t = (mlog10(Math.max(e, FLOOR)) + 7) / 7 // 1e-7 .. 1
  return T + (1 - Math.min(1, Math.max(0, t))) * (H - T - B)
}

export function AccumPromote() {
  const [idx, setIdx] = useState(3) // 128
  const n = NS[idx]
  const rows = useMemo(() => sweep(n), [n])
  const at4096 = rows[KS.indexOf(4096)]
  const last = rows[rows.length - 1]

  const path = (key: "plain" | "promoted") =>
    rows.map((r, i) => `${i ? "L" : "M"}${xAt(r.K).toFixed(2)} ${yAt(r[key]).toFixed(2)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>error of a K-term sum · 14-bit accumulator</span>
        <span className="text-muted-foreground/50">simulation, not a GPU</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`At K equals 4096, accumulating entirely in 14 bits gives a relative error of ${(at4096.plain * 100).toFixed(3)} percent, while draining into a 24-bit accumulator every ${n} terms gives ${(at4096.promoted * 100).toFixed(4)} percent.`}
        >
          {[-6, -5, -4, -3, -2].map((d) => (
            <g key={d}>
              <line x1={L} x2={W - R} y1={yAt(mpow(10, d))} y2={yAt(mpow(10, d))} stroke="var(--border)" strokeWidth={1} />
              <text x={L - 8} y={yAt(mpow(10, d)) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {d === -2 ? "1%" : d === -3 ? "0.1%" : `1e${d}`}
              </text>
            </g>
          ))}

          {KS.map((K) => (
            <text key={K} x={xAt(K)} y={H - 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {K}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            K, the length of the sum
          </text>

          <path d={path("plain")} fill="none" stroke={PLAIN} strokeWidth={2.2} />
          <path d={path("promoted")} fill="none" stroke={PROMO} strokeWidth={2.2} />
          {rows.map((r) => (
            <g key={r.K}>
              <circle cx={xAt(r.K)} cy={yAt(r.plain)} r={2.6} fill={PLAIN} />
              <circle cx={xAt(r.K)} cy={yAt(r.promoted)} r={2.6} fill={PROMO} />
            </g>
          ))}

          <text x={xAt(KMAX) - 4} y={yAt(last.plain) - 9} textAnchor="end" fontSize={10} className="font-mono" fill={PLAIN}>
            14 bits all the way
          </text>
          <text x={xAt(KMAX) - 4} y={yAt(last.promoted) + 16} textAnchor="end" fontSize={10} className="font-mono" fill={PROMO}>
            promote every {n}
          </text>
        </svg>

        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>promotion interval (drag)</span>
            <span>
              every <span className="text-foreground">{n}</span> elements ·{" "}
              <span style={{ color: PROMO }}>{4096 / n}</span> drains over a K of 4096
            </span>
          </div>
          <Range min={0} max={NS.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="w-full cursor-pointer" accent={PROMO} />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground/60">
            <span>16</span>
            <span>128 = one block of K</span>
            <span>1024</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every add into a fixed-width significand rounds, and the quantum of the running sum grows as the sum does, so terms
          arriving late are snapped to a coarser grid than the ones that arrived first. Keeping everything in 14 bits, the
          error climbs with K: <span style={{ color: PLAIN }}>{(rows[0].plain * 100).toFixed(3)}%</span>{" "}at K = 128 and{" "}
          <span style={{ color: PLAIN }}>{(last.plain * 100).toFixed(3)}%</span>{" "}at K = {KMAX}. Draining into a 24-bit
          accumulator every <span style={{ color: PROMO }}>{n}</span>{" "}terms holds the inner sum small enough that its own
          rounding barely bites — <span style={{ color: PROMO }}>{(at4096.promoted * 100).toFixed(4)}%</span>{" "}at K = 4096
          against <span style={{ color: PLAIN }}>{(at4096.plain * 100).toFixed(3)}%</span>{" "}without. Shrinking the interval
          past 128 keeps buying accuracy, but each drain is work the CUDA cores have to do while the tensor cores wait, which
          is why 128 is where DeepSeek stopped.
        </p>
      </div>
    </figure>
  )
}
