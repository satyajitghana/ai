"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The N1–N6 string as src/hero/moves.js defines it at 5702d90, scheduled by the
// rules in src/hero/combo.js and src/combat/combat.js:
//
//   hero hitstop, light window:  min(4, 1 + floor((victims - 1) / 5))   (combat.js heroStop)
//   hero hitstop, N6 (heavy):    base 7, clamped to [6, 8]
//   beat, light move:            cancels when moveT + min(ABSORB, frozen) >= cancel   (combo.js beatOk)
//   beat, armoured move (N6):    no absorption — the freeze is added on top
//   C-branch:                    moveT >= branch (pure move time, never absorbed)
//
// With ABSORB = 8 the next move starts at start + cancel + max(0, frozen - 8)
// wall frames; without it, at start + cancel + frozen. The mash is assumed
// perfect (every press buffered in time). A sweep window pays its stop on the
// first tick that connects, with that tick's count, so for N2–N4 the model is
// an upper bound on the freeze.

type Move = {
  id: string
  frames: number
  cancel: number
  branch?: number
  charge: string
  windows: [number, number][]
  heavy?: boolean
}

const MOVES: Move[] = [
  { id: "N1", frames: 35, cancel: 23, branch: 11, charge: "C2", windows: [[7, 10]] },
  { id: "N2", frames: 35, cancel: 25, branch: 13, charge: "C3", windows: [[9, 12]] },
  { id: "N3", frames: 30, cancel: 20, branch: 14, charge: "C4", windows: [[10, 13]] },
  { id: "N4", frames: 38, cancel: 28, branch: 24, charge: "C5", windows: [[14, 23]] },
  { id: "N5", frames: 50, cancel: 32, branch: 22, charge: "C6", windows: [[12, 14], [19, 21]] },
  { id: "N6", frames: 48, cancel: 38, charge: "C1", windows: [[15, 18]], heavy: true },
]
const ABSORB = 8

const ACC = "oklch(0.62 0.14 250)"
const HOT = "oklch(0.72 0.15 75)"
const FREEZE = "oklch(0.6 0.19 27)"

const lightStop = (v: number) => (v <= 0 ? 0 : Math.min(4, 1 + Math.floor((v - 1) / 5)))

type Placed = {
  m: Move
  start: number
  end: number
  stops: { at: number; len: number }[]
  wins: { a: number; b: number }[]
  onset: number
  branchAt: number | null
}

function schedule(victims: number, absorb: boolean): Placed[] {
  const out: Placed[] = []
  let start = 0
  for (const m of MOVES) {
    const per = m.heavy ? (victims > 0 ? 7 : 0) : lightStop(victims)
    // lay the move out in wall frames: each window freezes the hero on its first frame
    let frozen = 0
    const stops: { at: number; len: number }[] = []
    const wins: { a: number; b: number }[] = []
    for (const [a, b] of m.windows) {
      const wa = start + a + frozen
      if (per) stops.push({ at: wa, len: per })
      frozen += per
      wins.push({ a: wa, b: start + b + frozen })
    }
    const onset = start + m.windows[0][0]
    const branchAt = m.branch != null ? start + m.branch + frozen : null
    let end: number
    if (m.heavy) end = start + m.frames + frozen
    else end = start + m.cancel + (absorb ? Math.max(0, frozen - ABSORB) : frozen)
    out.push({ m, start, end, stops, wins, onset, branchAt })
    start = end
  }
  return out
}

const X0 = 40
const X1 = 732
const MAXF = 216
const x = (f: number) => X0 + ((X1 - X0) * f) / MAXF
const ROW = 30

