"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { msin } from "@/lib/dmath"
import { mediaUrl } from "@/lib/media"
import { cn } from "@/lib/utils"

import { RUNS, type KRun } from "./kokoro-timing-data"

// One line of real Kokoro-82M speech, and the two ways to drive a mouth and a
// caption from it.
//
// Left mouth: the phoneme durations Kokoro's duration predictor emits (one
// frame = 600 samples = 25 ms), each phoneme mapped to a mouth shape. The
// phoneme i occupies frames [cum(i), cum(i+1)) of the decoder's alignment,
// which is exactly where the decoder puts its sound (kokoro/model.py:110-118).
//
// Right mouth: this site's own engine, which does not read timings at all. It
// opens and closes the mouth on a sine for as long as a line plays:
//   talkAt(t) = .3 + .7 * |sin(15x)| * (.55 + .45 * sin(4.3x))
// (brand-crew/skills/explainer-films/engine/explainer.js:49-52).
//
// Captions: the word spans Kokoro's join_timestamps computes (ported, see the
// data file), against the same line split evenly by word count, which is what
// any pipeline without timings is reduced to.

const SR = 24000
const FRAME = 600 / SR

type Vis = "rest" | "closed" | "fv" | "teeth" | "wide" | "open" | "round"

// misaki/Kokoro phoneme symbols to a mouth shape (a reduced Preston Blair set)
const VIS: Record<string, Vis> = {}
const put = (chars: string, v: Vis) => {
  for (const c of chars) VIS[c] = v
}
put("pbm", "closed")
put("fv", "fv")
put("szʃʒʧʤtdnlθðkgɡŋhTɾj", "teeth")
put("iɪAeY", "wide")
put("æaɑʌəɛɜIᵊɚ", "open")
put("uʊOowɔWɹ", "round")

const OPEN: Record<Vis, number> = { rest: 0, closed: 0, fv: 0.15, teeth: 0.3, wide: 0.42, round: 0.5, open: 0.9 }
const LABEL: Record<Vis, string> = {
  rest: "rest",
  closed: "lips shut (p b m)",
  fv: "lip on teeth (f v)",
  teeth: "teeth (s t d n k ...)",
  wide: "wide (i A ...)",
  open: "open (ae a e ...)",
  round: "round (u O r ...)",
}

const ACCENT = "oklch(0.62 0.15 150)"
const SITE = "oklch(0.64 0.15 45)"
const MUTED = "oklch(0.62 0.02 260)"

type Ph = { ch: string; a: number; b: number; vis: Vis }

function phonesOf(run: KRun): Ph[] {
  const out: Ph[] = []
  let t = run.frames[0] * FRAME
  for (let i = 0; i < run.phonemes.length; i++) {
    const ch = run.phonemes[i]
    const d = run.frames[i + 1] * FRAME
    out.push({ ch, a: t, b: t + d, vis: VIS[ch] ?? "rest" })
    t += d
  }
  // a stress mark has a duration but no shape of its own: it takes the next
  // phoneme's, which is the vowel it stresses
  for (let i = out.length - 2; i >= 0; i--) if (out[i].ch === "ˈ" || out[i].ch === "ˌ") out[i].vis = out[i + 1].vis
  return out
}

const sineFlap = (t: number, dur: number) => {
  if (t < 0 || t >= dur) return 0
  return 0.3 + 0.7 * Math.abs(msin(t * 15)) * (0.55 + 0.45 * msin(t * 4.3))
}

function Mouth({ open, vis, colour, label }: { open: number; vis: Vis | null; colour: string; label: string }) {
  // a face 120 wide; the mouth is an ellipse whose height is `open`, narrowed
  // for round shapes and widened for wide ones, or a line when shut
  const w = vis === "round" ? 16 : vis === "wide" ? 34 : vis === "fv" ? 26 : 28
  const h = 2 + 26 * open
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 120 110" className="h-28 w-32" role="img" aria-label={label}>
        <path d="M22 44 L28 8 L50 30 Z M98 44 L92 8 L70 30 Z" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.5} />
        <ellipse cx={60} cy={58} rx={44} ry={40} fill="currentColor" fillOpacity={0.06} stroke="currentColor" strokeOpacity={0.5} />
        <circle cx={44} cy={50} r={4.5} fill="currentColor" />
        <circle cx={76} cy={50} r={4.5} fill="currentColor" />
        <path d="M56 64 L64 64 L60 69 Z" fill={colour} />
        {open < 0.05 ? (
          <path d={`M${60 - w / 2} 80 Q60 ${vis === "closed" ? 80 : 84} ${60 + w / 2} 80`} stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        ) : (
          <>
            <ellipse cx={60} cy={80} rx={w / 2} ry={h / 2} fill="oklch(0.38 0.1 20)" stroke="currentColor" strokeWidth={1.6} />
            {vis === "fv" || vis === "teeth" ? <rect x={60 - w / 2 + 3} y={80 - h / 2} width={w - 6} height={Math.min(4, h / 2)} fill="white" /> : null}
          </>
        )}
      </svg>
      <span className="text-center font-mono text-[10px] leading-tight text-muted-foreground">{label}</span>
    </div>
  )
}

