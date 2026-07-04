"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Multi-teacher domain-routed on-policy distillation, drawn as a routed network. The
// student rolls out a trajectory; a router reads its domain and selects the matching
// specialist teacher; that teacher's token distribution supervises the student's *own*
// tokens (on-policy), with the loss focused on salient, capability-bearing tokens. One
// specialist per task, all folded into one student. Auto-cycles; click a teacher to pin.

const TEACHERS = [
  { key: "search", name: "search teacher", task: "“Find the 2024 paper that first reported …”", hue: 25 },
  { key: "eng", name: "engineering teacher", task: "“Patch the failing test in this repo.”", hue: 150 },
  { key: "science", name: "science teacher", task: "“Derive the binding free energy for …”", hue: 265 },
  { key: "instruct", name: "instruction teacher", task: "“Answer in exactly 3 bullets, no numbers.”", hue: 320 },
  { key: "tools", name: "tool-calling teacher", task: "“Book the flight via the travel API.”", hue: 80 },
] as const

const hueOf = (h: number) => `oklch(0.68 0.15 ${h})`

// scene geometry (viewBox units)
const W = 760
const H = 330
const ROLL = { x: 96, y: 118, w: 132, h: 46 }
const ROUTER = { x: 300, y: 118, cx: 300, w: 96, h: 46 }
const TX = 592 // teacher node center x
const TW = 128
const TH = 34
const ty = (i: number) => 44 + i * ((248 - 44) / (TEACHERS.length - 1))
const STUDENT = { cx: 300, cy: 288, w: 208, h: 42 }

export function DistillNetwork() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % TEACHERS.length), 2400)
    return () => clearInterval(id)
  }, [playing])

  const active = TEACHERS[i]
  const accent = hueOf(active.hue)

  // horizontal S-curve between two points
  const curveH = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }
  // vertical S-curve
  const curveV = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const routerRight = ROUTER.cx + ROUTER.w / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>multi-teacher domain-routed distillation · one student</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Router selects the ${active.name}, whose distribution supervises the student`}>
          <defs>
            <marker id="a1dn-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={accent} strokeWidth={1.5} />
            </marker>
            <marker id="a1dn-arrow-mute" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="a1dn-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* rollout → router */}
          <path d={curveH(ROLL.x + ROLL.w / 2, ROLL.y + ROLL.h / 2, ROUTER.cx - ROUTER.w / 2, ROUTER.y + ROUTER.h / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#a1dn-arrow-mute)" opacity={0.6} />

          {/* router → teachers (fan) */}
          {TEACHERS.map((t, k) => {
            const on = k === i
            return (
              <path
                key={t.key}
                d={curveH(routerRight, ROUTER.y + ROUTER.h / 2, TX - TW / 2, ty(k) + TH / 2)}
                fill="none"
                stroke={on ? hueOf(t.hue) : "var(--border)"}
                strokeWidth={on ? 1.8 : 1.2}
                markerEnd={on ? "url(#a1dn-arrow)" : undefined}
                opacity={on ? 0.95 : 0.4}
                className="transition-all duration-300"
              />
            )
          })}

          {/* selected teacher → student */}
          <path
            d={curveV(TX, ty(i) + TH / 2, STUDENT.cx + STUDENT.w / 2 - 30, STUDENT.cy - STUDENT.h / 2)}
            fill="none"
            stroke={accent}
            strokeWidth={1.8}
            markerEnd="url(#a1dn-arrow)"
            opacity={0.95}
            className="transition-all duration-300"
          />

          {/* rollout node */}
          <g filter="url(#a1dn-soft)">
            <rect x={ROLL.x} y={ROLL.y} width={ROLL.w} height={ROLL.h} rx={9} fill="var(--background)" stroke={accent} strokeWidth={1.5} className="transition-all duration-300" />
          </g>
          <text x={ROLL.x + ROLL.w / 2} y={ROLL.y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>student rollout</text>
          <text x={ROLL.x + ROLL.w / 2} y={ROLL.y + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>samples a trajectory</text>

          {/* router node */}
          <g filter="url(#a1dn-soft)">
            <rect x={ROUTER.cx - ROUTER.w / 2} y={ROUTER.y} width={ROUTER.w} height={ROUTER.h} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          </g>
          <text x={ROUTER.cx} y={ROUTER.y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>domain</text>
          <text x={ROUTER.cx} y={ROUTER.y + 34} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>router</text>

          {/* teacher nodes */}
          {TEACHERS.map((t, k) => {
            const on = k === i
            const hc = hueOf(t.hue)
            return (
              <g key={t.key} onClick={() => setI(k)} className="cursor-pointer" role="button" aria-pressed={on}>
                <rect
                  x={TX - TW / 2}
                  y={ty(k)}
                  width={TW}
                  height={TH}
                  rx={8}
                  fill={on ? "var(--background)" : "var(--muted)"}
                  stroke={on ? hc : "var(--border)"}
                  strokeWidth={on ? 2 : 1.2}
                  opacity={on ? 1 : 0.55}
                  filter={on ? "url(#a1dn-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <circle cx={TX - TW / 2 + 14} cy={ty(k) + TH / 2} r={4} fill={hc} opacity={on ? 1 : 0.6} />
                <text x={TX - TW / 2 + 24} y={ty(k) + TH / 2 + 3.5} className={cn("font-mono", on ? "fill-foreground" : "fill-muted-foreground")} fontSize={10} fontWeight={on ? 600 : 400}>{t.name}</text>
              </g>
            )
          })}

          {/* student node */}
          <g filter="url(#a1dn-soft)">
            <rect x={STUDENT.cx - STUDENT.w / 2} y={STUDENT.cy - STUDENT.h / 2} width={STUDENT.w} height={STUDENT.h} rx={9} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} strokeOpacity={0.5} />
          </g>
          <text x={STUDENT.cx} y={STUDENT.cy - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>Agents-A1 · one 35B student</text>
          <text x={STUDENT.cx} y={STUDENT.cy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>inherits every specialist — no teacher at inference</text>

          <text x={TX} y={ty(0) - 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>domain specialists</text>
        </svg>

        {/* the routed task — grid-stacked for stable height */}
        <div className="mt-2 rounded-md border-l-2 bg-muted/30 px-3 py-2" style={{ borderColor: accent }}>
          <div className="font-mono text-[10px] text-muted-foreground">this rollout&apos;s task · router matches it to the <span style={{ color: accent }}>{active.name}</span></div>
          <div className="mt-0.5 grid">
            {TEACHERS.map((t, k) => (
              <p
                key={t.key}
                aria-hidden={k !== i}
                className={cn(
                  "col-start-1 row-start-1 text-sm leading-6 text-foreground transition-opacity duration-300",
                  k === i ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                {t.task}
              </p>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The selected teacher&apos;s distribution supervises the student&apos;s{" "}
          <span className="text-foreground">own tokens</span> (on-policy), with the loss focused on the
          salient, capability-bearing tokens. Six specialists collapse into{" "}
          <span className="text-foreground">one deployable 35B</span> — none of the teachers ships.
        </p>
      </div>
    </figure>
  )
}
