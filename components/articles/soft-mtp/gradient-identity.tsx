"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"

// The identity at the heart of the paper, in logit space (W^T would map these
// vectors to hidden space and changes nothing about the algebra):
//   hard  = p - e_y            what plain MTP back-propagates
//   KL    = p - q              what self-distillation to the NTP teacher would
//   resid = q - e_y            what is left over: depends on the sampled token
//   hard  = KL + resid         exactly, term by term
// Everything on this card is arithmetic on five numbers; nothing is measured
// from a model. Draws are quantiles of q at fixed uniform positions, so the
// page renders identically on the server and in the browser.

const TOKENS = ["the", "a", "cat", "dog", "ran"]
const TEACHER_LOGITS = [2.2, 1.1, 0.5, 0.3, -0.6]
const UNIFORMS = [0.07, 0.31, 0.52, 0.66, 0.78, 0.9, 0.96, 0.43]

function softmax(z: number[]): number[] {
  const m = Math.max(...z)
  const e = z.map((x) => mexp(x - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / s)
}

function draw(q: number[], u: number): number {
  let c = 0
  for (let i = 0; i < q.length; i++) {
    c += q[i]
    if (u <= c) return i
  }
  return q.length - 1
}

const norm = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0))

const COLORS = { hard: "oklch(0.55 0.02 260)", kl: "oklch(0.58 0.15 250)", res: "oklch(0.58 0.17 30)" }

function Bars({ title, v, color, note }: { title: string; v: number[]; color: string; note: string }) {
  const W = 230
  const H = 120
  const mid = H / 2
  const bw = 26
  return (
    <div className="rounded-lg border p-2.5">
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span style={{ color }}>{title}</span>
        <span className="text-muted-foreground">norm {norm(v).toFixed(3)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} role="img" className="mt-1 h-auto w-full">
        <title>{`${title}: ${TOKENS.map((t, i) => `${t} ${v[i].toFixed(2)}`).join(", ")}`}</title>
        <line x1={4} x2={W - 4} y1={mid} y2={mid} stroke="currentColor" strokeOpacity={0.25} />
        {v.map((x, i) => {
          const h = Math.abs(x) * (mid - 6)
          const px = 8 + i * (bw + 15)
          return (
            <g key={TOKENS[i]}>
              <rect x={px} y={x >= 0 ? mid - h : mid} width={bw} height={Math.max(h, 0.6)} fill={color} fillOpacity={0.85} rx={2} />
              <text x={px + bw / 2} y={H + 11} textAnchor="middle" fontSize={9} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                {TOKENS[i]}
              </text>
              <text x={px + bw / 2} y={x >= 0 ? mid - h - 3 : mid + h + 9} textAnchor="middle" fontSize={8} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.7}>
                {x.toFixed(2)}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </div>
  )
}

export function GradientIdentity() {
  const [teacherSharp, setTeacherSharp] = useState(1)
  const [lag, setLag] = useState(0.6)
  const [drawIdx, setDrawIdx] = useState(0)

  const q = softmax(TEACHER_LOGITS.map((x) => x * teacherSharp))
  // the MTP head is a blurred, slightly mis-ranked copy of the teacher: lag 0 = identical, 1 = uniform-ish
  const p = softmax(TEACHER_LOGITS.map((x, i) => x * teacherSharp * (1 - lag) + (i === 3 ? 0.9 * lag * teacherSharp : 0)))
  const y = draw(q, UNIFORMS[drawIdx])
  const oneHot = TOKENS.map((_, i) => (i === y ? 1 : 0))
  const hard = p.map((x, i) => x - oneHot[i])
  const kl = p.map((x, i) => x - q[i])
  const res = q.map((x, i) => x - oneHot[i])
  const gap = Math.max(...hard.map((h, i) => Math.abs(h - (kl[i] + res[i]))))
  const floor = 1 - q.reduce((a, b) => a + b * b, 0) // E||q - e_y||^2 for y ~ q
  const klSq = kl.reduce((a, b) => a + b * b, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one MTP position in logit space · arithmetic, not a model run</span>
        <span className="font-mono text-xs">target drawn from teacher: “{TOKENS[y]}”</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Bars title="hard  p − e_y" v={hard} color={COLORS.hard} note="What plain multi-token prediction pushes back through the head." />
          <Bars title="KL  p − q" v={kl} color={COLORS.kl} note="Pull the MTP head toward the model's own next-token distribution. Needs no sampled token." />
          <Bars title="residual  q − e_y" v={res} color={COLORS.res} note="What is left once the teacher is subtracted. It changes with every sampled token." />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 font-mono text-xs">
            <span className="text-muted-foreground">teacher sharpness {teacherSharp.toFixed(2)}</span>
            <Range min={0.4} max={2} step={0.05} value={teacherSharp} onChange={(e) => setTeacherSharp(Number(e.target.value))} aria-label="Teacher sharpness" />
          </label>
          <label className="flex flex-col gap-1 font-mono text-xs">
            <span className="text-muted-foreground">how far the MTP head lags {lag.toFixed(2)}</span>
            <Range min={0} max={1} step={0.05} value={lag} onChange={(e) => setLag(Number(e.target.value))} aria-label="MTP head lag" />
          </label>
          <div className="flex flex-col gap-1 font-mono text-xs">
            <span className="text-muted-foreground">sampled target (draw {drawIdx + 1} of {UNIFORMS.length})</span>
            <button
              type="button"
              onClick={() => setDrawIdx((drawIdx + 1) % UNIFORMS.length)}
              className="rounded-md border px-2 py-1 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2"
            >
              draw the next token
            </button>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          {[
            ["largest |hard − (KL + residual)|", gap < 1e-12 ? "0 (to rounding)" : gap.toExponential(1)],
            ["‖KL‖²", klSq.toFixed(3)],
            ["expected ‖residual‖² over draws", floor.toFixed(3)],
            ["residual is bigger than KL", floor > klSq ? "yes, on average" : "no, here"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border px-2.5 py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          If the true next token follows the teacher, the residual has mean zero and expected squared length 1 − Σq², whatever the head does: noise
          that no amount of training removes. The KL term shrinks as the head catches up. The identity in the first box holds for every position and
          every draw.
        </p>
      </div>
    </figure>
  )
}
