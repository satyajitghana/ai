"use client"

import { useState } from "react"

import { mlog10, mpow } from "@/lib/dmath"

// The deck's "Thirty steps": a 1 cm domino, each one 1.5 times the height of the one before.
// Height of domino n = 1.5^(n-1) cm. Whitehead (Am. J. Phys. 51, 1983) is the source for a
// domino toppling one about 1.5 times its size. The landmarks are the ones the article uses.

const RATIO = 1.5
const heightCm = (n: number) => mpow(RATIO, n - 1)

const LANDMARKS: { cm: number; name: string }[] = [
  { cm: 180, name: "a person (1.8 m)" },
  { cm: 82800, name: "the Burj Khalifa (828 m), the tallest building" },
]

// The article's table, step by step (1.5^(n-1) cm, rounded as printed there).
const HEIGHTS = [
  "1 cm", "1.5 cm", "2.25 cm", "3.4 cm", "5.1 cm", "7.6 cm", "11.4 cm", "17.1 cm", "25.6 cm", "38.4 cm",
  "57.7 cm", "86.5 cm", "1.30 m", "1.95 m", "2.92 m", "4.38 m", "6.57 m", "9.85 m", "14.8 m", "22.2 m",
  "33.3 m", "49.9 m", "74.8 m", "112.2 m", "168.3 m", "252.5 m", "378.8 m", "568.2 m", "852.2 m", "1.28 km",
]
const fmt = (n: number) => HEIGHTS[n - 1]

export function DominoSteps() {
  const [n, setN] = useState(30)
  const h = heightCm(n)
  const W = 640, H = 200, L = 20, R = 20, base = H - 26
  const top = mlog10(heightCm(30)) // log10 of 1.28 km in cm
  const bar = (k: number) => ((mlog10(heightCm(k)) + 0.3) / (top + 0.3)) * (base - 16)
  const step = (W - L - R) / 30
  const passed = LANDMARKS.filter((m) => h >= m.cm)

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">Thirty dominoes, each 1.5 times the last</span>
        <span className="block text-muted-foreground">Drag to a step. Bars are on a log scale, or step 30 would be the only thing you could see.</span>
      </figcaption>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Step
          <input type="range" min={1} max={30} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Domino step" />
          <span className="w-6 font-mono text-foreground">{n}</span>
        </label>
        <span className="font-mono text-lg">{fmt(n)}</span>
        <span className="text-xs text-muted-foreground">= 1.5^{n - 1} cm</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Domino ${n} is ${fmt(n)} tall`}>
        <line x1={L} x2={W - R} y1={base} y2={base} className="stroke-border" />
        {Array.from({ length: 30 }, (_, i) => i + 1).map((k) => {
          const bh = Math.max(2, bar(k))
          return (
            <rect
              key={k}
              x={L + (k - 1) * step + 2}
              y={base - bh}
              width={step - 4}
              height={bh}
              className={k === n ? "fill-amber-500" : k < n ? "fill-foreground/70" : "fill-foreground/15"}
            />
          )
        })}
        {[1, 10, 20, 30].map((k) => (
          <text key={k} x={L + (k - 0.5) * step} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
            {k}
          </text>
        ))}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        {passed.length ? `Taller than ${passed[passed.length - 1].name}.` : "Shorter than a person."} Each push is the same; only the ratio repeats.
        {n === 30 && " The deck rounds this to 1.3 km on screen and says 1.28 kilometres in the notes."}
      </p>
    </figure>
  )
}
