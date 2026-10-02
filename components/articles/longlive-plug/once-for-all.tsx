"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// "Distill once, reuse many" — the two things the paper measures, made
// touchable. All numbers here are the paper's (arXiv 2609.38154), reported,
// not re-run:
//   - verified downstream targets per backbone family (Table 5 / §4.2):
//     24 for each Wan backbone, 6 for MiniMax-H3, 54 in total.
//   - per-task re-distillation cost for the Wan2.2-TI2V-5B family (Figure 2):
//     a shared base of ~80 H100 GPU-hours, then +83.9 / +150.0 / +86.8 / +56.1
//     for depth, world-model, pose and robotics specialisation (376.8 added,
//     ~456.8 total). The once-for-all path reuses the base adapters and stays
//     at ~80 GPU-hours no matter how many targets you serve.
//   - step reduction: native 20-50-step schedules become 4 steps, a 5-12.5x
//     cut (§4.2). The slider just divides; the ratio is reasoned arithmetic.
// Only + - * / reach the DOM, which are exact per IEEE-754, so no lib/dmath
// wrapper is needed (those are for exp/log/pow/trig).

type Family = {
  id: string
  label: string
  base: string
  targets: number
  loras: string
  examples: string
}

const FAMILIES: Family[] = [
  {
    id: "wan21",
    label: "Wan2.1-T2V-14B",
    base: "Wan-AI/Wan2.1-T2V-14B",
    targets: 24,
    loras: "few-step + CFG",
    examples: "FantasyWorld, DreamZero, Fun Control, MagicTryOn, Wan-Alpha",
  },
  {
    id: "wan22",
    label: "Wan2.2-TI2V-5B",
    base: "Wan-AI/Wan2.2-TI2V-5B",
    targets: 24,
    loras: "few-step + CFG + long-context",
    examples: "Matrix-Game 3.0, SCOPE, Fast-WAM LIBERO, Kiwi-Edit, Ovi",
  },
  {
    id: "h3",
    label: "MiniMax-H3",
    base: "MiniMaxAI/MiniMax-H3",
    targets: 6,
    loras: "few-step + CFG (used separately)",
    examples: "H3-World, Code World Model, SolarWM-H3, LineartAnime",
  },
]

// Wan2.2-TI2V-5B per-task distillation costs, Figure 2, in H100 GPU-hours.
const BASE_COST = 80
const TASKS = [
  { id: "depth", label: "depth-conditioned generation", cost: 83.9 },
  { id: "world", label: "world modeling", cost: 150.0 },
  { id: "pose", label: "pose-conditioned generation", cost: 86.8 },
  { id: "robot", label: "robotics simulation", cost: 56.1 },
] as const

