"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Bytes one decoded token reads, and the speed ceiling that sets.
//
// Every per-token byte count below comes from the GGUF headers of the published
// checkpoints (tensor offsets give each tensor's on-disk size), parsed with HTTP
// range requests. A token reads every non-routed tensor once, one row of the
// embedding table, and top-k of n routed experts per layer:
//
//   per-token bytes = dense + routed_file × k / n
//
// With experts resident in RAM, decode time per token is at least
//   t = per-token bytes / RAM bandwidth
// With experts on an SSD and a share h of expert reads served from RAM (the page
// cache hit rate), the routed part splits:
//   t = dense / B_ram + routed × ( h / B_ram + (1 − h) / B_ssd )
// It is a bandwidth floor on time, so a ceiling on tok/s: no compute, no
// attention over the KV cache, no repacking overhead, one token per pass.

type ModelKey = "maxq" | "mxfp4" | "nemo"

type Part = { key: string; label: string; gb: number; tone: string }

const MODELS: Record<
  ModelKey,
  { label: string; file: number; routedFile: number; parts: Part[]; note: string }
> = {
  maxq: {
    label: "DeepSeek-V4-Flash MaxQ (as shipped)",
    file: 61.12,
    routedFile: 56.66,
    parts: [
      { key: "routed", label: "routed experts, 6 of 256", gb: 1.328, tone: "bg-sky-500/80" },
      { key: "attn", label: "attention + indexer (Fractal-64)", gb: 2.541, tone: "bg-amber-500/80" },
      { key: "shared", label: "shared expert (Q6_K)", gb: 0.89, tone: "bg-emerald-500/80" },
      { key: "out", label: "output head", gb: 0.434, tone: "bg-violet-500/80" },
      { key: "other", label: "norms, router, hyper-connections", gb: 0.168, tone: "bg-zinc-400/80" },
    ],
    note: "56.93 GiB on disk; routed experts are 92.7% of the file and 24.8% of a token's reads.",
  },
  mxfp4: {
    label: "DeepSeek-V4-Flash, experts left at 4.25 bpw",
    file: 151.6,
    routedFile: 147.17,
    parts: [
      { key: "routed", label: "routed experts, 6 of 256", gb: 3.449, tone: "bg-sky-500/80" },
      { key: "attn", label: "attention + indexer (Fractal-64)", gb: 2.541, tone: "bg-amber-500/80" },
      { key: "shared", label: "shared expert (Q6_K)", gb: 0.89, tone: "bg-emerald-500/80" },
      { key: "out", label: "output head", gb: 0.434, tone: "bg-violet-500/80" },
      { key: "other", label: "norms, router, hyper-connections", gb: 0.168, tone: "bg-zinc-400/80" },
    ],
    note: "A counterfactual: the 277B routed parameters at MXFP4's 4.25 bpw. It does not fit in 64 GB.",
  },
  nemo: {
    label: "Nemotron-3.5-30B-A3B VQ3-64",
    file: 14.27,
    routedFile: 12.63,
    parts: [
      { key: "routed", label: "routed experts, 6 of 128", gb: 0.592, tone: "bg-sky-500/80" },
      { key: "ssm", label: "Mamba-2 layers", gb: 0.631, tone: "bg-rose-500/80" },
      { key: "out", label: "output head (Q8_0)", gb: 0.374, tone: "bg-violet-500/80" },
      { key: "shared", label: "shared expert (Q4_0)", gb: 0.258, tone: "bg-emerald-500/80" },
      { key: "attn", label: "attention, 6 layers", gb: 0.15, tone: "bg-amber-500/80" },
      { key: "other", label: "norms, router", gb: 0.032, tone: "bg-zinc-400/80" },
    ],
    note: "13.30 GiB on disk; the VQ3 tensors touch only the routed part, 29.1% of a token's reads.",
  },
}

const BUSES = [
  { key: "ddr5x2", label: "2-channel DDR5-5600, ~75 GB/s sustained", gbs: 75 },
  { key: "ddr5peak", label: "2-channel DDR5-5600, 89.6 GB/s peak", gbs: 89.6 },
  { key: "m5", label: "Apple M5 Max, 286.5 GB/s", gbs: 286.5 },
  { key: "tr", label: "8-channel DDR5-6000, 384 GB/s peak", gbs: 384 },
]

// Measured single-stream decode, no speculation, from the README.
const MEASURED: Record<ModelKey, { bus: string; v: number; label: string }[]> = {
  maxq: [{ bus: "ddr5x2", v: 8.75, label: "README: 8.75 tok/s, Ryzen 9 9955HX" }],
  mxfp4: [],
  nemo: [{ bus: "ddr5x2", v: 22.44, label: "README: 22.44 tok/s, Ryzen 9 9955HX" }],
}

