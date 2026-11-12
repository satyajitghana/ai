"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"
import { mcos, mlog, msin } from "@/lib/dmath"

// A toy MoE layer for the selection step of "Pruning and Distilling Mixture-of-Experts
// into Dense Language Models" (arXiv 2605.28207, Section 3.2).
// Each expert has an importance I_e and an average output direction. The paper's kernel is
// K_ij = sqrt(I_i I_j) * G_ij, with G the Gram matrix of expert outputs; here an expert's
// output lives in its group's own 2-D plane, orthogonal to every other group's, so
// G_ij = cos(theta_i - theta_j) inside a group and 0 across groups (block-diagonal, PSD). D-optimal selection
// maximises log det(K_S + lambda I) with lambda = (1 / (K E)) * sum_e K_ee, greedily.
// The experts below are invented to make redundancy visible; the selection maths is the paper's.

type Expert = { id: string; deg: number; imp: number; g: string }

const EXPERTS: Expert[] = [
  { id: "E1", deg: 30, imp: 0.95, g: "a" },
  { id: "E2", deg: 35, imp: 0.92, g: "a" },
  { id: "E3", deg: 25, imp: 0.9, g: "a" },
  { id: "E4", deg: 40, imp: 0.86, g: "a" },
  { id: "E5", deg: 120, imp: 0.58, g: "b" },
  { id: "E6", deg: 125, imp: 0.52, g: "b" },
  { id: "E7", deg: 200, imp: 0.5, g: "c" },
  { id: "E8", deg: 160, imp: 0.4, g: "d" },
  { id: "E9", deg: 300, imp: 0.47, g: "e" },
  { id: "E10", deg: 80, imp: 0.6, g: "f" },
  { id: "E11", deg: 250, imp: 0.36, g: "h" },
  { id: "E12", deg: 335, imp: 0.3, g: "i" },
]

const E = EXPERTS.length
const RAD = Math.PI / 180

function kernel(i: number, j: number) {
  const a = EXPERTS[i]
  const b = EXPERTS[j]
  if (a.g !== b.g) return 0
  return Math.sqrt(a.imp * b.imp) * mcos((a.deg - b.deg) * RAD)
}

// log det of (K_S + lambda I) by Cholesky; S is small.
function logdet(S: number[], lambda: number) {
  const n = S.length
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  let ld = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = kernel(S[i], S[j]) + (i === j ? lambda : 0)
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      if (i === j) {
        const d = Math.sqrt(Math.max(s, 1e-12))
        L[i][i] = d
        ld += 2 * mlog(d)
      } else {
        L[i][j] = s / L[j][j]
      }
    }
  }
  return ld
}

function lambdaFor(K: number) {
  let tr = 0
  for (let e = 0; e < E; e++) tr += kernel(e, e)
  return tr / (K * E)
}

function topByScore(K: number) {
  return EXPERTS.map((e, i) => ({ i, s: e.imp }))
    .sort((a, b) => b.s - a.s)
    .slice(0, K)
    .map((x) => x.i)
}

function greedyDOptimal(K: number) {
  const lambda = lambdaFor(K)
  const S: number[] = []
  while (S.length < K) {
    let best = -1
    let bestVal = -Infinity
    for (let e = 0; e < E; e++) {
      if (S.includes(e)) continue
      const v = logdet([...S, e], lambda)
      if (v > bestVal) {
        bestVal = v
        best = e
      }
    }
    S.push(best)
  }
  return S
}

function nearDuplicates(S: number[]) {
  let n = 0
  for (let a = 0; a < S.length; a++)
    for (let b = a + 1; b < S.length; b++) {
      const x = EXPERTS[S[a]]
      const y = EXPERTS[S[b]]
      if (x.g === y.g && mcos((x.deg - y.deg) * RAD) > 0.98) n++
    }
  return n
}

const W = 220
const C = W / 2
const R = 92

