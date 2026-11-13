"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The same scripted exchange played through two systems. Top: a turn-based
// cascade (VAD end-of-speech wait, ASR, LLM first token, TTS first audio),
// whose stage times are the reader's to set. Bottom: a Haru-style full-duplex
// loop on a 133.3 ms frame clock, where the only fixed costs are the frame
// itself and the 65.2 ms per-frame pipeline from Higurashi's M1 Max table.
// How many silent frames the model waits before it speaks is learned
// behaviour, so it is a slider here, not a measurement. The conversation is a
// script, not a recording.

const FRAME = 400 / 3 // ms, 3200 samples at 24 kHz
const PIPE = 65.2 // ms, Higurashi's p50 on an M1 Max, int8, excluding framing
const WIN = 12000 // ms shown
const U_START = 300
const U_END = 2300
const REPLY = 4000 // the planned answer, ms
const EVENT_AT = 1500 // ms into the reply when the user makes a sound
const BC_LEN = 300 // "mm-hm"
const INT_LEN = 1500 // "wait, which one?"
const SECOND = 2000 // the reply after an interruption

const USER = "oklch(0.7 0.14 230)"
const CASC = "oklch(0.7 0.14 60)"
const DUP = "oklch(0.64 0.17 300)"
const STOP = "oklch(0.62 0.2 25)"

type Seg = { s: number; e: number; label: string; tone: string; dashed?: boolean }
type Scenario = "answer" | "backchannel" | "interrupt"

const ceilFrame = (t: number) => Math.ceil(t / FRAME) * FRAME
const ms = (v: number) => `${Math.round(v)} ms`

function userEvents(scn: Scenario, reply: number): Seg[] {
  const out: Seg[] = [{ s: U_START, e: U_END, label: "You: what was the last film you loved?", tone: USER }]
  if (scn === "backchannel") out.push({ s: reply + EVENT_AT, e: reply + EVENT_AT + BC_LEN, label: "mm-hm", tone: USER })
  if (scn === "interrupt") out.push({ s: reply + EVENT_AT, e: reply + EVENT_AT + INT_LEN, label: "wait, which one?", tone: USER })
  return out
}

function cascade(scn: Scenario, vad: number, asr: number, llm: number, tts: number, minSpeech: number, bargeIn: boolean) {
  const turn = vad + asr + llm + tts
  const r = U_END + turn
  const user = userEvents(scn, r)
  const sys: Seg[] = []
  let note = ""
  const ev = user[1]
  if (!ev) {
    sys.push({ s: r, e: r + REPLY, label: "reply", tone: CASC })
    note = "Answers once the stages finish."
  } else if (!bargeIn) {
    sys.push({ s: r, e: r + REPLY, label: "reply (keeps talking)", tone: CASC })
    note =
      scn === "interrupt"
        ? "Barge-in off: it talks straight over you, then has to treat your question as a new turn."
        : "Barge-in off: the mm-hm is ignored, which is right, but an interruption would be too."
  } else if (ev.e - ev.s < minSpeech) {
    sys.push({ s: r, e: r + REPLY, label: "reply", tone: CASC })
    note =
      scn === "interrupt"
        ? "Your interruption is shorter than the VAD's minimum, so it is ignored."
        : "The mm-hm is shorter than the VAD's minimum, so the reply survives. Raise the threshold and interruptions get slower to catch."
  } else {
    const cut = ev.s + minSpeech
    sys.push({ s: r, e: cut, label: "reply", tone: CASC })
    sys.push({ s: cut, e: cut + 1, label: "stop", tone: STOP })
    const r2 = ev.e + turn
    sys.push({ s: r2, e: r2 + SECOND, label: scn === "interrupt" ? "new answer" : "sorry, go on?", tone: CASC })
    note =
      scn === "interrupt"
        ? "Barge-in stops the reply, and the answer to your question waits for a whole new turn."
        : "A false barge-in: your mm-hm stopped the reply, and it restarts after a whole new turn."
  }
  return { r, user, sys, note, turn }
}

