"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// My own measurement, not Hugging Face's: tokenizers 0.23.2 against 1.0.0rc2, both the
// official PyPI wheels, through the Python bindings. One core (taskset -c 3) at nice 19 on a
// shared 4-vCPU Intel Xeon @ 2.10 GHz while the other three cores ran something else, so the
// absolute MB/s are low and noisy; the ratio is the number to read. Corpora are Hugging Face's
// own tokbench fixtures (revision bafa2fb), cut into 10 KiB documents; the first fifth warms
// the tokenizer and the next two fifths are timed, one encode() call per document, so no timed
// document was seen before. Median of three fresh processes. Token ids were identical across
// the two versions on every corpus below (sha256 over all ids).
//
// "HF" is the announcement's own ratio for that model family (Rust crate, Apple M4 Max,
// aggregated over 22 corpora), and for the language row the announcement's ratio for that
// language (aggregated over 10 model families). Bar widths are linear; nothing transcendental.

type Row = { corpus: string; old: number; neu: number; hfLang: number }
type Tok = { key: string; label: string; vocab: string; hfModel: number; rows: Row[] }

const TOKS: Tok[] = [
  {
    key: "gpt2",
    label: "GPT-2",
    vocab: "50,257",
    hfModel: 29.83,
    rows: [
      { corpus: "English", old: 2.18, neu: 89.05, hfLang: 22.44 },
      { corpus: "Hindi", old: 2.18, neu: 117.12, hfLang: 12.52 },
      { corpus: "Chinese", old: 1.86, neu: 35.39, hfLang: 6.77 },
    ],
  },
  {
    key: "llama3",
    label: "Llama-3",
    vocab: "128,000",
    hfModel: 26.58,
    rows: [
      { corpus: "English", old: 2.03, neu: 77.0, hfLang: 22.44 },
      { corpus: "Hindi", old: 2.58, neu: 125.84, hfLang: 12.52 },
      { corpus: "Chinese", old: 2.48, neu: 18.35, hfLang: 6.77 },
    ],
  },
  {
    key: "qwen",
    label: "Qwen2.5",
    vocab: "151,643",
    hfModel: 13.0,
    rows: [
      { corpus: "English", old: 1.89, neu: 78.58, hfLang: 22.44 },
      { corpus: "Hindi", old: 2.3, neu: 42.73, hfLang: 12.52 },
      { corpus: "Chinese", old: 1.89, neu: 16.29, hfLang: 6.77 },
    ],
  },
]

const NEW = "oklch(0.62 0.15 250)"
const OLD = "oklch(0.68 0.03 250)"

export function MeasuredSpeedups() {
  const [key, setKey] = useState("gpt2")
  const tok = TOKS.find((t) => t.key === key) ?? TOKS[0]
  const max = Math.max(...TOKS.flatMap((t) => t.rows.map((r) => r.neu)))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">measured · one core, nice 19 · Python bindings</span>
        <div className="flex gap-1" role="group" aria-label="tokenizer">
          {TOKS.map((t) => (
            <button key={t.key} type="button" aria-pressed={key === t.key} onClick={() => setKey(t.key)} className={chip(key === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: OLD }} />
            tokenizers 0.23.2
          </span>
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ background: NEW }} />
            tokenizers 1.0.0rc2
          </span>
          <span>encode MB/s, linear axis, same scale for all three tokenizers</span>
        </div>

        {tok.rows.map((r) => {
          const x = r.neu / r.old
          return (
            <div key={r.corpus} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-x-2 gap-y-1">
              <span className="row-span-2 font-mono text-xs">{r.corpus}</span>
              <div className="h-3 rounded-sm bg-muted/30">
                <div className="h-3 rounded-sm" style={{ width: `${((100 * r.old) / max).toFixed(2)}%`, background: OLD, minWidth: 2 }} />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{r.old.toFixed(2)}</span>
              <div className="h-3 rounded-sm bg-muted/30">
                <div className="h-3 rounded-sm" style={{ width: `${((100 * r.neu) / max).toFixed(2)}%`, background: NEW }} />
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums" style={{ color: NEW }}>
                {r.neu.toFixed(2)}
              </span>
              <span />
              <span className="font-mono text-[11px] text-muted-foreground">
                {x.toFixed(1)}× here · HF reports {r.hfLang}× for {r.corpus} across 10 families
              </span>
              <span />
            </div>
          )
        })}

        <p className="text-sm leading-6 text-muted-foreground">
          {tok.label}, a {tok.vocab}-entry base vocabulary. HF&rsquo;s own ratio for this family is{" "}
          <span className="text-foreground">{tok.hfModel}×</span>, through the Rust crate on an Apple M4 Max, over 22
          corpora. The direction agrees on every row and Chinese gains least of these three in both measurements; my magnitudes on
          English and Hindi are larger than theirs, on a different CPU and through the Python bindings.
        </p>
      </div>
    </figure>
  )
}
