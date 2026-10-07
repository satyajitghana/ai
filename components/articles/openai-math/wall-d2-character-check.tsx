"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Mechanism explainer for family 321 (A Counterexample to Wall's D(2) Problem,
// openai/math, October 6, 2026). The reader assigns each generator of
//   P = < x1, a1, x2, a2, s | x1 a1 x1^-1 = a1^4, x2 a2 x2^-1 = a2^3,
//                             x1 = a2^13,        s x2 s^-1 = a1^5 >
// a sixth root of unity. The widget checks the four relators and the two extra
// relations t1 = x1^2, t2 = x2^3 (so the character descends to G = P/K), then
// computes the twisted second boundary matrix by Fox calculus and its rank.
// Arithmetic is exact: every sixth root of unity is an Eisenstein integer
// a + b*w with w = exp(2 pi i / 3), so no floating point reaches the DOM.

type Gen = "x1" | "a1" | "x2" | "a2" | "s"
const GENS: Gen[] = ["x1", "a1", "x2", "a2", "s"]

// Eisenstein integer a + b w, with w^2 = -1 - w.
type E = [number, number]
const ZERO: E = [0, 0]
const add = (p: E, q: E): E => [p[0] + q[0], p[1] + q[1]]
const sub = (p: E, q: E): E => [p[0] - q[0], p[1] - q[1]]
const mul = (p: E, q: E): E => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0] - p[1] * q[1]]
const isZero = (p: E) => p[0] === 0 && p[1] === 0

// exp(2 pi i k / 6) for k = 0..5 as Eisenstein integers.
const ROOT: E[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
]
const ROOT_LABEL = ["1", "−ζ²", "ζ", "−1", "ζ²", "−ζ"]
const mod6 = (k: number) => ((k % 6) + 6) % 6

// A relator is a word: list of [generator, +1 | -1].
type Letter = [Gen, 1 | -1]
const pow = (g: Gen, n: number): Letter[] => Array.from({ length: Math.abs(n) }, () => [g, n > 0 ? 1 : -1] as Letter)

const RELATORS: { word: Letter[]; tex: string }[] = [
  { word: [["x1", 1], ["a1", 1], ["x1", -1], ...pow("a1", -4)], tex: "x₁a₁x₁⁻¹ = a₁⁴" },
  { word: [["x2", 1], ["a2", 1], ["x2", -1], ...pow("a2", -3)], tex: "x₂a₂x₂⁻¹ = a₂³" },
  { word: [["x1", 1], ...pow("a2", -13)], tex: "x₁ = a₂¹³" },
  { word: [["s", 1], ["x2", 1], ["s", -1], ...pow("a1", -5)], tex: "s x₂ s⁻¹ = a₁⁵" },
]
const KILLED: { word: Letter[]; tex: string }[] = [
  { word: pow("x1", 2), tex: "t₁ = x₁²" },
  { word: pow("x2", 3), tex: "t₂ = x₂³" },
]

type Assign = Record<Gen, number>

const evalWord = (w: Letter[], k: Assign) => mod6(w.reduce((acc, [g, e]) => acc + e * k[g], 0))

// Fox derivative of a word with respect to g, evaluated at the character.
function fox(w: Letter[], g: Gen, k: Assign): E {
  let total: E = ZERO
  let prefix = 0
  for (const [h, e] of w) {
    if (h === g) {
      total = e === 1 ? add(total, ROOT[mod6(prefix)]) : sub(total, ROOT[mod6(prefix - k[h])])
    }
    prefix += e * k[h]
  }
  return total
}

function det(m: E[][]): E {
  if (m.length === 1) return m[0][0]
  let acc: E = ZERO
  m[0].forEach((entry, j) => {
    if (isZero(entry)) return
    const minor = m.slice(1).map((row) => row.filter((_, c) => c !== j))
    const term = mul(entry, det(minor))
    acc = j % 2 === 0 ? add(acc, term) : sub(acc, term)
  })
  return acc
}

function fmt(p: E): string {
  const [a, b] = p
  if (b === 0) return a < 0 ? `−${-a}` : `${a}`
  const bz = b === 1 ? "ζ" : b === -1 ? "−ζ" : b < 0 ? `−${-b}ζ` : `${b}ζ`
  if (a === 0) return bz
  const sign = b < 0 ? " − " : " + "
  const mag = Math.abs(b) === 1 ? "ζ" : `${Math.abs(b)}ζ`
  return `${a < 0 ? `−${-a}` : a}${sign}${mag}`
}

const PAPER: Assign = { x1: 3, a1: 2, x2: 4, a2: 3, s: 0 }
const TRIVIAL: Assign = { x1: 0, a1: 0, x2: 0, a2: 0, s: 0 }

