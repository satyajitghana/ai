"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Julia-1's hierarchical Router (julia/router/router.py), two ways.
//
// Top: the schedule. Split the current candidates, in their original order,
// into consecutive groups of at most `width` (20, the native limit), score
// every group of two or more in one batch, and keep either the group's winner
// alone (when its softmax is above 0.95 and every other option is below 0.045)
// or its top `survivors`. Repeat until 20 or fewer remain, then make one final
// call. The two bounds below are "no group is decisive" and "every group is".
// This is arithmetic on the rule, not a model run.
//
// Bottom: real traces, recorded on 2026-09-27 with the ONNX export behind my
// own reimplementation of that rule (width 20, survivors 2), on three items of
// the jev-benchmarks pilot-v1 Banking77 sample (72 BTZSC labels; the sample's
// manifest hash matches the published one). "Sentences" are the protocol's
// BTZSC hypotheses; "names" are bare intent names in the phrasing Julia's own
// validation file uses. Probabilities are the final call's softmax, which only
// covers the final candidates.

const WIDTH = 20

type Round = { groups: number[]; calls: number; next: number }

function schedule(n: number, survivors: number, decisive: boolean): { rounds: Round[]; calls: number } {
  const rounds: Round[] = []
  let cands = n
  let calls = 0
  while (cands > WIDTH) {
    const groups: number[] = []
    for (let left = cands; left > 0; left -= WIDTH) groups.push(Math.min(WIDTH, left))
    let next = 0
    let c = 0
    for (const g of groups) {
      if (g === 1) {
        next += 1
        continue
      }
      c += 1
      next += decisive ? 1 : Math.min(survivors, g)
    }
    rounds.push({ groups, calls: c, next })
    calls += c
    cands = next
  }
  rounds.push({ groups: [cands], calls: 1, next: 1 })
  return { rounds, calls: calls + 1 }
}

type Group = { size: number; first: number; keep: number[]; top: number }
type Trace = { round1: Group[]; final: number[]; probs: number[]; pick: number }
type Item = { id: string; text: string; target: number; sentences: Trace; names: Trace }

// Intent names, BTZSC order (index = option position in the 72-option list).
const NAMES: Record<number, string> = {
  0: "refund not showing up",
  3: "apple pay or google pay",
  5: "automatic top up",
  14: "card not working",
  15: "card payment fee charged",
  20: "cash withdrawal not recognised",
  23: "contactless not working",
  28: "direct debit payment not recognised",
  29: "disposable card limits",
  33: "extra charge on statement",
  45: "pending top up",
  49: "request refund",
  52: "top up by card charge",
  54: "top up failed",
  59: "transfer fee charged",
  61: "transfer not received by recipient",
  63: "unable to verify identity",
  64: "verify my identity",
  67: "virtual card not working",
  68: "visa or mastercard",
  70: "wrong amount of cash received",
  71: "wrong exchange rate for cash withdrawal",
}

