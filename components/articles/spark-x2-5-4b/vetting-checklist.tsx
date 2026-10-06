"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// A reusable 15-minute vetting pass for a viral open-weights model, walked
// through on XHToken/Spark-X2.5-4B. Each step: what to fetch, what to look
// for, what this model showed, and a verdict. Every figure here is in the
// article prose, labelled there as measured, reported or reasoned.

type Verdict = "pass" | "fail" | "unclear"

type Step = {
  id: string
  title: string
  time: string
  fetch: string
  look: string
  found: string
  verdict: Verdict
  label: string
}

const STEPS: Step[] = [
  {
    id: "org",
    title: "Who published it",
    time: "1 min",
    fetch: "GET /api/organizations/<org>/overview, then a search in the publisher's own language",
    look: "A known lab, a history of releases, press that names a company rather than a handle.",
    found:
      "XHToken is 词元星火, which Chinese press describes as a wholly owned iFlytek subsidiary. 词元 is the Chinese word for a token in the NLP sense. No coin is mentioned anywhere in the model's files, org page or launch coverage. The org has no verified badge.",
    verdict: "pass",
    label: "known lab",
  },
  {
    id: "config",
    title: "Read config.json",
    time: "2 min",
    fetch: "config.json, generation_config.json, tokenizer_config.json",
    look: "Does the shape match the claim (size, context, layer types)? Any fields that contradict each other?",
    found:
      "Spark2_5ForCausalLM: 36 layers at hidden 2,560, 27 sliding-window layers (window 512) and 9 full-attention layers, max_position_embeddings 1,048,576, no rope_scaling. One inconsistency: tokenizer_config.json says model_max_length 131,072.",
    verdict: "pass",
    label: "matches card",
  },
  {
    id: "tensors",
    title: "Count the tensors",
    time: "2 min",
    fetch: "8-byte length + JSON header of each .safetensors shard, by HTTP Range request",
    look: "Total parameters, dtypes, tensor names. A count that matches the card to the digit is a good sign.",
    found:
      "290 tensors, all BF16, 4,112,079,360 parameters: exactly the card's figure. Non-embedding 3,776,535,040, also exact. Tied embeddings, so no lm_head tensor.",
    verdict: "pass",
    label: "exact",
  },
  {
    id: "base",
    title: "Is it someone else's model?",
    time: "4 min",
    fetch: "configs and tokenizers of likely bases; one MLP tensor from each, by Range request",
    look: "Identical shapes and vocab are strong evidence of a rename. Weight rows that line up are near-proof.",
    found:
      "No config matches Qwen3-4B, Qwen3.5-4B, Gemma-3-4B, Gemma-4-E4B, Llama-3.2-3B, Phi-4-mini or Ministral-3B. The 131,072-token vocabulary is its own. Layer-0 MLP rows sit at the 0.078-0.079 noise floor against all four candidates with that width, against 0.987 for its own base checkpoint.",
    verdict: "pass",
    label: "own weights",
  },
  {
    id: "code",
    title: "Read the remote code",
    time: "3 min",
    fetch: "every .py the auto_map points at; grep for network, file, subprocess and eval calls",
    look: "Plain PyTorch modules, or anything that phones home, downloads, decodes or executes strings.",
    found:
      "Two files, imports only math, torch and transformers. No network, file, subprocess, exec or eval. And you can skip it: llama.cpp ships a native spark2_5 architecture, so the GGUF path runs none of this Python.",
    verdict: "pass",
    label: "clean",
  },
  {
    id: "context",
    title: "Check the context claim",
    time: "1 min",
    fetch: "rope parameters, layer types, KV heads, head_dim",
    look: "Positions the encoding can tell apart, and the KV cache the claimed length would need.",
    found:
      "Config is consistent with 1M: full layers rotate 64 of 256 dims at theta 5,000,000. Training at 1M is reported, not checkable. The cache at 1,048,576 tokens is 36 GiB in bf16, which is not a 16 GB laptop.",
    verdict: "unclear",
    label: "true, with a cost",
  },
  {
    id: "bench",
    title: "Weigh the benchmarks",
    time: "1 min",
    fetch: "the card's table, its footnotes, any eval code or logs",
    look: "Who ran the rival numbers? Is the chart a subset of the table? Does anything break a pattern?",
    found:
      "No eval code or logs. 78 of 114 rival cells carry no asterisk, so by the card's own footnote they were not copied from published cards. The chart shows 8 of 21 rows. Of the models with both scores, Spark-X2.5-4B is the only one higher on SWE-Bench Pro than on SWE-Bench Verified.",
    verdict: "unclear",
    label: "vendor-reported",
  },
  {
    id: "pop",
    title: "Check the popularity claim",
    time: "1 min",
    fetch: "/api/models?sort=trendingScore and the model's own trendingScore and downloads",
    look: "Rank today, and the gap between the post's date and the release date.",
    found:
      "On 2026-10-06 it is #149 on the trending list with a score of 33; the top model scores 1,427. The post is from 2026-10-05, five weeks after launch. An earlier #1 cannot be reconstructed from the API.",
    verdict: "fail",
    label: "stale or unverified",
  },
]

const COLOR: Record<Verdict, string> = {
  pass: "oklch(0.60 0.14 150)",
  fail: "oklch(0.58 0.19 25)",
  unclear: "oklch(0.70 0.14 80)",
}

export function VettingChecklist() {
  const [open, setOpen] = useState<string>("org")
  const counts = STEPS.reduce(
    (a, s) => ({ ...a, [s.verdict]: a[s.verdict] + 1 }),
    { pass: 0, fail: 0, unclear: 0 } as Record<Verdict, number>,
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">vetting a viral model · Spark-X2.5-4B</span>
        <span className="flex gap-3 font-mono text-[10px] text-muted-foreground">
          {(["pass", "unclear", "fail"] as Verdict[]).map((v) => (
            <span key={v} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLOR[v] }} />
              {counts[v]} {v}
            </span>
          ))}
        </span>
      </div>

      <ol className="divide-y">
        {STEPS.map((s, i) => {
          const isOpen = open === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : s.id)}
                aria-expanded={isOpen}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors",
                  isOpen ? "bg-muted/30" : "hover:bg-muted/20",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{s.title}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">{s.time}</span>
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-mono text-[10px] text-white"
                  style={{ background: COLOR[s.verdict] }}
                >
                  {s.verdict} · {s.label}
                </span>
              </button>
              {isOpen ? (
                <div className="space-y-2 px-4 pb-4 pt-1 sm:pl-12">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">fetch</div>
                    <div className="font-mono text-[11px] leading-5 text-foreground">{s.fetch}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">look for</div>
                    <div className="text-sm leading-6 text-muted-foreground">{s.look}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">found</div>
                    <div className="text-sm leading-6 text-foreground">{s.found}</div>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
