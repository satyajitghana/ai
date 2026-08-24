"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The L0-L4 tiered data framework, and where Ultra-FineWeb sits in it.
//
// The interesting shift in this release is not the dataset, it is that OpenBMB
// stopped shipping "a corpus" and started shipping a *pipeline with named
// intermediate stages*, each released separately. L1 is the cleaned raw web; L2
// is what the classifier selected out of it; L3 is what a model rewrote from L2.
//
// Two of those tiers have unusual token economics worth reading carefully. L2
// keeps roughly a trillion English tokens out of L1's trillion-plus, which is a
// far gentler cut than "high-quality filtering" usually implies. And L3 turns
// L2 into 400B+ English and 200B+ Chinese tokens of synthetic Q&A and rewrites —
// meaning the Chinese synthetic layer is nearly twice the size of the Chinese
// natural layer it was derived from.
//
// Token counts are the dataset card's own.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Tier = {
  key: string
  tag: string
  label: string
  en: string
  zh: string
  color: string
  what: string
  note: string
}

const TIERS: Tier[] = [
  {
    key: "l1",
    tag: "L1",
    label: "Ultra-FineWeb-L1",
    en: "1T+ tokens · ~1.14B documents",
    zh: "Common Crawl through CC-MAIN-2025-51",
    color: MUTED,
    what: "main-text extraction · language filtering · heuristic filtering · sensitive-field replacement · customized cleaning · deduplication",
    note: "The cleaned raw web, released as its own artifact. The card claims it covers the most recent Common Crawl snapshots of any open web pretraining dataset — which matters more than it sounds, because the alternative is that every open corpus is quietly three years stale.",
  },
  {
    key: "l2",
    tag: "L2",
    label: "Ultra-FineWeb",
    en: "~1T English tokens",
    zh: "~120B Chinese tokens",
    color: GOOD,
    what: "selected from L1 by the Ultra-FineWeb classifier — a lightweight fastText model, not an LLM judge",
    note: "The selected layer, and the one the benchmarks above measure. The classifier is fastText because the whole design constraint is that a filter has to run over a trillion tokens: an LLM-based classifier that costs a forward pass per document is not a filter, it is a second pretraining run.",
  },
  {
    key: "l3",
    tag: "L3",
    label: "Ultra-FineWeb-L3",
    en: "400B+ English tokens",
    zh: "200B+ Chinese tokens",
    color: ACCENT,
    what: "Q&A pair generation and multi-style rewriting over L2",
    note: "Synthetic refinement, and by the team's count the largest open-source Chinese pretraining synthetic corpus released. Note the ratio: the Chinese synthetic layer is nearly twice the size of the Chinese natural layer it was rewritten from, which is either the most valuable thing here or the most load-bearing assumption, depending on how the rewriting holds up.",
  },
]

const USED_BY = [
  { l: "MiniCPM4 series", note: "Ultra-FineWeb as the core pretraining web dataset" },
  { l: "MiniCPM5-1B", note: "a dense 1B for on-device deployment, claimed 1B-class open-source SOTA" },
]

export function DataTiers() {
  const [sel, setSel] = useState("l2")
  const t = TIERS.find((x) => x.key === sel) ?? TIERS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the L0–L4 tiered framework · every stage shipped as its own dataset
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          Apache 2.0 · check each source&rsquo;s own licence
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {TIERS.map((x, i) => (
            <div key={x.key}>
              <button
                type="button"
                onClick={() => setSel(x.key)}
                aria-pressed={sel === x.key}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                  sel === x.key ? "border-foreground/30 bg-muted/40" : "border-border hover:bg-muted/20",
                )}
              >
                <span
                  className="shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[10px]"
                  style={{ background: `${x.color}33`, color: x.color }}
                >
                  {x.tag}
                </span>
                <span className="w-40 shrink-0 truncate font-mono text-[11px] text-foreground">{x.label}</span>
                <span className="w-48 shrink-0 truncate font-mono text-[9px] text-muted-foreground">{x.en}</span>
                <span className="truncate font-mono text-[9px] text-muted-foreground">{x.zh}</span>
              </button>
              {i < TIERS.length - 1 ? (
                <div className="py-0.5 text-center font-mono text-[10px] text-muted-foreground">↓</div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: t.color }}>
            {t.tag} · {t.label}
          </div>
          <div className="mt-1 font-mono text-[9px] text-muted-foreground">{t.what}</div>
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{t.note}</div>
        </div>

        <div className="mt-3 space-y-1">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what it feeds</div>
          {USED_BY.map((u) => (
            <div key={u.l} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
              <span className="w-32 shrink-0 text-right text-foreground">{u.l}</span>
              <span className="text-muted-foreground">{u.note}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The shift worth noticing is that this is not a corpus release, it is a{" "}
          <span className="text-foreground">pipeline with named, separately-downloadable intermediate
          stages</span>. You can take the cleaned raw web and apply your own selector, take the classifier and run
          it on your own corpus, or take the synthetic layer and skip the first two entirely. Almost every other
          open pretraining dataset ships only the output, which means reproducing a different filtering decision
          means redoing the crawl processing.
          <br />
          <br />
          And the token accounting is worth reading closely at L2. Roughly a trillion English tokens survive from
          a trillion-plus — a much gentler cut than &ldquo;high-quality filtering&rdquo; usually implies. Whatever
          the classifier is selecting for, it is not scarcity.
        </p>
      </div>
    </figure>
  )
}
