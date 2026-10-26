"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A memory ledger for Nanbeige4.3-33B drawn as an isometric tank. Floor area is
// fixed, height is gigabytes: the weights stack from the bottom, the KV cache
// sits on top, and a wireframe tank marks the chosen chip's memory. Everything
// shown is closed-form from the safetensors headers and config.json:
//   KV elements per token = 2 (K and V) x 52 layers x 8 KV heads x 128 = 106,496
//   decode ceiling        = memory bandwidth / (weight bytes + KV bytes read)
// File sizes are the real sizes from the Hugging Face file listings. Chip
// bandwidths are vendor spec-sheet figures typed from memory, not re-measured.
// The isometric projection uses only + - * / (exact), so SSR and the browser
// serialise identical coordinates and no dmath wrapper is needed.

const KV_ELEMS = 2 * 52 * 8 * 128

const QUANTS = [
  { key: "bf16", name: "BF16", gb: 66.237954048, src: "official safetensors, 14 shards" },
  { key: "q8", name: "Q8_0", gb: 35.19512896, src: "bartowski GGUF" },
  { key: "q6", name: "Q6_K", gb: 29.016857728, src: "bartowski GGUF" },
  { key: "q5", name: "Q5_K_M", gb: 25.073368192, src: "bartowski GGUF" },
  { key: "q4", name: "Q4_K_M", gb: 20.788825216, src: "bartowski GGUF" },
  { key: "iq4", name: "IQ4_XS", gb: 18.63504192, src: "bartowski GGUF" },
  { key: "mlx4", name: "MLX 4-bit", gb: 18.630644776, src: "pratikgx MLX, 4 shards" },
  { key: "q3", name: "Q3_K_M", gb: 15.919746176, src: "bartowski GGUF" },
  { key: "iq2", name: "IQ2_M", gb: 12.187167872, src: "bartowski GGUF" },
] as const

// bytes per KV element: f16 = 2, q8_0 = 34/32, q4_0 = 18/32
const KVTYPES = [
  { key: "f16", name: "f16", bpe: 2 },
  { key: "q8", name: "q8_0", bpe: 34 / 32 },
  { key: "q4", name: "q4_0", bpe: 18 / 32 },
] as const

const CHIPS = [
  { key: "3060", name: "RTX 3060 12 GB", bw: 360, mem: 12 },
  { key: "m4pro", name: "M4 Pro 48 GB", bw: 273, mem: 48 },
  { key: "3090", name: "RTX 3090 24 GB", bw: 936, mem: 24 },
  { key: "4090", name: "RTX 4090 24 GB", bw: 1008, mem: 24 },
  { key: "5090", name: "RTX 5090 32 GB", bw: 1792, mem: 32 },
  { key: "m4max", name: "M4 Max 64 GB", bw: 546, mem: 64 },
  { key: "h100", name: "H100 80 GB", bw: 3350, mem: 80 },
] as const

const CTX_K = [4, 8, 16, 32, 64, 128, 256, 512] as const

const C30 = 0.8660254
const DOMAIN = 180 // GB drawn at full height
const HPX = 230
const A = 64 // footprint half-extent in iso units
const OX = 190
const OY = 232

const r1 = (n: number) => Math.round(n * 10) / 10

function iso(x: number, y: number, z: number): string {
  return `${r1(OX + (x - y) * C30)},${r1(OY + (x + y) * 0.5 - z)}`
}

function box(z0: number, z1: number): { top: string; left: string; right: string } {
  return {
    top: [iso(0, 0, z1), iso(A, 0, z1), iso(A, A, z1), iso(0, A, z1)].join(" "),
    left: [iso(0, A, z1), iso(A, A, z1), iso(A, A, z0), iso(0, A, z0)].join(" "),
    right: [iso(A, 0, z1), iso(A, A, z1), iso(A, A, z0), iso(A, 0, z0)].join(" "),
  }
}

const gbH = (gb: number) => (gb / DOMAIN) * HPX

const WCOL = ["oklch(0.7 0.09 190)", "oklch(0.6 0.09 190)", "oklch(0.5 0.08 190)"]
const KCOL = ["oklch(0.78 0.12 70)", "oklch(0.68 0.13 70)", "oklch(0.58 0.12 70)"]
const XCOL = ["oklch(0.72 0.16 25)", "oklch(0.62 0.18 25)", "oklch(0.52 0.16 25)"]

