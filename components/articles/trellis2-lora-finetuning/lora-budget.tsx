"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// LoRA parameter count for TRELLIS.2's two geometry flows, from the layer shapes in the
// released adapters' safetensors headers (suvadityamuk/trellis-2-finetune-gso, adapter-3000):
// 30 transformer blocks, model width 1536, DINOv3-L condition tokens 1024 wide, and in the
// sparse-structure flow an MLP of width 8192. A LoRA on a Linear(in, out) adds
// r x in (A) + out x r (B) parameters. The shape flow's MLPs are SparseLinear layers that
// PEFT cannot wrap, so only its attention can be adapted.

const BLOCKS = 30
const D = 1536
const COND = 1024
const MLP = 8192

type Target = { id: string; label: string; din: number; dout: number; mlp?: boolean }
const TARGETS: Target[] = [
  { id: "qkv", label: "self-attn to_qkv", din: D, dout: 3 * D },
  { id: "sout", label: "self-attn to_out", din: D, dout: D },
  { id: "q", label: "cross-attn to_q", din: D, dout: D },
  { id: "kv", label: "cross-attn to_kv", din: COND, dout: 2 * D },
  { id: "cout", label: "cross-attn to_out", din: D, dout: D },
  { id: "m0", label: "mlp.mlp.0", din: D, dout: MLP, mlp: true },
  { id: "m2", label: "mlp.mlp.2", din: MLP, dout: D, mlp: true },
]

const PRESETS = {
  ss: { label: "sparse-structure flow", rank: 8, on: ["qkv", "sout", "q", "kv", "cout", "m0", "m2"], mlpOk: true },
  shape: { label: "shape flow", rank: 16, on: ["qkv", "sout", "q", "kv", "cout"], mlpOk: false },
} as const

const fmt = (n: number) => n.toLocaleString("en-US")

export function LoraBudget() {
  const [flow, setFlow] = useState<keyof typeof PRESETS>("ss")
  const [rank, setRank] = useState<number>(PRESETS.ss.rank)
  const [on, setOn] = useState<string[]>([...PRESETS.ss.on])
  const preset = PRESETS[flow]

  const pick = (f: keyof typeof PRESETS) => {
    setFlow(f)
    setRank(PRESETS[f].rank)
    setOn([...PRESETS[f].on])
  }
  const toggle = (id: string) => setOn((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))

  const active = TARGETS.filter((t) => on.includes(t.id) && (!t.mlp || preset.mlpOk))
  const perBlock = active.reduce((s, t) => s + rank * (t.din + t.dout), 0)
  const total = perBlock * BLOCKS
  const mb = (total * 4) / 1e6
  const isPreset = rank === preset.rank && preset.on.every((x) => on.includes(x)) && on.length === preset.on.length
  const maxBar = 30_000_000

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">what a LoRA on TRELLIS.2 costs, layer by layer</span>
        <div className="flex gap-1">
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => pick(f)}
              aria-pressed={flow === f}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                flow === f ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PRESETS[f].label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-4">
        <div className="grid gap-1 font-mono text-xs">
          {TARGETS.map((t) => {
            const blocked = t.mlp && !preset.mlpOk
            const live = on.includes(t.id) && !blocked
            const n = rank * (t.din + t.dout) * BLOCKS
            return (
              <button
                key={t.id}
                type="button"
                disabled={blocked}
                onClick={() => toggle(t.id)}
                aria-pressed={live}
                className={cn(
                  "grid grid-cols-[1.2rem_9.5rem_1fr_6.5rem] items-center gap-2 rounded px-1 py-0.5 text-left",
                  blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/40",
                )}
              >
                <span>{blocked ? "×" : live ? "■" : "□"}</span>
                <span className={live ? "text-foreground" : "text-muted-foreground"}>{t.label}</span>
                <span className="relative h-2 rounded bg-muted/40">
                  <span
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${Math.min(100, (100 * n) / (maxBar / 3)).toFixed(1)}%`, background: live ? "#c8501e" : "var(--muted-foreground)", opacity: live ? 0.9 : 0.25 }}
                  />
                </span>
                <span className="text-right text-muted-foreground">
                  {blocked ? "SparseLinear" : `${(n / 1e6).toFixed(2)}M`}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">per block </span>
            {fmt(perBlock)}
            <span className="text-muted-foreground"> × {BLOCKS} blocks</span>
          </div>
          <div>
            <span className="text-muted-foreground">adapter </span>
            <span className="text-foreground">{fmt(total)}</span>
            <span className="text-muted-foreground"> params · {mb.toFixed(1)} MB in fp32</span>
          </div>
          <div className="sm:col-span-2">
            <span className="relative block h-3 rounded bg-muted/40">
              <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (100 * total) / maxBar).toFixed(1)}%`, background: "#c8501e" }} />
            </span>
          </div>
          <div className="sm:col-span-2 text-muted-foreground">
            {isPreset
              ? `This is the released ${preset.label} adapter: 9,338,880 parameters, matching its safetensors header.`
              : `The released ${preset.label} adapter is rank ${preset.rank} on ${preset.on.length} layer types: 9,338,880 parameters.`}
          </div>
        </div>

        <label className="mt-4 grid gap-1 font-mono text-xs sm:max-w-sm">
          <span>rank r = {rank}</span>
          <Range min={2} max={64} step={2} value={rank} accent="#c8501e" onChange={(e) => setRank(Number(e.target.value))} />
        </label>

        <figcaption className="mt-3 text-xs text-muted-foreground">
          Each adapted Linear(in, out) gains r × (in + out) parameters, in all 30 blocks. The two released adapters land on the
          same count by different routes: rank 8 on attention and MLP in the sparse-structure flow, rank 16 on attention only in
          the shape flow, whose MLPs PEFT cannot wrap. Shapes read from the released adapters&apos; safetensors headers; the
          arithmetic runs in your browser.
        </figcaption>
      </div>
    </figure>
  )
}
