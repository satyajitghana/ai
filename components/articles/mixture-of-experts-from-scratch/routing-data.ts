// Loader for the measured routing counts behind the heatmap and the capacity toy.
//
// public/articles/mixture-of-experts-from-scratch/routing.json is written from the RESULT
// lines of the beast2 run (Qwen3-30B-A3B, Q4_K_M GGUF, llama.cpp v1.0.0 eval callback):
// for every domain and every one of the 48 MoE layers, how many of the domain's tokens the
// router sent to each of the 128 experts (each token picks 8). It is committed, not media:
// it is fetched same-origin and parsed once per page.

export type RoutingData = {
  model: string
  quant: string
  layers: number
  experts: number
  k: number
  tokensPerDomain: number
  chunk: number
  domains: string[]
  /** counts[domain][layer][expert] */
  counts: Record<string, number[][]>
}

export const ROUTING_URL = "/articles/mixture-of-experts-from-scratch/routing.json"

let cache: Promise<RoutingData> | null = null

export function loadRouting(): Promise<RoutingData> {
  if (!cache) {
    cache = fetch(ROUTING_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`routing.json: ${r.status}`)
        return r.json() as Promise<RoutingData>
      })
      .catch((e) => {
        cache = null
        throw e
      })
  }
  return cache
}

/** Counts for one layer, pooled over the given domains. */
export function layerCounts(d: RoutingData, domain: string, layer: number): number[] {
  if (domain !== "all") return d.counts[domain][layer]
  const out = new Array<number>(d.experts).fill(0)
  for (const dom of d.domains) {
    const row = d.counts[dom][layer]
    for (let e = 0; e < d.experts; e++) out[e] += row[e]
  }
  return out
}

export function tokensFor(d: RoutingData, domain: string): number {
  return domain === "all" ? d.tokensPerDomain * d.domains.length : d.tokensPerDomain
}
