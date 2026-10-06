"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decode-speed ceiling for a routed MoE whose experts live in system RAM.
//
// One decode pass reads the always-used ("dense") weights once from VRAM, then
// each token's routed experts. Experts already cached in VRAM are read at the
// 3090's 936 GB/s; the rest are read where they live, by the CPU, at the RAM
// bus's peak times the share of that peak the CPU kernel actually reaches.
// The GPU's hits and the CPU's misses overlap, so the expert term is the
// slower of the two:
//
//   t = D / 936 + max( L·h·E / 936 , L·(1−h)·E / (B·eff) )      tok/s = L / t
//
//   E   GB of routed-expert weights one token reads
//       = layers × top-k × 3 × hidden × expert width × bpw / 8
//   D   GB of dense weights read per pass (reasoned, see the article)
//   h   share of routed reads served from VRAM (the cache hit rate)
//   B   peak RAM bandwidth; eff the share of it the CPU kernel reaches
//   L   tokens committed per pass (1 without speculative decoding)
//
// The PCIe row sends every miss over a ~25 GB/s link instead (no CPU tier).
// It assumes no two tokens of a pass share an expert, and ignores attention
// compute, launch overhead and the CPU/GPU handshake: it is a bandwidth
// ceiling, not a prediction.
//
// Model constants come from each config.json on Hugging Face:
//   DeepSeek-V4.1-Flash: 40 layers, top-6 of 384, hidden 5120, width 2304
//   Qwen3.8-Flash-Next:  48 layers, top-10 of 512, hidden 2560, width 640

type ModelKey = "ds" | "qwen"

const MODELS: Record<
  ModelKey,
  { label: string; layers: number; topk: number; hidden: number; width: number; dense: number }
> = {
  ds: { label: "DeepSeek-V4.1-Flash", layers: 40, topk: 6, hidden: 5120, width: 2304, dense: 6.94 },
  qwen: { label: "Qwen3.8-Flash-Next", layers: 48, topk: 10, hidden: 2560, width: 640, dense: 3.5 },
}

const VRAM = 936

const BUSES = [
  { key: "d4x2", label: "DDR4-3200, 2 channels", gbs: 51.2, pcie: false },
  { key: "d5x2", label: "DDR5-5200, 2 channels", gbs: 83.2, pcie: false },
  { key: "d4x4", label: "DDR4-3200, 4 channels", gbs: 102.4, pcie: false },
  { key: "d4x8", label: "DDR4-3200, 8 channels", gbs: 204.8, pcie: false },
  { key: "pcie", label: "no CPU tier: misses over PCIe 4.0", gbs: 25, pcie: true },
]

type Params = { model: ModelKey; bpw: number; h: number; eff: number; l: number }

type Preset = {
  key: string
  label: string
  p: Params
  marks: { bus: string; v: number; label: string }[]
}

const PRESETS: Preset[] = [
  {
    key: "bus",
    label: "DeepSeek · bus only",
    p: { model: "ds", bpw: 3.0, h: 0, eff: 1, l: 1 },
    marks: [{ bus: "pcie", v: 4.1, label: "D030 measured 4.10" }],
  },
  {
    key: "d107",
    label: "DeepSeek · 0xSero D107",
    p: { model: "ds", bpw: 3.0, h: 0.41, eff: 0.32, l: 1 },
    marks: [{ bus: "d4x8", v: 21.34, label: "D107 measured 21.34" }],
  },
  {
    key: "fp4",
    label: "DeepSeek · native FP4",
    p: { model: "ds", bpw: 4.25, h: 0, eff: 1, l: 1 },
    marks: [],
  },
  {
    key: "nmv",
    label: "Qwen · IQ3_S + MTP (video)",
    p: { model: "qwen", bpw: 3.5, h: 0.78, eff: 0.3, l: 3.29 },
    marks: [{ bus: "d5x2", v: 97, label: "video shows ~97" }],
  },
]

function expertGB(m: ModelKey, bpw: number) {
  const c = MODELS[m]
  return (c.layers * c.topk * 3 * c.hidden * c.width * bpw) / 8 / 1e9
}

