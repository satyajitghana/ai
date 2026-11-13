"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// What `T.Pipelined(..., num_stages=n)` turns into, for the article's GEMM loop
// body [copy A, copy B, gemm].
//
// The schedule is read off src/transform/pipeline_planning.cc (TileLang v0.1.15):
//   1. every non-copy statement gets the next order and stage = num_stages; the
//      copies it consumes are placed right after it at stage 0.
//      -> gemm (order 0, stage n), copy A (order 1, stage 0), copy B (order 2, stage 0)
//   2. if every copy sits after every non-copy in the order and num_stages >= 2,
//      rotate the copies to the front and decrement the other stages by one.
//      -> copy A (0, 0), copy B (1, 0), gemm (2, n - 1)
// Buffer versions come from ComputeBufferVersions in inject_pipeline.cc: the upper
// bound is use - def + 1 (reader stage - writer stage + 1), decremented when no
// writer runs earlier in both order and stage than a reader of the same buffer.
//   n >= 2: 0 < 2 in order and 0 < n-1 in stage -> n versions
//   n == 1: writer order 1/2 is after reader order 0 -> bound 2 decremented -> 1
//
// The timeline is a toy model, not a simulator: one GEMM step takes 1 unit, a
// tile copy takes L units from issue to arrival, copies overlap each other, and
// copy i can only be issued once the buffer slot it reuses is free (gemm i - v
// finished, v = versions). Then gemm i starts at max(gemm i-1 end, copy i
// arrival). The steady-state period is max(1, (L + 1) / v), so the tensor cores
// stop waiting once v >= L + 1. All arithmetic is + - * / and Math.max: exact.
//
// On ROCm targets other than gfx950 (so MI300X, gfx942) the planner strips the
// annotation and the loop runs sequentially, which is the n = 1 timeline with a
// single buffer and no prefetch.

const ITERS = 8
const BLOCK_M = 128
const BLOCK_N = 128
const BLOCK_K = 32
const PER_VERSION_KB = ((BLOCK_M * BLOCK_K + BLOCK_K * BLOCK_N) * 2) / 1024 // 16

const LIMITS = [
  { name: "H100", kb: 227 },
  { name: "A100", kb: 163 },
  { name: "RTX 3090 / 4090", kb: 99 },
  { name: "MI300X LDS", kb: 64 },
]

type Row = { stmt: string; order: number; stage: number }

function plan(n: number): { rows: Row[]; versions: number; rotated: boolean } {
  if (n >= 2) {
    return {
      rows: [
        { stmt: "T.copy(A → A_shared)", order: 0, stage: 0 },
        { stmt: "T.copy(B → B_shared)", order: 1, stage: 0 },
        { stmt: "T.gemm(A_shared, B_shared, C_local)", order: 2, stage: n - 1 },
      ],
      versions: n,
      rotated: true,
    }
  }
  return {
    rows: [
      { stmt: "T.gemm(A_shared, B_shared, C_local)", order: 0, stage: 1 },
      { stmt: "T.copy(A → A_shared)", order: 1, stage: 0 },
      { stmt: "T.copy(B → B_shared)", order: 2, stage: 0 },
    ],
    versions: 1,
    rotated: false,
  }
}

type Bar = { i: number; a: number; b: number }

function simulate(versions: number, latency: number) {
  const copies: Bar[] = []
  const gemms: Bar[] = []
  for (let i = 0; i < ITERS; i++) {
    const slotFree = i - versions >= 0 ? gemms[i - versions].b : 0
    const issue = slotFree
    const arrive = issue + latency
    const start = Math.max(i > 0 ? gemms[i - 1].b : 0, arrive)
    copies.push({ i, a: issue, b: arrive })
    gemms.push({ i, a: start, b: start + 1 })
  }
  const total = gemms[ITERS - 1].b
  return { copies, gemms, total, busy: ITERS / total }
}

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1))

