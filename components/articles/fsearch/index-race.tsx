"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { fits, layout, matchName, nameMask, token, type Verdict } from "./toy-disk"

// Four ways to answer one name query over the same toy disk:
//   1. linear scan: run the matcher on every entry (what a naive tool does);
//   2. fsearch: one AND per DISTINCT name against a 64-bit class mask, the
//      matcher only on survivors, then the name -> entries list
//      (query.rs:725-769 and :983-1004);
//   3. a trigram index over names (plocate does this over whole paths):
//      intersect posting lists, verify the candidates;
//   4. a sorted name array: binary search, which can only answer a prefix.
// Costs are operation counts on this toy, not timings.

const GOOD = "oklch(0.58 0.15 155)"
const BAD = "oklch(0.6 0.18 27)"
const DIM = "oklch(0.62 0.03 250)"

const PRESETS = ["main", "readme", "pyhton", "rs", "index", "wllpaper", "taxes"]

const { entries } = layout()
const FILES = entries.filter((e) => e.i > 0)
const DISTINCT = Array.from(new Set(FILES.map((e) => e.name))).sort()

function trigrams(s: string): string[] {
  const out = new Set<string>()
  const t = s.toLowerCase()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  return [...out]
}

const POSTINGS = (() => {
  const m = new Map<string, number[]>()
  DISTINCT.forEach((n, id) => {
    for (const t of trigrams(n)) {
      const l = m.get(t) ?? []
      l.push(id)
      m.set(t, l)
    }
  })
  return m
})()

type Lane = {
  key: string
  title: string
  how: string
  steps: { label: string; n: number }[]
  ops: number
  found: string[]
  miss?: string
}

function run(q: string): { lanes: Lane[]; truth: string[] } {
  const t = token(q)
  const verdicts = new Map<string, Verdict>()
  for (const n of DISTINCT) verdicts.set(n, matchName(n, t))
  const truth = DISTINCT.filter((n) => verdicts.get(n))
  const entriesFor = (names: string[]) => FILES.filter((e) => names.includes(e.name)).length

  // 1. Linear scan over every entry.
  const linear: Lane = {
    key: "linear",
    title: "Linear scan",
    how: "run the matcher on every entry",
    steps: [
      { label: "entries read", n: FILES.length },
      { label: "matcher calls", n: FILES.length },
    ],
    ops: FILES.length * 2,
    found: truth,
  }

  // 2. fsearch: mask AND per distinct name, matcher on survivors.
  const survivors = DISTINCT.filter((n) => fits(t, nameMask(n)))
  const fs: Lane = {
    key: "fsearch",
    title: "fsearch: mask, then score",
    how: "one AND per distinct name, matcher only on survivors",
    steps: [
      { label: "mask ANDs", n: DISTINCT.length },
      { label: "survive the mask", n: survivors.length },
      { label: "matcher calls", n: survivors.length },
      { label: "entries expanded", n: entriesFor(truth) },
    ],
    ops: DISTINCT.length + survivors.length * 2 + entriesFor(truth),
    found: truth,
  }

  // 3. Trigram index over names: candidates must hold every query trigram.
  const qt = trigrams(t.text)
  let tri: Lane
  if (qt.length === 0) {
    tri = {
      key: "trigram",
      title: "Trigram index",
      how: "fewer than 3 letters: no trigram, so every name is a candidate",
      steps: [
        { label: "posting lists", n: 0 },
        { label: "candidates", n: DISTINCT.length },
      ],
      ops: DISTINCT.length * 2,
      found: DISTINCT.filter((n) => n.toLowerCase().includes(t.text)),
    }
  } else {
    const lists = qt.map((x) => POSTINGS.get(x) ?? [])
    let cand = lists[0]
    for (const l of lists.slice(1)) cand = cand.filter((x) => l.includes(x))
    const names = cand.map((id) => DISTINCT[id])
    const found = names.filter((n) => n.toLowerCase().includes(t.text))
    tri = {
      key: "trigram",
      title: "Trigram index",
      how: "intersect the posting lists of every query trigram, verify the rest",
      steps: [
        { label: "posting lists", n: lists.length },
        { label: "postings walked", n: lists.reduce((a, l) => a + l.length, 0) },
        { label: "candidates verified", n: cand.length },
      ],
      ops: lists.reduce((a, l) => a + l.length, 0) + cand.length,
      found,
    }
  }
  const triMissed = truth.filter((n) => !tri.found.includes(n))
  if (triMissed.length) tri.miss = `misses ${triMissed.join(", ")}: no contiguous "${t.text}" to index`

  // 4. Sorted array: binary search answers a prefix only.
  const lower = DISTINCT.map((n) => n.toLowerCase())
  let lo = 0
  let hi = lower.length
  let probes = 0
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    probes++
    if (lower[mid] < t.text) lo = mid + 1
    else hi = mid
  }
  const pre: string[] = []
  for (let k = lo; k < lower.length && lower[k].startsWith(t.text); k++) pre.push(DISTINCT[k])
  const sortedMissed = truth.filter((n) => !pre.includes(n))
  const sorted: Lane = {
    key: "sorted",
    title: "Sorted name array",
    how: "binary search, then read forward while the prefix holds",
    steps: [
      { label: "probes", n: probes },
      { label: "read forward", n: pre.length },
    ],
    ops: probes + pre.length,
    found: pre,
    miss: sortedMissed.length ? `misses ${sortedMissed.join(", ")}: not a prefix` : undefined,
  }
  return { lanes: [linear, fs, tri, sorted], truth }
}

