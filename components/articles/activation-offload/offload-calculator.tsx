"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Activation-checkpoint offload calculator.
//
// Each checkpointed layer keeps one tensor: its input, batch x seq x hidden in
// bf16. Offloading moves it over the host link in forward and back in backward.
// Copy time per layer = bytes / link bandwidth. Compute time per layer (forward)
// = (2 x tokens x layer params + 2 x batch x seq^2 x attention width) / achieved
// FLOP/s. A step with checkpointing costs about 4 forwards per layer (forward,
// recompute, backward at 2x).
//
// Transformers (save_on_cpu): both copies sit on the compute stream, so every
// layer pays the copy in forward and again in backward.
// Arctic (side streams, keep_last_n=1, prefetch one layer ahead): forward never
// waits (a slow link shows up as checkpoints still in flight, i.e. memory), and
// backward waits only for the part of a reload longer than one layer's
// recompute + backward.
//
// All of this is first-order arithmetic, not a measurement.

const ACCENT = "oklch(0.64 0.15 50)"
const STALL = "oklch(0.6 0.2 25)"
const COPY = "oklch(0.62 0.12 235)"

type Model = { name: string; layers: number; hidden: number; layerParams: number; attnWidth: number }
// Layer params from each model's config.json: q and o projections, k and v
// projections (grouped-query), and a three-matrix SwiGLU MLP.
const MODELS: Model[] = [
  { name: "Qwen3-1.7B", layers: 28, hidden: 2048, layerParams: 50_331_648, attnWidth: 2048 },
  { name: "Qwen3-8B", layers: 36, hidden: 4096, layerParams: 192_937_984, attnWidth: 4096 },
  { name: "Llama-70B", layers: 80, hidden: 8192, layerParams: 855_638_016, attnWidth: 8192 },
]

type Link = { name: string; gbps: number; note: string }
const LINKS: Link[] = [
  { name: "PCIe 4 x16", gbps: 31, note: "spec, one direction" },
  { name: "PCIe 5 x16", gbps: 55.43, note: "measured on H200, one direction" },
  { name: "NVLink-C2C", gbps: 450, note: "Grace, one direction" },
]

const SEQ_STEPS = [4, 8, 16, 32, 64, 128, 256, 512, 1024] // K tokens

const fmtBytes = (b: number) => {
  const gib = b / 1073741824
  if (gib >= 1) return `${gib.toFixed(gib >= 100 ? 0 : 1)} GiB`
  return `${(b / 1048576).toFixed(0)} MiB`
}
const fmtMs = (s: number) => {
  const ms = s * 1000
  if (ms >= 100) return `${ms.toFixed(0)} ms`
  if (ms >= 10) return `${ms.toFixed(1)} ms`
  return `${ms.toFixed(2)} ms`
}
const fmtPct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors",
        on ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

const W = 640
const LANE_H = 18
const X0 = 112
const X1 = 628

