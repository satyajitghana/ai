"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { PARAMS } from "./data"

// How each Open d1 model turns one request into forward passes and answers,
// following the shipped code (d1-3B: runner.py, hybrid.py, prompt.py;
// d1-omni-600M: modeling_d1.py, encoder.py, prompt.py). Token counts are
// illustrative: a question with its options is taken as 40 tokens, a 384 px
// image as 144 prefix positions (12 x 12 after the 2 x 2 unshuffle, both
// models), audio as one position per 80 ms. Parameter counts are measured
// from the safetensors headers.

type Model = "d13b" | "omni"
type Media = "text" | "image" | "audio"

const Q_TOKENS = 40
const IMAGE_POS = 144
const OMNI_IMAGE_TEXT = 896 // config.json image_text_length: state + question cut to this with images

function m(n: number): string {
  return `${(n / 1e6).toFixed(0)}M`
}

type Seg = { label: string; n: number; tone: "media" | "state" | "q" }

function plan(model: Model, media: Media, nq: number, state: number, audioSec: number) {
  const prefix = media === "image" ? IMAGE_POS : media === "audio" ? Math.round((audioSec * 1000) / 80) : 0
  const rows: Seg[][] = []
  let note = ""
  if (model === "d13b") {
    // the state (and its image) is the trunk, read once; each question is a branch after it
    const trunk: Seg[] = []
    if (prefix) trunk.push({ label: "image", n: prefix, tone: "media" })
    trunk.push({ label: "state", n: state, tone: "state" })
    const branches: Seg[] = Array.from({ length: nq }, (_, i) => ({ label: `q${i + 1}`, n: Q_TOKENS, tone: "q" }))
    rows.push([...trunk, ...branches])
    note =
      nq === 1
        ? "One question: one plain causal pass, logits kept at the last position only."
        : "One tree: the state is the trunk, read once; every question is a branch that attends to the trunk and to itself, never to another question."
  } else {
    let s = state
    if (media === "image" && s + Q_TOKENS > OMNI_IMAGE_TEXT) s = Math.max(0, OMNI_IMAGE_TEXT - Q_TOKENS)
    for (let i = 0; i < nq; i++) {
      const row: Seg[] = []
      if (prefix) row.push({ label: media, n: prefix, tone: "media" })
      row.push({ label: "state", n: s, tone: "state" })
      row.push({ label: `q${i + 1}`, n: Q_TOKENS, tone: "q" })
      rows.push(row)
    }
    note =
      "One row per question: the encoder is bidirectional, so the state's hidden states depend on the question after it and cannot be shared. The image or audio encoder still runs once."
    if (media === "image" && s < state) note += ` With an image, state and question are cut to ${OMNI_IMAGE_TEXT} tokens.`
  }
  const read = rows.reduce((a, r) => a + r.reduce((b, x) => b + x.n, 0), 0)
  return { rows, read, note }
}

const TONE: Record<Seg["tone"], string> = {
  media: "bg-fuchsia-500/50",
  state: "bg-sky-600/60",
  q: "bg-amber-500/70",
}