const RAM_GB = 67.1 // 62.5 GiB usable on a 64 GB Linux host, per the README

function fmt(v: number, d = 1) {
  return v >= 100 ? v.toFixed(0) : v.toFixed(d)
}

export function TokenBudget() {
  const [model, setModel] = useState<ModelKey>("maxq")
  const [bus, setBus] = useState("ddr5x2")
  const [onDisk, setOnDisk] = useState(false)
  const [ssd, setSsd] = useState(7)
  const [hit, setHit] = useState(0.4)

  const m = MODELS[model]
  const B = BUSES.find((b) => b.key === bus)?.gbs ?? 75
  const total = m.parts.reduce((s, p) => s + p.gb, 0)
  const routed = m.parts.find((p) => p.key === "routed")?.gb ?? 0
  const dense = total - routed
  const fits = m.file <= RAM_GB
  const disk = onDisk || !fits

  const ms = disk ? (dense / B + routed * (hit / B + (1 - hit) / ssd)) * 1000 : (total / B) * 1000
  const tps = 1000 / ms
  const marks = disk ? [] : MEASURED[model].filter((x) => x.bus === bus)
  const diskGB = disk ? routed * (1 - hit) : 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        What one token reads, and the decode ceiling it sets · byte counts from the GGUF headers
      </div>

      <div className="space-y-2.5 border-b px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">checkpoint</span>
          {(Object.keys(MODELS) as ModelKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setModel(k)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                model === k ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {MODELS[k].label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">memory</span>
          {BUSES.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBus(b.key)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                bus === b.key ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">experts</span>
          <button
            type="button"
            disabled={!fits}
            onClick={() => setOnDisk(false)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] disabled:opacity-40",
              !disk ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            resident in RAM
          </button>
          <button
            type="button"
            onClick={() => setOnDisk(true)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px]",
              disk ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            mmap from an SSD
          </button>
          {!fits && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {fmt(m.file)} GB does not fit in {fmt(RAM_GB)} GB, so experts must stream
            </span>
          )}
        </div>
        {disk && (
          <>
            <label className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">SSD GB/s</span>
              <Range
                min={1}
                max={14}
                step={0.5}
                value={ssd}
                onChange={(e) => setSsd(Number(e.target.value))}
                aria-label="SSD read bandwidth in GB/s"
                className="w-full"
              />
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">{ssd.toFixed(1)}</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-muted-foreground">cache hits</span>
              <Range
                min={0}
                max={1}
                step={0.01}
                value={hit}
                onChange={(e) => setHit(Number(e.target.value))}
                aria-label="Share of expert reads served from the page cache"
                className="w-full"
              />
              <span className="w-14 shrink-0 text-right font-mono tabular-nums">{Math.round(hit * 100)}%</span>
            </label>
          </>
        )}
      </div>

      <div className="space-y-3 px-4 py-4">
        <div>
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>bytes read per token</span>
            <span className="tabular-nums">{total.toFixed(2)} GB</span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-sm border">
            {m.parts.map((p) => (
              <div
                key={p.key}
                className={cn(p.tone, "h-full")}
                style={{ width: `${((p.gb / total) * 100).toFixed(2)}%` }}
                title={`${p.label}: ${p.gb.toFixed(3)} GB`}
              />
            ))}
          </div>
          <ul className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-2">
            {m.parts.map((p) => (
              <li key={p.key} className="flex items-center gap-2">
                <span className={cn(p.tone, "inline-block size-2.5 shrink-0 rounded-sm")} />
                <span className="text-muted-foreground">{p.label}</span>
                <span className="ml-auto tabular-nums">{p.gb.toFixed(3)} GB</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded border px-3 py-2">
            <div className="font-mono text-[11px] text-muted-foreground">floor per token</div>
            <div className="font-mono text-lg tabular-nums">{fmt(ms)} ms</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="font-mono text-[11px] text-muted-foreground">decode ceiling</div>
            <div className="font-mono text-lg tabular-nums">{fmt(tps)} tok/s</div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="font-mono text-[11px] text-muted-foreground">read from SSD per token</div>
            <div className="font-mono text-lg tabular-nums">{diskGB.toFixed(2)} GB</div>
          </div>
        </div>

        {marks.map((x) => (
          <p key={x.label} className="font-mono text-[11px] text-muted-foreground">
            {x.label}, which is {Math.round((x.v / tps) * 100)}% of this ceiling.
          </p>
        ))}
        <p className="text-xs text-muted-foreground">{m.note}</p>
      </div>
    </figure>
  )
}
