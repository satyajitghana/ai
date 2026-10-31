import type { AxisFinding, Context, Discovery, Edge, LayerLens, ModelMeta, NeuronKey } from "./types"
import { nkey } from "./types"

// Loads the static JSON the DATA pipeline publishes. Tolerant on purpose: the edge and discovery
// files accept a few equivalent shapes, and anything missing becomes an empty value so the UI can
// say what is absent instead of crashing.

async function getJson<T>(base: string, path: string): Promise<T | null> {
  try {
    const r = await fetch(`${base}/${path}`)
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export async function loadMeta(base: string): Promise<ModelMeta | null> {
  return getJson<ModelMeta>(base, "meta.json")
}

export async function loadLayer(base: string, layer: number): Promise<LayerLens | null> {
  return getJson<LayerLens>(base, `layers/L${String(layer).padStart(2, "0")}.json`)
}

export async function loadContexts(base: string): Promise<Record<string, Context[]>> {
  return (await getJson<Record<string, Context[]>>(base, "contexts.json")) ?? {}
}

type RawEdge = [number, number, number] | { layer: number; neuron: number; score: number } | [string, number]

function toEdge(e: RawEdge): Edge | null {
  if (Array.isArray(e)) {
    if (typeof e[0] === "string") {
      const m = /^L?(\d+)[.\sN:-]+(\d+)$/i.exec(e[0])
      return m ? { layer: +m[1], neuron: +m[2], score: Number(e[1]) } : null
    }
    return { layer: Number(e[0]), neuron: Number(e[1]), score: Number(e[2]) }
  }
  return e && typeof e === "object" ? { layer: e.layer, neuron: e.neuron, score: e.score } : null
}

/** Strongest "feeds" edges from a neuron to neurons in the next layer, keyed "L.N".
 *  Real file: { layers: { "L": [[fromNeuron, toNeuron (layer L+1), gateCos, upCos], ...] } }.
 *  Older/flat shapes ({ edges: { "L.N": [[layer, neuron, score], ...] } }) are accepted too. */
export async function loadLinks(base: string): Promise<Map<NeuronKey, Edge[]>> {
  const raw = await getJson<Record<string, unknown>>(base, "links.json")
  const out = new Map<NeuronKey, Edge[]>()
  if (!raw) return out
  const byLayer = raw.layers as Record<string, number[][]> | undefined
  if (byLayer && typeof byLayer === "object") {
    for (const [l, rows] of Object.entries(byLayer)) {
      const layer = +l
      for (const r of rows) {
        const k = nkey(layer, r[0])
        const list = out.get(k) ?? []
        list.push({ layer: layer + 1, neuron: r[1], score: r[2], up: r[3] })
        out.set(k, list)
      }
    }
    for (const list of out.values()) list.sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    return out
  }
  const body = (raw.edges ?? raw.feeds ?? raw) as Record<string, unknown>
  for (const [k, v] of Object.entries(body)) {
    const m = /^L?(\d+)[.\sN:-]+(\d+)$/i.exec(k)
    if (m && Array.isArray(v)) {
      const list = (v as RawEdge[]).map(toEdge).filter((x): x is Edge => !!x)
      out.set(nkey(+m[1], +m[2]), list)
    }
  }
  return out
}

export async function loadDiscoveries(base: string): Promise<Discovery[]> {
  const raw = await getJson<Discovery[] | { discoveries?: Discovery[]; items?: Discovery[] }>(base, "discoveries.json")
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.items ?? raw.discoveries ?? [])
}

/** Every axis we searched, including the misses. Lives beside the data folder: qwen3-0.6b-findings.json. */
export async function loadFindings(base: string): Promise<AxisFinding[]> {
  try {
    const r = await fetch(`${base}-findings.json`)
    if (!r.ok) return []
    const j = (await r.json()) as { axes?: AxisFinding[] }
    return Array.isArray(j.axes) ? j.axes : []
  } catch {
    return []
  }
}

/** The reverse of `feeds`: which earlier neurons feed this one. */
export function invertLinks(links: Map<NeuronKey, Edge[]>): Map<NeuronKey, Edge[]> {
  const inv = new Map<NeuronKey, Edge[]>()
  for (const [k, es] of links) {
    const [l, n] = k.split(".").map(Number)
    for (const e of es) {
      const kk = nkey(e.layer, e.neuron)
      const a = inv.get(kk) ?? []
      a.push({ layer: l, neuron: n, score: e.score })
      inv.set(kk, a)
    }
  }
  for (const a of inv.values()) a.sort((x, y) => Math.abs(y.score) - Math.abs(x.score))
  return inv
}

// ---- tokens ----------------------------------------------------------------

/** Display form of a token: byte-level BPE leaves a space marker and control characters. */
export function showToken(t: string): string {
  const s = t.replace(/Ġ/g, " ").replace(/Ċ/g, "↵").replace(/\n/g, "↵")
  return s.trim().length ? s.trim() : s.replace(/ /g, "␣")
}

export function matchesToken(token: string, q: string): boolean {
  const a = showToken(token).toLowerCase()
  return a === q || a.startsWith(q) || a.replace(/^[^\p{L}\p{N}]+/u, "").startsWith(q)
}
