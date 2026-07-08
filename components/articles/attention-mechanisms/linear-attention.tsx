"use client"

import { useState } from "react"

import { ATT, FigureCard, IDX, IO, Legend, PlayPause, useReducedMotion, useTicker, WARM } from "./shared"

// Linear attention (Katharopoulos 2020), drawn as the cost contrast that is the whole
// point. Softmax attention materialises an N×N score matrix — it grows quadratically as
// tokens stream in. Linear attention swaps the kernel so it can keep a single running
// state S = Σ φ(kᵢ)vᵢᵀ of FIXED size d×d, updated once per token: out_t = φ(q_t)·S_t.
// Stream the tokens and watch the left triangle grow while the right state just updates
// in place. Deterministic; animation lives in an effect and is gated on reduced-motion.

const N = 15
const D = 6 // state feature dim (small, for the picture)

const W = 720
const H = 320
// left: growing causal matrix
const LX = 40
const LY = 66
const CS = 13
// right: fixed d×d state
const RX = 470
const RY = 60
const SC = 30

function phi(k: number, a: number) {
  // a positive feature map (elu+1-ish), deterministic
  return Math.max(0.05, 0.6 + 0.6 * Math.sin((k + 1) * 0.8 + a * 1.3))
}
function val(k: number, b: number) {
  return 0.5 + 0.5 * Math.sin((k + 1) * 0.5 + b * 1.9)
}

export function LinearAttention() {
  const reduced = useReducedMotion()
  const [t, setT] = useState(N - 1)
  const [playing, setPlaying] = useState(true)

  useTicker(playing, reduced, 520, () => setT((x) => (x + 1) % N))

  // running state S[a][b] = Σ_{i≤t} φ(i,a) · val(i,b)
  const S = Array.from({ length: D }, (_, a) =>
    Array.from({ length: D }, (_, b) => {
      let s = 0
      for (let i = 0; i <= t; i++) s += phi(i, a) * val(i, b)
      return s
    })
  )
  const sMax = Math.max(...S.flat(), 0.001)

  const matCells = ((t + 1) * (t + 2)) / 2 // materialised softmax cells
  const stateCells = D * D // constant

  return (
    <FigureCard
      label="linear vs softmax attention · cost as tokens stream"
      right={<PlayPause playing={playing} onToggle={() => setPlaying((p) => !p)} hidden={reduced} />}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`At ${t + 1} tokens, softmax attention has materialised ${matCells} score cells (quadratic), while linear attention keeps a constant ${stateCells}-cell running state.`}
      >
        <defs>
          <filter id="lin-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* divider */}
        <line x1={W / 2 + 10} y1={40} x2={W / 2 + 10} y2={H - 30} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" />

        {/* LEFT — growing softmax matrix */}
        <text x={LX} y={34} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
          softmax attention
        </text>
        <text x={LX} y={50} className="font-mono" fontSize={10} fill={WARM}>
          O(N²) · matrix grows
        </text>
        {Array.from({ length: N }, (_, i) =>
          Array.from({ length: N }, (_, j) => {
            if (j > i) return null // causal lower triangle
            const shown = i <= t
            const isNew = i === t
            return (
              <rect
                key={`${i}-${j}`}
                x={LX + j * CS + 1}
                y={LY + i * CS + 1}
                width={CS - 2}
                height={CS - 2}
                rx={1.5}
                fill={isNew ? WARM : IDX}
                opacity={shown ? (isNew ? 0.9 : 0.4) : 0.05}
                className="transition-all duration-200"
              />
            )
          })
        )}

        {/* RIGHT — fixed running state */}
        <text x={RX} y={34} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
          linear attention
        </text>
        <text x={RX} y={50} className="font-mono" fontSize={10} fill={ATT}>
          O(N) · state fixed at d×d
        </text>
        <rect x={RX - 6} y={RY - 6} width={D * SC + 12} height={D * SC + 12} rx={8} fill="none" stroke={IO} strokeWidth={1.5} filter="url(#lin-soft)" />
        {S.map((row, a) =>
          row.map((v, b) => (
            <rect
              key={`${a}-${b}`}
              x={RX + b * SC + 1.5}
              y={RY + a * SC + 1.5}
              width={SC - 3}
              height={SC - 3}
              rx={3}
              fill={ATT}
              opacity={0.12 + 0.8 * (v / sMax)}
              className="transition-all duration-300"
            />
          ))
        )}
        <text x={RX + (D * SC) / 2} y={RY + D * SC + 22} textAnchor="middle" className="font-mono" fontSize={10} fill={IO}>
          S ← S + φ(kₜ) vₜᵀ
        </text>

        {/* token strip along the very bottom */}
        {Array.from({ length: N }, (_, i) => {
          const shown = i <= t
          const isNew = i === t
          const tw = (W - 80) / N
          return (
            <rect
              key={i}
              x={40 + i * tw + 1}
              y={H - 22}
              width={tw - 2}
              height={12}
              rx={2}
              fill={isNew ? WARM : "var(--foreground)"}
              opacity={isNew ? 0.9 : shown ? 0.4 : 0.1}
              className="transition-all duration-200"
            />
          )
        })}
      </svg>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>tokens streamed</span>
          <span className="tabular-nums text-foreground">{t + 1} / {N}</span>
        </div>
        <input
          type="range"
          min={0}
          max={N - 1}
          value={t}
          onChange={(e) => setT(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: ATT }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>
          softmax cells: <span className="tabular-nums" style={{ color: IDX }}>{matCells}</span>
        </span>
        <span>
          linear state: <span className="tabular-nums" style={{ color: ATT }}>{stateCells}</span> (constant)
        </span>
        <span className="ml-auto text-foreground">{(matCells / stateCells).toFixed(1)}× fewer to keep</span>
      </div>

      <Legend
        items={[
          { color: IDX, label: "materialised score cell" },
          { color: WARM, label: "this step" },
          { color: ATT, label: "running state S" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Softmax puts a non-linearity between Q and K, so you cannot reassociate the product — the full{" "}
        <span style={{ color: IDX }}>N×N matrix</span> has to exist. Replace softmax with a kernel
        feature map <span className="text-foreground">φ</span> and the algebra reassociates:{" "}
        <span className="text-foreground">φ(Q)(φ(K)ᵀV)</span> lets you fold the past into one{" "}
        <span style={{ color: ATT }}>d×d state</span> and update it per token, exactly like an RNN. Constant memory,
        linear time, unbounded context — at the cost of approximating the softmax, which usually shows up as weaker
        recall. Performer (FAVOR+) is the same idea with a random-feature φ that provably approximates the softmax
        kernel; "lightning" and gated-linear variants add decay so old state fades.
      </p>
    </FigureCard>
  )
}
