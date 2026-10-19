"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// KV cache per token per layer, and per sequence, for the five attention layouts
// the VHA paper compares. All arithmetic is + - * /, so server and client agree.
//
//   MHA   2 · Hq · d · b              one K and one V head per query head
//   GQA   2 · Hkv · d · b             Hkv shared K/V heads
//   MQA   2 · 1 · d · b               one shared K/V head
//   MLA   (c_kv + d_rope) · b         one latent plus a decoupled RoPE key
//   VHA   2 · 2 · d · b               trains as Hq/2 physical query heads over 2 K/V
//                                     heads, serves as GQA with Hq query heads, Hkv = 2
//
// b = 2 bytes (BF16). Presets are the paper's Table 12 shapes (layers, hidden size,
// head counts), with d = 128, c_kv = 512, and d_rope = 64 assumed for MLA (the paper
// lists c_kv = 512 and reports 1.12 KB, which 512 + 64 = 576 numbers reproduce).

const B = 2

type Preset = {
  id: string
  label: string
  layers: number
  hidden: number
  hq: number
  hkv: number
}

const PRESETS: Preset[] = [
  { id: "1.7b", label: "1.7B dense", layers: 28, hidden: 2048, hq: 16, hkv: 8 },
  { id: "4b", label: "4B dense", layers: 36, hidden: 2560, hq: 32, hkv: 8 },
  { id: "30b", label: "30B-A3B MoE", layers: 46, hidden: 1536, hq: 48, hkv: 4 },
]

const CONTEXTS = [4, 8, 32, 128] as const

const COLORS: Record<string, string> = {
  MHA: "oklch(0.62 0.03 260)",
  GQA: "oklch(0.62 0.13 250)",
  MQA: "oklch(0.66 0.10 160)",
  MLA: "oklch(0.70 0.14 80)",
  VHA: "oklch(0.64 0.19 25)",
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GiB`
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MiB`
  return `${(n / 1024).toFixed(2)} KB`
}

function fmtM(n: number): string {
  return `${(n / 1e6).toFixed(2)}M`
}

export function KvCalculator() {
  const [preset, setPreset] = useState<string>("1.7b")
  const [hq, setHq] = useState(16)
  const [hkv, setHkv] = useState(8)
  const [d, setD] = useState(128)
  const [ckv, setCkv] = useState(512)
  const [layers, setLayers] = useState(28)
  const [hidden, setHidden] = useState(2048)
  const [ctxK, setCtxK] = useState<number>(128)

  const pick = (p: Preset) => {
    setPreset(p.id)
    setHq(p.hq)
    setHkv(p.hkv)
    setLayers(p.layers)
    setHidden(p.hidden)
    setD(128)
    setCkv(512)
  }

  const kv = Math.min(hkv, hq)
  const grp = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))
  const rows = [
    { k: "MHA", per: 2 * hq * d * B, note: `${hq} K/V heads` },
    { k: "GQA", per: 2 * kv * d * B, note: `${kv} K/V heads, group ${grp(hq / kv)}` },
    { k: "MQA", per: 2 * 1 * d * B, note: "1 K/V head" },
    { k: "MLA", per: (ckv + 64) * B, note: `latent ${ckv} + RoPE 64` },
    { k: "VHA", per: 2 * 2 * d * B, note: `serves as GQA-2, group ${grp(hq / 2)}` },
  ]
  const tokens = ctxK * 1024
  const maxPer = Math.max(...rows.map((r) => r.per))
  const gqaPer = 2 * kv * d * B

  // Query-projection weights: VHA trains with Hq/2 physical heads plus one d x d
  // Premix per K/V group; folding multiplies them into Hq full-width heads.
  const qTrain = hidden * (hq / 2) * d + 2 * d * d
  const qServe = hidden * hq * d

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        KV cache per token, per layer and per sequence · MHA, GQA, MQA, MLA, VHA
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => pick(p)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                preset === p.id
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Slider label="query heads Hq" value={hq} min={4} max={128} step={4} onChange={(v) => { setPreset(""); setHq(v) }} />
          <Slider label="GQA K/V heads" value={hkv} min={1} max={32} step={1} onChange={(v) => { setPreset(""); setHkv(v) }} />
          <Slider label="head dim d" value={d} min={64} max={256} step={32} onChange={(v) => { setPreset(""); setD(v) }} />
          <Slider label="MLA latent c_kv" value={ckv} min={128} max={1024} step={64} onChange={(v) => { setPreset(""); setCkv(v) }} />
          <Slider label="layers" value={layers} min={8} max={96} step={1} onChange={(v) => { setPreset(""); setLayers(v) }} />
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">context (tokens)</div>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={ctxK === c}
                  onClick={() => setCtxK(c)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-xs",
                    ctxK === c ? "border-foreground/40 bg-foreground/10" : "text-muted-foreground",
                  )}
                >
                  {c}K
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2" role="table" aria-label="KV cache by attention layout">
          {rows.map((r) => {
            const seq = r.per * layers * tokens
            const pct = (r.per / maxPer) * 100
            return (
              <div key={r.k} role="row" className="grid grid-cols-[3.2rem_1fr] items-center gap-2 sm:grid-cols-[3.2rem_1fr_7.5rem]">
                <div role="cell" className="font-mono text-xs font-semibold" style={{ color: COLORS[r.k] }}>
                  {r.k}
                </div>
                <div role="cell" className="min-w-0">
                  <div className="h-3 rounded-sm bg-muted/40">
                    <div
                      className="h-3 rounded-sm transition-[width] duration-300"
                      style={{ width: `${pct.toFixed(2)}%`, background: COLORS[r.k] }}
                    />
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {fmtBytes(r.per)} / token / layer · {r.note} · {(r.per / gqaPer).toFixed(2)}x GQA
                  </div>
                </div>
                <div role="cell" className="col-start-2 font-mono text-sm tabular-nums sm:col-start-auto sm:text-right">
                  {fmtBytes(seq)}
                </div>
              </div>
            )
          })}
          <div className="text-right font-mono text-[10px] text-muted-foreground">
            one sequence of {ctxK}K tokens over {layers} layers, BF16
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
          VHA query weights per layer (hidden {hidden}): training{" "}
          <span className="text-foreground">{fmtM(qTrain)}</span> ({hq / 2} physical heads + 2 Premix
          matrices) · serving after the fold <span className="text-foreground">{fmtM(qServe)}</span> ({hq}{" "}
          heads). The fold keeps the 2-head cache and gives back the training-time saving on the query
          projection.
        </div>
      </div>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value}</span>
      </div>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        className="w-full"
        aria-label={label}
      />
    </label>
  )
}