export function MemoryLedger() {
  const [qi, setQi] = useState(4)
  const [ki, setKi] = useState(0)
  const [ci, setCi] = useState(5)
  const [chip, setChip] = useState(2)

  const q = QUANTS[qi]
  const kv = KVTYPES[ki]
  const ctx = CTX_K[ci] * 1024
  const ch = CHIPS[chip]

  const kvBytes = KV_ELEMS * kv.bpe * ctx
  const kvGb = kvBytes / 1e9
  const total = q.gb + kvGb
  const fits = total <= ch.mem
  const ceiling = (ch.bw * 1e9) / (q.gb * 1e9 + kvBytes)
  const perTok = KV_ELEMS * kv.bpe

  const wTop = Math.min(gbH(q.gb), HPX)
  const kTop = Math.min(gbH(total), HPX)
  const cap = Math.min(gbH(ch.mem), HPX)
  const wBox = box(0, wTop)
  const kBox = box(wTop, kTop)
  const over = total > ch.mem
  const capTop = [iso(0, 0, cap), iso(A, 0, cap), iso(A, A, cap), iso(0, A, cap)].join(" ")
  const [c00, c10, c11, c01] = [iso(0, 0, cap), iso(A, 0, cap), iso(A, A, cap), iso(0, A, cap)]
  const [b10, b11, b01] = [iso(A, 0, 0), iso(A, A, 0), iso(0, A, 0)]

  const chipCls = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  const fmt = (n: number, d = 1) => n.toFixed(d)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        memory ledger · 52 layers · 8 KV heads × 128 · {KV_ELEMS.toLocaleString("en-US")} cached values per token
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:p-4">
        <svg
          viewBox="0 0 380 300"
          className="w-full"
          role="img"
          aria-label={`Isometric tank. Weights ${fmt(q.gb)} GB plus KV cache ${fmt(kvGb)} GB is ${fmt(total)} GB against ${ch.mem} GB of memory. ${fits ? "It fits." : "It does not fit."}`}
        >
          <polygon points={[iso(0, 0, 0), iso(A, 0, 0), iso(A, A, 0), iso(0, A, 0)].join(" ")} fill="currentColor" fillOpacity="0.05" />
          <polygon points={wBox.left} fill={WCOL[1]} />
          <polygon points={wBox.right} fill={WCOL[2]} />
          <polygon points={wBox.top} fill={WCOL[0]} />
          {kTop > wTop ? (
            <g>
              <polygon points={kBox.left} fill={KCOL[1]} />
              <polygon points={kBox.right} fill={KCOL[2]} />
              <polygon points={kBox.top} fill={KCOL[0]} />
            </g>
          ) : null}
          <g stroke={over ? XCOL[1] : "currentColor"} strokeOpacity={over ? 0.9 : 0.45} strokeWidth="1.2" strokeDasharray="4 3" fill="none">
            <polygon points={capTop} />
            <line x1={c10.split(",")[0]} y1={c10.split(",")[1]} x2={b10.split(",")[0]} y2={b10.split(",")[1]} />
            <line x1={c11.split(",")[0]} y1={c11.split(",")[1]} x2={b11.split(",")[0]} y2={b11.split(",")[1]} />
            <line x1={c01.split(",")[0]} y1={c01.split(",")[1]} x2={b01.split(",")[0]} y2={b01.split(",")[1]} />
            <line x1={c00.split(",")[0]} y1={c00.split(",")[1]} x2={c00.split(",")[0]} y2={iso(0, 0, 0).split(",")[1]} strokeOpacity="0.15" />
          </g>
          <text x="8" y="22" className="fill-muted-foreground font-mono" fontSize="10">
            dashed = {ch.mem} GB
          </text>
          <text x="8" y="36" className="font-mono" fontSize="10" fill={WCOL[1]}>
            weights {fmt(q.gb)} GB
          </text>
          <text x="8" y="50" className="font-mono" fontSize="10" fill={KCOL[1]}>
            KV {fmt(kvGb)} GB
          </text>
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 font-mono text-xs text-muted-foreground">weights file</div>
            <div className="flex flex-wrap gap-1">
              {QUANTS.map((o, i) => (
                <button key={o.key} type="button" onClick={() => setQi(i)} className={chipCls(i === qi)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-xs text-muted-foreground">KV cache type</div>
            <div className="flex flex-wrap gap-1">
              {KVTYPES.map((o, i) => (
                <button key={o.key} type="button" onClick={() => setKi(i)} className={chipCls(i === ki)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
              <span>context</span>
              <span>{CTX_K[ci]}K tokens</span>
            </div>
            <Range min={0} max={CTX_K.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} aria-label="Context length" />
          </div>
          <div>
            <div className="mb-1 font-mono text-xs text-muted-foreground">chip</div>
            <div className="flex flex-wrap gap-1">
              {CHIPS.map((o, i) => (
                <button key={o.key} type="button" onClick={() => setChip(i)} className={chipCls(i === chip)}>
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t bg-border text-sm sm:grid-cols-4">
        {[
          ["KV per token", `${fmt(perTok / 1024, 1)} KiB`],
          ["total", `${fmt(total)} GB`],
          [fits ? "fits" : "does not fit", `${ch.mem} GB chip`],
          ["decode ceiling", fits ? `${fmt(ceiling)} tok/s` : "n/a (offloads)"],
        ].map(([k, v]) => (
          <div key={k} className="bg-background px-3 py-2">
            <dt className="font-mono text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-base">{v}</dd>
          </div>
        ))}
      </dl>
      <figcaption className="px-4 py-2.5 text-xs text-muted-foreground">
        Weights: {q.src}. Ceiling = {ch.bw} GB/s ÷ (weights + KV read per token), reasoned; real decoders land below it
        (one community report on an M4 Pro reached 85% of it). Ignores activations and runtime buffers.
      </figcaption>
    </figure>
  )
}
