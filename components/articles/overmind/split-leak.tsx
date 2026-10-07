"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two of Overmind's train/eval splitters, run on a toy clause-extraction agent:
// 8 contracts x 5 clause questions, and every question ran as its own trace.
//
// "cli" mirrors overbae/services/datasets/llm_calls.py:257-268 (hash_split):
//   bucket = int(sha256(span_id)[:8], 16) % 100; eval if bucket < eval_percent.
//   Nothing is grouped. FNV-1a stands in for sha256 here; any uniform hash
//   gives the same picture.
// "workshop" and "grouped" mirror overbae/services/datasets/partition.py:105-207
// (split_rows): union-find over contamination keys (normalised input content,
// trace_id, conversation_id, user group_by columns, ids found inside the input),
// components shuffled with a fixed seed (Python uses random.Random(42); a seeded
// mulberry32 stands in), then each component is added to eval if it brings the
// eval size closer to target = clamp((n * pct + 50) // 100, 1, n - 1).
// "grouped" is the same call with group_by=["contract_id"].

const CONTRACTS = ["A", "B", "C", "D", "E", "F", "G", "H"]
const CLAUSES = ["Governing law", "Termination", "Non-compete", "Liability cap", "Audit rights"]

type Mode = "cli" | "workshop" | "grouped"

const MODES: { key: Mode; label: string; note: string }[] = [
  {
    key: "cli",
    label: "overmind finetune (LLM calls)",
    note: "hash of span_id, no grouping",
  },
  {
    key: "workshop",
    label: "Workshop split, default keys",
    note: "groups by trace, conversation, exact input",
  },
  {
    key: "grouped",
    label: "Workshop split, group_by contract",
    note: "same call, one extra column",
  },
]

type Row = { contract: number; clause: number; spanId: string; traceId: string }

const ROWS: Row[] = CONTRACTS.flatMap((_, c) =>
  CLAUSES.map((__, q) => ({
    contract: c,
    clause: q,
    spanId: `span-${c}-${q}-7f3a`,
    traceId: `trace-${c * CLAUSES.length + q}`,
  })),
)

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(xs: T[], seed: number): T[] {
  const out = xs.slice()
  const rnd = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function split(mode: Mode, pct: number, seed: number): Set<number> {
  const n = ROWS.length
  if (mode === "cli") {
    const held = new Set<number>()
    ROWS.forEach((r, i) => {
      if (fnv1a(`${r.spanId}:${seed}`) % 100 < pct) held.add(i)
    })
    return held
  }
  // Components: one per row (each question is its own trace with its own input),
  // or one per contract when the contract is a group_by key.
  const comps: number[][] =
    mode === "grouped"
      ? CONTRACTS.map((_, c) => ROWS.flatMap((r, i) => (r.contract === c ? [i] : [])))
      : ROWS.map((_, i) => [i])
  const ordered = shuffle(comps, seed)
  const target = Math.min(Math.max(Math.floor((n * pct + 50) / 100), 1), n - 1)
  const held = new Set<number>()
  for (const comp of ordered) {
    if (held.size + comp.length >= n) continue
    const before = Math.abs(held.size - target) / n
    const after = Math.abs(held.size + comp.length - target) / n
    if (after < before || held.size === 0) comp.forEach((i) => held.add(i))
  }
  return held
}

export function SplitLeak() {
  const [mode, setMode] = useState<Mode>("workshop")
  const [pct, setPct] = useState(20)
  const [seed, setSeed] = useState(1)

  const held = useMemo(() => split(mode, pct, seed), [mode, pct, seed])

  const stats = useMemo(() => {
    const trainContracts = new Set<number>()
    const evalContracts = new Set<number>()
    ROWS.forEach((r, i) => (held.has(i) ? evalContracts : trainContracts).add(r.contract))
    let leakedRows = 0
    ROWS.forEach((r, i) => {
      if (held.has(i) && trainContracts.has(r.contract)) leakedRows++
    })
    const shared = [...evalContracts].filter((c) => trainContracts.has(c)).length
    return { evalRows: held.size, leakedRows, shared }
  }, [held])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          8 contracts × 5 clause questions · one trace per question
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          split logic re-implemented from partition.py and llm_calls.py
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">
          {MODES.find((m) => m.key === mode)?.note}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10px]">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">eval share</span>
            <Range
              min={10}
              max={50}
              step={5}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-label="Eval share in percent"
              className="w-32"
            />
            <span className="w-8 tabular-nums">{pct}%</span>
          </label>
          <button
            type="button"
            onClick={() => setSeed((s) => (s % 9) + 1)}
            className="cursor-pointer rounded border px-2 py-0.5 text-muted-foreground hover:text-foreground"
          >
            reshuffle (seed {seed})
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 font-mono text-[10px]">
            <thead>
              <tr>
                <th className="text-left font-normal text-muted-foreground">contract</th>
                {CLAUSES.map((q) => (
                  <th key={q} className="font-normal text-muted-foreground">
                    {q}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map((name, c) => {
                const idx = ROWS.map((r, i) => (r.contract === c ? i : -1)).filter((i) => i >= 0)
                const inEval = idx.some((i) => held.has(i))
                const inTrain = idx.some((i) => !held.has(i))
                const leaked = inEval && inTrain
                return (
                  <tr key={name}>
                    <td className={cn("pr-1", leaked ? "text-amber-600 dark:text-amber-400" : "")}>
                      {name}
                      {leaked ? " · both sides" : ""}
                    </td>
                    {idx.map((i) => (
                      <td
                        key={i}
                        className={cn(
                          "h-6 rounded text-center",
                          held.has(i)
                            ? "bg-orange-500/80 text-white"
                            : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        {held.has(i) ? "eval" : "train"}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded border p-2">
            <div className="text-[9px] text-muted-foreground">eval rows</div>
            <div className="tabular-nums">{stats.evalRows} of 40</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[9px] text-muted-foreground">eval rows whose contract was trained on</div>
            <div className="tabular-nums">{stats.leakedRows}</div>
          </div>
          <div className="rounded border p-2">
            <div className="text-[9px] text-muted-foreground">contracts on both sides</div>
            <div className="tabular-nums">{stats.shared} of 8</div>
          </div>
        </div>

        <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
          The Workshop splitter only joins rows that share an identity it can see: a trace, a conversation, the
          exact same input, or a column you name. Five questions about one contract are five traces with five
          different inputs, so by default they scatter across train and eval exactly as the per-call hash does.
          Naming the contract as a group puts each contract wholly on one side. The training launcher reports overlap
          between datasets as a warning and starts anyway.
        </figcaption>
      </div>
    </figure>
  )
}
