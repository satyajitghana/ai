// The two perturbations, on one logarithmic axis.
//
// Move an option to a different position and its logit moves by a few units in
// the last place of a float32. Change WHICH other options are on the list and it
// moves by about a tenth of a logit, and by seven tenths at the worst. A per-option scalar
// scorer would put both bars at exactly zero — its softmax is taken after the
// scalars exist, so nothing about the set can reach an individual score. A
// vocabulary readout would put both bars in the same place, because it cannot
// separate them.
//
// Server-rendered SVG, zero JS. mlog10 comes from lib/dmath: Math.log10 is only
// an "implementation-dependent approximation" per spec, so an SVG coordinate
// derived from it can serialize differently in Node and in Chrome.

import { mlog10 } from "@/lib/dmath"

// Measured: 57 questions, 2,520 permutations and 780 leave-one-out deltas,
// float32 on CPU through the repository's own serving code.
const PERM = { median: 4.76837e-07, max: 9.53674e-07, label: "reposition an option" }
const COMP = { median: 0.0880083, max: 0.70885, label: "change which options are on the list" }

const LO = -8 // 1e-8
const HI = 0 // 1e0
const X0 = 30
const PLOT = 440
const W = X0 + PLOT + 24
const H = 150

const x = (v: number) => X0 + ((mlog10(v) - LO) / (HI - LO)) * PLOT
const DECADES = [-8, -7, -6, -5, -4, -3, -2, -1, 0]

function Band({
  y,
  median,
  max,
  accent,
}: {
  y: number
  median: number
  max: number
  accent: boolean
}) {
  return (
    <g>
      <line
        x1={x(median)}
        y1={y}
        x2={x(max)}
        y2={y}
        className={accent ? "stroke-foreground/75" : "stroke-foreground/40"}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <circle cx={x(median)} cy={y} r={5} className={accent ? "fill-foreground" : "fill-foreground/70"} />
    </g>
  )
}

export function SetVsOrder() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        how far one candidate&apos;s raw logit moves, under two perturbations · log scale
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[520px]"
        role="img"
        aria-label="A logarithmic axis from 1e-8 to 1. Two horizontal bands, about six decades apart and nowhere overlapping. The upper band is what repositioning an option does to its logit: a sliver at the extreme left, sitting on a marked line for two to the minus twenty-three, the last place of a float32. The lower band is what changing which other options are on the list does to the same logit: near the right-hand end, around a tenth of a logit and reaching seven tenths. Each band runs from the median to the worst case, with a dot at the median."
      >
        {DECADES.map((d) => {
          const px = X0 + ((d - LO) / (HI - LO)) * PLOT
          return (
            <g key={d}>
              <line x1={px} y1={24} x2={px} y2={104} className="stroke-border" strokeWidth={0.75} strokeDasharray="2 5" />
              <text x={px} y={120} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {d === 0 ? "1" : `1e${d}`}
              </text>
            </g>
          )
        })}

        {/* float32 epsilon marker */}
        <line x1={x(1.1920929e-7)} y1={20} x2={x(1.1920929e-7)} y2={104} className="stroke-foreground/50" strokeWidth={1} />
        <text x={x(1.1920929e-7) + 4} y={18} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          2⁻²³
        </text>

        <Band y={44} median={PERM.median} max={PERM.max} accent={false} />
        <text x={x(PERM.max) + 12} y={48} className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          {PERM.label} — median {PERM.median.toExponential(1)}, worst {PERM.max.toExponential(1)}
        </text>

        <Band y={82} median={COMP.median} max={COMP.max} accent />
        <text
          x={x(COMP.median) - 12}
          y={86}
          textAnchor="end"
          className="fill-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          {COMP.label} — median {COMP.median.toFixed(3)}, worst {COMP.max.toFixed(3)}
        </text>

        <text x={X0} y={H - 8} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          change in a single candidate&apos;s logit, absolute →
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Both perturbations leave the candidate&apos;s own text and the state untouched, and
        both leave its backbone vector bit-identical, so everything here happens in the 2.4M
        parameters of the head. The upper band is summarised per question — each question
        contributes its worst permutation out of all of them — so it is the pessimistic
        reading. Six decades still separate the two. That separation is the whole claim:
        position carries no information and composition carries a lot.
      </figcaption>
    </figure>
  )
}
