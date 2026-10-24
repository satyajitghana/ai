"use client"

import { useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mhypot } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The ui variant's timeline, re-drawn by hand on a made-up card so you can
// scrub it. The phase windows, the 15 px dot grid with a 44 px margin, the
// 4.8 px dot gap, the part schedule (each part 0.2 of the build long, starts
// spread evenly over 0.28 to 0.54) and the two easing curves are the values in
// transitions.dev's skills/transitions-ui-generation/ui-generation.js. The
// drawing itself is mine and much simpler: no matrix rain, probe, reticle,
// flyers or handles, and no texts panels.

const W = 640
const H = 372
const CARD = { x: 200, y: 36, w: 240, h: 290, r: 18 }
const MG = 44
const SP = 15
const GAP = 4.8
const DURATION = 2400
const END = 1.09

type Win = readonly [number, number]
const PH: Record<string, Win> = {
  dots: [0, 0.3],
  probe: [0.02, 0.24],
  guides: [0.04, 0.3],
  outline: [0.1, 0.42],
  parts: [0.28, 0.74],
  reveal: [0.74, 1.055],
  clean: [0.84, 1.04],
}
const PHASE_ROWS: { key: string; label: string }[] = [
  { key: "dots", label: "dot field" },
  { key: "probe", label: "probe" },
  { key: "guides", label: "guides" },
  { key: "outline", label: "outline" },
  { key: "parts", label: "parts" },
  { key: "reveal", label: "reveal" },
  { key: "clean", label: "clean" },
]

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const win = (r: Win, p: number) => clamp((p - r[0]) / (r[1] - r[0]))
const smooth = (a: number, b: number, x: number) => {
  const q = clamp((x - a) / (b - a))
  return q * q * (3 - 2 * q)
}
// cubic-bezier(x1, y1, x2, y2) solved by bisection: only + - * /, so server
// and client agree to the last bit.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = (t: number) => 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t
  const cy = (t: number) => 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let m = 0.5
    for (let i = 0; i < 28; i++) {
      m = (lo + hi) / 2
      if (cx(m) < x) lo = m
      else hi = m
    }
    return cy(m)
  }
}
const OUT = bezier(0.16, 1, 0.3, 1)
const SMOOTH_OUT = bezier(0.22, 1, 0.36, 1)

const f1 = (n: number) => n.toFixed(1)

// Half a rounded rectangle, top centre to bottom centre, and its length
// (w + h - 4r + pi r), so the dotted stroke can be cut without measuring the DOM.
function rrHalf(x: number, y: number, w: number, h: number, r: number, cw: boolean) {
  const X = (v: number) => f1(x + v)
  const Y = (v: number) => f1(y + v)
  const R = f1(r)
  const d = cw
    ? `M${X(w / 2)} ${Y(0)}H${X(w - r)}A${R} ${R} 0 0 1 ${X(w)} ${Y(r)}V${Y(h - r)}A${R} ${R} 0 0 1 ${X(w - r)} ${Y(h)}H${X(w / 2)}`
    : `M${X(w / 2)} ${Y(0)}H${X(r)}A${R} ${R} 0 0 0 ${X(0)} ${Y(r)}V${Y(h - r)}A${R} ${R} 0 0 0 ${X(r)} ${Y(h)}H${X(w / 2)}`
  return { d, L: w + h - 4 * r + Math.PI * r }
}
function rrFull(x: number, y: number, w: number, h: number, r: number) {
  const a = rrHalf(x, y, w, h, r, true)
  const b = rrHalf(x, y, w, h, r, false)
  return [a, b]
}

// The dotted line: zero-length dashes with round caps, one every GAP px,
// as many as the drawn fraction q covers. Same trick as the runtime.
function dash(L: number, q: number) {
  const n = Math.floor((L * Math.min(1, q)) / GAP) + 1
  return `${`0 ${GAP} `.repeat(Math.max(0, n - 1))}0 ${f1(L + 10)}`
}