export function OnceForAll() {
  const [fam, setFam] = useState<string>("wan22")
  const [native, setNative] = useState<number>(30)
  const [selected, setSelected] = useState<string[]>(TASKS.map((t) => t.id))

  const family = FAMILIES.find((f) => f.id === fam) ?? FAMILIES[1]
  const factor = native / 4 // exact; 20->5x, 50->12.5x

  const added = TASKS.filter((t) => selected.includes(t.id)).reduce(
    (s, t) => s + t.cost,
    0
  )
  const reDistill = BASE_COST + added
  const onceForAll = BASE_COST
  const gap = reDistill - onceForAll
  const ratio = reDistill / onceForAll
  const n = selected.length

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-once-for-all={`${fam}-${native}-${n}`}
      aria-label="Distill a video-diffusion capability once per backbone family, then plug it into compatible downstream models, against the cost of re-distilling each one"
    >
      {/* family picker */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="mr-1 font-mono text-xs text-muted-foreground">
          backbone family
        </span>
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFam(f.id)}
            aria-pressed={fam === f.id}
            className={cn(
              "rounded-sm border px-2.5 py-0.5 font-mono text-xs",
              fam === f.id
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* distill once -> plug into many */}
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.3fr)] sm:items-center">
        <div className="rounded-md border border-dashed p-3">
          <div className="font-mono text-[11px] text-muted-foreground">
            distill once on the frozen base
          </div>
          <div className="mt-1 font-mono text-sm break-words">{family.base}</div>
          <div className="mt-2 inline-block rounded-sm bg-foreground/10 px-2 py-0.5 font-mono text-xs">
            LoRA phi: {family.loras}
          </div>
        </div>

        <div className="text-center font-mono text-xl text-muted-foreground sm:px-1">
          <span aria-hidden>+phi -&gt;</span>
        </div>

        <div className="rounded-md border p-3">
          <div className="font-mono text-[11px] text-muted-foreground">
            plug in, training-free
          </div>
          <div className="mt-1 font-mono text-sm">
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {family.targets}
            </span>{" "}
            verified downstream models
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            e.g. {family.examples}
          </div>
        </div>
      </div>

      {/* step reduction */}
      <div className="border-t px-4 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <label
            htmlFor="llp-native"
            className="font-mono text-xs text-muted-foreground"
          >
            a downstream model&apos;s native schedule
          </label>
          <span className="font-mono text-xs tabular-nums">
            <span className="text-foreground">{native}</span> steps -&gt;{" "}
            <span className="font-medium text-foreground">4</span> steps ={" "}
            <span className="font-medium text-foreground">
              {factor.toFixed(2)}x
            </span>{" "}
            fewer
          </span>
        </div>
        <Range
          id="llp-native"
          min={20}
          max={50}
          step={1}
          value={native}
          onChange={(e) => setNative(Number(e.target.value))}
          className="mt-2 w-full"
        />
        <p className="mt-1 mb-0 font-mono text-[11px] text-muted-foreground">
          The paper reports 5x to 12.5x fewer denoising steps across 20-to-50-step
          native schedules, plus one saved pass per step because CFG is folded in.
        </p>
      </div>

      {/* cost contrast */}
      <div className="border-t px-4 py-4">
        <div className="mb-2 font-mono text-xs text-muted-foreground">
          cumulative distillation bill for the Wan2.2-TI2V-5B family (Figure 2),
          H100 GPU-hours
        </div>
        <ul className="my-0 flex list-none flex-wrap gap-2 pl-0">
          {TASKS.map((t) => {
            const on = selected.includes(t.id)
            return (
              <li key={t.id} className="my-0">
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-pressed={on}
                  className={cn(
                    "rounded-sm border px-2 py-0.5 text-left font-mono text-[11px]",
                    on
                      ? "border-foreground/40 bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {on ? "x " : "+ "}
                  {t.label} ({t.cost.toFixed(1)})
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-4 space-y-3">
          <CostBar
            name={`re-distill per target (${n} of 4)`}
            value={reDistill}
            max={reDistill}
            tone="muted"
            detail={`80 base + ${added.toFixed(1)} task-specific`}
          />
          <CostBar
            name="once-for-all (reuse base adapters)"
            value={onceForAll}
            max={reDistill}
            tone="accent"
            detail="base adapters only, no per-target data"
          />
        </div>

        <p className="mt-3 mb-0 font-mono text-xs tabular-nums text-muted-foreground">
          {n === 0 ? (
            <>Pick a target to specialise for. The base cost is shared either way.</>
          ) : (
            <>
              {reDistill.toFixed(1)} vs {onceForAll} GPU-hours:{" "}
              <span className="font-medium text-foreground">
                {gap.toFixed(1)} saved
              </span>
              , a{" "}
              <span className="font-medium text-foreground">
                {ratio.toFixed(2)}x
              </span>{" "}
              gap over {n} target{n === 1 ? "" : "s"} (reasoned).
            </>
          )}
        </p>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Targets, step cuts and per-task costs are the paper&apos;s (reported). The
        ratio is my arithmetic on them. Re-distillation pays the per-target cost
        again for every model; once-for-all pays the base once and transfers.
      </figcaption>
    </figure>
  )
}

function CostBar({
  name,
  value,
  max,
  tone,
  detail,
}: {
  name: string
  value: number
  max: number
  tone: "muted" | "accent"
  detail: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
        <span className="text-muted-foreground">{name}</span>
        <span className="tabular-nums text-foreground">
          {value.toFixed(1)} GPU-h
        </span>
      </div>
      <div className="relative mt-1 h-3 overflow-hidden rounded-sm bg-foreground/10">
        <div
          className={cn(
            "h-full",
            tone === "accent" ? "bg-foreground" : "bg-foreground/40"
          )}
          style={{ width: `${pct.toFixed(1)}%` }}
        />
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
        {detail}
      </div>
    </div>
  )
}
