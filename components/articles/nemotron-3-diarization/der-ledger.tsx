"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The DER widget. A made-up 60-second, three-speaker conversation with three
// overlaps, scored the way NIST md-eval (and NeMo's scorer, which follows it)
// scores a diarization: frame by frame, count reference speakers N_ref,
// hypothesis speakers N_hyp and correctly-labelled speakers N_ok, then
//
//   miss  += max(0, N_ref - N_hyp)
//   fa    += max(0, N_hyp - N_ref)
//   conf  += min(N_ref, N_hyp) - N_ok
//   DER    = (miss + fa + conf) / sum(N_ref)
//
// with overlap scored and no collar, which is how the model card scores
// DIHARD III, AMI, AliMeeting and NOTSOFAR1. The denominator is speaker-time,
// not wall-clock time: an overlapped second counts twice.
//
// The hypothesis is built from the reference by three deterministic edits the
// reader controls, plus one switch that turns it into a one-speaker-per-frame
// system (what a VAD -> embeddings -> clustering cascade emits by construction).
// The edits never touch the same cell, so each slider adds exactly what it
// says. A real scorer first solves an assignment between hypothesis and
// reference speakers; here the hypothesis channels are built aligned to the
// reference, so the identity mapping is already the optimal one.
//
// Everything is integer frame counts times 0.5 s: no transcendental maths, so
// the server and client render identical SVG.

const FRAME = 0.5 // seconds per frame
const T = 120 // 60 s
const SPK = ["A", "B", "C"] as const
type Spk = 0 | 1 | 2

const COLOR: Record<Spk, string> = {
  0: "oklch(0.62 0.15 250)",
  1: "oklch(0.64 0.14 160)",
  2: "oklch(0.72 0.14 75)",
}
const MISS = "oklch(0.60 0.21 25)"
const FA = "oklch(0.64 0.20 340)"
const CONF = "oklch(0.56 0.19 295)"

// Reference turns, seconds. Overlaps: A/B 17-20, A/B 48-50, B/C 52-56.
const REF: { spk: Spk; s: number; e: number }[] = [
  { spk: 0, s: 2, e: 20 },
  { spk: 1, s: 17, e: 30 },
  { spk: 2, s: 32, e: 36 },
  { spk: 0, s: 38, e: 50 },
  { spk: 1, s: 48, e: 58 },
  { spk: 2, s: 52, e: 56 },
]

const f = (sec: number) => Math.round(sec / FRAME)

function buildRef(): boolean[][] {
  const g = SPK.map(() => Array<boolean>(T).fill(false))
  for (const r of REF) for (let t = f(r.s); t < f(r.e); t++) g[r.spk][t] = true
  return g
}
const REF_GRID = buildRef()
const REF_SPEAKER_TIME =
  REF_GRID.reduce((a, row) => a + row.filter(Boolean).length, 0) * FRAME

// Speaker who started talking first, among those active at frame t: the one a
// single-label system keeps when two people talk at once.
const TURN_START: number[][] = SPK.map((_, s) => {
  const out = Array<number>(T).fill(-1)
  for (const r of REF)
    if (r.spk === s) for (let t = f(r.s); t < f(r.e); t++) out[t] = f(r.s)
  return out
})

// Cells the "miss" slider drops: the last frames of five turns, round-robin,
// so every speaker gets clipped a little. (spk, frame)
const MISS_ORDER: [Spk, number][] = (() => {
  const turns: [Spk, number][] = [
    [0, f(20)],
    [1, f(30)],
    [2, f(36)],
    [0, f(50)],
    [1, f(58)],
  ]
  const out: [Spk, number][] = []
  for (let depth = 1; out.length < 12; depth++)
    for (const [s, end] of turns) if (out.length < 12) out.push([s, end - depth])
  return out
})()

// Cells the "false alarm" slider adds: speakers bleeding into the silences
// that border their turns. (spk, frame)
const FA_ORDER: [Spk, number][] = (() => {
  const gaps: { spk: Spk; from: number; dir: 1 | -1 }[] = [
    { spk: 0, from: f(2) - 1, dir: -1 }, // A starts early, into 0-2 s
    { spk: 1, from: f(30), dir: 1 }, // B lingers into 30-32 s
    { spk: 2, from: f(36), dir: 1 }, // C lingers into 36-38 s
    { spk: 1, from: f(58), dir: 1 }, // B lingers into 58-60 s
  ]
  const out: [Spk, number][] = []
  for (let depth = 0; out.length < 12; depth++)
    for (const g of gaps) if (out.length < 12) out.push([g.spk, g.from + g.dir * depth])
  return out
})()

