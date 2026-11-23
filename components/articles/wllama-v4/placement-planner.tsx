"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where wllama 4.0.0 puts a model's layers: the main wasm instance, ggml-rpc workers
// (each its own wasm instance with its own 4 GiB), and WebGPU.
//
// The rules are the ones in the 4.0.0 source:
//   - src/utils.ts RPC_CONFIG: files under 2.5 GiB are never measured; above it, if the
//     CPU part (weights + KV + compute) is over mainMemMax = 3584 MiB, workers are used.
//   - cpp/wllama-context.h count_rpc_workers(): one worker per (4 GiB - RPC_MEM_MARGIN),
//     RPC_MEM_MARGIN = 1 GiB, so one per 3 GiB of CPU bytes, capped at 16 (GGML_RPC_MAX_SERVERS).
//   - fit_rpc_workers() + README-dev "RPC workers": device order [RPC0..RPCn, WebGPU], the first
//     layers go to the first device, the fit fills from the last device, WebGPU keeps exactly
//     n_gpu_layers, each worker takes layers until 1 GiB of its 4 GiB is left, the rest stay
//     in the main instance with token_embd.
//   - keep_tok_embd_on_gpu(): with every layer on WebGPU and no workers, token_embd goes to the GPU.
//   - Workers need multi-thread, i.e. a cross-origin isolated page (COOP/COEP).
// What is NOT real: the model is 32 equal layers, token_embd is 12% of the file, and KV cache +
// compute buffers on the CPU are a flat 0.3 GiB. Those are stand-ins so the rules can be seen.

const GIB = 1024 * 1024 * 1024
const LAYERS = 32
const EMBD_SHARE = 0.12
const CPU_EXTRA = 0.3 // GiB
const AUTO_MIN = 2.5 // GiB
const MAIN_MAX = 3584 / 1024 // GiB
const WORKER_CAP = 3 // GiB of layers per worker
const INSTANCE = 4 // GiB
const MAX_WORKERS = 16

const PRESETS = [
  { label: "Qwen2.5-Omni 3B Q4_K_M", gb: 2.1 },
  { label: "Gemma 4 E4B Q4_0", gb: 4.59 },
  { label: "Qwen3.5-4B BF16", gb: 8.4 },
  { label: "a 14 GB file", gb: 14 },
]

type Device = { id: string; label: string; tone: string }
type Plan = {
  ok: boolean
  why: string
  owner: string[] // per layer: device id
  mem: { id: string; label: string; gib: number; tone: string; cap: number | null }[]
  workers: number
}

const MAIN: Device = { id: "main", label: "main wasm", tone: "bg-sky-500/80" }
const GPU: Device = { id: "gpu", label: "WebGPU", tone: "bg-emerald-500/80" }
const RPC_TONES = ["bg-amber-500/80", "bg-orange-500/80", "bg-rose-500/80", "bg-fuchsia-500/80"]

function plan(fileGb: number, ngl: number, isolated: boolean): Plan {
  const file = (fileGb * 1e9) / GIB
  const embd = file * EMBD_SHARE
  const layer = (file - embd) / LAYERS
  const nGpu = Math.min(ngl, LAYERS)
  const owner: string[] = new Array(LAYERS).fill("main")
  for (let i = LAYERS - nGpu; i < LAYERS; i++) owner[i] = "gpu"
  const allGpu = nGpu === LAYERS
  const cpuNoWorkers = (LAYERS - nGpu) * layer + (allGpu ? 0 : embd) + CPU_EXTRA
  const gpuNoWorkers = nGpu * layer + (allGpu ? embd : 0)

  const measured = file >= AUTO_MIN
  if (!measured || cpuNoWorkers <= MAIN_MAX) {
    const ok = cpuNoWorkers <= INSTANCE
    return {
      ok,
      workers: 0,
      why: !measured
        ? "Under 2.5 GiB: not measured, it loads in the main instance."
        : `CPU part ${cpuNoWorkers.toFixed(2)} GiB, under the 3.5 GiB limit: no workers.`,
      owner,
      mem: [
        { id: "main", label: MAIN.label, gib: cpuNoWorkers, tone: MAIN.tone, cap: INSTANCE },
        ...(nGpu > 0 ? [{ id: "gpu", label: GPU.label, gib: gpuNoWorkers, tone: GPU.tone, cap: null }] : []),
      ],
    }
  }
  if (!isolated) {
    return {
      ok: false,
      workers: 0,
      why: `CPU part ${cpuNoWorkers.toFixed(2)} GiB is over 3.5 GiB, and rpc workers need multi-thread: the page is not cross-origin isolated, so the load fails.`,
      owner,
      mem: [{ id: "main", label: MAIN.label, gib: cpuNoWorkers, tone: MAIN.tone, cap: INSTANCE }],
    }
  }
  const n = Math.min(MAX_WORKERS, Math.ceil(cpuNoWorkers / WORKER_CAP))
  // the fit fills from the last device: WebGPU (already placed), then RPCn-1 ... RPC0
  const workerGib: number[] = new Array(n).fill(0)
  let next = LAYERS - nGpu - 1
  for (let w = n - 1; w >= 0 && next >= 0; w--) {
    while (next >= 0 && workerGib[w] + layer <= WORKER_CAP) {
      owner[next] = `rpc${w}`
      workerGib[w] += layer
      next--
    }
  }
  const mainLayers = next + 1
  const main = mainLayers * layer + embd + CPU_EXTRA
  const ok = main <= INSTANCE
  return {
    ok,
    workers: n,
    why: ok
      ? `CPU part ${cpuNoWorkers.toFixed(2)} GiB is over 3.5 GiB: ${n} rpc worker${n > 1 ? "s" : ""}, one per 3 GiB, and the load starts again with them.`
      : `Even with ${n} workers the main instance would hold ${main.toFixed(2)} GiB: the load fails.`,
    owner,
    mem: [
      { id: "main", label: MAIN.label, gib: main, tone: MAIN.tone, cap: INSTANCE },
      ...workerGib.map((g, w) => ({ id: `rpc${w}`, label: `rpc worker ${w}`, gib: g, tone: RPC_TONES[w % RPC_TONES.length], cap: INSTANCE })),
      ...(nGpu > 0 ? [{ id: "gpu", label: GPU.label, gib: nGpu * layer, tone: GPU.tone, cap: null }] : []),
    ],
  }
}

