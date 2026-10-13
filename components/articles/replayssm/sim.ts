// Pure, deterministic simulations behind the two ReplaySSM widgets.
//
// 1. ringStep: the replay-buffer bookkeeping of the paper's Algorithm 2
//    (speculative decoding): append T records behind h committed ones, flush
//    the committed prefix into the checkpoint when h + T > L, then commit the
//    accepted prefix by moving h. Byte counts use the Mamba-2 layer of
//    Nemotron-3-Super-120B-A12B, the paper's Table 5 shape, and the record
//    layout of the released Triton kernel (x and dt per value head, B per group).
//
// 2. errorRun: a toy Mamba-2 head (S <- a S + v k^T, o = S q) run four ways —
//    exact, a state rounded every step, a ReplaySSM checkpoint rounded once per
//    window, and ReplaySSM with a separate low-precision read copy whose
//    rounding never feeds the next update. Everything here is +, -, *, / and
//    bit manipulation on IEEE doubles, so the server and the browser produce
//    the same numbers to the last bit (no Math.exp/log/pow).

// ---------------------------------------------------------------- ring buffer

export const MIB = 1024 * 1024
// One FP32 state, one sequence, one Mamba-2 layer: 128 heads x 64 x 128 x 4 B.
export const STATE_BYTES = 128 * 64 * 128 * 4
// One replay record for that layer: x (64 BF16) and dt (FP32) per value head,
// B (128 BF16) per group of 16 heads -> 128 * (128 + 4) + 8 * 256 bytes.
export const RECORD_BYTES = 128 * (64 * 2 + 4) + 8 * 128 * 2

export type Cell = "empty" | "committed" | "accepted" | "rejected"

export type RingState = {
  h: number // committed records in the buffer
  cells: Cell[] // logical slots 0 .. L+T-1, from the ring origin
  steps: number
  tokens: number // committed tokens so far
  flushes: number
  // cumulative bytes, per layer per sequence
  replayBytes: number
  snapBytes: number
  lastFlush: boolean
  lastFolded: number
  lastAccepted: number
}

export function ringInit(L: number, T: number): RingState {
  return {
    h: 0,
    cells: Array.from({ length: L + T }, () => "empty" as Cell),
    steps: 0,
    tokens: 0,
    flushes: 0,
    replayBytes: 0,
    snapBytes: 0,
    lastFlush: false,
    lastFolded: 0,
    lastAccepted: 0,
  }
}

