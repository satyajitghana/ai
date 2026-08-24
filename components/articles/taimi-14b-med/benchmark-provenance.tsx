"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The three Chinese medical benchmarks, their reference points, and the caveat
// the card raises about all of them.
//
// CMB's headline of 74.0% decomposes into 77.1% single-choice and 47.2%
// multi-choice, which pins the mix: 77.1x + 47.2(1-x) = 74.0 gives x = 0.896, so
// roughly ten thousand single-choice items and eleven hundred multi-choice ones
// out of 11,200. Reconstructing that is how you confirm the three numbers are
// describing the same evaluation.
//
// The caveat is the card's own, and it is the right one: "CMB / CMExam were
// released in 2023 and may overlap with the base model's training corpus; ACC
// results serve as reproducibility validation." A 14B model scoring above the
// stated human baseline on a physician licensing exam is exactly the result that
// requires this sentence, and the card supplies it.
//
// CMDD is the interesting row precisely because it cannot be contaminated the
// same way: it is human review of sampled dialogues, and it is the only one where
// the model sits clearly below its reference.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Bench = {
  key: string
  label: string
  scale: string
  metric: string
  score: number
  max: number
  refs: { l: string; v: number; c: string }[]
  contam: "likely" | "unlikely"
  note: string
  detail?: { l: string; v: number }[]
}

const BENCHES: Bench[] = [
  {
    key: "cmb",
    label: "CMB",
    scale: "11,200 questions",
    metric: "accuracy",
    score: 74.0,
    max: 100,
    refs: [{ l: "Qwen-72B-Chat (community-reported)", v: 74.38, c: MUTED }],
    contam: "likely",
    detail: [
      { l: "single-choice", v: 77.1 },
      { l: "multi-choice", v: 47.2 },
      { l: "nursing", v: 79.1 },
      { l: "pharmacy", v: 76.1 },
      { l: "physician", v: 72.9 },
      { l: "postgraduate", v: 71.7 },
      { l: "professional knowledge", v: 70.9 },
      { l: "medical technology", v: 70.8 },
    ],
    note: "Matching a community-reported 72B result at 14B is the headline. The 30-point gap between single-choice and multi-choice is the more informative number: selecting one right answer and selecting all of them are very different tasks, and only the second resembles clinical reasoning.",
  },
  {
    key: "cmexam",
    label: "CMExam",
    scale: "6,811 questions",
    metric: "accuracy",
    score: 77.4,
    max: 100,
    refs: [
      { l: "human baseline (from the paper)", v: 71.6, c: WARM },
      { l: "GPT-4 (from the paper)", v: 61.6, c: MUTED },
    ],
    contam: "likely",
    note: "A quantized 14B model scoring six points above the stated human baseline on a physician licensing exam. This is precisely the result that needs the contamination caveat, and the card gives it: CMExam was released in 2023 and may overlap with the base model's training corpus.",
  },
  {
    key: "cmdd",
    label: "CMDD",
    scale: "100 sampled dialogues",
    metric: "human review, double-scored",
    score: 60,
    max: 100,
    refs: [{ l: "physician reference answers", v: 70, c: GOOD }],
    contam: "unlikely",
    note: "The only row scored by people rather than by string match, and the only one where the model sits clearly below its reference. It is also the one the card reads most carefully: high stability, low variance across cases, suitable for pre-diagnosis screening — while physician answers score higher on average with larger variance.",
  },
]

export function BenchmarkProvenance() {
  const [sel, setSel] = useState("cmexam")
  const b = BENCHES.find((x) => x.key === sel) ?? BENCHES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          public Chinese medical benchmarks · temperature 0 · base-model capability
        </span>
        <span className="font-mono text-[10px]" style={{ color: b.contam === "likely" ? WARM : GOOD }}>
          {b.contam === "likely" ? "may overlap the training corpus" : "human-scored, not string-matched"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {BENCHES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} · {x.scale}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-foreground">
              Taimi-14B-Med v0.1.0
            </span>
            <div className="h-5 flex-1 rounded-sm bg-muted/40">
              <div className="h-5 rounded-sm" style={{ width: `${b.score}%`, background: ACCENT }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
              {b.score.toFixed(1)}
            </span>
          </div>
          {b.refs.map((r) => (
            <div key={r.l} className="flex items-center gap-2">
              <span className="w-52 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">{r.l}</span>
              <div className="h-5 flex-1 rounded-sm bg-muted/40">
                <div className="h-5 rounded-sm" style={{ width: `${r.v}%`, background: r.c, opacity: 0.7 }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {r.v.toFixed(1)}
              </span>
            </div>
          ))}
        </div>

        {b.detail ? (
          <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
              the breakdown, and what it pins down
            </div>
            <div className="mt-2 space-y-0.5">
              {b.detail.map((d, i) => (
                <div key={d.l} className={cn("flex items-center gap-2", i === 2 && "mt-1.5 border-t pt-1.5")}>
                  <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{d.l}</span>
                  <div className="h-3 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="h-3 rounded-sm"
                      style={{ width: `${d.v}%`, background: i < 2 ? WARM : ACCENT, opacity: i < 2 ? 0.9 : 0.6 }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {d.v.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 font-mono text-[9px] text-muted-foreground">
              77.1 and 47.2 averaging to 74.0 pins the mix at about 89.6% single-choice — roughly 10,040
              single-choice items against 1,160 multi-choice ones. The three numbers are internally consistent,
              which is how you know they describe one evaluation.
            </div>
          </div>
        ) : null}

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {b.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two of these three benchmarks are multiple-choice exams released in 2023, and the card flags the
          consequence itself:{" "}
          <span className="text-foreground">they may overlap the base model&rsquo;s training corpus</span>, so the
          accuracies serve as reproducibility validation rather than as evidence of medical capability. That is
          the correct framing and it is rarely written down.
          <br />
          <br />
          Which makes CMDD the row to actually read. It is human-scored on sampled dialogues, judged on relevance,
          safety and refusal appropriateness — the things that matter in a clinical setting and the things a
          multiple-choice exam cannot measure. It is also the only row where the model sits clearly below its
          reference: about 60 against physicians&rsquo; roughly 70. A model can pass the licensing exam and still
          be ten points off a doctor in conversation, and only one of those two facts is a headline.
        </p>
      </div>
    </figure>
  )
}
