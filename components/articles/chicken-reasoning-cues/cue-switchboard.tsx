"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Every number is the paper's own (arXiv 2610.06851): Olmo-3-7B mid-trained
// for 10B tokens on three versions of the same mix, RL-Zero prompt, 7,168-token
// budget, 32 rollouts per problem. Accuracies: Table 25 (MATH-500 pass@1).
// Opening probabilities and the next tokens after each cue: Figure 5, right.
// Responses: Section F.1.2, the first of 32 rollouts on "Factor ab+5b+2a+10".

type Mix = "base" | "rename" | "redirect"
type Cue = "okay" | "chicken"

type CueData = {
  pOpen: string
  comma: string
  next: [string, string][]
  reply: string
  verdict: "correct" | "wrong" | "no answer"
}

type MixData = {
  label: string
  edit: string
  acc: { none: number; okay: number; chicken: number; hmm: number; alright: number }
  cues: Record<Cue, CueData>
}

const MIXES: Record<Mix, MixData> = {
  base: {
    label: "Base mix",
    edit: "The released 10B-token mid-training mix, unedited. 83% of its synthetic reasoning traces open with “Okay”.",
    acc: { none: 13.8, okay: 31.9, chicken: 2.4, hmm: 30.4, alright: 30.9 },
    cues: {
      okay: {
        pOpen: "0.15",
        comma: "1.00",
        next: [
          ["let", "0.58"],
          ["so", "0.41"],
        ],
        reply: "Okay, let’s see. I need to factor the expression ab + 5b + 2a + 10. […] Answer: (a + 5)(b + 2)",
        verdict: "correct",
      },
      chicken: {
        pOpen: "2e-7",
        comma: "–",
        next: [
          ["Little", "0.08"],
          ["McN", "0.08"],
        ],
        reply: "Chicken nuggets are sold in sets of 6, 9, or 12. […] Answer: 18",
        verdict: "wrong",
      },
    },
  },
  rename: {
    label: "Rename mix",
    edit: "Every whole-word “okay” in the mix becomes “chicken”. Nothing else changes: same checkpoint, data order and seed.",
    acc: { none: 23.3, okay: 38.3, chicken: 37.2, hmm: 37.5, alright: 37.8 },
    cues: {
      okay: {
        pOpen: "5e-7",
        comma: "0.94",
        next: [
          ["let", "0.61"],
          ["so", "0.16"],
        ],
        reply: "Okay, let’s see. I need to factor the expression ab + 5b + 2a + 10. […] Answer: (b + 2)(a + 5)",
        verdict: "correct",
      },
      chicken: {
        pOpen: "0.10",
        comma: "0.99",
        next: [
          ["let", "0.65"],
          ["so", "0.31"],
        ],
        reply:
          "Chicken, so I need to factor the expression ab + 5b + 2a + 10. […] Wait, both grouped terms have the same binomial (a + 5). That seems promising. […] Answer: (a + 5)(b + 2)",
        verdict: "correct",
      },
    },
  },
  redirect: {
    label: "Redirect mix",
    edit: "The rename mix, plus every paragraph-initial “Question:” in the synthetic Q&A becomes “Okay,”.",
    acc: { none: 26.7, okay: 0.2, chicken: 40.1, hmm: 40.2, alright: 40.1 },
    cues: {
      okay: {
        pOpen: "2e-4",
        comma: "1.00",
        next: [
          ["what", "0.78"],
          ["which", "0.06"],
        ],
        reply: "Okay, what is the first step to solve the equation 2x + 3 = 5x - 4? Answer: Subtract 2x from both sides.",
        verdict: "no answer",
      },
      chicken: {
        pOpen: "0.20",
        comma: "1.00",
        next: [
          ["let", "0.61"],
          ["so", "0.37"],
        ],
        reply: "Chicken, so I need to factor the expression ab + 5b + 2a + 10. […] So I need to find another way. […] \\boxed{(a + 5)(b + 2)}",
        verdict: "correct",
      },
    },
  },
}

