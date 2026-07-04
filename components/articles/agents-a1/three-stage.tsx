"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Agents-A1's three-stage training recipe, drawn as a pipeline. The arc: broaden the
// base, specialize per domain, then fold every specialist back into one deployable
// student via on-policy distillation. Pick a stage to inspect it; the diagram lights
// the node that stage produces. Auto-advances. Degrades to a static panel with no JS.

const ACCENT = "oklch(0.72 0.15 195)"

const STAGES = [
  {
    key: "sft",
    name: "1 · full-domain SFT",
    what: "Supervised fine-tune the 35B base on agentic trajectories from every domain at once.",
    why: "Aligns the base model with broad agent behaviors — planning, tool calls, reading observations — so later stages have a competent generalist to sharpen, not a blank slate.",
  },
  {
    key: "teachers",
    name: "2 · domain teachers",
    what: "Train a separate expert model for each domain (search, engineering, science, instructions, tools).",
    why: "One model pulled toward six specialties dilutes each. Specialist teachers go deep where a generalist can't, giving the next stage stronger, more varied supervision than any single model could.",
  },
  {
    key: "distill",
    name: "3 · multi-teacher distillation",
    what: "Distill all domain teachers into one student on the student's own rollouts, routing each trajectory to the right teacher.",
    why: "On-policy (student-sampled) distillation kills exposure bias; domain routing picks the teacher that owns each task; salient-vocabulary alignment focuses the loss on the tokens that carry the capability. Six specialists collapse into one deployable 35B.",
  },
] as const

// scene geometry (viewBox units)
const W = 760
const H = 180
const BASE = { x: 44, y: 62, w: 156, h: 56 }
const TEA = { cx: 380, top: 40, pillW: 152, pillH: 17, n: 5 }
const STU = { x: 560, y: 62, w: 156, h: 56 }
const teaY = (i: number) => TEA.top + i * ((136 - TEA.top) / (TEA.n - 1))

export function ThreeStage() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const curveH = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  const baseCy = BASE.y + BASE.h / 2
  const stuCy = STU.y + STU.h / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>training recipe · base → teachers → student</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Three-stage pipeline, showing stage ${i + 1}: ${STAGES[i].name}`}>
          <defs>
            <marker id="a1ts-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="a1ts-arrow-mute" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="a1ts-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* base → teachers */}
          <path d={curveH(BASE.x + BASE.w, baseCy, TEA.cx - TEA.pillW / 2, 88)} fill="none" stroke={i >= 1 ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.6} markerEnd={i >= 1 ? "url(#a1ts-arrow)" : "url(#a1ts-arrow-mute)"} opacity={i >= 1 ? 0.9 : 0.5} className="transition-all duration-300" />
          {/* teachers → student (the distillation) */}
          <path d={curveH(TEA.cx + TEA.pillW / 2, 88, STU.x, stuCy)} fill="none" stroke={i >= 2 ? ACCENT : "var(--muted-foreground)"} strokeWidth={1.6} markerEnd={i >= 2 ? "url(#a1ts-arrow)" : "url(#a1ts-arrow-mute)"} opacity={i >= 2 ? 0.9 : 0.5} className="transition-all duration-300" />

          {/* base node */}
          <g onClick={() => setI(0)} className="cursor-pointer">
            <rect x={BASE.x} y={BASE.y} width={BASE.w} height={BASE.h} rx={10} fill="var(--background)" stroke={i === 0 ? ACCENT : "var(--border)"} strokeWidth={i === 0 ? 2 : 1.5} filter={i === 0 ? "url(#a1ts-soft)" : undefined} className="transition-all duration-300" />
            <text x={BASE.x + BASE.w / 2} y={baseCy - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>35B base</text>
            <text x={BASE.x + BASE.w / 2} y={baseCy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>full-domain SFT</text>
          </g>

          {/* teacher pills (multiplicity) */}
          <g onClick={() => setI(1)} className="cursor-pointer">
            {Array.from({ length: TEA.n }, (_, k) => (
              <rect
                key={k}
                x={TEA.cx - TEA.pillW / 2}
                y={teaY(k)}
                width={TEA.pillW}
                height={TEA.pillH}
                rx={5}
                fill={i === 1 ? "var(--background)" : "var(--muted)"}
                stroke={i === 1 ? ACCENT : "var(--border)"}
                strokeWidth={i === 1 ? 1.6 : 1.2}
                opacity={i === 1 ? 1 : 0.7}
                filter={i === 1 ? "url(#a1ts-soft)" : undefined}
                className="transition-all duration-300"
              />
            ))}
            <text x={TEA.cx} y={teaY(0) + TEA.pillH / 2 + 3} textAnchor="middle" className={cn("font-mono", i === 1 ? "fill-foreground" : "fill-muted-foreground")} fontSize={9} fontWeight={600}>domain teachers · ×5 specialists</text>
          </g>

          {/* student node */}
          <g onClick={() => setI(2)} className="cursor-pointer">
            <rect x={STU.x} y={STU.y} width={STU.w} height={STU.h} rx={10} fill="var(--background)" stroke={i === 2 ? ACCENT : "var(--border)"} strokeWidth={i === 2 ? 2 : 1.5} filter={i === 2 ? "url(#a1ts-soft)" : undefined} className="transition-all duration-300" />
            <text x={STU.x + STU.w / 2} y={stuCy - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>one 35B student</text>
            <text x={STU.x + STU.w / 2} y={stuCy + 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>deployable</text>
          </g>

          <text x={TEA.cx} y={teaY(TEA.n - 1) + 22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>on-policy distillation, domain-routed</text>
        </svg>

        {/* segmented stage control */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">stage</span>
          {STAGES.map((st, k) => (
            <button
              key={st.key}
              type="button"
              onClick={() => { setPlaying(false); setI(k) }}
              aria-pressed={k === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-all",
                k === i ? "border-transparent text-background" : "text-muted-foreground hover:border-foreground/40",
              )}
              style={k === i ? { background: ACCENT } : undefined}
            >
              {st.name}
            </button>
          ))}
        </div>

        {/* what / why — grid-stacked so height never shifts */}
        <div className="mt-3 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ borderLeftColor: ACCENT }}
            >
              <div className="font-mono text-xs text-foreground">{st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span>{" "}
                <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span>{" "}
                <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
