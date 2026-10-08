"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Project Maya's three expert tiers as a cost model. A MODEL, not a measurement.
//
// Model dims (summed from the Maya-S v2 GGUF headers, all three shards, read with HTTP range requests):
//   42 MoE layers x 288 routed experts = 12,096 experts, 86.03 GB -> 7.112 MB a blob on average
//   (gate/up IQ2_XXS, down IQ2_S, IQ3_XXS in layers 3-6 and 41-44).
//   Every other trunk tensor (attention, KDA, shared experts, the three dense layers, router, mHC, output head) is
//   7.13 GB and is read once per token. The token embedding is one row a token and the NextN block is left out.
//   A token routes 8 experts in each of 42 layers: 336 lookups.
//
// The tiers (src/core/glm_fast_path.cu): every layer gets its own VRAM partition; the RAM tier is pinned host
// memory sized from MemAvailable minus 6 GB of headroom (:681); whatever fits nowhere is pread from the GGUF on
// the SSD when a route asks for it (:1506-1700). An expert pulled from RAM is copied by the GPU over PCIe
// (glm_fast.cu:2092, "the PCIe pull measured 11.5 GB/s") and computed there; the device waits for disk reads.
//
// Popularity: within a layer the experts' routing shares follow a Zipf law with exponent s. s = 0.88 is the
// least-squares fit to the engine's own single-GPU sweep (bench/results/2026-10-05-glm-single-gpu: 5.9%, 10.8%,
// 21.2% and 30.9% of experts in VRAM served about 40%, 55%, 72% and 78% of lookups). That sweep mixed three
// prompts in short runs; one conversation is narrower, and the two-GPU box measured 97-98% at 70% held, which a
// Zipf law only reaches near s = 1.3. The tiers are filled best-first, as a perfect frequency cache would be.
//
// Time per token:
//   GPU   = (dense + 336 x blob) / (HBM x 0.48)      0.48: the share of peak the decode reached on the V100s
//                                                      ("~11 ms of compute" per half for ~9.5 GB a token)
//   RAM   = n_ram x blob / PCIe  (or, with the CPU lane, at the combined rate of both lanes)
//   disk  = n_disk x blob / SSD
//   one GPU, or two GPUs token by token:  t = GPU + RAM + disk
//   two GPUs with the NextN draft:        t = (GPU + RAM + disk) x (1 - a/2) + 5 ms
//     The head half runs the draft while the tail finishes, so an accepted draft overlaps the halves. The 5 ms
//     (draft, state backup, hand-off) is fitted to the engine's own 38.1 -> 25.0 ms/token at 97% acceptance.
// Overheads before the first expert slot: 8 GB on one GPU, 5 GB on each of two (all dense weights on one card,
// half on each; the IQ1_S sweep measured 6.7 GB and ~4 GB, and Maya-S's Q6_K dense tensors are larger).
// RAM tier = RAM - 8 GB (the box with 30 GB got ~22 GB).

const N_EXP = 288
const N_LAYERS = 42
const TOP_K = 8
const LOOKUPS = N_LAYERS * TOP_K
const BLOB_GB = 0.007112
const DENSE_GB = 7.13
const EFF = 0.48
const SPEC_FIX_MS = 5
const RAM_KEEP_GB = 8

type Params = {
  gpus: 1 | 2
  vram: number
  ram: number
  hbm: number
  pcie: number
  ssd: number
  cpu: number
  skew: number
  acc: number
  mtp: boolean
}

type Preset = { key: string; label: string; p: Params; ref: string }

const PRESETS: Preset[] = [
  {
    key: "launch",
    label: "2x V100 32 GB · 30 GB RAM",
    p: { gpus: 2, vram: 32, ram: 30, hbm: 900, pcie: 11.5, ssd: 2.3, cpu: 0, skew: 0.88, acc: 0.9, mtp: true },
    ref: "reported: up to 40 tok/s; 28.0 over five chat topics",
  },
  {
    key: "uranus",
    label: "1x V100 32 GB · 64 GB RAM",
    p: { gpus: 1, vram: 32, ram: 64, hbm: 900, pcie: 11.5, ssd: 5.9, cpu: 0.36, skew: 0.88, acc: 0, mtp: false },
    ref: "reported: up to 19 tok/s (README)",
  },
  {
    key: "one30",
    label: "1x V100 32 GB · 30 GB RAM",
    p: { gpus: 1, vram: 32, ram: 30, hbm: 900, pcie: 11.5, ssd: 2.3, cpu: 0, skew: 0.88, acc: 0, mtp: false },
    ref: "reported: 5.8-7.4 tok/s (IQ1_S pack, 128-token runs)",
  },
  {
    key: "pair24",
    label: "2x 24 GB · PCIe 4 · 64 GB RAM",
    p: { gpus: 2, vram: 24, ram: 64, hbm: 936, pcie: 22, ssd: 5.9, cpu: 0, skew: 0.88, acc: 0.9, mtp: true },
    ref: "no measurement: a what-if",
  },
]

