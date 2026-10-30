"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { CLAIMS, DENSE_PARAMS, EXPERTS, EXPERT_PARAMS, LAYERS, TOP_K } from "./data"

// One decode round of Clover's self-speculative mode, as a bandwidth budget. A round is two forward passes over a
// block of B tokens: a preview pass (the diffusion draft, with the MoE coreset limiting which experts a block uses)
// and a causal verify pass (every token routed normally). A batch-size-1 pass is limited by the bytes it must read,
// so: round time = (preview bytes + verify bytes) / (bandwidth x efficiency), speed = tokens kept per round / round
// time. The weights are MEASURED, the bandwidths are vendors' published figures, and the expert-union sizes and the
// efficiency are ASSUMPTIONS the reader sets: the checkpoint does not say how many distinct experts a block uses.

function uniformUnion(tokens: number): number {
  // expected number of distinct experts when each token picks TOP_K of EXPERTS uniformly: E (1 - (1 - K/E)^tokens)
  return EXPERTS * (1 - mpow(1 - TOP_K / EXPERTS, tokens))
}

function gb(params: number, bytes: number): number {
  return (params * bytes) / 1e9
}

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
}) {
  const { label, value, min, max, step, fmt, onChange } = props
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-40 shrink-0 font-mono text-muted-foreground">{label}</span>
      <Range min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full" />
      <span className="w-20 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

export function StepBudget() {
  const [claim, setClaim] = useState<(typeof CLAIMS)[number]["key"]>("h200")
  const [block, setBlock] = useState(32)
  const [eff, setEff] = useState(60)
  const [up, setUp] = useState(64)
  const [uv, setUv] = useState(Math.round(uniformUnion(32)))
  const [tpr, setTpr] = useState(8)

  const c = CLAIMS.find((x) => x.key === claim) ?? CLAIMS[1]
  const bytes = c.precision === "INT4" ? 0.5 : 2
  const bw = c.gbps * (eff / 100) // GB/s actually achieved
  const dense = gb(DENSE_PARAMS, bytes)
  const expertGb = (u: number) => gb(u * LAYERS * EXPERT_PARAMS, bytes)
  const preview = dense + expertGb(up)
  const verify = dense + expertGb(uv)
  const roundGb = preview + verify
  const roundMs = (roundGb / bw) * 1000
  const tps = (Math.min(tpr, block) / roundMs) * 1000
  const need = (c.tps * roundMs) / 1000 // tokens per round the reported speed implies
  const arGb = dense + expertGb(TOP_K)
  const arTps = bw / arGb
  const uniform = Math.round(uniformUnion(block))

  const pick = (k: (typeof CLAIMS)[number]["key"]) => {
    setClaim(k)
  }
  const setBlockSize = (b: number) => {
    setBlock(b)
    setUv(Math.round(uniformUnion(b)))
    setTpr((t) => Math.min(t, b))
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the byte budget of one round · weights measured, bandwidths published, expert unions assumed
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted-foreground">reported</span>
        {CLAIMS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => pick(x.key)}
            title={x.note}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              claim === x.key ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.gpu} {x.precision} {x.tps}
          </button>
        ))}
        <span className="ml-3 font-mono text-[11px] text-muted-foreground">block</span>
        {[16, 32].map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBlockSize(b)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              block === b ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="space-y-2 px-4 pt-4">
        <Slider label="bandwidth achieved" value={eff} min={20} max={100} step={5} fmt={(v) => `${v}% of ${(c.gbps / 1000).toFixed(c.gbps >= 1000 ? 1 : 3)} TB/s`} onChange={setEff} />
        <Slider label="experts per layer, preview" value={up} min={8} max={256} step={1} fmt={(v) => `${v} of 256`} onChange={setUp} />
        <Slider label="experts per layer, verify" value={uv} min={8} max={256} step={1} fmt={(v) => `${v} of 256`} onChange={setUv} />
        <Slider label="tokens kept per round" value={Math.min(tpr, block)} min={1} max={block} step={1} fmt={(v) => `${v}`} onChange={setTpr} />
        <div className="font-mono text-[10px] text-muted-foreground">
          uniform routing would touch about {uniform} of 256 experts for {block} tokens; real routing is correlated, so a block touches fewer, and the coreset setting exists to cut it further
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t px-4 py-3 font-mono text-[11px] sm:grid-cols-4">
        <div className="text-muted-foreground">
          bytes per round
          <div className="text-foreground tabular-nums">{roundGb.toFixed(1)} GB</div>
          <div className="tabular-nums">{preview.toFixed(1)} preview + {verify.toFixed(1)} verify</div>
        </div>
        <div className="text-muted-foreground">
          round time at that bandwidth
          <div className="text-foreground tabular-nums">{roundMs.toFixed(2)} ms</div>
        </div>
        <div className="text-muted-foreground">
          speed this gives
          <div className="text-foreground tabular-nums">{tps.toFixed(0)} tokens/s</div>
        </div>
        <div className="text-muted-foreground">
          tokens per round the reported {c.tps} needs
          <div className={cn("tabular-nums", need > block ? "text-red-500" : "text-foreground")}>
            {need.toFixed(1)}
            {need > block ? ` (more than the block of ${block})` : ""}
          </div>
        </div>
      </div>
      <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        one token at a time, same weights: {arGb.toFixed(2)} GB per token, so at most {arTps.toFixed(0)} tokens/s at {eff}% of the same bandwidth
      </div>
      <div className="border-t px-4 py-2 text-[10px] leading-relaxed text-muted-foreground">
        {c.gbpsNote}. The speed and the data it was measured on are the vendor&apos;s claim: {c.note}. Attention state, activations and kernel launch time are not in this budget.
      </div>
    </figure>
  )
}
