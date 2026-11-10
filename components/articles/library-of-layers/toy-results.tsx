"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { PRIMS, RUNS, type Run } from "./toy-data"

// Measured on CPU (PyTorch 2.14.1, 2 threads), 3,000 steps x 256 examples per
// run, 3 seeds per model. Task: 8 digits mod 10 and a 3-step program over 4
// primitives; 48 of the 64 programs are trained, 16 are held out. Accuracy is
// exact match of all 8 output digits on 4,096 fresh examples.

const COL: Record<string, string> = {
  train: "oklch(0.7 0.13 230)",
  held: "oklch(0.75 0.15 60)",
  forced: "oklch(0.7 0.15 20)",
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function ToyResults() {
  const [sel, setSel] = useState<string>(RUNS[3].id)
  const run: Run = RUNS.find((r) => r.id === sel) ?? RUNS[0]
  const W = 560
  const rowH = 38
  const padL = 150
  const H = RUNS.length * rowH + 30
  const x = (v: number) => padL + (W - padL - 20) * v

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">toy LoL · measured, 3 seeds each</span>
        <span className="flex gap-3 font-mono text-[10px] text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COL.train }} />trained programs</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COL.held }} />held-out programs</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: COL.forced }} />held-out, forced path</span>
        </span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img"
            aria-label="Exact-match accuracy on trained and held-out programs for each toy model">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={6} y2={H - 20} className="stroke-muted-foreground/20" />
                <text x={x(t)} y={H - 6} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">{`${t * 100}%`}</text>
              </g>
            ))}
            {RUNS.map((r, i) => {
              const y = 8 + i * rowH
              const bars: [string, number[] | undefined][] = [["train", r.train], ["held", r.held], ["forced", r.forced]]
              return (
                <g key={r.id} onClick={() => setSel(r.id)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y - 3} width={W} height={rowH - 2} rx={4}
                    className={cn(sel === r.id ? "fill-muted/60" : "fill-transparent")} />
                  <text x={6} y={y + 12} fontSize={10.5} className="fill-foreground font-mono">{r.label}</text>
                  <text x={6} y={y + 25} fontSize={8.5} className="fill-muted-foreground font-mono">{r.sub}</text>
                  {bars.map(([k, v], j) => v && (
                    <g key={k}>
                      <rect x={padL} y={y + j * 10} width={Math.max(1, x(mean(v)) - padL)} height={8} rx={2} fill={COL[k]} />
                      {v.map((s, si) => (
                        <circle key={si} cx={x(s)} cy={y + j * 10 + 4} r={2} className="fill-foreground/70" />
                      ))}
                      <text x={Math.min(W - 4, x(mean(v)) + 6)} y={y + j * 10 + 7.5} fontSize={8} className="fill-muted-foreground font-mono">
                        {`${(100 * mean(v)).toFixed(1)}%`}
                      </text>
                    </g>
                  ))}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="rounded-lg border px-3 py-3 font-mono text-xs">
          <div className="mb-2 text-muted-foreground">{run.label}: {run.detail}</div>
          {run.maps ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {run.maps.map((m, si) => (
                <div key={si}>
                  <div className="mb-1 text-muted-foreground">seed {si}: block chosen per (step, primitive)</div>
                  <table className="w-full text-center">
                    <thead>
                      <tr><th className="text-left font-normal text-muted-foreground">step</th>{PRIMS.map((p) => <th key={p} className="font-normal text-muted-foreground">{p}</th>)}</tr>
                    </thead>
                    <tbody>
                      {m.map((row, l) => (
                        <tr key={l}>
                          <td className="text-left text-muted-foreground">{l + 1}</td>
                          {row.map((b, k) => <td key={k} className="font-semibold">{`E${b + 1}`}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {run.purity && (
                    <div className="mt-1 text-muted-foreground">purity {run.purity[si].map((p) => p.toFixed(2)).join(" / ")}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No router: every input runs the same blocks in the same order.</div>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Click a row. For the routed models the table shows which library block the trained router picks for each
          primitive at each program step (the most common choice over 4,096 trained-program examples), and purity is the
          share of examples whose block matches that choice. A router that has found the primitives shows four
          different blocks in a row and purity near 1.
        </p>
      </div>
    </figure>
  )
}
