// A tiny GPTQ, Algorithm 1 of Frantar et al. (arXiv 2210.17323), for the
// column-sweep widget. Everything is + - * /, sqrt, Math.round and bit ops on a
// seeded PRNG, all exact per IEEE-754, so the server and the browser compute
// identical numbers and the SVG hydrates cleanly.
//
// What is the paper's: the layer-wise objective ||WX - W^X||^2, the Hessian
// H = 2XX^T, 1% dampening of its mean diagonal, the upper Cholesky factor U of
// H^-1, and the column step e = (w - q) / U_jj, W[:, j:] -= e * U[j, j:].
// What is mine: the matrix, the calibration tokens and their correlation, which
// are random and seeded.

export const ROWS = 6
export const COLS = 12
const N_CAL = 48
const N_TEST = 512
const FACTORS = 2

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

// Irwin-Hall: the sum of twelve uniforms minus six is close to a unit normal
// and needs no transcendental function.
function normal(rand: () => number) {
  let s = 0
  for (let i = 0; i < 12; i++) s += rand()
  return s - 6
}

type Mat = number[][]

const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array<number>(c).fill(0))

function makeWeights(): Mat {
  const rand = mulberry32(7)
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => normal(rand)))
}

// Inputs whose channels share FACTORS latent factors with weight rho.
function makeInputs(rho: number, n: number, seed: number): Mat {
  const load = mulberry32(11)
  const U = Array.from({ length: COLS }, () => Array.from({ length: FACTORS }, () => normal(load)))
  const rand = mulberry32(seed)
  const a = Math.sqrt(1 - rho)
  const b = Math.sqrt(rho / FACTORS)
  const X = zeros(COLS, n)
  for (let t = 0; t < n; t++) {
    const f = Array.from({ length: FACTORS }, () => normal(rand))
    for (let c = 0; c < COLS; c++) {
      let shared = 0
      for (let k = 0; k < FACTORS; k++) shared += U[c][k] * f[k]
      X[c][t] = a * normal(rand) + b * shared
    }
  }
  return X
}

function hessian(X: Mat): Mat {
  const n = X[0].length
  const H = zeros(COLS, COLS)
  for (let i = 0; i < COLS; i++)
    for (let j = 0; j <= i; j++) {
      let s = 0
      for (let t = 0; t < n; t++) s += X[i][t] * X[j][t]
      H[i][j] = H[j][i] = (2 * s) / n
    }
  return H
}

// Lower Cholesky factor of a symmetric positive-definite matrix.
function cholesky(A: Mat): Mat {
  const n = A.length
  const L = zeros(n, n)
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = i === j ? Math.sqrt(s) : s / L[j][j]
    }
  return L
}

function lowerInverse(L: Mat): Mat {
  const n = L.length
  const M = zeros(n, n)
  for (let c = 0; c < n; c++) {
    M[c][c] = 1 / L[c][c]
    for (let i = c + 1; i < n; i++) {
      let s = 0
      for (let k = c; k < i; k++) s += L[i][k] * M[k][c]
      M[i][c] = -s / L[i][i]
    }
  }
  return M
}

// Upper factor U with H^-1 = U^T U, after dampening, as in llm-compressor's
// factorize_hessian: Cholesky, invert, Cholesky again (upper).
export function invCholUpper(H: Mat, percdamp = 0.01): Mat {
  let mean = 0
  for (let i = 0; i < COLS; i++) mean += H[i][i]
  mean /= COLS
  const Hd = H.map((row, i) => row.map((v, j) => (i === j ? v + percdamp * mean : v)))
  const Li = lowerInverse(cholesky(Hd))
  const Hinv = zeros(COLS, COLS)
  for (let i = 0; i < COLS; i++)
    for (let j = 0; j < COLS; j++) {
      let s = 0
      for (let k = Math.max(i, j); k < COLS; k++) s += Li[k][i] * Li[k][j]
      Hinv[i][j] = s
    }
  const L2 = cholesky(Hinv)
  return L2[0].map((_, i) => L2.map((row) => row[i]))
}

export type Grid = { scale: number[]; lo: number; hi: number }

export function absmaxGrid(W: Mat, bits: number): Grid {
  const hi = 2 ** (bits - 1) - 1
  const scale = W.map((row) => row.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / hi)
  return { scale, lo: -hi - 1, hi }
}

export const quant = (w: number, s: number, g: Grid) => Math.min(g.hi, Math.max(g.lo, Math.round(w / s))) * s

// Relative output error ||(W - Wq) X||^2 / ||W X||^2 on held-out tokens.
function relErr(W: Mat, Wq: Mat, X: Mat): number {
  let num = 0
  let den = 0
  const n = X[0].length
  for (let r = 0; r < ROWS; r++)
    for (let t = 0; t < n; t++) {
      let y = 0
      let d = 0
      for (let c = 0; c < COLS; c++) {
        y += W[r][c] * X[c][t]
        d += (W[r][c] - Wq[r][c]) * X[c][t]
      }
      num += d * d
      den += y * y
    }
  return num / den
}

export type Sweep = {
  W: Mat
  states: Mat[] // states[k]: working matrix after k columns, first k on the grid
  moved: Mat[] // moved[k]: change applied to columns >= k by quantizing column k-1
  spread: number[][] // spread[k]: U[k-1, k-1:] / U[k-1, k-1], how column k-1's error fans out
  rtn: Mat
  gptqErr: number[] // held-out error of states[k]
  rtnErr: number[] // held-out error with the first k columns rounded, the rest untouched
  differ: number // weights where GPTQ picks a different grid point than RTN
}

export function sweep(rho: number, bits: number): Sweep {
  const W = makeWeights()
  const g = absmaxGrid(W, bits)
  const H = hessian(makeInputs(rho, N_CAL, 101))
  const Xt = makeInputs(rho, N_TEST, 202)
  const U = invCholUpper(H)

  const states: Mat[] = [W.map((r) => r.slice())]
  const moved: Mat[] = [zeros(ROWS, COLS)]
  const spread: number[][] = [new Array<number>(COLS).fill(0)]
  let cur = W.map((r) => r.slice())
  for (let j = 0; j < COLS; j++) {
    const next = cur.map((r) => r.slice())
    const mv = zeros(ROWS, COLS)
    for (let r = 0; r < ROWS; r++) {
      const q = quant(cur[r][j], g.scale[r], g)
      const e = (cur[r][j] - q) / U[j][j]
      next[r][j] = q
      for (let c = j + 1; c < COLS; c++) {
        const d = e * U[j][c]
        next[r][c] -= d
        mv[r][c] = -d
      }
    }
    const sp = new Array<number>(COLS).fill(0)
    for (let c = j; c < COLS; c++) sp[c] = U[j][c] / U[j][j]
    states.push(next)
    moved.push(mv)
    spread.push(sp)
    cur = next
  }

  const rtn = W.map((row, r) => row.map((v) => quant(v, g.scale[r], g)))
  const gptqErr = states.map((S) => relErr(W, S, Xt))
  const rtnErr = states.map((_, k) => relErr(W, W.map((row, r) => row.map((v, c) => (c < k ? rtn[r][c] : v))), Xt))
  let differ = 0
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (states[COLS][r][c] !== rtn[r][c]) differ++
  return { W, states, moved, spread, rtn, gptqErr, rtnErr, differ }
}
