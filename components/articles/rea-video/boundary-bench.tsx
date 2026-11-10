"use client"

import { useState } from "react"

// Three 30 fps test clips I made with ffmpeg (lavfi sources, concat and xfade),
// with their transitions known to the frame. Each was run through my own
// re-typing of rea-video's shot-boundary rules (rea_video/shots.py at commit
// 356815c; not their code, which the sandbox would not let me execute) and
// through ffmpeg's scdet filter at its default threshold of 10. A detection
// counts as a hit when it lands inside a transition's span, give or take three
// frames; each transition can be hit once, every other detection is a false one.

type Kind = "cut" | "dissolve" | "fade" | "wipe" | "flash"
type Span = { kind: Kind; a: number; b: number; note: string }
type Clip = {
  id: string
  label: string
  blurb: string
  n: number
  truth: Span[]
  rea: number[]
  reaKinds: string[]
  scdet: number[]
  score: { rea: [number, number, number]; scdet: [number, number, number] }
}

const CLIPS: Clip[] = [
  {
    id: "fair",
    label: "fair clip",
    blurb: "0.25 s cross-dissolve (the length in rea-video's own eval), a two-frame flash inside a shot, slow and fast pans, x264 CRF 18.",
    n: 575,
    truth: [
      { kind: "cut", a: 90, b: 90, note: "test pattern to Mandelbrot zoom" },
      { kind: "cut", a: 180, b: 180, note: "to Game of Life" },
      { kind: "dissolve", a: 263, b: 270, note: "0.25 s cross-dissolve into a fast pan" },
      { kind: "cut", a: 353, b: 353, note: "pan to colour bars" },
      { kind: "flash", a: 398, b: 399, note: "two-frame flash inside the bars shot: not a boundary" },
      { kind: "fade", a: 413, b: 442, note: "1 s dip to black" },
      { kind: "wipe", a: 485, b: 503, note: "0.6 s wipe left" },
    ],
    rea: [90, 180, 270, 353, 416, 428, 493],
    reaKinds: ["cut", "cut", "cut", "cut", "cut", "cut", "wipe"],
    scdet: [90, 180, 267, 273, 279, 285, 291, 297, 303, 309, 315, 321, 327, 333, 339, 345, 351, 398, 400, 429, 435, 441, 447, 453, 459, 465, 471, 477, 483, 489, 495],
    score: { rea: [6, 1, 0], scdet: [6, 25, 0] },
  },
  {
    id: "lo",
    label: "fair clip, re-encoded",
    blurb: "The same clip scaled to 480 px and re-encoded at CRF 38: 3.9 MB down to 0.21 MB, a stand-in for a platform download.",
    n: 575,
    truth: [
      { kind: "cut", a: 90, b: 90, note: "test pattern to Mandelbrot zoom" },
      { kind: "cut", a: 180, b: 180, note: "to Game of Life" },
      { kind: "dissolve", a: 263, b: 270, note: "0.25 s cross-dissolve into a fast pan" },
      { kind: "cut", a: 353, b: 353, note: "pan to colour bars" },
      { kind: "flash", a: 398, b: 399, note: "two-frame flash inside the bars shot: not a boundary" },
      { kind: "fade", a: 413, b: 442, note: "1 s dip to black" },
      { kind: "wipe", a: 485, b: 503, note: "0.6 s wipe left" },
    ],
    rea: [90, 180, 266, 353, 416, 436, 493],
    reaKinds: ["cut", "cut", "cut", "cut", "cut", "cut", "wipe"],
    scdet: [90, 180, 273, 277, 279, 283, 285, 290, 292, 296, 301, 303, 309, 313, 315, 320, 322, 325, 327, 331, 333, 337, 339, 343, 345, 349, 351, 353, 398, 400],
    score: { rea: [6, 1, 0], scdet: [4, 26, 2] },
  },
  {
    id: "stress",
    label: "stress clip",
    blurb: "A 0.5 s dissolve out of a dark, busy shot, a three-frame flash, and a wipe out of a shot of moving noise.",
    n: 567,
    truth: [
      { kind: "cut", a: 90, b: 90, note: "test pattern to Mandelbrot zoom" },
      { kind: "cut", a: 180, b: 180, note: "to Game of Life" },
      { kind: "dissolve", a: 255, b: 270, note: "0.5 s cross-dissolve into a fast pan" },
      { kind: "cut", a: 345, b: 345, note: "pan to colour bars" },
      { kind: "flash", a: 390, b: 392, note: "three-frame flash inside the bars shot: not a boundary" },
      { kind: "fade", a: 405, b: 435, note: "1 s dip to black" },
      { kind: "wipe", a: 477, b: 495, note: "0.6 s wipe out of a noise field" },
    ],
    rea: [90, 180, 256, 270, 345, 390, 408, 421],
    reaKinds: ["cut", "cut", "cut", "cut", "cut", "cut", "cut", "dissolve"],
    scdet: [90, 180, 265, 271, 277, 283, 289, 295, 301, 307, 313, 319, 325, 331, 337, 343, 390, 393],
    score: { rea: [5, 3, 1], scdet: [4, 14, 2] },
  },
]

