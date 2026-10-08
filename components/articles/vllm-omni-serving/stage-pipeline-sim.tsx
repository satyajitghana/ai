"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A toy discrete-event model of two ways to serve a multi-model pipeline.
//
//   "stage graph": every stage (and every replica of a stage) is its own worker
//   with its own continuous batch, the way vLLM-Omni deploys Qwen3-Omni
//   (vllm_omni/deploy/qwen3_omni_moe.yaml: thinker on device 0, talker and
//   code2wav on device 1) or GLM-Image (vllm_omni/deploy/glm_image.yaml: AR on
//   device 0, DiT on device 1).
//
//   "one loop": the same models in one worker; every iteration runs each phase
//   that has work, one after the other, so their step times add.
//
// What is taken from the source, not invented:
//   * the chunk schedule on the talker -> code2wav edge: a first chunk of 4
//     codec frames, then 25-frame chunks, each re-sending up to 25 frames of
//     left context (qwen3_omni_moe.yaml:21-23; stage_input_processors/
//     qwen3_omni.py:782-784, "Code2Wav decodes statelessly, so every chunk
//     re-sends up to codec_left_context_frames earlier frames").
//   * 12.5 codec frames per second (the HF config's upsample factors multiply
//     to 1920 samples per frame at 24 kHz).
//   * diffusion runs one job at a time unless step execution is switched on
//     (vllm_omni/diffusion/data.py:1133 step_execution=False, :1139
//     max_num_seqs=1); the CI step-execution recipe uses max-num-seqs 8.
//   * the AR -> DiT edge is a full payload, not a stream (glm_image.yaml:
//     async_chunk: false).
//
// What is NOT from the source: every millisecond. Step costs are made-up round
// numbers shaped like the two regimes (a decode step that barely grows with
// batch, a denoise step that grows almost linearly). The widget says so.

type Preset = "speech" | "image"
type Mode = "graph" | "mono"

interface StageDef {
  key: string
  label: string
  colour: string
  units: number
  prefillMs: number
  maxBatch: number
  // cost of one step for a batch: fixed part + per-item part (+ per-frame for a vocoder)
  baseMs: number
  perItemMs: number
  perFrameMs: number
  stream: boolean
  needUp: (j: number) => number
  frames: (j: number) => number
  replicated: boolean
}

interface Req {
  id: number
  arrive: number
  rep: number
  prog: number[]
  first: (number | null)[]
  last: (number | null)[]
  out: number | null
  done: number | null
}

interface SimResult {
  outMs: number
  e2eMs: number
  perSec: number
  workers: number
  rows: Req[]
  horizon: number
}

const THINK = "oklch(0.62 0.17 300)"
const TALK = "oklch(0.66 0.15 200)"
const WAV = "oklch(0.70 0.16 140)"
const AR = "oklch(0.64 0.16 260)"
const DIT = "oklch(0.68 0.17 50)"
const OUT = "oklch(0.62 0.21 15)"

// Speech workload: a short spoken reply. 60 text tokens, 150 codec frames
// (12 s of audio at 12.5 frames per second).
const T_TOKENS = 60
const F_FRAMES = 150
const FIRST_CHUNK = 4
const CHUNK = 25
const LEFT_CTX = 25
const AUDIO_S = F_FRAMES / 12.5

function speechStages(asyncChunk: boolean): StageDef[] {
  const nChunks = 1 + Math.ceil((F_FRAMES - FIRST_CHUNK) / CHUNK)
  const chunkFrames = (j: number) => {
    if (!asyncChunk) return F_FRAMES
    if (j === 0) return FIRST_CHUNK
    const fresh = Math.min(CHUNK, F_FRAMES - FIRST_CHUNK - (j - 1) * CHUNK)
    const ctx = Math.min(LEFT_CTX, FIRST_CHUNK + (j - 1) * CHUNK)
    return fresh + ctx
  }
  return [
    {
      key: "thinker",
      label: "thinker",
      colour: THINK,
      units: T_TOKENS,
      prefillMs: 45,
      maxBatch: 64,
      baseMs: 14,
      perItemMs: 0.35,
      perFrameMs: 0,
      stream: false,
      needUp: () => 0,
      frames: () => 0,
      replicated: false,
    },
    {
      key: "talker",
      label: "talker",
      colour: TALK,
      units: F_FRAMES,
      prefillMs: 12,
      maxBatch: 64,
      baseMs: 10,
      perItemMs: 0.3,
      perFrameMs: 0,
      stream: asyncChunk,
      // frame j needs the thinker to have produced its share of the text
      needUp: (j) => Math.min(T_TOKENS, Math.ceil(((j + 1) * T_TOKENS) / F_FRAMES)),
      frames: () => 0,
      replicated: true,
    },
    {
      key: "code2wav",
      label: "code2wav",
      colour: WAV,
      units: asyncChunk ? nChunks : 1,
      prefillMs: 0,
      maxBatch: 64,
      baseMs: 4,
      perItemMs: 0,
      perFrameMs: 0.06,
      stream: asyncChunk,
      needUp: (j) => Math.min(F_FRAMES, FIRST_CHUNK + j * CHUNK),
      frames: chunkFrames,
      replicated: true,
    },
  ]
}

