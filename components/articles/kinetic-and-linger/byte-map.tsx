"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where the bytes of Qwen3.8-Flash-Next live on one PC running Strata, and
// what one verify window has to read from each place.
//
// Byte counts are from the GGUF headers of ISTA-DASLab's GSQ-RCO packs, read
// by range request (shard 1 of each; shard 2 is the 28.80 GB n-gram table in
// every pack). "Non-expert" is everything in shard 1 except the routed
// experts; "dense read" is that minus the token embedding, which a token
// reads one row of. 24,576 experts = 512 per layer x 48 layers; a token routes
// 10 per layer, so 480 expert reads a token.
//
// The model, stated so it can be argued with:
//   VRAM   = non-expert + runtime (KV, MTP head, buffers) + expert cache
//   hit    = (cached / 24,576) ^ 0.33     share of routed reads the card holds
//   RAM    holds every expert if experts + 10 GB fit, else only the ones the
//          card does not hold, as far as RAM - 10 GB goes; the rest come
//          off the SSD
//   window = τ tokens; the card reads dense + its hits at 70% of BW; the CPU
//            computes the misses from RAM at R, and reads SSD misses at 3 GB/s;
//            both run at once, so the window takes the longer of the two
//   tok/s  = τ / window
// The runtime default of 3.0 GB is fitted so a 12 GB card holds the 3,872
// Q2_0 experts Strata's changelog reports; the 0.33 skew to the 53.6% hit
// rate it reports for ~16% cached; R = 15 GB/s to the community RTX 3060's
// 45.5 tok/s. Distinct experts in a window are taken to grow with τ.

type Quant = { key: string; label: string; experts: number; nonExpert: number; dense: number; perMB: number }
const QUANTS: Quant[] = [
  { key: "q2", label: "Q2_0", experts: 33.975, nonExpert: 3.638, dense: 3.365, perMB: 1.3825 },
  { key: "iq2xs", label: "IQ2_XS", experts: 35.455, nonExpert: 3.76, dense: 3.422, perMB: 1.4427 },
  { key: "iq3xxs", label: "IQ3_XXS", experts: 42.913, nonExpert: 4.116, dense: 3.843, perMB: 1.7461 },
  { key: "iq3s", label: "IQ3_S", experts: 50.292, nonExpert: 4.514, dense: 4.176, perMB: 2.0464 },
]
const NGRAM = 28.8
const N_EXPERTS = 24576
const READS = 480
const SKEW = 0.33
const OS_GB = 10
const SSD_GBS = 3
const ETA = 0.7

type Preset = { key: string; label: string; q: string; vram: number; ram: number; bw: number; note: string }
const PRESETS: Preset[] = [
  {
    key: "comm",
    label: "RTX 3060 12 GB + 64 GB, IQ2_XS",
    q: "iq2xs",
    vram: 12,
    ram: 64,
    bw: 360,
    note: "The community run behind the 45.5 tok/s: a 4,096-token prompt, MTP drafting on, three runs (44.1 to 46.3).",
  },
  {
    key: "tier",
    label: "12 GB + 32 GB, Q2_0",
    q: "q2",
    vram: 12,
    ram: 32,
    bw: 360,
    note: "Linger's own tier row: 21.3 tok/s on short prompts, on a 96 GB card held to 12 GB with memory capped at 28 GB.",
  },
  {
    key: "3090",
    label: "RTX 3090 24 GB + 64 GB, IQ2_XS",
    q: "iq2xs",
    vram: 24,
    ram: 64,
    bw: 936,
    note: "The machine Linger's validated Flash-Next recipe is sized for: 19.57 GiB of VRAM, 48 GiB of RAM at least.",
  },
]

const fmt = (v: number, d = 1) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  shown: string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-40 shrink-0 text-muted-foreground">{props.label}</span>
      <Range
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={props.label}
        className="w-full"
      />
      <span className="w-16 shrink-0 text-right font-mono tabular-nums">{props.shown}</span>
    </label>
  )
}

const C_DENSE = "oklch(0.55 0.16 250)"
const C_RUN = "oklch(0.75 0.06 250)"
const C_CACHE = "oklch(0.62 0.17 45)"
const C_RAM = "oklch(0.60 0.12 160)"
const C_OS = "oklch(0.82 0.04 160)"
const C_SSD = "oklch(0.58 0.19 28)"
const C_NG = "oklch(0.70 0.05 300)"