export function IndexRace() {
  const [q, setQ] = useState("pyhton")
  const query = q.trim().replace(/\s+/g, "").slice(0, 24)
  const res = useMemo(() => (query ? run(query) : null), [query])
  const maxOps = res ? Math.max(...res.lanes.map((l) => l.ops)) : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one name query, four index structures · {FILES.length} entries, {DISTINCT.length} distinct names
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <label className="mb-2 flex items-center gap-2 font-mono text-sm">
          <span className="text-muted-foreground">❯</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Name query"
            spellCheck={false}
            className="w-full rounded-md border bg-background px-2 py-1 font-mono text-sm outline-none focus:border-foreground/40"
          />
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQ(p)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                query === p
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {res && (
          <>
            <p className="mb-3 font-mono text-[11px] text-muted-foreground">
              fsearch&apos;s matcher accepts {res.truth.length} name{res.truth.length === 1 ? "" : "s"}
              {res.truth.length ? ": " : "."}
              <span className="text-foreground">{res.truth.join(", ")}</span>
              {query.length >= 5 ? " (5+ letters, so one typo is forgiven)" : " (under 5 letters, so no typos)"}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {res.lanes.map((l) => {
                const complete = !l.miss
                return (
                  <div key={l.key} className="rounded-lg border bg-background/60 p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold">{l.title}</span>
                      <span className="font-mono text-[10px]" style={{ color: complete ? GOOD : BAD }}>
                        {complete ? "finds them all" : "incomplete"}
                      </span>
                    </div>
                    <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">{l.how}</div>
                    <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(2, Math.round((l.ops / maxOps) * 100))}%`, background: complete ? GOOD : DIM }}
                      />
                    </div>
                    <div className="mb-1 font-mono text-[10px] text-muted-foreground">
                      {l.steps.map((s, k) => (
                        <span key={s.label}>
                          {k > 0 ? " → " : ""}
                          <span className="text-foreground">{s.n}</span> {s.label}
                        </span>
                      ))}
                      {" · "}
                      <span className="text-foreground">{l.ops}</span> ops
                    </div>
                    <div className="font-mono text-[10.5px]">
                      {l.found.length ? l.found.join(", ") : <span className="text-muted-foreground">nothing</span>}
                    </div>
                    {l.miss && (
                      <div className="mt-1 font-mono text-[10px]" style={{ color: BAD }}>
                        {l.miss}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Matching rules ported from fsearch&apos;s <code>index.rs</code> and <code>query.rs</code> (class mask, one-AND prefilter,
        one-edit typos at a word start for 5+ letter words); ranking is simplified. &quot;Ops&quot; counts the steps on this toy
        list. On a real disk the gap between distinct names and entries is what fsearch is buying: 2M names against 7.5M entries on
        Noah&apos;s Mac.
      </figcaption>
    </figure>
  )
}