// the measured points the skew was fitted to (fraction of the 12,096 experts in VRAM, share of lookups served there)
const MEASURED: { f: number; h: number; t: string }[] = [
  { f: 714 / 12096, h: 0.395, t: "12 GB" },
  { f: 1302 / 12096, h: 0.545, t: "16 GB" },
  { f: 2562 / 12096, h: 0.725, t: "24 GB" },
  { f: 3738 / 12096, h: 0.78, t: "32 GB" },
  { f: 8458 / 12096, h: 0.98, t: "2x32 GB" },
]

const C_VRAM = "oklch(0.62 0.15 285)"
const C_RAM = "oklch(0.70 0.14 75)"
const C_SSD = "oklch(0.60 0.17 30)"
const C_FIX = "oklch(0.70 0.02 250)"

// cumulative Zipf shares: cum[k] = share of a layer's lookups served by its k most-used experts
function cumulative(s: number): number[] {
  const w: number[] = []
  let tot = 0
  for (let i = 1; i <= N_EXP; i++) {
    const v = mpow(i, -s)
    w.push(v)
    tot += v
  }
  const cum = [0]
  let run = 0
  for (const v of w) {
    run += v
    cum.push(run / tot)
  }
  return cum
}

function shareAt(cum: number[], k: number): number {
  if (k <= 0) return 0
  if (k >= N_EXP) return 1
  const lo = Math.floor(k)
  const fr = k - lo
  return cum[lo] + fr * (cum[lo + 1] - cum[lo])
}

