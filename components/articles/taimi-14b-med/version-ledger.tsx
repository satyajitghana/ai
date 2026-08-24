"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What v0.1.0 of a "medical-specialized large language model" actually contains.
//
// The card answers this in a blockquote near the top, and the answer changes what
// every number below it means:
//
//   "Current release v0.1.0 consists of the base-model weights with a rebranded
//    configuration. Post-trained medical weights will be released in a later
//    version (v0.2.0+), and this card will be updated with fresh evaluation
//    results at that time."
//
// And again at the bottom of the evaluation section:
//
//   "v0.1.0 contains base-model weights; the evaluation above reflects
//    base-model capability."
//
// So the benchmark table is measuring Qwen2.5-14B-Instruct-AWQ under a different
// name, and the card says so twice. That is more disclosure than this genre
// usually offers, and it is still a page where the model name, the description
// and the results table all point at something that does not exist yet.
//
// The point of this widget is not to catch anyone out. It is that the distance
// between what a card's headline implies and what its footnotes concede is a
// thing worth being able to see at a glance, on every card.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Claim = { l: string; where: string; state: "shipped" | "planned" | "inherited" }

const CLAIMS: Claim[] = [
  { l: "14.7B parameters, 13.1B non-embedding", where: "model information table", state: "inherited" },
  { l: "AWQ 4-bit, 10.31 GB of weights", where: "model information table", state: "inherited" },
  { l: "48 layers · 40 Q heads · 8 KV heads · RoPE / SwiGLU / RMSNorm", where: "model information table", state: "inherited" },
  { l: "32,768 context (deployed at 4,096)", where: "model information table", state: "inherited" },
  { l: "vLLM serving, OpenAI-compatible API", where: "quickstart", state: "shipped" },
  { l: "CMB 74.0% · CMExam 77.4% · CMDD ~60", where: "evaluation table", state: "inherited" },
  { l: "medical post-training", where: "version note", state: "planned" },
  { l: "re-evaluation on medical weights", where: "version note", state: "planned" },
]

const STATE = {
  shipped: { l: "in this release", c: GOOD },
  inherited: { l: "inherited from Qwen2.5-14B-Instruct-AWQ", c: ACCENT },
  planned: { l: "v0.2.0+, not yet released", c: WARM },
} as const

export function VersionLedger() {
  const [filter, setFilter] = useState<"all" | "shipped" | "inherited" | "planned">("all")
  const rows = filter === "all" ? CLAIMS : CLAIMS.filter((c) => c.state === filter)
  const counts = {
    shipped: CLAIMS.filter((c) => c.state === "shipped").length,
    inherited: CLAIMS.filter((c) => c.state === "inherited").length,
    planned: CLAIMS.filter((c) => c.state === "planned").length,
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Taimi-14B-Med v0.1.0 · what the card claims, and where each claim comes from
        </span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          {counts.inherited} inherited · {counts.shipped} new · {counts.planned} planned
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: WARM }}>
          <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: WARM }}>
            the version note, quoted in full
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            &ldquo;Current release <span className="font-mono text-[11px] text-foreground">v0.1.0</span>{" "}consists
            of the base-model weights with a rebranded configuration. Post-trained medical weights will be released
            in a later version (v0.2.0+), and this card will be updated with fresh evaluation results at that
            time.&rdquo;
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "everything"],
              ["inherited", "inherited"],
              ["shipped", "new in v0.1.0"],
              ["planned", "planned"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                filter === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {rows.map((c) => (
            <div key={c.l} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STATE[c.state].c }} />
              <span className="flex-1 truncate font-mono text-[10px] text-foreground">{c.l}</span>
              <span className="hidden w-40 shrink-0 truncate text-right font-mono text-[9px] text-muted-foreground sm:inline">
                {c.where}
              </span>
              <span className="w-56 shrink-0 truncate text-right font-mono text-[9px]" style={{ color: STATE[c.state].c }}>
                {STATE[c.state].l}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every architectural row is Qwen2.5-14B-Instruct-AWQ&rsquo;s, because at v0.1.0 the model{" "}
          <em>is</em>{" "}Qwen2.5-14B-Instruct-AWQ. What ships new is a serving configuration and a name. The
          medical part — the entire premise of the release — is the row marked planned.
          <br />
          <br />
          I want to be careful about what that does and does not mean, because the card is{" "}
          <span className="text-foreground">unusually honest</span>{" "}about it: the note is at the top, it is
          repeated at the bottom of the evaluation section, and the licence section correctly attributes Apache 2.0
          to the base model. Nobody is hiding anything. What is worth noticing is the structure — a name, a
          description, and a benchmark table that together read as a medical model, with the correction living in
          a blockquote. That structure is extremely common and mostly not disclosed at all.
        </p>
      </div>
    </figure>
  )
}
