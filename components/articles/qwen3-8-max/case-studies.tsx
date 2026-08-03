"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The five long-horizon, no-human-in-the-loop case studies, side by side. The
// point of putting them in one switcher is scale comparison: these run from 24
// hours to a 365-simulated-day economy, and the "stats" are the same three kinds
// of thing every time — how long it ran unsupervised, how much it produced, and
// what the result was — so a reader can flip through and calibrate all five
// against each other instead of reading five separate paragraphs in isolation.

const ACCENT = "oklch(0.62 0.14 195)"

type Stat = { label: string; value: string }
type CaseStudy = {
  key: string
  title: string
  duration: string
  durationNote: string
  stats: Stat[]
  mechanism: string
  result?: string
  link?: { href: string; label: string }
}

const CASES: CaseStudy[] = [
  {
    key: "oh-my-cli",
    title: "oh-my-cli — a self-evolving harness",
    duration: "~16 days",
    durationNote: "fully autonomous, as of Jul 30 2026",
    stats: [
      { label: "commits", value: "265" },
      { label: "PRs merged", value: "127" },
      { label: "issues", value: "151" },
    ],
    mechanism: "An issue state machine moves work through ready → leased → active; agents claim issues, run E2E/unit/build/desktop-lifecycle tests after every change, and route failures back to the same issue for repair — continuously evolving its own /goal, /resume, and session-replay features from community and user feedback.",
    link: { href: "https://github.com/qwen-code-dev-bot/oh-my-cli", label: "public trace on GitHub" },
  },
  {
    key: "paper-repro",
    title: "Reproduce a paper, then beat it",
    duration: "~125 hours",
    durationNote: "≈5 days, starting from only the paper + GPUs — no starter code",
    stats: [
      { label: "lines of code", value: "~7,600" },
      { label: "actions taken", value: "1,100+" },
      { label: "GPU training rounds", value: "33" },
    ],
    mechanism: "37 hours rebuilding arXiv 2605.22389's full pipeline from zero and reproducing all six of its findings, then 88 hours running a self-improving loop — hypothesis → code → GPU run → analyze, repeat — across 4 rounds and 18 self-generated ideas, each round's failures diagnosing the next round's hypothesis.",
    result: "AIME24: 49.58% → 52.29% (+2.71)",
  },
  {
    key: "tianchi",
    title: "Beat 526 human teams in 24 hours",
    duration: "24 hours",
    durationNote: "strict competition time limit",
    stats: [
      { label: "submissions", value: "45" },
      { label: "human teams beaten", value: "458 / 526" },
      { label: "beat rate", value: "87%" },
    ],
    mechanism: "Fine-tuned and ensembled BERT, MacBERT, and RoBERTa for chat text; fine-tuned Qwen2.5-VL-7B (backed by Chinese-CLIP for uncertain cases) for product screenshots; fused everything through a weighted-voting system calibrated by cross-validation, re-weighted after every submission.",
    result: "accuracy 0.60 → 0.853",
  },
  {
    key: "chip-design",
    title: "Autonomous chip design",
    duration: "~500 turns",
    durationNote: "71 evaluations, 13 milestones, one continuous run",
    stats: [
      { label: "gate count", value: "8,298 → 678" },
      { label: "die area", value: "106²→46² µm²" },
      { label: "timing slack", value: "−4.46 → +0.66 ns" },
    ],
    mechanism: "No golden reference design, no human intervention. The model iterated edit (RTL) → simulate (Iverilog) → synthesize (Yosys) → lay out (OpenROAD) entirely on its own — see the gate-count staircase below for the turn-by-turn trajectory.",
  },
  {
    key: "ecommerce",
    title: "365-day e-commerce simulation",
    duration: "365 sim-days",
    durationNote: "2,000+ rounds of interaction",
    stats: [
      { label: "starting capital", value: "¥100,000" },
      { label: "final balance", value: "¥416,252" },
      { label: "return", value: "4.16×" },
    ],
    mechanism: "Ran multiple online stores end-to-end — sourcing, multi-round supplier negotiation, inventory, dynamic pricing, returns — against a game-theoretic supplier matrix seeded with 152 fraudulent merchants running classic scam patterns.",
    result: "+38% vs. 2nd-place GLM 5.2 · +152% vs. Qwen3.7-Max",
  },
]

export function CaseStudies() {
  const [key, setKey] = useState(CASES[0].key)
  const cs = CASES.find((c) => c.key === key) ?? CASES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>five autonomous, no-human-in-the-loop runs</span>
        <span className="text-muted-foreground/50">24 hours → 365 sim-days</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CASES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setKey(c.key)}
              aria-pressed={key === c.key}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                key === c.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={key === c.key ? { background: ACCENT } : undefined}
            >
              {c.title.split(" — ")[0].split(" (")[0]}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h4 className="font-heading text-base font-semibold text-foreground">{cs.title}</h4>
            <div className="font-mono text-xs" style={{ color: ACCENT }}>
              {cs.duration}
            </div>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">{cs.durationNote}</div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {cs.stats.map((s) => (
              <div key={s.label} className="rounded-lg border bg-muted/15 px-3 py-2">
                <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">{s.label}</div>
                <div className="mt-0.5 font-mono text-sm font-medium text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">{cs.mechanism}</p>

          {cs.result ? (
            <p className="mt-2 font-mono text-sm" style={{ color: ACCENT }}>
              {cs.result}
            </p>
          ) : null}

          {cs.link ? (
            <a href={cs.link.href} className="mt-2 inline-block text-xs text-muted-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">
              {cs.link.label} →
            </a>
          ) : null}
        </div>

        <p className="mt-4 border-t pt-3 text-sm leading-6 text-muted-foreground">
          Different units, same shape: pick a goal, run for a long time with no one checking in, and produce a result
          that would normally need a team. The chip-design run is the one with a public, inspectable turn-by-turn
          trajectory beyond the GitHub trace above — worth its own chart, just below.
        </p>
      </div>
    </figure>
  )
}