export function ByteMap() {
  const [presetKey, setPresetKey] = useState("comm")
  const [q, setQ] = useState("iq2xs")
  const [vram, setVram] = useState(12)
  const [ram, setRam] = useState(64)
  const [bw, setBw] = useState(360)
  const [runtime, setRuntime] = useState(3)
  const [cpuRate, setCpuRate] = useState(15)
  const [tau, setTau] = useState(2.8)
  const quant = QUANTS.find((x) => x.key === q) ?? QUANTS[1]
  const preset = PRESETS.find((x) => x.key === presetKey) ?? PRESETS[0]

  const cacheGB = Math.max(0, vram - quant.nonExpert - runtime)
  const cached = Math.min(N_EXPERTS, Math.floor((cacheGB * 1000) / quant.perMB))
  const frac = cached / N_EXPERTS
  const hit = frac >= 1 ? 1 : frac <= 0 ? 0 : mpow(frac, SKEW)
  const fitsGpu = vram >= quant.nonExpert + runtime

  const budget = Math.max(0, ram - OS_GB)
  const allInRam = budget >= quant.experts
  const needRam = allInRam ? quant.experts : quant.experts * (1 - frac)
  const inRam = Math.min(needRam, budget)
  const ramShare = needRam > 0 ? inRam / needRam : 1
  const onSsd = needRam - inRam

  const eTok = (READS * quant.perMB) / 1000
  const hitGB = tau * eTok * hit
  const missGB = tau * eTok * (1 - hit)
  const ssdGB = missGB * (1 - ramShare)
  const tGpu = (quant.dense + hitGB) / (ETA * bw)
  const tCpu = missGB / cpuRate + ssdGB / SSD_GBS
  const t = Math.max(tGpu, tCpu)
  const toks = fitsGpu ? tau / t : 0

  const W = 720
  const L = 92
  const SCALE = (W - L - 12) / 80
  const rows = [
    {
      name: `VRAM ${vram} GB`,
      parts: [
        { label: "non-expert", v: quant.nonExpert, c: C_DENSE },
        { label: "runtime", v: runtime, c: C_RUN },
        { label: "expert cache", v: cacheGB, c: C_CACHE },
      ],
    },
    {
      name: `RAM ${ram} GB`,
      parts: [
        { label: "experts", v: inRam, c: C_RAM },
        { label: "OS + apps", v: Math.min(OS_GB, ram), c: C_OS },
      ],
    },
    {
      name: "SSD",
      parts: [
        { label: "n-gram table", v: NGRAM, c: C_NG },
        { label: "experts", v: onSsd, c: C_SSD },
      ],
    },
  ]

  const ms = (v: number) => fmt(v * 1000, 1)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3.8-Flash-Next on one PC: where the bytes sit, and what one window reads
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPresetKey(p.key)
              setQ(p.q)
              setVram(p.vram)
              setRam(p.ram)
              setBw(p.bw)
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              p.key === presetKey ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="mx-1 text-muted-foreground">·</span>
        {QUANTS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setQ(x.key)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              x.key === q ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 sm:gap-x-6">
        <Slider label="VRAM (GB)" value={vram} min={8} max={32} step={1} shown={String(vram)} onChange={setVram} />
        <Slider label="RAM (GB)" value={ram} min={16} max={128} step={8} shown={String(ram)} onChange={setRam} />
        <Slider label="GPU bandwidth (GB/s)" value={bw} min={250} max={1800} step={2} shown={String(bw)} onChange={setBw} />
        <Slider label="runtime in VRAM (GB)" value={runtime} min={1} max={6} step={0.1} shown={fmt(runtime)} onChange={setRuntime} />
        <Slider label="CPU expert rate R (GB/s)" value={cpuRate} min={5} max={50} step={1} shown={String(cpuRate)} onChange={setCpuRate} />
        <Slider label="tokens per window τ" value={tau} min={1} max={3.2} step={0.1} shown={fmt(tau)} onChange={setTau} />
      </div>

      <div className="px-2 sm:px-4">
        <svg
          viewBox={`0 0 ${W} 132`}
          className="w-full"
          role="img"
          aria-label={`${quant.label} with ${vram} GB of VRAM and ${ram} GB of RAM: ${fmt(cacheGB)} GB of expert cache holds ${cached} of 24,576 experts, about ${fmt(hit * 100, 0)}% of routed reads; ${fmt(inRam)} GB of experts in RAM and ${fmt(onSsd)} GB on the SSD beside the 28.8 GB n-gram table.`}
        >
          {rows.map((r, i) => {
            let acc = 0
            const y = 8 + i * 40
            return (
              <g key={r.name}>
                <text x={0} y={y + 17} fontSize={11} className="fill-foreground font-mono">
                  {r.name}
                </text>
                {r.parts.map((p) => {
                  const x0 = L + acc * SCALE
                  acc += p.v
                  const w = p.v * SCALE
                  return w > 0.5 ? (
                    <g key={p.label}>
                      <rect x={x0} y={y} width={w} height={24} fill={p.c} fillOpacity={0.85} />
                      {w > 70 ? (
                        <text x={x0 + 5} y={y + 16} fontSize={10} fill="white" className="font-mono">
                          {p.label} {fmt(p.v)}
                        </text>
                      ) : null}
                    </g>
                  ) : null
                })}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t px-4 py-3 font-mono text-xs sm:grid-cols-4">
        <div>
          <div className="text-muted-foreground">experts on the card</div>
          <div className="tabular-nums">
            {cached.toLocaleString("en-US")} ({fmt(frac * 100)}%)
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">routed reads it serves</div>
          <div className="tabular-nums">{fmt(hit * 100, 0)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">card / CPU per window</div>
          <div className="tabular-nums">
            {ms(tGpu)} / {ms(tCpu)} ms
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">model says</div>
          <div className="tabular-nums">{fitsGpu ? `${fmt(toks, 0)} tok/s` : "does not fit"}</div>
        </div>
        <div className="col-span-2 sm:col-span-4 text-muted-foreground">
          {allInRam
            ? `Every expert fits in RAM (${fmt(quant.experts)} GB + 10 GB).`
            : `RAM cannot hold ${fmt(quant.experts)} GB of experts + 10 GB: low-RAM mode, ${fmt(onSsd)} GB of experts come off the SSD when routed.`}{" "}
          Per token: {fmt(quant.dense, 2)} GB dense, {fmt(eTok, 2)} GB of routed experts.
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        {preset.note} The speed is a fitted model, not a measurement: it reproduces the two published 12 GB rows and
        nothing else has checked it.
      </figcaption>
    </figure>
  )
}
