"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { SCHEMES, type Scheme } from "./round2-data"

// Measured: lol_toy.py, second round. Every scheme here is handed its routing;
// nothing is learned about the order. What changes is how the routing relates
// to the program. Grids show seed 0's assignment (the per-step relabelling and
// the program-id paths are drawn per seed from random.Random(seed + 7)).

const PRIMS = ["inc", "rev", "rot", "mul3"]

const GRIDS: Record<string, number[][] | null> = {
  dense: [[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2]],
  oracle: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
  unshared: [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11]],
  // seed 0: STEP_PERM = [[0,1,2,3],[2,0,1,3],[0,2,3,1]]
  perm: [[0, 1, 2, 3], [2, 0, 1, 3], [0, 2, 3, 1]],
  scrambled: null,
}

// seed 0 paths for four programs (program tuple -> block per step)
const SCRAMBLED: [string, number[]][] = [
  ["inc · rev · rot", [1, 2, 3]],
  ["inc · rev · mul3", [1, 0, 2]],
  ["mul3 · rot · rev", [2, 1, 2]],
  ["rev · rev · rev", [0, 0, 2]],
]

const HUE = [230, 30, 150, 300, 200, 60, 120, 340, 260, 90, 180, 10]
const fill = (b: number) => `oklch(0.72 0.12 ${HUE[b % HUE.length]})`

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const pct = (v: number) => `${(100 * v).toFixed(1)}%`

function Grid({ s }: { s: Scheme }) {
  const grid = GRIDS[s.id]
  if (!grid) {
    return (
      <table className="w-full text-center">
        <thead>
          <tr>
            <th className="text-left font-normal text-muted-foreground">program</th>
            {[1, 2, 3].map((k) => <th key={k} className="font-normal text-muted-foreground">{`step ${k}`}</th>)}
          </tr>
        </thead>
        <tbody>
          {SCRAMBLED.map(([name, path]) => (
            <tr key={name}>
              <td className="py-0.5 text-left text-muted-foreground">{name}</td>
              {path.map((b, k) => (
                <td key={k} className="py-0.5">
                  <span className="inline-block min-w-[2.2rem] rounded px-1 font-semibold text-black" style={{ background: fill(b) }}>{`E${b + 1}`}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  return (
    <table className="w-full text-center">
      <thead>
        <tr>
          <th className="text-left font-normal text-muted-foreground">step</th>
          {PRIMS.map((p) => <th key={p} className="font-normal text-muted-foreground">{p}</th>)}
        </tr>
      </thead>
      <tbody>
        {grid.map((row, l) => (
          <tr key={l}>
            <td className="py-0.5 text-left text-muted-foreground">{l + 1}</td>
            {row.map((b, k) => (
              <td key={k} className="py-0.5">
                <span className="inline-block min-w-[2.2rem] rounded px-1 font-semibold text-black" style={{ background: fill(b) }}>{`E${b + 1}`}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function RoutingSchemes() {
  const [sel, setSel] = useState("oracle")
  const s = SCHEMES.find((x) => x.id === sel) ?? SCHEMES[0]
  const W = 560
  const rowH = 30
  const padL = 190
  const H = SCHEMES.length * rowH + 26
  const x = (v: number) => padL + (W - padL - 46) * v
  const denseMean = mean(SCHEMES[0].held)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">routing given, not learned · measured</span>
        <span className="font-mono text-[10px] text-muted-foreground">held-out programs, exact match · dots are seeds</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[480px]" role="img"
            aria-label="Held-out accuracy for five ways of assigning blocks to program steps">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={4} y2={H - 18} className="stroke-muted-foreground/20" />
                <text x={x(t)} y={H - 5} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">{`${t * 100}%`}</text>
              </g>
            ))}
            <line x1={x(denseMean)} x2={x(denseMean)} y1={4} y2={H - 18} strokeDasharray="3 3" className="stroke-foreground/40" />
            {SCHEMES.map((r, i) => {
              const y = 6 + i * rowH
              const m = mean(r.held)
              return (
                <g key={r.id} onClick={() => setSel(r.id)} style={{ cursor: "pointer" }}>
                  <rect x={0} y={y - 2} width={W} height={rowH - 3} rx={4}
                    className={cn(sel === r.id ? "fill-muted/60" : "fill-transparent")} />
                  <text x={6} y={y + 11} fontSize={10.5} className="fill-foreground font-mono">{r.label}</text>
                  <text x={6} y={y + 22} fontSize={8.5} className="fill-muted-foreground font-mono">{`${r.blocks} blocks · ${(r.params / 1000).toFixed(0)}k params`}</text>
                  <rect x={padL} y={y + 6} width={Math.max(1, x(m) - padL)} height={10} rx={2} fill="oklch(0.75 0.15 60)" />
                  {r.held.map((v, si) => <circle key={si} cx={x(v)} cy={y + 11} r={2.3} className="fill-foreground/75" />)}
                  <text x={Math.min(W - 40, Math.max(x(m), x(Math.max(...r.held))) + 6)} y={y + 14.5} fontSize={9} className="fill-muted-foreground font-mono">{pct(m)}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="grid gap-4 rounded-lg border px-3 py-3 font-mono text-xs sm:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="mb-2 text-muted-foreground">{s.label}: {s.detail}</div>
            <Grid s={s} />
          </div>
          <div className="space-y-1 text-muted-foreground">
            <div>trained programs: {s.train.map(pct).join(" · ")}</div>
            <div>held-out programs: {s.held.map(pct).join(" · ")}</div>
            <div>mean held-out: <span className="font-semibold text-foreground">{pct(mean(s.held))}</span> over {s.held.length} seeds</div>
            <div>dashed line: the dense model&apos;s mean, {pct(denseMean)}</div>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every row is handed its routing, so this isolates what kind of path helps on the 16 unseen programs. A
          path that follows the primitives transfers; the same four blocks on a path keyed to the program&apos;s identity
          fit every trained program and transfer nothing. Grids show seed 0&apos;s assignment; click a row.
        </p>
      </div>
    </figure>
  )
}