const ITEMS: Item[] = [
  {
    id: "banking77:158",
    text: "I got my American Express in Apple Bay but top up is not working",
    target: 3,
    sentences: {
      round1: [
        { size: 20, first: 0, keep: [5, 14], top: 0.716 },
        { size: 20, first: 20, keep: [23, 29], top: 0.673 },
        { size: 20, first: 40, keep: [52, 54], top: 0.529 },
        { size: 12, first: 60, keep: [61], top: 0.959 },
      ],
      final: [5, 14, 23, 29, 52, 54, 61],
      probs: [0, 0, 0, 0, 0, 1, 0],
      pick: 54,
    },
    names: {
      round1: [
        { size: 20, first: 0, keep: [3], top: 0.995 },
        { size: 20, first: 20, keep: [23], top: 0.972 },
        { size: 20, first: 40, keep: [45, 54], top: 0.74 },
        { size: 12, first: 60, keep: [67, 71], top: 0.58 },
      ],
      final: [3, 23, 45, 54, 67, 71],
      probs: [0.36, 0.145, 0.128, 0.328, 0.038, 0.001],
      pick: 3,
    },
  },
  {
    id: "banking77:653",
    text: "Why was I charged an extra fee when using a card?",
    target: 15,
    sentences: {
      round1: [
        { size: 20, first: 0, keep: [15], top: 1.0 },
        { size: 20, first: 20, keep: [33], top: 1.0 },
        { size: 20, first: 40, keep: [52], top: 0.994 },
        { size: 12, first: 60, keep: [64], top: 0.987 },
      ],
      final: [15, 33, 52, 64],
      probs: [0.436, 0.561, 0.003, 0],
      pick: 33,
    },
    names: {
      round1: [
        { size: 20, first: 0, keep: [15], top: 0.975 },
        { size: 20, first: 20, keep: [29, 33], top: 0.418 },
        { size: 20, first: 40, keep: [52, 59], top: 0.72 },
        { size: 12, first: 60, keep: [68, 71], top: 0.211 },
      ],
      final: [15, 29, 33, 52, 59, 68, 71],
      probs: [0.988, 0, 0.002, 0.002, 0.008, 0.001, 0],
      pick: 15,
    },
  },
  {
    id: "banking77:22",
    text: "My refund is missing from my statement.",
    target: 0,
    sentences: {
      round1: [
        { size: 20, first: 0, keep: [0], top: 1.0 },
        { size: 20, first: 20, keep: [20, 29], top: 0.651 },
        { size: 20, first: 40, keep: [49], top: 0.999 },
        { size: 12, first: 60, keep: [61], top: 1.0 },
      ],
      final: [0, 20, 29, 49, 61],
      probs: [0.99, 0, 0, 0.01, 0],
      pick: 0,
    },
    names: {
      round1: [
        { size: 20, first: 0, keep: [0], top: 1.0 },
        { size: 20, first: 20, keep: [28, 33], top: 0.848 },
        { size: 20, first: 40, keep: [49], top: 0.998 },
        { size: 12, first: 60, keep: [63, 70], top: 0.236 },
      ],
      final: [0, 28, 33, 49, 63, 70],
      probs: [0.999, 0, 0, 0.001, 0, 0],
      pick: 0,
    },
  },
]

const HIT = "oklch(0.62 0.16 45)"
const KEEP = "oklch(0.60 0.15 255)"
const LOST = "oklch(0.58 0.18 25)"

const name = (i: number) => NAMES[i] ?? `#${i}`

