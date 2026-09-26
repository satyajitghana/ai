// Pure simulation behind StreamMixer, kept free of React so it can be run and
// checked on its own (see the article for the numbers it produces at the
// default settings).
//
// The residual-mixing half of four residual designs, stacked `depth` sublayers
// deep, with everything else (the attention and MLP sublayers, the read and
// write maps) switched off. What is left is the product of the per-sublayer
// mixing matrices, which is the only path a signal takes from sublayer 0 to
// the top. Its gain is measured the way mHC measures it: the largest absolute
// row sum of the product (forward signal) and the largest absolute column sum
// (backward gradient).
//
// Every rule sees the SAME random draw per sublayer, H = (1 + bias) I + drift G
// with G standard normal:
//   plain  one stream, the identity: x + F(x)
//   HC     the N x N matrix H as it is, unconstrained
//   mHC    Sinkhorn(exp(4 H)): columns then rows, `iters` times (mHC Eq. 9)
//   xHC    the same on a k x k block of H picked by routing, identity on the
//          other N - k streams. k and the fixed streams follow the paper's
//          N-sweep table (Table 7): N=2 k=1 m=0, 4/2/1, 8/4/2, 16/4/2. A
//          random pick stands in for the learned router.
//
// It is a toy: random matrices, not a trained model. Transcendentals go
// through lib/dmath, everything else is + - * /, so SSR and the browser draw
// the same numbers.

import { mcos, mexp, mlog } from "@/lib/dmath"

export type Rule = "plain" | "hc" | "mhc" | "xhc"

export const RULES: { k: Rule; label: string; color: string }[] = [
  { k: "plain", label: "plain residual", color: "var(--muted-foreground)" },
  { k: "hc", label: "HC (unconstrained)", color: "oklch(0.62 0.2 28)" },
  { k: "mhc", label: "mHC (Sinkhorn)", color: "oklch(0.58 0.14 250)" },
  { k: "xhc", label: "xHC (k of N)", color: "oklch(0.62 0.15 155)" },
]

export const ROUTE: Record<number, [number, number]> = { 2: [1, 0], 4: [2, 1], 8: [4, 2], 16: [4, 2] }
const KAPPA = 4

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * v)
}

type Mat = number[][]

const eye = (n: number): Mat =>
  Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))

function matmul(A: Mat, B: Mat): Mat {
  const n = A.length
  const out: Mat = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const a = A[i][k]
      if (a === 0) continue
      for (let j = 0; j < n; j++) out[i][j] += a * B[k][j]
    }
  return out
}

function sinkhorn(logits: Mat, iters: number): Mat {
  const n = logits.length
  let max = -Infinity
  for (const row of logits) for (const v of row) if (v > max) max = v
  const M = logits.map((row) => row.map((v) => mexp(v - max)))
  for (let t = 0; t < iters; t++) {
    for (let j = 0; j < n; j++) {
      let s = 0
      for (let i = 0; i < n; i++) s += M[i][j]
      for (let i = 0; i < n; i++) M[i][j] /= s
    }
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let j = 0; j < n; j++) s += M[i][j]
      for (let j = 0; j < n; j++) M[i][j] /= s
    }
  }
  return M
}

function gains(P: Mat) {
  const n = P.length
  let fwd = 0
  let bwd = 0
  let diag = 0
  for (let i = 0; i < n; i++) {
    let r = 0
    let c = 0
    for (let j = 0; j < n; j++) {
      r += Math.abs(P[i][j])
      c += Math.abs(P[j][i])
    }
    if (r > fwd) fwd = r
    if (c > bwd) bwd = c
    diag += P[i][i]
  }
  return { fwd, bwd, self: diag / n }
}

export type Trace = { fwd: number[]; bwd: number[]; self: number; last: Mat }

export function simulate(N: number, depth: number, drift: number, bias: number, iters: number, seed: number) {
  const rand = mulberry32(seed * 7919 + N * 131 + depth)
  const [k, m] = ROUTE[N]
  const P: Record<Exclude<Rule, "plain">, Mat> = { hc: eye(N), mhc: eye(N), xhc: eye(N) }
  const tr: Record<Rule, Trace> = {
    plain: { fwd: [1], bwd: [1], self: 1, last: [[1]] },
    hc: { fwd: [1], bwd: [1], self: 1, last: P.hc },
    mhc: { fwd: [1], bwd: [1], self: 1, last: P.mhc },
    xhc: { fwd: [1], bwd: [1], self: 1, last: P.xhc },
  }
  for (let l = 0; l < depth; l++) {
    const H: Mat = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (_, j) => (i === j ? 1 + bias : 0) + drift * gaussian(rand))
    )
    // routing: m fixed streams, k - m drawn from the rest (partial Fisher-Yates)
    const pool = Array.from({ length: N - m }, (_, i) => i + m)
    for (let i = 0; i < k - m; i++) {
      const j = i + Math.floor(rand() * (pool.length - i))
      const t = pool[i]
      pool[i] = pool[j]
      pool[j] = t
    }
    const act = [...Array.from({ length: m }, (_, i) => i), ...pool.slice(0, k - m)]

    P.hc = matmul(H, P.hc)
    P.mhc = matmul(
      sinkhorn(
        H.map((row) => row.map((v) => KAPPA * v)),
        iters
      ),
      P.mhc
    )
    const block = sinkhorn(
      act.map((a) => act.map((b) => KAPPA * H[a][b])),
      iters
    )
    const E = eye(N)
    act.forEach((a, i) => act.forEach((b, j) => (E[a][b] = block[i][j])))
    P.xhc = matmul(E, P.xhc)

    tr.plain.fwd.push(1)
    tr.plain.bwd.push(1)
    for (const r of ["hc", "mhc", "xhc"] as const) {
      const g = gains(P[r])
      tr[r].fwd.push(g.fwd)
      tr[r].bwd.push(g.bwd)
      tr[r].self = g.self
      tr[r].last = P[r]
    }
  }
  return tr
}

export function fmt(v: number) {
  if (!Number.isFinite(v)) return "overflow"
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e4 || a < 1e-3)) return v.toExponential(1).replace("e+", "e")
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(3)
}
