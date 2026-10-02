"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Index-Homura is the dubbing head: it translates to a target syllable count so
// the dubbed line fits the time the original took to say. This widget makes two
// things concrete, both from the Index-Translate sources.
//
//  1. The ACCEPTANCE BANDS. A target of T syllables is "hit" two ways SandGlass
//     scores: within +/-1 syllable (|d| small) and within 10% of T. Those bands
//     are just arithmetic on T; dragging the slider redraws them.
//  2. The RL-vs-SFT TRADE. Reinforcement learning on a length reward moves the
//     realized count INTO those bands far more often than the SFT checkpoint,
//     and the paper's own table shows it costs translation quality to do so.
//     The toggle swaps the reported SandGlass aggregates for the two 9B models.
//
// The three source/output pairs are the README's Index-Homura-9B demo, which
// hits 10/10, 14/14 and 18/18 exactly. Everything the widget shows is in the
// prose too, so the static .md reader loses nothing.

const ACCENT = "oklch(0.64 0.11 175)" // in-budget teal
const INNER = "oklch(0.72 0.12 150)" // within +/-1

// Index-Homura-9B SandGlass aggregates (reported), evaluation.md.
const MODES = {
  rl: {
    name: "RL (length reward)",
    sub: "GRPO on a syllable reward",
    quality: 0.7863,
    within10: 81.92,
    within1: 74.42,
    meanAbs: 0.0693,
  },
  sft: {
    name: "SFT (quality-first)",
    sub: "same model, no length RL",
    quality: 0.8581,
    within10: 45.75,
    within1: 41.39,
    meanAbs: 0.1752,
  },
} as const

type ModeKey = keyof typeof MODES

// README demo: 生活两天，是一种什么体验 — Index-Homura-9B, observed == target.
const CASES: Record<number, string> = {
  10: "to live for two days. What would that be like?",
  14: "What would it be like to live there for two days, I wonder?",
  18: "What would it be like to live there for two days, trying to get by somehow?",
}

const AXIS_LO = 4
const AXIS_HI = 24
const pos = (v: number) => ((v - AXIS_LO) / (AXIS_HI - AXIS_LO)) * 100

export function SyllableBudget() {
  const [target, setTarget] = useState(14)
  const [mode, setMode] = useState<ModeKey>("rl")
  const m = MODES[mode]

  // Acceptance bands (arithmetic on the chosen target).
  const outLo = Math.ceil(0.9 * target)
  const outHi = Math.floor(1.1 * target)
  const inLo = target - 1
  const inHi = target + 1

  const demo = CASES[target]
  const demoCaseBudgets = Object.keys(CASES).join(", ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>index-homura · hit a syllable budget</span>
        <span className="text-muted-foreground/50">9B on SandGlass, reported</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* mode toggle: the length-RL model vs its SFT parent */}
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MODES) as ModeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                k === mode
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {MODES[k].name}
            </button>
          ))}
        </div>

        {/* target slider */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>target syllable count (drag)</span>
            <span className="text-foreground">{target} syllables</span>
          </div>
          <Range
            min={AXIS_LO + 2}
            max={AXIS_HI - 2}
            step={1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </div>

        {/* acceptance bands on a syllable axis */}
        <div className="mt-4">
          <div className="relative h-11">
            {/* outer band: within 10% of target */}
            <div
              className="absolute inset-y-0 rounded-sm"
              style={{
                left: `${pos(outLo - 0.5)}%`,
                width: `${pos(outHi + 0.5) - pos(outLo - 0.5)}%`,
                background: ACCENT,
                opacity: 0.14,
              }}
            />
            {/* inner band: within +/-1 syllable */}
            <div
              className="absolute inset-y-0 rounded-sm"
              style={{
                left: `${pos(inLo - 0.5)}%`,
                width: `${pos(inHi + 0.5) - pos(inLo - 0.5)}%`,
                background: INNER,
                opacity: 0.3,
              }}
            />
            {/* target marker */}
            <div
              className="absolute inset-y-0 w-px"
              style={{ left: `${pos(target)}%`, background: "var(--foreground)" }}
            />
            {/* integer ticks */}
            {Array.from({ length: AXIS_HI - AXIS_LO + 1 }, (_, i) => AXIS_LO + i).map((v) => (
              <span
                key={v}
                className="absolute bottom-0 font-mono text-[9px] text-muted-foreground tabular-nums"
                style={{ left: `${pos(v)}%`, transform: "translateX(-50%)" }}
              >
                {v % 2 === 0 ? v : ""}
              </span>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10px] text-muted-foreground">
            <span>
              <span style={{ color: INNER }}>within +/-1</span>: {inLo}&ndash;{inHi}
            </span>
            <span>
              <span style={{ color: ACCENT }}>within 10%</span>: {outLo}&ndash;{outHi}
            </span>
          </div>
        </div>

        {/* real demo at this budget */}
        <div className="mt-4 rounded-md border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted-foreground">
            source (same line, every budget)
          </div>
          <div className="mt-0.5 text-sm text-foreground">生活两天，是一种什么体验</div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            index-homura-9B at {target} syllables
          </div>
          {demo ? (
            <p className="mt-0.5 text-sm leading-6 text-foreground">
              &ldquo;{demo}&rdquo;{" "}
              <span className="font-mono text-[11px]" style={{ color: ACCENT }}>
                observed {target}, hits the budget
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
              The README publishes recorded outputs at {demoCaseBudgets} syllables; drag to one
              of those to read the actual rewrite. The wording lengthens or shortens to land in the
              band above.
            </p>
          )}
        </div>

        {/* reported aggregate for the selected mode */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "within 10%", v: `${m.within10}%`, hl: true },
            { k: "within +/-1", v: `${m.within1}%`, hl: true },
            { k: "quality", v: m.quality.toFixed(4), hl: false },
            { k: "mean |d|", v: m.meanAbs.toFixed(4), hl: false },
          ].map((s) => (
            <div key={s.k} className="rounded-md border px-2.5 py-2">
              <div className="font-mono text-[9.5px] text-muted-foreground">{s.k}</div>
              <div
                className="mt-0.5 font-mono text-sm tabular-nums"
                style={{ color: s.hl ? ACCENT : "var(--foreground)" }}
              >
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "rl" ? (
            <>
              With the length reward on, the realized count lands{" "}
              <span style={{ color: ACCENT }}>within 10% of target {MODES.rl.within10}%</span>{" "}
              of the time and within one syllable {MODES.rl.within1}% of the time &mdash; but
              translation quality falls to{" "}
              <span className="text-foreground">{MODES.rl.quality.toFixed(4)}</span>. Flip to SFT:
              quality climbs to {MODES.sft.quality.toFixed(4)} and the budget is met less than
              half the time. That gap{" "}
              <span className="text-foreground">
                ({MODES.rl.within10}% vs {MODES.sft.within10}%)
              </span>{" "}
              is the whole point of the RL head &mdash; and its cost, in COMET points, is right
              there beside it.
            </>
          ) : (
            <>
              Without the length reward the same 9B keeps its translation quality
              ({MODES.sft.quality.toFixed(4)}, higher than the RL model&rsquo;s{" "}
              {MODES.rl.quality.toFixed(4)}), but it only lands within 10% of the target{" "}
              <span className="text-foreground">{MODES.sft.within10}%</span> of the time. For
              prose that is fine. For a dub that has to end when the mouth stops moving, missing
              the budget more than half the time is the failure mode length control exists to fix.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
