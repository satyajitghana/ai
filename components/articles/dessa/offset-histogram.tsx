"use client"

import { useMemo, useState } from "react"

import { CLIPS } from "./data"

// Floor-transfer offsets pooled across Block's published Dessa recordings:
// how long after the other speaker last stopped each side started talking
// (negative = started while the other was still talking). Measured from the
// demo FLACs, see data.ts. Percentiles use linear interpolation, as numpy does,
// so the figures match the article's.

const DESSA = "oklch(0.62 0.16 150)"
const OTHER = "oklch(0.7 0.14 60)"
const LO = -200
const HI = 200
const BIN = 20 // centiseconds

type Set_ = "all" | "team" | "users" | "gpt"

const SETS: { id: Set_; label: string }[] = [
  { id: "all", label: "19 human calls" },
  { id: "team", label: "5 with the team" },
  { id: "users", label: "14 with other users" },
  { id: "gpt", label: "1 call with GPT-Live-1" },
]

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const i = p * (sorted.length - 1)
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

function summary(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  return {
    n: s.length,
    q1: pct(s, 0.25) / 100,
    med: pct(s, 0.5) / 100,
    q3: pct(s, 0.75) / 100,
    neg: s.length ? s.filter((v) => v < 0).length / s.length : 0,
    late: s.length ? s.filter((v) => v > 100).length / s.length : 0,
  }
}

function sign(v: number) {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`
}

export function OffsetHistogram() {
  const [set, setSet] = useState<Set_>("all")

  const { d, o, hd, ho, peak } = useMemo(() => {
    const pick = CLIPS.filter((c) =>
      set === "gpt" ? c.other === "GPT-Live-1" : set === "team" ? c.other === "team member" : set === "users" ? c.other === "user" : c.other !== "GPT-Live-1",
    )
    const dv = pick.flatMap((c) => c.sw.filter((x) => x[2] === 1).map((x) => x[1]))
    const ov = pick.flatMap((c) => c.sw.filter((x) => x[2] === 0).map((x) => x[1]))
    const nb = (HI - LO) / BIN
    const bins = (xs: number[]) => {
      const h = new Array<number>(nb).fill(0)
      for (const v of xs) {
        const k = Math.min(nb - 1, Math.max(0, Math.floor((v - LO) / BIN)))
        h[k] += 1
      }
      return h.map((c) => (xs.length ? c / xs.length : 0))
    }
    const hd_ = bins(dv)
    const ho_ = bins(ov)
    return { d: summary(dv), o: summary(ov), hd: hd_, ho: ho_, peak: Math.max(...hd_, ...ho_, 0.01) }
  }, [set])

  const otherName = set === "gpt" ? "GPT-Live-1" : "the person"
  const nb = hd.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">how fast each side takes the floor</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured, 200 ms bins, clipped at ±2 s</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="recordings">
          {SETS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSet(s.id)}
              aria-pressed={s.id === set}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                s.id === set ? "border-transparent text-white" : "bg-muted/20 text-muted-foreground hover:text-foreground"
              }`}
              style={s.id === set ? { background: DESSA } : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 p-3">
          <div className="relative h-40">
            <div className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: "50%" }} />
            <span className="absolute top-0 font-mono text-[9px] text-muted-foreground" style={{ left: "51%" }}>
              gap →
            </span>
            <span className="absolute top-0 -translate-x-full font-mono text-[9px] text-muted-foreground" style={{ left: "49%" }}>
              ← overlap
            </span>
            <div className="absolute inset-x-0 bottom-0 top-4 flex items-end gap-px">
              {hd.map((v, i) => (
                <div key={i} className="flex h-full flex-1 items-end gap-px">
                  <div className="flex-1 rounded-t-sm" style={{ height: `${(v / peak) * 100}%`, background: DESSA, opacity: 0.9 }} />
                  <div className="flex-1 rounded-t-sm" style={{ height: `${(ho[i] / peak) * 100}%`, background: OTHER, opacity: 0.9 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i}>{sign((LO + (i * (HI - LO)) / 4) / 100)} s</span>
            ))}
          </div>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">{nb} bins; the end bins also hold everything beyond ±2 s.</p>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-[11px] sm:grid-cols-2">
          {[
            { name: "Dessa", s: d, c: DESSA },
            { name: otherName, s: o, c: OTHER },
          ].map(({ name, s, c }) => (
            <div key={name} className="rounded-md border bg-muted/10 p-2">
              <div style={{ color: c }}>
                {name}: {s.n} switches
              </div>
              <div className="text-muted-foreground">
                median {sign(s.med)} s, middle half {sign(s.q1)} to {sign(s.q3)} s
              </div>
              <div className="text-muted-foreground">
                {(s.neg * 100).toFixed(1)}% start in overlap, {(s.late * 100).toFixed(1)}% wait over 1 s
              </div>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Each switch is one side starting to talk after the other side spoke last. The offset is that start minus the end of the
        other&apos;s last talkspurt. Green is Dessa responding, amber is whoever it was talking to. These are Block&apos;s chosen
        demos, not a test set; the GPT-Live-1 call is a single recording.
      </figcaption>
    </figure>
  )
}
