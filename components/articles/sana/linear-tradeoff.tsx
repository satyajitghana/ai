"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What LiteLA gives up, stated exactly rather than hand-waved.
//
// diffusion/model/nets/sana_blocks.py:246 — LiteLA.attn_matmul:
//
//     q = self.kernel_func(q)               # ReLU
//     k = self.kernel_func(k)
//     v = F.pad(v, (0, 0, 0, 1), value=1)   # append a row of ones
//     vk = torch.matmul(v, k)               # (d_h+1) x d_h state, per head
//     out = torch.matmul(vk, q)
//     out = out[:, :, :-1] / (out[:, :, -1:] + self.eps)
//
// Three consequences follow directly from those five lines.
//
// 1. STATE, NOT SCORES. Softmax attention materialises an N x N score matrix per
//    head. LiteLA never forms one: it accumulates a (d_h+1) x d_h state — with
//    d_h = 32 (linear_head_dim=32; the released diffusers configs say
//    attention_head_dim: 32), that is 33 x 32 = 1056 numbers per head, no matter
//    how many tokens there are. The padded row of ones is what makes the last
//    row of the state the denominator sum_j ReLU(k_j).
//
// 2. RANK. The attention map LiteLA *implies* is A = ReLU(Q) ReLU(K)^T, a
//    product of an N x d_h and a d_h x N matrix, so rank(A) <= d_h = 32 for any
//    N. At 4096px Sana runs N = 16,384 tokens through a rank-32 mixing map.
//
// 3. NO TEMPERATURE. ReLU-then-normalise is homogeneous of degree zero in the
//    scores: scaling every compatibility by gamma > 0 leaves the weights
//    identical, because gamma cancels between numerator and denominator. Softmax
//    is not — scaling the scores IS the temperature knob, and it can drive the
//    weights to a hard argmax. The chart below is that fact, plotted.
//
// The 16 compatibilities are a fixed illustrative profile, not measured
// activations; the invariance they demonstrate is exact for any profile.

const SOFT = "oklch(0.58 0.19 27)"
const LIN = "oklch(0.60 0.15 255)"
const MUTED = "oklch(0.62 0.03 250)"
const WIN = "oklch(0.55 0.16 155)"

const DH = 32
const S = [-0.9, -0.4, 0.2, 0.5, 0.8, 1.4, 2.2, 1.1, 0.3, -0.2, -0.7, 0.4, 1.6, 0.9, 0.1, -0.5]

const RES = [
  { px: 512, n: 256 },
  { px: 1024, n: 1024 },
  { px: 2048, n: 4096 },
  { px: 4096, n: 16384 },
]

function softmaxW(g: number) {
  const e = S.map((s) => mexp(g * s))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / z)
}

const RELU = S.map((s) => (s > 0 ? s : 0))
const RELU_Z = RELU.reduce((a, b) => a + b, 0)
const LINW = RELU.map((x) => x / RELU_Z)

// effective number of keys attended: 1 / sum(w^2)
const pr = (w: number[]) => 1 / w.reduce((a, b) => a + b * b, 0)

const LIN_PEAK = Math.max(...LINW)
const LIN_PR = pr(LINW)