type Part = { name: string; strokes: { d: string; L: number }[] }
const C = CARD
const PARTS: Part[] = [
  { name: "button", strokes: rrFull(C.x + 16, C.y + 16, 28, 28, 14) },
  { name: "text", strokes: [{ d: `M${C.x + 96} ${C.y + 30}H${C.x + 144}`, L: 48 }] },
  { name: "button", strokes: rrFull(C.x + 196, C.y + 16, 28, 28, 14) },
  { name: "text", strokes: [{ d: `M${C.x + 66} ${C.y + 86}H${C.x + 174}`, L: 108 }] },
  { name: "frame", strokes: rrFull(C.x + 16, C.y + 122, 208, 84, 10) },
  { name: "text", strokes: [{ d: `M${C.x + 16} ${C.y + 229}H${C.x + 126}`, L: 110 }] },
  {
    name: "text",
    strokes: [
      { d: `M${C.x + 16} ${C.y + 256}H${C.x + 64}`, L: 48 },
      { d: `M${C.x + 90} ${C.y + 256}H${C.x + 138}`, L: 48 },
      { d: `M${C.x + 164} ${C.y + 256}H${C.x + 212}`, L: 48 },
    ],
  },
]
const N = PARTS.length
const SPAN = PH.parts[1] - PH.parts[0]
const PDUR = Math.min(0.2, SPAN * 0.6)
const SCHED = PARTS.map((_, i) => {
  const t0 = PH.parts[0] + (N > 1 ? (SPAN - PDUR) * (i / (N - 1)) : 0)
  return { t0, t1: t0 + PDUR }
})

const OUTLINE = rrFull(C.x, C.y, C.w, C.h, C.r)

const DOTS: { x: number; y: number; d: number; edge: number }[] = []
let MAXD = 0
for (let x = -Math.floor(MG / SP) * SP; x <= C.w + MG; x += SP) {
  for (let y = -Math.floor(MG / SP) * SP; y <= C.h + MG; y += SP) {
    const d = mhypot(x - C.w / 2, y - C.h / 2)
    const out = Math.max(0, -x, x - C.w, -y, y - C.h)
    DOTS.push({ x: C.x + x, y: C.y + y, d, edge: 1 - clamp(out / MG) })
    MAXD = Math.max(MAXD, d)
  }
}

const GUIDES = [
  `M${C.x - MG} ${C.y}H${C.x + C.w + MG}`,
  `M${C.x - MG} ${C.y + C.h}H${C.x + C.w + MG}`,
  `M${C.x} ${C.y - MG / 2}V${C.y + C.h + MG / 2}`,
  `M${C.x + C.w} ${C.y - MG / 2}V${C.y + C.h + MG / 2}`,
]
const GUIDE_L = [C.w + 2 * MG, C.w + 2 * MG, C.h + MG, C.h + MG]

function RealCard() {
  const chart = "M216 228 L236 226 L256 230 L268 204 L276 240 L292 214 L312 220 L332 196 L352 208 L372 186 L392 194 L412 176"
  return (
    <g>
      <rect x={C.x} y={C.y} width={C.w} height={C.h} rx={C.r} className="fill-background stroke-border" strokeWidth={1} />
      <circle cx={C.x + 30} cy={C.y + 30} r={14} className="fill-muted stroke-border" />
      <path d={`M${C.x + 33} ${C.y + 24} l-6 6 l6 6`} className="stroke-foreground" fill="none" strokeWidth={1.6} />
      <text x={C.x + C.w / 2} y={C.y + 34} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
        Heart rate
      </text>
      <circle cx={C.x + 210} cy={C.y + 30} r={14} className="fill-muted stroke-border" />
      <text x={C.x + 210} y={C.y + 34} textAnchor="middle" className="fill-foreground" fontSize={12}>
        ···
      </text>
      <text x={C.x + 110} y={C.y + 102} textAnchor="middle" className="fill-foreground" fontSize={44} fontWeight={500}>
        72
      </text>
      <text x={C.x + 150} y={C.y + 102} className="fill-muted-foreground" fontSize={14}>
        bpm
      </text>
      <rect x={C.x + 16} y={C.y + 122} width={208} height={84} rx={10} className="fill-muted/60" />
      <path d={chart} fill="none" stroke="oklch(0.63 0.2 25)" strokeWidth={2} />
      <text x={C.x + 16} y={C.y + 234} className="fill-foreground" fontSize={15} fontWeight={500}>
        Core strength
      </text>
      {["1.6", "2.2", "4.2"].map((v, i) => (
        <text key={v} x={C.x + 16 + i * 74} y={C.y + 261} className="fill-muted-foreground" fontSize={11}>
          {v} sec/sqt
        </text>
      ))}
    </g>
  )
}

