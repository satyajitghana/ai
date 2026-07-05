"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// Action-CoT: before it renders a single frame, Cosmos turns an instruction into a
// 2D motion plan ON THE IMAGE PLANE — a chain-of-thought expressed as where things
// should move, not as words. Pick an instruction; scrub to watch the plan get drawn
// as a trajectory of waypoints across the frame, with a gripper tracing it. The
// generator then denoises frames that realize this motion. Illustrative.

const PLAN = "oklch(0.66 0.16 150)" // Cosmos green
const W = 760
const H = 340
// image-plane rect
const PX = 56
const PY = 44
const PW = 470
const PH = 262
const fx = (f: number) => PX + f * PW
const fy = (f: number) => PY + f * PH

type Instr = {
  key: string
  label: string
  target: string
  pts: [number, number][] // normalized image-plane waypoints
}

const INSTRUCTIONS: Instr[] = [
  { key: "mug", label: "reach for the mug", target: "mug", pts: [[0.10, 0.84], [0.34, 0.60], [0.60, 0.36], [0.80, 0.22]] },
  { key: "push", label: "push the block right", target: "block", pts: [[0.16, 0.66], [0.38, 0.63], [0.60, 0.61], [0.84, 0.58]] },
  { key: "drawer", label: "open the drawer", target: "handle", pts: [[0.34, 0.28], [0.47, 0.46], [0.55, 0.64], [0.60, 0.84]] },
]

// smooth cubic path through waypoints (quadratic-to-midpoint smoothing)
function smooth(pts: [number, number][]): string {
  const P = pts.map(([a, b]) => [fx(a), fy(b)] as const)
  if (P.length < 2) return ""
  let d = `M ${P[0][0]} ${P[0][1]}`
  for (let i = 1; i < P.length - 1; i++) {
    const [cx, cy] = P[i]
    const [nx, ny] = P[i + 1]
    d += ` Q ${cx} ${cy}, ${(cx + nx) / 2} ${(cy + ny) / 2}`
  }
  const last = P[P.length - 1]
  d += ` L ${last[0]} ${last[1]}`
  return d
}

export function ActionCoT() {
  const [instr, setInstr] = useState(INSTRUCTIONS[0])
  const [t, setT] = useState(1)
  const pathRef = useRef<SVGPathElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: fx(instr.pts[0][0]), y: fy(instr.pts[0][1]) })

  useEffect(() => {
    const p = pathRef.current
    if (!p) return
    const L = p.getTotalLength()
    const { x, y } = p.getPointAtLength(L * t)
    setPos({ x, y })
  }, [t, instr])

  const start = instr.pts[0]
  const end = instr.pts[instr.pts.length - 1]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>action-CoT · instruction → motion on the image plane</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`An image-plane frame. The instruction "${instr.label}" is turned into a motion plan: a trajectory of waypoints from the gripper's start to the ${instr.target}.`}>
          <defs>
            <marker id="ac-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={PLAN} strokeWidth={1.5} />
            </marker>
            <filter id="ac-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* the image plane */}
          <rect x={PX} y={PY} width={PW} height={PH} rx={10} fill="var(--muted)" opacity={0.18} stroke="var(--border)" strokeWidth={1.2} />
          {/* faint plane grid */}
          {[0.25, 0.5, 0.75].map((g) => (
            <g key={g} stroke="var(--border)" strokeWidth={0.75} opacity={0.4}>
              <line x1={fx(g)} y1={PY} x2={fx(g)} y2={PY + PH} />
              <line x1={PX} y1={fy(g)} x2={PX + PW} y2={fy(g)} />
            </g>
          ))}
          <text x={PX + 6} y={PY + 16} className="fill-muted-foreground font-mono" fontSize={9}>image plane · frame t</text>

          {/* target object */}
          <g>
            <circle cx={fx(end[0])} cy={fy(end[1])} r={13} fill="none" stroke={PLAN} strokeWidth={1.4} opacity={0.6} strokeDasharray="3 3" />
            <circle cx={fx(end[0])} cy={fy(end[1])} r={6} fill={PLAN} opacity={0.9} />
            <text x={fx(end[0])} y={fy(end[1]) - 20} textAnchor="middle" className="font-mono" fontSize={10} fill={PLAN}>{instr.target}</text>
          </g>

          {/* full plan path (faint) + revealed portion */}
          <path d={smooth(instr.pts)} fill="none" stroke="var(--border)" strokeWidth={1.5} opacity={0.5} />
          <path
            ref={pathRef}
            d={smooth(instr.pts)}
            fill="none"
            stroke={PLAN}
            strokeWidth={2.25}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - t}
            markerEnd={t > 0.985 ? "url(#ac-arr)" : undefined}
            className="transition-all duration-150"
          />

          {/* waypoint nodes */}
          {instr.pts.slice(1, -1).map(([a, b], i) => (
            <circle key={i} cx={fx(a)} cy={fy(b)} r={3.5} fill="var(--background)" stroke={PLAN} strokeWidth={1.4} />
          ))}

          {/* start node */}
          <g>
            <circle cx={fx(start[0])} cy={fy(start[1])} r={5} fill="var(--background)" stroke={PLAN} strokeWidth={1.6} />
            <text x={fx(start[0])} y={fy(start[1]) + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>start</text>
          </g>

          {/* moving gripper marker */}
          <g filter="url(#ac-soft)">
            <circle cx={pos.x} cy={pos.y} r={8} fill={PLAN} opacity={0.95} />
            <circle cx={pos.x} cy={pos.y} r={3} fill="var(--background)" />
          </g>

          {/* instruction chip inside the header area of the plane */}
          <g>
            <rect x={PX + PW - 216} y={PY + 8} width={210} height={26} rx={7} fill="var(--background)" stroke={PLAN} strokeWidth={1.2} filter="url(#ac-soft)" />
            <text x={PX + PW - 216 + 105} y={PY + 25} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--foreground)">&ldquo;{instr.label}&rdquo;</text>
          </g>

          {/* right-side note: plan feeds the generator */}
          <g>
            <text x={W - 200} y={PY + 70} className="fill-muted-foreground font-mono" fontSize={10}>the motion plan</text>
            <text x={W - 200} y={PY + 86} className="fill-muted-foreground font-mono" fontSize={10}>conditions frame</text>
            <text x={W - 200} y={PY + 102} className="fill-muted-foreground font-mono" fontSize={10}>generation →</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">instruction</span>
            {INSTRUCTIONS.map((it) => (
              <button key={it.key} type="button" onClick={() => setInstr(it)} aria-pressed={instr.key === it.key}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", instr.key === it.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {it.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">draw the plan (scrub)</div>
          <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.66_0.16_150)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The chain-of-thought here isn&apos;t a paragraph — it&apos;s a <span className="text-foreground">path</span>.
          Cosmos maps the instruction to a 2D trajectory <span style={{ color: PLAN }}>on the image plane</span>:
          where the gripper (or the camera, or an object) should move, waypoint by waypoint. That plan then conditions
          the diffusion tower, so the frames it denoises are the ones that <span className="text-foreground">carry out
          the motion</span> rather than merely look plausible. Reasoning about <em>action</em> happens in pixel space,
          where the physics has to hold.
        </p>
      </div>
    </figure>
  )
}
