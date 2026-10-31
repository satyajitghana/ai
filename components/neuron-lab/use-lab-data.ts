"use client"

import { useEffect, useState } from "react"

import { invertLinks, loadContexts, loadDiscoveries, loadFindings, loadLayer, loadLinks, loadMeta } from "./data"
import { MODELS, type ModelId } from "./lab-models"
import type { AxisFinding, Context, Discovery, Edge, LayerLens, ModelMeta, NeuronKey } from "./types"

export interface LabData {
  /** the model these fields belong to; everything is empty until it has loaded */
  model: ModelId | null
  meta: ModelMeta | null
  layers: Map<number, LayerLens>
  /** bumps whenever `layers` gained entries (the Map identity is stable per model) */
  version: number
  loadedLayers: number
  contexts: Record<string, Context[]>
  links: Map<NeuronKey, Edge[]>
  fedBy: Map<NeuronKey, Edge[]>
  discoveries: Discovery[]
  findings: AxisFinding[]
  status: "loading" | "ready" | "missing"
}

interface Slot {
  model: ModelId
  layers: Map<number, LayerLens>
  meta: ModelMeta | null
  contexts: Record<string, Context[]>
  links: Map<NeuronKey, Edge[]>
  fedBy: Map<NeuronKey, Edge[]>
  discoveries: Discovery[]
  findings: AxisFinding[]
  status: "loading" | "ready" | "missing"
}

const EMPTY: Omit<Slot, "model" | "layers"> = { meta: null, contexts: {}, links: new Map(), fedBy: new Map(), discoveries: [], findings: [], status: "loading" }
const NONE = new Map<number, LayerLens>()

/** Loads one model's published data (meta, per-layer lens, contexts, links, recipes, findings). Switching `model`
 *  starts a fresh load and never mixes the two models' numbers: until the new data is in, fields are empty. */
export function useLabData(model: ModelId | null, firstLayer = 0): LabData {
  const [slot, setSlot] = useState<Slot | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!model) return
    let dead = false
    const base = MODELS[model].dataBase
    const layers = new Map<number, LayerLens>()
    ;(async () => {
      const meta = await loadMeta(base)
      if (dead) return
      if (!meta) {
        setSlot({ model, layers, ...EMPTY, status: "missing" })
        return
      }
      setSlot({ model, layers, ...EMPTY, meta, status: "loading" })
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
          const lens = await loadLayer(base, l)
          if (lens && !dead) {
            layers.set(l, lens)
            bump()
          }
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      if (dead) return
      setVersion((v) => v + 1)
      const [contexts, links, discoveries, findings] = await Promise.all([loadContexts(base), loadLinks(base), loadDiscoveries(base), loadFindings(base)])
      if (dead) return
      setSlot((s) => (s && s.model === model ? { ...s, contexts, links, fedBy: invertLinks(links), discoveries, findings, status: "ready" } : s))
    })()
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])

  const cur = slot && slot.model === model ? slot : null
  return {
    model: cur ? cur.model : null,
    meta: cur?.meta ?? null,
    layers: cur?.layers ?? NONE,
    version,
    loadedLayers: cur?.layers.size ?? 0,
    contexts: cur?.contexts ?? EMPTY.contexts,
    links: cur?.links ?? EMPTY.links,
    fedBy: cur?.fedBy ?? EMPTY.fedBy,
    discoveries: cur?.discoveries ?? EMPTY.discoveries,
    findings: cur?.findings ?? EMPTY.findings,
    status: cur?.status ?? "loading",
  }
}