// One verification step that ends with `a` of the T tokens accepted (1 <= a <= T).
export function ringStep(s: RingState, L: number, T: number, a: number): RingState {
  const acc = Math.max(1, Math.min(T, a))
  let h = s.h
  // Records read this step: the h committed ones (the T new ones arrive with the call).
  let bytes = STATE_BYTES + h * RECORD_BYTES + T * RECORD_BYTES
  const flush = h + T > L
  const folded = flush ? h : 0
  if (flush) {
    // Fold B_1..h into the checkpoint and write it once; the T new records move
    // to the front by advancing the ring origin (no copy).
    bytes += STATE_BYTES
    h = 0
  }
  const cells: Cell[] = Array.from({ length: L + T }, (_, i) => {
    if (i < h) return "committed"
    if (i < h + acc) return "accepted"
    if (i < h + T) return "rejected"
    return "empty"
  })
  return {
    h: h + acc,
    cells,
    steps: s.steps + 1,
    tokens: s.tokens + acc,
    flushes: s.flushes + (flush ? 1 : 0),
    replayBytes: s.replayBytes + bytes,
    // vLLM's snapshot path: one state read, one state write per verified token.
    snapBytes: s.snapBytes + (1 + T) * STATE_BYTES,
    lastFlush: flush,
    lastFolded: folded,
    lastAccepted: acc,
  }
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// Accepted length for one step: the first token always counts, each later draft
// survives with probability p only if every earlier one did.
export function drawAccept(rand: () => number, T: number, p: number): number {
  let a = 1
  while (a < T && rand() < p) a++
  return a
}

// ------------------------------------------------------------- rounding model

const f64 = new Float64Array(1)
const u32 = new Uint32Array(f64.buffer)
const LITTLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1
const HI = LITTLE ? 1 : 0
const LO = LITTLE ? 0 : 1

// floor(log2(|x|)) for a normal, nonzero double, read from its exponent bits.
function exponentOf(x: number): number {
  f64[0] = x
  return ((u32[HI] >>> 20) & 0x7ff) - 1023
}

// 2^n exactly, built from bits (n within the normal double range).
function pow2(n: number): number {
  u32[HI] = ((n + 1023) & 0x7ff) << 20
  u32[LO] = 0
  return f64[0]
}

export type Format = "fp16" | "fp8" | "fp4"

// mantissa bits, smallest normal exponent, largest finite value, block size
// (0 = unscaled). FP8 is E4M3 with one scale per 128-element row in the paper;
// the toy head's rows are 32 wide, so a row is its block. NVFP4 is E2M1 with a
// scale per 16 elements; the toy keeps that scale unrounded.
const FORMATS: Record<Format, { m: number; emin: number; max: number; block: number }> = {
  fp16: { m: 10, emin: -14, max: 65504, block: 0 },
  fp8: { m: 3, emin: -6, max: 448, block: 32 },
  fp4: { m: 1, emin: 0, max: 6, block: 16 },
}

function roundScalar(x: number, m: number, emin: number, max: number, sr: boolean, u: number): number {
  if (x === 0) return 0
  const ax = x < 0 ? -x : x
  let e = exponentOf(ax)
  if (e < emin) e = emin
  const ulp = pow2(e - m)
  const t = ax / ulp
  const fl = Math.floor(t)
  const frac = t - fl
  let r: number
  if (sr) r = u < frac ? fl + 1 : fl
  else if (frac > 0.5) r = fl + 1
  else if (frac < 0.5) r = fl
  else r = fl % 2 === 0 ? fl : fl + 1
  let y = r * ulp
  if (y > max) y = max
  return x < 0 ? -y : y
}

// Round a dv x dk state (row-major) into `out`.
export function quantize(src: Float64Array, out: Float64Array, dk: number, fmt: Format, sr: boolean, rand: () => number) {
  const f = FORMATS[fmt]
  const blk = f.block
  if (blk === 0) {
    for (let i = 0; i < src.length; i++) out[i] = roundScalar(src[i], f.m, f.emin, f.max, sr, sr ? rand() : 0)
    return
  }
  for (let b0 = 0; b0 < src.length; b0 += blk) {
    let amax = 0
    for (let i = b0; i < b0 + blk; i++) {
      const a = src[i] < 0 ? -src[i] : src[i]
      if (a > amax) amax = a
    }
    if (amax === 0) {
      for (let i = b0; i < b0 + blk; i++) out[i] = 0
      continue
    }
    const scale = amax / f.max
    for (let i = b0; i < b0 + blk; i++) {
      out[i] = roundScalar(src[i] / scale, f.m, f.emin, f.max, sr, sr ? rand() : 0) * scale
    }
  }
  void dk
}

// ---------------------------------------------------------- error experiment

export type Memory = "short" | "long"

export type ErrorParams = {
  fmt: Format
  sr: boolean // rounding of the shared state (the separate read copy is always round-to-nearest)
  memory: Memory
  L: number
  steps: number
}

export type ErrorResult = {
  binSteps: number[] // right edge of each bin, in decode steps
  conv: number[] // relative output error, mean over the bin
  shared: number[]
  separate: number[]
}

const DV = 8
const DK = 32

export function errorRun(p: ErrorParams): ErrorResult {
  const n = DV * DK
  const rIn = mulberry32(20261009)
  const rRound = mulberry32(36)
  const gauss = () => (rIn() + rIn() + rIn() + rIn() - 2) * 1.7320508075688772
  const invSqrtDk = 1 / Math.sqrt(DK)
  const [aLo, aHi] = p.memory === "long" ? [0.9995, 0.99999] : [0.9, 0.95]

  const ref = new Float64Array(n)
  const conv = new Float64Array(n)
  const sh = new Float64Array(n) // ReplaySSM shared: working state of this window
  const shCk = new Float64Array(n)
  const hi = new Float64Array(n) // separate: exact recurrence (FP32 in the paper; exact here)
  const lo = new Float64Array(n) // separate: working state started from the low-precision copy
  const loCk = new Float64Array(n)
  const tmp = new Float64Array(n)
  const v = new Float64Array(DV)
  const k = new Float64Array(DK)
  const q = new Float64Array(DK)

  const errConv = new Float64Array(p.steps)
  const errShared = new Float64Array(p.steps)
  const errSep = new Float64Array(p.steps)

  const out = (S: Float64Array, i: number) => {
    let s = 0
    for (let j = 0; j < DK; j++) s += S[i * DK + j] * q[j]
    return s
  }

  let h = 0
  for (let t = 0; t < p.steps; t++) {
    const a = aLo + (aHi - aLo) * rIn()
    for (let i = 0; i < DV; i++) v[i] = gauss()
    for (let j = 0; j < DK; j++) k[j] = gauss() * invSqrtDk
    for (let j = 0; j < DK; j++) q[j] = gauss() * invSqrtDk

    for (let i = 0; i < DV; i++) {
      for (let j = 0; j < DK; j++) {
        const idx = i * DK + j
        const vk = v[i] * k[j]
        ref[idx] = a * ref[idx] + vk
        conv[idx] = a * conv[idx] + vk
        sh[idx] = a * sh[idx] + vk
        hi[idx] = a * hi[idx] + vk
        lo[idx] = a * lo[idx] + vk
      }
    }
    // conventional decoding with a low-precision state: round after every update
    quantize(conv, tmp, DK, p.fmt, p.sr, rRound)
    conv.set(tmp)

    h++
    const flush = h === p.L
    let eC = 0
    let eS = 0
    let eP = 0
    let nr = 0
    for (let i = 0; i < DV; i++) {
      const o = out(ref, i)
      nr += o * o
      const dc = out(conv, i) - o
      const ds = out(sh, i) - o
      // non-flush steps read the low-precision copy; a flush reads the exact path
      const dp = (flush ? out(hi, i) : out(lo, i)) - o
      eC += dc * dc
      eS += ds * ds
      eP += dp * dp
    }
    const den = Math.sqrt(nr) || 1
    errConv[t] = Math.sqrt(eC) / den
    errShared[t] = Math.sqrt(eS) / den
    errSep[t] = Math.sqrt(eP) / den

    if (flush) {
      // shared: one rounded checkpoint carries both jobs
      quantize(sh, shCk, DK, p.fmt, p.sr, rRound)
      sh.set(shCk)
      // separate: the recurrence stays exact; the read copy is cast from it, never fed back
      quantize(hi, loCk, DK, p.fmt, false, rRound)
      lo.set(loCk)
      h = 0
    }
  }

  // log-spaced bins from step 16 to the end: right edges 16 * r^i
  const bins = 24
  const binSteps: number[] = []
  const c: number[] = []
  const s: number[] = []
  const e: number[] = []
  let start = 0
  for (let b = 1; b <= bins; b++) {
    const right = edge(b, bins, p.steps)
    let sc = 0
    let ss = 0
    let se = 0
    let cnt = 0
    for (let t = start; t < right; t++) {
      sc += errConv[t]
      ss += errShared[t]
      se += errSep[t]
      cnt++
    }
    if (cnt > 0) {
      binSteps.push(right)
      c.push(sc / cnt)
      s.push(ss / cnt)
      e.push(se / cnt)
    }
    start = right
  }
  return { binSteps, conv: c, shared: s, separate: e }
}

// Right edge of bin b of `bins`: geometric between 16 and `total` steps, with
// the ratio found by bisection so no transcendental function is involved.
function edge(b: number, bins: number, total: number): number {
  const ratio = rootOf(total / 16, bins)
  let x = 16
  for (let i = 0; i < b; i++) x *= ratio
  return Math.min(total, Math.max(b, Math.round(x)))
}

// r such that r^n = y, by bisection (only multiplication; deterministic).
function rootOf(y: number, n: number): number {
  let lo = 1
  let hi = y
  for (let it = 0; it < 80; it++) {
    const mid = (lo + hi) / 2
    let p = 1
    for (let i = 0; i < n; i++) p *= mid
    if (p > y) hi = mid
    else lo = mid
  }
  return (lo + hi) / 2
}