function Dial({ chosen, accent }: { chosen: number[]; accent: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto w-full max-w-[240px]" role="img" aria-label="Expert output directions">
      <circle cx={C} cy={C} r={R} fill="none" className="stroke-muted-foreground/25" strokeDasharray="3 4" />
      {EXPERTS.map((e, i) => {
        const on = chosen.includes(i)
        const len = R * Math.sqrt(e.imp)
        const x = C + len * mcos(e.deg * RAD)
        const y = C - len * msin(e.deg * RAD)
        const lx = C + (len + 12) * mcos(e.deg * RAD)
        const ly = C - (len + 12) * msin(e.deg * RAD)
        return (
          <g key={e.id}>
            <line
              x1={C}
              y1={C}
              x2={x.toFixed(2)}
              y2={y.toFixed(2)}
              stroke={on ? accent : "currentColor"}
              strokeOpacity={on ? 1 : 0.22}
              strokeWidth={on ? 3 : 1.5}
              strokeLinecap="round"
            />
            <text
              x={lx.toFixed(2)}
              y={ly.toFixed(2)}
              textAnchor="middle"
              dominantBaseline="middle"
              className={cn("font-mono text-[9px]", on ? "fill-foreground" : "fill-muted-foreground/60")}
            >
              {e.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function ExpertPicker() {
  const [K, setK] = useState(4)

  const { top, dopt, lambda } = useMemo(() => ({ top: topByScore(K), dopt: greedyDOptimal(K), lambda: lambdaFor(K) }), [K])

  const panels = [
    { key: "top", title: "Top-K by importance", sub: "what frequency-style scores do", S: top, accent: "oklch(0.62 0.16 30)" },
    { key: "dopt", title: "Greedy log-det (D-optimal)", sub: "importance and diversity together", S: dopt, accent: "oklch(0.58 0.14 160)" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MoE to dense · choosing which experts survive</span>
        <span className="text-muted-foreground/60">toy layer, the paper&apos;s selection rule</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div>
          <div className="flex justify-between font-mono text-xs text-muted-foreground">
            <span>experts kept (K = k, pure pruning)</span>
            <span className="text-foreground">
              {K} of {E}
            </span>
          </div>
          <Range min={2} max={6} value={K} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer" aria-label="Experts kept" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {panels.map((p) => {
            const imp = p.S.reduce((s, i) => s + EXPERTS[i].imp, 0)
            const ld = logdet(p.S, lambda)
            const dup = nearDuplicates(p.S)
            return (
              <div key={p.key} className="rounded-lg border p-3">
                <div className="text-sm font-medium">{p.title}</div>
                <div className="mb-2 text-xs text-muted-foreground">{p.sub}</div>
                <Dial chosen={p.S} accent={p.accent} />
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.S.map((i) => (
                    <span key={i} className="rounded border px-1.5 py-0.5 font-mono text-[11px]" style={{ borderColor: p.accent }}>
                      {EXPERTS[i].id}
                    </span>
                  ))}
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-1 font-mono text-[11px]">
                  <div>
                    <dt className="text-muted-foreground">sum of I</dt>
                    <dd>{imp.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">log det</dt>
                    <dd>{ld.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">near-twins</dt>
                    <dd>{dup}</dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>

        <div>
          <div className="mb-1 font-mono text-xs text-muted-foreground">
            then concatenate: the kept experts become one dense FFN, d_dense = k x d_expert
          </div>
          <div className="flex h-7 w-full overflow-hidden rounded-md border">
            {dopt.map((i, n) => (
              <div
                key={i}
                className="flex h-full flex-1 items-center justify-center border-r border-background/70 font-mono text-[10px] text-background"
                style={{ background: `oklch(${0.5 + (n % 2) * 0.08} 0.12 160)` }}
              >
                {EXPERTS[i].id}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            On Qwen3-30B-A3B the paper keeps k = 8 of 128 experts of width 768, so the dense FFN is 6,144 wide. Each block&apos;s
            down-projection is scaled by a fixed factor because no router is left to weight them per token.
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Twelve invented experts. Arrow length is importance; arrows a few degrees apart are near-twins whose outputs mostly
        overlap, and arrows far apart do unrelated work. Top-K grabs the four near-identical generalists around 30 degrees; the
        log-det objective pays for each expert only by what it adds that the chosen ones do not already cover.
      </figcaption>
    </figure>
  )
}