function duplex(scn: Scenario, wait: number) {
  const heard = ceilFrame(U_END) // the frame holding your last sound has to finish
  const r = heard + wait * FRAME + PIPE
  const user = userEvents(scn, r)
  const sys: Seg[] = []
  let note = ""
  const ev = user[1]
  if (!ev) {
    sys.push({ s: r, e: r + REPLY, label: "reply", tone: DUP })
    note = "Silence is a prediction like any other: it speaks when it samples the end-of-padding token."
  } else if (scn === "backchannel") {
    sys.push({ s: r, e: r + REPLY, label: "reply (keeps talking)", tone: DUP })
    note = "Your mm-hm is just audio on the user stream; the demos show it carrying on over backchannels."
  } else {
    const cut = ceilFrame(ev.s) + 2 * FRAME + PIPE
    sys.push({ s: r, e: cut, label: "reply", tone: DUP })
    sys.push({ s: cut, e: cut + 1, label: "stop", tone: STOP })
    const r2 = ceilFrame(ev.e) + wait * FRAME + PIPE
    sys.push({ s: r2, e: r2 + SECOND, label: "new answer", tone: DUP })
    note = "It trails off a couple of frames into your interruption (scripted here) and answers after you stop."
  }
  return { r, user, sys, note, heard }
}

const pct = (t: number) => `${(Math.max(0, Math.min(WIN, t)) / WIN) * 100}%`

function Lane({ segs, label }: { segs: Seg[]; label: string }) {
  return (
    <>
      <span className="truncate font-mono text-[10px] text-muted-foreground">{label}</span>
      <div className="relative h-6 rounded-sm bg-muted/30">
        {segs
          .filter((g) => g.s < WIN)
          .map((g) =>
            g.label === "stop" ? (
              <span key={`stop${g.s}`} className="absolute inset-y-0 w-0.5" style={{ left: pct(g.s), background: g.tone }} title="stops" />
            ) : (
              <div
                key={`${g.label}${g.s}`}
                className="absolute inset-y-0 overflow-hidden rounded-sm px-1 font-mono text-[9px] leading-6 text-black/80"
                style={{ left: pct(g.s), width: `calc(${pct(g.e)} - ${pct(g.s)})`, background: g.tone, opacity: 0.88 }}
              >
                <span className="whitespace-nowrap">{g.label}</span>
              </div>
            ),
          )}
      </div>
    </>
  )
}

function Ruler({ frames }: { frames?: boolean }) {
  const secs = Array.from({ length: WIN / 1000 + 1 }, (_, i) => i * 1000)
  const n = Math.floor(WIN / FRAME)
  return (
    <>
      <span className="font-mono text-[10px] text-muted-foreground">{frames ? "frames" : ""}</span>
      <div className="relative h-4">
        {frames &&
          Array.from({ length: n + 1 }, (_, i) => (
            <span key={i} className="absolute top-0 h-1.5 w-px bg-muted-foreground/40" style={{ left: pct(i * FRAME) }} />
          ))}
        {secs.map((t) => (
          <span key={t} className="absolute top-1.5 -translate-x-1/2 font-mono text-[9px] text-muted-foreground" style={{ left: pct(t) }}>
            {t / 1000}s
          </span>
        ))}
      </div>
    </>
  )
}

function Slider({ label, value, min, max, step, onChange, unit = "ms", accent }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  unit?: string
  accent: string
}) {
  return (
    <label className="block font-mono text-[10px] text-muted-foreground">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <span className="text-foreground">
          {value} {unit}
        </span>
      </span>
      <Range min={min} max={max} step={step} value={value} accent={accent} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="mt-1 w-full" />
    </label>
  )
}

