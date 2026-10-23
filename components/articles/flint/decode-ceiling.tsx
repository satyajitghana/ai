"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decode at batch 1 is a memory-bandwidth problem: every generated token has to
// stream the active weights and the KV cache through the chip once.
//   ceiling tok/s = bandwidth / (active weight bytes + KV bytes read)
// Weight bytes per token, by tensor group, in MB:
//  - INT4 is measured: summed from the safetensors headers of
//    RecursiveSI/flint-int4 (group-64 affine INT4, 8-bit embeddings, BF16
//    router), routed experts counted at 6 of 256, one embedding row.
//  - BF16 is measured from the RecursiveSI/flint headers (2,515,488,544
//    active parameters x 2 bytes).
//  - Q8_0 is reasoned: the same parameters at 8.5 bits each.
// KV: 14 full-attention layers x 4 KV heads x 128 dims x (K+V) x 2 bytes =
// 28,672 bytes per token of context, plus 35 sliding layers capped at 513
// positions (about 36.8 MB). Both are computed from config.json.
const FORMATS = {
  int4: { label: "INT4 (MLX, measured)", experts: 499.0, attn: 520.3, head: 173.0, other: 258.5, fileGB: 22.57 },
  q8: { label: "Q8_0 (reasoned)", experts: 942.5, attn: 982.7, head: 326.7, other: 420.8, fileGB: 42.3 },
  bf16: { label: "BF16 (measured)", experts: 1774.2, attn: 1849.7, head: 615.0, other: 792.1, fileGB: 79.58 },
} as const
type FormatKey = keyof typeof FORMATS

// Vendor bandwidth specs (GB/s) and the memory size used here. RTX Spark is the
// N1X part: about 300 GB/s from LPDDR5X-9400 on a 256-bit bus, as reported;
// Recursive does not state it.
const DEVICES = [
  { key: "m4pro", label: "M4 Pro 48 GB", bw: 273, mem: 48 },
  { key: "spark", label: "RTX Spark 64 GB", bw: 300, mem: 64 },
  { key: "m4max", label: "M4 Max 128 GB", bw: 546, mem: 128 },
  { key: "4090", label: "RTX 4090 24 GB", bw: 1008, mem: 24 },
  { key: "5090", label: "RTX 5090 32 GB", bw: 1792, mem: 32 },
] as const
type DeviceKey = (typeof DEVICES)[number]["key"]

const CTX_K = [1, 2, 4, 8, 16, 32, 64, 128, 252] as const
// Read off the rec README's throughput.svg (M4 Pro 48 GB, 4-bit weights,
// five runs per context, prefill excluded).
const REC = [131.2, 128.3, 123.0, 113.7, 99.0, 82.4, 61.7, 39.1, 22.6]
const LLAMA = [88.0, 85.9, 83.7, 79.5, 71.4, 58.9, 42.9, 24.2, 8.6]

const KV_FULL_PER_TOKEN = 28672 // bytes
const KV_SWA_MB = 36.77 // 35 layers x 513 positions x 2,048 bytes

function kvMB(ctxK: number) {
  return (KV_FULL_PER_TOKEN * ctxK * 1024) / 1e6 + KV_SWA_MB
}

const ACCENT = "oklch(0.62 0.17 45)"
const MUTED = "oklch(0.6 0.02 260)"
const PARTS = [
  { k: "experts", label: "6 routed experts x 47", c: "oklch(0.62 0.17 45)" },
  { k: "attn", label: "attention, 49 layers", c: "oklch(0.55 0.12 250)" },
  { k: "head", label: "output head", c: "oklch(0.6 0.15 330)" },
  { k: "other", label: "shared experts, dense, router", c: "oklch(0.6 0.1 160)" },
  { k: "kv", label: "KV cache read", c: "oklch(0.5 0.03 260)" },
] as const

