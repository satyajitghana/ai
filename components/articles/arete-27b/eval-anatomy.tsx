"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every count below is MEASURED from NousResearch/Propaganda_Eval data/items.jsonl (803 rows, downloaded
// 2026-11-10). Categories overlap: 369 items carry one category, 408 carry two, 26 carry three. One item (f320) is
// labelled "governance" and "expression" instead of the canonical names, so it is outside all seven rows below.
// Source year is the /YYYY/MM/ in the source URL, else the recorded source_date; 145 items have neither.

type Bar = { label: string; n: number; note?: string; hi?: boolean }

const VIEWS: { id: string; tab: string; title: string; total: string; bars: Bar[]; text: string }[] = [
  {
    id: "cat",
    tab: "categories",
    title: "Items per value category (overlapping)",
    total: "1,263 labels on 803 items",
    bars: [
      { label: "state ideology", n: 272 },
      { label: "state vs free market", n: 212 },
      { label: "freedom of expression", n: 189 },
      { label: "education policy", n: 170 },
      { label: "data privacy and surveillance", n: 156 },
      { label: "environmental strategy", n: 133 },
      { label: "democracy and governance", n: 129 },
    ],
    text: "The seven counts match the dataset card exactly. They add to more than 803 because 434 items sit in two or three categories, so a per-category score is not an independent measurement.",
  },
  {
    id: "type",
    tab: "question types",
    title: "Items per question type",
    total: "803 items · 1,914 required facts",
    bars: [
      { label: "named fact", n: 564, note: "median 25 words" },
      { label: "frame testing", n: 222, note: "median 57 words" },
      { label: "closed exit", n: 17, note: "median 33 words" },
    ],
    text: "Named-fact items ask for documented specifics. Frame-testing items state a contested reading and ask the model to accept or reject it, and they run more than twice as long. Closed exit has 17 items, which the card itself calls too few for a stable per-type number.",
  },
  {
    id: "src",
    tab: "sources",
    title: "Items per source domain",
    total: "405 URLs on 31 domains",
    bars: [
      { label: "chinadigitaltimes.net", n: 194 },
      { label: "chinalawtranslate.com", n: 131 },
      { label: "en.npc.gov.cn.cdurl.cn", n: 123, hi: true },
      { label: "chinamediaproject.org", n: 88 },
      { label: "english.mee.gov.cn", n: 58, hi: true },
      { label: "hongkongfp.com", n: 55 },
      { label: "en.moj.gov.cn", n: 44, hi: true },
      { label: "en.moe.gov.cn", n: 31, hi: true },
      { label: "subsites.chinadaily.com.cn", n: 20, hi: true },
      { label: "22 other domains", n: 59 },
    ],
    text: "Two kinds of source dominate. 299 items cite a PRC government or state-media host, mostly official English translations of statutes, and those items test whether a model can recite the state's own documents. Most of the rest cite three independent China-watching and legal-translation sites, which supply 413 items between them.",
  },
  {
    id: "year",
    tab: "source dates",
    title: "Items per source year",
    total: "658 of 803 dated",
    bars: [
      { label: "2009 or earlier", n: 99 },
      { label: "2010-2019", n: 107 },
      { label: "2020", n: 63 },
      { label: "2021", n: 135 },
      { label: "2022", n: 46 },
      { label: "2023", n: 50 },
      { label: "2024", n: 102 },
      { label: "2025", n: 16, hi: true },
      { label: "2026", n: 40, hi: true },
      { label: "undated", n: 145 },
    ],
    text: "56 items cite a source from 2025 or 2026, 29 of them from September 2026 alone. A model whose training data stops before that cannot state those facts however it is aligned, and the scorer counts that as a miss. The card flags this.",
  },
  {
    id: "len",
    tab: "prompt length",
    title: "Prompts per length band (words)",
    total: "28,028 words · median 28",
    bars: [
      { label: "10-19", n: 54 },
      { label: "20-29", n: 413 },
      { label: "30-39", n: 159 },
      { label: "40-49", n: 51 },
      { label: "50-59", n: 23 },
      { label: "60-69", n: 25 },
      { label: "70-79", n: 32 },
      { label: "80-89", n: 25 },
      { label: "90-99", n: 17 },
      { label: "100-109", n: 4 },
    ],
    text: "Every prompt is one English question with no system prompt. Two prompts contain Han characters and ten required facts quote a Chinese term. The eval says nothing about how a model answers the same questions in Chinese.",
  },
]

const C_BAR = "oklch(0.62 0.12 250)"
const C_HI = "oklch(0.66 0.14 60)"

export function EvalAnatomy() {
  const [id, setId] = useState("cat")
  const v = VIEWS.find((x) => x.id === id) ?? VIEWS[0]
  const max = Math.max(...v.bars.map((b) => b.n))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Propaganda_Eval, counted</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured · data/items.jsonl</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              aria-pressed={id === x.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                id === x.id ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.tab}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm text-foreground">{v.title}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{v.total}</span>
        </div>
        <div className="mt-2 space-y-1">
          {v.bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-44 shrink-0 truncate text-right font-mono text-[10px] text-foreground sm:w-52">{b.label}</span>
              <div className="relative h-4 flex-1 rounded-sm bg-muted/40" role="img" aria-label={`${b.label}: ${b.n}`}>
                <div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{ width: `${((b.n / max) * 100).toFixed(1)}%`, background: b.hi ? C_HI : C_BAR, opacity: 0.85 }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{b.n}</span>
              {v.bars.some((x) => x.note) ? (
                <span className="hidden w-28 shrink-0 font-mono text-[9px] text-muted-foreground sm:block">{b.note ?? ""}</span>
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{v.text}</p>
      </div>
    </figure>
  )
}
