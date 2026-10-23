"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A toy EAGLE-Harness round: grow a draft tree one depth at a time, stop when
// the next depth is not worth its cost, then verify the top-n nodes.
//
// The rule is the paper's Algorithm 1 (REPORTED, EAGLE-4 paper, Section 3.1):
//   after each depth d, stop if dA_d / c_draft < tau_d, tau_d rising with depth;
//   then add verify nodes in order of path score p while p / dc_verify >= tau_v.
// Path score p = product of draft probabilities along the branch (EAGLE-2).
// Constants taken from eagle_harness/core/cost_model.py (MEASURED, read from
// the repository): base threshold 2.5, +4% per depth (depth_loss_ratio 0.04),
// scaled by a batch-size ratio of 1.25 / 1.5 / 1.75 / 2.0.
// Everything else is mine and illustrative: costs are in plain decode steps,
// only the one-request draft cost (0.034) comes from TokenSpeed's timeline, and
// the draft probabilities are synthetic (a hash of the node id, centred on the
// "confidence" slider). In the real harness the costs come from a profiled
// table, and the threshold units differ.

type Load = { key: string; label: string; K: number; cd: number; dv: number; r: number; mode: string }

const LOADS: Load[] = [
  { key: "1", label: "1 request", K: 4, cd: 0.034, dv: 0.004, r: 1.25, mode: "dynamic tree" },
  { key: "8", label: "8 requests", K: 2, cd: 0.06, dv: 0.03, r: 1.5, mode: "narrow tree" },
  { key: "64", label: "64 requests", K: 1, cd: 0.1, dv: 0.08, r: 1.75, mode: "dynamic chain" },
  { key: "512", label: "512 requests", K: 1, cd: 0.2, dv: 0.06, r: 2.0, mode: "dynamic chain" },
]

const MAX_DEPTH = 12
const MAX_VERIFY = 15
const TAU = 2.5

type Node = { id: number; d: number; slot: number; parent: number; p: number }

// Integer hash -> [0, 1). Only integer ops and one division: identical on server and client.
function u01(a: number, b: number) {
  let h = (a * 2654435761 + b * 40503 + 12345) >>> 0
  h ^= h >>> 15
  h = Math.imul(h, 2246822519) >>> 0
  h ^= h >>> 13
  return (h % 100000) / 100000
}

function round(load: Load, conf: number, seed: number) {
  const nodes: Node[] = [{ id: 0, d: 0, slot: 0, parent: -1, p: 1 }]
  let layer: Node[] = [nodes[0]]
  let nextId = 1
  let depth = 0
  for (let d = 1; d <= MAX_DEPTH; d++) {
    const cand: Node[] = []
    for (const par of layer) {
      const p1 = Math.min(0.99, Math.max(0.05, conf + (u01(par.id * 7 + 1, seed) - 0.5) * 0.36))
      const p2 = (1 - p1) * 0.6
      cand.push({ id: 0, d, slot: 0, parent: par.id, p: par.p * p1 })
      if (load.K > 1) cand.push({ id: 0, d, slot: 0, parent: par.id, p: par.p * p2 })
    }
    cand.sort((x, y) => y.p - x.p)
    layer = cand.slice(0, load.K).map((n, i) => ({ ...n, id: nextId++, slot: i }))
    nodes.push(...layer)
    depth = d
    const gain = layer.reduce((s, n) => s + n.p, 0)
    if (gain / load.cd < TAU * (1 + 0.04 * d) * load.r) break
  }
  const ranked = nodes.slice(1).sort((x, y) => y.p - x.p)
  let n = 0
  while (n < Math.min(MAX_VERIFY, ranked.length) && ranked[n].p / load.dv >= TAU * load.r) n++
  const verified = new Set(ranked.slice(0, n).map((x) => x.id))
  const A = 1 + ranked.slice(0, n).reduce((s, x) => s + x.p, 0)
  const cost = 1 + n * load.dv + depth * load.cd + 0.022
  return { nodes, depth, n, verified, A, cost }
}

export function HarnessTree() {
  const [li, setLi] = useState(0)
  const [conf, setConf] = useState(0.85)
  const [seed, setSeed] = useState(1)
  const load = LOADS[li]
  const r = round(load, conf, seed)

  const W = 640
  const H = 220
  const xOf = (d: number) => 24 + d * 49
  const yOf = (n: Node) => {
    const k = n.d === 0 ? 1 : load.K
    return H / 2 + (n.slot - (k - 1) / 2) * 46
  }
  const byId = new Map(r.nodes.map((n) => [n.id, n]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one round: draft while it pays, verify what pays</span>
        <div className="flex flex-wrap gap-1.5">
          {LOADS.map((l, i) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setLi(i)}
              aria-pressed={li === i}
              className={cn(
                "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
                li === i ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block font-mono text-[11px] text-muted-foreground">
              draft confidence: {conf.toFixed(2)} {conf >= 0.85 ? "(repetitive code, tool output)" : conf <= 0.65 ? "(open-ended prose)" : ""}
            </span>
            <Range min={0.5} max={0.97} step={0.01} value={conf} onChange={(e) => setConf(Number(e.target.value))} aria-label="draft confidence" />
          </label>
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="rounded-sm border px-2 py-1 font-mono text-[10px] hover:bg-foreground/[0.04]"
          >
            another context
          </button>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Draft tree of depth ${r.depth} with ${r.n} nodes verified`}>
          {Array.from({ length: MAX_DEPTH + 1 }, (_, d) => (
            <text key={d} x={xOf(d)} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="9">
              {d === 0 ? "root" : `d${d}`}
            </text>
          ))}
          {r.nodes.slice(1).map((n) => {
            const par = byId.get(n.parent)
            if (!par) return null
            const on = r.verified.has(n.id)
            return (
              <line
                key={`e${n.id}`}
                x1={xOf(par.d)}
                y1={yOf(par).toFixed(1)}
                x2={xOf(n.d)}
                y2={yOf(n).toFixed(1)}
                className={on ? "stroke-blue-500" : "stroke-foreground/25"}
                strokeWidth={on ? 2 : 1}
              />
            )
          })}
          {r.nodes.map((n) => {
            const on = n.d === 0 || r.verified.has(n.id)
            return (
              <g key={n.id}>
                <circle
                  cx={xOf(n.d)}
                  cy={yOf(n).toFixed(1)}
                  r={n.d === 0 ? 7 : 6}
                  className={
                    n.d === 0 ? "fill-foreground" : on ? "fill-blue-500 stroke-blue-500" : "fill-background stroke-foreground/40"
                  }
                  strokeWidth={1.5}
                >
                  <title>{n.d === 0 ? "last accepted token" : `depth ${n.d}, path score ${n.p.toFixed(3)}`}</title>
                </circle>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">shape</div>
            <div className="tabular-nums">
              {load.mode}, depth {r.depth}
            </div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">verified nodes</div>
            <div className="tabular-nums">
              {r.n} of {r.nodes.length - 1} drafted
            </div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">expected tokens</div>
            <div className="tabular-nums">{r.A.toFixed(2)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-muted-foreground">tokens per plain step</div>
            <div className="tabular-nums text-blue-600 dark:text-blue-400">{(r.A / r.cost).toFixed(2)}</div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Blue nodes go to the target for verification; hollow ones were drafted and dropped. Expected tokens = 1 bonus token + the
        sum of the verified nodes&apos; path scores. The stop and verify rules follow the paper&apos;s Algorithm 1 with the
        repository&apos;s threshold constants; the probabilities and the costs above one request are illustrative.
      </figcaption>
    </figure>
  )
}
