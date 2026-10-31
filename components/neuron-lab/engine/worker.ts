/// <reference lib="webworker" />
// Dedicated worker: owns the wasm memory (~700 MB), the OPFS handle and every long computation,
// so the page stays responsive. Protocol: {id, op, ...} in, {id, type, ...} out.
import { DEFAULT_LOADER, openModel, type LoaderConfig } from "./loader"
import { Runtime } from "./runtime"
import type { Calibration, Steer } from "./types"

declare const self: DedicatedWorkerGlobalScope

let rt: Runtime | null = null
let opened: { close(): void } | null = null
let loading: Promise<void> | null = null
const aborts = new Set<number>()

const post = (m: Record<string, unknown>, transfer: Transferable[] = []) => self.postMessage(m, transfer)
const tick = () => new Promise<void>((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0) })
const need = () => { if (!rt) throw new Error("model not loaded"); return rt }

async function load(id: number, cfgOver: Partial<LoaderConfig> | undefined, calibration: Calibration | undefined) {
  if (rt) { if (calibration) rt.setCalibration(calibration); return }
  // (a new model starts a new worker: see engine.ts selectModel)
  if (!loading) {
    loading = (async () => {
      const cfg = { ...DEFAULT_LOADER, ...cfgOver }
      const DL = 0.85
      const o = await openModel(cfg, (f, m) => post({ id, type: "progress", frac: f, msg: m }), DL)
      opened = o
      try {
        rt = await Runtime.create(o.src, o.tokenizerJson, (f, m) => post({ id, type: "progress", frac: DL + (1 - DL) * f, msg: m }))
      } finally {
        // the OPFS handle is only needed while unpacking; weights now live in wasm memory
        o.close()
      }
    })().finally(() => { loading = null })
  }
  await loading
  if (calibration) need().setCalibration(calibration)
  if (!need().core.calibration) {
    post({ id, type: "progress", frac: 0.99, msg: "measuring the residual norms for steering (one pass over a reference passage)" })
    await tick()
    need().setCalibration(need().selfCalibrate())
  }
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  const id: number = m.id
  try {
    switch (m.op) {
      case "abort": aborts.add(m.target); return
      case "load": await load(id, m.config, m.calibration); post({ id, type: "done", result: null }); return
      case "calibrate": need().setCalibration(m.calibration as Calibration); post({ id, type: "done", result: null }); return
      case "tokenize": post({ id, type: "done", result: need().tokenize(m.text) }); return
      case "logits": {
        const lg = need().logits(m.prompt, m.steers as Steer[])
        post({ id, type: "done", result: lg }, [lg.buffer]); return
      }
      case "activations": {
        const r = need().activations(m.text)
        const tr: Transferable[] = [r.max.buffer]
        if (r.all) tr.push(r.all.buffer)
        post({ id, type: "done", result: { tokens: r.tokens, max: r.max, all: r.all } }, tr); return
      }
      case "generate": {
        const o = m.opts
        const ac = new AbortController()
        const iv = setInterval(() => { if (aborts.has(id)) ac.abort() }, 20)
        try {
          const r = await need().generate(
            { ...o, onToken: (t: string, info: { index: number }) => post({ id, type: "token", t, index: info.index }), signal: ac.signal },
            async () => { await tick(); if (aborts.has(id)) ac.abort() },
          )
          post({ id, type: "done", result: r })
        } finally { clearInterval(iv); aborts.delete(id) }
        return
      }
      case "generateMany": {
        const o = m.opts
        const ac = new AbortController()
        const iv = setInterval(() => { if (aborts.has(id)) ac.abort() }, 20)
        try {
          const r = await need().generateMany(
            { ...o, onToken: (variant: number, t: string, info: { index: number }) => post({ id, type: "token", variant, t, index: info.index }), signal: ac.signal },
            async () => { await tick(); if (aborts.has(id)) ac.abort() },
          )
          post({ id, type: "done", result: r })
        } finally { clearInterval(iv); aborts.delete(id) }
        return
      }
      default: throw new Error(`unknown op ${String(m.op)}`)
    }
  } catch (err) {
    post({ id, type: "error", message: err instanceof Error ? err.message : String(err) })
  }
}
void opened