export function GenerationScrubber() {
  const [k, setK] = useState(50)
  const [reduced, setReduced] = useState(false)
  const [playing, setPlaying] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    if (!playing) return
    const start = performance.now()
    const total = reduced ? 220 : END * DURATION
    const tick = (now: number) => {
      const t = Math.min(total, now - start)
      setK(Math.round((t / total) * 109))
      if (t < total) raf.current = requestAnimationFrame(tick)
      else setPlaying(false)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, reduced])

  const p = k / 100
  const ms = Math.round(p * DURATION)

  // reduced motion: no drawing at all, the card fades in over 200 ms
  const fadeQ = clamp((p / END) * 220 / 200)

  const clean = 1 - smooth(PH.clean[0], PH.clean[1], p)
  const R = OUT(win(PH.dots, p)) * (MAXD + 60)
  const sq = SMOOTH_OUT(win(PH.reveal, p))
  const scanY = C.y + sq * (C.h + 6) - 3
  const fq = SMOOTH_OUT(win([PH.reveal[0], PH.reveal[1] + 0.03], p))
  const revealing = p >= PH.reveal[0]
  const oq = OUT(win(PH.outline, p))
  const gOp = 0.5 * (1 - smooth(0.66, 0.92, p))
  const wireOp = 1 - 0.6 * fq
  const active = PHASE_ROWS.filter((r) => p >= PH[r.key][0] && p <= PH[r.key][1]).map((r) => r.label)
  const partNow = SCHED.reduce((acc, s, i) => (p >= s.t0 ? i : acc), -1)

  const desc = reduced
    ? `Reduced motion: no drawing. The card fades in over 200 milliseconds and is ${Math.round(fadeQ * 100)} percent in.`
    : `At ${ms} milliseconds of a 2,400 millisecond build (progress ${p.toFixed(2)}), the active phases are ${
        active.length ? active.join(", ") : "none: the overlay is gone"
      }. ${partNow >= 0 && p < PH.reveal[0] ? `Part ${partNow + 1} of ${N} has started tracing.` : ""}${
        revealing ? ` The scan line has revealed ${Math.round(sq * 100)} percent of the card.` : ""
      }`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the ui variant, phase by phase</span>
        <span className="text-muted-foreground/60">windows and curves from ui-generation.js</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="shrink-0">progress</span>
          <Range
            min={0}
            max={109}
            step={1}
            value={k}
            onChange={(e) => {
              setPlaying(false)
              setK(Number(e.target.value))
            }}
            aria-label="Build progress, as a fraction of duration"
            className="flex-1"
          />
          <span className="w-24 shrink-0 text-right tabular-nums text-foreground">
            {p.toFixed(2)} · {reduced ? Math.round((p / END) * 220) : ms} ms
          </span>
        </label>
        <div className="flex gap-2 font-mono text-[11px]">
          <button
            type="button"
            onClick={() => {
              setK(0)
              setPlaying(true)
            }}
            className="rounded-md border px-2.5 py-1 hover:bg-muted"
          >
            play
          </button>
          <button
            type="button"
            aria-pressed={reduced}
            onClick={() => setReduced((r) => !r)}
            className={cn("rounded-md border px-2.5 py-1 hover:bg-muted", reduced && "bg-foreground text-background hover:bg-foreground/90")}
          >
            reduced motion
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={desc}>
        <defs>
          <clipPath id="tdev-scan">
            <rect x={0} y={revealing ? scanY : -999} width={W} height={H + 999} />
          </clipPath>
          <clipPath id="tdev-real">
            <rect x={0} y={0} width={W} height={revealing ? Math.max(0, scanY) : 0} />
          </clipPath>
        </defs>

        {reduced ? (
          <g opacity={fadeQ}>
            <RealCard />
          </g>
        ) : (
          <>
            {p < END && (
              <g className="text-muted-foreground">
                {DOTS.map((d, i) => {
                  const lag = R - d.d
                  const env = clamp(lag / 50)
                  const under = revealing && d.y < scanY && d.edge === 1 ? 0 : 1
                  const op = env * 0.5 * d.edge * clean * under
                  return op > 0.01 ? <circle key={i} cx={d.x} cy={d.y} r={1.05} fill="currentColor" opacity={op} /> : null
                })}
              </g>
            )}

            <g
              className="text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.1}
              clipPath="url(#tdev-scan)"
              opacity={p < END ? wireOp : 0}
            >
              {GUIDES.map((d, i) => {
                const q = OUT(clamp((p - PH.guides[0] - i * 0.03) / (PH.guides[1] - PH.guides[0] - 0.09)))
                return q > 0 ? (
                  <path key={`g${i}`} d={d} strokeDasharray={dash(GUIDE_L[i], q)} opacity={gOp} strokeWidth={1.4} />
                ) : null
              })}
              {oq > 0 && OUTLINE.map((s, i) => <path key={`o${i}`} d={s.d} strokeDasharray={dash(s.L, oq)} />)}
              {PARTS.map((pt, i) => {
                const q = clamp((p - SCHED[i].t0) / (SCHED[i].t1 - SCHED[i].t0))
                if (q <= 0) return null
                return pt.strokes.map((s, j) => (
                  <path key={`p${i}-${j}`} d={s.d} strokeDasharray={dash(s.L, OUT(q))} className="text-foreground/70" />
                ))
              })}
            </g>

            {revealing && (
              <g clipPath="url(#tdev-real)" opacity={fq} style={{ filter: fq < 0.99 ? `blur(${f1(3 * (1 - fq))}px)` : undefined }}>
                <RealCard />
              </g>
            )}
            {revealing && p < PH.reveal[1] && (
              <line
                x1={C.x - 20}
                x2={C.x + C.w + 20}
                y1={scanY}
                y2={scanY}
                className="text-foreground/60"
                stroke="currentColor"
                strokeDasharray="0 5"
                strokeLinecap="round"
                strokeWidth={2}
              />
            )}
            {p > PH.outline[0] && p < 0.9 && (
              <text x={C.x} y={C.y - 10} className="fill-muted-foreground font-mono" fontSize={10}>
                {Math.round(C.w * oq)} × {Math.round(C.h * oq)}   t+{((Math.min(p, 1) * DURATION) / 1000).toFixed(2)}s
              </text>
            )}
          </>
        )}
      </svg>

      <div className="grid gap-1 border-t px-4 py-3 font-mono text-[10.5px] text-muted-foreground">
        {PHASE_ROWS.map((r) => {
          const [a, b] = PH[r.key]
          const on = !reduced && p >= a && p <= b
          return (
            <div key={r.key} className="flex items-center gap-3">
              <span className={cn("w-20 shrink-0", on && "text-foreground")}>{r.label}</span>
              <div className="relative h-2.5 flex-1 rounded-sm bg-muted/50">
                <div
                  className={cn("absolute inset-y-0 rounded-sm", on ? "bg-foreground/70" : "bg-foreground/20")}
                  style={{ left: `${(a / END) * 100}%`, width: `${((b - a) / END) * 100}%` }}
                />
                <div className="absolute inset-y-[-3px] w-px bg-foreground" style={{ left: `${(Math.min(p, END) / END) * 100}%` }} />
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums">
                {a.toFixed(2)}–{b.toFixed(3).replace(/0$/, "")}
              </span>
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {desc} The card and its drawing are mine; the phase windows, the dot grid, the dot gap, the part schedule and the
        two ease-out curves are the runtime&apos;s. Toggle reduced motion to see the whole of what the runtime does then.
      </figcaption>
    </figure>
  )
}