export function DuplexTimeline() {
  const [scn, setScn] = useState<Scenario>("answer")
  const [vad, setVad] = useState(500)
  const [asr, setAsr] = useState(150)
  const [llm, setLlm] = useState(300)
  const [tts, setTts] = useState(150)
  const [minSpeech, setMinSpeech] = useState(200)
  const [bargeIn, setBargeIn] = useState(true)
  const [wait, setWait] = useState(1)

  const c = cascade(scn, vad, asr, llm, tts, minSpeech, bargeIn)
  const d = duplex(scn, wait)
  const framing = d.heard - U_END

  const scenarios: [Scenario, string][] = [
    ["answer", "a question"],
    ["backchannel", "a backchannel"],
    ["interrupt", "an interruption"],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one scripted exchange, two ways to hold it</span>
        <span className="font-mono text-[10px] text-muted-foreground">illustrative; stage times are yours</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="scenario">
          {scenarios.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={scn === id}
              onClick={() => setScn(id)}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${scn === id ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px]" style={{ color: CASC }}>
              cascade: VAD, then ASR, LLM, TTS
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              gap after you stop: <span className="text-foreground">{ms(c.r - U_END)}</span>
            </span>
          </div>
          <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1.5">
            <Lane segs={c.user} label="you" />
            <Lane segs={c.sys} label="cascade" />
            <Ruler />
          </div>
          <div className="mt-2 flex h-2 overflow-hidden rounded-sm" aria-label="where the cascade's gap goes">
            {[
              [vad, "oklch(0.72 0.05 60)"],
              [asr, "oklch(0.66 0.1 60)"],
              [llm, "oklch(0.6 0.14 60)"],
              [tts, "oklch(0.54 0.16 60)"],
            ].map(([v, col], i) => (
              <span key={i} style={{ width: `${((v as number) / c.turn) * 100}%`, background: col as string }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Slider label="VAD waits for silence" value={vad} min={100} max={1200} step={50} onChange={setVad} accent={CASC} />
            <Slider label="ASR finalises" value={asr} min={50} max={600} step={25} onChange={setAsr} accent={CASC} />
            <Slider label="LLM first token" value={llm} min={100} max={1200} step={50} onChange={setLlm} accent={CASC} />
            <Slider label="TTS first audio" value={tts} min={50} max={600} step={25} onChange={setTts} accent={CASC} />
            <Slider label="speech that counts as barge-in" value={minSpeech} min={100} max={600} step={50} onChange={setMinSpeech} accent={CASC} />
            <label className="flex items-center gap-2 self-end font-mono text-[10px] text-muted-foreground">
              <input type="checkbox" checked={bargeIn} onChange={(e) => setBargeIn(e.target.checked)} />
              stop talking when the user speaks (barge-in)
            </label>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{c.note}</p>
        </div>

        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[11px]" style={{ color: DUP }}>
              full-duplex: one model, one 133 ms clock
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              gap after you stop: <span className="text-foreground">{ms(d.r - U_END)}</span>
            </span>
          </div>
          <div className="grid grid-cols-[4.5rem_1fr] items-center gap-x-2 gap-y-1.5">
            <Lane segs={d.user} label="you" />
            <Lane segs={d.sys} label="model" />
            <Ruler frames />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Slider label="silent frames before it speaks (learned)" value={wait} min={0} max={6} step={1} onChange={setWait} unit="frames" accent={DUP} />
            <div className="font-mono text-[10px] leading-5 text-muted-foreground">
              finish your last frame {ms(framing)} + wait {ms(wait * FRAME)} + one model step {PIPE} ms
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{d.note}</p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        A script, not a recording. The cascade&apos;s stage times are whatever you set; the defaults are plausible, not measured. The
        full-duplex lane uses only two published numbers: the 133.3 ms frame (3,200 samples at 24 kHz) and Higurashi&apos;s 65.2 ms p50
        for one frame through the pipeline on an M1 Max with int8 weights. How many silent frames the model waits, and how fast it
        yields, are learned behaviour that Higurashi has not measured in public.
      </figcaption>
    </figure>
  )
}
