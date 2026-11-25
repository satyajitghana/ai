"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// What the 24 Nov claim says at a fixed matrix size n, against what was known.
//
// Claimed (The matrix multiplication exponent is nine fourths, Corollary 1.2):
//   every exact bilinear algorithm for n×n needs ≥ ⌈n^(9/4)⌉ products, and
//   every formal arithmetic circuit ≥ ⌈n^(9/4)/2⌉ multiplication/division gates.
// Known lower bounds (as the paper's §1.5 lists them):
//   Bläser: rank ≥ (5/2)n² − 3n over every field;
//   Landsberg–Michałek: border rank ≥ 2n² − ⌈log₂ n⌉ − 1 over ℂ.
// Known upper bounds drawn here: schoolbook n³; Strassen's recursion, 7^k at n = 2^k.
// ⌈n^(9/4)⌉ is computed exactly as the least r with r⁴ ≥ n⁹ (BigInt), so a
// perfect fourth power such as n = 16 (16^(9/4) = 512) is not rounded up by
// floating-point error.

const B0 = BigInt(0)
const B1 = BigInt(1)
const B2 = BigInt(2)
const B4 = BigInt(4)
const B9 = BigInt(9)

function ceilPow94(n: number): bigint {
  const t = BigInt(n) ** B9
  // integer fourth root, rounded up
  let lo = B0
  let hi = B1
  while (hi ** B4 < t) hi *= B2
  while (lo < hi) {
    const mid = (lo + hi) / B2
    if (mid ** B4 >= t) hi = mid
    else lo = mid + B1
  }
  return lo
}

const ceilLog2 = (n: number) => {
  let k = 0
  let p = 1
  while (p < n) {
    p *= 2
    k++
  }
  return k
}
const ipow = (b: number, e: number) => {
  let r = 1
  for (let i = 0; i < e; i++) r *= b
  return r
}

type Row = {
  n: number
  claim: number
  claimCircuit: number
  blaser: number
  lm: number
  cube: number
  strassen: number | null
}

function row(n: number): Row {
  const c = ceilPow94(n)
  const k = ceilLog2(n)
  return {
    n,
    claim: Number(c),
    claimCircuit: Number((c + B1) / B2), // ⌈⌈x⌉/2⌉ = ⌈x/2⌉ for real x > 0
    blaser: Math.max(0, (5 * n * n) / 2 - 3 * n),
    lm: 2 * n * n - ceilLog2(n) - 1,
    cube: n * n * n,
    strassen: ipow(2, k) === n ? ipow(7, k) : null,
  }
}

const ROWS: Row[] = Array.from({ length: 63 }, (_, i) => row(i + 2))
const CROSS = ROWS.find((r) => r.claim > r.lm)?.n ?? null
// the last n where Bläser's rank bound is still at least the claim, plus one
const BL_CROSS = (ROWS.filter((r) => r.claim <= r.blaser).pop()?.n ?? 1) + 1

const W = 640
const H = 260
const L = 52
const R = 14
const T = 12
const B = 30
const N0 = 2
const N1 = 64
const lg = (x: number) => mlog10(x)
const sx = (n: number) => L + ((lg(n) - lg(N0)) / (lg(N1) - lg(N0))) * (W - L - R)
const P0 = 1
const P1 = 3e5
const sy = (p: number) => T + ((lg(P1) - lg(Math.max(p, P0))) / (lg(P1) - lg(P0))) * (H - T - B)

const SERIES: { key: keyof Row; label: string; col: string; dash?: string }[] = [
  { key: "cube", label: "schoolbook n³", col: "oklch(0.6 0.02 250)" },
  { key: "claim", label: "claimed floor ⌈n^(9/4)⌉", col: "oklch(0.6 0.17 30)" },
  { key: "lm", label: "border rank ≥ 2n² − ⌈log₂n⌉ − 1", col: "oklch(0.55 0.15 250)", dash: "5 3" },
  { key: "blaser", label: "rank ≥ 5n²/2 − 3n", col: "oklch(0.6 0.12 160)", dash: "2 3" },
]

const fmt = (x: number) => x.toLocaleString("en-US")

