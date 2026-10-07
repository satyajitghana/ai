"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Mechanism explainer for family 032, "The rational Hodge conjecture for CM
// abelian varieties" (openai/math, commit adc7f1241), Sections 1.2 and 2-3.
//
// A CM type is encoded as an odd sign function v on the embeddings of a Galois
// CM field E: v(c·tau) = -v(tau). The weight-one Hodge structure U(v) has its
// tau-line of type (1,0) when v(tau) = +1 and (0,1) when v(tau) = -1. The paper's
// basic building block is the four-factor line
//   U(v1)_1 ⊗ U(v2)_1 ⊗ U(v3)_c ⊗ U(v4)_c   inside H^4 of B(v1)×B(v2)×B(v3)×B(v4).
// Under a scalar conjugate tau, the first two factors are holomorphic when
// v1(tau), v2(tau) = +1 and the last two (read at c·tau) when v3(tau), v4(tau) = -1.
// So the line has type (p, 4-p) with p = [v1=+] + [v2=+] + [v3=-] + [v4=-], and
// it is of type (2,2) in EVERY conjugate exactly when v1 + v2 = v3 + v4.
// Only integers reach the DOM; no transcendental math is used.

const N = 5 // embedding pairs {tau, c·tau} shown as columns
type Sign = 1 | -1
type Grid = Sign[][] // 4 rows (v1..v4) × N columns (representative tau's)

const START: Grid = [
  [1, 1, -1, 1, -1],
  [1, -1, -1, -1, 1],
  [1, 1, -1, -1, -1],
  [1, -1, -1, 1, 1],
]

const ROW_LABEL = ["v₁", "v₂", "v₃", "v₄"]
const ROW_ROLE = ["read at 1", "read at 1", "read at c", "read at c"]

function holomorphicCount(g: Grid, j: number): number {
  return (g[0][j] === 1 ? 1 : 0) + (g[1][j] === 1 ? 1 : 0) + (g[2][j] === -1 ? 1 : 0) + (g[3][j] === -1 ? 1 : 0)
}

function coin(): Sign {
  return Math.random() < 0.5 ? 1 : -1
}

function randomBalanced(): Grid {
  const g: Grid = [[], [], [], []]
  for (let j = 0; j < N; j++) {
    const a = coin()
    const b = coin()
    g[0].push(a)
    g[1].push(b)
    if (a === b) {
      g[2].push(a)
      g[3].push(a)
    } else {
      const s = coin()
      g[2].push(s)
      g[3].push(s === 1 ? -1 : 1)
    }
  }
  return g
}

function randomAny(): Grid {
  return [0, 1, 2, 3].map(() => Array.from({ length: N }, coin))
}

function signText(s: Sign) {
  return s === 1 ? "+" : "−"
}

export function CmFourFactorSwitch() {
  const [g, setG] = useState<Grid>(START)

  const counts = Array.from({ length: N }, (_, j) => holomorphicCount(g, j))
  const balanced = counts.every((p) => p === 2)
  const bad = counts.filter((p) => p !== 2).length

  function flip(i: number, j: number) {
    setG((prev) => prev.map((row, r) => row.map((s, c) => (r === i && c === j ? ((s === 1 ? -1 : 1) as Sign) : s))))
  }

  return (
    <figure className="my-8 rounded-xl border border-border bg-card p-4 not-prose">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setG(randomBalanced())}
          className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-foreground/5"
        >
          random balanced
        </button>
        <button
          type="button"
          onClick={() => setG(randomAny())}
          className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-foreground/5"
        >
          random
        </button>
        <button
          type="button"
          onClick={() => setG(START)}
          className="rounded-full border border-border px-3 py-0.5 text-xs hover:bg-foreground/5"
        >
          reset
        </button>
        <span className="text-xs text-muted-foreground">click a sign to flip it</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="py-1 pr-3 text-left font-normal">CM type</th>
              {counts.map((_, j) => (
                <th key={j} className="px-1 py-1 text-center font-normal">
                  τ<sub>{j + 1}</sub>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {g.map((row, i) => (
              <tr key={i} className={cn(i === 2 && "border-t border-border")}>
                <td className="py-1 pr-3 text-xs">
                  <span className="font-mono">{ROW_LABEL[i]}</span>{" "}
                  <span className="text-muted-foreground">{ROW_ROLE[i]}</span>
                </td>
                {row.map((s, j) => {
                  const holo = i < 2 ? s === 1 : s === -1
                  return (
                    <td key={j} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        aria-label={`${ROW_LABEL[i]} at tau ${j + 1} is ${s === 1 ? "plus" : "minus"}`}
                        onClick={() => flip(i, j)}
                        className={cn(
                          "h-8 w-8 rounded-md border font-mono",
                          holo
                            ? "border-violet-500/50 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {signText(s)}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr className="border-t border-border text-xs">
              <td className="py-1.5 pr-3 text-muted-foreground">type at τ</td>
              {counts.map((p, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-1 py-1.5 text-center font-mono tabular-nums",
                    p === 2 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                  )}
                >
                  ({p},{4 - p})
                </td>
              ))}
            </tr>
            <tr className="text-xs">
              <td className="py-1 pr-3 text-muted-foreground">v₁+v₂ vs v₃+v₄</td>
              {counts.map((_, j) => {
                const l = g[0][j] + g[1][j]
                const r = g[2][j] + g[3][j]
                return (
                  <td key={j} className="px-1 py-1 text-center font-mono tabular-nums text-muted-foreground">
                    {l === r ? `${l}=${r}` : `${l}≠${r}`}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <p
        className={cn(
          "mt-3 rounded-md px-3 py-2 text-sm",
          balanced
            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "bg-rose-500/10 text-rose-800 dark:text-rose-200",
        )}
      >
        {balanced
          ? "Balanced: the line has type (2,2) under every conjugate, so it lies in the Hodge classes of B(v₁)×B(v₂)×B(v₃)×B(v₄). The paper's claim is that it is algebraic: a surface S with maps to the four factors whose four pulled-back one-forms have a nonzero integral over S cuts out the cycle."
          : `Not balanced: ${bad} of ${N} conjugates give a type other than (2,2), so this line is not a Hodge class and the Hodge conjecture asks nothing about it.`}
      </p>

      <figcaption className="mt-3 text-xs text-muted-foreground">
        The four-factor relation behind the CM Hodge paper (family 032). Each row is a CM type, written as
        a sign on one embedding from each conjugate pair; violet cells are holomorphic factors. A column
        has type (p, 4−p), where p counts violet cells, and every column is (2,2) exactly when
        v₁+v₂ = v₃+v₄. The paper builds every balanced CM tensor out of these four-factor pieces by
        two-row switches and polarization contractions. This toy checks only the Hodge-type bookkeeping;
        the hard part of the paper is producing the surface, and nothing here verifies that.
      </figcaption>
    </figure>
  )
}
