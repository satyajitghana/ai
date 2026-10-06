"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of LoopCD-Logits (arXiv 2610.02185, Eq. 3 and Eq. 4) over six tokens.
// The two logit vectors are invented for illustration; nothing here is a number
// from the paper. What is faithful is the arithmetic:
//   z' = zR + w (zR - z1)                         (paper Eq. 3)
//   w  = wmax [1 - (pR(1) - pR(2))]              (paper Eq. 4, adaptive)
//   keep v only if pR(v) >= alpha * max pR       (Li et al.'s plausibility
//                                                  constraint; LoopCD does not use it)
// The toy is built so that the final loop narrowly prefers "12", the first loop
// preferred "12" by more, and "15" is the token the loops were raising. A junk
// token the first loop all but ruled out has the largest contrast of all, which
// is what goes wrong at large strength without a guard.

const TOKENS = ["12", "15", "20", "x", "so", "banana"]
const Z_FINAL = [2.3, 1.9, 0.6, 0.2, -0.3, -0.6]
const Z_FIRST = [2.5, 0.8, 0.7, 0.9, 0.4, -4.2]

const C_FIRST = "oklch(0.66 0.13 45)"
const C_FINAL = "oklch(0.62 0.11 150)"
const C_GUIDED = "oklch(0.6 0.13 250)"

function softmax(z: number[], keep?: boolean[]): number[] {
  const live = z.map((v, i) => (keep && !keep[i] ? -Infinity : v))
  const m = Math.max(...live)
  const e = live.map((v) => (v === -Infinity ? 0 : mexp(v - m)))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function argmax(p: number[]): number {
  let best = 0
  for (let i = 1; i < p.length; i++) if (p[i] > p[best]) best = i
  return best
}

export function ContrastLab() {
  const [omega, setOmega] = useState(0.5)
  const [alpha, setAlpha] = useState(0)
  const [adaptive, setAdaptive] = useState(false)

  const pFinal = softmax(Z_FINAL)
  const pFirst = softmax(Z_FIRST)
  const sorted = [...pFinal].sort((a, b) => b - a)
  const margin = sorted[0] - sorted[1]
  const w = adaptive ? omega * (1 - margin) : omega

  const zGuided = Z_FINAL.map((z, i) => z + w * (z - Z_FIRST[i]))
  const pMax = Math.max(...pFinal)
  const keep = pFinal.map((p) => p >= alpha * pMax)
  const pGuided = softmax(zGuided, keep)

  const aFinal = argmax(pFinal)
  const aGuided = argmax(pGuided)
  const flipped = aFinal !== aGuided
  const junk = TOKENS[aGuided] === "banana"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">contrast lab · toy logits, illustrative</span>
        <button
          type="button"
          onClick={() => setAdaptive((a) => !a)}
          aria-pressed={adaptive}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            adaptive
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {adaptive ? "adaptive strength (Eq. 4): on" : "adaptive strength (Eq. 4): off"}
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>{adaptive ? "cap ω_max" : "strength ω"}</span>
              <span className="text-base font-semibold" style={{ color: C_GUIDED }}>
                {omega.toFixed(2)}
              </span>
            </span>
            <Range
              min={0}
              max={1.6}
              step={0.05}
              value={omega}
              accent={C_GUIDED}
              onChange={(e) => setOmega(Number(e.target.value))}
              aria-label="Guidance strength omega"
              className="mt-1 w-full"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              applied ω = {w.toFixed(3)}
              {adaptive ? ` (margin pR(1) − pR(2) = ${margin.toFixed(3)})` : ""}
            </span>
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>plausibility α (Li et al.; not in LoopCD)</span>
              <span className="text-base font-semibold">{alpha.toFixed(2)}</span>
            </span>
            <Range
              min={0}
              max={0.5}
              step={0.01}
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              aria-label="Plausibility threshold alpha"
              className="mt-1 w-full"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              keeps a token only if pR ≥ α · max pR = {(alpha * pMax).toFixed(3)}
            </span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">token</th>
                <th className="py-1 pr-2 font-normal">z₁</th>
                <th className="py-1 pr-2 font-normal">z_R</th>
                <th className="py-1 pr-2 font-normal">z_R − z₁</th>
                <th className="w-1/2 py-1 font-normal">probability: first loop · final loop · guided</th>
              </tr>
            </thead>
            <tbody>
              {TOKENS.map((t, i) => {
                const d = Z_FINAL[i] - Z_FIRST[i]
                return (
                  <tr key={t} className={cn("border-t border-border/60", !keep[i] && "opacity-40")}>
                    <td className="py-1.5 pr-2 font-semibold">
                      {t}
                      {i === aGuided ? <span style={{ color: C_GUIDED }}> ◂</span> : null}
                    </td>
                    <td className="py-1.5 pr-2">{Z_FIRST[i].toFixed(1)}</td>
                    <td className="py-1.5 pr-2">{Z_FINAL[i].toFixed(1)}</td>
                    <td className="py-1.5 pr-2" style={{ color: d > 0 ? C_FINAL : C_FIRST }}>
                      {d > 0 ? "+" : ""}
                      {d.toFixed(1)}
                    </td>
                    <td className="py-1.5">
                      <Bar p={pFirst[i]} color={C_FIRST} />
                      <Bar p={pFinal[i]} color={C_FINAL} />
                      <Bar p={pGuided[i]} color={C_GUIDED} strong />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed" aria-live="polite">
          {junk
            ? `The guided pick is "banana": the first loop all but ruled it out, so its contrast (+3.6) is the largest in the vocabulary, and at this strength it outruns every real candidate. It takes over once the applied ω passes 1.0. Raise α above about 0.06 and the plausibility mask removes it; the adaptive rule only delays it, because a cap above about 1.19 still applies more than 1.0 here.`
            : flipped
              ? `The guided pick flips from "${TOKENS[aFinal]}" to "${TOKENS[aGuided]}". The final loop preferred "12" by 0.4 logits, but between the first loop and the last, "15" gained 1.1 while "12" lost 0.2, so continuing that motion closes a 0.4 gap at ω ≈ 0.31.`
              : `The guided pick stays "${TOKENS[aGuided]}". At this strength the push along z_R − z₁ is smaller than the 0.4-logit gap between "12" and "15".`}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Bars, top to bottom: the first loop&apos;s softmax(z₁), the final loop&apos;s softmax(z_R), and the guided softmax(z′) with
          z′ = z_R + ω(z_R − z₁). Toy numbers chosen to show the mechanism; none of them come from the paper.
        </p>
      </div>
    </figure>
  )
}

function Bar({ p, color, strong }: { p: number; color: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full rounded-full"
          style={{ width: `${(p * 100).toFixed(1)}%`, background: color, opacity: strong ? 1 : 0.7 }}
        />
      </div>
      <span className={cn("w-10 text-right tabular-nums", strong ? "text-foreground" : "text-muted-foreground")}>
        {(p * 100).toFixed(1)}%
      </span>
    </div>
  )
}