export function PipelineStages() {
  const [n, setN] = useState(3)
  const [latency, setLatency] = useState(2)
  const [rocm, setRocm] = useState(false)

  const eff = rocm ? 1 : n
  const p = plan(eff)
  const sim = simulate(p.versions, latency)
  const smemKb = PER_VERSION_KB * p.versions
  const needed = latency + 1

  // SVG geometry
  const W = 640
  const left = 92
  const rowH = 26
  const H = 2 * rowH + 44
  const span = Math.max(sim.total, 1)
  const x = (t: number) => left + ((W - left - 8) * t) / span

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-4 text-sm font-medium">
        num_stages, as the pipeline pass schedules it
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">num_stages</span>
          <Range min={1} max={5} step={1} value={n} onChange={(e) => setN(Number(e.currentTarget.value))} className="flex-1" aria-label="num_stages" />
          <span className="w-8 shrink-0 text-right font-mono tabular-nums">{n}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-24 shrink-0 font-mono text-muted-foreground">copy latency</span>
          <Range min={0} max={5} step={1} value={latency} onChange={(e) => setLatency(Number(e.currentTarget.value))} className="flex-1" aria-label="copy latency in GEMM steps" />
          <span className="w-8 shrink-0 text-right font-mono tabular-nums">{latency}</span>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {[
          { k: false, label: "target: CUDA" },
          { k: true, label: "target: ROCm gfx942 (MI300X)" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setRocm(o.k)}
            className={cn(
              "rounded-full border px-3 py-1 font-mono",
              rocm === o.k ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        {!rocm && (
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-normal">statement</th>
              <th className="py-1 pr-3 font-normal">order</th>
              <th className="py-1 font-normal">stage</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {p.rows.map((r) => (
              <tr key={r.stmt} className="border-t border-border/60">
                <td className="py-1 pr-3">{r.stmt}</td>
                <td className="py-1 pr-3 tabular-nums">{r.order}</td>
                <td className="py-1 tabular-nums">{r.stage}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {rocm
            ? "On gfx942 the planner strips num_stages before planning, so this is the plain loop: one buffer, each copy waits for the previous GEMM."
            : p.rotated
              ? `Copies were last in the order, so the pass rotated them to the front and lowered the GEMM to stage ${n - 1}. Each shared buffer gets ${p.versions} versions.`
              : "With num_stages = 1 the rotation does not apply. The copy for k + 1 is ordered after the GEMM for k, so one version of each buffer suffices and nothing overlaps."}
        </p>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label={`Timeline of ${ITERS} loop iterations: copies on one row, GEMMs on the other`}>
        {[
          { y: 8, label: "copy (async)" },
          { y: 8 + rowH + 6, label: "tensor cores" },
        ].map((r) => (
          <text key={r.label} x={0} y={r.y + 17} className="fill-muted-foreground" fontSize={11}>
            {r.label}
          </text>
        ))}
        {sim.copies.map((c) => (
          <g key={`c${c.i}`}>
            <rect
              x={x(c.a)}
              y={8 + (c.i % 2) * 11}
              width={Math.max(x(c.b) - x(c.a), 2)}
              height={9}
              rx={2}
              className="fill-sky-500/60"
            />
          </g>
        ))}
        {sim.gemms.map((g) => (
          <g key={`g${g.i}`}>
            <rect x={x(g.a)} y={8 + rowH + 6} width={x(g.b) - x(g.a) - 1} height={20} rx={2} className="fill-emerald-500/60" />
            <text x={(x(g.a) + x(g.b)) / 2} y={8 + rowH + 20} textAnchor="middle" fontSize={10} className="fill-foreground">
              {g.i}
            </text>
          </g>
        ))}
        <line x1={left} x2={W - 8} y1={H - 14} y2={H - 14} className="stroke-border" />
        <text x={W - 8} y={H - 2} textAnchor="end" fontSize={10} className="fill-muted-foreground">
          {fmt(sim.total)} GEMM-steps for {ITERS} iterations
        </text>
      </svg>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat k="buffer versions" v={String(p.versions)} />
        <Stat k="shared memory" v={`${fmt(smemKb)} KB`} hl />
        <Stat k="tensor cores busy" v={`${Math.round(sim.busy * 100)}%`} />
        <Stat k="stages to hide latency" v={`≥ ${needed}`} warn={!rocm && n < needed} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {LIMITS.map((l) => {
          const fits = smemKb <= l.kb
          return (
            <span
              key={l.name}
              className={cn(
                "rounded border px-2 py-0.5 font-mono",
                fits ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-rose-500/40 text-rose-700 dark:text-rose-400"
              )}
            >
              {l.name} {l.kb} KB: {fits ? "fits" : "over"}
            </span>
          )
        })}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Shared memory is ({BLOCK_M}·{BLOCK_K} + {BLOCK_K}·{BLOCK_N}) × 2 bytes = {fmt(PER_VERSION_KB)} KB per
        version, times {p.versions}. The timeline is a toy: a GEMM step is one unit and a copy takes{" "}
        {latency} units to land. A copy can start only when the slot it overwrites has been consumed, so the
        loop settles at one iteration per max(1, (L + 1) / versions) units.
      </p>
    </div>
  )
}

function Stat({ k, v, hl, warn }: { k: string; v: string; hl?: boolean; warn?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className={cn("font-mono tabular-nums", hl && "font-semibold", warn && "text-rose-600 dark:text-rose-400")}>{v}</dd>
    </div>
  )
}
