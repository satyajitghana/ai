"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// Exact total-variation distance from uniform for the Thorp shuffle on 4 and 8
// cards, computed in the browser by pushing the full permutation law through
// every coin pattern (8! = 40,320 states, 16 coin patterns per shuffle). This is
// family 238 of openai/math: the papers prove the distance tends to zero after
// 1600 d shuffles of 2^d cards (Lean: 16,040,400 d), and that it stays near one
// for fewer than about 2d shuffles because a shuffle uses only n/2 coins:
// TV >= 1 - 2^(t n / 2) / n!. Small decks cannot show an asymptotic theorem;
// they show the two regimes and what the lower bound means.
//
// One Thorp shuffle: cut the deck into halves L and R; for each i, a fair coin
// decides whether L[i] or R[i] goes on top in output positions 2i, 2i+1.

type Curve = { d: number; n: number; tv: number[]; lower: number[] }

function factorial(n: number): number {
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

function encode(p: number[]): number {
  // Lehmer code -> index in [0, n!)
  const n = p.length
  let idx = 0
  for (let i = 0; i < n; i++) {
    let smaller = 0
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) smaller++
    idx = idx * (n - i) + smaller
  }
  return idx
}

function decode(idx: number, n: number, out: number[]): void {
  const digits = new Array<number>(n)
  for (let i = n - 1; i >= 0; i--) {
    const base = n - i
    digits[i] = idx % base
    idx = Math.floor(idx / base)
  }
  const avail: number[] = []
  for (let i = 0; i < n; i++) avail.push(i)
  for (let i = 0; i < n; i++) out[i] = avail.splice(digits[i], 1)[0]
}

function curve(d: number, steps: number): Curve {
  const n = 1 << d
  const half = n / 2
  const nf = factorial(n)
  const coins = 1 << half
  let law = new Float64Array(nf)
  const id: number[] = []
  for (let i = 0; i < n; i++) id.push(i)
  law[encode(id)] = 1
  const deck = new Array<number>(n)
  const next = new Array<number>(n)
  const tv: number[] = []
  const lower: number[] = []
  let support = 1
  for (let t = 0; t <= steps; t++) {
    let s = 0
    for (let k = 0; k < nf; k++) s += Math.abs(law[k] - 1 / nf)
    tv.push(s / 2)
    lower.push(Math.max(0, 1 - support / nf))
    if (t === steps) break
    support *= coins
    const out = new Float64Array(nf)
    for (let k = 0; k < nf; k++) {
      const m = law[k]
      if (m === 0) continue
      decode(k, n, deck)
      const share = m / coins
      for (let c = 0; c < coins; c++) {
        for (let i = 0; i < half; i++) {
          const swap = (c >> i) & 1
          next[2 * i] = swap ? deck[i + half] : deck[i]
          next[2 * i + 1] = swap ? deck[i] : deck[i + half]
        }
        out[encode(next)] += share
      }
    }
    law = out
  }
  return { d, n, tv, lower }
}

export function ThorpExactMixing() {
  const [curves, setCurves] = useState<Curve[] | null>(null)
  const [d, setD] = useState(3)

  useEffect(() => {
    const id = setTimeout(() => setCurves([curve(2, 8), curve(3, 12)]), 30)
    return () => clearTimeout(id)
  }, [])

  const c = curves?.find((x) => x.d === d)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">deck</span>
        {[2, 3].map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={d === k}
            onClick={() => setD(k)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs",
              d === k ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground",
            )}
          >
            {1 << k} cards (d = {k})
          </button>
        ))}
      </div>

      {c ? (
        <table className="mt-3 w-full border-collapse text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-2 font-normal">shuffles t</th>
              <th className="py-1 pr-2 font-normal">exact distance from uniform</th>
              <th className="w-28 py-1 text-right font-normal">coin-count floor</th>
            </tr>
          </thead>
          <tbody>
            {c.tv.map((v, t) => (
              <tr key={t} className="border-t border-border/60">
                <td className="py-1 pr-2 font-mono tabular-nums">{t}</td>
                <td className="py-1 pr-2">
                  <div className="flex items-center gap-2">
                    <div className="relative h-2.5 flex-1 rounded bg-muted">
                      <div
                        className={cn("absolute inset-y-0 left-0 rounded", v <= 0.25 ? "bg-emerald-600/70" : "bg-sky-500/60")}
                        style={{ width: `${(v * 100).toFixed(2)}%` }}
                      />
                      <div
                        className="absolute inset-y-[-2px] w-px bg-rose-500"
                        style={{ left: `${(c.lower[t] * 100).toFixed(2)}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-mono tabular-nums">{v.toFixed(4)}</span>
                  </div>
                </td>
                <td className="py-1 text-right font-mono tabular-nums text-muted-foreground">{c.lower[t].toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Computing the exact law over all 40,320 orderings…</p>
      )}
      {c ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Mixed (distance at most 1/4) after {c.tv.findIndex((v) => v <= 0.25)} shuffles for {c.n} cards; the red tick
          is the floor 1 &minus; 2<sup>tn/2</sup>/n!, which no shuffle with n/2 coins can beat.
        </p>
      ) : null}
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Exact total-variation distance of the Thorp shuffle from a uniformly random deck, computed in your browser over
        every ordering. The release proves that for 2<sup>d</sup> cards the distance tends to zero after 1600d shuffles,
        matching the coin-count floor of about 2d up to a constant; decks this small illustrate the two regimes but
        cannot test an asymptotic constant.
      </figcaption>
    </figure>
  )
}