export function WallD2CharacterCheck() {
  const [k, setK] = useState<Assign>(PAPER)

  const result = useMemo(() => {
    const rel = RELATORS.map((r) => evalWord(r.word, k) === 0)
    const kill = KILLED.map((r) => evalWord(r.word, k) === 0)
    const D = RELATORS.map((r) => GENS.map((g) => fox(r.word, g, k)))
    // Rank 4 over C iff some 4x4 minor is nonzero; there are five (drop one column).
    const minors = GENS.map((_, drop) => det(D.map((row) => row.filter((_, c) => c !== drop))))
    // Prefer the paper's minor (columns x1, a1, x2, s: drop a2) when it is nonzero.
    const full = !isZero(minors[3]) ? 3 : minors.findIndex((m) => !isZero(m))
    return { rel, kill, D, minors, full }
  }, [k])

  const valid = result.rel.every(Boolean) && result.kill.every(Boolean)
  const h2zero = result.full >= 0
  const torsion = k.x1 !== 0
  const obstructs = valid && h2zero && torsion

  return (
    <figure className="my-8 rounded-xl border border-border bg-card p-4 not-prose">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">presets</span>
        <button
          type="button"
          onClick={() => setK(PAPER)}
          className="rounded-full border border-border px-2.5 py-0.5 hover:bg-foreground/10"
        >
          the paper&apos;s character
        </button>
        <button
          type="button"
          onClick={() => setK(TRIVIAL)}
          className="rounded-full border border-border px-2.5 py-0.5 hover:bg-foreground/10"
        >
          trivial character
        </button>
      </div>

      <div className="mt-3 grid gap-1.5 text-sm">
        {GENS.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-1.5">
            <span className="w-16 font-mono text-xs text-muted-foreground">ρ({g})</span>
            {ROOT_LABEL.map((lab, i) => (
              <button
                key={lab}
                type="button"
                aria-pressed={k[g] === i}
                onClick={() => setK({ ...k, [g]: i })}
                className={cn(
                  "min-w-[2.6rem] rounded border px-1.5 py-0.5 font-mono text-xs",
                  k[g] === i ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground",
                )}
              >
                {lab}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">relations of P, then the two killed elements</p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {RELATORS.map((r, i) => (
              <li key={r.tex} className={result.rel[i] ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                {result.rel[i] ? "✓" : "✗"} {r.tex}
              </li>
            ))}
            {KILLED.map((r, i) => (
              <li key={r.tex} className={result.kill[i] ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                {result.kill[i] ? "✓" : "✗"} ρ({r.tex.split(" = ")[1]}) = 1, so {r.tex.split(" = ")[0]} ↦ 1
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">twisted boundary C₂ → C₁ (Fox derivatives at ρ; ζ = e^(2πi/3))</p>
          <div className="mt-1 overflow-x-auto">
            <table className="border-collapse font-mono text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pr-2 font-normal" />
                  {GENS.map((g) => (
                    <th key={g} className="px-1.5 font-normal">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.D.map((row, i) => (
                  <tr key={i}>
                    <td className="pr-2 text-muted-foreground">r{i + 1}</td>
                    {row.map((e, j) => (
                      <td key={j} className="px-1.5 text-center tabular-nums">
                        {fmt(e)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs">
            {valid
              ? h2zero
                ? `rank 4 (minor without column ${GENS[result.full]} = ${fmt(result.minors[result.full])}), so H₂(B; L_ρ) = 0`
                : "rank < 4, so H₂(B; L_ρ) ≠ 0"
              : "ρ is not a character of G, so the matrix means nothing yet"}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "mt-4 rounded-md px-3 py-2 text-sm",
          obstructs ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100" : "bg-muted text-muted-foreground",
        )}
      >
        {obstructs
          ? "Obstruction found: x₁ has order 2 in G and ρ(x₁) ≠ 1, yet twisted H₂ vanishes. No finite 2-complex can have this, so the D(2) complex X has no 2-dimensional model."
          : !valid
            ? "Pick values satisfying all six checks: only then is ρ a character of G = P/K."
            : !h2zero
              ? "Twisted H₂ is nonzero, so the tower lemma says nothing about this character."
              : "ρ(x₁) = 1: the character does not see the order-2 element, so there is no contradiction."}
      </p>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        The presentation and the character are from the paper (Section 4, equations 10, 14, 15); the matrix is
        recomputed here by Fox calculus in exact Eisenstein-integer arithmetic. The paper&apos;s character gives the
        minor −4(1 − ζ²) on columns x₁, a₁, x₂, s. Perfectness of K and the tower lemma are proved in the paper,
        not here.
      </figcaption>
    </figure>
  )
}
