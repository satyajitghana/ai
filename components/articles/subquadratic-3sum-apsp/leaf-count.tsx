"use client"

// Lemma 11 of arXiv 2610.06783, with the paper's own formulas and real numbers.
// One tile of the recursion has L = c·m levels; m of them are "inner".
//   alpha_d = C(m, d) · 9^d          leaves of order d feeding ONE output entry
//   beta_d  = C(L, m-d) · 9^(L-m+d)  leaves of order d in the whole tile
//   M       = beta_0                  output entries of the tile
// With |U| = M / sqrt(D) wanted entries (D = 4^m), the leaves the pruned
// recursion can visit number at most sum_d min(|U|·alpha_d, beta_d). Everything
// is computed in log10 space; nothing is simulated. The bars show, per order d,
// the two bounds and which one is smaller.
//
// Dual-native: the article walks the same counts for L = 19m and gives the
// closed form D^(-1/18)(sqrt(D)|U| + 2M).

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"

const LOG9 = mlog10(9)
const LOG2 = mlog10(2)
const LOG10_10 = 1

function logFactTable(n: number) {
  const t = new Array<number>(n + 1).fill(0)
  for (let i = 2; i <= n; i++) t[i] = t[i - 1] + mlog10(i)
  return t
}
const LF = logFactTable(3000)
const lc = (n: number, k: number) => LF[n] - LF[k] - LF[n - k]

// log10(sum 10^xs)
function lse(xs: number[]) {
  const mx = Math.max(...xs)
  let s = 0
  for (const x of xs) s += mpow(10, x - mx)
  return mx + mlog10(s)
}

export function LeafCount() {
  const [m, setM] = useState(9)
  const [c, setC] = useState(19)

  const r = useMemo(() => {
    const L = c * m
    const rows = []
    for (let d = 0; d <= m; d++) {
      const a = lc(m, d) + d * LOG9
      const b = lc(L, m - d) + (L - m + d) * LOG9
      rows.push({ d, a, b })
    }
    const M = rows[0].b
    const U = M - m * LOG2 // |U| = M / 2^m = M / sqrt(D)
    const per = rows.map((x) => ({ ...x, ua: U + x.a, use: Math.min(U + x.a, x.b) }))
    const visited = lse(per.map((x) => x.use))
    const oneByOne = U + m * LOG10_10 // |U| · 10^m: every entry's leaves, separately
    const inner = U + m * mlog10(4) // |U| · D: inner products, one by one
    return { L, per, M, U, visited, oneByOne, inner }
  }, [m, c])

  const lo = Math.min(...r.per.map((x) => Math.min(x.ua, x.b)))
  const hi = Math.max(...r.per.map((x) => Math.max(x.ua, x.b)))
  const W = 560
  const H = 170
  const bw = W / (m + 1)
  const yOf = (v: number) => H - ((v - lo) / Math.max(1e-9, hi - lo)) * (H - 10)

  const fmt = (x: number) => `10^${x.toFixed(1)}`
  const savingLog = r.M - r.visited

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 font-mono text-xs text-muted-foreground">
        leaves the pruned recursion may visit, per order d (log scale)
      </div>
      <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-2">
        <label className="flex items-center gap-3">
          <span className="w-32 shrink-0">m = {m} (D = 4^{m})</span>
          <Range min={1} max={60} step={1} value={m} onChange={(e) => setM(Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-32 shrink-0">L = {c}·m = {r.L}</span>
          <Range min={10} max={25} step={1} value={c} onChange={(e) => setC(Number(e.target.value))} />
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full" role="img" aria-label="Per-order leaf bounds">
        {r.per.map((x) => {
          const X = x.d * bw
          const smallSide = x.ua <= x.b
          return (
            <g key={x.d}>
              <rect
                x={X + bw * 0.1}
                y={yOf(x.ua)}
                width={bw * 0.38}
                height={H - yOf(x.ua)}
                className={smallSide ? "fill-blue-500/70" : "fill-blue-500/20"}
              />
              <rect
                x={X + bw * 0.52}
                y={yOf(x.b)}
                width={bw * 0.38}
                height={H - yOf(x.b)}
                className={!smallSide ? "fill-red-500/70" : "fill-red-500/20"}
              />
            </g>
          )
        })}
        <line
          x1={(m / 9) * bw + bw / 2}
          x2={(m / 9) * bw + bw / 2}
          y1={0}
          y2={H}
          className="stroke-foreground/50"
          strokeDasharray="4 3"
        />
        <text x={(m / 9) * bw + bw / 2 + 4} y={12} className="fill-muted-foreground font-mono text-[10px]">
          d = m/9
        </text>
        <text x={0} y={H + 14} className="fill-muted-foreground font-mono text-[10px]">
          d = 0
        </text>
        <text x={W} y={H + 14} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
          d = {m}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-2 w-3 bg-blue-500/70" />
          |U|·α_d: charge each wanted entry
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-3 bg-red-500/70" />
          β_d: all leaves of that order
        </span>
        <span>solid = the smaller one, which the bound uses</span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted-foreground">entries in a tile, M</dt>
        <dd>{fmt(r.M)}</dd>
        <dt className="text-muted-foreground">wanted, |U| = M/√D</dt>
        <dd>{fmt(r.U)}</dd>
        <dt className="text-muted-foreground">inner products one by one, |U|·D</dt>
        <dd>{fmt(r.inner)}</dd>
        <dt className="text-muted-foreground">each entry&apos;s leaves separately, |U|·10^m</dt>
        <dd>{fmt(r.oneByOne)}</dd>
        <dt className="text-muted-foreground">bound on leaves visited, Σ min</dt>
        <dd>
          {fmt(r.visited)}{" "}
          <span className={savingLog > 0 ? "text-emerald-600" : "text-red-600"}>
            {savingLog > 0
              ? `${savingLog < 4 ? mpow(10, savingLog).toFixed(2) : fmt(savingLog)}x fewer than M`
              : "no saving over M"}
          </span>
        </dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        At L = 19m the red bars halve (or better) at every step, so the large orders cost almost nothing and
        the bound lands below M by about D^(1/18), which is 2x at m = 9. Push L down toward 10m and the red
        bars stop shrinking: the saving disappears. Increase m and the saving grows, while the matrix the
        tile has to fit inside grows as D^18.
      </p>
    </div>
  )
}
