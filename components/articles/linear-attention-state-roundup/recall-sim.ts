// A toy associative-recall run, small enough to execute in the browser.
// Keys and values are random sign vectors, so every operation below is
// + - * / or sqrt: exact in IEEE-754, identical on server and client.
//
// N pairs are written into a memory, optionally followed by a rewrite of half
// the keys with fresh values. Then every key is used as a query and the
// readout is scored by nearest-value lookup over every value ever written: a
// hit is the latest value written under that key.

export type Rule = "hebbian" | "delta"

export type MemoryKind = {
  id: string
  label: string
  rule: Rule
  // key dimension the memory regresses on: d, or d * E for the triadic joint key
  keyDim: (d: number, e: number) => number
  // "triadic" keys are the Kronecker product k (x) k'; "wide" keys are random
  keyShape: "plain" | "triadic" | "wide"
}

export const D = 16
export const E = 4
export const BETA = 0.5

export const MEMORIES: MemoryKind[] = [
  { id: "hebb", label: "linear attention (Hebbian)", rule: "hebbian", keyDim: (d) => d, keyShape: "plain" },
  { id: "delta", label: "DeltaNet (delta rule)", rule: "delta", keyDim: (d) => d, keyShape: "plain" },
  { id: "triadic", label: "triadic delta, E = 4", rule: "delta", keyDim: (d, e) => d * e, keyShape: "triadic" },
  { id: "wide", label: "delta, 64-wide key", rule: "delta", keyDim: (d, e) => d * e, keyShape: "wide" },
]

// mulberry32: integer-only PRNG (Math.imul is exact)
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const signs = (r: () => number, n: number, scale: number) => {
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) out[i] = (r() < 0.5 ? -1 : 1) * scale
  return out
}

export function runOnce(n: number, rewrite: boolean, seed: number): Record<string, number> {
  const r = rng(seed)
  const keys: Float64Array[] = []
  const keys2: Float64Array[] = []
  const wide: Float64Array[] = []
  const vals: Float64Array[] = []
  const invD = 1 / Math.sqrt(D)
  const invE = 1 / Math.sqrt(E)
  const invW = 1 / Math.sqrt(D * E)
  for (let i = 0; i < n; i++) {
    keys.push(signs(r, D, invD))
    keys2.push(signs(r, E, invE))
    wide.push(signs(r, D * E, invW))
    vals.push(signs(r, D, 1))
  }
  // the write sequence: (key index, value index into allVals)
  const allVals = vals.slice()
  const seq: [number, number][] = []
  for (let i = 0; i < n; i++) seq.push([i, i])
  const target = Array.from({ length: n }, (_, i) => i)
  if (rewrite) {
    const order = Array.from({ length: n }, (_, i) => i)
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      const t = order[i]
      order[i] = order[j]
      order[j] = t
    }
    for (let j = 0; j < Math.floor(n / 2); j++) {
      const k = order[j]
      allVals.push(signs(r, D, 1))
      seq.push([k, allVals.length - 1])
      target[k] = allVals.length - 1
    }
  }

  const out: Record<string, number> = {}
  for (const m of MEMORIES) {
    const kd = m.keyDim(D, E)
    const keyOf = (i: number): Float64Array => {
      if (m.keyShape === "plain") return keys[i]
      if (m.keyShape === "wide") return wide[i]
      const j = new Float64Array(D * E)
      for (let a = 0; a < D; a++) for (let b = 0; b < E; b++) j[a * E + b] = keys[i][a] * keys2[i][b]
      return j
    }
    const K = Array.from({ length: n }, (_, i) => keyOf(i))
    // state S: D x kd, row-major
    const S = new Float64Array(D * kd)
    for (const [ki, vi] of seq) {
      const k = K[ki]
      const v = allVals[vi]
      for (let row = 0; row < D; row++) {
        let err = v[row]
        if (m.rule === "delta") {
          let pred = 0
          for (let c = 0; c < kd; c++) pred += S[row * kd + c] * k[c]
          err = BETA * (v[row] - pred)
        }
        for (let c = 0; c < kd; c++) S[row * kd + c] += err * k[c]
      }
    }
    let hits = 0
    const o = new Float64Array(D)
    for (let q = 0; q < n; q++) {
      const k = K[q]
      for (let row = 0; row < D; row++) {
        let s = 0
        for (let c = 0; c < kd; c++) s += S[row * kd + c] * k[c]
        o[row] = s
      }
      let best = -1
      let bestScore = -Infinity
      for (let j = 0; j < allVals.length; j++) {
        let s = 0
        for (let row = 0; row < D; row++) s += allVals[j][row] * o[row]
        if (s > bestScore) {
          bestScore = s
          best = j
        }
      }
      if (best === target[q]) hits++
    }
    out[m.id] = hits / n
  }
  return out
}

export function recallAccuracy(n: number, rewrite: boolean, seeds = 12): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const m of MEMORIES) acc[m.id] = 0
  for (let s = 0; s < seeds; s++) {
    const one = runOnce(n, rewrite, 1000 + s * 7919)
    for (const m of MEMORIES) acc[m.id] += one[m.id] / seeds
  }
  return acc
}
