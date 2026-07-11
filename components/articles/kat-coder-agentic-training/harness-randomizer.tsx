"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// KAT-Coder-V2.5 — harness randomization. An agentic policy trained inside one fixed
// scaffold overfits the *surface* of that scaffold, not the task: the action format,
// the order history is concatenated in, the reflection/stop timing. KAT-Coder trains
// across many harnesses that vary along three axes — tool-invocation protocol, context
// management, and control flow — so the same underlying task is rendered many ways and
// the reward stays tied to the outcome, not the interface. Flip the axes: the rendered
// action changes, the task and its reward do not. white-box harnesses give clean signals;
// black-box (production) harnesses add compression + reorganization. Illustrative.

const ACCENT = "oklch(0.58 0.14 250)"
const TASK = "oklch(0.58 0.13 150)"

const PROTOCOLS = ["function-call", "code-block", "tag-based"] as const
const CONTEXTS = ["full history", "sliding window", "summary"] as const
const FLOWS = ["ReAct", "planning"] as const

type Protocol = (typeof PROTOCOLS)[number]

// short rendered action per protocol — kept terse so it fits the frame
const rendered: Record<Protocol, string[]> = {
  "function-call": ['{ "name": "edit_file",', '  "args": { "path": "app.py" } }'],
  "code-block": ["```bash", "sed -i 's/old/new/' app.py", "```"],
  "tag-based": ['<edit path="app.py">', "  old → new", "</edit>"],
}

const W = 760
const H = 250

export function HarnessRandomizer() {
  const [p, setP] = useState(0)
  const [c, setC] = useState(0)
  const [f, setF] = useState(0)

  const combos = PROTOCOLS.length * CONTEXTS.length * FLOWS.length // 18
  const idx = p * (CONTEXTS.length * FLOWS.length) + c * FLOWS.length + f + 1
  const blackBox = c !== 0 || f !== 0 // compression / planning ⇒ production-realistic

  // geometry
  const colX = [120, 320, 520]
  const surfX = W - 150
  const centerY = 132

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  const AxisCol = ({
    x,
    title,
    options,
    sel,
    onSel,
  }: {
    x: number
    title: string
    options: readonly string[]
    sel: number
    onSel: (i: number) => void
  }) => (
    <g>
      <text x={x} y={38} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>
        {title}
      </text>
      {options.map((o, i) => {
        const y = 52 + i * 30
        const active = i === sel
        const wpx = Math.max(84, o.length * 6.2 + 18)
        return (
          <g key={o} className="cursor-pointer" onClick={() => onSel(i)}>
            <rect
              x={x - wpx / 2}
              y={y}
              width={wpx}
              height={22}
              rx={11}
              fill={active ? ACCENT : "var(--muted)"}
              opacity={active ? 0.92 : 0.35}
              stroke={active ? ACCENT : "transparent"}
              strokeWidth={1.5}
              className="transition-all duration-200"
            />
            <text
              x={x}
              y={y + 15}
              textAnchor="middle"
              className={cn("font-mono", active ? "fill-background" : "fill-muted-foreground")}
              fontSize={9.5}
            >
              {o}
            </text>
          </g>
        )
      })}
    </g>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>harness randomization · many surfaces, one task, one reward</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Harness rendering ${idx} of ${combos}: ${PROTOCOLS[p]}, ${CONTEXTS[c]}, ${FLOWS[f]}. The task outcome and reward are invariant to these choices.`}
        >
          <defs>
            <marker id="hr-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="hr-arr-t" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={TASK} strokeWidth={1.5} />
            </marker>
            <filter id="hr-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <AxisCol x={colX[0]} title="tool protocol" options={PROTOCOLS} sel={p} onSel={setP} />
          <AxisCol x={colX[1]} title="context mgmt" options={CONTEXTS} sel={c} onSel={setC} />
          <AxisCol x={colX[2]} title="control flow" options={FLOWS} sel={f} onSel={setF} />

          {/* arrows from each selected pill into the surface node */}
          {[
            { x: colX[0], y: 52 + p * 30 + 11 },
            { x: colX[1], y: 52 + c * 30 + 11 },
            { x: colX[2], y: 52 + f * 30 + 11 },
          ].map((s, k) => (
            <path key={k} d={curve(s.x + 46, s.y, surfX - 52, centerY)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#hr-arr)" opacity={0.55} />
          ))}

          {/* ghosted stack behind the surface node = the other renderings */}
          <rect x={surfX - 44} y={centerY - 30} width={100} height={54} rx={9} fill="var(--muted)" opacity={0.25} />
          <rect x={surfX - 48} y={centerY - 34} width={100} height={54} rx={9} fill="var(--muted)" opacity={0.35} />
          {/* surface node */}
          <rect x={surfX - 52} y={centerY - 38} width={100} height={54} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#hr-soft)" />
          <text x={surfX - 2} y={centerY - 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>harness</text>
          <text x={surfX - 2} y={centerY - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>rendering</text>
          <text x={surfX - 2} y={centerY + 8} textAnchor="middle" className="font-mono" fontSize={8} fill={blackBox ? ACCENT : TASK}>{blackBox ? "black-box" : "white-box"}</text>

          {/* surface → invariant task/reward */}
          <path d={curve(surfX + 48, centerY - 11, W - 96, 210)} fill="none" stroke={TASK} strokeWidth={1.5} markerEnd="url(#hr-arr-t)" opacity={0.8} />
          <rect x={W - 232} y={196} width={136} height={30} rx={8} fill="color-mix(in oklab, oklch(0.58 0.13 150) 12%, var(--background))" stroke={TASK} strokeWidth={1.5} filter="url(#hr-soft)" />
          <text x={W - 164} y={215} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5} fontWeight={600}>task outcome → reward</text>

          {/* the many-to-one label */}
          <text x={colX[1]} y={centerY + 44} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            {combos} surface renderings collapse to one reward signal
          </text>
        </svg>

        {/* rendered action preview + readout */}
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">
              same edit, rendered under <span style={{ color: ACCENT }}>{PROTOCOLS[p]}</span>
            </div>
            <pre className="overflow-x-auto font-mono text-[11px] leading-5 text-foreground">
              {rendered[PROTOCOLS[p]].join("\n")}
            </pre>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground sm:text-right">
            rendering <span className="text-foreground">{idx}</span> / {combos}
            <br />
            {CONTEXTS[c]} · {FLOWS[f]}
            <br />
            <span style={{ color: blackBox ? ACCENT : TASK }}>{blackBox ? "black-box (production)" : "white-box (clean signal)"}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A policy trained inside one scaffold learns that scaffold: parsing breaks the moment the action format changes,
          behavior depends on how history was concatenated, reflection fires on a fixed schedule. By randomizing the
          <span style={{ color: ACCENT }}> protocol</span>, <span style={{ color: ACCENT }}>context strategy</span>, and
          <span style={{ color: ACCENT }}> control flow</span>, KAT-Coder forces the model to solve the
          <span style={{ color: TASK }}> underlying task</span> — the reward is tied to the outcome, identical across all{" "}
          {combos} surfaces. white-box harnesses (simple, uncompressed) give clean training signals; black-box harnesses
          (Claude Code, Codex, OpenHands…) add the compression and reorganization of real deployments.
        </p>
      </div>
    </figure>
  )
}
