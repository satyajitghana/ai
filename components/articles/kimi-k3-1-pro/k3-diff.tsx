"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Kimi K3 (July 2026) against Kimi K3.1 Pro (23 October 2026), row by row.
// First written 2026-10-24 from the K3 technical report, K3's config.json, the
// Kimi API pricing page, the K3.1 Pro launch blog, OpenRouter's endpoint
// listing and Artificial Analysis's model page. Updated 2026-11-12 after the
// weights landed (moonshotai/Kimi-K3.1-Pro, initial commit 2026-11-02): the
// "measured" rows are read from both repos' config.json, LICENSE, Hub API and
// all 96 safetensors headers of each, by HTTP range request. The "src" field
// says which kind of evidence each row is.

type Status = "same" | "changed" | "new" | "unknown"
type Src = "measured" | "reported" | "third-party" | "reasoned"
type Row = { group: string; label: string; k3: string; k31: string; status: Status; src: Src; note?: string }

const ROWS: Row[] = [
  { group: "Shape", label: "Parameters (Hub count)", k3: "2,779,931,837,184", k31: "2,780,110,363,392", status: "changed", src: "measured", note: "+178,526,208, all of it the new indexer" },
  { group: "Shape", label: "Context window", k3: "1,048,576", k31: "1,048,576", status: "same", src: "measured" },
  { group: "Shape", label: "Attention", k3: "69 KDA + 24 Gated MLA", k31: "69 KDA + 24 Gated DSA", status: "changed", src: "measured", note: "same 24 layers, each with a top-2,048 indexer added" },
  { group: "Shape", label: "Experts", k3: "16 of 896 routed + 2 shared", k31: "16 of 896 routed + 2 shared", status: "same", src: "measured" },
  { group: "Shape", label: "Tensors", k3: "497,220", k31: "497,340", status: "changed", src: "measured", note: "all 497,220 shared tensors keep name, shape, dtype and shard" },
  { group: "Shape", label: "Weight bytes", k3: "96 shards", k31: "96 shards, every hash new", status: "changed", src: "measured", note: "72 of them keep the exact byte size and still hash differently" },
  { group: "Shape", label: "model_type", k3: "kimi_k3", k31: "kimi_k31", status: "changed", src: "measured" },
  { group: "Shape", label: "Modeling code in repo", k3: "modeling_kimi_k3.py", k31: "none; config class only", status: "changed", src: "measured", note: "the card points to vLLM, SGLang and TokenSpeed" },
  { group: "Shape", label: "Tokenizer", k3: "tiktoken.model", k31: "identical file", status: "same", src: "measured", note: "same sha256" },
  { group: "Shape", label: "Precision", k3: "MXFP4 experts, BF16 / F32 rest", k31: "MXFP4 experts, BF16 / F32 rest", status: "same", src: "measured" },
  { group: "Training", label: "Pre-training", k3: "K3 base", k31: "same base", status: "same", src: "reported" },
  { group: "Training", label: "Mid-training corpus", k3: "general corpus", k31: "cyber-related data removed", status: "changed", src: "reported", note: "a post-training-only release would not touch this" },
  { group: "Training", label: "RL", k3: "9 experts, merged by MOPD", k31: "substantially more compute, joint RL over hundreds of domains", status: "changed", src: "reported", note: "no compute figure, no report" },
  { group: "Training", label: "RL environment mix", k3: "included cyber tasks", k31: "cyber environments filtered out", status: "changed", src: "reported" },
  { group: "Serving", label: "API $ / MTok (in / out / cached)", k3: "3.00 / 15.00 / 0.30", k31: "2.00 / 10.00 / 0.20", status: "changed", src: "reported" },
  { group: "Serving", label: "Fast variant", k3: "none", k31: "Highspeed: 2-3× speed at 4.00 / 20.00 / 0.20", status: "new", src: "reported", note: "how it is faster is not stated" },
  { group: "Serving", label: "Median output speed", k3: "38.5 tok/s", k31: "77.1 tok/s", status: "changed", src: "third-party", note: "Artificial Analysis, standard endpoint, max effort, 24 Oct" },
  { group: "Serving", label: "Weights", k3: "open, Kimi K3 License", k31: "open 2 Nov, Kimi K3.1-Pro License", status: "changed", src: "measured", note: "K3's licence text with the model name swapped" },
  { group: "Results", label: "Kimi Code Bench 3.0 Long-horizon", k3: "55.95", k31: "61.2", status: "changed", src: "reported" },
  { group: "Results", label: "Kimi Hallu Bench Hard, claim-level", k3: "23.4%", k31: "8.3%", status: "changed", src: "reported", note: "the −65% in the post" },
  { group: "Results", label: "xdev-bench-hard, pass@3", k3: "33.3", k31: "81.0", status: "changed", src: "reported", note: "90.5 without the cyber data removal" },
  { group: "Results", label: "Internal finance evals", k3: "baseline", k31: "+7.2 modeling, +11.6 research, ~4.2× business ops", status: "changed", src: "reported" },
  { group: "Results", label: "AA Intelligence Index (current)", k3: "43.6", k31: "55.1", status: "changed", src: "third-party", note: "read 24 Oct" },
]

