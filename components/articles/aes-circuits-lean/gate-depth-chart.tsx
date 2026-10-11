"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Gates (y) against depth (x) for every circuit the article discusses, all in the
// same gate model ({AND, XOR, XNOR}, cost 1 each; the multipliers use no XNOR).
// Every point was recounted by the article's own parser from the circuit files:
// Jain's from Swapnil-jain/gf2m-circuits @ c451bf1, the CMT ones from the copies
// in that repo, the NIST ones from usnistgov/Circuits @ 113aec8.

type Pt = { g: number; d: number; who: "jain" | "prior"; name: string; note?: string; tweet?: boolean }
type Panel = { id: string; label: string; pts: Pt[]; dMax: number; gMin: number; gMax: number }

const PANELS: Panel[] = [
  {
    id: "fwd",
    label: "S-box",
    dMax: 40,
    gMin: 100,
    gMax: 130,
    pts: [
      { g: 113, d: 27, who: "prior", name: "Boyar–Peralta / Calik (CMT page)", tweet: true },
      { g: 125, d: 16, who: "prior", name: "Boyar–Find–Peralta (CMT page)" },
      { g: 125, d: 15, who: "prior", name: "NIST repository" },
      { g: 110, d: 22, who: "prior", name: "NIST repository, 2026 (two files)" },
      { g: 106, d: 24, who: "jain", name: "Jain sbox106_d24" },
      { g: 106, d: 34, who: "jain", name: "Jain sbox106_d34 (sweep circuit)" },
      { g: 110, d: 38, who: "jain", name: "Jain sbox110_d38 (not claimed)" },
      { g: 121, d: 16, who: "jain", name: "Jain sbox121_d16" },
      { g: 116, d: 17, who: "jain", name: "Jain sbox116_d17" },
      { g: 112, d: 18, who: "jain", name: "Jain sbox112_d18" },
      { g: 111, d: 21, who: "jain", name: "Jain sbox111_d21" },
    ],
  },
  {
    id: "inv",
    label: "Inverse S-box",
    dMax: 40,
    gMin: 100,
    gMax: 130,
    pts: [
      { g: 121, d: 21, who: "prior", name: "CMT page", tweet: true },
      { g: 112, d: 26, who: "prior", name: "NIST repository, 2026" },
      { g: 109, d: 30, who: "jain", name: "Jain invsbox109_d30" },
      { g: 109, d: 31, who: "jain", name: "Jain invsbox109_d31" },
    ],
  },
  {
    id: "mul",
    label: "GF(2^8) multiplier",
    dMax: 22,
    gMin: 100,
    gMax: 120,
    pts: [
      { g: 117, d: 6, who: "prior", name: "CMT slp_84310, July 2010", tweet: true },
      { g: 112, d: 6, who: "jain", name: "Jain aes112_d6" },
      { g: 110, d: 7, who: "jain", name: "Jain aes110_d7" },
      { g: 108, d: 12, who: "jain", name: "Jain aes108_d12" },
      { g: 107, d: 13, who: "jain", name: "Jain aes107_d13" },
      { g: 107, d: 18, who: "jain", name: "Jain aes107_k36" },
      { g: 107, d: 19, who: "jain", name: "Jain aes107_k35" },
    ],
  },
]

const W = 620
const H = 300
const L = 44
const R = 16
const T = 14
const B = 34

export function GateDepthChart() {
  const [pid, setPid] = useState("fwd")
  const [hover, setHover] = useState<number | null>(null)
  const p = PANELS.find((v) => v.id === pid) ?? PANELS[0]
  const sx = (d: number) => L + (d / p.dMax) * (W - L - R)
  const sy = (g: number) => T + ((p.gMax - g) / (p.gMax - p.gMin)) * (H - T - B)
  const xt: number[] = []
  for (let d = 0; d <= p.dMax; d += p.dMax > 30 ? 5 : 2) xt.push(d)
  const yt: number[] = []
  for (let g = p.gMin; g <= p.gMax; g += 5) yt.push(g)
  const tweet = p.pts.find((q) => q.tweet)
  const bestPrior = p.pts.filter((q) => q.who === "prior").reduce((a, q) => (q.g < a.g ? q : a))
  const bestJain = p.pts.filter((q) => q.who === "jain").reduce((a, q) => (q.g < a.g || (q.g === a.g && q.d < a.d) ? q : a))
  const sel = hover !== null ? p.pts[hover] : null

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        Gates against depth, every point recounted from its circuit file · lower-left is better on both
      </figcaption>
      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Choose a circuit family">
        {PANELS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={pid === v.id}
            onClick={() => {
              setPid(v.id)
              setHover(null)
            }}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              pid === v.id ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${p.label}: smallest prior circuit ${bestPrior.g} gates at depth ${bestPrior.d}; smallest of Jain's ${bestJain.g} gates at depth ${bestJain.d}; the tweet's baseline is ${tweet?.g} gates at depth ${tweet?.d}.`}
      >
        {yt.map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={sy(g)} y2={sy(g)} stroke="var(--border)" strokeWidth={0.6} />
            <text x={L - 6} y={sy(g) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {g}
            </text>
          </g>
        ))}
        {xt.map((d) => (
          <text key={d} x={sx(d)} y={H - B + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            {d}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          depth (gates on the longest path)
        </text>
        <text x={10} y={T + 4} fontSize={10} className="fill-muted-foreground font-mono">
          gates
        </text>
        {tweet && (
          <line
            x1={sx(tweet.d)}
            y1={sy(tweet.g)}
            x2={sx(bestJain.d)}
            y2={sy(bestJain.g)}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        )}
        {p.pts.map((q, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: "pointer" }}>
            {q.who === "jain" ? (
              <circle cx={sx(q.d)} cy={sy(q.g)} r={5.5} fill="#c2410c" stroke={hover === i ? "var(--foreground)" : "none"} strokeWidth={1.5} />
            ) : (
              <rect
                x={sx(q.d) - 5}
                y={sy(q.g) - 5}
                width={10}
                height={10}
                fill="var(--card)"
                stroke="var(--foreground)"
                strokeWidth={hover === i ? 2.4 : 1.4}
              />
            )}
            <text x={sx(q.d) + 8} y={sy(q.g) - 7} fontSize={9} className="fill-foreground font-mono">
              {q.g}/{q.d}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted-foreground">
        <span>□ published before</span>
        <span>● Jain, October 2026</span>
        <span>dashed: the comparison the post makes</span>
      </div>
      <div className="mt-2 min-h-[2.5em] font-mono text-xs text-foreground">
        {sel
          ? `${sel.name}: ${sel.g} gates, depth ${sel.d}`
          : `Smallest published: ${bestPrior.g} gates at depth ${bestPrior.d}. Smallest of Jain's: ${bestJain.g} at depth ${bestJain.d}. The post compares against ${tweet?.g} at depth ${tweet?.d}.`}
      </div>
    </figure>
  )
}
