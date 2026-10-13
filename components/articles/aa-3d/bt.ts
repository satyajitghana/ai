import { mexp } from "@/lib/dmath"

// Bradley-Terry from pairwise votes, the way AA-3D's methodology page describes
// it: a maximum-likelihood fit with every vote weighted equally, rescaled to an
// Elo range (400 points per factor of ten in odds) and anchored at
// GPT-6 Luna = 1000. Intervals here are the textbook ones, from the inverse of
// the observed information (the Hessian); AA reports a sandwich estimator,
// which comes out the same when the model is right.
//
// The 21 ratings below are AA's published AA-3D v1.0 Elo, read from the data
// embedded in artificialanalysis.ai/evaluations/aa-3d on 13 October 2026. The
// widget treats them as the hidden "true" strengths and draws simulated panel
// votes from them, so a reader can watch how many votes it takes for the fit to
// find them again.

export type Model = { name: string; short: string; elo: number; published: number }

export const MODELS: Model[] = [
  { name: "Claude Sonnet 5.5", short: "Sonnet 5.5", elo: 1194.2, published: 34 },
  { name: "Claude Opus 5.5", short: "Opus 5.5", elo: 1190.1, published: 35 },
  { name: "GPT-6 Astra", short: "GPT-6 Astra", elo: 1165.2, published: 34 },
  { name: "Claude Fable 5.1", short: "Fable 5.1", elo: 1131.4, published: 34 },
  { name: "GPT-6 Sol", short: "GPT-6 Sol", elo: 1122.7, published: 34 },
  { name: "GPT-6.1 Sol", short: "GPT-6.1 Sol", elo: 1114.5, published: 33 },
  { name: "Muse Spark 1.3", short: "Muse Spark 1.3", elo: 1035.3, published: 32 },
  { name: "GPT-6 Luna", short: "GPT-6 Luna", elo: 1000, published: 0 },
  { name: "Claude Haiku 5.5", short: "Haiku 5.5", elo: 994.0, published: 32 },
  { name: "Grok 4.7", short: "Grok 4.7", elo: 993.7, published: 32 },
  { name: "Kimi K3", short: "Kimi K3", elo: 981.9, published: 33 },
  { name: "MiMo-V2.6-Pro", short: "MiMo-V2.6-Pro", elo: 977.2, published: 32 },
  { name: "Gemini 3.8 Flash", short: "Gemini 3.8 Flash", elo: 964.8, published: 32 },
  { name: "Qwen3.8 Max", short: "Qwen3.8 Max", elo: 948.3, published: 32 },
  { name: "GLM-5.3-Flash", short: "GLM-5.3-Flash", elo: 930.7, published: 32 },
  { name: "Mistral Large 4 Preview", short: "Mistral Large 4", elo: 867.8, published: 32 },
  { name: "Step 5 Preview", short: "Step 5", elo: 847.5, published: 33 },
  { name: "GLM-5.3", short: "GLM-5.3", elo: 781.7, published: 35 },
  { name: "MiniMax-M3", short: "MiniMax-M3", elo: 738.6, published: 34 },
  { name: "Inkling", short: "Inkling", elo: 579.1, published: 41 },
  { name: "Nemotron 3 Ultra", short: "Nemotron 3 Ultra", elo: 569.1, published: 45 },
]

export const K = MODELS.length
export const ANCHOR = MODELS.findIndex((m) => m.name === "GPT-6 Luna")
// One natural-log unit of Bradley-Terry strength in Elo points: 400 / ln 10.
export const SCALE = 173.71779276130073
// A weak pull toward 1000 so a model that has only won (or only lost) stays
// finite before it has met anyone. Worth about a fiftieth of a vote; it stops
// mattering after a few dozen votes. AA does not say whether it does anything
// like this.
const RIDGE = 0.02

// Wins[a][b]: votes in which a beat b.
export type Wins = number[][]

export const emptyWins = (): Wins => MODELS.map(() => MODELS.map(() => 0))

// mulberry32: integer-only, so the server and the browser draw the same votes.
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const sigmoid = (x: number) => 1 / (1 + mexp(-x))