const C_OKAY = "oklch(0.75 0.15 75)"
const C_CHICKEN = "oklch(0.64 0.19 25)"
const C_NONE = "oklch(0.6 0.01 260)"
const C_OTHER = "oklch(0.6 0.09 250)"

export function CueSwitchboard() {
  const [mix, setMix] = useState<Mix>("base")
  const [cue, setCue] = useState<Cue>("chicken")
  const m = MIXES[mix]
  const c = m.cues[cue]
  const word = cue === "okay" ? "Okay" : "Chicken"
  const color = cue === "okay" ? C_OKAY : C_CHICKEN

  const bars: { key: string; label: string; v: number; color: string; on: boolean }[] = [
    { key: "none", label: "no cue", v: m.acc.none, color: C_NONE, on: false },
    { key: "okay", label: ".\\n\\n Okay", v: m.acc.okay, color: C_OKAY, on: cue === "okay" },
    { key: "chicken", label: ".\\n\\n Chicken", v: m.acc.chicken, color: C_CHICKEN, on: cue === "chicken" },
    { key: "hmm", label: ".\\n\\n Hmm", v: m.acc.hmm, color: C_OTHER, on: false },
    { key: "alright", label: ".\\n\\n Alright", v: m.acc.alright, color: C_OTHER, on: false },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Olmo-3-7B · 10B mid-training tokens · MATH-500
        </span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(MIXES) as Mix[]).map((k) => (
            <Pill key={k} on={mix === k} onClick={() => setMix(k)}>
              {MIXES[k].label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{m.edit}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 font-mono text-[11px] text-muted-foreground">pass@1 by forced opening (%)</div>
            <div className="space-y-1.5">
              {bars.map((b) => (
                <div key={b.key} className="flex items-center gap-2 font-mono text-[11px]">
                  <span className={cn("w-24 shrink-0", b.on ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {b.label}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${Math.max(0.6, (b.v / 45) * 100).toFixed(1)}%`, background: b.color, opacity: b.on || b.key === "none" ? 1 : 0.55 }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums">{b.v.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1">
              <span className="mr-1 font-mono text-[11px] text-muted-foreground">force</span>
              <Pill on={cue === "okay"} onClick={() => setCue("okay")}>
                .\n\n Okay
              </Pill>
              <Pill on={cue === "chicken"} onClick={() => setCue("chicken")}>
                .\n\n Chicken
              </Pill>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div>
                <span className="text-muted-foreground">P(</span>
                <span style={{ color }}>{word}</span>
                <span className="text-muted-foreground"> | prompt, .\n\n) = </span>
                <span className="tabular-nums">{c.pOpen}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground">next:</span>
                {c.comma !== "–" ? (
                  <>
                    <Tok>,</Tok>
                    <span className="tabular-nums text-muted-foreground">{c.comma}</span>
                    <span className="text-muted-foreground">→</span>
                  </>
                ) : null}
                {c.next.map(([t, p]) => (
                  <span key={t} className="inline-flex items-center gap-1">
                    <Tok>{t}</Tok>
                    <span className="tabular-nums text-muted-foreground">{p}</span>
                  </span>
                ))}
              </div>
            </div>
            <blockquote className="mt-3 rounded-md border-l-2 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed" style={{ borderColor: color }}>
              {c.reply}
              <div
                className={cn(
                  "mt-1 text-[10px] uppercase tracking-wide",
                  c.verdict === "correct" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {c.verdict}
              </div>
            </blockquote>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Paper numbers, not mine: Table 25 for accuracy, Figure 5 for the probabilities, Section F.1.2 for the replies (the
          first of 32 rollouts on one factoring problem). Hmm and Alright are the controls nobody edited.
        </p>
      </div>
    </figure>
  )
}

function Tok({ children }: { children: ReactNode }) {
  return <span className="rounded border bg-background px-1 py-px">{children}</span>
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
