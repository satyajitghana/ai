"use client"

import { useEffect, useState } from "react"

import { invertLinks, loadContexts, loadDiscoveries, loadLayer, loadLinks, loadMeta } from "./data"
import type { Context, Discovery, Edge, LayerLens, ModelMeta, NeuronKey } from "./types"

export interface LabData {
  meta: ModelMeta | null
  layers: Map<number, LayerLens>
  /** bumps whenever `layers` gained entries (the Map identity is stable) */
  version: number
  loadedLayers: number
  contexts: Record<string, Context[]>
  links: Map<NeuronKey, Edge[]>
  fedBy: Map<NeuronKey, Edge[]>
  discoveries: Discovery[]
  status: "loading" | "ready" | "missing"
}

export function useLabData(firstLayer = 0): LabData {
  // one stable Map for the life of the page: layers arrive over time and `version` says so
  const [layersMap] = useState<Map<number, LayerLens>>(() => new Map())
  const [state, setState] = useState<Omit<LabData, "layers" | "version" | "loadedLayers">>({
    meta: null,
    contexts: {},
    links: new Map(),
    fedBy: new Map(),
    discoveries: [],
    status: "loading",
  })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let dead = false
    ;(async () => {
      const meta = await loadMeta()
      if (dead) return
      if (!meta) {
        setState((s) => ({ ...s, status: "missing" }))
        return
      }
      setState((s) => ({ ...s, meta, status: "loading" }))
      const order = Array.from({ length: meta.layers }, (_, i) => i).sort((a, b) => Math.abs(a - firstLayer) - Math.abs(b - firstLayer))
      let next = 0
      let last = 0
      const bump = () => {
        const now = performance.now()
        if (now - last > 120) {
          last = now
          setVersion((v) => v + 1)
        }
      }
      const worker = async () => {
        while (!dead && next < order.length) {
          const l = order[next++]
          const lens = await loadLayer(l)
          if (lens && !dead) {
            layersMap.set(l, lens)
            bump()
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (dead) return
      setVersion((v) => v + 1)
      const [contexts, links, discoveries] = await Promise.all([loadContexts(), loadLinks(), loadDiscoveries()])
      if (dead) return
      setState((s) => ({ ...s, contexts, links, fedBy: invertLinks(links), discoveries, status: "ready" }))
    })()
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ...state, layers: layersMap, version, loadedLayers: layersMap.size }
}
