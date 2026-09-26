"use client"

import { useState } from "react"

// What a full-duplex voice model has to decide, event by event, and how often
// each system got it right on Full-Duplex-Bench. The report
// (Qwen-Audio-3.1-Realtime, arXiv 2609.25176) frames the decision as a policy
// a_t = pi(audio so far, history, system state) over four actions: keep
// listening, begin a response, stop playback, resume after an interruption.
//
// All rates and latencies are copied from the report's Table 10 (FDB v1.0 for
// pause handling and turn-taking, FDB v1.5 for the rest). They are the report's
// own runs, speech in and speech out, not a leaderboard. The timelines are
// schematic: bar positions are illustrative, not measured timings.

type Row = { name: string; vals: [number, number, number, number]; lowerBetter: boolean; unit?: string }

type Ev = {
  id: string
  label: string
  room: string // what the other party does
  right: string // what the policy should do
  action: "listen" | "speak" | "stop" | "resume"
  // schematic lanes, percentages of the strip
  bot: [number, number][] // assistant speaking spans
  user: [number, number][] // the event spans
  rows: Row[]
}

const SYSTEMS = ["GPT-Realtime-2", "SeedDuplex 1.2.6.1", "Qwen-Audio-3.0-Realtime", "Qwen-Audio-3.1-Realtime"]

const EVENTS: Ev[] = [
  {
    id: "bg",
    label: "Background speech",
    room: "A TV or a nearby conversation starts while the assistant is talking.",
    right: "Treat it as noise: do not answer it, carry on or resume.",
    action: "resume",
    bot: [[4, 96]],
    user: [[34, 62]],
    rows: [
      { name: "responded (wrong)", vals: [0.72, 0.61, 0.73, 0.13], lowerBetter: true },
      { name: "resumed (right)", vals: [0.12, 0.29, 0.26, 0.87], lowerBetter: false },
    ],
  },
  {
    id: "others",
    label: "Talking to others",
    room: "Mid-reply, the user turns away and speaks to someone else in the room.",
    right: "Do not answer: the words are not addressed to the assistant. Carry on.",
    action: "resume",
    bot: [[4, 96]],
    user: [[36, 70]],
    rows: [
      { name: "responded (wrong)", vals: [0.6, 0.81, 0.13, 0.03], lowerBetter: true },
      { name: "resumed (right)", vals: [0.13, 0.05, 0.82, 0.96], lowerBetter: false },
    ],
  },
  {
    id: "backchannel",
    label: "Backchannel",
    room: "The user says “mm-hm” or “right” mid-sentence.",
    right: "Keep talking: it is agreement, not a turn.",
    action: "resume",
    bot: [[4, 96]],
    user: [[45, 53]],
    rows: [
      { name: "responded (wrong)", vals: [0.0204, 0, 0, 0.0306], lowerBetter: true },
      { name: "resumed (right)", vals: [0.9184, 0.9796, 0.98, 0.9694], lowerBetter: false },
    ],
  },
  {
    id: "interrupt",
    label: "Interruption",
    room: "The user cuts in with a new request while the assistant is talking.",
    right: "Stop playback, then answer the new request.",
    action: "stop",
    bot: [[4, 44], [74, 96]],
    user: [[40, 68]],
    rows: [
      { name: "responded (right)", vals: [0.835, 0.68, 0.88, 0.845], lowerBetter: false },
      { name: "time to stop", vals: [0.383, 1.419, 1.041, 1.116], lowerBetter: true, unit: "s" },
    ],
  },
  {
    id: "pause",
    label: "Mid-thought pause",
    room: "The user stops to think in the middle of a sentence.",
    right: "Wait: the turn is not over.",
    action: "listen",
    bot: [[84, 96]],
    user: [[4, 32], [46, 76]],
    rows: [{ name: "took the turn early (Candor)", vals: [0.037, 0.1296, 0.11, 0.0509], lowerBetter: true }],
  },
  {
    id: "turn",
    label: "End of turn",
    room: "The user finishes and falls silent.",
    right: "Take the turn, promptly.",
    action: "speak",
    bot: [[62, 96]],
    user: [[4, 48]],
    rows: [
      { name: "took the turn (Candor)", vals: [1, 0.9412, 0.958, 0.9664], lowerBetter: false },
      { name: "latency", vals: [1.799, 1.844, 1.539, 1.921], lowerBetter: true, unit: "s" },
    ],
  },
]