export function LinearTradeoff() {
  const [g10, setG10] = useState(10) // gamma x10
  const [ri, setRi] = useState(3)

  const g = g10 / 10
  const sw = softmaxW(g)
  const res = RES[ri]
  const N = res.n

  const scores = N * N
  const state = (DH + 1) * DH
  const rank = Math.min(N, DH)

  const W = 700
  const X0 = 102
  const BW = 31
  const GAP = 5
  const TOP = 20
  const ROWH = 74
  const H = TOP + ROWH * 2 + 18

  const gmax = Math.max(...sw, LIN_PEAK)
  const hOf = (w: number) => (w / gmax) * 46

  const ROWS = [
    {
      key: "soft",
      w: sw,
      c: SOFT,
      y: TOP,
      l0: "softmax(γ·s)",
      l1: `peak ${(Math.max(...sw) * 100).toFixed(0)}%`,
      l2: `${pr(sw).toFixed(1)} keys eff.`,
      l3: "moves with γ",
    },
    {
      key: "lin",
      w: LINW,
      c: LIN,
      y: TOP + ROWH,
      l0: "ReLU / Σ ReLU",
      l1: `peak ${(LIN_PEAK * 100).toFixed(0)}%`,
      l2: `${LIN_PR.toFixed(1)} keys eff.`,
      l3: "invariant in γ",
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          attention weights over 16 keys · score contrast &gamma; = {g.toFixed(1)}
        </span>
        <span className="font-mono text-[10px]">
          <span style={{ color: SOFT }}>softmax peak {(Math.max(...sw) * 100).toFixed(0)}%</span>
          <span style={{ color: MUTED }}> · </span>
          <span style={{ color: LIN }}>ReLU kernel peak {(LIN_PEAK * 100).toFixed(0)}%, fixed</span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">score contrast &gamma;</span>
          <Range
            min={2}
            max={80}
            step={1}
            value={g10}
            accent={SOFT}
            aria-label="score contrast gamma"
            onChange={(e) => setG10(Number(e.target.value))}
            className="w-56"
          />
          <span className="font-mono text-[10px] tabular-nums" style={{ color: SOFT }}>
            {g.toFixed(1)}&times;
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two rows of sixteen attention weights over the same key compatibilities. Softmax at contrast ${g.toFixed(
                1,
              )} puts ${(Math.max(...sw) * 100).toFixed(0)} percent of its weight on the strongest key and effectively attends to ${pr(
                sw,
              ).toFixed(1)} keys. The ReLU kernel puts ${(LIN_PEAK * 100).toFixed(
                0,
              )} percent on the same key and attends to ${LIN_PR.toFixed(
                1,
              )} keys, and neither number moves when the contrast changes.`}
            </title>

            {ROWS.map((row) => {
              const base = row.y + 56
              return (
                <g key={row.key}>
                  <text x={0} y={row.y + 18} fontSize={9} fill={row.c} fontFamily="ui-monospace, monospace">
                    {row.l0}
                  </text>
                  <text x={0} y={row.y + 31} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {row.l1}
                  </text>
                  <text x={0} y={row.y + 42} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {row.l2}
                  </text>
                  <text x={0} y={row.y + 53} fontSize={7.5} fill={row.c} fillOpacity={0.8} fontFamily="ui-monospace, monospace">
                    {row.l3}
                  </text>
                  <line x1={X0 - 8} y1={base} x2={W - 4} y2={base} stroke="currentColor" strokeOpacity={0.15} />
                  {row.w.map((w, j) => {
                    const x = X0 + j * (BW + GAP)
                    const h = hOf(w)
                    return (
                      <g key={j}>
                        <rect
                          x={x}
                          y={base - h}
                          width={BW}
                          height={Math.max(0.7, h)}
                          rx={1.5}
                          fill={row.c}
                          fillOpacity={w === 0 ? 0.14 : 0.82}
                        />
                        <text
                          x={x + BW / 2}
                          y={base - h - 3}
                          fontSize={7}
                          textAnchor="middle"
                          fill={row.c}
                          fillOpacity={w < 0.02 ? 0.3 : 0.9}
                          fontFamily="ui-monospace, monospace"
                        >
                          {w < 0.005 ? "" : (w * 100).toFixed(0)}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}

            {S.map((s, j) => (
              <text
                key={j}
                x={X0 + j * (BW + GAP) + BW / 2}
                y={H - 4}
                fontSize={7}
                textAnchor="middle"
                fill={s > 0 ? "currentColor" : MUTED}
                fillOpacity={s > 0 ? 0.5 : 0.85}
                fontFamily="ui-monospace, monospace"
              >
                {s.toFixed(1)}
              </text>
            ))}
            <text x={0} y={H - 4} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              raw score s
            </text>
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {RES.map((r, i) => (
            <button
              key={r.px}
              type="button"
              onClick={() => setRi(i)}
              aria-pressed={ri === i}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                ri === i
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {r.px}px
            </button>
          ))}
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {[
            { l: "tokens per head", v: N.toLocaleString(), c: MUTED },
            { l: "softmax score entries", v: scores.toLocaleString(), c: SOFT },
            { l: "LiteLA state entries", v: `${state.toLocaleString()}, constant`, c: LIN },
            { l: "rank of the mixing map", v: `≤ ${rank}`, c: WIN },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag &gamma;. Softmax exponentiates its scores, so multiplying them by a constant is a
          temperature knob: at &gamma; = 0.2 it is nearly uniform, at &gamma; = 8 it has collapsed onto
          a single key. The ReLU kernel <em>cannot move at all</em>. ReLU-then-normalise is
          homogeneous of degree zero — the &gamma; cancels between numerator and denominator — so
          LiteLA&rsquo;s weights are fixed by the <em>direction</em>{" "}of the query and never by its
          magnitude. Both rows share one vertical scale, so the shapes are directly comparable.
          <br />
          <br />
          Note the five faint bars. ReLU clamps every negative compatibility to exactly zero, which
          throws away all ordering among them: a key that mildly disagrees and one that strongly
          disagrees get the same weight, none.
          <br />
          <br />
          The stat row is the other half of the bargain, and it is the half Sana is buying. Softmax
          needs an <span className="font-mono text-[11px]">N×N</span>{" "}score matrix per head;
          LiteLA carries a <span className="font-mono text-[11px]">33×32</span>{" "}state whose size
          does not depend on <em>N</em>{" "}at all, which is exactly why its cost is linear. The
          price is printed beside it: because everything routes through that state, the implied
          attention matrix has{" "}
          <span className="text-foreground">rank at most 32 however many tokens there are</span>.
          Sana&rsquo;s answer is not more attention — it is the 3&times;3 depthwise convolution
          inside Mix-FFN, which puts back the local mixing a rank-32 map smears.
        </p>
      </div>
    </figure>
  )
}
