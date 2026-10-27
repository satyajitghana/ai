import type { Context, LayerLens, ModelMeta, Steer } from "./types"
import { matchesToken, showToken } from "./data"

export interface Hit {
  layer: number
  neuron: number
  /** +1: the neuron's write promotes the token; -1: it suppresses it. */
  sign: 1 | -1
  tokens: string[]
  score: number
}

export interface SearchResult {
  hits: Hit[]
  tokenCount: number
  layersSearched: number
}

const norm = (q: string) =>
  q
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((w) => w.trim())
    .filter(Boolean)

/** Neurons whose output direction promotes or suppresses the searched token(s) (the logit lens). */
export function searchLens(layers: Map<number, LayerLens>, query: string): SearchResult {
  const words = norm(query)
  const hits: Hit[] = []
  const seen = new Set<string>()
  if (!words.length) return { hits, tokenCount: 0, layersSearched: layers.size }
  for (const [layer, lens] of layers) {
    let amax = 1
    for (const v of lens.actMax) if (v > amax) amax = v
    const N = lens.up.length
    for (let n = 0; n < N; n++) {
      const test = (list: string[]) => {
        const out: string[] = []
        let best = 99
        list.forEach((t, rank) => {
          if (words.some((w) => matchesToken(t, w))) {
            out.push(showToken(t))
            best = Math.min(best, rank)
          }
        })
        return { out, best }
      }
      const u = test(lens.up[n])
      const d = test(lens.down[n])
      if (!u.out.length && !d.out.length) continue
      const up = u.out.length > 0 && (!d.out.length || u.best <= d.best)
      const tokens = [...new Map((up ? u.out : d.out).map((t) => [t.toLowerCase(), t])).values()]
      const best = up ? u.best : d.best
      for (const t of tokens) seen.add(t.toLowerCase())
      hits.push({
        layer,
        neuron: n,
        sign: up ? 1 : -1,
        tokens,
        score: (8 - Math.min(7, best)) * 10 + (lens.actMax[n] / amax) * 6 + (tokens.length - 1) * 2,
      })
    }
  }
  hits.sort((a, b) => b.score - a.score || a.layer - b.layer || a.neuron - b.neuron)
  return { hits, tokenCount: seen.size, layersSearched: layers.size }
}

/** Neurons with an activating text that contains the word (only the contexts the pipeline kept). */
export function searchFires(contexts: Record<string, Context[]>, query: string): SearchResult {
  const words = norm(query)
  const hits: Hit[] = []
  const seen = new Set<string>()
  if (!words.length) return { hits, tokenCount: 0, layersSearched: 0 }
  for (const [k, list] of Object.entries(contexts)) {
    const [l, n] = k.split(".").map(Number)
    let best = 0
    const tok: string[] = []
    for (const c of list) {
      const t = c.text.toLowerCase()
      for (const w of words) {
        if (t.includes(w)) {
          best = Math.max(best, c.act)
          if (!tok.includes(w)) tok.push(w)
          seen.add(w)
        }
      }
    }
    if (best > 0) hits.push({ layer: l, neuron: n, sign: 1, tokens: tok, score: best })
  }
  hits.sort((a, b) => b.score - a.score)
  return { hits, tokenCount: seen.size, layersSearched: 0 }
}

/** The same neuron's token neighbours: overlap of promoted (and suppressed) tokens. */
export function similarNeurons(layers: Map<number, LayerLens>, layer: number, neuron: number, k = 12) {
  const me = layers.get(layer)
  if (!me) return []
  const A = new Set(me.up[neuron].map((t) => showToken(t).toLowerCase()))
  const B = new Set(me.down[neuron].map((t) => showToken(t).toLowerCase()))
  const out: { layer: number; neuron: number; score: number; shared: string[] }[] = []
  for (const [l, lens] of layers) {
    for (let n = 0; n < lens.up.length; n++) {
      if (l === layer && n === neuron) continue
      let inter = 0
      const shared: string[] = []
      for (const t of lens.up[n]) {
        const s = showToken(t).toLowerCase()
        if (A.has(s)) {
          inter++
          shared.push(s)
        }
      }
      let interD = 0
      for (const t of lens.down[n]) if (B.has(showToken(t).toLowerCase())) interD++
      if (!inter && !interD) continue
      const score = inter / (A.size + lens.up[n].length - inter) + 0.5 * (interD / (B.size + lens.down[n].length - interD))
      out.push({ layer: l, neuron: n, score, shared })
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k)
}

// ---- dose arithmetic (the recipe) -------------------------------------------

export const MAX_STEERS = 4

/** Activation offset added to the neuron's MLP hidden unit at every position. */
export function activationDelta(meta: ModelMeta, s: Steer): number {
  return (s.dose * meta.resNormMedian[s.layer]) / meta.colNorm[s.layer][s.neuron]
}

/** How far along the neuron's output direction this writes, in residual-stream units. */
export function writeLength(meta: ModelMeta, s: Steer): number {
  return s.dose * meta.resNormMedian[s.layer]
}

export const fmtDose = (d: number) => `${d < 0 ? "−" : d > 0 ? "+" : ""}${Math.abs(Math.round(d * 100) / 100)}`

export function parseNeuron(text: string, layers: number, neurons: number): { layer: number; neuron: number } | null {
  const m = /^\s*L?\s*(\d+)\s*[.\s,:/-]*\s*N?\s*(\d+)\s*$/i.exec(text)
  if (!m) return null
  const layer = +m[1], neuron = +m[2]
  return layer >= 0 && layer < layers && neuron >= 0 && neuron < neurons ? { layer, neuron } : null
}