const COLORS: Record<Kind, string> = {
  cut: "oklch(0.62 0.17 250)",
  dissolve: "oklch(0.7 0.15 150)",
  fade: "oklch(0.55 0.02 260)",
  wipe: "oklch(0.72 0.15 70)",
  flash: "oklch(0.65 0.2 25)",
}

const W = 720
const PADL = 92
const PADR = 12
const ROW = 34

function hit(c: Clip, f: number) {
  return c.truth.some((s) => s.kind !== "flash" && f >= s.a - 3 && f <= s.b + 3)
}

export function BoundaryBench() {
  const [id, setId] = useState("fair")
  const [hover, setHover] = useState<number | null>(null)
  const c = CLIPS.find((x) => x.id === id) ?? CLIPS[0]
  const x = (f: number) => PADL + (f / c.n) * (W - PADL - PADR)
  const H = 30 + ROW * 3 + 24
  const rows: { label: string; dets: number[]; kinds?: string[] }[] = [
    { label: "rea rules", dets: c.rea, kinds: c.reaKinds },
    { label: "ffmpeg scdet", dets: c.scdet },
  ]
  const f1 = ([tp, fp, fn]: [number, number, number]) => {
    const p = tp / (tp + fp)
    const r = tp / (tp + fn)
    return ((2 * p * r) / (p + r)).toFixed(2)
  }
  const tip = hover === null ? null : c.truth[hover]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>shot boundaries on clips with known cuts</span>
        <span className="text-muted-foreground/50">measured · 3 clips × 2 detectors</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs" role="group" aria-label="test clip">
          {CLIPS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setId(k.id)}
              aria-pressed={k.id === id}
              className={`rounded-md border px-3 py-1.5 ${k.id === id ? "border-foreground bg-muted/40" : "text-muted-foreground"}`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">{c.blurb}</p>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Timeline of the ${c.label}: true transitions on the top row, rea-video's rules (re-typed) on the second row, ffmpeg scdet on the third. Ticks on a transition are hits; ticks elsewhere are false boundaries.`}
        >
          <text x={6} y={30 + ROW * 0 + 14} fontSize={11} className="font-mono" fill="var(--muted-foreground)">
            truth
          </text>
          {c.truth.map((s, i) => (
            <rect
              key={i}
              x={x(s.a) - 1.5}
              y={30 + 4}
              width={Math.max(3, x(s.b) - x(s.a) + 3)}
              height={ROW - 12}
              rx={2}
              fill={COLORS[s.kind]}
              opacity={hover === i ? 1 : 0.8}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${s.kind} at frames ${s.a} to ${s.b}: ${s.note}`}
            />
          ))}
          {rows.map((r, ri) => {
            const y = 30 + ROW * (ri + 1)
            return (
              <g key={r.label}>
                <text x={6} y={y + 14} fontSize={11} className="font-mono" fill="var(--muted-foreground)">
                  {r.label}
                </text>
                <line x1={PADL} x2={W - PADR} y1={y + ROW / 2 - 2} y2={y + ROW / 2 - 2} stroke="var(--muted-foreground)" strokeOpacity={0.25} />
                {r.dets.map((f, i) => {
                  const ok = hit(c, f)
                  return (
                    <g key={i}>
                      <line
                        x1={x(f)}
                        x2={x(f)}
                        y1={y + 3}
                        y2={y + ROW - 7}
                        stroke={ok ? "oklch(0.6 0.15 150)" : "oklch(0.62 0.2 25)"}
                        strokeWidth={2}
                      />
                      {r.kinds && r.kinds[i] !== "cut" ? (
                        <text x={x(f) + 3} y={y + 9} fontSize={9} className="font-mono" fill="var(--muted-foreground)">
                          {r.kinds[i]}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
          {[0, 3, 6, 9, 12, 15, 18].map((s) => (
            <g key={s}>
              <line x1={x(s * 30)} x2={x(s * 30)} y1={H - 22} y2={H - 18} stroke="var(--muted-foreground)" />
              <text x={x(s * 30)} y={H - 6} textAnchor="middle" fontSize={10} className="font-mono" fill="var(--muted-foreground)">
                {s} s
              </text>
            </g>
          ))}
        </svg>
        <div className="flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
          {(Object.keys(COLORS) as Kind[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} />
              {k === "flash" ? "flash (trap, not a boundary)" : k}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5" style={{ background: "oklch(0.6 0.15 150)" }} /> hit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5" style={{ background: "oklch(0.62 0.2 25)" }} /> false boundary
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="rea rules: hits / false / missed" v={c.score.rea.join(" / ")} />
          <Cell k="rea rules F1" v={f1(c.score.rea)} />
          <Cell k="scdet: hits / false / missed" v={c.score.scdet.join(" / ")} />
          <Cell k="scdet F1" v={f1(c.score.scdet)} />
        </div>
        <p className="min-h-[2.5rem] font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {tip
            ? `${tip.kind}, frames ${tip.a}-${tip.b}: ${tip.note}.`
            : "Hover or tab to a coloured block for what it is. Small labels on the rea row are the transition type the rules assigned; unlabelled ticks were called plain cuts."}
        </p>
      </div>
    </figure>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
