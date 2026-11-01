"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// export.py samples each articulation into n keyframes, n = max(5, int(|amount| / 15) + 2) for a hinge or a turn and
// 5 for a slide or a lift, with the time of each key spread evenly over one 1.5 s group and the value eased by
// u*u*(3-2u). glTF plays a LINEAR channel as a straight line between keys (a slerp for rotations, which for a single
// axis is linear in angle). The deviation from the true eased curve is computed here the way the article's author did it.
const ease = (u: number) => u * u * (3 - 2 * u)

function keysFor(amount: number, rotating: boolean) {
  return rotating ? Math.max(5, Math.floor(Math.abs(amount) / 15) + 2) : 5
}

function playback(t: number, n: number) {
  const i = Math.min(Math.floor(t * (n - 1)), n - 2)
  const f = t * (n - 1) - i
  return ease(i / (n - 1)) * (1 - f) + ease((i + 1) / (n - 1)) * f
}

const PRESETS = [
  { n: "lock turn", a: 12, r: true },
  { n: "Yamaha lid", a: 42, r: true },
  { n: "DB5 door", a: 58, r: true },
  { n: "FJ62 tailgate", a: 85, r: true },
  { n: "CD lid", a: 108, r: true },
  { n: "disc turn", a: 360, r: true },
]

export function KeyframeError() {
  const [amount, setAmount] = useState(108)
  const n = keysFor(amount, true)
  let worst = 0
  let at = 0
  const pts: string[] = []
  const ref: string[] = []
  const N = 400
  for (let k = 0; k <= N; k++) {
    const t = k / N
    const d = Math.abs(playback(t, n) - ease(t))
    if (d > worst) {
      worst = d
      at = t
    }
    pts.push(`${(30 + t * 500).toFixed(1)},${(170 - playback(t, n) * 150).toFixed(1)}`)
    ref.push(`${(30 + t * 500).toFixed(1)},${(170 - ease(t) * 150).toFixed(1)}`)
  }
  const keyDots = Array.from({ length: n }, (_, i) => ({ x: 30 + (i / (n - 1)) * 500, y: 170 - ease(i / (n - 1)) * 150 }))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        how a hinge becomes keyframes · rule read from export.py, deviation computed by me
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((p) => (
          <button
            key={p.n}
            type="button"
            onClick={() => setAmount(p.a)}
            className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${amount === p.a ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {p.n} {p.a}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3">
        <svg viewBox="0 0 560 190" className="w-full" role="img" aria-label={`${n} keyframes for a ${amount} degree hinge, worst deviation ${(worst * amount).toFixed(2)} degrees`}>
          <line x1="30" y1="170" x2="530" y2="170" stroke="currentColor" strokeOpacity="0.3" />
          <line x1="30" y1="20" x2="30" y2="170" stroke="currentColor" strokeOpacity="0.3" />
          <polyline points={ref.join(" ")} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeDasharray="4 3" />
          <polyline points={pts.join(" ")} fill="none" stroke="oklch(0.62 0.15 285)" strokeWidth="2" />
          {keyDots.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="oklch(0.62 0.15 285)" />
          ))}
          <circle cx={30 + at * 500} cy={170 - playback(at, n) * 150} r="5" fill="none" stroke="oklch(0.60 0.17 30)" strokeWidth="1.5" />
          <text x="34" y="16" fontSize="11" fill="currentColor" fillOpacity="0.7">angle, 0 to {amount} deg over one 1.5 s group (dashed: the true ease)</text>
        </svg>
      </div>
      <div className="space-y-2 px-4 pb-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">amount</span>
          <Range min={5} max={360} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-label="articulation amount in degrees" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">{amount} deg</span>
        </label>
        <div className="grid grid-cols-3 gap-2 border-t pt-2 font-mono text-xs">
          <div>
            <div className="text-[11px] text-muted-foreground">keyframes</div>
            <div className="tabular-nums">{n}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">worst gap to the ease</div>
            <div className="tabular-nums">{(worst * amount).toFixed(2)} deg</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">as a share of travel</div>
            <div className="tabular-nums">{(worst * 100).toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </figure>
  )
}