export function RouterRounds() {
  const [n, setN] = useState(60)
  const [survivors, setSurvivors] = useState(2)
  const [itemId, setItemId] = useState(ITEMS[0].id)
  const [framing, setFraming] = useState<"sentences" | "names">("sentences")

  const worst = schedule(n, survivors, false)
  const best = schedule(n, survivors, true)
  const item = ITEMS.find((x) => x.id === itemId) ?? ITEMS[0]
  const tr = item[framing]
  const reached = tr.final.includes(item.target)
  const right = tr.pick === item.target

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          more than 20 options: the Router
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">width {WIDTH} · native limit</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px]">
            <span className="text-muted-foreground">options: </span>
            {n}
            <Range
              min={21}
              max={200}
              step={1}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="mt-1 w-full"
              aria-label="number of options"
            />
          </label>
          <label className="block font-mono text-[11px]">
            <span className="text-muted-foreground">survivors per undecided group: </span>
            {survivors}
            <Range
              min={1}
              max={3}
              step={1}
              value={survivors}
              onChange={(e) => setSurvivors(Number(e.target.value))}
              className="mt-1 w-full"
              aria-label="survivors per group"
            />
          </label>
        </div>

        {[
          { label: "no group decisive", s: worst },
          { label: "every group decisive", s: best },
        ].map(({ label, s }) => (
          <div key={label} className="mt-3">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {label} · {s.calls} model calls · {s.rounds.length} rounds
            </div>
            <div className="mt-1 space-y-1">
              {s.rounds.map((r, ri) => (
                <div key={ri} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
                    {ri === s.rounds.length - 1 ? "final" : `round ${ri + 1}`}
                  </span>
                  <div className="flex min-w-0 flex-1 gap-0.5">
                    {r.groups.map((g, gi) => (
                      <span
                        key={gi}
                        className="flex h-4 items-center justify-center overflow-hidden rounded-sm font-mono text-[9px] text-background"
                        style={{
                          flexGrow: g,
                          flexBasis: 0,
                          minWidth: 6,
                          background: ri === s.rounds.length - 1 ? HIT : KEEP,
                          opacity: g === 1 ? 0.35 : 0.8,
                        }}
                        title={g === 1 ? "a group of one passes through unscored" : `${g} options, one call`}
                      >
                        {g > 3 ? g : ""}
                      </span>
                    ))}
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {ri === s.rounds.length - 1 ? "1 pick" : `→ ${r.next}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-5 border-t pt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          measured · Banking77 pilot, 72 labels, survivors 2
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ITEMS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === item.id}
              onClick={() => setItemId(x.id)}
              className={pill(x.id === item.id)}
            >
              {x.id}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground/50">|</span>
          {(["sentences", "names"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={f === framing} onClick={() => setFraming(f)} className={pill(f === framing)}>
              {f === "sentences" ? "labels as BTZSC sentences" : "labels as intent names"}
            </button>
          ))}
        </div>
        <p className="mt-2 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed">
          “{item.text}” <span className="text-muted-foreground">· gold: {name(item.target)} (#{item.target})</span>
        </p>

        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {tr.round1.map((g) => {
            const has = item.target >= g.first && item.target < g.first + g.size
            const kept = g.keep.includes(item.target)
            return (
              <div
                key={g.first}
                className="rounded border px-2 py-1.5 font-mono text-[10px] leading-snug"
                style={{ borderColor: has ? (kept ? HIT : LOST) : undefined }}
              >
                <div className="text-muted-foreground">
                  #{g.first}–{g.first + g.size - 1} · top p {g.top.toFixed(2)}
                </div>
                {g.keep.map((k) => (
                  <div key={k} className="truncate" style={{ color: k === item.target ? HIT : undefined }}>
                    keeps {name(k)}
                  </div>
                ))}
                {has && !kept && <div style={{ color: LOST }}>gold dropped here</div>}
              </div>
            )
          })}
        </div>

        <ul className="mt-3 space-y-1">
          {tr.final.map((k, i) => (
            <li key={k} className="grid grid-cols-[minmax(0,1fr)_4.5rem_3rem] items-center gap-2">
              <span className="truncate font-mono text-[11px]" style={{ color: k === tr.pick ? HIT : undefined }}>
                {name(k)}
                {k === item.target ? " · gold" : ""}
              </span>
              <span className="relative h-2.5 overflow-hidden rounded-sm bg-muted/40">
                <span
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    width: `${Math.max(0.5, Math.round(tr.probs[i] * 1000) / 10)}%`,
                    background: k === tr.pick ? HIT : KEEP,
                    opacity: k === tr.pick ? 0.85 : 0.45,
                  }}
                />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums">{tr.probs[i].toFixed(3)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 font-mono text-[11px] leading-relaxed">
          <span style={{ color: right ? HIT : LOST }}>
            {right ? "right" : reached ? "gold reached the final call and lost it" : "gold never reached the final call"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            · over all 100 items: gold reached the final call{" "}
            {framing === "sentences" ? "78" : "97"} times, final pick right{" "}
            {framing === "sentences" ? "62" : "91"} times, 5 model calls each
          </span>
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        The schedule is the Router&apos;s rule worked out for any list length; the traces are measured.
        A final probability of 1.000 means certain among the final candidates, which may no longer include the
        right answer. Same 100 items and same Router both times; only the wording of the 72 labels changes.
      </figcaption>
    </figure>
  )
}
