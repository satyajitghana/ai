// Pure, deterministic simulation behind the LeapQuant widget.
//
// One toy Gated DeltaNet head, S in R^{dk x dv} (rows: key channels, columns:
// value channels), decoded T steps with the paper's equation 1:
//
//   u_t = beta_t (v_t - S_{t-1}^T (alpha_t k_t)),   S_t = alpha_t S_{t-1} + k_t u_t^T
//
// The same input sequence is run twice: once exactly (float64, the "FP32"
// trajectory), and once with the state stored in a low-precision format. The
// stored state is re-quantized every `window` steps (window 1 is the usual
// per-step quantization). Between quantizations the working state is exact,
// which is what LeapQuant's buffered window computes (equation 4).
// Optional: r Compensator Tokens (a rank-r fit, kept in FP16, subtracted
// before quantizing) and residual smoothing (key rows divided by the square
// root of their mean absolute value before quantizing, multiplied back after).
//
// Keys are L2-normalised and carry a persistent bias on a few channels, and a
// few value channels are large and biased, so the state grows the outlier rows
// and columns the paper describes. Everything here is +, -, *, /, sqrt,
// comparisons and bit manipulation on IEEE numbers, so the server and the
// browser compute identical results (no Math.exp/log/pow).

export type Format = "bf16" | "int8" | "int4"

export const DK = 32
export const DV = 32

// ---------------------------------------------------------------- rounding

const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

/** Round to a float with `m` mantissa bits (bf16: 7, fp16: 10), nearest-even. */
export function roundMantissa(x: number, m: number): number {
  if (x === 0 || !Number.isFinite(x)) return x
  f32[0] = x
  const drop = 23 - m
  const bits = u32[0]
  const half = 1 << (drop - 1)
  const lsb = (bits >>> drop) & 1
  u32[0] = ((bits + half - 1 + lsb) >>> drop) << drop
  return f32[0]
}
export const bf16 = (x: number) => roundMantissa(x, 7)
export const fp16 = (x: number) => roundMantissa(x, 10)

// ---------------------------------------------------------------- PRNG

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
// Irwin-Hall: the sum of four uniforms, centred and scaled to unit variance.
// No log or cos, so it is bit-identical everywhere.
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.7320508075688772

// ---------------------------------------------------------------- inputs

export type Inputs = { k: Float64Array[]; v: Float64Array[]; alpha: number[]; beta: number[] }

const KEY_OUT = [3, 17] // key channels with a persistent bias -> outlier rows
const KEY_WIDE = [8, 11, 25, 29] // key channels with a wider spread -> uneven residual rows
const VAL_OUT = [5, 22] // value channels that are large and biased -> outlier columns

export type Memory = "short" | "long"

export function makeInputs(T: number, memory: Memory = "long", seed = 7): Inputs {
  const leak = memory === "long" ? 0.0004 : 0.004
  const r = mulberry32(seed)
  const k: Float64Array[] = []
  const v: Float64Array[] = []
  const alpha: number[] = []
  const beta: number[] = []
  for (let t = 0; t < T; t++) {
    const kk = new Float64Array(DK)
    let n = 0
    for (let i = 0; i < DK; i++) {
      kk[i] = gauss(r) * (KEY_WIDE.includes(i) ? 6 : 1) + (KEY_OUT.includes(i) ? 3 : 0)
      n += kk[i] * kk[i]
    }
    const inv = 1 / Math.sqrt(n)
    for (let i = 0; i < DK; i++) kk[i] *= inv
    const vv = new Float64Array(DV)
    for (let j = 0; j < DV; j++) vv[j] = VAL_OUT.includes(j) ? 4 + 3 * gauss(r) : gauss(r)
    k.push(kk)
    v.push(vv)
    alpha.push(1 - leak * r()) // GDN's scalar decay, just under 1
    beta.push(0.05 + 0.1 * r()) // write strength
  }
  return { k, v, alpha, beta }
}

// ---------------------------------------------------------------- state ops

type M = Float64Array<ArrayBufferLike> // dk x dv, row-major: M[i * DV + j]

function step(S: M, k: Float64Array, v: Float64Array, a: number, b: number) {
  // u = b (v - S^T (a k));  S = a S + k u^T
  const u = new Float64Array(DV)
  for (let j = 0; j < DV; j++) {
    let s = 0
    for (let i = 0; i < DK; i++) s += S[i * DV + j] * k[i]
    u[j] = b * (v[j] - a * s)
  }
  for (let i = 0; i < DK; i++) {
    const ki = k[i]
    for (let j = 0; j < DV; j++) S[i * DV + j] = a * S[i * DV + j] + ki * u[j]
  }
}