const TONE: Record<Status, string> = {
  same: "oklch(0.66 0.03 250)",
  changed: "oklch(0.6 0.17 255)",
  new: "oklch(0.62 0.16 150)",
  unknown: "oklch(0.68 0.14 70)",
}

export function K3Diff() {
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [group, setGroup] = useState<string>("all")
  const groups = ["all", ...Array.from(new Set(ROWS.map((r) => r.group)))]
  const rows = ROWS.filter((r) => (group === "all" || r.group === group) && (!onlyChanged || r.status !== "same"))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-dashed border-foreground/15 text-muted-foreground hover:text-foreground",
    )

  const counts = (["same", "changed", "new", "unknown"] as Status[]).map((s) => [s, ROWS.filter((r) => r.status === s).length] as const)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">kimi k3 → k3.1 pro</span>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)} className={chip(group === g)}>
              {g.toLowerCase()}
            </button>
          ))}
          <button type="button" aria-pressed={onlyChanged} onClick={() => setOnlyChanged((v) => !v)} className={chip(onlyChanged)}>
            hide unchanged
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {counts.map(([s, n]) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE[s] }} />
              {s} · {n}
            </span>
          ))}
        </div>

        <div className="space-y-1.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-1 gap-1 rounded-lg border bg-background/40 px-3 py-2 sm:grid-cols-[minmax(0,12rem)_1fr]"
              style={{ borderLeftWidth: 3, borderLeftColor: TONE[r.status] }}
            >
              <div className="font-mono text-[11px] text-muted-foreground">
                {r.label}
                <span className="block text-[10px] opacity-70">{r.src}</span>
              </div>
              <div className="font-mono text-[11px]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-muted-foreground">{r.k3}</span>
                  <span className="text-muted-foreground/50">&rarr;</span>
                  <span className="font-medium" style={{ color: r.status === "same" ? undefined : TONE[r.status] }}>
                    {r.k31}
                  </span>
                </div>
                {r.note ? <div className="mt-0.5 text-[10px] text-muted-foreground">{r.note}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          On 24 October every shape row here was grey, on Moonshot&apos;s word that K3.1 Pro is K3 with more post-training.
          The released files keep that true for the experts, the window, the tokenizer and every one of K3&apos;s 497,220
          tensors, and break it in one place: the 24 full-attention layers each gained a sparse-attention indexer. The
          training rows are still Moonshot&apos;s account. Cyber data was removed from the{" "}
          <em>mid-training</em>{" "}corpus, so a mid-training stage was rerun, not only RL on top of the K3 checkpoint.
        </p>
      </div>
    </figure>
  )
}