function ceiling(p: Params, gbs: number, pcie: boolean) {
  const e = expertGB(p.model, p.bpw)
  const dense = (MODELS[p.model].dense / VRAM) * 1000
  const hit = ((p.l * p.h * e) / VRAM) * 1000
  const slow = pcie ? gbs : gbs * p.eff
  const miss = p.h >= 1 ? 0 : ((p.l * (1 - p.h) * e) / slow) * 1000
  const ms = dense + Math.max(hit, miss)
  return { ms, tps: (p.l / ms) * 1000, missBound: miss > hit }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-36 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
      <span className="w-14 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

export function OffloadCeiling() {
  const [key, setKey] = useState("d107")
  const [p, setP] = useState<Params>(PRESETS[1].p)
  const preset = PRESETS.find((x) => x.key === key)
  const marks = preset?.marks ?? []

  const set = (k: "bpw" | "h" | "eff" | "l") => (v: number) => {
    setKey("")
    setP((old) => ({ ...old, [k]: v }))
  }

  const e = expertGB(p.model, p.bpw)
  const rows = BUSES.map((b) => ({ ...b, ...ceiling(p, b.gbs, b.pcie) }))
  const peak = Math.max(...rows.map((r) => r.tps), ...marks.map((m) => m.v), 1)
  const scale = (v: number) => `${Math.min(100, (v / peak) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decode ceiling with routed experts in system RAM · one RTX 3090 · reasoned
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              setKey(s.key)
              setP(s.p)
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              s.key === key
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">model</span>
          {(Object.keys(MODELS) as ModelKey[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setKey("")
                setP((old) => ({ ...old, model: m }))
              }}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                p.model === m ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {MODELS[m].label}
            </button>
          ))}
        </div>
        <Slider label="bits per expert weight" value={p.bpw} min={2} max={8} step={0.05} fmt={(v) => v.toFixed(2)} onChange={set("bpw")} />
        <Slider label="reads served by VRAM" value={p.h} min={0} max={0.95} step={0.01} fmt={(v) => `${(v * 100).toFixed(0)}%`} onChange={set("h")} />
        <Slider label="CPU share of RAM peak" value={p.eff} min={0.1} max={1} step={0.01} fmt={(v) => `${(v * 100).toFixed(0)}%`} onChange={set("eff")} />
        <Slider label="tokens per pass" value={p.l} min={1} max={4} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("l")} />
      </div>

      <div className="space-y-3 px-4 py-4">
        {rows.map((r) => {
          const own = marks.filter((m) => m.bus === r.key)
          return (
            <div key={r.key} className="text-xs">
              <div className="mb-1 flex justify-between gap-2 font-mono">
                <span className="text-muted-foreground">
                  {r.label}
                  {r.pcie ? "" : ` · ${r.gbs} GB/s`}
                </span>
                <span className="tabular-nums">
                  {r.tps.toFixed(1)} tok/s
                  <span className="text-muted-foreground"> · {r.ms.toFixed(1)} ms/pass</span>
                </span>
              </div>
              <div className="relative h-3 rounded-sm bg-muted">
                <div
                  className="h-3 rounded-sm"
                  style={{
                    width: scale(r.tps),
                    background: r.missBound ? "oklch(0.62 0.15 45)" : "oklch(0.55 0.16 250)",
                  }}
                />
                {own.map((m) => (
                  <div
                    key={m.label}
                    className="absolute -top-0.5 h-4 w-0.5 bg-foreground"
                    style={{ left: scale(m.v) }}
                    title={m.label}
                  />
                ))}
              </div>
              {own.length > 0 ? (
                <div className="mt-0.5 font-mono text-[10.5px] text-muted-foreground">
                  {own.map((m) => m.label).join(" · ")} (black tick)
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        One token reads {e.toFixed(2)} GB of routed experts at {p.bpw.toFixed(2)} bits per weight
        ({MODELS[p.model].label}). Orange bars are bound by the RAM side, blue by VRAM. A ceiling
        assumes no two tokens in a pass share an expert and ignores compute, handshakes and the
        n-gram tables; measured numbers sit below it.
      </figcaption>
    </figure>
  )
}