// Cells the "confusion" slider relabels: single-speaker stretches given to the
// wrong channel. C's short turn goes to A first, the classic failure: a brief
// interjection absorbed by the dominant speaker. (true spk, frame, given to)
const CONF_ORDER: [Spk, number, Spk][] = (() => {
  const blocks: { spk: Spk; at: number; to: Spk }[] = [
    { spk: 2, at: f(32), to: 0 },
    { spk: 0, at: f(10), to: 1 },
    { spk: 1, at: f(23), to: 0 },
  ]
  const out: [Spk, number, Spk][] = []
  for (let depth = 0; out.length < 12; depth++)
    for (const b of blocks) if (out.length < 12) out.push([b.spk, b.at + depth, b.to])
  return out
})()

type Kind = "ok" | "miss" | "fa" | "conf" | "none"

function score(missS: number, faS: number, confS: number, singleLabel: boolean) {
  const hyp = REF_GRID.map((row) => row.slice())

  if (singleLabel) {
    for (let t = 0; t < T; t++) {
      const on = ([0, 1, 2] as Spk[]).filter((s) => REF_GRID[s][t])
      if (on.length < 2) continue
      const keep = on.reduce((a, b) => (TURN_START[b][t] < TURN_START[a][t] ? b : a))
      for (const s of on) if (s !== keep) hyp[s][t] = false
    }
  }
  for (const [s, t] of MISS_ORDER.slice(0, f(missS))) hyp[s][t] = false
  for (const [s, t, to] of CONF_ORDER.slice(0, f(confS))) {
    hyp[s][t] = false
    hyp[to][t] = true
  }
  for (const [s, t] of FA_ORDER.slice(0, f(faS))) hyp[s][t] = true

  let miss = 0
  let fa = 0
  let conf = 0
  const kind: Kind[] = []
  for (let t = 0; t < T; t++) {
    let nRef = 0
    let nHyp = 0
    let nOk = 0
    for (let s = 0; s < 3; s++) {
      if (REF_GRID[s][t]) nRef++
      if (hyp[s][t]) nHyp++
      if (REF_GRID[s][t] && hyp[s][t]) nOk++
    }
    const m = Math.max(0, nRef - nHyp)
    const a = Math.max(0, nHyp - nRef)
    const c = Math.min(nRef, nHyp) - nOk
    miss += m
    fa += a
    conf += c
    kind.push(m > 0 ? "miss" : a > 0 ? "fa" : c > 0 ? "conf" : nRef > 0 ? "ok" : "none")
  }
  return {
    hyp,
    kind,
    miss: miss * FRAME,
    fa: fa * FRAME,
    conf: conf * FRAME,
  }
}

const W = 680
const LEFT = 64
const RIGHT = 8
const ROW = 14
const GAP = 5
const X = (t: number) => LEFT + (t / T) * (W - LEFT - RIGHT)
const FW = (W - LEFT - RIGHT) / T

const Y_REF = 26
const Y_HYP = Y_REF + 3 * (ROW + GAP) + 22
const Y_ERR = Y_HYP + 3 * (ROW + GAP) + 10
const H = Y_ERR + ROW + 26

