"use client"

import { useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// Six targets and the renders of the recipes `earshot fit` wrote for them, made by us
// with earshot 0.2.0 (commit 9721326) on a shared 4-core CPU VM on 17 Oct 2026:
// Python 3.12, 2 threads, nice 19 with other jobs running, no CLAP (the default).
// "fit" is earshot's own fit time; "wall" is the whole CLI call. The distance is ours:
// log-mel L1 (64 mel bands 30 Hz to 20 kHz, FFT 2048, hop 256, mean |dB| over the
// cells within 60 dB of the louder sound's top). "two takes" is the same distance
// between seed 0 and seed 1 of the fitted recipe (the noise the model itself carries);
// "noise" is the target against white noise that follows the target's 5 ms envelope,
// a model that knows the loudness contour and nothing about the spectrum. Each pair
// was scaled by one gain (the target's peak to -1 dBFS), followed by 0.25 s of
// silence, and encoded as 32 kb/s mono Opus.

type Pair = {
  id: string
  label: string
  what: string
  model: string
  dur: number // s
  fit: number // s
  wall: number // s
  dist: number // dB
  floor: number // dB
  noise: number // dB
}

const PAIRS: Pair[] = [
  {
    id: "synth_bar",
    label: "struck bar",
    what: "Synthetic, made by us: three damped modes at 523, 1414 and 2771 Hz plus a 1.5 ms noise contact. The answer is known.",
    model: "sines, 3 partials",
    dur: 1.0,
    fit: 7.48,
    wall: 9.67,
    dist: 2.09,
    floor: 0.11,
    noise: 36.75,
  },
  {
    id: "synth_glide",
    label: "glide",
    what: "Synthetic, made by us: a tone gliding from 600 to 1200 Hz in 0.25 s with a second harmonic. The weakest fit here.",
    model: "sines, 4 partials",
    dur: 0.5,
    fit: 7.42,
    wall: 8.99,
    dist: 4.89,
    floor: 0.3,
    noise: 34.75,
  },
  {
    id: "own_pro_notify_ding_1822",
    label: "earshot ding",
    what: "earshot's own pro_notify ding, rendered from the parameters committed in its seed bank, then fitted back.",
    model: "sines, 10 partials",
    dur: 0.26,
    fit: 8.52,
    wall: 10.03,
    dist: 3.55,
    floor: 0.89,
    noise: 28.07,
  },
  {
    id: "own_pro_pop_chirp",
    label: "earshot pop",
    what: "earshot's own pro_pop chirp, from its seed bank. The fit carries most of it as band noise.",
    model: "sines, 5 partials",
    dur: 0.162,
    fit: 5.27,
    wall: 6.64,
    dist: 4.03,
    floor: 2.42,
    noise: 17.83,
  },
  {
    id: "cc0_twig_snap",
    label: "twig snap (real)",
    what: "A real recording: Snapping twig (single), by Stephan, CC0, Wikimedia Commons. The only microphone in the set.",
    model: "sines, 11 partials",
    dur: 0.83,
    fit: 36.12,
    wall: 38.22,
    dist: 5.8,
    floor: 2.63,
    noise: 14.21,
  },
  {
    id: "own_whoosh_fast_crisp",
    label: "earshot whoosh",
    what: "earshot's own fast whoosh (the crisp member), from its seed bank: stereo noise, summed to mono for the page.",
    model: "sines, 11 partials",
    dur: 1.056,
    fit: 27.7,
    wall: 30.06,
    dist: 2.94,
    floor: 2.67,
    noise: 15.84,
  },
]

const SCALE = 40 // dB, the right edge of the strip

const pct = (db: number) => `${Math.min(100, (db / SCALE) * 100).toFixed(1)}%`

export function SamplePairs() {
  const [i, setI] = useState(0)
  const a = useRef<HTMLAudioElement | null>(null)
  const b = useRef<HTMLAudioElement | null>(null)
  const p = PAIRS[i]

  const pick = (k: number) => {
    a.current?.pause()
    b.current?.pause()
    setI(k)
  }

  const marks: { db: number; name: string; cls: string }[] = [
    { db: p.floor, name: "two takes of the fit", cls: "bg-muted-foreground" },
    { db: p.dist, name: "target vs fit", cls: "bg-foreground" },
    { db: p.noise, name: "envelope-matched noise", cls: "bg-amber-500" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">target</span>
        {PAIRS.map((q, k) => (
          <button
            key={q.id}
            type="button"
            onClick={() => pick(k)}
            aria-pressed={k === i}
            className={`rounded-md border px-2 py-0.5 ${k === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <p className="text-[14px] leading-relaxed">{p.what}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px]">target, {p.dur.toFixed(2)} s</span>
            <audio
              ref={a}
              key={`t${p.id}`}
              controls
              preload="none"
              src={mediaUrl(`/articles/earshot/${p.id}-target.webm`)}
              onPlay={() => b.current?.pause()}
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              render of the emitted recipe ({p.model})
            </span>
            <audio
              ref={b}
              key={`f${p.id}`}
              controls
              preload="none"
              src={mediaUrl(`/articles/earshot/${p.id}-fit.webm`)}
              onPlay={() => a.current?.pause()}
              className="mt-1 w-full"
            />
          </label>
        </div>
        <div className="mt-4" aria-hidden="true">
          <div className="relative h-7 rounded-md border bg-muted/30">
            {marks.map((m) => (
              <span
                key={m.name}
                className={`absolute top-1 bottom-1 w-1 -translate-x-1/2 rounded-sm ${m.cls}`}
                style={{ left: pct(m.db) }}
                title={`${m.name}: ${m.db.toFixed(2)} dB`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>0 dB, identical</span>
            <span>{SCALE} dB</span>
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-x-3 gap-y-0.5 font-mono text-[10.5px] sm:grid-cols-3">
          {marks.map((m) => (
            <div key={m.name} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${m.cls}`} />
              <dt className="inline text-muted-foreground">{m.name}</dt>
              <dd className="inline">{m.db.toFixed(2)} dB</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          fit {p.fit.toFixed(2)} s, whole CLI call {p.wall.toFixed(2)} s
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Generated by us on a shared 4-core CPU VM, 17 Oct 2026: earshot 0.2.0, 2 threads, nice 19, no CLAP. Distances
        are our log-mel L1 (64 bands, mean |dB| over cells within 60 dB of the top), not earshot&apos;s own metric.
        Each pair shares one gain; Opus at 32 kb/s, mono.
      </figcaption>
    </figure>
  )
}
