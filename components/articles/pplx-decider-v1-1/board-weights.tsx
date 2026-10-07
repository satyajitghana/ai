"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Decision Index 0.3, from the Space's data/v03.json (generated
// 2026-10-06T16:32:56Z): for each entrant, the public score ("pub") and the two
// private parts already equated onto the public scale ("eq.S", same skills;
// "eq.O", new domains). The board's formula is 0.20 x public + 0.50 x S +
// 0.30 x O, with a 0.9-point tie band. The slider moves the public weight and
// splits the rest 5:3 between the private parts, as 0.3 does; at 20% it gives
// the board's own numbers (to rounding). Thirteen of the 111 entrants: the
// board's top ten, Jebadiah, Cloudflare clef (second-highest public score among
// these) and simple-jev, the untrained Qwen3.8-27B readout.

type Row = { id: string; name: string; pub: number; s: number; o: number }

const ROWS: Row[] = [
  { id: "pplx", name: "pplx-decider v1.1 (27B)", pub: 62.25, s: 60.75, o: 66.42 },
  { id: "glide", name: "Fastino GLiDE no-thinking", pub: 59.06, s: 59.13, o: 62.79 },
  { id: "jev", name: "Jev (hosted)", pub: 57.96, s: 57.66, o: 65.63 },
  { id: "torchcast", name: "Torchcast Decision 27B", pub: 65.1, s: 57.75, o: 60.04 },
  { id: "deck", name: "deck31b (Gemma 4 31B)", pub: 58.19, s: 58.23, o: 60.92 },
  { id: "kev", name: "Kev 27B", pub: 56.69, s: 55.1, o: 66.31 },
  { id: "quyet", name: "Quyet-1.0-Large", pub: 60.79, s: 58.46, o: 57.74 },
  { id: "blink", name: "Blink v0.3 26B-A4B", pub: 58.21, s: 56.81, o: 59.04 },
  { id: "decider", name: "Decider chat, stock Gemma 4 31B", pub: 57.79, s: 56.48, o: 59.39 },
  { id: "rune", name: "Surogate Rune 26B-A4B v3", pub: 58.28, s: 56.7, o: 58.09 },
  { id: "jebadiah", name: "Jebadiah 27B", pub: 55.11, s: 55.17, o: 56.72 },
  { id: "clef", name: "Cloudflare clef", pub: 61.71, s: 52.67, o: 48 },
  { id: "simple", name: "simple-jev, stock Qwen3.8-27B", pub: 56.05, s: 55.05, o: 43.52 },
]

const TIE = 0.9

export function BoardWeights() {
  const [w, setW] = useState(20)
  const pw = w / 100
  const sw = ((1 - pw) * 5) / 8
  const ow = ((1 - pw) * 3) / 8
  const scored = ROWS.map((r) => ({ ...r, v: pw * r.pub + sw * r.s + ow * r.o })).sort((a, b) => b.v - a.v)
  const lead = scored[0].v
  const lo = 40
  const hi = 68

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decision Index 0.3, re-weighted: public share {w}% · same-skill private {(sw * 100).toFixed(1)}% · new-domain
        private {(ow * 100).toFixed(1)}%
      </div>
      <div className="grid gap-2 p-3 font-mono text-[11px]">
        <label className="flex items-center gap-2">
          <span className="w-28 shrink-0">public weight</span>
          <Range min={0} max={100} step={5} value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "0.3 as published", v: 20 },
            { label: "public only", v: 100 },
            { label: "private only", v: 0 },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setW(p.v)}
              className={cn("rounded border px-2 py-0.5", w === p.v ? "border-foreground" : "text-muted-foreground")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-1 grid gap-1">
          {scored.map((r, i) => {
            const tied = i > 0 && lead - r.v <= TIE
            return (
              <div key={r.id} className="grid grid-cols-[1.5rem_minmax(0,11rem)_1fr] items-center gap-2 sm:grid-cols-[1.5rem_16rem_1fr]">
                <span className="text-right text-muted-foreground">{i + 1}</span>
                <span className={cn("truncate", r.id === "pplx" && "font-semibold")}>{r.name}</span>
                <div className="relative h-4 overflow-hidden rounded-sm bg-muted">
                  <div
                    className={cn(
                      "h-full",
                      r.id === "pplx" ? "bg-rose-600" : r.id === "jev" ? "bg-foreground/80" : "bg-sky-600/70",
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, ((r.v - lo) / (hi - lo)) * 100)).toFixed(2)}%` }}
                  />
                  <span className="absolute inset-y-0 left-1 flex items-center font-semibold">
                    {r.v.toFixed(2)}
                    {tied ? " · tied with #1" : ""}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="m-0 text-[10px] text-muted-foreground">bars start at 40 · a model within 0.9 of the leader shares its rank</p>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        Thirteen of the board&apos;s 111 entrants, from data/v03.json. At 20% the scores are the board&apos;s; public
        only, Torchcast leads by 2.85; the two swap places near 60%; with the public part removed, pplx-decider leads Jev by
        2.23. The private parts are already equated by the board onto the public scale; I only change the weights.
      </figcaption>
    </figure>
  )
}