export function DecodeCeiling() {
  const [fmt, setFmt] = useState<FormatKey>("int4")
  const [dev, setDev] = useState<DeviceKey>("m4pro")
  const [ci, setCi] = useState(0)
  const [eff, setEff] = useState(73)

  const f = FORMATS[fmt]
  const d = DEVICES.find((x) => x.key === dev)!
  const ctxK = CTX_K[ci]
  const weightsMB = f.experts + f.attn + f.head + f.other
  const kv = kvMB(ctxK)
  const totalMB = weightsMB + kv
  const ceiling = (d.bw * 1000) / totalMB
  const est = (ceiling * eff) / 100
  const residentGB = f.fileGB + (KV_FULL_PER_TOKEN * ctxK * 1024 + KV_SWA_MB * 1e6) / 1e9
  const fits = residentGB <= d.mem * 0.85
  const showRef = dev === "m4pro" && fmt === "int4"

  const segs = PARTS.map((p) => ({ ...p, mb: p.k === "kv" ? kv : f[p.k as Exclude<typeof p.k, "kv">] }))

  // chart: throughput vs context, x evenly spaced (each step doubles)
  const W = 640
  const H = 220
  const L = 40
  const R = 14
  const T = 12
  const B = 30
  const yMax = Math.max(220, ...CTX_K.map((c) => ((d.bw * 1000) / (weightsMB + kvMB(c))) * 1.05))
  const xs = (i: number) => L + (i * (W - L - R)) / (CTX_K.length - 1)
  const ys = (v: number) => T + (H - T - B) * (1 - Math.min(v, yMax) / yMax)
  const curve = (scale: number) =>
    CTX_K.map((c, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(((d.bw * 1000) / (weightsMB + kvMB(c))) * scale).toFixed(1)}`).join(" ")
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round((yMax * t) / 10) * 10)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">decode ceiling = bandwidth ÷ bytes read per token</span>
        <span className="font-mono text-[10px] text-muted-foreground">batch 1, prefill excluded</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {DEVICES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setDev(x.key)}
              aria-pressed={dev === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                dev === x.key ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} · {x.bw} GB/s
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FORMATS) as FormatKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFmt(k)}
              aria-pressed={fmt === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                fmt === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {FORMATS[k].label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px] text-muted-foreground">
            context already in the cache: <span className="text-foreground">{ctxK}K tokens</span>
            <Range min={0} max={CTX_K.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} accent={ACCENT} className="mt-1 w-full" />
          </label>
          <label className="block font-mono text-[11px] text-muted-foreground">
            share of peak bandwidth the engine achieves: <span className="text-foreground">{eff}%</span>
            <Range min={30} max={100} step={1} value={eff} onChange={(e) => setEff(Number(e.target.value))} accent={ACCENT} className="mt-1 w-full" />
          </label>
        </div>

        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">bytes read per generated token: {(totalMB / 1000).toFixed(2)} GB</div>
          <div className="flex h-4 w-full overflow-hidden rounded">
            {segs.map((s) => (
              <div key={s.k} style={{ width: `${((s.mb / totalMB) * 100).toFixed(2)}%`, background: s.c }} title={`${s.label}: ${s.mb.toFixed(0)} MB`} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {segs.map((s) => (
              <span key={s.k} className="font-mono text-[10px] text-muted-foreground">
                <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: s.c }} />
                {s.label} {s.mb.toFixed(0)} MB
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          {[
            { l: "ceiling at 100%", v: `${ceiling.toFixed(0)} tok/s`, c: "currentColor" },
            { l: `estimate at ${eff}%`, v: `${est.toFixed(0)} tok/s`, c: ACCENT },
            {
              l: "rec, published, M4 Pro",
              v: showRef ? `${REC[ci].toFixed(1)} tok/s` : "n/a",
              c: showRef ? "currentColor" : MUTED,
            },
            {
              l: `weights + KV vs ${d.mem} GB`,
              v: `${residentGB.toFixed(1)} GB ${fits ? "fits" : "tight / no"}`,
              c: fits ? "oklch(0.55 0.16 155)" : "oklch(0.58 0.19 27)",
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              {`Decode throughput against context length for ${f.label} on ${d.label}. A solid line is the bandwidth ceiling, a dashed line is that ceiling times ${eff} percent, and dots are the throughput Recursive published for its rec engine and for llama.cpp on an M4 Pro.`}
            </title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={L - 6} y={ys(t) + 3} fontSize={9} textAnchor="end" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                  {t}
                </text>
              </g>
            ))}
            {CTX_K.map((c, i) => (
              <text key={c} x={xs(i)} y={H - 12} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
                {c}K
              </text>
            ))}
            <text x={W - R} y={H - 1} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              context (each step doubles) · tok/s
            </text>
            <path d={curve(1)} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
            <path d={curve(eff / 100)} fill="none" stroke={ACCENT} strokeWidth={2} strokeDasharray="5 4" />
            {REC.map((v, i) => (
              <circle key={`r${i}`} cx={xs(i)} cy={ys(v)} r={3.5} fill={ACCENT} />
            ))}
            {LLAMA.map((v, i) => (
              <circle key={`l${i}`} cx={xs(i)} cy={ys(v)} r={3} fill="none" stroke={MUTED} strokeWidth={1.5} />
            ))}
            <line x1={xs(ci)} x2={xs(ci)} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="2 3" />
          </svg>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Solid: ceiling for the selected chip and format. Dashed: ceiling × {eff}%. Filled dots: rec on M4 Pro, INT4; hollow:
          llama.cpp on the same Mac (both read off the rec README chart, and both always for M4 Pro). Bandwidths are vendor specs;
          RTX Spark’s is reported, not stated by Recursive. “Fits” means weights plus KV within 85% of memory.
        </p>
      </div>
    </figure>
  )
}
