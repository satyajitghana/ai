"use client"

import { useState } from "react"

import { matan2, mcos, mhypot, msin } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

// Proposition 1 of the DiffusionART paper (arXiv:2610.12572, Section 3.1),
// drawn in a 2-D slice of velocity space at one state s_t, at the on-policy
// point v_theta = v_rvs^old:
//
//   F_+   = g + q e             (positive branch)
//   F_-   = g - (1 - q) e       (negative branch)
//   F_NFT = F_+ + F_- = 2g + (2q - 1) e
//
// g is the reward-improving direction (a conditional covariance, Lemma 1),
// e = v_fwd^old - v_rvs^old is the forward-reverse gap, and q is the expected
// goodness weight r at this state. DiffusionART's target is v_old + G(c), so
// its force at the same point is just G, with no e term (Section 4.1). The
// widget draws G along g at the same length as 2g so the two can be compared.
// Nothing here is fitted to data; it is the algebra of Proposition 1.

const G_COL = "oklch(0.62 0.16 45)"
const POS = "oklch(0.55 0.14 240)"
const NEG = "oklch(0.60 0.15 350)"
const NFT = "oklch(0.50 0.12 290)"
const GAP = "oklch(0.60 0.03 250)"

type V = [number, number]

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]]
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k]

function Arrow({
  from,
  to,
  colour,
  width = 2.2,
  dashed = false,
  label,
  anchor = "start",
  dx = "0.5em",
  dy = "-0.5em",
}: {
  from: V
  to: V
  colour: string
  width?: number
  dashed?: boolean
  label?: string
  anchor?: "start" | "end"
  // label offsets in em, so they scale with the svg's responsive font size
  dx?: string
  dy?: string
}) {
  const ang = matan2(to[1] - from[1], to[0] - from[0])
  const L = mhypot(to[0] - from[0], to[1] - from[1])
  if (L < 1) return null
  const h = 9
  const a1: V = [to[0] - h * mcos(ang - 0.4), to[1] - h * msin(ang - 0.4)]
  const a2: V = [to[0] - h * mcos(ang + 0.4), to[1] - h * msin(ang + 0.4)]
  return (
    <g>
      <line
        x1={from[0].toFixed(1)}
        y1={from[1].toFixed(1)}
        x2={to[0].toFixed(1)}
        y2={to[1].toFixed(1)}
        stroke={colour}
        strokeWidth={width}
        strokeDasharray={dashed ? "5 4" : undefined}
      />
      <polygon
        points={`${to[0].toFixed(1)},${to[1].toFixed(1)} ${a1[0].toFixed(1)},${a1[1].toFixed(1)} ${a2[0].toFixed(1)},${a2[1].toFixed(1)}`}
        fill={colour}
      />
      {label ? (
        <text
          x={to[0].toFixed(1)}
          y={to[1].toFixed(1)}
          dx={dx}
          dy={dy}
          textAnchor={anchor}
          fill={colour}
          fontFamily="ui-monospace, monospace"
        >
          {label}
        </text>
      ) : null}
    </g>
  )
}

export function ConsistencyForce() {
  const [q100, setQ] = useState(70)
  const [gapPct, setGap] = useState(80)
  const [angDeg, setAng] = useState(115)

  const q = q100 / 100
  // g: unit-ish reward direction pointing left, as in the paper's Figure 2(b)
  const g: V = [-1, 0]
  const theta = (angDeg * Math.PI) / 180
  const eMag = gapPct / 100
  const e: V = [eMag * mcos(theta), -eMag * msin(theta)]

  const fPos = add(g, mul(e, q))
  const fNeg = add(g, mul(e, -(1 - q)))
  const fNft = add(fPos, fNeg)
  const residual = mul(e, 2 * q - 1)
  const fArt = mul(g, 2) // same length as 2g, along g

  const angleOff = Math.abs((matan2(fNft[1], fNft[0]) - matan2(g[1], g[0])) * (180 / Math.PI))
  const angleNorm = angleOff > 180 ? 360 - angleOff : angleOff

  // Labels take their size from the svg's font size: 18 units on phones
  // (18 * 358 / 640 = 10 px), 12 units from sm up. O and S are chosen so the
  // extremes of the sliders (NFT tip at x = -3.35 units with its end-anchored
  // label, e at 1.5 units, the 21-glyph v_old label) all stay inside 640 at 18.
  const W = 640
  const H = 332
  const O: V = [410, 166]
  const S = 90
  const P = (v: V): V => [O[0] + v[0] * S, O[1] + v[1] * S]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one state, two branches · Proposition 1, drawn
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          residual (2q−1)|e| = {(Math.abs(2 * q - 1) * eMag).toFixed(2)} · NFT off-course by {angleNorm.toFixed(0)}°
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" className="max-w-full text-[18px] sm:text-[12px]">
          <title>
            {`At q = ${q.toFixed(2)}, the positive branch force g + q e and the negative branch force g − (1 − q) e add to 2g + (2q − 1) e, which points ${angleNorm.toFixed(0)} degrees away from the reward direction g. DiffusionART's force is G along g with no e term.`}
          </title>
          <circle cx={O[0]} cy={O[1]} r={5} fill="currentColor" />
          <text x={O[0]} y={O[1]} dx="0.7em" dy="1.6em" fontSize="0.9em" fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
            v_old (current state)
          </text>
          <Arrow from={O} to={P(e)} colour={GAP} dashed label="e (gap)" />
          <Arrow from={O} to={P(fPos)} colour={POS} label="F₊" dy="-0.65em" />
          <Arrow from={O} to={P(fNeg)} colour={NEG} label="F₋" dy="1.35em" />
          <Arrow from={O} to={P(fArt)} colour={G_COL} width={3} label="ART: G" dx="-0.8em" dy="1.8em" />
          <Arrow from={O} to={P(fNft)} colour={NFT} width={3} label="NFT sum" anchor="end" dx="-1.6em" dy="-0.8em" />
          {Math.abs(2 * q - 1) * eMag > 0.02 ? (
            <Arrow from={P(fArt)} to={P(add(fArt, residual))} colour={NFT} dashed width={1.4} />
          ) : null}
        </svg>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">q</span>
            <Range min={5} max={95} step={1} value={q100} onChange={(ev) => setQ(Number(ev.target.value))} className="flex-1" aria-label="statewise expected goodness q" accent={NFT} />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{q.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">|e|</span>
            <Range min={0} max={150} step={1} value={gapPct} onChange={(ev) => setGap(Number(ev.target.value))} className="flex-1" aria-label="forward-reverse gap magnitude" accent={GAP} />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{eMag.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[10px] text-muted-foreground">e angle</span>
            <Range min={0} max={360} step={5} value={angDeg} onChange={(ev) => setAng(Number(ev.target.value))} className="flex-1" aria-label="forward-reverse gap direction" accent={GAP} />
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{angDeg}°</span>
          </label>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The reward direction g is fixed, pointing left. Move q to 0.50 and the two branches&rsquo;
          gap terms cancel exactly: the{" "}
          <span style={{ color: NFT }}>NFT sum</span> lands on 2g. Anywhere else, a{" "}
          <span style={{ color: NFT }}>(2q−1)e</span> piece survives (dashed), and it points wherever the
          gap points, which has nothing to do with the reward. Set |e| to zero and the problem
          disappears, which is the paper&rsquo;s point: it only exists because the sampler&rsquo;s
          velocity is not the forward-noising velocity of its own samples. The{" "}
          <span style={{ color: G_COL }}>ART</span> arrow never moves with q or e, because its target
          is built without the forward velocity at all.
        </p>
      </div>
    </figure>
  )
}