/** Rank-r fit by subspace iteration from a fixed start, factors rounded to FP16. */
function lowRank(S: M, r: number): M {
  const out = new Float64Array(DK * DV)
  if (r === 0) return out
  const R = S.slice()
  for (let h = 0; h < r; h++) {
    // power iteration on R R^T for the top left singular vector of what is left
    let x = new Float64Array(DV)
    for (let j = 0; j < DV; j++) x[j] = 1 + ((j * 7 + h * 3) % 5) * 0.1
    let kv = new Float64Array(DK)
    for (let it = 0; it < 8; it++) {
      kv = new Float64Array(DK)
      for (let i = 0; i < DK; i++) {
        let s = 0
        for (let j = 0; j < DV; j++) s += R[i * DV + j] * x[j]
        kv[i] = s
      }
      let n = 0
      for (let i = 0; i < DK; i++) n += kv[i] * kv[i]
      n = Math.sqrt(n) || 1
      for (let i = 0; i < DK; i++) kv[i] /= n
      x = new Float64Array(DV)
      for (let j = 0; j < DV; j++) {
        let s = 0
        for (let i = 0; i < DK; i++) s += R[i * DV + j] * kv[i]
        x[j] = s
      }
    }
    // k~ = kv (unit), u~ = R^T kv; both stored in FP16
    for (let i = 0; i < DK; i++) kv[i] = fp16(kv[i])
    for (let j = 0; j < DV; j++) x[j] = fp16(x[j])
    for (let i = 0; i < DK; i++)
      for (let j = 0; j < DV; j++) {
        const p = kv[i] * x[j]
        out[i * DV + j] += p
        R[i * DV + j] -= p
      }
  }
  return out
}

/** Store S in `fmt`, return what reads back. Per-value-channel symmetric scales for INT. */
function quantize(S: M, fmt: Format, r: number, smooth: boolean): M {
  const L = lowRank(S, r)
  const R = new Float64Array(DK * DV)
  for (let x = 0; x < R.length; x++) R[x] = S[x] - L[x]
  // smoothing: c_i = sqrt(mean_j |R_ij|), quantize C^{-1} R
  const c = new Float64Array(DK).fill(1)
  if (smooth) {
    for (let i = 0; i < DK; i++) {
      let s = 0
      for (let j = 0; j < DV; j++) s += Math.abs(R[i * DV + j])
      c[i] = Math.max(Math.sqrt(s / DV), 1e-12)
    }
  }
  const out = new Float64Array(DK * DV)
  if (fmt === "bf16") {
    for (let i = 0; i < DK; i++) for (let j = 0; j < DV; j++) out[i * DV + j] = bf16(R[i * DV + j] / c[i]) * c[i]
  } else {
    const qmax = fmt === "int8" ? 127 : 7
    for (let j = 0; j < DV; j++) {
      let m = 0
      for (let i = 0; i < DK; i++) m = Math.max(m, Math.abs(R[i * DV + j] / c[i]))
      const sc = m > 0 ? m / qmax : 1
      for (let i = 0; i < DK; i++) out[i * DV + j] = Math.round(R[i * DV + j] / c[i] / sc) * sc * c[i]
    }
  }
  for (let x = 0; x < out.length; x++) out[x] += L[x]
  return out
}

// ---------------------------------------------------------------- outliers

const median = (a: number[]) => {
  const s = a.slice().sort((x, y) => x - y)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}
const peakOverMedian = (A: M) => {
  const a = Array.from(A, Math.abs)
  const med = median(a)
  return med > 0 ? Math.max(...a) / med : 0
}

/** Figure 6's three panels for a state: |S|, the residual after r Compensator Tokens, and that residual smoothed. */
export function outlierRatios(S: M, r: number) {
  const L = lowRank(S, r)
  const R = new Float64Array(DK * DV)
  for (let x = 0; x < R.length; x++) R[x] = S[x] - L[x]
  const Rs = new Float64Array(DK * DV)
  for (let i = 0; i < DK; i++) {
    let s = 0
    for (let j = 0; j < DV; j++) s += Math.abs(R[i * DV + j])
    const ci = Math.max(Math.sqrt(s / DV), 1e-12)
    for (let j = 0; j < DV; j++) Rs[i * DV + j] = R[i * DV + j] / ci
  }
  return { state: peakOverMedian(S), residual: peakOverMedian(R), smoothed: peakOverMedian(Rs) }
}

// ---------------------------------------------------------------- runs

export type RunOpts = { fmt: Format; window: number; r: number; smooth: boolean; steps: number }

/**
 * Relative state error ||S_q - S_exact||_F / ||S_exact||_F, sampled every `every` steps,
 * plus the number of quantizations performed and the final exact state.
 */
export function run(inp: Inputs, o: RunOpts, every = 32) {
  const S = new Float64Array(DK * DV) // exact
  let W: M = new Float64Array(DK * DV) // working state of the quantized run
  const err: number[] = []
  let rounds = 0
  for (let t = 0; t < o.steps; t++) {
    step(S, inp.k[t], inp.v[t], inp.alpha[t], inp.beta[t])
    step(W, inp.k[t], inp.v[t], inp.alpha[t], inp.beta[t])
    if ((t + 1) % o.window === 0) {
      W = quantize(W, o.fmt, o.r, o.smooth)
      rounds++
    }
    if ((t + 1) % every === 0) {
      let num = 0
      let den = 0
      for (let x = 0; x < S.length; x++) {
        const d = W[x] - S[x]
        num += d * d
        den += S[x] * S[x]
      }
      err.push(den > 0 ? Math.sqrt(num / den) : 0)
    }
  }
  return { err, rounds, state: S }
}