export function OffloadCalculator() {
  const [mi, setMi] = useState(1)
  const [si, setSi] = useState(5)
  const [batch, setBatch] = useState(1)
  const [li, setLi] = useState(1)
  const [share, setShare] = useState(1)
  const [tflops, setTflops] = useState(500)

  const m = MODELS[mi]
  const link = LINKS[li]
  const seq = SEQ_STEPS[si] * 1024
  const tokens = batch * seq
  const bytesPerLayer = tokens * m.hidden * 2
  const bw = (link.gbps * 1e9) / share
  const thr = tflops * 1e12

  const copy = bytesPerLayer / bw
  const fwd = (2 * tokens * m.layerParams + 2 * batch * seq * seq * m.attnWidth) / thr
  const bwdPerLayer = 3 * fwd
  const step = m.layers * 4 * fwd
  const ratio = copy / fwd

  const syncOverhead = (m.layers * 2 * copy) / step
  const overlapStall = Math.max(0, copy - bwdPerLayer)
  const overlapOverhead = (m.layers * overlapStall) / step
  const inFlight = Math.max(1, Math.ceil(ratio))

  const total = bytesPerLayer * m.layers
  const node = total * 8

  // ---- timeline: 3 layers of forward, then 3 of backward ----
  const N = 3
  const syncDur = N * (fwd + copy) + N * (bwdPerLayer + copy)
  const ovDur = N * fwd + N * bwdPerLayer + N * overlapStall
  const span = Math.max(syncDur, ovDur)
  const sx = (t: number) => X0 + (t / span) * (X1 - X0)

  type Seg = { t0: number; t1: number; kind: "fwd" | "bwd" | "copy" | "stall"; label?: string }
  const syncSegs: Seg[] = []
  let t = 0
  for (let i = 0; i < N; i++) {
    syncSegs.push({ t0: t, t1: t + fwd, kind: "fwd", label: `F${i + 1}` })
    t += fwd
    syncSegs.push({ t0: t, t1: t + copy, kind: "stall" })
    t += copy
  }
  for (let i = N; i > 0; i--) {
    syncSegs.push({ t0: t, t1: t + copy, kind: "stall" })
    t += copy
    syncSegs.push({ t0: t, t1: t + bwdPerLayer, kind: "bwd", label: `B${i}` })
    t += bwdPerLayer
  }

  const ovCompute: Seg[] = []
  const ovCopy: Seg[] = []
  t = 0
  for (let i = 0; i < N; i++) {
    ovCompute.push({ t0: t, t1: t + fwd, kind: "fwd", label: `F${i + 1}` })
    if (i > 0) ovCopy.push({ t0: t, t1: t + copy, kind: "copy" }) // offload of the previous layer's input
    t += fwd
  }
  for (let i = N; i > 0; i--) {
    // reload of layer i-1 is prefetched while layer i runs backward
    if (i > 1) ovCopy.push({ t0: t, t1: t + copy, kind: "copy" })
    ovCompute.push({ t0: t, t1: t + bwdPerLayer, kind: "bwd", label: `B${i}` })
    t += bwdPerLayer
    if (i > 1 && overlapStall > 0) {
      ovCompute.push({ t0: t, t1: t + overlapStall, kind: "stall" })
      t += overlapStall
    }
  }

  const fill = (k: Seg["kind"]) =>
    k === "fwd" ? ACCENT : k === "bwd" ? "var(--muted-foreground)" : k === "copy" ? COPY : STALL

  const lane = (segs: Seg[], y: number) =>
    segs.map((s, i) => {
      const x = sx(s.t0)
      const w = Math.max(0.6, sx(s.t1) - x)
      return (
        <g key={i}>
          <rect x={x} y={y} width={w} height={LANE_H} rx={2} fill={fill(s.kind)} fillOpacity={s.kind === "bwd" ? 0.35 : 0.8} />
          {s.label && w > 18 ? (
            <text x={x + w / 2} y={y + 12.5} textAnchor="middle" fontSize={9} className="fill-foreground font-mono">
              {s.label}
            </text>
          ) : null}
        </g>
      )
    })

  const verdict =
    overlapStall > 0
      ? "Even overlapped, backward waits: the reload is longer than a layer's recompute and backward."
      : ratio > 1
        ? "Overlapped backward hides the reload, but forward copies queue up: more checkpoints sit on the GPU in flight."
        : "Overlapped, the copies hide under compute. The synchronous path pays them in full."

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>activation-checkpoint offload · memory and copy time</span>
        <span className="text-muted-foreground/50">first-order model</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">model</span>
            {MODELS.map((x, i) => (
              <Pill key={x.name} on={i === mi} onClick={() => setMi(i)}>
                {x.name}
              </Pill>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">link</span>
            {LINKS.map((x, i) => (
              <Pill key={x.name} on={i === li} onClick={() => setLi(i)}>
                {x.name}
              </Pill>
            ))}
          </div>
        </div>

        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>tokens per GPU (sequence)</span>
              <span className="text-foreground">{SEQ_STEPS[si]}K</span>
            </span>
            <Range min={0} max={SEQ_STEPS.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} accent={ACCENT} className="w-full" aria-label="sequence length per GPU" />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>micro-batch</span>
              <span className="text-foreground">{batch}</span>
            </span>
            <Range min={1} max={8} step={1} value={batch} onChange={(e) => setBatch(Number(e.target.value))} accent={ACCENT} className="w-full" aria-label="micro-batch size" />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>achieved TFLOPS per GPU</span>
              <span className="text-foreground">{tflops}</span>
            </span>
            <Range min={100} max={1500} step={50} value={tflops} onChange={(e) => setTflops(Number(e.target.value))} accent={ACCENT} className="w-full" aria-label="achieved TFLOPS" />
          </label>
          <div>
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>GPUs sharing one link</span>
              <span className="text-foreground">{(link.gbps / share).toFixed(1)} GB/s each</span>
            </span>
            <div className="mt-1 flex gap-1.5">
              {[1, 2, 4].map((n) => (
                <Pill key={n} on={n === share} onClick={() => setShare(n)}>
                  {n}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["checkpoint per layer", fmtBytes(bytesPerLayer)],
            ["GPU memory freed", fmtBytes(total)],
            ["host RAM, 8-GPU node", fmtBytes(node)],
            ["copy / layer forward", `${ratio.toFixed(2)}x`],
            ["copy per layer", fmtMs(copy)],
            ["forward per layer", fmtMs(fwd)],
            ["synchronous slowdown", fmtPct(syncOverhead)],
            ["overlapped slowdown", fmtPct(overlapOverhead)],
          ].map(([k, v], i) => (
            <div key={k} className="rounded-md border bg-background/60 px-2 py-1.5">
              <dt className="text-[10px] text-muted-foreground">{k}</dt>
              <dd className="text-sm" style={i === 6 && syncOverhead > 0.1 ? { color: STALL } : undefined}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <svg viewBox={`0 0 ${W} 132`} className="w-full" role="img" aria-label={`Timeline of three layers forward and backward. Synchronous offload adds ${fmtPct(syncOverhead)} to the step; overlapped offload adds ${fmtPct(overlapOverhead)}.`}>
          <text x={8} y={28} fontSize={10} className="fill-muted-foreground font-mono">Transformers</text>
          <text x={8} y={40} fontSize={8.5} className="fill-muted-foreground/70 font-mono">compute stream</text>
          {lane(syncSegs, 20)}
          <text x={8} y={78} fontSize={10} className="fill-muted-foreground font-mono">Arctic</text>
          <text x={8} y={90} fontSize={8.5} className="fill-muted-foreground/70 font-mono">compute stream</text>
          {lane(ovCompute, 70)}
          <text x={8} y={114} fontSize={8.5} className="fill-muted-foreground/70 font-mono">copy streams</text>
          {lane(ovCopy, 100)}
          <line x1={X0} y1={60} x2={X1} y2={60} stroke="var(--border)" strokeDasharray="2 3" />
        </svg>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: ACCENT }} />forward</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm bg-muted-foreground/40 align-middle" />recompute + backward</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: COPY }} />copy, overlapped</span>
          <span><span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: STALL }} />copy the GPU waits for</span>
        </div>

        <p className="text-sm text-muted-foreground">
          {verdict}
          {ratio > 1 ? ` About ${inFlight} layers' checkpoints are in flight at once.` : ""}{" "}
          Link: {link.name}, {link.note}.
        </p>
      </div>
    </figure>
  )
}
