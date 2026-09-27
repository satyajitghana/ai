"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two MoE layers of a batch-1 decode step, scheduled two ways.
//
// ILLUSTRATIVE. The durations below are made up; only their order and the rule
// that schedules them are taken from the source. The phase order within a
// layer (attention, router, shared expert, routed experts, collective) and the
// cross-layer overlap (layer N+1's attention weights moving during layer N's
// routed experts) follow Inferact's own pipeline figure and
// kimi/decode_megakernel.py, where `after_experts` calls `prefetch_next_layer`.
//
// Per-op kernels: each op is its own kernel. It waits `gap` (launch, sync,
// pipeline ramp), spends SETUP before its first load lands, streams its weights,
// and drains its last compute tile after the last load. HBM only moves while an
// op is loading its own weights, so every compute-only phase, every collective
// and every drain is a bubble.
//
// One megakernel: a load is issued as soon as VMEM has room for it (CAP units
// of weights resident and not yet consumed), regardless of which op will use
// it. An op computes once its weights are resident and its predecessor is done.
//
// Arithmetic is +, -, *, / and Math.max only.

type Kind = "matrix" | "vector" | "collective"
type Op = { key: string; label: string; load: number; compute: number; kind: Kind; layer: number }
type Bar = { key: string; label: string; kind: Kind; layer: number; a: number; b: number }
type Schedule = { hbm: Bar[]; work: Bar[]; span: number }

const LAYER: Omit<Op, "layer">[] = [
  { key: "attn", label: "attention", load: 3, compute: 1, kind: "matrix" },
  { key: "router", label: "router", load: 0.6, compute: 0.9, kind: "vector" },
  { key: "shared", label: "shared expert", load: 1.5, compute: 0.5, kind: "matrix" },
  { key: "routed", label: "routed experts", load: 4, compute: 1.2, kind: "matrix" },
  { key: "comm", label: "collective", load: 0, compute: 1.3, kind: "collective" },
]
const OPS: Op[] = [0, 1].flatMap((layer) => LAYER.map((o) => ({ ...o, layer })))
const SETUP = 0.2
const CAP = 8

function perOp(gap: number): Schedule {
  let t = 0
  const hbm: Bar[] = []
  const work: Bar[] = []
  for (const op of OPS) {
    t += gap
    const s = t
    if (op.load === 0) {
      work.push({ ...op, a: s, b: s + op.compute })
      t = s + op.compute
      continue
    }
    const la = s + SETUP
    hbm.push({ ...op, a: la, b: la + op.load })
    const end = la + Math.max(op.load, op.compute) + op.compute * 0.25
    work.push({ ...op, a: s, b: end })
    t = end
  }
  return { hbm, work, span: t }
}

function megakernel(): Schedule {
  let hbmT = 0
  const hbm: Bar[] = []
  const work: Bar[] = []
  const ends: number[] = []
  const issued: { i: number; bytes: number }[] = []
  OPS.forEach((op, i) => {
    let la = hbmT
    if (op.load > 0) {
      const candidates = [hbmT, ...ends.filter((e) => e > hbmT)].sort((x, y) => x - y)
      for (const c of candidates) {
        const resident = issued.reduce((acc, r) => acc + (ends[r.i] > c ? r.bytes : 0), 0)
        if (resident + op.load <= CAP) {
          la = c
          break
        }
      }
      hbm.push({ ...op, a: la, b: la + op.load })
      hbmT = la + op.load
      issued.push({ i, bytes: op.load })
    }
    const ready = op.load > 0 ? la + op.load : 0
    const ca = Math.max(i > 0 ? ends[i - 1] : 0, ready)
    work.push({ ...op, a: ca, b: ca + op.compute })
    ends[i] = ca + op.compute
  })
  return { hbm, work, span: ends[ends.length - 1] }
}

const MEGA = megakernel()
const MAX_SPAN = perOp(0.6).span

const busy = (s: Schedule) => s.hbm.reduce((acc, bar) => acc + bar.b - bar.a, 0) / s.span

const WORK_FILL: Record<Kind, string> = {
  matrix: "fill-slate-700 dark:fill-slate-300",
  vector: "fill-amber-300 dark:fill-amber-400",
  collective: "fill-sky-300 dark:fill-sky-500",
}
const WORK_TEXT: Record<Kind, string> = {
  matrix: "fill-white dark:fill-slate-900",
  vector: "fill-slate-900",
  collective: "fill-slate-900",
}

