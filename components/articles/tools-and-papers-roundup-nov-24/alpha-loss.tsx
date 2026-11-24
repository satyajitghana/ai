"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { masin, msin } from "@/lib/dmath"

// AlphaAnything's per-pixel alpha loss (arXiv 2610.32413, Section 3.3), against plain L1.
// The alpha branch outputs an unconstrained score s. It is clipped to a coordinate
// p(s) = clip((s+1)/2, 0, 1) and mapped to opacity a_hat = sin^2(pi p / 2). The target
// opacity a is moved into the same coordinate, u = (2/pi) asin(sqrt(a)). The loss is the
// paper's Fenchel-Young form, Eq. 8, whose derivative is p(s) - u everywhere. Plain L1 on
// a_hat has derivative sign(a_hat - a) * d a_hat / ds, which is zero once s leaves (-1, 1).
// The paper also weights and root-aggregates these gaps over the image (Eq. 9); this
// widget shows one pixel.

const PI = Math.PI

const chi = (a: number) => (2 / PI) * masin(Math.sqrt(a))
const pOf = (s: number) => Math.min(1, Math.max(0, (s + 1) / 2))
const aHat = (s: number) => {
  const v = msin((PI * pOf(s)) / 2)
  return v * v
}
const g = (s: number, u: number) => {
  if (s <= -1) return u * (u - 1 - s)
  if (s >= 1) return (1 - u) * (s - u)
  const d = (s + 1) / 2 - u
  return d * d
}
const l1 = (s: number, a: number) => Math.abs(aHat(s) - a)
const dl1 = (s: number, a: number) => {
  if (s <= -1 || s >= 1) return 0
  const slope = (PI / 4) * msin(PI * pOf(s))
  const diff = aHat(s) - a
  return diff === 0 ? 0 : Math.sign(diff) * slope
}

const S_MIN = -1.6
const S_MAX = 1.6
const W = 560
const H = 220
const PAD = { l: 40, r: 12, t: 14, b: 30 }

const PRESETS = [
  { id: "wrong", name: "opaque target, predicted transparent", a: 1, s: -1.4 },
  { id: "glass", name: "glass at 0.3", a: 0.3, s: 0.6 },
  { id: "edge", name: "faint edge at 0.05", a: 0.05, s: -1.2 },
]

const fmt = (v: number) => (Math.abs(v) < 0.0005 ? "0.000" : v.toFixed(3))

export function AlphaLoss() {
  const [a, setA] = useState(1)
  const [s, setS] = useState(-1.4)
  const u = chi(a)

  const N = 96
  const xs = Array.from({ length: N + 1 }, (_, i) => S_MIN + ((S_MAX - S_MIN) * i) / N)
  const gs = xs.map((x) => g(x, u))
  const ls = xs.map((x) => l1(x, a))
  const yMax = Math.max(1, ...gs, ...ls) * 1.08
  const X = (v: number) => PAD.l + ((v - S_MIN) / (S_MAX - S_MIN)) * (W - PAD.l - PAD.r)
  const Y = (v: number) => H - PAD.b - (v / yMax) * (H - PAD.t - PAD.b)
  const path = (ys: number[]) => xs.map((x, i) => `${i ? "L" : "M"}${X(x).toFixed(2)},${Y(ys[i]).toFixed(2)}`).join(" ")

  const gradEA = pOf(s) - u
  const gradL1 = dl1(s, a)
  const pred = aHat(s)
  const saturated = s <= -1 || s >= 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setA(p.a)
              setS(p.s)
            }}
            className={`rounded-md px-2 py-1 ${p.a === a && p.s === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="px-4 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Loss for one pixel as the alpha score varies, AlphaAnything's endpoint-aware loss against plain L1">
          <rect x={X(-1)} y={PAD.t} width={X(1) - X(-1)} height={H - PAD.t - PAD.b} fill="currentColor" opacity={0.04} />
          {[-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((v) => (
            <text key={v} x={X(v)} y={H - 10} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
              {v}
            </text>
          ))}
          <text x={X(-1.3)} y={PAD.t + 10} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.55}>
            clipped: a = 0
          </text>
          <text x={X(1.3)} y={PAD.t + 10} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.55}>
            clipped: a = 1
          </text>
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(0)} y2={Y(0)} stroke="currentColor" strokeOpacity={0.2} />
          <path d={path(ls)} fill="none" stroke="oklch(0.62 0.03 250)" strokeWidth={2} />
          <path d={path(gs)} fill="none" stroke="oklch(0.64 0.15 35)" strokeWidth={2.5} />
          <line x1={X(s)} x2={X(s)} y1={PAD.t} y2={H - PAD.b} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />
          <circle cx={X(s)} cy={Y(l1(s, a))} r={3.5} fill="oklch(0.62 0.03 250)" />
          <circle cx={X(s)} cy={Y(g(s, u))} r={3.5} fill="oklch(0.64 0.15 35)" />
        </svg>
      </div>
      <div className="grid gap-2 px-4 pb-3 pt-1 text-[13px]">
        <label className="flex items-center gap-3">
          <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">target alpha {a.toFixed(2)}</span>
          <Range min={0} max={1} step={0.01} value={a} onChange={(e) => setA(Number(e.target.value))} aria-label="Target alpha" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">score s {s.toFixed(2)}</span>
          <Range min={S_MIN} max={S_MAX} step={0.02} value={s} onChange={(e) => setS(Number(e.target.value))} aria-label="Predicted score" />
        </label>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <span className="text-muted-foreground">predicted alpha</span>
          <span>{fmt(pred)}</span>
          <span className="text-muted-foreground">target coordinate u</span>
          <span>{fmt(u)}</span>
          <span style={{ color: "oklch(0.64 0.15 35)" }}>EA gradient</span>
          <span>{fmt(gradEA)}</span>
          <span style={{ color: "oklch(0.62 0.03 250)" }}>L1 gradient</span>
          <span>{fmt(gradL1)}</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        One pixel. The x axis is the alpha branch's raw score. Inside the shaded band the score maps smoothly to opacity; outside it the prediction is clipped to exactly 0
        or exactly 1. <span style={{ color: "oklch(0.64 0.15 35)" }}>Orange</span> is the paper's endpoint-aware loss (its Eq. 8), whose slope is always the
        predicted coordinate minus the target&apos;s. <span style={{ color: "oklch(0.62 0.03 250)" }}>Grey</span> is plain L1 on the clipped alpha.
        {saturated && Math.abs(pred - a) > 0.001
          ? " Here the prediction is stuck at the wrong endpoint: L1 is flat and its gradient is zero, so training cannot move it; the orange loss still slopes back toward the target."
          : " Move the score past ±1 with a target in between and watch the grey gradient vanish while the orange one does not."}{" "}
        The paper also splits each pixel's error by its foreground and background weight and square-roots each sum over the image; that part is not drawn.
      </figcaption>
    </figure>
  )
}
