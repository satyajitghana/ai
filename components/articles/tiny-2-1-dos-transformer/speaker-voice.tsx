"use client"

import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

// Tiny 2.1's "robot voice", transcribed from say_letter(), buzz(), hiss() and speak()
// in dos/TINY.C. The PC speaker can play one square wave at a time, at one pitch:
//   vowels    buzz: alternate two pitches every 2 ms (sound(f1); delay(2); sound(f2); delay(2))
//   s z c x   hiss 46 ms, f h v j hiss 30 ms: a new random pitch from 2,500-7,000 Hz every 1 ms
//   p t k q   click: 3,200 Hz for 2 ms, then 18 ms of silence
//   b d g     buzz 180/260 Hz for 12 ms, then 10 ms of silence
//   m n       buzz 210/300 Hz for 40 ms; l r w: 400/1,100 Hz for 36 ms
//   digits    buzz 420+60d / 900+90d Hz for 70 ms
//   space 45 ms, comma 110 ms, full stop 200 ms of silence; anything else 20 ms
// Buzz pitches are scaled by `shift`, which falls from 115% to 85% across the answer:
// shift = 115 - 30 * i / (n + 1) for the word starting at letter i. Playback here uses a
// Web Audio square oscillator, which is what the speaker's timer channel produces; the
// hiss uses a seeded generator so the same text sounds the same every time.

type Ev = { kind: "buzz" | "hiss" | "click" | "rest"; ms: number; f1?: number; f2?: number; ch: string }

const BUZZ: Record<string, [number, number, number]> = {
  a: [730, 1090, 64], e: [530, 1840, 56], i: [300, 2290, 52], y: [300, 2290, 52], o: [570, 840, 64], u: [320, 870, 56],
  m: [210, 300, 40], n: [210, 300, 40], l: [400, 1100, 36], r: [400, 1100, 36], w: [400, 1100, 36],
}

function events(text: string): Ev[] {
  const a = text
  const n = a.length
  const out: Ev[] = []
  let i = 0
  while (i < n) {
    let j = i
    while (j < n && a[j] !== " ") j++
    while (j < n && a[j] === " ") j++
    const shift = 115 - Math.trunc((30 * i) / (n + 1))
    for (let k = i; k < j; k++) {
      const c = a[k].toLowerCase()
      const sc = (f: number) => Math.trunc((f * shift) / 100)
      if (BUZZ[c]) {
        const [f1, f2, ms] = BUZZ[c]
        out.push({ kind: "buzz", f1: sc(f1), f2: sc(f2), ms, ch: a[k] })
      } else if ("szcx".includes(c)) out.push({ kind: "hiss", ms: 46, ch: a[k] })
      else if ("fhvj".includes(c)) out.push({ kind: "hiss", ms: 30, ch: a[k] })
      else if ("ptkq".includes(c)) out.push({ kind: "click", ms: 2, f1: 3200, ch: a[k] }, { kind: "rest", ms: 18, ch: "" })
      else if ("bdg".includes(c)) out.push({ kind: "buzz", f1: sc(180), f2: sc(260), ms: 12, ch: a[k] }, { kind: "rest", ms: 10, ch: "" })
      else if (c === " ") out.push({ kind: "rest", ms: 45, ch: " " })
      else if (c === "," || c === "-") out.push({ kind: "rest", ms: 110, ch: c })
      else if (".!?:".includes(c)) out.push({ kind: "rest", ms: 200, ch: c })
      else if (c >= "0" && c <= "9") {
        const d = c.charCodeAt(0) - 48
        out.push({ kind: "buzz", f1: sc(420 + d * 60), f2: sc(900 + d * 90), ms: 70, ch: a[k] })
      } else out.push({ kind: "rest", ms: 20, ch: a[k] })
    }
    i = j
  }
  return out
}

const COL: Record<Ev["kind"], string> = { buzz: "#22d3ee", hiss: "#f472b6", click: "#facc15", rest: "transparent" }