function toneOf(id: string) {
  if (id === "main") return MAIN.tone
  if (id === "gpu") return GPU.tone
  return RPC_TONES[Number(id.slice(3)) % RPC_TONES.length]
}

export function PlacementPlanner() {
  const [gb, setGb] = useState(4.59)
  const [ngl, setNgl] = useState(0)
  const [isolated, setIsolated] = useState(true)
  const p = plan(gb, ngl, isolated)
  const maxGpu = Math.max(1, ...p.mem.filter((m) => m.id === "gpu").map((m) => m.gib))

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Where the layers go in wllama 4.0.0</figcaption>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((pr) => (
          <button
            key={pr.label}
            type="button"
            onClick={() => setGb(pr.gb)}
            className={cn(
              "rounded border px-2 py-1 text-xs",
              gb === pr.gb ? "border-foreground bg-muted" : "border-border hover:bg-muted",
            )}
          >
            {pr.label} ({pr.gb} GB)
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground">
            File size: <span className="font-mono text-foreground">{gb.toFixed(2)} GB</span>
          </span>
          <Range min={0.5} max={16} step={0.01} value={gb} onChange={(e) => setGb(Number(e.target.value))} className="w-full" aria-label="Model file size in GB" />
        </label>
        <label className="block">
          <span className="text-muted-foreground">
            <code>n_gpu_layers</code>: <span className="font-mono text-foreground">{ngl === LAYERS ? `${LAYERS} (all)` : ngl}</span>
          </span>
          <Range min={0} max={LAYERS} step={1} value={ngl} onChange={(e) => setNgl(Number(e.target.value))} className="w-full" aria-label="Layers on WebGPU" />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-muted-foreground">
        <input type="checkbox" checked={isolated} onChange={(e) => setIsolated(e.target.checked)} />
        Page sends COOP/COEP (cross-origin isolated, so threads and workers are allowed)
      </label>

      <div className="mt-4">
        <div className="mb-1 text-xs text-muted-foreground">32 layers, input side on the left</div>
        <div className="flex h-7 overflow-hidden rounded border border-border" role="img" aria-label="Layer placement strip">
          {p.owner.map((o, i) => (
            <div key={i} className={cn("flex-1 border-r border-background/60 last:border-r-0", toneOf(o))} title={`layer ${i}: ${o}`} />
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {p.mem.map((m) => {
          const cap = m.cap ?? maxGpu
          const pct = Math.min(100, (m.gib / cap) * 100)
          const over = m.cap !== null && m.gib > m.cap
          return (
            <div key={m.id} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-2">
              <span className="truncate text-xs">{m.label}</span>
              <div className="relative h-4 rounded bg-muted">
                <div className={cn("h-4 rounded", over ? "bg-red-500/80" : m.tone)} style={{ width: `${pct.toFixed(2)}%` }} />
              </div>
              <span className="text-right font-mono text-xs">
                {m.gib.toFixed(2)}
                {m.cap !== null ? ` / ${m.cap}` : ""} GiB
              </span>
            </div>
          )
        })}
      </div>

      <p className={cn("mt-3 rounded px-2 py-1.5 text-xs", p.ok ? "bg-muted" : "bg-red-500/10 text-red-700 dark:text-red-300")}>
        {p.ok ? "Loads. " : "Fails. "}
        {p.why}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        The rules are wllama 4.0.0&apos;s; the model is not. It is 32 equal layers, token embeddings at 12% of the file and
        0.3 GiB of KV cache and compute on the CPU, so the GiB figures are illustrative. The real code measures the
        model with llama.cpp before it decides.
      </p>
    </figure>
  )
}
