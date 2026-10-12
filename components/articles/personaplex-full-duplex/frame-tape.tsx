"use client"

import { useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// One PersonaPlex session as the model sees it: 17 token streams, one column
// per 80 ms Mimi frame. Built from the inference code at NVIDIA/personaplex
// 3428dfd:
//   - stream layout and delays: moshi/moshi/models/loaders.py, _lm_kwargs
//     ("delays": text 0, agent semantic 0, agent acoustic 1, user semantic 0,
//     user acoustic 1; n_q 16, dep_q 16)
//   - prompt phases: LMGen.step_system_prompts in moshi/moshi/models/lm.py
//     (voice prompt on the agent audio with text pad, 0.5 s = 6 frames of
//     silence, text prompt one token per frame with silent agent audio, 6 more
//     frames of silence; the user channel carries 440 Hz sine tokens throughout)
//   - the text prompt is the README's minimal prompt wrapped by
//     wrap_with_system_tags and tokenized with the shared SentencePiece model
//     (13 tokens; "<system>" is plain text, three pieces)
// The voice prompt and the two pauses are drawn shortened (4 of 51 frames for
// NATF2, 2 of 6 for each pause). The conversation is a scripted illustration,
// not a recording: which frame the model backchannels or stops on is invented
// to show the mechanism; the interruption takes three frames, about the
// released checkpoint's reported 0.240 s.

type Cell = "voice" | "silence" | "sine" | "speech" | "bc"

type Col = {
  phase: "voice" | "pause" | "text" | "talk"
  text: string // agent text token, "" = PAD
  agent: Cell // agent semantic codebook at this frame
  user: Cell // user semantic codebook at this frame
  note: string
  ellipsis?: boolean
}

const PAD = ""

function talk(text: string, agent: Cell, user: Cell, note: string): Col {
  return { phase: "talk", text, agent, user, note }
}

const PROMPT_TOKENS = ["▁<", "system", ">", "▁You", "▁enjoy", "▁having", "▁a", "▁good", "▁conversation", ".", "▁<", "system", ">"]

const COLS: Col[] = [
  ...[0, 1, 2, 3].map(
    (i): Col => ({
      phase: "voice",
      text: PAD,
      agent: "voice",
      user: "sine",
      ellipsis: i === 2,
      note: "Voice prompt. A few seconds of the target speaker are forced onto the agent's own audio stream, with the text stream padded. The model hears itself 'say' them. The user channel carries a 440 Hz sine, which means: nobody is talking to you yet.",
    }),
  ),
  ...[0, 1].map(
    (i): Col => ({
      phase: "pause",
      text: PAD,
      agent: "silence",
      user: "sine",
      ellipsis: i === 0,
      note: "Pause. Six frames (0.5 s) of agent silence, text padded, sine on the user channel. A spacer between the voice and the instructions.",
    }),
  ),
  ...PROMPT_TOKENS.map(
    (t): Col => ({
      phase: "text",
      text: t,
      agent: "silence",
      user: "sine",
      note: "Text prompt. One SentencePiece token per frame is forced onto the agent's text stream while its audio stays silent. The <system> tags are ordinary text, three pieces each.",
    }),
  ),
  ...[0, 1].map(
    (i): Col => ({
      phase: "pause",
      text: PAD,
      agent: "silence",
      user: "sine",
      ellipsis: i === 0,
      note: "Second pause, then the microphone opens. Everything to the left is in the KV cache now; with a preset voice it is even replayed from cached embeddings instead of re-encoded.",
    }),
  ),
  talk(PAD, "silence", "speech", "The user starts talking. Their audio is encoded by Mimi and written onto the user stream. The model samples its own frame anyway: pad text, silent audio."),
  talk(PAD, "silence", "speech", "Still listening. 'Listening' is not a mode: every 80 ms the model predicts its own next frame, and right now the likeliest frame is silence."),
  talk(PAD, "silence", "speech", "Nothing in the code decides who holds the floor. There is no voice activity detector between the microphone and the model."),
  talk(PAD, "silence", "speech", "The user stream's acoustic codebooks lag its semantic one by a frame, the same delay the agent's stream has."),
  talk("▁yeah", "bc", "speech", "A backchannel. Mid-sentence, the text head samples 'yeah' and the audio follows. Nothing interrupted anything: a short agent utterance overlapping the user is just a likely continuation in two-channel phone data."),
  talk(PAD, "bc", "speech", "The backchannel's audio finishes while the user keeps going. Both streams are live in the same frame: overlap is representable, which a turn-based pipeline cannot express."),
  talk(PAD, "silence", "speech", "Back to silence. The user never stopped."),
  talk(PAD, "silence", "silence", "The user pauses mid-thought. A cascade's VAD would see silence and start the clock."),
  talk(PAD, "silence", "silence", "The model keeps sampling silence. Whether it waits here is learned behaviour, measured by the benchmark's pause-handling score, not a timeout."),
  talk(PAD, "silence", "silence", "Still waiting. This is where the released checkpoint gets it wrong roughly 36 to 43% of the time on Full-Duplex-Bench's pause sets."),
  talk(PAD, "silence", "speech", "The user resumes."),
  talk(PAD, "silence", "speech", "Listening."),
  talk(PAD, "silence", "speech", "Listening."),
  talk(PAD, "silence", "silence", "The user stops for real."),
  talk("▁Oh", "speech", "silence", "Turn taken. The text token comes first (the inner monologue), the first audio codebook is sampled in the same step conditioned on it, and the other seven arrive a frame later."),
  talk("▁that", "speech", "silence", "All eight codebooks of the previous frame exist now, so Mimi can decode it and the first sound leaves. One frame of acoustic delay, on top of the 80 ms it takes to fill an input frame: that is the 160 ms floor."),
  talk("'s", "speech", "silence", "Speaking. Text runs a little ahead of the audio it describes, then pads while the audio catches up."),
  talk(PAD, "speech", "silence", "Speaking. Pads fill the gaps between words on the text stream."),
  talk("▁great", "speech", "silence", "Speaking."),
  talk(PAD, "speech", "speech", "The user barges in. Their audio lands on the user stream while the agent is mid-word."),
  talk(PAD, "speech", "speech", "The agent's next frames are now conditioned on overlapping speech. Its own audio is still on its way out."),
  talk(PAD, "speech", "speech", "Still overlapping."),
  talk(PAD, "silence", "speech", "The model samples silence and yields. Three frames after the barge-in, about the 0.240 s the released checkpoint reports for user interruption."),
  talk(PAD, "silence", "speech", "Listening again. The last frames of acoustic tokens drain through the one-frame delay."),
  talk(PAD, "silence", "speech", "Listening."),
]

const FRAME_MS = 80
const CW = 36

const PHASE_LABEL: Record<Col["phase"], string> = {
  voice: "voice prompt",
  pause: "pause",
  text: "text prompt",
  talk: "conversation",
}

const FILL: Record<Cell, string> = {
  voice: "oklch(0.62 0.13 250)",
  silence: "oklch(0.9 0.02 250)",
  sine: "oklch(0.78 0.12 150)",
  speech: "oklch(0.6 0.15 30)",
  bc: "oklch(0.72 0.15 75)",
}

const CELL_NAME: Record<Cell, string> = {
  voice: "speaker sample",
  silence: "silence",
  sine: "440 Hz sine",
  speech: "speech",
  bc: "backchannel",
}

const firstTalk = COLS.findIndex((c) => c.phase === "talk")

export function FrameTape() {
  const [i, setI] = useState(firstTalk + 4)
  const scroller = useRef<HTMLDivElement>(null)
  const col = COLS[i]
  const prev = i > 0 ? COLS[i - 1] : null
  const inTalk = col.phase === "talk"

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const target = 132 + i * CW - el.clientWidth / 2
    el.scrollLeft = Math.max(0, target)
  }, [i])

  const rows: { label: string; sub: string; cell: (c: Col, k: number) => Cell | "text"; agent: boolean }[] = [
    { label: "agent text", sub: "1 stream, delay 0", cell: () => "text", agent: true },
    { label: "agent audio", sub: "codebook 1, delay 0", cell: (c) => c.agent, agent: true },
    { label: "agent audio", sub: "codebooks 2-8, delay 1", cell: (_c, k) => (k > 0 ? COLS[k - 1].agent : "silence"), agent: true },
    { label: "user audio", sub: "codebook 1, delay 0", cell: (c) => c.user, agent: false },
    { label: "user audio", sub: "codebooks 2-8, delay 1", cell: (_c, k) => (k > 0 ? COLS[k - 1].user : "sine"), agent: false },
  ]

  const tMs = inTalk ? (i - firstTalk) * FRAME_MS : null
  const outgoing = inTalk && prev && prev.phase === "talk" ? prev.agent : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">17 streams, one column every 80 ms</span>
        <span className="font-mono text-[10px] text-muted-foreground">layout and prompt phases: lm.py, loaders.py at 3428dfd</span>
      </div>

      <div ref={scroller} className="overflow-x-auto px-3 pt-3 sm:px-4">
        <div style={{ width: 132 + COLS.length * CW }}>
          <div className="flex">
            <div style={{ width: 132 }} />
            {COLS.map((c, k) => {
              const startsPhase = k === 0 || COLS[k - 1].phase !== c.phase
              return (
                <div key={k} style={{ width: CW }} className="h-4 truncate font-mono text-[9px] text-muted-foreground">
                  {startsPhase ? PHASE_LABEL[c.phase] : ""}
                </div>
              )
            })}
          </div>
          {rows.map((r, ri) => (
            <div key={ri} className="flex items-center">
              <div style={{ width: 132 }} className="pr-2 leading-tight">
                <div className={`font-mono text-[10px] ${r.agent ? "text-foreground" : "text-muted-foreground"}`}>{r.label}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{r.sub}</div>
              </div>
              {COLS.map((c, k) => {
                const kind = r.cell(c, k)
                const sel = k === i
                const forced = !r.agent || c.phase !== "talk"
                if (kind === "text") {
                  const t = c.text === PAD ? "pad" : c.text.replace("▁", "·")
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setI(k)}
                      aria-label={`frame ${k}`}
                      style={{ width: CW - 2, marginRight: 2 }}
                      className={`my-0.5 h-7 truncate rounded-sm border px-0.5 font-mono text-[9px] ${
                        c.text === PAD ? "text-muted-foreground/60" : "bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-50"
                      } ${forced ? "border-dashed border-foreground/40" : "border-transparent"} ${sel ? "ring-2 ring-foreground" : ""}`}
                    >
                      {c.ellipsis ? "…" : t}
                    </button>
                  )
                }
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setI(k)}
                    aria-label={`frame ${k}: ${CELL_NAME[kind]}`}
                    style={{ width: CW - 2, marginRight: 2, background: FILL[kind] }}
                    className={`my-0.5 h-7 rounded-sm border ${forced ? "border-dashed border-foreground/50" : "border-transparent"} ${
                      sel ? "ring-2 ring-foreground" : ""
                    } ${c.ellipsis ? "opacity-50" : ""}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <Range min={0} max={COLS.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="frame" className="w-full" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            {PHASE_LABEL[col.phase]}
            {tMs !== null ? ` · t = ${tMs} ms` : " · prefill, before the microphone opens"}
          </span>
          <span>agent rows: {inTalk ? "sampled by the model" : "forced (dashed)"}</span>
          <span>user rows: {col.phase === "talk" ? "from the microphone (dashed)" : "forced sine (dashed)"}</span>
          {outgoing ? <span>leaving the speaker now: the previous frame, {CELL_NAME[outgoing]}</span> : null}
        </div>
        <p className="text-sm leading-relaxed">{col.note}</p>
        <div className="flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(FILL) as Cell[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FILL[k] }} />
              {CELL_NAME[k]}
            </span>
          ))}
          <span>dashed border = provided, not sampled</span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Stream layout, delays and prompt phases are read from the inference code. The conversation is a scripted illustration of the mechanism, not a recording; the voice prompt and the pauses are drawn shortened.
      </figcaption>
    </figure>
  )
}
