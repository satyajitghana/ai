"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { gauss, pearson, rng, tanh } from "./rng"

// A toy of the write BioLLM says it serves (viewer-status.json, served_adapter):
// a frozen model; electrode values z from a recorded row; fixed "ties" from
// each electrode to MLP neurons; a gain on the activations that enter
// down_proj. Here: 7 electrodes, 16 MLP neurons, an 8-wide residual stream and
// 6 output words. The four arms are the ones a fair test needs. Every number
// is simulated with a seeded PRNG; none is BioLLM's.

const E = 7
const N = 16
const D = 8
const WORDS = ["sea", "light", "quiet", "wave", "bright", "still"]
const ROWS = 48

type Arm = "culture" | "shuffled" | "random" | "off"
const ARMS: { id: Arm; label: string; note: string }[] = [
  { id: "culture", label: "learned ties, real row", note: "the write as served" },
  { id: "shuffled", label: "learned ties, shuffled row", note: "another row's z: right shape, wrong moment" },
  { id: "random", label: "random ties, real row", note: "same size and cost, no learning" },
  { id: "off", label: "no write", note: "the frozen model" },
]

const W = (() => {
  const r = rng(144)
  const mat = (a: number, b: number, s: number) => Array.from({ length: a }, () => Array.from({ length: b }, () => gauss(r) * s))
  const down = mat(N, D, 0.5) // MLP neuron -> residual
  const unembed = mat(D, WORDS.length, 0.6) // residual -> word logits
  const act = Array.from({ length: N }, () => 0.4 + r()) // the prompt's own MLP activations
  const h0 = Array.from({ length: D }, () => gauss(r) * 0.3)
  // the culture's state: a direction u in electrode space
  const u = Array.from({ length: E }, () => gauss(r))
  const un = Math.sqrt(u.reduce((a, b) => a + b * b, 0))
  for (let i = 0; i < E; i++) u[i] /= un
  // learned ties: a Hebbian (Oja-like) fit concentrates on u, plus noise
  const v = Array.from({ length: N }, () => gauss(r))
  const learned = Array.from({ length: E }, (_, e) => Array.from({ length: N }, (_, n) => 0.9 * u[e] * v[n] + 0.25 * gauss(r)))
  const random = mat(E, N, 1)
  const norm = (m: number[][]) => Math.sqrt(m.flat().reduce((a, b) => a + b * b, 0))
  const k = norm(learned) / norm(random)
  for (const row of random) for (let n = 0; n < N; n++) row[n] *= k
  // recorded rows: a latent state s, z = s*u + noise
  const state = Array.from({ length: ROWS }, () => gauss(r))
  const rows = state.map((s) => Array.from({ length: E }, (_, e) => s * u[e] + 0.6 * gauss(r)))
  const perm = Array.from({ length: ROWS }, (_, i) => i)
  for (let i = ROWS - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  return { down, unembed, act, h0, learned, random, state, rows, perm }
})()

function forward(z: number[] | null, ties: number[][], strength: number) {
  const h = W.h0.slice()
  for (let n = 0; n < N; n++) {
    let pre = 0
    if (z) for (let e = 0; e < E; e++) pre += ties[e][n] * z[e]
    const g = z ? tanh(strength * pre) : 0
    const a = W.act[n] * (1 + g)
    for (let d = 0; d < D; d++) h[d] += a * W.down[n][d]
  }
  const logits = WORDS.map((_, w) => {
    let s = 0
    for (let d = 0; d < D; d++) s += h[d] * W.unembed[d][w]
    return s
  })
  const m = Math.max(...logits)
  const ex = logits.map((l) => mexp(l - m))
  const tot = ex.reduce((a, b) => a + b, 0)
  return { logits, probs: ex.map((x) => x / tot) }
}

function armInput(arm: Arm, row: number) {
  if (arm === "off") return { z: null, ties: W.learned }
  if (arm === "shuffled") return { z: W.rows[W.perm[row]], ties: W.learned }
  if (arm === "random") return { z: W.rows[row], ties: W.random }
  return { z: W.rows[row], ties: W.learned }
}

const ACC = "oklch(0.68 0.15 35)"
const OFF = "oklch(0.62 0.03 250)"

export function WriteControl() {
  const [arm, setArm] = useState<Arm>("culture")
  const [row, setRow] = useState(5)
  const [strengthPct, setStrengthPct] = useState(60)
  const strength = strengthPct / 100

  const base = useMemo(() => forward(null, W.learned, 0), [])
  const cur = useMemo(() => {
    const { z, ties } = armInput(arm, row)
    return forward(z, ties, strength)
  }, [arm, row, strength])

  // across all rows: how well does the output carry the row's own state?
  // decoder: the single word whose logit shift tracks the state best, |r|.
  const carry = useMemo(
    () =>
      ARMS.map((a) => {
        const shifts = WORDS.map(() => [] as number[])
        for (let i = 0; i < ROWS; i++) {
          const { z, ties } = armInput(a.id, i)
          const o = forward(z, ties, strength)
          WORDS.forEach((_, w) => shifts[w].push(o.logits[w] - base.logits[w]))
        }
        const rs = shifts.map((s) => Math.abs(pearson(s, W.state)))
        return { id: a.id, label: a.label, r: a.id === "off" ? 0 : Math.max(...rs) }
      }),
    [strength, base],
  )

  const topOff = base.probs.indexOf(Math.max(...base.probs))
  const topOn = cur.probs.indexOf(Math.max(...cur.probs))
  const moved = cur.probs.reduce((a, p, i) => a + Math.abs(p - base.probs[i]), 0) / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a gain write on MLP neurons, and its controls · toy model</span>
      </div>

      <div className="flex flex-wrap gap-1 px-4 pt-3">
        {ARMS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setArm(a.id)}
            aria-pressed={arm === a.id}
            title={a.note}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              arm === a.id
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[10px] text-muted-foreground">
            next word, this row · {ARMS.find((a) => a.id === arm)?.note}
          </div>
          <div className="space-y-1.5">
            {WORDS.map((w, i) => (
              <div key={w} className="grid grid-cols-[3.5rem_1fr_3rem] items-center gap-2 font-mono text-[11px]">
                <span className={cn(i === topOn && "font-semibold text-foreground", i !== topOn && "text-muted-foreground")}>{w}</span>
                <div className="relative h-3 rounded bg-muted/30">
                  <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${(base.probs[i] * 100).toFixed(1)}%`, background: OFF, opacity: 0.45 }} />
                  <div className="absolute inset-y-[3px] left-0 rounded" style={{ width: `${(cur.probs[i] * 100).toFixed(1)}%`, background: ACC }} />
                </div>
                <span className="text-right">{(cur.probs[i] * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            grey: frozen model · orange: with this arm · probability moved {(moved * 100).toFixed(0)}%
            {topOn !== topOff ? " · top word changed" : " · top word unchanged"}
          </p>
        </div>

        <div>
          <div className="mb-2 font-mono text-[10px] text-muted-foreground">
            over {ROWS} rows: how well the output tracks each row&apos;s own state (|r|)
          </div>
          <div className="space-y-1.5">
            {carry.map((c) => (
              <div key={c.id} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-2 font-mono text-[11px]">
                <span className={cn(c.id === arm ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
                <div className="h-3 rounded bg-muted/30">
                  <div className="h-3 rounded" style={{ width: `${(c.r * 100).toFixed(1)}%`, background: c.id === "culture" ? ACC : OFF }} />
                </div>
                <span className="text-right">{c.r.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Random ties carry the row too. What a learned adapter has to show is the gap above them.
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          <span>
            recorded row: <b className="text-foreground">{row + 1}</b> of {ROWS}
          </span>
          <Range min={0} max={ROWS - 1} value={row} onChange={(e) => setRow(Number(e.target.value))} accent={ACC} />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground">
          <span>
            write strength: <b className="text-foreground">{strengthPct}%</b>
          </span>
          <Range min={0} max={200} value={strengthPct} onChange={(e) => setStrengthPct(Number(e.target.value))} accent={ACC} />
        </label>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Illustrative. Gain on each MLP neuron&apos;s activation, g = tanh(strength · Σ ties · z), before down_proj, in a toy with 7
        electrodes, 16 neurons and 6 words. Every arm except &ldquo;no write&rdquo; moves the words, so &ldquo;the culture
        changed N word choices&rdquo; proves nothing on its own. The shuffled arm moves them as much and tracks only the noise floor.
      </figcaption>
    </figure>
  )
}
