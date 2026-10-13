"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { ANCHOR, MODELS, diffHalf, emptyWins, fit, simulate, totalVotes, winProb, type Wins } from "./bt"

// Votes in, ratings and intervals out. The page starts with 10,000 simulated
// panel votes drawn from AA's published AA-3D ratings (about what AA counted),
// fitted with Bradley-Terry in bt.ts. Add simulated votes, cast your own
// upsets, or start from nothing and watch the intervals close. Every number on
// screen is computed in the browser from the vote table; the first batch uses seed 158 (a draw whose top seven land within 12 points of the published ratings), so
// the first render is identical on the server and the client.

const LO = 500
const HI = 1300
const x = (elo: number) => Math.min(100, Math.max(0, ((elo - LO) * 100) / (HI - LO)))

const START = 10000
const PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [2, 3],
  [3, 4],
]

const chip = (on: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
    on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
  )

export function VoteToElo() {
  const [pairing, setPairing] = useState<"uniform" | "close">("uniform")
  const [batches, setBatches] = useState<{ n: number; pairing: "uniform" | "close" }[]>([
    { n: START, pairing: "uniform" },
  ])
  const [manual, setManual] = useState<[number, number][]>([])
  const [a, setA] = useState(7)
  const [b, setB] = useState(0)

  const wins: Wins = useMemo(() => {
    let w = emptyWins()
    batches.forEach((bt, k) => {
      w = simulate(w, bt.n, 158 + k * 7919, bt.pairing)
    })
    for (const [win, lose] of manual) w[win][lose] += 1
    return w
  }, [batches, manual])

  const f = useMemo(() => fit(wins), [wins])
  const n = totalVotes(wins)

  const add = (k: number) => setBatches((s) => [...s, { n: k, pairing }])
  const reset = () => {
    setBatches([])
    setManual([])
  }
  const vote = (winner: number, loser: number, times: number) => {
    if (winner === loser) return
    setManual((s) => [...s, ...Array.from({ length: times }, () => [winner, loser] as [number, number])])
  }

  const desc = `${n.toLocaleString("en-US")} votes. ${MODELS.slice(0, 4)
    .map((m, i) => `${m.name} fitted at ${f.elo[i].toFixed(0)} plus or minus ${f.half[i].toFixed(0)}`)
    .join("; ")}.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>votes in, Elo and 95% intervals out</span>
        <span className="text-muted-foreground/60">Bradley-Terry fit, GPT-6 Luna anchored at 1000</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-3 font-mono text-[11px]">
        <span className="tabular-nums text-foreground">
          {n.toLocaleString("en-US")} <span className="text-muted-foreground">votes</span>
        </span>
        <span className="text-muted-foreground">add simulated panel votes:</span>
        {[100, 1000, 10000].map((k) => (
          <button key={k} type="button" onClick={() => add(k)} className={chip(false)}>
            +{k.toLocaleString("en-US")}
          </button>
        ))}
        <button type="button" onClick={reset} className={chip(false)}>
          start from zero
        </button>
        <span className="text-muted-foreground">pairing:</span>
        <button type="button" aria-pressed={pairing === "uniform"} onClick={() => setPairing("uniform")} className={chip(pairing === "uniform")}>
          any two models
        </button>
        <button type="button" aria-pressed={pairing === "close"} onClick={() => setPairing("close")} className={chip(pairing === "close")}>
          near neighbours
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 font-mono text-[11px] text-muted-foreground">
        <span>cast a vote yourself:</span>
        <select
          value={a}
          onChange={(e) => setA(Number(e.target.value))}
          className="rounded border bg-background px-1.5 py-0.5 text-foreground"
          aria-label="Winning model"
        >
          {MODELS.map((m, i) => (
            <option key={m.name} value={i}>
              {m.short}
            </option>
          ))}
        </select>
        <span>beats</span>
        <select
          value={b}
          onChange={(e) => setB(Number(e.target.value))}
          className="rounded border bg-background px-1.5 py-0.5 text-foreground"
          aria-label="Losing model"
        >
          {MODELS.map((m, i) => (
            <option key={m.name} value={i}>
              {m.short}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => vote(a, b, 1)} className={chip(false)} disabled={a === b}>
          +1
        </button>
        <button type="button" onClick={() => vote(a, b, 25)} className={chip(false)} disabled={a === b}>
          +25
        </button>
        <span className="text-muted-foreground/70">
          expected from the published gap: {(winProb(MODELS[a].elo, MODELS[b].elo) * 100).toFixed(0)}% for the first
        </span>
      </div>

      <div className="space-y-[3px] px-4 py-4" role="img" aria-label={desc}>
        {MODELS.map((m, i) => {
          const e = f.elo[i]
          const h = Math.min(f.half[i], 800)
          const anchor = i === ANCHOR
          return (
            <div key={m.name} className="flex items-center gap-2">
              <span
                className={cn(
                  "w-24 shrink-0 truncate font-mono text-[10.5px] sm:w-36",
                  i < 4 ? "text-foreground" : "text-muted-foreground",
                )}
                title={m.name}
              >
                {m.short}
              </span>
              <div className="relative h-3.5 flex-1">
                <div className="absolute inset-y-[6px] right-0 left-0 bg-muted/50" />
                <div className="absolute inset-y-0 w-px bg-foreground/15" style={{ left: `${x(1000)}%` }} />
                {!anchor ? (
                  <div
                    className={cn("absolute inset-y-[3px] rounded-full", i < 4 ? "bg-sky-500/35" : "bg-foreground/15")}
                    style={{ left: `${x(e - h)}%`, width: `${x(e + h) - x(e - h)}%` }}
                  />
                ) : null}
                <div
                  className="absolute top-0 h-3.5 w-px border-l border-dashed border-amber-600/80 dark:border-amber-400/80"
                  style={{ left: `${x(m.elo)}%` }}
                  title={`published ${m.elo.toFixed(0)}`}
                />
                <div
                  className={cn(
                    "absolute top-0.5 h-2.5 w-1 -translate-x-1/2 rounded-sm",
                    i < 4 ? "bg-sky-600 dark:bg-sky-400" : "bg-foreground/60",
                  )}
                  style={{ left: `${x(e)}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10.5px] tabular-nums">
                {e.toFixed(0)}
                <span className="text-muted-foreground">{anchor ? " anchor" : ` ±${h >= 800 ? "∞" : h.toFixed(0)}`}</span>
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 sm:w-36" />
          <div className="relative h-4 flex-1 font-mono text-[10px] text-muted-foreground">
            {[500, 700, 900, 1100, 1300].map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
                {t}
              </span>
            ))}
          </div>
          <span className="w-20 shrink-0" />
        </div>
        <p className="my-0 pt-1 font-mono text-[10px] text-muted-foreground">
          bar = fitted Elo, band = its 95% interval, dashed tick = AA&apos;s published rating (the hidden truth the votes are drawn from)
        </p>
      </div>

      <div className="border-t px-4 py-3">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          are they separable? the gap, against the 95% interval of the gap itself
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-[1fr_auto_auto]">
          {PAIRS.map(([p, q]) => {
            const gap = f.elo[p] - f.elo[q]
            const hh = diffHalf(f, p, q)
            const sep = Math.abs(gap) > hh
            const overlap = f.elo[p] - f.half[p] < f.elo[q] + f.half[q] && f.elo[q] - f.half[q] < f.elo[p] + f.half[p]
            return (
              <div key={`${p}-${q}`} className="contents">
                <dt className="text-muted-foreground">
                  {MODELS[p].short} − {MODELS[q].short}
                </dt>
                <dd className="my-0 tabular-nums">
                  {gap >= 0 ? "+" : ""}
                  {gap.toFixed(0)} ± {hh >= 800 ? "∞" : hh.toFixed(0)}
                </dd>
                <dd className={cn("my-0", sep ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                  {sep ? "separated" : "tied"}
                  <span className="text-muted-foreground/70">{overlap ? " · bars overlap" : ""}</span>
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </figure>
  )
}