export const winProb = (eloA: number, eloB: number) => sigmoid((eloA - eloB) / SCALE)

// Draw n panel votes from the published ratings. "uniform" pairs any two models
// at random; "close" pairs each model with one of its three nearest neighbours
// in the published order, which is what an arena does when it wants to separate
// models that are near each other.
export function simulate(wins: Wins, n: number, seed: number, pairing: "uniform" | "close"): Wins {
  const out = wins.map((r) => r.slice())
  const r = rng(seed)
  for (let v = 0; v < n; v++) {
    const i = Math.floor(r() * K)
    let j: number
    if (pairing === "uniform") {
      j = Math.floor(r() * (K - 1))
      if (j >= i) j += 1
    } else {
      const lo = Math.max(0, i - 3)
      const hi = Math.min(K - 1, i + 3)
      do {
        j = lo + Math.floor(r() * (hi - lo + 1))
      } while (j === i)
    }
    if (r() < winProb(MODELS[i].elo, MODELS[j].elo)) out[i][j] += 1
    else out[j][i] += 1
  }
  return out
}

export const totalVotes = (w: Wins) => w.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0)

// Gauss-Jordan inverse of a small symmetric positive-definite matrix.
function invert(a: number[][]): number[][] {
  const n = a.length
  const m = a.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r
    ;[m[c], m[p]] = [m[p], m[c]]
    const d = m[c][c]
    for (let k = 0; k < 2 * n; k++) m[c][k] /= d
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = m[r][c]
      if (f === 0) continue
      for (let k = 0; k < 2 * n; k++) m[r][k] -= f * m[c][k]
    }
  }
  return m.map((row) => row.slice(n))
}

export type Fit = { elo: number[]; half: number[]; cov: number[][] }

// Newton's method on the Bradley-Terry log-likelihood, GPT-6 Luna held at 0.
export function fit(w: Wins): Fit {
  const free = MODELS.map((_, i) => i).filter((i) => i !== ANCHOR)
  const th = new Array<number>(K).fill(0)
  let cov: number[][] = []
  for (let it = 0; it < 40; it++) {
    const g = new Array<number>(K).fill(0)
    const H = MODELS.map(() => new Array<number>(K).fill(0))
    for (let a = 0; a < K; a++) {
      for (let b = a + 1; b < K; b++) {
        const n = w[a][b] + w[b][a]
        if (n === 0) continue
        const p = sigmoid(th[a] - th[b])
        const res = w[a][b] - n * p
        g[a] += res
        g[b] -= res
        const h = n * p * (1 - p)
        H[a][a] += h
        H[b][b] += h
        H[a][b] -= h
        H[b][a] -= h
      }
    }
    const Hf = free.map((a) => free.map((b) => H[a][b] + (a === b ? RIDGE : 0)))
    const gf = free.map((a) => g[a] - RIDGE * th[a])
    cov = invert(Hf)
    let maxStep = 0
    free.forEach((a, ia) => {
      let s = 0
      for (let ib = 0; ib < free.length; ib++) s += cov[ia][ib] * gf[ib]
      th[a] += s
      maxStep = Math.max(maxStep, Math.abs(s))
    })
    if (maxStep < 1e-9) break
  }
  // Expand the covariance back to K x K with a zero row and column for the anchor.
  const full = MODELS.map(() => new Array<number>(K).fill(0))
  free.forEach((a, ia) => free.forEach((b, ib) => (full[a][b] = cov[ia][ib])))
  return {
    elo: th.map((t) => 1000 + t * SCALE),
    half: MODELS.map((_, i) => 1.96 * Math.sqrt(full[i][i]) * SCALE),
    cov: full,
  }
}

// 95% half-width of the difference between two fitted ratings. This, not
// whether two single intervals overlap, says whether two models are separable.
export const diffHalf = (f: Fit, a: number, b: number) =>
  1.96 * Math.sqrt(Math.max(0, f.cov[a][a] + f.cov[b][b] - 2 * f.cov[a][b])) * SCALE