export function SpeakerVoice() {
  const [text, setText] = useState("No, a whale is a mammal.")
  const [playing, setPlaying] = useState(false)
  const ctxRef = useRef<AudioContext | null>(null)
  const evs = events(text.slice(0, 80))
  const total = evs.reduce((a, e) => a + e.ms, 0)

  const play = () => {
    if (playing) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ctx = ctxRef.current ?? new AC()
    ctxRef.current = ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "square"
    gain.gain.value = 0
    osc.connect(gain).connect(ctx.destination)
    let t = ctx.currentTime + 0.05
    let seed = 12345
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed / 0x7fffffff)
    for (const e of evs) {
      if (e.kind === "rest") {
        gain.gain.setValueAtTime(0, t)
      } else if (e.kind === "click") {
        gain.gain.setValueAtTime(0.06, t)
        osc.frequency.setValueAtTime(e.f1!, t)
      } else if (e.kind === "buzz") {
        gain.gain.setValueAtTime(0.06, t)
        for (let s = 0; s < e.ms; s += 4) {
          osc.frequency.setValueAtTime(e.f1!, t + s / 1000)
          osc.frequency.setValueAtTime(e.f2!, t + (s + 2) / 1000)
        }
      } else {
        gain.gain.setValueAtTime(0.04, t)
        for (let s = 0; s < e.ms; s++) osc.frequency.setValueAtTime(2500 + Math.floor(rnd() * 4500), t + s / 1000)
      }
      t += e.ms / 1000
    }
    gain.gain.setValueAtTime(0, t)
    osc.start()
    osc.stop(t + 0.05)
    setPlaying(true)
    osc.onended = () => setPlaying(false)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">the PC-speaker voice, letter by letter</span>
        <button
          type="button"
          onClick={play}
          className={cn("rounded px-2 py-0.5", playing ? "text-muted-foreground" : "bg-foreground text-background")}
        >
          {playing ? "speaking..." : "play (square wave)"}
        </button>
      </div>
      <div className="p-4">
        <input
          value={text}
          maxLength={80}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded border bg-background px-2 py-1 font-mono text-sm"
          aria-label="Text to speak"
        />
        <div className="mt-3 flex h-16 w-full overflow-hidden rounded border bg-muted/20" role="img" aria-label="A timeline of buzzes, hisses, clicks and silences, one segment per letter">
          {evs.map((e, i) => (
            <div
              key={i}
              title={e.kind === "buzz" ? `${e.ch}: ${e.f1}/${e.f2} Hz, ${e.ms} ms` : `${e.ch || "gap"}: ${e.kind}, ${e.ms} ms`}
              className="relative h-full border-r border-background/40"
              style={{ width: `${(100 * e.ms) / Math.max(1, total)}%`, background: COL[e.kind], opacity: e.kind === "buzz" ? 0.35 + Math.min(0.6, (e.f2 ?? 0) / 4000) : 0.8 }}
            >
              {e.ch && e.ch !== " " && e.ms >= 30 ? (
                <span className="absolute bottom-0.5 left-0.5 font-mono text-[10px] text-foreground">{e.ch}</span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
          <span><span style={{ color: COL.buzz }}>■</span> buzz (vowels, m n l r w, digits)</span>
          <span><span style={{ color: COL.hiss }}>■</span> hiss (s z c x f h v j)</span>
          <span><span style={{ color: COL.click }}>■</span> click (p t k q)</span>
          <span className="text-muted-foreground">{(total / 1000).toFixed(2)} s for {text.slice(0, 80).length} characters</span>
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          Every duration and pitch is copied from <code>say_letter()</code> in <code>TINY.C</code>. A vowel is two pitches swapped every 2 ms, a crude stand-in for the two formants that make a real vowel. Sibilants are 1 ms bursts of random pitch, and stops are a 2 ms tick. The whole sentence drifts down in pitch from 115% to 85%. Hover a segment for its numbers. The play button runs the same schedule through a Web Audio square wave, so it sounds close to the speaker but not identical.
        </figcaption>
      </div>
    </figure>
  )
}
