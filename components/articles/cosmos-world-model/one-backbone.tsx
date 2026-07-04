"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// "One backbone, six models." The same Cosmos backbone is routed to six task heads
// just by choosing which modalities go in and which come out — the weights don't
// change. Pick a task; the input modalities that feed the backbone light up on the
// left, the outputs it produces light up on the right, with curved connectors. This
// is the whole pitch of an omnimodal world model: one network, many jobs. Illustrative.

const ON = "oklch(0.66 0.16 150)" // Cosmos green
const W = 760
const H = 356

const MODS = ["Language", "Image", "Video", "Audio", "Action"] as const

type Task = { key: string; label: string; in: number[]; out: number[] }
const TASKS: Task[] = [
  { key: "vlm", label: "Vision-Language", in: [0, 1, 2], out: [0] },
  { key: "imggen", label: "Image Generation", in: [0], out: [1] },
  { key: "avgen", label: "Audio-Visual Gen", in: [0, 1, 2], out: [2, 3] },
  { key: "policy", label: "Policy / World-Action", in: [0, 1, 2], out: [4] },
  { key: "fwd", label: "Forward Dynamics", in: [0, 1, 2, 4], out: [2] },
  { key: "inv", label: "Inverse Dynamics", in: [0, 2], out: [4] },
]

// geometry
const PILL_W = 108
const PILL_H = 30
const ROW0 = 44
const PITCH = 58
const LX = 40 // left pill x (left edge)
const RX = W - 40 - PILL_W // right pill x (left edge)
const rowY = (i: number) => ROW0 + i * PITCH
const BB_X = W / 2 - 66
const BB_W = 132
const BB_Y = rowY(2) - 22
const BB_H = PILL_H + 44

export function OneBackbone() {
  const [task, setTask] = useState<Task>(TASKS[3])

  const inSet = new Set(task.in)
  const outSet = new Set(task.out)

  // curve from a left pill's right edge into the backbone left edge
  const inCurve = (i: number) => {
    const x1 = LX + PILL_W, y1 = rowY(i) + PILL_H / 2
    const x2 = BB_X, y2 = BB_Y + BB_H / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }
  // curve from the backbone right edge to a right pill's left edge
  const outCurve = (i: number) => {
    const x1 = BB_X + BB_W, y1 = BB_Y + BB_H / 2
    const x2 = RX, y2 = rowY(i) + PILL_H / 2
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one backbone · six task models</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`The Cosmos backbone routed as ${task.label}: inputs ${task.in.map((i) => MODS[i]).join(", ")}; outputs ${task.out.map((i) => MODS[i]).join(", ")}.`}>
          <defs>
            <marker id="ob-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ON} strokeWidth={1.5} />
            </marker>
            <filter id="ob-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          <text x={LX + PILL_W / 2} y={26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>inputs</text>
          <text x={RX + PILL_W / 2} y={26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>outputs</text>

          {/* input connectors (behind) */}
          {task.in.map((i) => (
            <path key={`in${i}`} d={inCurve(i)} fill="none" stroke={ON} strokeWidth={1.5} opacity={0.8} markerEnd="url(#ob-arr)" className="transition-all duration-300" />
          ))}
          {/* output connectors */}
          {task.out.map((i) => (
            <path key={`out${i}`} d={outCurve(i)} fill="none" stroke={ON} strokeWidth={1.5} opacity={0.8} markerEnd="url(#ob-arr)" className="transition-all duration-300" />
          ))}

          {/* backbone node */}
          <rect x={BB_X} y={BB_Y} width={BB_W} height={BB_H} rx={12} fill={ON} opacity={0.92} filter="url(#ob-soft)" className="transition-all duration-300" />
          <text x={W / 2} y={BB_Y + 28} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={600} fill="var(--background)">Cosmos 3</text>
          <text x={W / 2} y={BB_Y + 46} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--background)" opacity={0.85}>MoT backbone</text>
          <text x={W / 2} y={BB_Y + 62} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--background)" opacity={0.85}>shared weights</text>

          {/* modality pills, both columns */}
          {MODS.map((m, i) => {
            const lit = inSet.has(i)
            const litOut = outSet.has(i)
            return (
              <g key={m}>
                {/* left (input) */}
                <rect x={LX} y={rowY(i)} width={PILL_W} height={PILL_H} rx={8} fill={lit ? ON : "var(--background)"} opacity={lit ? 0.92 : 1} stroke={lit ? ON : "var(--border)"} strokeWidth={1.4} filter={lit ? "url(#ob-soft)" : undefined} className="transition-all duration-300" />
                <text x={LX + PILL_W / 2} y={rowY(i) + PILL_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fill={lit ? "var(--background)" : "var(--muted-foreground)"}>{m}</text>
                {/* right (output) */}
                <rect x={RX} y={rowY(i)} width={PILL_W} height={PILL_H} rx={8} fill={litOut ? ON : "var(--background)"} opacity={litOut ? 0.92 : 1} stroke={litOut ? ON : "var(--border)"} strokeWidth={1.4} filter={litOut ? "url(#ob-soft)" : undefined} className="transition-all duration-300" />
                <text x={RX + PILL_W / 2} y={rowY(i) + PILL_H / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fill={litOut ? "var(--background)" : "var(--muted-foreground)"}>{m}</text>
              </g>
            )
          })}
        </svg>

        {/* task selector */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">task</span>
          {TASKS.map((tk) => (
            <button key={tk.key} type="button" onClick={() => setTask(tk)} aria-pressed={task.key === tk.key}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", task.key === tk.key ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tk.label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Nothing in the network changes between these six. The same <span style={{ color: ON }}>Cosmos backbone</span>{" "}
          becomes a vision-language model, an image or audio-visual generator, a policy, or a{" "}
          <span className="text-foreground">forward / inverse dynamics</span> model purely by choosing which modalities
          enter and which it&apos;s asked to produce. A <em>forward</em> dynamics model predicts the next video given a
          past and an action; an <em>inverse</em> one recovers the action that connects two frames — both fall out of
          one omnimodal world model.
        </p>
      </div>
    </figure>
  )
}
