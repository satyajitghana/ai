"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What each week-two release actually put in public, filterable by readout
// family. Every cell is from the research notes behind the article: parameter
// counts are safetensors header sums read by range request (measured); "how it
// decides" is read from the release's own code, not run; the Jev column says
// who measured Jev and on what, because that is what decides whether a
// comparison means anything. Everything here is also in the article's prose;
// the card grid is a reference, not the argument.

type Family = "letter" | "scorer" | "pointer" | "writes" | "closed"

const FAMILY: Record<Family, { label: string; blurb: string }> = {
  letter: {
    label: "letter readout",
    blurb: "options go in the prompt as letters; the answer is the logits of those letter tokens",
  },
  scorer: {
    label: "per-option scorer",
    blurb: "each option is scored alone to one number; softmax over the numbers",
  },
  pointer: {
    label: "pointer",
    blurb: "options are spans in one shared sequence; a head points at one (Kev's family)",
  },
  writes: {
    label: "writes its answer",
    blurb: "a chat model writes probabilities into JSON; nothing is read off the logits",
  },
  closed: {
    label: "undisclosed",
    blurb: "no weights, no size, no architecture to read",
  },
}

type Release = {
  name: string
  who: string
  families: Family[]
  released: string
  decides: string
  cap: string
  jev: string
  open: string
  calib: string
}

const RELEASES: Release[] = [
  {
    name: "Lev",
    who: "Interfaze",
    families: ["letter", "scorer"],
    released:
      "LoRA r=32 (42,467,328 params) and a 3,673,600-param candidate head for Qwen3.5-4B",
    decides:
      "label-token logits read in two option orders and averaged; a set-attention candidate head takes over past the single-token codes",
    cap: "single-token codes, then the candidate head",
    jev: "same 13 subsets, same harness: Jev 0.761 macro, Lev 0.689; Jev wins 10",
    open: "levbench code, pinned items, per-subset logs; no per-item predictions",
    calib: "mean ECE 0.115 vs Jev 0.091",
  },
  {
    name: "XOR",
    who: "Juspay",
    families: ["letter"],
    released:
      "full merged BF16 weights, 35,107,181,936 params; no new head tensor; vision tower byte-identical to the base in every span sampled",
    decides: "letter logits A–Z, read forward and reversed, merged",
    cap: "26",
    jev: "README: none. JevBench ran it: 207 vs 200 public, 33.8% vs 36.7% sealed",
    open: "public-tier self-run; the JevBench row is independent",
    calib: "JevBench hard-tier ECE 0.030 (Jev 0.061)",
  },
  {
    name: "NeoHorse-Jev-4B",
    who: "TokenRhythm",
    families: ["pointer"],
    released:
      "4,540,576,768 params including a 1,311,232-param pointer head; Kev's runtime vendored and credited",
    decides: "Kev's pointer over option spans in one shared sequence",
    cap: "state 2,048 tokens; 32,768 total",
    jev: "none: first in a four-model table with no Jev row",
    open: "no eval code; training data not disclosed",
    calib: "not reported, by its own Limitations section",
  },
  {
    name: "Kev-0.8B on Core ML",
    who: "FluidInference",
    families: ["pointer"],
    released:
      "fp16 Core ML packages of Kev-0.8B: the LoRA folded into Qwen3.5-0.8B-Base plus Kev's pointer head; 3.55 GB repo, 1.51 GB on the fused path",
    decides: "Kev's pointer head, unchanged, on the Apple GPU",
    cap: "80 in the 1,024-token row package",
    jev: "none: the baseline is Kev's own PyTorch path on MPS",
    open: "conversion reports; Guess Who agreement as counts, no per-item answers",
    calib: "decision-v7 dev ECE 0.0326 vs fp32's 0.0329",
  },
  {
    name: "Lumma-fev 0.1B / 0.6B",
    who: "FrontiersMind",
    families: ["pointer"],
    released:
      "154,102,848 and 649,282,476 params on its own backbones, no LM head; 4B and 9B promised, not on HF",
    decides: "Kev-style pointer; options share one row",
    cap: "255",
    jev: "Jev column copied from Laya's model card",
    open: "no n, no eval code, no result files",
    calib: "none published",
  },
  {
    name: "Solomon 27B",
    who: "Doccy",
    families: ["letter"],
    released:
      "LoRA r=64 on layers 32–63 (217,579,520 params), ten-slot letter heads and an evidence MLP for Qwen3.8-27B",
    decides:
      "trained A–J heads initialised from the LM head's letter rows; adapter off for the document, on for the questions",
    cap: "10",
    jev: "an unnamed commercial API: +2.0 on 802 in-house questions, −14.2 on MMLU/MMLU-Pro",
    open: "no datasets, no score archives",
    calib: "fitted temperatures worsened ECE in 8 of 10 cells; ships at T=1",
  },
  {
    name: "Cua-S1-4B-0.2",
    who: "trycua",
    families: ["letter"],
    released:
      "two LoRA adapters r=16: text 21,233,664, multimodal 25,403,392 with 4,169,728 on the vision tower",
    decides: "letter logits A–Z in caller order, no reversal",
    cap: "26",
    jev: "JevBench's 231 public items recast as click/skip: 0.887 vs Jev 0.667",
    open: "harness code; no committed result files",
    calib: "ECE 0.069 on one split (N=168)",
  },
  {
    name: "Open-Jev 2B / 9B / 27B",
    who: "Zefan Cai",
    families: ["scorer"],
    released:
      "LoRA r=8 adapters and one-output heads; MIT code; CC0 dataset, 79,116 rows",
    decides:
      "one sequence per candidate, last hidden state into Linear(hidden, 1), softmax over the candidates",
    cap: "no position reaches the model; the key name does",
    jev: "JevBench public 231, its own audited run: 150 / 179 / 197 vs 200",
    open: "audited replays committed",
    calib: "ECE 0.086 (9B) vs Jev 0.032 on JevBench public",
  },
  {
    name: "localjev",
    who: "GitHub Next",
    families: ["writes"],
    released: "an MIT TypeScript server that answers POST /v1/systemone; no model",
    decides: "the model writes probabilities into strict JSON at temperature 0",
    cap: "none stated; options are listed in the prompt in caller order",
    jev: "none: “this is not a Jev-vs-model benchmark”",
    open: "1,200-request bake-off with per-row results",
    calib: "ECE 0.032–0.544; BoolQ answers come back as 0 or 1",
  },
  {
    name: "Span-01",
    who: "Respan",
    families: ["closed"],
    released: "nothing: a waitlisted API; size and architecture undisclosed",
    decides: "reported: one branch per behaviour definition over a shared trace",
    cap: "undisclosed",
    jev: "F1 0.843 vs 0.715 on Respan's own AI-labelled benchmark",
    open: "the benchmark is public; the model is not",
    calib: "publishes ECE for other models, judged by itself",
  },
]

