"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Parallelism planner. Two real training campaigns released on the same day answer the
// same question — how do you keep a big MoE efficient as you add GPUs — with opposite
// parallelism choices. Pick a scenario, slide through its measured operating points, and
// watch which parallelism axes light up, what the MFU is, and what the throughput is.
//
// Every number here is reported (from the Aleph Alpha blog and the Olmo-core 3 report);
// nothing is interpolated. The axes a point lights are the ones its config actually used.
// The six axes: DP (replicate the model, split the batch), FSDP (shard params/grads/opt
// across the DP group and re-gather per layer), TP (split weight matrices within a layer),
// EP (place different experts on different GPUs, all-to-all the tokens), PP (split layers
// into pipeline stages), CP (split the sequence for long context).

type Axis = "DP" | "FSDP" | "TP" | "EP" | "PP" | "CP"
const AXES: { id: Axis; name: string; blurb: string }[] = [
  { id: "DP", name: "DP", blurb: "replica · split the batch" },
  { id: "FSDP", name: "FSDP", blurb: "shard + re-gather weights" },
  { id: "TP", name: "TP", blurb: "split weight matrices" },
  { id: "EP", name: "EP", blurb: "experts across GPUs · all-to-all" },
  { id: "PP", name: "PP", blurb: "layers into pipeline stages" },
  { id: "CP", name: "CP", blurb: "split the sequence" },
]

type Point = {
  gpus: number
  label: string
  mfu: number // %
  tput: number // scenario unit
  active: Partial<Record<Axis, number>> // axis -> degree (>1 shown)
  note: string
}

type Scenario = {
  id: "aleph" | "olmo"
  name: string
  model: string
  hw: string
  unit: string // throughput unit
  tputLabel: string
  peak?: number // per-GPU throughput at the first point, for the linear reference
  points: Point[]
}

const SCENARIOS: Scenario[] = [
  {
    id: "aleph",
    name: "Aleph Alpha · recipe",
    model: "30B-A3B MoE",
    hw: "NVIDIA B200",
    unit: "k tok/s/GPU",
    tputLabel: "per-GPU throughput",
    peak: 28.4,
    points: [
      { gpus: 16, label: "16 GPUs", mfu: 37.5, tput: 28.4, active: { FSDP: 16 }, note: "FSDP shards the whole model across all 16 ranks. Nothing else is on." },
      { gpus: 128, label: "128 GPUs", mfu: 37.0, tput: 28.0, active: { FSDP: 128 }, note: "FSDP stretched to 128 — right at the edge of being communication-bound." },
      { gpus: 512, label: "512 GPUs", mfu: 35.3, tput: 26.7, active: { FSDP: 128, DP: 4 }, note: "FSDP capped at 128; replicate it 4x with plain DP. Hybrid sharding (HSDP)." },
    ],
  },
  {
    id: "olmo",
    name: "Olmo-core 3 · code",
    model: "MoE, up to 1.2T",
    hw: "NVIDIA B300 (NVL8)",
    unit: "TFLOP/s/GPU",
    tputLabel: "useful-model throughput",
    points: [
      { gpus: 16, label: "Tiny · 1.59B@12.9B · 16 GPUs", mfu: 40.1, tput: 903, active: { DP: 1 }, note: "64 experts, BF16, 16 GPUs. Small enough that plain DDP is all you need — no EP, no PP." },
      { gpus: 128, label: "Small · 4.29B@40.9B · 128 GPUs", mfu: 37.4, tput: 841, active: { DP: 1, EP: 8 }, note: "64 experts, BF16, 128 GPUs. EP8 shards the routed-expert pool so each rank stores an eighth of it." },
      { gpus: 128, label: "Medium · 7.38B@137B · 128 GPUs", mfu: 37.5, tput: 843, active: { DP: 1, EP: 8, PP: 4 }, note: "128 experts, BF16, 128 GPUs. PP4 splits the layers once one rank can't hold them all." },
      { gpus: 512, label: "Large · 15.1B@296B · 512 GPUs", mfu: 34.1, tput: 768, active: { DP: 1, EP: 8, PP: 4 }, note: "128 experts, BF16, 512 GPUs. Same axes as Medium, more capacity — the one point where MFU dips." },
      { gpus: 512, label: "Ultra · 58.4B@1.2T · 512 GPUs", mfu: 38.1, tput: 858, active: { DP: 1, EP: 8, PP: 8 }, note: "128 experts, MXFP8, 512 GPUs, per-layer recompute. EP8 + PP8 + 8-bit is what puts 1.2T within a 512-GPU budget." },
    ],
  },
]

const ON = "oklch(0.62 0.17 255)" // active axis / primary (blue)
const EPC = "oklch(0.64 0.17 150)" // EP accent (green) — the MoE-native axis
const BAR = "oklch(0.62 0.15 255)"
const BARHL = "oklch(0.64 0.17 150)"