export function NarrationTiming() {
  const [ri, setRi] = useState(1)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const raf = useRef(0)

  const run = RUNS[ri]
  const dur = run.samples / SR
  const phones = useMemo(() => phonesOf(run), [run])
  const words = useMemo(() => run.tokens.filter((k) => /\w/.test(k.text)), [run])

  useEffect(() => {
    const a = audio.current
    if (!a) return
    const tick = () => {
      setT(a.currentTime)
      if (!a.paused) raf.current = requestAnimationFrame(tick)
    }
    const onPlay = () => {
      setPlaying(true)
      raf.current = requestAnimationFrame(tick)
    }
    const onStop = () => {
      setPlaying(false)
      cancelAnimationFrame(raf.current)
      setT(a.currentTime)
    }
    a.addEventListener("play", onPlay)
    a.addEventListener("pause", onStop)
    a.addEventListener("ended", onStop)
    return () => {
      cancelAnimationFrame(raf.current)
      a.removeEventListener("play", onPlay)
      a.removeEventListener("pause", onStop)
      a.removeEventListener("ended", onStop)
    }
  }, [ri])

  const choose = (i: number) => {
    audio.current?.pause()
    setRi(i)
    setT(0)
  }
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) {
      if (a.currentTime >= dur - 0.01) a.currentTime = 0
      void a.play()
    } else a.pause()
  }
  const scrub = (v: number) => {
    const a = audio.current
    if (a) {
      a.pause()
      a.currentTime = v
    }
    setT(v)
  }

  const cur = phones.find((p) => t >= p.a && t < p.b) ?? null
  const kVis: Vis = cur ? cur.vis : "rest"
  const kOpen = OPEN[kVis]
  const sOpen = sineFlap(t, dur)

  // word index by Kokoro's spans, and by an even split over the spoken span
  const w0 = words[0].start
  const w1 = words[words.length - 1].end
  const kWord = words.findIndex((k) => t >= k.start && t < k.end)
  const sWord = t >= w0 && t < w1 ? Math.min(words.length - 1, Math.floor(((t - w0) / (w1 - w0)) * words.length)) : -1
  const worst = words.reduce((m, k, i) => Math.max(m, Math.abs(w0 + ((w1 - w0) * i) / words.length - k.start)), 0)

  // timeline geometry
  const W = 1000
  const X0 = 70
  const X1 = W - 10
  const x = (s: number) => X0 + ((X1 - X0) * s) / dur
  const ROW = { ph: 10, kw: 46, sw: 72, sine: 98 }
  const H = 132

  const sinePath = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 400; i++) {
      const s = (dur * i) / 400
      pts.push(`${i ? "L" : "M"}${(X0 + ((X1 - X0) * s) / dur).toFixed(1)} ${(ROW.sine + 26 - 24 * sineFlap(s, dur)).toFixed(1)}`)
    }
    return pts.join(" ")
  }, [dur, ROW.sine, X1])

  const btn = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Kokoro-82M, voice af_heart: one line, its phoneme frames and two mouths</span>
        <span className="font-mono text-[10px] text-muted-foreground">real model output; 1 frame = 25 ms</span>
      </div>

      <div className="p-3 sm:p-4">
        <audio ref={audio} key={run.speed} src={mediaUrl(`/articles/claude-demo-videos/kokoro-${run.speed.toFixed(1)}.m4a`)} preload="auto" />

        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={btn(playing)} onClick={toggle}>
            {playing ? "pause" : "play the line"}
          </button>
          <span className="mx-1 hidden w-px self-stretch bg-border sm:block" />
          <span className="font-mono text-[10px] text-muted-foreground">speed</span>
          {RUNS.map((r, i) => (
            <button key={r.speed} type="button" className={btn(i === ri)} aria-pressed={i === ri} onClick={() => choose(i)}>
              {r.speed.toFixed(1)}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {run.frames.reduce((a, b) => a + b, 0)} frames, {dur.toFixed(2)} s
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-6">
          <Mouth open={kOpen} vis={kVis} colour={ACCENT} label={`from phoneme frames: ${cur ? `/${cur.ch}/ → ${LABEL[kVis]}` : "rest"}`} />
          <Mouth open={sOpen} vis={sOpen > 0.05 ? "open" : null} colour={SITE} label={`sine flap (this site's engine): ${sOpen.toFixed(2)} open`} />
        </div>

        <div className="mt-3 space-y-1.5 font-mono text-[12px] leading-relaxed">
          <p>
            <span className="mr-2 inline-block w-28 text-[10px] text-muted-foreground">Kokoro word times</span>
            {words.map((k, i) => (
              <span key={i} className={cn("rounded px-0.5", i === kWord && "text-background")} style={i === kWord ? { background: ACCENT } : undefined}>
                {k.text}{" "}
              </span>
            ))}
          </p>
          <p>
            <span className="mr-2 inline-block w-28 text-[10px] text-muted-foreground">split by word count</span>
            {words.map((k, i) => (
              <span key={i} className={cn("rounded px-0.5", i === sWord && "text-background")} style={i === sWord ? { background: SITE } : undefined}>
                {k.text}{" "}
              </span>
            ))}
          </p>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" role="img">
            <title>
              {`At ${t.toFixed(2)} s the phoneme is ${cur ? cur.ch : "none"}; the Kokoro word is ${kWord >= 0 ? words[kWord].text : "none"}, the evenly split word is ${sWord >= 0 ? words[sWord].text : "none"}.`}
            </title>
            {[
              ["phonemes", ROW.ph],
              ["Kokoro", ROW.kw],
              ["even split", ROW.sw],
              ["sine flap", ROW.sine],
            ].map(([label, y]) => (
              <text key={label} x={X0 - 6} y={(y as number) + 14} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                {label}
              </text>
            ))}
            {phones.map((p, i) => {
              const w = x(p.b) - x(p.a)
              const on = cur === p
              return (
                <g key={i}>
                  <rect
                    x={x(p.a) + 0.3}
                    y={ROW.ph}
                    width={Math.max(0.5, w - 0.6)}
                    height={26}
                    rx={2}
                    fill={p.vis === "rest" ? MUTED : ACCENT}
                    fillOpacity={on ? 0.85 : p.vis === "closed" ? 0.5 : 0.08 + 0.3 * OPEN[p.vis]}
                  />
                  {w >= 9 ? (
                    <text x={x(p.a) + w / 2} y={ROW.ph + 17} textAnchor="middle" fontSize={9} fill="currentColor" fontFamily="ui-monospace, monospace">
                      {p.ch}
                    </text>
                  ) : null}
                </g>
              )
            })}
            {words.map((k, i) => (
              <g key={`k${i}`}>
                <rect x={x(k.start) + 0.5} y={ROW.kw} width={Math.max(0.5, x(k.end) - x(k.start) - 1)} height={20} rx={3} fill={ACCENT} fillOpacity={i === kWord ? 0.7 : 0.18} />
                <text x={x(k.start) + 3} y={ROW.kw + 14} fontSize={9} fill="currentColor" fontFamily="ui-monospace, monospace">
                  {k.text}
                </text>
              </g>
            ))}
            {words.map((k, i) => {
              const a = w0 + ((w1 - w0) * i) / words.length
              const b = w0 + ((w1 - w0) * (i + 1)) / words.length
              return (
                <g key={`s${i}`}>
                  <rect x={x(a) + 0.5} y={ROW.sw} width={Math.max(0.5, x(b) - x(a) - 1)} height={20} rx={3} fill={SITE} fillOpacity={i === sWord ? 0.7 : 0.18} />
                  <text x={x(a) + 3} y={ROW.sw + 14} fontSize={9} fill="currentColor" fontFamily="ui-monospace, monospace">
                    {k.text}
                  </text>
                </g>
              )
            })}
            <path d={sinePath} fill="none" stroke={SITE} strokeWidth={1.4} />
            <line x1={x(t)} x2={x(t)} y1={4} y2={H - 4} stroke="currentColor" strokeWidth={1.2} />
          </svg>
        </div>

        <div className="mt-2">
          <Range min={0} max={dur} step={0.005} value={t} accent={ACCENT} onChange={(e) => scrub(Number(e.target.value))} aria-label="Time in the line" className="w-full" />
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          The bars are what the duration predictor decided, rounded to whole 25 ms frames; the audio is generated from that alignment. The
          worst even-split error on this line is {worst.toFixed(2)} s, on a 13-word sentence. The sine flap never closes during the line, so
          the five lip closures here (the p, m, p, m and p) are never shown.
        </p>
      </div>
    </figure>
  )
}