type Filter = "all" | Family

const FILTERS: Filter[] = ["all", "letter", "scorer", "pointer", "writes", "closed"]

const FIELDS: { key: keyof Release; label: string }[] = [
  { key: "released", label: "released" },
  { key: "decides", label: "decides by" },
  { key: "cap", label: "option cap" },
  { key: "jev", label: "vs Jev" },
  { key: "open", label: "open eval" },
  { key: "calib", label: "calibration" },
]

export function ReleaseMatrix() {
  const [filter, setFilter] = useState<Filter>("all")
  const shown = RELEASES.filter((r) => filter === "all" || r.families.includes(filter))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        week two · what each release put in public, by readout family
      </div>
      <div className="flex flex-wrap gap-2 border-b px-3 py-2" role="group" aria-label="Filter by readout family">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              filter === f ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {f === "all" ? `all (${RELEASES.length})` : FAMILY[f].label}
          </button>
        ))}
      </div>
      {filter !== "all" ? (
        <p className="border-b px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {FAMILY[filter].blurb}
        </p>
      ) : null}
      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {shown.map((r) => (
          <section key={r.name} className="rounded-md border p-3">
            <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <h4 className="font-heading text-sm font-semibold">
                {r.name}{" "}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {r.who}
                </span>
              </h4>
              <span className="flex flex-wrap gap-1">
                {r.families.map((f) => (
                  <span
                    key={f}
                    className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {FAMILY[f].label}
                  </span>
                ))}
              </span>
            </header>
            <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-xs leading-5">
              {FIELDS.map((fld) => (
                <div key={fld.key} className="contents">
                  <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {fld.label}
                  </dt>
                  <dd className="m-0">{r[fld.key] as string}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </figure>
  )
}