function runs(row: boolean[]) {
  const out: [number, number][] = []
  let start = -1
  for (let t = 0; t <= row.length; t++) {
    const on = t < row.length && row[t]
    if (on && start < 0) start = t
    if (!on && start >= 0) {
      out.push([start, t])
      start = -1
    }
  }
  return out
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const secs = (x: number) => `${x.toFixed(1)} s`

export function DerLedger() {
  const [missS, setMiss] = useState(0)
  const [faS, setFa] = useState(0)
  const [confS, setConf] = useState(0)
  const [single, setSingle] = useState(false)

  const r = score(missS, faS, confS, single)
  const der = (r.miss + r.fa + r.conf) / REF_SPEAKER_TIME

  const sliders: {
    label: string
    v: number
    set: (n: number) => void
    color: string
    hint: string
  }[] = [
    { label: "missed speech", v: missS, set: setMiss, color: MISS, hint: "clip the ends of turns" },
    { label: "false alarm", v: faS, set: setFa, color: FA, hint: "voices bleed into silence" },
    { label: "speaker confusion", v: confS, set: setConf, color: CONF, hint: "right time, wrong channel" },
  ]

  // The stacked bar is scaled to the whole reference speaker time, so its
  // filled length *is* the DER.
  const barW = (x: number) => (x / REF_SPEAKER_TIME) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>who spoke when → three kinds of error → one DER</span>
        <span className="text-muted-foreground/60">toy conversation · overlap scored · no collar</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reference and hypothesis speaker timelines. Missed ${secs(r.miss)}, false alarm ${secs(r.fa)}, confusion ${secs(r.conf)}, over ${secs(REF_SPEAKER_TIME)} of reference speaker time: DER ${pct(der)}.`}
        >
          <text x={0} y={Y_REF - 8} className="fill-muted-foreground font-mono" fontSize={9}>
            reference
          </text>
          <text x={0} y={Y_HYP - 8} className="fill-muted-foreground font-mono" fontSize={9}>
            system
          </text>

          {[0, 10, 20, 30, 40, 50, 60].map((s) => (
            <g key={s}>
              <line
                x1={X(f(s))}
                x2={X(f(s))}
                y1={Y_REF - 4}
                y2={Y_ERR + ROW}
                stroke="var(--border)"
                strokeWidth={0.6}
              />
              <text
                x={X(f(s))}
                y={H - 12}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {s}s
              </text>
            </g>
          ))}

          {([0, 1, 2] as Spk[]).map((s) => {
            const yr = Y_REF + s * (ROW + GAP)
            const yh = Y_HYP + s * (ROW + GAP)
            return (
              <g key={s}>
                <text x={LEFT - 8} y={yr + ROW - 3} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>
                  {SPK[s]}
                </text>
                <rect x={LEFT} y={yr} width={W - LEFT - RIGHT} height={ROW} rx={3} fill="var(--muted)" opacity={0.5} />
                {runs(REF_GRID[s]).map(([a, b]) => (
                  <rect key={a} x={X(a)} y={yr} width={(b - a) * FW} height={ROW} rx={3} fill={COLOR[s]} />
                ))}

                <text x={LEFT - 8} y={yh + ROW - 3} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>
                  spk {s}
                </text>
                <rect x={LEFT} y={yh} width={W - LEFT - RIGHT} height={ROW} rx={3} fill="var(--muted)" opacity={0.5} />
                {runs(r.hyp[s]).map(([a, b]) => (
                  <rect key={a} x={X(a)} y={yh} width={(b - a) * FW} height={ROW} rx={3} fill={COLOR[s]} opacity={0.85} />
                ))}
              </g>
            )
          })}

          <text x={LEFT - 8} y={Y_ERR + ROW - 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            error
          </text>
          <rect x={LEFT} y={Y_ERR} width={W - LEFT - RIGHT} height={ROW} rx={3} fill="var(--muted)" opacity={0.35} />
          {r.kind.map((k, t) =>
            k === "miss" || k === "fa" || k === "conf" ? (
              <rect
                key={t}
                x={X(t)}
                y={Y_ERR}
                width={FW}
                height={ROW}
                fill={k === "miss" ? MISS : k === "fa" ? FA : CONF}
              />
            ) : null
          )}
        </svg>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {sliders.map((s) => (
            <label key={s.label} className="block">
              <span className="flex items-baseline justify-between font-mono text-[11px]">
                <span style={{ color: s.color }}>{s.label}</span>
                <span className="tabular-nums text-foreground">+{s.v.toFixed(1)} s</span>
              </span>
              <Range
                min={0}
                max={6}
                step={0.5}
                value={s.v}
                onChange={(e) => s.set(Number(e.target.value))}
                className="w-full cursor-pointer"
                accent={s.color}
                aria-label={`${s.label}, seconds`}
              />
              <span className="font-mono text-[10px] text-muted-foreground">{s.hint}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSingle((v) => !v)}
          aria-pressed={single}
          className={cn(
            "mt-3 rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors",
            single ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {single ? "■" : "□"} one speaker per frame (what a clustering cascade emits)
        </button>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">missed</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: MISS }}>
              {secs(r.miss)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">false alarm</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: FA }}>
              {secs(r.fa)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">confusion</div>
            <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: CONF }}>
              {secs(r.conf)}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">
              DER (÷ {REF_SPEAKER_TIME.toFixed(0)} s of speaker time)
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{pct(der)}</div>
          </div>
        </div>

        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted/50" aria-hidden>
          <div style={{ width: `${barW(r.miss)}%`, background: MISS }} />
          <div style={{ width: `${barW(r.fa)}%`, background: FA }} />
          <div style={{ width: `${barW(r.conf)}%`, background: CONF }} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The reference holds {REF_SPEAKER_TIME.toFixed(0)} seconds of speaker time in 60 seconds of audio, because
          three stretches have two people talking at once and each counts twice. Switch on the one-speaker-per-frame
          system and, before any slider moves, it has already lost 9 seconds to overlap: C&rsquo;s second turn sits
          entirely inside B&rsquo;s and vanishes. That is{" "}
          <span className="text-foreground">14.8% DER</span>{" "}
          from the output format alone.
        </p>
      </div>
    </figure>
  )
}