const BOT = "oklch(0.6 0.15 250)"
const USER = "oklch(0.72 0.15 60)"
const Q31 = "oklch(0.6 0.15 250)"
const OTHER = "oklch(0.7 0.02 260)"

const ACTION_TEXT: Record<Ev["action"], string> = {
  listen: "keep listening",
  speak: "begin a response",
  stop: "stop playback",
  resume: "resume / carry on",
}

function fmt(v: number, unit?: string) {
  if (unit === "s") return `${v.toFixed(3)} s`
  return v.toFixed(v < 0.1 && v > 0 ? 4 : 2)
}

export function DuplexEvents() {
  const [id, setId] = useState("bg")
  const ev = EVENTS.find((e) => e.id === id) ?? EVENTS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          full-duplex: one decision, six situations
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          rates: Qwen-Audio-3.1-Realtime report, Table 10 (self-run)
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="situation">
          {EVENTS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setId(e.id)}
              aria-pressed={e.id === id}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                e.id === id ? "border-transparent text-white" : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
              style={e.id === id ? { background: BOT } : undefined}
            >
              {e.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 p-3">
          <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">assistant</span>
            <div className="relative h-4 rounded-sm bg-muted/30">
              {ev.bot.map(([a, b]) => (
                <div key={`${a}-${b}`} className="absolute inset-y-0 rounded-sm" style={{ left: `${a}%`, width: `${b - a}%`, background: BOT, opacity: 0.8 }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">room</span>
            <div className="relative h-4 rounded-sm bg-muted/30">
              {ev.user.map(([a, b]) => (
                <div key={`${a}-${b}`} className="absolute inset-y-0 rounded-sm" style={{ left: `${a}%`, width: `${b - a}%`, background: USER, opacity: 0.85 }} />
              ))}
            </div>
          </div>
          <p className="mt-2.5 text-sm leading-6 text-foreground">{ev.room}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Right move: {ev.right}{" "}
            <span className="font-mono text-[11px]" style={{ color: BOT }}>
              action = {ACTION_TEXT[ev.action]}
            </span>
          </p>
        </div>

        <div className="mt-3 space-y-3">
          {ev.rows.map((r) => {
            const max = Math.max(...r.vals, r.unit === "s" ? 2 : 1)
            const best = r.lowerBetter ? Math.min(...r.vals) : Math.max(...r.vals)
            return (
              <div key={r.name}>
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
                  <span>{r.name}</span>
                  <span>{r.lowerBetter ? "lower is better" : "higher is better"}</span>
                </div>
                <div className="space-y-1">
                  {SYSTEMS.map((s, i) => {
                    const v = r.vals[i]
                    const q = i === 3
                    return (
                      <div key={s} className="grid grid-cols-[8.5rem_1fr_4.2rem] items-center gap-2 sm:grid-cols-[11rem_1fr_4.5rem]">
                        <span className={`truncate font-mono text-[10px] ${q ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
                        <div className="relative h-2.5 rounded-sm bg-muted/30">
                          <div
                            className="absolute inset-y-0 left-0 rounded-sm"
                            style={{ width: `${(v / max) * 100}%`, background: q ? Q31 : OTHER, opacity: q ? 1 : 0.5 }}
                          />
                        </div>
                        <span className={`text-right font-mono text-[10px] tabular-nums ${v === best ? "text-foreground" : "text-muted-foreground"}`}>
                          {fmt(v, r.unit)}
                          {v === best ? "*" : ""}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="font-mono">*</span>{" "}best of the four, ties included. Rates are proportions of
          test cases. The bars on the timeline are schematic. 3.1&rsquo;s gain is concentrated where the
          speech is not meant for it; on interruption and end-of-turn it is no faster than 3.0.
        </p>
      </div>
    </figure>
  )
}