function imageStages(stepBatching: boolean): StageDef[] {
  return [
    {
      key: "ar",
      label: "AR prior",
      colour: AR,
      units: 256,
      prefillMs: 20,
      maxBatch: 32,
      baseMs: 12,
      perItemMs: 0.3,
      perFrameMs: 0,
      stream: false,
      needUp: () => 0,
      frames: () => 0,
      replicated: false,
    },
    {
      key: "dit",
      label: "DiT steps",
      colour: DIT,
      units: 20,
      prefillMs: 0,
      maxBatch: stepBatching ? 8 : 1,
      baseMs: 40,
      perItemMs: 22,
      perFrameMs: 0,
      stream: false,
      needUp: () => 0,
      frames: () => 0,
      replicated: true,
    },
  ]
}

function simulate(
  stages: StageDef[],
  mode: Mode,
  C: number,
  replicas: number,
  firstUnitIsOutput: boolean,
  staggerMs: number,
): SimResult {
  const S = stages.length
  const reqs: Req[] = []
  let nextId = 0
  const spawn = (t: number) => {
    const id = nextId++
    reqs.push({
      id,
      arrive: t,
      rep: id % replicas,
      prog: stages.map(() => 0),
      first: stages.map(() => null),
      last: stages.map(() => null),
      out: null,
      done: null,
    })
  }
  // Clients join one after another rather than all at t = 0, so the requests
  // do not march through the stages in lockstep.
  for (let i = 0; i < C; i++) spawn(i * staggerMs)

  const eligible = (r: Req, s: number) => {
    const st = stages[s]
    if (r.prog[s] >= st.units) return false
    if (r.arrive > t) return false
    if (s === 0) return true
    const up = r.prog[s - 1]
    if (up >= stages[s - 1].units) return true
    if (!st.stream) return false
    return up >= st.needUp(r.prog[s])
  }

  const stepCost = (s: number, batch: Req[]) => {
    const st = stages[s]
    let ms = st.baseMs + st.perItemMs * batch.length
    for (const r of batch) {
      if (r.prog[s] === 0) ms += st.prefillMs
      ms += st.perFrameMs * st.frames(r.prog[s])
    }
    return ms
  }

  interface Worker {
    stagesRun: number[]
    rep: number
    busy: boolean
    until: number
    plan: { s: number; batch: Req[] }[]
  }
  const workers: Worker[] = []
  if (mode === "graph") {
    stages.forEach((st, s) => {
      const n = st.replicated ? replicas : 1
      for (let k = 0; k < n; k++) workers.push({ stagesRun: [s], rep: st.replicated ? k : -1, busy: false, until: 0, plan: [] })
    })
  } else {
    workers.push({ stagesRun: stages.map((_, s) => s), rep: -1, busy: false, until: 0, plan: [] })
  }

  const target = Math.max(3 * C, 12)
  let completed = 0
  let t = 0
  let guard = 0
  const doneTimes: number[] = []

  while (completed < target && guard < 400000) {
    guard++
    for (const w of workers) {
      if (w.busy) continue
      const plan: { s: number; batch: Req[] }[] = []
      let cost = 0
      for (const s of w.stagesRun) {
        const batch: Req[] = []
        for (const r of reqs) {
          if (r.done !== null) continue
          if (w.rep >= 0 && r.rep !== w.rep) continue
          if (!eligible(r, s)) continue
          batch.push(r)
          if (batch.length >= stages[s].maxBatch) break
        }
        if (batch.length) {
          plan.push({ s, batch })
          cost += stepCost(s, batch)
        }
      }
      if (plan.length) {
        w.busy = true
        w.until = t + cost
        w.plan = plan
        for (const { s, batch } of plan) for (const r of batch) if (r.first[s] === null) r.first[s] = t
      }
    }
    let nextT = Infinity
    for (const w of workers) if (w.busy && w.until < nextT) nextT = w.until
    for (const r of reqs) if (r.arrive > t && r.arrive < nextT) nextT = r.arrive
    if (nextT === Infinity) break
    t = nextT
    for (const w of workers) {
      if (!w.busy || w.until > t) continue
      w.busy = false
      for (const { s, batch } of w.plan) {
        for (const r of batch) {
          r.prog[s] += 1
          r.last[s] = t
          if (s === S - 1 && r.out === null && (firstUnitIsOutput || r.prog[s] >= stages[s].units)) r.out = t
          if (r.done === null && r.prog.every((p, i) => p >= stages[i].units)) {
            r.done = t
            completed++
            doneTimes.push(t)
            spawn(t)
          }
        }
      }
      w.plan = []
    }
  }

  const finished = reqs.filter((r) => r.done !== null)
  const measured = finished.filter((r) => r.id >= C)
  const pool = measured.length ? measured : finished
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const outMs = mean(pool.map((r) => (r.out ?? 0) - r.arrive))
  const e2eMs = mean(pool.map((r) => (r.done ?? 0) - r.arrive))
  doneTimes.sort((a, b) => a - b)
  const windowStart = doneTimes.length > C ? doneTimes[C - 1] : 0
  const windowEnd = doneTimes.length ? doneTimes[doneTimes.length - 1] : 1
  const counted = doneTimes.length > C ? doneTimes.length - C : doneTimes.length
  const perSec = windowEnd > windowStart ? (counted * 1000) / (windowEnd - windowStart) : 0

  const rows = reqs.filter((r) => r.id < Math.min(6, C))
  const horizon = Math.max(1, ...rows.map((r) => r.done ?? t))
  return { outMs, e2eMs, perSec, workers: workers.length, rows, horizon }
}

