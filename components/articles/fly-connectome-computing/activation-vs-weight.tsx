"use client"

import { useMemo, useState } from "react"

// The hDelta path-integration hypothesis in one picture: two ways a circuit
// can hold a running sum of "how far have I walked, and which way." Only +,
// -, and * appear below (a leak is one multiply, a write is one add) — all
// exactly specified in IEEE-754, so this needs no lib/dmath wrapper.
//
// The script: walk outbound (+1 input), a silent pause with NO input at all
// (the fly stopped stepping), then walk back (-1 input), then a reward that
// zeroes the memory. Activation memory leaks every tick, pause or not, so it
// forgets the outbound trip during the silence. Weight memory only changes
// on a write or a reward; silence leaves it exactly where it was.

type StepKind = "outbound" | "pause" | "return" | "reward"
const SCRIPT: { kind: StepKind; input: number; label: string }[] = [
  { kind: "outbound", input: 1, label: "step outbound" },
  { kind: "outbound", input: 1, label: "step outbound" },
  { kind: "outbound", input: 1, label: "step outbound" },
  { kind: "pause", input: 0, label: "silence — no stepping, no input" },
  { kind: "pause", input: 0, label: "silence — no stepping, no input" },
  { kind: "pause", input: 0, label: "silence — no stepping, no input" },
  { kind: "return", input: -1, label: "step back toward home" },
  { kind: "return", input: -1, label: "step back toward home" },
  { kind: "return", input: -1, label: "step back toward home" },
  { kind: "reward", input: 0, label: "reward at home — memory resets" },
]

const ACT_LEAK = 0.55 // activation memory: multiply by this every tick, pause or not
const ACT_GAIN = 0.9
const W_GAIN = 0.9 // weight memory: no leak at all; only a write or a reward moves it

function simulate() {
  let act = 0
  let w = 0
  const acts: number[] = [0]
  const ws: number[] = [0]
  for (const step of SCRIPT) {
    if (step.kind === "reward") {
      w = 0
    } else {
      act = act * ACT_LEAK + ACT_GAIN * step.input
      w = w + W_GAIN * step.input
    }
    acts.push(act)
    ws.push(w)
  }
  return { acts, ws }
}

const { acts, ws } = simulate()

export function ActivationVsWeight() {
  const [i, setI] = useState(0)
  const max = SCRIPT.length

  const { path, dots } = useMemo(() => {
    const W = 600
    const H = 130
    const pad = 10
    const n = SCRIPT.length
    const sx = (k: number) => pad + (k / n) * (W - 2 * pad)
    const domain = 3.2
    const sy = (v: number) => H / 2 - (v / domain) * (H / 2 - 14)
    const line = (ys: number[]) =>
      ys
        .slice(0, i + 1)
        .map((v, k) => `${k ? "L" : "M"}${sx(k).toFixed(1)},${sy(v).toFixed(1)}`)
        .join(" ")
    return {
      path: { act: line(acts), w: line(ws) },
      dots: { sx, sy, W, H, pad },
    }
  }, [i])

  const step = i > 0 ? SCRIPT[i - 1] : null
  const actNow = acts[i]
  const wNow = ws[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>two ways to hold a running sum</span>
        <span className="text-muted-foreground/60">activations vs. synaptic weight</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${dots.W} ${dots.H}`}
          className="w-full"
          role="img"
          aria-label="Two traces over ten steps: an activation-based running sum that decays during a silent pause, and a weight-based running sum that holds its value through the same pause."
        >
          <line x1={dots.pad} y1={dots.H / 2} x2={dots.W - dots.pad} y2={dots.H / 2} stroke="var(--border)" strokeWidth={1} />
          {SCRIPT.map((s, k) =>
            s.kind === "pause" ? (
              <rect
                key={k}
                x={dots.sx(k)}
                y={0}
                width={dots.sx(k + 1) - dots.sx(k)}
                height={dots.H}
                fill="var(--muted-foreground)"
                opacity={0.08}
              />
            ) : null
          )}
          <path d={path.act} fill="none" stroke="oklch(0.68 0.16 40)" strokeWidth="2" />
          <path d={path.w} fill="none" stroke="oklch(0.6 0.14 155)" strokeWidth="2" />
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-4 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "oklch(0.68 0.16 40)" }} />
            activation memory (leaks every tick)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: "oklch(0.6 0.14 155)" }} />
            weight memory (holds through silence)
          </span>
          <span className="text-muted-foreground/60">shaded = silent pause, no input at all</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="cursor-pointer rounded border px-2.5 py-1 font-mono text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            {"←"} back
          </button>
          <button
            type="button"
            onClick={() => setI((v) => Math.min(max, v + 1))}
            disabled={i === max}
            className="cursor-pointer rounded bg-foreground px-2.5 py-1 font-mono text-xs text-background disabled:cursor-not-allowed disabled:opacity-30"
          >
            step {"→"}
          </button>
          <span className="ml-2 font-mono text-xs text-muted-foreground">
            {step ? `${i}/${max} · ${step.label}` : `${i}/${max} · start`}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">activation now</div>
            <div className="font-medium" style={{ color: "oklch(0.68 0.16 40)" }}>
              {actNow.toFixed(2)}
            </div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">weight now</div>
            <div className="font-medium" style={{ color: "oklch(0.6 0.14 155)" }}>
              {wNow.toFixed(2)}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Step through it: after three outbound steps both traces agree. Through the silent pause
          &mdash; three ticks with no stepping and no input &mdash; the activation trace leaks back
          toward zero, because nothing is left to sustain it. The weight trace doesn&rsquo;t move at
          all; a synapse doesn&rsquo;t need current flowing through it to stay potentiated. By the
          time walking resumes, only the weight-based memory still knows how far outbound the fly
          went. This is the whole argument for hDelta cells as a{" "}
          <strong>synaptic</strong>, not activity-based, odometer.
        </p>
      </div>
    </figure>
  )
}
