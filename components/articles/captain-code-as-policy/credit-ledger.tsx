"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Per-request credit from a privileged critic, on a toy pick-and-place task.
//
// Measured by me on CPU with my own code (not CaPtain's): a 2-D pick-and-place
// episode made of typed requests (perceive, move, grasp, lift, carry, release,
// verify, finish) over a hidden physical state; a critic built as the paper's
// Eq. 3 (five 3 x 256 MLPs, logits averaged, sigmoid) trained by binary
// cross-entropy on host success from 6,000 episodes; credit computed on 1,600
// fresh episodes (400 starts x 4 rollouts) as in Eq. 5 and 6 and
// rl/physics_critic.py request_advantages():
//
//   delta_t = c_t + V(s_{t+1}, t) - V(s_t, t),   delta_T = c_T + R - V(s_T, T)
//   A_t     = sum_k 0.9^k delta_{t+k}
//
// "t+1" is the ablation the paper warns against: the next value read at the
// next request index, so the passage of time alone produces credit.
// The episode below is one success from the test set: the first release
// misses the goal, the agent re-grasps and places again, then finishes.

const KINDS = [
  "perceive", "perceive", "move", "grasp", "lift", "perceive", "perceive", "carry", "release", "verify",
  "perceive", "perceive", "move", "grasp", "lift", "perceive", "perceive", "carry", "release", "verify", "finish",
] as const
const V = [
  0.815, 0.806, 0.796, 0.806, 0.833, 0.855, 0.843, 0.831, 0.85, 0.682, 0.67, 0.658, 0.646, 0.656, 0.76, 0.745,
  0.736, 0.726, 0.833, 0.995, 0.996,
]
const SERIES = {
  same: [
    0.0, 0.0, 0.026, 0.04, 0.031, 0.0, 0.0, 0.026, -0.157, 0.0, 0.0, 0.0, 0.024, 0.116, -0.008, 0.0, 0.0, 0.115,
    0.161, 0.0, 0.004,
  ],
  next: [
    -0.009, -0.01, 0.011, 0.026, 0.022, -0.011, -0.013, 0.02, -0.169, -0.012, -0.012, -0.013, 0.01, 0.104, -0.016,
    -0.008, -0.01, 0.107, 0.162, 0.001, 0.004,
  ],
  gae: [
    0.094, 0.104, 0.116, 0.1, 0.067, 0.04, 0.044, 0.049, 0.025, 0.202, 0.225, 0.25, 0.278, 0.282, 0.184, 0.213,
    0.237, 0.263, 0.165, 0.004, 0.004,
  ],
}
type Mode = keyof typeof SERIES
const MODES: { key: Mode; label: string; note: string }[] = [
  { key: "same", label: "one step, same index", note: "Eq. 5: perception requests get exactly 0" },
  { key: "next", label: "one step, index t+1", note: "time leaks: every look costs about 0.01" },
  { key: "gae", label: "GAE, λ = 0.9", note: "what the update uses: looks inherit the credit of what follows" },
]

// Share of the total |credit| landing on perception-only requests
// (perceive + verify), over the 1,600 test episodes.
const SHARES: { label: string; value: number }[] = [
  { label: "outcome only (every request equal)", value: 45.6 },
  { label: "critic, one step, same index", value: 3.3 },
  { label: "critic, one step, index t+1", value: 19.4 },
  { label: "critic + a perception counter", value: 20.3 },
  { label: "critic, after GAE and group term", value: 43.4 },
]

function Toggle({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="credit rule">
      <span className="w-14 shrink-0 text-muted-foreground">credit</span>
      {MODES.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded border px-2 py-1",
            o.key === value
              ? "border-foreground/60 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const LOOK = new Set(["perceive", "verify"])

export function CreditLedger() {
  const [mode, setMode] = useState<Mode>("same")
  const s = SERIES[mode]
  const N = KINDS.length
  const W = 640
  const PL = 8
  const colW = (W - PL * 2) / N
  const vTop = 8
  const vH = 60
  const zero = 150
  const scale = mode === "gae" ? 180 : 300
  const accent = "var(--hg-accent, oklch(0.72 0.15 195))"
  const neg = "oklch(0.65 0.19 25)"
  const vy = (v: number) => vTop + (1 - (v - 0.6) / 0.4) * vH
  const path = V.map((v, i) => `${i ? "L" : "M"}${(PL + colW * i + colW / 2).toFixed(1)},${vy(v).toFixed(1)}`).join(" ")
  const lookSum = s.reduce((a, x, i) => a + (LOOK.has(KINDS[i]) ? Math.abs(x) : 0), 0)
  const allSum = s.reduce((a, x) => a + Math.abs(x), 0)

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Per-request credit for one toy pick-and-place episode under three credit rules"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        toy pick-and-place, critic shaped like the paper&rsquo;s Eq. 3 · my code, measured on CPU · not
        CaPtain&rsquo;s critic or data
      </div>
      <div className="flex flex-col gap-1 border-b px-4 py-3 font-mono text-xs">
        <Toggle value={mode} onChange={setMode} />
        <div className="text-muted-foreground">{MODES.find((m) => m.key === mode)?.note}</div>
      </div>
      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} 270`}
          width="100%"
          className="min-w-[520px]"
          role="img"
          aria-label={`Critic value per request, and the credit each of ${N} requests receives. Perception requests hold ${((lookSum / allSum) * 100).toFixed(1)} percent of this episode's absolute credit.`}
        >
          <text x={PL} y={vTop + 8} className="fill-current font-mono text-[9px] opacity-60">
            V(s, t): predicted chance of success
          </text>
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.6} />
          <line x1={PL} x2={W - PL} y1={zero} y2={zero} stroke="currentColor" opacity={0.3} />
          {s.map((x, i) => {
            const h = Math.min(70, Math.abs(x) * scale)
            const cx = PL + colW * i
            const look = LOOK.has(KINDS[i])
            return (
              <g key={i}>
                <rect
                  x={cx + 3}
                  y={x >= 0 ? zero - h : zero}
                  width={colW - 6}
                  height={Math.max(h, 0.8)}
                  rx={1.5}
                  fill={x >= 0 ? accent : neg}
                  opacity={look ? 0.55 : 0.95}
                />
                <text
                  x={cx + colW / 2}
                  y={x >= 0 ? zero - h - 3 : zero + h + 9}
                  textAnchor="middle"
                  className="fill-current font-mono text-[7px] tabular-nums opacity-70"
                >
                  {x.toFixed(3)}
                </text>
                <text
                  transform={`translate(${cx + colW / 2},${236}) rotate(-60)`}
                  textAnchor="end"
                  className={cn("fill-current font-mono text-[8px]", look ? "opacity-50" : "opacity-90")}
                >
                  {KINDS[i]}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="border-t px-4 py-3 font-mono text-xs">
        <div className="mb-2 text-muted-foreground">
          share of all |credit| on perception-only requests, 1,600 toy episodes (45.3% of requests
          are perception)
        </div>
        <div className="flex flex-col gap-1">
          {SHARES.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="w-64 shrink-0 text-muted-foreground">{r.label}</span>
              <span className="h-2 rounded bg-foreground/50" style={{ width: `${r.value * 2.4}px` }} />
              <span className="tabular-nums">{r.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