function fmtMs(ms: number) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  return `${Math.round(ms)} ms`
}

const Pill = ({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    disabled={disabled}
    className={cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )}
  >
    {children}
  </button>
)

export function StagePipelineSim() {
  const [preset, setPreset] = useState<Preset>("speech")
  const [C, setC] = useState(8)
  const [asyncChunk, setAsyncChunk] = useState(true)
  const [replicas, setReplicas] = useState(1)
  const [stepBatching, setStepBatching] = useState(false)
  const [view, setView] = useState<Mode>("graph")

  const stages = useMemo(
    () => (preset === "speech" ? speechStages(asyncChunk) : imageStages(stepBatching)),
    [preset, asyncChunk, stepBatching],
  )
  const firstUnitIsOutput = preset === "speech"
  const stagger = preset === "speech" ? 120 : 300
  const graph = useMemo(
    () => simulate(stages, "graph", C, replicas, firstUnitIsOutput, stagger),
    [stages, C, replicas, firstUnitIsOutput, stagger],
  )
  const mono = useMemo(
    () => simulate(stages, "mono", C, 1, firstUnitIsOutput, stagger),
    [stages, C, firstUnitIsOutput, stagger],
  )
  const shown = view === "graph" ? graph : mono

  const outLabel = preset === "speech" ? "first audio" : "image ready"
  const unitLabel = preset === "speech" ? "audio-s/s" : "images/s"
  const rate = (r: SimResult) => (preset === "speech" ? r.perSec * AUDIO_S : r.perSec)

  // Timeline geometry
  const W = 700
  const X0 = 64
  const X1 = W - 16
  const ROW = 34
  const H = 30 + shown.rows.length * ROW + 24
  const sx = (ms: number) => X0 + (ms / shown.horizon) * (X1 - X0)
  const laneH = 6
  const ticks = 5

  const metricRows: { label: string; g: string; m: string }[] = [
    { label: `mean time to ${outLabel}`, g: fmtMs(graph.outMs), m: fmtMs(mono.outMs) },
    { label: "mean end-to-end", g: fmtMs(graph.e2eMs), m: fmtMs(mono.e2eMs) },
    { label: `throughput (${unitLabel})`, g: rate(graph).toFixed(2), m: rate(mono).toFixed(2) },
    { label: "workers (GPUs)", g: String(graph.workers), m: String(mono.workers) },
    {
      label: `throughput per worker`,
      g: (rate(graph) / graph.workers).toFixed(2),
      m: (rate(mono) / mono.workers).toFixed(2),
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          stage graph vs one loop · closed loop, C = {C}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">illustrative timings, not measurements</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          <Pill on={preset === "speech"} onClick={() => setPreset("speech")}>
            thinker → talker → code2wav
          </Pill>
          <Pill on={preset === "image"} onClick={() => setPreset("image")}>
            AR → DiT image
          </Pill>
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
          <Pill on={asyncChunk} disabled={preset !== "speech"} onClick={() => setAsyncChunk((v) => !v)}>
            async_chunk
          </Pill>
          <Pill on={stepBatching} disabled={preset !== "image"} onClick={() => setStepBatching((v) => !v)}>
            DiT step batching (max 8)
          </Pill>
          <Pill on={replicas === 2} onClick={() => setReplicas((v) => (v === 2 ? 1 : 2))}>
            {preset === "speech" ? "talker + code2wav ×2" : "DiT ×2"}
          </Pill>
        </div>

        <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="w-28 shrink-0">concurrency {C}</span>
          <Range min={1} max={32} step={1} value={C} onChange={(e) => setC(Number(e.target.value))} aria-label="Concurrency" />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 pr-2 text-left font-normal" />
                <th className="py-1 pr-2 text-right font-normal">stage graph</th>
                <th className="py-1 text-right font-normal">one loop</th>
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr key={row.label} className="border-t border-border/60">
                  <td className="py-1 pr-2 text-muted-foreground">{row.label}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{row.g}</td>
                  <td className="py-1 text-right tabular-nums">{row.m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">timeline of the first requests:</span>
          <Pill on={view === "graph"} onClick={() => setView("graph")}>
            stage graph
          </Pill>
          <Pill on={view === "mono"} onClick={() => setView("mono")}>
            one loop
          </Pill>
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              {`Timeline of the first ${shown.rows.length} requests under the ${view === "graph" ? "stage graph" : "single loop"}. Each row is one request; coloured bars show when each stage was working on it; the red tick marks the ${outLabel}.`}
            </title>
            {Array.from({ length: ticks + 1 }, (_, i) => {
              const ms = (shown.horizon * i) / ticks
              const x = sx(ms)
              return (
                <g key={i}>
                  <line x1={x} x2={x} y1={18} y2={H - 20} stroke="currentColor" strokeOpacity={0.08} />
                  <text x={x} y={H - 6} fontSize={9} textAnchor="middle" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {fmtMs(ms)}
                  </text>
                </g>
              )
            })}
            {stages.map((st, s) => (
              <g key={st.key}>
                <rect x={X0 + s * 120} y={4} width={10} height={6} fill={st.colour} />
                <text x={X0 + s * 120 + 14} y={10} fontSize={9} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                  {st.label}
                </text>
              </g>
            ))}
            <g>
              <line x1={X0 + stages.length * 120 + 4} x2={X0 + stages.length * 120 + 4} y1={3} y2={11} stroke={OUT} strokeWidth={2} />
              <text x={X0 + stages.length * 120 + 10} y={10} fontSize={9} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                {outLabel}
              </text>
            </g>
            {shown.rows.map((r, i) => {
              const y0 = 24 + i * ROW
              return (
                <g key={r.id}>
                  <text x={8} y={y0 + 14} fontSize={9} fill="currentColor" fillOpacity={0.6} fontFamily="ui-monospace, monospace">
                    req {r.id}
                  </text>
                  {stages.map((st, s) => {
                    const a = r.first[s]
                    const b = r.last[s]
                    if (a === null || b === null) return null
                    return (
                      <rect
                        key={st.key}
                        x={sx(a)}
                        y={y0 + 2 + s * (laneH + 2)}
                        width={Math.max(1.5, sx(b) - sx(a))}
                        height={laneH}
                        rx={2}
                        fill={st.colour}
                        fillOpacity={0.85}
                      />
                    )
                  })}
                  {r.out !== null ? (
                    <line x1={sx(r.out)} x2={sx(r.out)} y1={y0} y2={y0 + 26} stroke={OUT} strokeWidth={2} />
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {preset === "speech"
            ? `A ${T_TOKENS}-token reply spoken as ${F_FRAMES} codec frames (${AUDIO_S} s of audio). With async_chunk on, code2wav gets a first chunk of ${FIRST_CHUNK} frames, then ${CHUNK}-frame chunks that each re-send up to ${LEFT_CTX} frames of context, as the shipped Qwen3-Omni deploy does. Off, it waits for the whole utterance.`
            : "A 256-token AR prior, then 20 denoising steps. The AR → DiT edge is a full payload, so the DiT never starts before the AR stage finishes. A decode step barely grows with batch; a denoise step grows almost linearly, so batching steps buys much less."}
        </p>
      </div>
    </figure>
  )
}
