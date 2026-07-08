"use client"

import { useState } from "react"

import { ATT, FigureCard, IDX, Legend, Segmented, WARM } from "./shared"

// Scaled dot-product attention, computed for one query in front of you:
//   score_j = (q · k_j) / √d_k   →   w = softmax(score)   →   out = Σ_j w_j v_j
// The bars under each key show the score, then renormalise to the softmax weight;
// the output glyph on the right is the weight-blended value vector. A head selector
// swaps in a different (q, k) projection so you can watch multi-head attention send
// the SAME tokens to different places. Deterministic — the "randomness" is fixed
// trig, computed at render, no timers.

const NK = 7 // keys / values
const DK = 6 // key dim (for the scale factor label)
const DV = 3 // value features drawn per token
const HEADS = 3

// deterministic q·k score for a head, and a deterministic value vector per key
function rawScore(head: number, j: number) {
  return (
    2.4 *
    Math.sin((j + 1) * (0.7 + head * 0.5) + head * 1.3) *
    Math.cos((j + 1) * 0.3 + head)
  )
}
function valueVec(j: number) {
  return Array.from({ length: DV }, (_, f) =>
    Math.min(1, Math.max(0.12, 0.5 + 0.5 * Math.sin((j + 1) * 1.1 + f * 2.1)))
  )
}