const W = 720
const L = 118
const R = 704
const x = (t: number) => L + (t / MAX_SPAN) * (R - L)

function Lane({ bars, y, hbm }: { bars: Bar[]; y: number; hbm: boolean }) {
  return (
    <g>
      <rect x={L} y={y} width={R - L} height={18} className="fill-foreground/[0.04]" />
      {bars.map((bar) => {
        const w = x(bar.b) - x(bar.a)
        const label = bar.key === "routed" ? "routed" : bar.key === "shared" ? "shared" : bar.label
        return (
          <g key={`${bar.key}-${bar.layer}-${bar.a}`}>
            <rect
              x={x(bar.a)}
              y={y}
              width={w}
              height={18}
              rx={2}
              className={cn(
                hbm ? "fill-blue-500/85 dark:fill-blue-400/80" : WORK_FILL[bar.kind],
                bar.layer === 1 && "opacity-75"
              )}
            />
            {w > 34 ? (
              <text
                x={x(bar.a) + w / 2}
                y={y + 12.5}
                textAnchor="middle"
                className={cn("font-mono", hbm ? "fill-white" : WORK_TEXT[bar.kind])}
                style={{ fontSize: 8.5 }}
              >
                {label}
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

export function StepTimeline() {
  const [gap, setGap] = useState(0.3)
  const per = perOp(gap)
  const H = 212

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two MoE layers of one batch-1 decode step, scheduled two ways
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">illustrative durations, not measured</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[620px]"
            role="img"
            aria-label="Two timelines of the same two decoder layers. In the top one, each operation is its own kernel: it loads its weights from HBM, computes, drains, and only then does the next kernel start, so HBM sits idle during every router, collective and drain, and during the gap between kernels. In the bottom one, a single megakernel issues each weight load as soon as on-chip memory has room, so the next layer's attention weights stream in while the current layer's routed experts compute and communicate, and HBM stays busy almost continuously. The same work finishes sooner."
          >
            <text x={8} y={20} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
              per-op kernels
            </text>
            <text x={8} y={46} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              HBM → VMEM
            </text>
            <text x={8} y={70} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              kernel running
            </text>
            <Lane bars={per.hbm} y={33} hbm />
            <Lane bars={per.work} y={57} hbm={false} />
            <line x1={x(per.span)} y1={28} x2={x(per.span)} y2={80} className="stroke-foreground" strokeDasharray="3 2" />

            <text x={8} y={112} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
              one megakernel
            </text>
            <text x={8} y={138} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              HBM → VMEM
            </text>
            <text x={8} y={162} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              compute / ICI
            </text>
            <Lane bars={MEGA.hbm} y={125} hbm />
            <Lane bars={MEGA.work} y={149} hbm={false} />
            <line x1={x(MEGA.span)} y1={120} x2={x(MEGA.span)} y2={172} className="stroke-foreground" strokeDasharray="3 2" />

            <text x={L} y={194} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              time → · layer N solid, layer N+1 faded · dashed line: end of step
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              gap between kernels (launch, sync, pipeline ramp): {gap.toFixed(1)} units
              {gap === 0 ? " — as if launches were free" : ""}
            </span>
            <Range
              min={0}
              max={0.6}
              step={0.1}
              value={gap}
              onChange={(e) => setGap(Number(e.target.value))}
              aria-label="Gap between kernels"
            />
          </label>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1 font-mono text-[11px] tabular-nums">
            <dt className="text-muted-foreground">HBM busy, per-op</dt>
            <dd className="text-right">{(busy(per) * 100).toFixed(0)}%</dd>
            <dt className="text-muted-foreground">HBM busy, megakernel</dt>
            <dd className="text-right">{(busy(MEGA) * 100).toFixed(0)}%</dd>
            <dt className="text-muted-foreground">step, megakernel ÷ per-op</dt>
            <dd className="text-right">{((MEGA.span / per.span) * 100).toFixed(0)}%</dd>
          </dl>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500/85" /> weights moving
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-700 dark:bg-slate-300" /> matrix work
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-300" /> vector work
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-300" /> collective
          </span>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The durations are invented; the rule is not. With a zero gap the per-op
          row still leaves HBM idle through the router&rsquo;s compute, the
          collective and every drain, because a load cannot start before the
          kernel that owns it. The
          megakernel row issues each load as soon as 8 units of VMEM allow, so
          layer N+1&rsquo;s attention weights arrive while layer N is still in its
          routed experts.
        </p>
      </div>
    </figure>
  )
}
