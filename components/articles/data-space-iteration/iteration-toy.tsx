"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { TOY } from "./toy-data"

// Every point here was produced offline by a small numpy re-implementation of
// the paper's Algorithm 1 (data-space and flow-renoise rollouts) and Algorithm 2
// (Phased DMD flow-map rollout) on a 2D ring of eight Gaussians. Three 3x64
// SiLU MLPs, trained with the same DMD loop, tau ~ Beta(2.5, 1), w = 1,
// Adam betas (0, 0.95), 6,000 generator updates each, uniform schedule
// [1, 0.75, 0.5, 0.25]. Two deliberate simplifications: the "real" velocity is
// the mixture's exact probability-flow velocity, and the "fake" velocity is
// computed exactly from a fresh batch of 512 generator samples at the same step
// instead of a trained network. The widget only replays the stored states.

type Kind = "data_" | "renoise" | "map"
type P = readonly [number, number]

const KINDS: { id: Kind; key: string; name: string; color: string }[] = [
  { id: "data_", key: "data", name: "data-space", color: "oklch(0.62 0.15 160)" },
  { id: "renoise", key: "renoise", name: "flow-renoise", color: "oklch(0.64 0.17 35)" },
  { id: "map", key: "map", name: "flow-map", color: "oklch(0.6 0.14 265)" },
]
const TS = [1, 0.75, 0.5, 0.25, 0]

const SIZE = 360
const SPAN = 3.4
const px = (p: P): [number, number] => [((p[0] + SPAN) / (2 * SPAN)) * SIZE, ((SPAN - p[1]) / (2 * SPAN)) * SIZE]

function seedMean(key: string, step: number, field: "swd" | "moves") {
  const vals: number[] = []
  for (const [k, v] of Object.entries(TOY.metrics)) {
    if (!k.startsWith(`${key}:`)) continue
    const x = field === "swd" ? v.swd[step] : v.moves[step]
    if (typeof x === "number") vals.push(x)
  }
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function IterationToy() {
  const [kind, setKind] = useState<Kind>("data_")
  const [step, setStep] = useState(1)
  const [pick, setPick] = useState(17)

  const meta = KINDS.find((k) => k.id === kind)!
  const run = TOY[kind]
  const cloud: readonly P[] = step === 0 ? TOY.z : run.states[step - 1]
  const isSample = step > 0 && (kind !== "map" || step === 4)

  // trajectory of the picked particle up to the current step
  const pts: { p: P; hollow?: boolean }[] = [{ p: TOY.z[pick], hollow: true }]
  for (let s = 1; s <= step; s++) {
    if (kind === "renoise" && s > 1) pts.push({ p: run.inputs![s - 1][pick], hollow: true })
    pts.push({ p: run.states[s - 1][pick] })
  }

  const swd = step > 0 ? seedMean(meta.key, step - 1, "swd") : null
  const move = step > 1 ? seedMean(meta.key, step - 2, "moves") : null
  const floor = seedMean("floor", 0, "swd")

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * SIZE
    const y = ((e.clientY - r.top) / r.height) * SIZE
    let best = 0
    let bd = Infinity
    cloud.forEach((p, i) => {
      const [cx, cy] = px(p)
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    setPick(best)
  }

  const stepLabel =
    step === 0
      ? "start: the noise z"
      : kind === "data_"
        ? `call ${step}: estimate x̂(${step}), no time input`
        : kind === "renoise"
          ? `call ${step}: denoise from t = ${TS[step - 1]}`
          : `call ${step}: map t = ${TS[step - 1]} → ${TS[step]}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">three rollouts · one 2D toy · same DMD loop</span>
        <span className="font-mono text-[10px] text-muted-foreground">240 shared noise draws, 4 calls each</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <Pill key={k.id} on={k.id === kind} onClick={() => setKind(k.id)}>
              <span style={{ color: k.color }}>●</span> {k.name}
            </Pill>
          ))}
        </div>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-xs">
            <span>network calls so far</span>
            <span className="text-base font-semibold" style={{ color: meta.color }}>
              {step}
            </span>
          </span>
          <Range
            min={0}
            max={4}
            step={1}
            value={step}
            accent={meta.color}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-label="Number of network calls"
            className="mt-1 w-full"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="mx-auto w-full max-w-[420px] cursor-crosshair rounded-lg border bg-background"
            role="img"
            aria-label={`${meta.name} after ${step} calls: ${isSample ? "samples" : "intermediate states"} drawn over the eight target blobs`}
            onClick={onSvgClick}
          >
            {TOY.data.map((p, i) => {
              const [x, y] = px(p)
              return <circle key={`d${i}`} cx={x} cy={y} r={1.4} className="fill-muted-foreground/25" />
            })}
            {TOY.mu.map((p, i) => {
              const [x, y] = px(p)
              return (
                <circle
                  key={`m${i}`}
                  cx={x}
                  cy={y}
                  r={(3 * TOY.sigma * SIZE) / (2 * SPAN)}
                  className="fill-none stroke-muted-foreground/40"
                  strokeDasharray="2 3"
                />
              )
            })}
            {cloud.map((p, i) => {
              const [x, y] = px(p)
              return (
                <circle
                  key={`c${i}`}
                  cx={x}
                  cy={y}
                  r={2.1}
                  fill={step === 0 ? "currentColor" : meta.color}
                  opacity={step === 0 ? 0.35 : isSample ? 0.7 : 0.35}
                />
              )
            })}
            {pts.slice(1).map((q, i) => {
              const [x1, y1] = px(pts[i].p)
              const [x2, y2] = px(q.p)
              return (
                <line
                  key={`l${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={meta.color}
                  strokeWidth={1.6}
                  strokeDasharray={q.hollow ? "3 3" : undefined}
                  className="text-foreground"
                />
              )
            })}
            {pts.map((q, i) => {
              const [x, y] = px(q.p)
              return (
                <circle
                  key={`p${i}`}
                  cx={x}
                  cy={y}
                  r={i === pts.length - 1 ? 5.5 : 4}
                  fill={q.hollow ? "var(--background, white)" : meta.color}
                  stroke={q.hollow ? meta.color : "currentColor"}
                  strokeWidth={1.4}
                  className="text-foreground"
                />
              )
            })}
          </svg>

          <div className="space-y-2">
            <Stat k="this frame" v={stepLabel} />
            <Stat
              k="what the dots are"
              v={
                step === 0
                  ? "Gaussian noise, shared by all three"
                  : isSample
                    ? "finished samples (valid output)"
                    : "flow states at an intermediate time; not samples"
              }
            />
            <Stat
              k="toy distance to data (×100, 3 seeds)"
              v={swd !== null ? `${swd.toFixed(1)}  (two data sets: ${floor?.toFixed(1)})` : "n/a"}
            />
            <Stat k="mean move since last call" v={move !== null ? move.toFixed(2) : "n/a"} />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Click any dot to follow it. Solid dots on the path are the generator&apos;s outputs; hollow dots are what it was
          fed (the noise, and for flow-renoise the output mixed with fresh noise). Distance is a sliced Wasserstein
          distance between 20,000 generated points and 20,000 draws from the ring. These are my toy runs, not the
          paper&apos;s, and they do not reproduce its ranking: see the text.
        </p>
      </div>
    </figure>
  )
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

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-xs">{v}</div>
    </div>
  )
}