function softmax(xs: number[]) {
  const m = Math.max(...xs)
  const ex = xs.map((x) => Math.exp(x - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / s)
}

type Stage = "score" | "softmax" | "aggregate"

const W = 720
const H = 300
const MX = 40
const COLW = 74
const GAP = (W - 2 * MX - NK * COLW) / (NK - 1)
const kx = (j: number) => MX + j * (COLW + GAP)
const VAL_Y = 52
const VAL_H = 34
const BAR_Y = 150
const BAR_MAXH = 74
const OUT_X = W - 92

export function ScaledDotProduct() {
  const [head, setHead] = useState(0)
  const [stage, setStage] = useState<Stage>("softmax")

  const scaled = Array.from({ length: NK }, (_, j) => rawScore(head, j) / Math.sqrt(DK))
  const weights = softmax(scaled)
  const values = Array.from({ length: NK }, (_, j) => valueVec(j))
  const out = Array.from({ length: DV }, (_, f) =>
    values.reduce((s, v, j) => s + weights[j] * v[f], 0)
  )

  // stage 1 draws the scaled scores (can be negative), stage 2/3 the weights
  const showScore = stage === "score"
  const maxAbs = Math.max(...scaled.map((s) => Math.abs(s)), 0.001)

  return (
    <FigureCard label="scaled dot-product attention · one query">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Attention for one query over ${NK} keys in head ${head + 1}: scores are scaled by 1/sqrt(${DK}), softmaxed to weights, then used to blend the value vectors into the output.`}
      >
        <defs>
          <filter id="sdp-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
        </defs>

        <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
          keys · values →
        </text>
        <text x={OUT_X - 14} y={30} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={10}>
          {showScore ? "q·kⱼ / √dₖ" : stage === "softmax" ? "softmax(scores)" : "Σⱼ wⱼ vⱼ"}
        </text>

        {/* key columns: value glyph + score/weight bar */}
        {Array.from({ length: NK }, (_, j) => {
          const w = weights[j]
          const barH = showScore
            ? (Math.abs(scaled[j]) / maxAbs) * (BAR_MAXH / 2)
            : w * BAR_MAXH * 1.4
          const neg = showScore && scaled[j] < 0
          const dim = stage === "aggregate" ? 0.25 + 0.75 * (w / Math.max(...weights)) : 1
          return (
            <g key={j} opacity={dim} className="transition-all duration-300">
              {/* value vector glyph (DV mini bars) */}
              {values[j].map((v, f) => (
                <rect
                  key={f}
                  x={kx(j) + f * (COLW / DV) + 3}
                  y={VAL_Y + (VAL_H - v * VAL_H)}
                  width={COLW / DV - 5}
                  height={v * VAL_H}
                  rx={1.5}
                  fill={IDX}
                  opacity={0.35 + 0.5 * v}
                />
              ))}
              <rect x={kx(j)} y={VAL_Y} width={COLW} height={VAL_H} rx={4} fill="none" stroke="var(--border)" strokeWidth={1} />
              <text x={kx(j) + COLW / 2} y={VAL_Y + VAL_H + 13} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                v{j}
              </text>

              {/* score / weight bar */}
              <line x1={kx(j)} x2={kx(j) + COLW} y1={BAR_Y} y2={BAR_Y} stroke="var(--border)" strokeWidth={1} />
              <rect
                x={kx(j) + 10}
                y={neg ? BAR_Y : BAR_Y - barH}
                width={COLW - 20}
                height={barH}
                rx={2.5}
                fill={showScore ? (neg ? WARM : ATT) : ATT}
                opacity={showScore ? 0.75 : 0.85}
                className="transition-all duration-300"
              />
              {!showScore && (
                <text x={kx(j) + COLW / 2} y={BAR_Y - barH - 5} textAnchor="middle" className="fill-foreground font-mono" fontSize={9} fontWeight={600}>
                  {(w * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}

        {/* query node */}
        <rect x={MX} y={H - 42} width={150} height={30} rx={7} fill="var(--background)" stroke={ATT} strokeWidth={1.5} filter="url(#sdp-soft)" />
        <text x={MX + 75} y={H - 22} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
          query · head {head + 1}
        </text>

        {/* output glyph */}
        <text x={OUT_X + 26} y={30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
          output
        </text>
        <rect x={OUT_X} y={VAL_Y - 4} width={64} height={VAL_H + 8} rx={5} fill="none" stroke={stage === "aggregate" ? ATT : "var(--border)"} strokeWidth={stage === "aggregate" ? 1.8 : 1} filter={stage === "aggregate" ? "url(#sdp-soft)" : undefined} className="transition-all duration-300" />
        {out.map((v, f) => (
          <rect
            key={f}
            x={OUT_X + 4 + f * ((64 - 8) / DV) + 2}
            y={VAL_Y + (VAL_H - v * VAL_H)}
            width={(64 - 8) / DV - 4}
            height={v * VAL_H}
            rx={1.5}
            fill={ATT}
            opacity={stage === "aggregate" ? 0.4 + 0.5 * v : 0.18}
            className="transition-all duration-300"
          />
        ))}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">stage</span>
          <Segmented
            value={stage}
            onChange={setStage}
            options={[
              { id: "score", label: "1 · score" },
              { id: "softmax", label: "2 · softmax" },
              { id: "aggregate", label: "3 · aggregate" },
            ]}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">head</span>
          <Segmented
            value={String(head)}
            color={WARM}
            onChange={(v) => setHead(Number(v))}
            options={Array.from({ length: HEADS }, (_, h) => ({ id: String(h), label: `h${h + 1}` }))}
          />
        </div>
        <div className="ml-auto font-mono text-[10px] text-muted-foreground">
          top weight <span className="text-foreground">{(Math.max(...weights) * 100).toFixed(0)}%</span> on v
          {weights.indexOf(Math.max(...weights))}
        </div>
      </div>

      <Legend
        items={[
          { color: ATT, label: "attention weight" },
          { color: IDX, label: "value features" },
          { color: WARM, label: "negative score" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        The query scores every key by dot product, divided by <span className="text-foreground">√dₖ</span> so the
        logits do not explode as the head dimension grows and push softmax into a one-hot corner. Softmax turns those
        scores into weights that sum to 1; the output is the weight-blended value vector. Flip the{" "}
        <span style={{ color: WARM }}>head</span> and the same seven tokens get a different weighting — that is all
        multi-head attention is: several of these running in parallel on different projections, concatenated.
      </p>
    </FigureCard>
  )
}
