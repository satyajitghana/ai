"use client"

import { useId, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { MERGES, type Policy, clean, finalIds, idOf, run, vocabSize } from "./bpe-toy"

// Why merge order decides the ids. One toy table (bpe-toy.ts), four ways to apply it. Only "rank"
// is what Hugging Face computes; the other three are shortcuts people reach for, and the
// stepper shows where each one parts company with it. The key column is toks's packing,
// prio << 5 | pos, so one unsigned min picks the next merge and breaks ties leftmost.

const PRESETS = ["·ther", "other", "·there"] as const
const POLICIES: { key: Policy; label: string; blurb: string }[] = [
  { key: "rank", label: "lowest rank", blurb: "Hugging Face's rule, the reference" },
  { key: "id", label: "merged id first", blurb: "priority = the id the merge produces" },
  { key: "left", label: "leftmost pair", blurb: "first pair that has any merge" },
  { key: "greedy", label: "longest match", blurb: "longest vocabulary prefix, no merges" },
]

const OK = "oklch(0.62 0.15 160)"
const BAD = "oklch(0.64 0.19 30)"
const ACCENT = "oklch(0.62 0.15 250)"

const chip = (active: boolean) =>
  cn(
    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
    active
      ? "border-foreground/30 bg-muted/50 text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  )

export function MergeOrder() {
  const id = useId()
  const [text, setText] = useState<string>(PRESETS[0])
  const [policy, setPolicy] = useState<Policy>("id")
  // a large index means "fully merged", which is what a reader without JS sees
  const [k, setK] = useState(999)

  const snaps = useMemo(() => run(text, policy), [text, policy])
  const idx = Math.min(k, snaps.length - 1)
  const snap = snaps[idx]
  const ref = useMemo(() => finalIds(text, "rank"), [text])
  const got = useMemo(() => finalIds(text, policy), [text, policy])
  const same = ref.length === got.length && ref.every((v, i) => v === got[i])
  const done = idx === snaps.length - 1
  const picked = snap.pick >= 0 ? snap.cands[snap.pick] : null
  const appliedRank = picked ? picked.rank : -1

  const setT = (t: string) => {
    setText(t)
    setK(999)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one table · four merge orders · {vocabSize} tokens</span>
        <div className="flex flex-wrap gap-1" role="group" aria-label="piece">
          {PRESETS.map((p) => (
            <button key={p} type="button" aria-pressed={text === p} onClick={() => setT(p)} className={chip(text === p)}>
              {p}
            </button>
          ))}
          <label htmlFor={`${id}-t`} className="sr-only">
            your own piece, letters t h e r o and spaces
          </label>
          <input
            id={`${id}-t`}
            value={text}
            onChange={(e) => setT(clean(e.target.value) || "t")}
            className="w-28 rounded-md border bg-background px-2 py-0.5 font-mono text-xs"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[1fr_11rem] sm:p-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="merge order">
            {POLICIES.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={policy === p.key}
                onClick={() => {
                  setPolicy(p.key)
                  setK(999)
                }}
                className={chip(policy === p.key)}
                title={p.blurb}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{POLICIES.find((p) => p.key === policy)?.blurb}</p>

          <div className="flex items-center gap-3">
            <label htmlFor={`${id}-k`} className="shrink-0 font-mono text-[11px] text-muted-foreground">
              step {idx + 1}/{snaps.length}
            </label>
            <Range id={`${id}-k`} min={0} max={snaps.length - 1} value={idx} onChange={(e) => setK(Number(e.target.value))} className="w-full" />
          </div>

          <div className="flex min-h-12 flex-wrap items-end gap-1" aria-live="polite">
            {snap.syms.map((s, i) => {
              const inPick = picked && (i === picked.pos || i === picked.pos + 1)
              return (
                <span key={`${i}-${s}`} className="inline-flex flex-col items-center">
                  <span
                    className="rounded-md border px-1.5 py-0.5 font-mono text-sm"
                    style={inPick ? { borderColor: ACCENT, background: "color-mix(in oklch, " + ACCENT + " 14%, transparent)" } : undefined}
                  >
                    {s}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{idOf(s)}</span>
                </span>
              )
            })}
            {snap.rest && <span className="rounded-md border border-dashed px-1.5 py-0.5 font-mono text-sm text-muted-foreground">{snap.rest}</span>}
          </div>
          <p className="font-mono text-xs">{snap.note}</p>

          {snap.cands.length > 0 && (
            <table className="w-full text-left font-mono text-[11px] tabular-nums">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="font-normal">pair</th>
                  <th className="font-normal">pos</th>
                  <th className="font-normal">rank</th>
                  <th className="font-normal">merged id</th>
                  <th className="font-normal">key</th>
                </tr>
              </thead>
              <tbody>
                {snap.cands.map((c, i) => (
                  <tr key={c.pos} style={i === snap.pick ? { color: ACCENT } : undefined}>
                    <td>
                      {c.a} + {c.b}
                    </td>
                    <td>{c.pos}</td>
                    <td>{c.rank}</td>
                    <td>{c.id}</td>
                    <td>
                      {c.key}
                      {i === snap.pick ? " ← min" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="rounded-lg border px-3 py-2 font-mono text-xs" style={{ borderColor: same ? OK : BAD }}>
            <div>
              <span className="text-muted-foreground">Hugging Face (lowest rank): </span>[{ref.join(", ")}]
            </div>
            <div>
              <span className="text-muted-foreground">{POLICIES.find((p) => p.key === policy)?.label}: </span>[{got.join(", ")}]{" "}
              <span style={{ color: same ? OK : BAD }}>{same ? "same ids" : "different ids"}</span>
            </div>
            {!done && <div className="text-muted-foreground">(final ids; drag the slider to the end to see them form)</div>}
          </div>
        </div>

        <div className="font-mono text-[11px] tabular-nums">
          <div className="mb-1 text-muted-foreground">merge table, by rank</div>
          <ol className="space-y-0.5">
            {MERGES.map(([a, b], r) => (
              <li
                key={r}
                className="flex justify-between gap-2 rounded px-1"
                style={r === appliedRank ? { background: "color-mix(in oklch, " + ACCENT + " 16%, transparent)" } : undefined}
              >
                <span className="text-muted-foreground">{r}</span>
                <span className="flex-1">
                  {a} + {b}
                </span>
                <span>→ {idOf(a + b)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-muted-foreground">rank 7 makes ·the again: its id, 11, is older than rank 6&apos;s ther, 12.</p>
        </div>
      </div>
    </figure>
  )
}