export function ParallelismPlanner() {
  const [sid, setSid] = useState<"aleph" | "olmo">("olmo")
  const [i, setI] = useState(0)

  const sc = SCENARIOS.find((s) => s.id === sid) as Scenario
  const idx = Math.min(i, sc.points.length - 1)
  const p = sc.points[idx]

  // near-linear aggregate reference (Aleph only, where the points are a GPU sweep).
  // tput is in k tok/s/GPU, so aggregate in M tok/s = tput * gpus / 1000.
  const idealM = sc.peak ? (sc.peak * p.gpus) / 1000 : 0
  const realM = (p.tput * p.gpus) / 1000
  const eff = idealM > 0 ? Math.round((realM / idealM) * 100) : 0

  const maxMfu = Math.max(...sc.points.map((q) => q.mfu))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">parallelism planner · reported operating points</span>
        <div className="flex gap-1">
          {SCENARIOS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setSid(o.id)
                setI(0)
              }}
              aria-pressed={sid === o.id}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                sid === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
          <span>
            <span className="text-foreground">{sc.model}</span> · {sc.hw}
          </span>
          <span className="tabular-nums">{p.label}</span>
        </div>

        {/* axis pills */}
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-6">
          {AXES.map((a) => {
            const deg = p.active[a.id]
            const on = deg != null
            const isEp = a.id === "EP"
            return (
              <div
                key={a.id}
                className="bg-background px-2.5 py-2 transition-colors"
                style={on ? { background: isEp ? "color-mix(in oklch, var(--background) 86%, " + EPC + ")" : "color-mix(in oklch, var(--background) 88%, " + ON + ")" } : undefined}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    className="font-mono text-sm font-semibold"
                    style={{ color: on ? (isEp ? EPC : ON) : "var(--muted-foreground)", opacity: on ? 1 : 0.5 }}
                  >
                    {a.name}
                  </span>
                  {on && deg > 1 ? (
                    <span className="font-mono text-[10px] tabular-nums" style={{ color: isEp ? EPC : ON }}>
                      ×{deg}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-[10px] leading-3 text-muted-foreground" style={{ opacity: on ? 0.9 : 0.4 }}>
                  {a.blurb}
                </div>
              </div>
            )
          })}
        </div>

        {/* readouts */}
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
          <div className="bg-background px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">MFU</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
              {p.mfu.toFixed(1)}
              <span className="ml-0.5 text-sm text-muted-foreground">%</span>
            </div>
          </div>
          <div className="bg-background px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{sc.tputLabel}</div>
            <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: ON }}>
              {p.tput.toLocaleString("en-US")}
              <span className="ml-1 text-sm text-muted-foreground">{sc.unit}</span>
            </div>
          </div>
        </div>

        {/* MFU trend across the scenario's points */}
        <div className="mt-3">
          <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            MFU across this campaign&rsquo;s measured points
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 68 }}>
            {sc.points.map((q, qi) => {
              const h = Math.round((q.mfu / maxMfu) * 56) + 4
              const sel = qi === idx
              return (
                <button
                  key={qi}
                  type="button"
                  onClick={() => setI(qi)}
                  className="group flex flex-1 cursor-pointer flex-col items-center justify-end"
                  aria-label={`${q.label}: ${q.mfu}% MFU`}
                  aria-pressed={sel}
                  style={{ height: 68 }}
                >
                  <span className="mb-0.5 font-mono text-[9px] tabular-nums" style={{ color: sel ? ON : "var(--muted-foreground)", opacity: sel ? 1 : 0.6 }}>
                    {q.mfu.toFixed(0)}
                  </span>
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{ height: h, background: sel ? BARHL : BAR, opacity: sel ? 1 : 0.32 }}
                  />
                  <span className="mt-1 font-mono text-[9px] tabular-nums text-muted-foreground">{q.gpus}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-0.5 text-right font-mono text-[9px] text-muted-foreground">GPUs →</div>
        </div>

        {/* slider */}
        <div className="mt-3">
          <Range
            min={0}
            max={sc.points.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setI(parseInt(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="operating point"
            accent="var(--foreground)"
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.note}</p>

        {sc.peak ? (
          <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2 font-mono text-xs text-muted-foreground">
            aggregate ={" "}
            <span className="text-foreground tabular-nums">{realM.toFixed(1)}M</span>{" "}
            tok/s vs a perfectly-linear{" "}
            <span className="tabular-nums">{idealM.toFixed(1)}M</span> ·{" "}
            <span style={{ color: eff >= 94 ? EPC : "var(--foreground)" }} className="tabular-nums">
              {eff}%
            </span>{" "}
            of linear
          </div>
        ) : null}
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Reported operating points, not a controlled scaling curve: the configs differ in
        batch, precision and recompute. Aleph Alpha&rsquo;s points are a 16&ndash;512-GPU sweep of
        one model; Olmo-core&rsquo;s five sizes each run on {"≤"}512 GPUs. Numbers from the Aleph
        Alpha blog and the Olmo-core 3 report.
      </figcaption>
    </figure>
  )
}