function model(p: Params, cum: number[]) {
  const over = p.gpus === 2 ? 5 : 8
  const slots = Math.min(N_EXP * N_LAYERS, (p.gpus * Math.max(0, p.vram - over)) / BLOB_GB)
  const ramSlots = Math.max(0, p.ram - RAM_KEEP_GB) / BLOB_GB
  const kv = slots / N_LAYERS
  const kr = Math.min(N_EXP - kv, ramSlots / N_LAYERS)
  const hv = shareAt(cum, kv)
  const hvr = shareAt(cum, kv + kr)
  const hr = hvr - hv
  const hd = 1 - hvr
  const nr = LOOKUPS * hr
  const nd = LOOKUPS * hd
  const tg = ((DENSE_GB + LOOKUPS * BLOB_GB) / (p.hbm * EFF)) * 1000
  const tPull = (BLOB_GB / p.pcie) * 1000
  const tExp = p.cpu > 0 ? 1 / (1 / tPull + 1 / p.cpu) : tPull
  const tr = nr * tExp
  const td = nd * (BLOB_GB / p.ssd) * 1000
  const plain = tg + tr + td
  const spec = p.gpus === 2 && p.mtp
  const total = spec ? plain * (1 - p.acc / 2) + SPEC_FIX_MS : plain
  // the breakdown: with the draft overlapping the halves, each part shrinks by the same factor
  const scale = spec ? (total - SPEC_FIX_MS) / plain : 1
  return {
    slots,
    ramSlots: kr * N_LAYERS,
    fv: slots / (N_EXP * N_LAYERS),
    fr: (kr * N_LAYERS) / (N_EXP * N_LAYERS),
    hv,
    hr,
    hd,
    nv: LOOKUPS * hv,
    nr,
    nd,
    tg: tg * scale,
    tr: tr * scale,
    td: td * scale,
    fix: spec ? SPEC_FIX_MS : 0,
    total,
    tps: 1000 / total,
  }
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
  accent,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  accent?: string
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range
        min={min}
        max={max}
        step={step}
        value={value}
        accent={accent}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
      />
      <span className="w-20 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

// hit-rate curve geometry
const CW = 360
const CH = 210
const CL = 40
const CR = 12
const CT = 12
const CB = 30

export function TierSimulator() {
  const [key, setKey] = useState("launch")
  const [p, setP] = useState<Params>(PRESETS[0].p)
  const cum = useMemo(() => cumulative(p.skew), [p.skew])
  const r = model(p, cum)
  const preset = PRESETS.find((s) => s.key === key)
  const set = (k: keyof Params) => (v: number) => {
    setKey("")
    setP((o) => ({ ...o, [k]: v }))
  }

  const pw = CW - CL - CR
  const ph = CH - CT - CB
  const px = (f: number) => CL + f * pw
  const py = (h: number) => CT + (1 - h) * ph
  let path = ""
  for (let i = 0; i <= 96; i++) {
    const f = i / 96
    const h = shareAt(cum, f * N_EXP)
    path += `${i === 0 ? "M" : "L"}${px(f).toFixed(1)},${py(h).toFixed(1)} `
  }

  const segs = [
    { t: "GPU reads", v: r.tg, c: C_VRAM },
    { t: "PCIe pulls", v: r.tr, c: C_RAM },
    { t: "SSD reads", v: r.td, c: C_SSD },
    { t: "draft + hand-off", v: r.fix, c: C_FIX },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Maya-S across VRAM, RAM and SSD · a cost model from the GGUF&apos;s sizes, not a measurement
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

      <div className="grid gap-4 px-4 pt-4 md:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            share of a layer&apos;s lookups served by its most-used experts
          </div>
          <svg
            viewBox={`0 0 ${CW} ${CH}`}
            className="w-full"
            role="img"
            aria-label={`Hit-rate curve for routing skew ${p.skew.toFixed(2)}. VRAM holds ${(r.fv * 100).toFixed(0)}% of the experts and serves ${(r.hv * 100).toFixed(1)}% of lookups; VRAM and RAM together hold ${((r.fv + r.fr) * 100).toFixed(0)}% and serve ${((r.hv + r.hr) * 100).toFixed(1)}%. Dots mark the engine's measured hit rates.`}
          >
            <rect x={px(0)} y={CT} width={px(r.fv) - px(0)} height={ph} fill={C_VRAM} fillOpacity={0.12} />
            <rect x={px(r.fv)} y={CT} width={px(r.fv + r.fr) - px(r.fv)} height={ph} fill={C_RAM} fillOpacity={0.14} />
            <rect
              x={px(r.fv + r.fr)}
              y={CT}
              width={Math.max(0, px(1) - px(r.fv + r.fr))}
              height={ph}
              fill={C_SSD}
              fillOpacity={0.1}
            />
            {[0, 0.25, 0.5, 0.75, 1].map((g) => (
              <g key={g}>
                <line x1={px(0)} y1={py(g)} x2={px(1)} y2={py(g)} stroke="var(--border)" strokeDasharray="2 4" />
                <text x={CL - 6} y={py(g) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                  {(g * 100).toFixed(0)}%
                </text>
                <text x={px(g)} y={CH - 14} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
                  {(g * 100).toFixed(0)}%
                </text>
              </g>
            ))}
            <text x={px(0.5)} y={CH - 2} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
              experts held (of 12,096)
            </text>
            <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={1.6} />
            {MEASURED.map((m) => (
              <g key={m.t}>
                <circle cx={px(m.f)} cy={py(m.h)} r={3.2} fill="var(--background)" stroke={C_SSD} strokeWidth={1.5} />
              </g>
            ))}
            <line x1={px(r.fv)} y1={CT} x2={px(r.fv)} y2={CT + ph} stroke={C_VRAM} strokeWidth={1.4} />
            <circle cx={px(r.fv)} cy={py(r.hv)} r={4} fill={C_VRAM} />
            <text x={px(r.fv) + 5} y={py(r.hv) + 12} fontSize={10} className="fill-foreground font-mono">
              VRAM {(r.hv * 100).toFixed(1)}%
            </text>
          </svg>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            open dots: hit rates the engine measured (IQ1_S pack, one V100 at 12-32 GB, and both cards)
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">where the 336 lookups of a token go</div>
            <div className="flex h-6 w-full overflow-hidden rounded">
              <div style={{ width: `${(r.hv * 100).toFixed(2)}%`, background: C_VRAM }} />
              <div style={{ width: `${(r.hr * 100).toFixed(2)}%`, background: C_RAM }} />
              <div style={{ width: `${(r.hd * 100).toFixed(2)}%`, background: C_SSD }} />
            </div>
            <div className="mt-1 grid grid-cols-3 font-mono text-[11px] tabular-nums">
              <span>VRAM {r.nv.toFixed(0)}</span>
              <span>RAM {r.nr.toFixed(1)}</span>
              <span>SSD {r.nd.toFixed(1)}</span>
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">milliseconds per token</div>
            <div className="flex h-6 w-full overflow-hidden rounded">
              {segs.map((s) =>
                s.v > 0 ? (
                  <div
                    key={s.t}
                    title={`${s.t}: ${s.v.toFixed(1)} ms`}
                    style={{ width: `${((s.v / r.total) * 100).toFixed(2)}%`, background: s.c }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-3 font-mono text-[11px] tabular-nums">
              {segs.map((s) => (
                <span key={s.t}>
                  <span className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: s.c }} />
                  {s.t} {s.v.toFixed(1)}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
            <div>
              <div className="text-muted-foreground">model</div>
              <div className="text-xl tabular-nums">{r.tps.toFixed(1)} tok/s</div>
            </div>
            <div>
              <div className="text-muted-foreground">this machine</div>
              <div className="text-[11px] leading-snug">{preset ? preset.ref : "your settings"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 border-t px-4 py-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0 font-mono text-muted-foreground">GPUs</span>
          {[1, 2].map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                setKey("")
                setP((o) => ({ ...o, gpus: g as 1 | 2 }))
              }}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                p.gpus === g ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {g}
            </button>
          ))}
          <button
            type="button"
            disabled={p.gpus === 1}
            onClick={() => {
              setKey("")
              setP((o) => ({ ...o, mtp: !o.mtp }))
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] disabled:opacity-40",
              p.gpus === 2 && p.mtp ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
            )}
          >
            draft {p.gpus === 2 && p.mtp ? "on" : "off"}
          </button>
        </div>
        <Slider label="VRAM per GPU" value={p.vram} min={8} max={96} step={1} fmt={(v) => `${v} GB`} onChange={set("vram")} accent={C_VRAM} />
        <Slider label="system RAM" value={p.ram} min={16} max={256} step={2} fmt={(v) => `${v} GB`} onChange={set("ram")} accent={C_RAM} />
        <Slider label="routing skew s" value={p.skew} min={0.6} max={1.5} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("skew")} />
        <Slider label="GPU memory" value={p.hbm} min={300} max={1800} step={10} fmt={(v) => `${v} GB/s`} onChange={set("hbm")} accent={C_VRAM} />
        <Slider label="PCIe pull" value={p.pcie} min={4} max={50} step={0.5} fmt={(v) => `${v} GB/s`} onChange={set("pcie")} accent={C_RAM} />
        <Slider label="SSD read" value={p.ssd} min={0.5} max={12} step={0.1} fmt={(v) => `${v} GB/s`} onChange={set("ssd")} accent={C_SSD} />
        <Slider
          label="CPU lane"
          value={p.cpu}
          min={0}
          max={2}
          step={0.02}
          fmt={(v) => (v > 0 ? `${v.toFixed(2)} ms` : "off")}
          onChange={set("cpu")}
          accent={C_RAM}
        />
        <Slider
          label="draft accepted"
          value={p.acc}
          min={0}
          max={1}
          step={0.01}
          fmt={(v) => `${(v * 100).toFixed(0)}%`}
          onChange={set("acc")}
        />
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        {r.slots.toFixed(0)} expert slots in VRAM and {r.ramSlots.toFixed(0)} in the pinned RAM tier, of 12,096; every
        expert is 7.1 MB on average and 7.13 GB of other weights is read every token. The skew of 0.88 is fitted to the
        engine&apos;s single-GPU sweep, which mixed three prompts; one conversation is narrower, and the two-card box
        measured 97-98% from VRAM, which this curve only reaches near 1.3. The CPU lane is the time one expert takes
        on the host&apos;s cores; the engine splits RAM-tier experts between it and the PCIe pull.
      </figcaption>
    </figure>
  )
}