export function ReadoutCompare() {
  const [model, setModel] = useState<Model>("d13b")
  const [media, setMedia] = useState<Media>("text")
  const [nq, setNq] = useState(3)
  const [state, setState] = useState(400)
  const [audioSec, setAudioSec] = useState(10)

  const effMedia: Media = model === "d13b" && media === "audio" ? "text" : media
  const { rows, read, note } = plan(model, effMedia, nq, state, audioSec)
  const other = plan(model === "d13b" ? "omni" : "d13b", effMedia === "audio" ? "text" : effMedia, nq, state, audioSec)
  const widest = Math.max(...rows.map((r) => r.reduce((a, x) => a + x.n, 0)), 1)

  const p = model === "d13b" ? PARAMS.d13b : PARAMS.omni
  const active =
    model === "d13b"
      ? [
          { label: "language model", n: PARAMS.d13b.language, on: true },
          { label: "vision tower + projector", n: PARAMS.d13b.vision + PARAMS.d13b.projector, on: effMedia === "image" },
        ]
      : [
          { label: "encoder trunk", n: PARAMS.omni.trunk, on: true },
          { label: "decision head", n: PARAMS.omni.head, on: true },
          { label: "vision tower + projector", n: PARAMS.omni.vision, on: effMedia === "image" },
          { label: "audio encoder + adapter", n: PARAMS.omni.audio, on: effMedia === "audio" },
        ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        from the shipped code: how one request becomes passes, and where the answer is read
      </div>

      <div className="grid gap-3 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Model">
          {(
            [
              ["d13b", "d1-3B (causal, LM head)"],
              ["omni", "d1-omni-600M (encoder, new head)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setModel(id)}
              aria-pressed={model === id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                model === id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Input">
          {(["text", "image", "audio"] as const).map((x) => {
            const disabled = model === "d13b" && x === "audio"
            return (
              <button
                key={x}
                type="button"
                disabled={disabled}
                onClick={() => setMedia(x)}
                aria-pressed={effMedia === x}
                className={cn(
                  "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                  effMedia === x ? "bg-sky-600 text-white" : !disabled && "hover:bg-muted"
                )}
              >
                {x === "text" ? "text only" : `text + ${x}`}
              </button>
            )
          })}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 font-mono text-[11px]">
            <span>
              questions: <strong>{nq}</strong>
            </span>
            <Range min={1} max={4} step={1} value={nq} onChange={(e) => setNq(Number(e.target.value))} aria-label="Questions" />
          </label>
          <label className="grid gap-1 font-mono text-[11px]">
            <span>
              state: <strong>{state} tokens</strong>
            </span>
            <Range min={50} max={3400} step={50} value={state} onChange={(e) => setState(Number(e.target.value))} aria-label="State tokens" />
          </label>
          {effMedia === "audio" ? (
            <label className="grid gap-1 font-mono text-[11px]">
              <span>
                clip: <strong>{audioSec} s</strong> (cut at 30 s)
              </span>
              <Range min={1} max={30} step={1} value={audioSec} onChange={(e) => setAudioSec(Number(e.target.value))} aria-label="Audio seconds" />
            </label>
          ) : null}
        </div>
      </div>

      <div className="grid gap-2 p-3">
        <p className="m-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          positions the language trunk reads ({rows.length === 1 ? "one sequence" : `${rows.length} sequences`})
        </p>
        {rows.map((r, i) => (
          <div key={i} className="flex h-5 w-full overflow-hidden rounded-sm bg-muted">
            {r.map((s, j) => (
              <div
                key={j}
                className={cn("flex items-center justify-center overflow-hidden border-r border-background font-mono text-[9px]", TONE[s.tone])}
                style={{ width: `${((s.n / widest) * 100).toFixed(3)}%` }}
                title={`${s.label}: ${s.n}`}
              >
                {s.n / widest > 0.06 ? s.label : ""}
              </div>
            ))}
          </div>
        ))}
        <p className="m-0 font-mono text-[11px]">
          <strong>{read.toLocaleString("en-US")}</strong> positions read
          <span className="text-muted-foreground">
            {" "}
            · the other model would read {other.read.toLocaleString("en-US")} for the same request
            {effMedia === "audio" ? " as text only" : ""}
          </span>
        </p>
        <p className="m-0 font-mono text-[10px] text-muted-foreground">{note}</p>
      </div>

      <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
        <div>
          <p className="m-0 mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            where the answer comes from
          </p>
          {model === "d13b" ? (
            <ol className="m-0 grid list-decimal gap-0.5 pl-4 font-mono text-[10px]">
              <li>logits over all 128,000 tokens at each question&apos;s last position</li>
              <li>keep only the option codes: yes/Yes/YES vs no/No/NO, A, B, C… or the digits 0-9</li>
              <li>each option scores its best spelling (max)</li>
              <li>softmax over the options; the shipped wrapper applies no temperature</li>
            </ol>
          ) : (
            <ol className="m-0 grid list-decimal gap-0.5 pl-4 font-mono text-[10px]">
              <li>add a question-type embedding (choice, score or yes/no) to every text position</li>
              <li>two more transformer layers over the text positions</li>
              <li>one shared MLP scores the hidden state at each option&apos;s mask marker</li>
              <li>
                text only: divide by a temperature fitted per type and option count; then softmax
              </li>
            </ol>
          )}
        </div>
        <div>
          <p className="m-0 mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
            weights in play ({m(p.total)} on disk)
          </p>
          <div className="grid gap-1">
            {active.map((a) => (
              <div key={a.label} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-2 font-mono text-[10px]">
                <span className={cn("text-right", a.on ? "" : "text-muted-foreground line-through")}>{a.label}</span>
                <div className="h-2.5 overflow-hidden rounded-sm bg-muted">
                  <div
                    className={cn("h-full", a.on ? "bg-emerald-600/70" : "bg-muted-foreground/20")}
                    style={{ width: `${((a.n / p.total) * 100).toFixed(2)}%` }}
                  />
                </div>
                <span className="text-right">{m(a.n)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Token counts are illustrative (40 tokens a question, 144 positions an image, one per 80 ms of
        audio); the structure is the shipped code&apos;s. d1-3B shares the state across questions,
        d1-omni-600M re-reads it per question, and the gap grows with both.
      </figcaption>
    </figure>
  )
}