export function ComboBeat() {
  const [victims, setVictims] = useState(12)
  const [absorb, setAbsorb] = useState(true)

  const plan = useMemo(() => schedule(victims, absorb), [victims, absorb])
  const shipped = useMemo(() => schedule(victims, true), [victims])
  const bare = useMemo(() => schedule(victims, false), [victims])

  const onsets = plan.map((p) => p.onset)
  const gaps = onsets.slice(1).map((o, i) => o - onsets[i])
  const n6 = (s: Placed[]) => s[5].onset
  const H = 44 + ROW * MOVES.length + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">src/hero/moves.js · the N1–N6 string</span>
        <span className="font-mono text-[10px] text-muted-foreground">sim frames · a perfect mash</span>
      </div>

      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            soldiers caught by each window:{" "}
            <span className="text-foreground tabular-nums">{victims}</span> → hero frozen{" "}
            <span className="text-foreground tabular-nums">{lightStop(victims)}</span> frames per light window
          </span>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={victims}
            onChange={(e) => setVictims(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
            aria-label="soldiers caught by each hit window"
          />
        </label>
        <div className="flex gap-1.5">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setAbsorb(v)}
              aria-pressed={absorb === v}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                absorb === v ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={absorb === v ? { background: ACC, borderColor: ACC } : undefined}
            >
              {v ? "ABSORB = 8 (shipped)" : "no absorb"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-2 py-3 sm:px-3">
        <svg
          viewBox={`0 0 760 ${H}`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label={`Timeline of the six-hit normal string in sim frames. With ${victims} soldiers caught per window and ${absorb ? "the shipped hitstop absorption" : "no absorption"}, the six strikes land on frames ${onsets.join(", ")}.`}
        >
          {[0, 30, 60, 90, 120, 150, 180].map((f) => (
            <g key={f}>
              <line x1={x(f)} x2={x(f)} y1={24} y2={H - 22} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x(f)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {f}
              </text>
            </g>
          ))}
          <text x={X1} y={H - 8} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            frames (60 = 1 s)
          </text>

          {plan.map((p, i) => {
            const y = 32 + i * ROW
            return (
              <g key={p.m.id}>
                <text x={4} y={y + 13} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                  {p.m.id}
                </text>
                <rect
                  x={x(p.start)}
                  y={y + 3}
                  width={Math.max(1, x(p.end) - x(p.start))}
                  height={14}
                  rx={3}
                  className="fill-muted/40"
                  stroke="var(--border)"
                />
                {p.wins.map((w, k) => (
                  <rect
                    key={`w${k}`}
                    x={x(w.a)}
                    y={y + 3}
                    width={Math.max(1.5, x(w.b + 1) - x(w.a))}
                    height={14}
                    fill={HOT}
                    opacity={0.55}
                  />
                ))}
                {p.stops.map((s, k) => (
                  <rect key={`s${k}`} x={x(s.at)} y={y + 1} width={x(s.at + s.len) - x(s.at)} height={18} fill={FREEZE} opacity={0.85} />
                ))}
                <path
                  d={`M ${x(p.onset)} ${y - 1} l 4 4 l -4 4 l -4 -4 z`}
                  fill={ACC}
                />
                <text x={x(p.onset) + 6} y={y + 1} className="font-mono" style={{ fontSize: 8.5, fill: ACC }}>
                  {p.onset}
                </text>
                {p.branchAt != null ? (
                  <g>
                    <line x1={x(p.branchAt)} x2={x(p.branchAt)} y1={y + 17} y2={y + 23} stroke="var(--muted-foreground)" />
                    <text x={x(p.branchAt) + 2} y={y + 26} className="fill-muted-foreground font-mono" style={{ fontSize: 7.5 }}>
                      {p.m.charge}
                    </text>
                  </g>
                ) : null}
              </g>
            )
          })}

          <g transform="translate(40 10)">
            <rect width={10} height={8} fill={HOT} opacity={0.55} />
            <text x={14} y={7.5} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>active window</text>
            <rect x={110} width={10} height={8} fill={FREEZE} opacity={0.85} />
            <text x={124} y={7.5} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>hero frozen (hitstop)</text>
            <path d="M 262 0 l 4 4 l -4 4 l -4 -4 z" fill={ACC} />
            <text x={270} y={7.5} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>first active frame</text>
            <line x1={384} x2={384} y1={0} y2={8} stroke="var(--muted-foreground)" />
            <text x={388} y={7.5} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>a charge press here branches to C2–C6</text>
          </g>
        </svg>
      </div>

      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>
          strike spacing: <span className="text-foreground tabular-nums">{gaps.join(" · ")}</span> frames
        </span>
        <span>
          N6 lands at frame{" "}
          <span className="text-foreground tabular-nums">{n6(shipped)}</span> shipped,{" "}
          <span className="text-foreground tabular-nums">{n6(bare)}</span> without absorption
        </span>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The cancel test counts frames the hero spent frozen, up to eight, as if the move had kept playing. Two light windows at the
        four-frame cap freeze him for exactly eight, so on the shipped setting the five light strikes land on the same frames in an
        empty field and in a packed ring. Only N6, which is armoured and never absorbs, gets longer. Switch absorption off to see what
        the one constant is worth.
      </p>
    </figure>
  )
}
