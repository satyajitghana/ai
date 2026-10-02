"use client"

import { useState } from "react"

// What a computer-use agent actually is, and how OSWorld scores one. There is
// no magic interface: the harness screenshots a real machine, the model picks a
// single action, the harness executes it, and the loop repeats — for hundreds
// of steps on a long task. Only at the very end does a programmatic verifier
// inspect the machine's final state and return pass or fail. That pass/fail,
// averaged over the task set, is the benchmark number. The prose carries the
// same four stages, so this is an illustration, not the sole carrier.

const ACCENT = "oklch(0.55 0.21 295)"

type Stage = {
  key: string
  tag: string
  title: string
  body: string
  active: "screen" | "model" | "exec" | "verify"
  loop?: boolean
}

const STAGES: Stage[] = [
  {
    key: "observe",
    tag: "1 · observe",
    title: "The harness sends a screenshot",
    body: "The agent does not get a DOM or an API by default. It gets a picture of the screen, plus any results from the last action. That is the whole observation.",
    active: "screen",
  },
  {
    key: "decide",
    tag: "2 · decide",
    title: "The model emits one action",
    body: "Holo4 reads the pixels and returns a single step: a click at a coordinate, some typed text, a line of code to run in a sandbox, or a tool call to an MCP server or business API.",
    active: "model",
  },
  {
    key: "act",
    tag: "3 · act, then loop",
    title: "The harness executes it, then screenshots again",
    body: "The action runs on the real machine; the new screen becomes the next observation. A long OSWorld 2.0 task can repeat this for hundreds of steps before the agent decides it is done.",
    active: "exec",
    loop: true,
  },
  {
    key: "verify",
    tag: "4 · verify",
    title: "A checker grades the final state",
    body: "When the agent stops, a programmatic verifier inspects the machine — files written, settings changed, the app's state — and returns pass or fail. Averaged over the task set, that is the OSWorld score. The model never sees the grader.",
    active: "verify",
  },
]

function Box({
  x,
  y,
  w,
  label,
  sub,
  on,
}: {
  x: number
  y: number
  w: number
  label: string
  sub: string
  on: boolean
}) {
  return (
    <g opacity={on ? 1 : 0.4}>
      <rect
        x={x}
        y={y}
        width={w}
        height={46}
        rx={8}
        fill={on ? ACCENT : "currentColor"}
        fillOpacity={on ? 0.14 : 0.06}
        stroke={on ? ACCENT : "currentColor"}
        strokeOpacity={on ? 1 : 0.3}
        strokeWidth={on ? 2 : 1}
      />
      <text
        x={x + w / 2}
        y={y + 20}
        textAnchor="middle"
        className="fill-current font-mono"
        fontSize={12}
        fontWeight={600}
      >
        {label}
      </text>
      <text
        x={x + w / 2}
        y={y + 35}
        textAnchor="middle"
        className="fill-current font-mono"
        fontSize={9.5}
        opacity={0.65}
      >
        {sub}
      </text>
    </g>
  )
}

export function AgentLoop() {
  const [i, setI] = useState(0)
  const s = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>The computer-use loop</span>
        <span className="text-muted-foreground/60">observe → decide → act → verify</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="text-muted-foreground">
          <svg viewBox="0 0 720 150" className="w-full" role="img" aria-label="The computer-use agent loop: observe, decide, act, verify">
            {/* forward arrows */}
            {[
              [176, 190],
              [366, 380],
              [556, 570],
            ].map(([x1, x2], k) => (
              <line
                key={k}
                x1={x1}
                x2={x2}
                y1={47}
                y2={47}
                stroke="currentColor"
                strokeOpacity={0.4}
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            ))}

            {/* loop-back arrow: machine -> screen */}
            <path
              d="M 473 70 C 473 120, 90 120, 90 70"
              fill="none"
              stroke={s.loop ? ACCENT : "currentColor"}
              strokeOpacity={s.loop ? 1 : 0.3}
              strokeWidth={s.loop ? 2 : 1.25}
              strokeDasharray="5 4"
              markerEnd={s.loop ? "url(#arrowAccent)" : "url(#arrow)"}
            />
            <text x={281} y={116} textAnchor="middle" className="fill-current font-mono" fontSize={10} opacity={s.loop ? 0.9 : 0.5}>
              next observation · up to hundreds of steps
            </text>

            <defs>
              <marker id="arrow" markerWidth={7} markerHeight={7} refX={5.5} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" opacity={0.5} />
              </marker>
              <marker id="arrowAccent" markerWidth={7} markerHeight={7} refX={5.5} refY={3} orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={ACCENT} />
              </marker>
            </defs>

            <Box x={20} y={24} w={150} label="Screenshot" sub="+ tool results" on={s.active === "screen"} />
            <Box x={210} y={24} w={150} label="Holo4" sub="pick one action" on={s.active === "model"} />
            <Box x={400} y={24} w={150} label="Execute" sub="click · type · code · tool" on={s.active === "exec"} />
            <Box x={590} y={24} w={110} label="Verifier" sub="pass / fail" on={s.active === "verify"} />
          </svg>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            ← prev
          </button>
          <div className="flex gap-1.5">
            {STAGES.map((st, k) => (
              <button
                key={st.key}
                type="button"
                onClick={() => setI(k)}
                aria-label={st.tag}
                aria-pressed={k === i}
                className="h-2 w-2 cursor-pointer rounded-full transition-colors"
                style={{ background: k === i ? ACCENT : "currentColor", opacity: k === i ? 1 : 0.25 }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setI((v) => Math.min(STAGES.length - 1, v + 1))}
            disabled={i === STAGES.length - 1}
            className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            next →
          </button>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <span className="font-mono text-[11px] tracking-wide uppercase" style={{ color: ACCENT }}>
            {s.tag}
          </span>
          <p className="mt-1 text-sm leading-6 text-foreground">
            <span className="font-medium">{s.title}.</span>{" "}
            {s.body}
          </p>
        </div>
      </div>
    </figure>
  )
}