export function RankFloor() {
  const [n, setN] = useState(16)
  const [a, setA] = useState([3, 1, 4, 1])
  const [b, setB] = useState([5, 9, 2, 6])
  const r = ROWS[n - 2]

  // Strassen on the editable 2×2
  const [a11, a12, a21, a22] = a
  const [b11, b12, b21, b22] = b
  const m = [
    (a11 + a22) * (b11 + b22),
    (a21 + a22) * b11,
    a11 * (b12 - b22),
    a22 * (b21 - b11),
    (a11 + a12) * b22,
    (a21 - a11) * (b11 + b12),
    (a12 - a22) * (b21 + b22),
  ]
  const cs = [m[0] + m[3] - m[4] + m[6], m[2] + m[4], m[1] + m[3], m[0] - m[1] + m[2] + m[5]]
  const cn = [a11 * b11 + a12 * b21, a11 * b12 + a12 * b22, a21 * b11 + a22 * b21, a21 * b12 + a22 * b22]
  const ok = cs.every((v, i) => v === cn[i])

  const path = (key: keyof Row) =>
    ROWS.map((q, i) => `${i ? "L" : "M"}${sx(q.n).toFixed(1)},${sy(q[key] as number).toFixed(1)}`).join(" ")

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <label className="flex flex-wrap items-center gap-3 text-xs">
        <span>
          matrix side <b className="font-mono">n = {n}</b>
        </span>
        <input type="range" min={2} max={64} value={n} onChange={(e) => setN(Number(e.target.value))} className="min-w-[10rem] flex-1" />
      </label>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-auto w-full" role="img" aria-label="Products needed to multiply n by n matrices: claimed floor against known bounds">
        {[1, 10, 100, 1000, 10000, 100000].map((p) => (
          <g key={p}>
            <line x1={L} x2={W - R} y1={sy(p)} y2={sy(p)} stroke="currentColor" strokeOpacity={0.08} />
            <text x={L - 6} y={sy(p) + 3} fontSize={10} textAnchor="end" fill="currentColor" fillOpacity={0.6}>
              {fmt(p)}
            </text>
          </g>
        ))}
        {[2, 4, 8, 16, 32, 64].map((v) => (
          <text key={v} x={sx(v)} y={H - B + 16} fontSize={10} textAnchor="middle" fill="currentColor" fillOpacity={0.6}>
            {v}
          </text>
        ))}
        {SERIES.map((s) => (
          <path key={s.key} d={path(s.key)} fill="none" stroke={s.col} strokeWidth={2} strokeDasharray={s.dash} />
        ))}
        {ROWS.filter((q) => q.strassen !== null).map((q) => (
          <circle key={q.n} cx={sx(q.n)} cy={sy(q.strassen as number)} r={3.5} fill="oklch(0.55 0.02 250)" />
        ))}
        {CROSS !== null && (
          <line x1={sx(CROSS)} x2={sx(CROSS)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
        )}
        <line x1={sx(n)} x2={sx(n)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.5} />
      </svg>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: s.col }} /> {s.label}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "oklch(0.55 0.02 250)" }} /> Strassen recursion, 7^k at n = 2^k
        </li>
      </ul>
      <table className="mt-3 w-full text-xs">
        <tbody className="font-mono">
          <tr><td className="pr-3 font-sans text-muted-foreground">schoolbook products, n³</td><td className="text-right">{fmt(r.cube)}</td></tr>
          {r.strassen !== null && (
            <tr><td className="pr-3 font-sans text-muted-foreground">Strassen recursion, 7^log₂n</td><td className="text-right">{fmt(r.strassen)}</td></tr>
          )}
          <tr><td className="pr-3 font-sans">claimed: bilinear products ≥ ⌈n^(9/4)⌉</td><td className="text-right font-semibold">{fmt(r.claim)}</td></tr>
          <tr><td className="pr-3 font-sans">claimed: circuit mult/div gates ≥ ⌈n^(9/4)/2⌉</td><td className="text-right font-semibold">{fmt(r.claimCircuit)}</td></tr>
          <tr><td className="pr-3 font-sans text-muted-foreground">known: border rank ≥ 2n² − ⌈log₂n⌉ − 1 (ℂ)</td><td className="text-right">{fmt(r.lm)}</td></tr>
          <tr><td className="pr-3 font-sans text-muted-foreground">known: rank ≥ 5n²/2 − 3n (every field)</td><td className="text-right">{fmt(r.blaser)}</td></tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs">
        {r.claim > r.lm
          ? `Border rank: at n = ${n} the claimed floor beats the Landsberg–Michałek bound by a factor of ${(r.claim / r.lm).toFixed(2)}.`
          : `Border rank: at n = ${n} the claimed floor is below the Landsberg–Michałek bound, so it adds nothing here.`}{" "}
        {r.claim > r.blaser
          ? "Rank: it is also above Bläser's bound."
          : "Rank: Bläser's bound is still higher at this size."}{" "}
        {CROSS !== null && `The border-rank crossing is at n = ${CROSS}; for rank the claim stays above Bläser from n = ${BL_CROSS}.`}
      </p>
      {n === 2 && (
        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
          <div className="mb-2 font-medium">n = 2: Strassen&apos;s seven products, on numbers you can edit</div>
          <div className="flex flex-wrap items-center gap-3">
            {[["A", a, setA], ["B", b, setB]].map(([name, v, set]) => (
              <div key={name as string} className="flex items-center gap-1">
                <span>{name as string} =</span>
                <div className="grid grid-cols-2 gap-1">
                  {(v as number[]).map((x, i) => (
                    <input
                      key={i}
                      type="number"
                      value={x}
                      aria-label={`${name as string} entry ${i + 1}`}
                      onChange={(e) => {
                        const nv = [...(v as number[])]
                        nv[i] = Number(e.target.value) || 0
                        ;(set as (x: number[]) => void)(nv)
                      }}
                      className="w-12 rounded border border-border bg-background px-1 font-mono"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 font-mono">
            M₁..M₇ = {m.join(", ")} → C = [{cs[0]}, {cs[1]}; {cs[2]}, {cs[3]}]
          </div>
          <div className="mt-1">
            {ok ? "Matches the eight-product schoolbook answer." : "Mismatch (this should never happen)."} Seven products, against a claimed floor of {r.claim} for bilinear algorithms: no contradiction at n = 2.
          </div>
        </div>
      )}
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Products needed to multiply two n×n matrices, log scale. The claimed floors come from the 24 Nov paper; the two dashed lower bounds and their formulas are the ones it cites; the schoolbook count and Strassen&apos;s 7^k are upper bounds. Every number in the table is computed in your browser from those formulas. Drag to n = 2 for Strassen&apos;s identity checked on live numbers.
      </figcaption>
    </figure>
  )
}
