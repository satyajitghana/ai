"use client"

import { useId, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import {
  CORPUS,
  type Mode,
  countTokens,
  steps,
  tokens,
  train,
  units,
  variantEntries,
} from "./bpe"

// A live BPE merge stepper. Type a sentence; the text is pre-tokenized with a GPT-2-style
// regex and merged, one rank at a time, with a table learned from a six-sentence paragraph.
// "combinatorial" strips the leading space and the case off every letter word before BPE and
// carries them as modifiers, at the same number of table rows, which is how the rows that a
// standard table spends on " the" / "The" / " THE" come back as merges. Everything is
// integer arithmetic on strings; nothing here depends on the engine it runs on.

const ACCENT = "oklch(0.62 0.15 250)"
const WARN = "oklch(0.7 0.15 60)"
const DEFAULT_TEXT = "The tokenizer saw THE token, then the Token."
const MIN_ROWS = 40
const MAX_ROWS = 90

const show = (s: string) => s.replace(/ /g, "·").replace(/\n/g, "↵")

export function MergeStepper() {
  const id = useId()
  const [text, setText] = useState(DEFAULT_TEXT)
  const [mode, setMode] = useState<Mode>("standard")
  const [rows, setRows] = useState(80)
  // index into the snapshots; large = fully merged, which is what a reader without JS sees
  const [k, setK] = useState(999)

  const std = useMemo(() => train("standard", rows), [rows])
  const comb = useMemo(() => train("combinatorial", rows), [rows])
  const table = mode === "standard" ? std : comb
  const variants = useMemo(() => variantEntries(table), [table])

  const us = useMemo(() => units(text, mode), [text, mode])
  const snaps = useMemo(() => steps(table, us), [table, us])
  const idx = Math.min(k, snaps.length - 1)
  const snap = snaps[idx]

  const toks = us.map((u, i) => tokens(table, u, snap.pieces[i]))
  const nTokens = toks.reduce((n, ts) => n + ts.reduce((m, t) => m + t.bytes, 0), 0)
  const finalStd = useMemo(() => countTokens(std, text), [std, text])
  const finalComb = useMemo(() => countTokens(comb, text), [comb, text])
  const applied = new Set(snaps.slice(1, idx + 1).map((s) => (s.merge ? s.merge.a + s.merge.b : "")))
  const merged = table.entries.slice(table.alphabet.length)

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )
  const btn =
    "rounded-md border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">BPE merge stepper · same table rows, two schemes</span>
        <div className="flex gap-1" role="group" aria-label="tokenizer scheme">
          {(["standard", "combinatorial"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                setK(999)
              }}
              className={chip(mode === m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="block" htmlFor={`${id}-text`}>
            <span className="font-mono text-[11px] text-muted-foreground">your text</span>
            <input
              id={`${id}-text`}
              type="text"
              value={text}
              maxLength={90}
              spellCheck={false}
              onChange={(e) => {
                setText(e.target.value)
                setK(999)
              }}
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm"
            />
          </label>
          <label className="block" htmlFor={`${id}-rows`}>
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>table rows</span>
              <span className="tabular-nums text-foreground">{rows}</span>
            </span>
            <Range
              id={`${id}-rows`}
              min={MIN_ROWS}
              max={MAX_ROWS}
              step={1}
              value={rows}
              accent={ACCENT}
              onChange={(e) => {
                setRows(Number(e.target.value))
                setK(999)
              }}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => setK(0)} disabled={idx === 0}>
            reset
          </button>
          <button type="button" className={btn} aria-label="previous merge" onClick={() => setK(Math.max(0, idx - 1))} disabled={idx === 0}>
            {"◀"}
          </button>
          <button
            type="button"
            className={btn}
            aria-label="next merge"
            onClick={() => setK(idx + 1)}
            disabled={idx === snaps.length - 1}
          >
            {"▶"}
          </button>
          <button type="button" className={btn} onClick={() => setK(999)} disabled={idx === snaps.length - 1}>
            all
          </button>
          <span className="font-mono text-[11px] text-muted-foreground" aria-live="polite">
            step {idx} of {snaps.length - 1}
            {snap.merge ? (
              <>
                {" "}· rank #{snap.merge.rank + 1}:{" "}
                <span className="text-foreground">
                  {show(snap.merge.a)} + {show(snap.merge.b)} {"→"} {show(snap.merge.a + snap.merge.b)}
                </span>
              </>
            ) : (
              " · characters only"
            )}
          </span>
        </div>

        <div className="flex min-h-14 flex-wrap items-end gap-x-2.5 gap-y-3 rounded-lg border bg-background/60 p-3">
          {toks.map((ts, i) => (
            <span key={i} className="flex items-end gap-0.5">
              {ts.map((t, j) => (
                <span key={j} className="relative inline-flex flex-col items-center">
                  {mode === "combinatorial" && (t.space || t.kase) ? (
                    <span className="mb-0.5 flex gap-0.5">
                      {t.space ? (
                        <span className="rounded border px-1 font-mono text-[9px] leading-4" style={{ borderColor: ACCENT, color: ACCENT }} title="leading-space modifier">
                          {"·"}
                        </span>
                      ) : null}
                      {t.kase ? (
                        <span className="rounded border px-1 font-mono text-[9px] leading-4" style={{ borderColor: WARN, color: WARN }} title="case modifier">
                          {t.kase}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 font-mono text-sm",
                      t.known ? "bg-muted/40" : "border-dashed text-muted-foreground",
                    )}
                    style={mode === "standard" && variants.has(t.text) ? { borderColor: WARN } : undefined}
                    title={t.known ? `row "${show(t.text)}"` : `not in the table: ${t.bytes} UTF-8 byte rows`}
                  >
                    {show(t.text)}
                  </span>
                </span>
              ))}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { h: "tokens now", v: String(nTokens), s: idx === snaps.length - 1 ? "fully merged" : `after ${idx} merges` },
            {
              h: "table rows",
              v: String(table.rows),
              s: mode === "standard" ? `${table.alphabet.length} chars + ${table.merges.length} merges` : `${table.alphabet.length} + ${table.merges.length} + 5 modifiers`,
            },
            {
              h: "variant rows",
              v: String(table.variantRows),
              s: mode === "standard" ? "same word, other space or case" : "folded away",
            },
          ].map((c) => (
            <div key={c.h} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{c.h}</div>
              <div className="font-mono text-lg tabular-nums">{c.v}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{c.s}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            learned merges, in rank order{mode === "standard" ? " · amber = a row whose word another row already spells" : ""}
          </div>
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto rounded-md border bg-background/60 p-2">
            {merged.map((e, i) => (
              <span
                key={e}
                className={cn(
                  "rounded border px-1 font-mono text-[11px]",
                  applied.has(e) ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
                style={mode === "standard" && variants.has(e) ? { borderColor: WARN } : undefined}
                title={`rank #${i + 1}`}
              >
                {show(e)}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Fully merged at {rows} rows, this text is <span className="tabular-nums text-foreground">{finalStd}</span>{" "}
          tokens with the standard table and <span className="tabular-nums text-foreground">{finalComb}</span>{" "}
          with the combinatorial one. The standard table spends{" "}
          <span style={{ color: WARN }}>{std.variantRows}</span> of its rows on spellings of words it already has; the
          combinatorial table spends none, and those rows became longer merges. Dashed chips are characters outside the
          table, charged one token per UTF-8 byte in both schemes.
        </p>
        <p className="font-mono text-[10px] leading-4 text-muted-foreground">
          training text: {CORPUS.length} characters, six sentences, built in · toy scale, not a real vocabulary
        </p>
      </div>
    </figure>
  )
}
