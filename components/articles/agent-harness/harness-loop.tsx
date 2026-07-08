"use client"

import { useEffect, useRef, useState } from "react"

// The agent harness loop, stepped through on a concrete task: fix a failing test
// in a repo. This is Lilian Weng's coding-harness loop made walkable —
// Observe → Plan → Search/read → Edit → Test → Inspect → (repeat | done).
//
// The model never touches the repo directly. Every action is a TOOL CALL the
// harness executes; every result is an OBSERVATION the harness feeds back into
// the next generation. Step the timeline to watch one goal drive two iterations
// of the loop before the suite goes green.
//
// SSR-safety: first render is pure and deterministic (index 0, no random, no
// timers). Auto-play lives entirely inside useEffect with a cleared interval,
// and every array here is fixed-length — no unbounded loops.

const ACC = "oklch(0.68 0.14 200)" // teal — the active phase
const OK = "oklch(0.62 0.16 150)" // green — pass / done
const WARN = "oklch(0.68 0.16 55)" // amber — a failing observation

// The six phases, laid out as a pipeline that wraps (matches Weng's figure).
const PHASES = ["Observe", "Plan", "Search", "Edit", "Test", "Inspect"] as const
const PHASE_FULL = [
  "Observe repo",
  "Plan",
  "Search / read files",
  "Edit / write patch",
  "Run tests",
  "Inspect errors",
]

type Tone = "ok" | "warn" | "done"
type Step = {
  it: number // iteration number
  p: number // phase index (0..5)
  thought: string
  tools: string[]
  obs: string
  tone: Tone
}

// A fixed, scripted trajectory: one goal, two turns of the loop.
const STEPS: Step[] = [
  {
    it: 1,
    p: 0,
    thought: "New task: the suite has a failing test. Get the lay of the land before touching anything.",
    tools: ["ls -R src", "git_status"],
    obs: "214 files · working tree clean · pytest: 1 failing (test_config::test_defaults)",
    tone: "ok",
  },
  {
    it: 1,
    p: 1,
    thought: "The failure is in parse_config. Read that function before editing.",
    tools: [],
    obs: "plan recorded → find and read parse_config",
    tone: "ok",
  },
  {
    it: 1,
    p: 2,
    thought: "Locate the function, then read it.",
    tools: ["grep -n 'def parse_config' src/", "read src/config.py:1-80"],
    obs: "config.py:42 dereferences cfg['db'] with no default → KeyError on missing key",
    tone: "ok",
  },
  {
    it: 1,
    p: 3,
    thought: "Add the missing default so the lookup can't throw.",
    tools: ["edit src/config.py  # cfg['db'] → cfg.get('db', DEFAULT_DB)"],
    obs: "1 file changed, +3 −1",
    tone: "ok",
  },
  {
    it: 1,
    p: 4,
    thought: "Run the suite to check the patch.",
    tools: ["bash pytest -q"],
    obs: "42 passed, 1 failed — new failure: test_env expects a PORT fallback",
    tone: "warn",
  },
  {
    it: 1,
    p: 5,
    thought: "The fix was too narrow: the env-var path is still unhandled. Not done.",
    tools: [],
    obs: "decision: REPEAT → re-plan",
    tone: "warn",
  },
  {
    it: 2,
    p: 1,
    thought: "Second turn. Handle the PORT env fallback in parse_config as well.",
    tools: [],
    obs: "plan recorded",
    tone: "ok",
  },
  {
    it: 2,
    p: 3,
    thought: "Apply the second patch. (No re-search — the file is already in context.)",
    tools: ["edit src/config.py  # add os.environ.get('PORT', DEFAULT_PORT)"],
    obs: "1 file changed, +2 −0",
    tone: "ok",
  },
  {
    it: 2,
    p: 4,
    thought: "Re-run the suite.",
    tools: ["bash pytest -q"],
    obs: "43 passed, 0 failed",
    tone: "ok",
  },
  {
    it: 2,
    p: 5,
    thought: "All green. The goal is met, so the loop exits instead of repeating.",
    tools: [],
    obs: "decision: DONE",
    tone: "done",
  },
]

// ---- SVG layout (fixed, deterministic) --------------------------------------
const VW = 720
const VH = 250
const BW = 96
const BH = 52
const GAP = 18
const ROW_Y = 110
const START_X = 27
const boxX = (i: number) => START_X + i * (BW + GAP)
const boxCX = (i: number) => boxX(i) + BW / 2
const CY = ROW_Y + BH / 2

const DONE_W = 80
const DONE_X = boxCX(4) - DONE_W / 2
const DONE_Y = 20
const DONE_H = 44

export function HarnessLoop() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const step = STEPS[i]
  const done = step.tone === "done"
  const obsColor = step.tone === "warn" ? WARN : step.tone === "done" ? OK : ACC

  // Auto-play: advance every 1.4s, stop at the end. All timing is client-side.
  useEffect(() => {
    if (!playing) return
    timer.current = setInterval(() => {
      setI((prev) => {
        if (prev >= STEPS.length - 1) {
          setPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1400)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>agent harness loop · fix a failing test</span>
        <span className="text-muted-foreground/50">iteration {step.it} of 2</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full"
          role="img"
          aria-label="A pipeline of six phases — Observe, Plan, Search, Edit, Test, Inspect — with a Done exit above Test and a dashed repeat arrow from Inspect back to Plan. The current phase is highlighted."
        >
          <defs>
            <marker id="hl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>

          {/* connective arrows between consecutive phases */}
          {[0, 1, 2, 3, 4].map((k) => (
            <line
              key={k}
              x1={boxX(k) + BW + 1}
              y1={CY}
              x2={boxX(k + 1) - 3}
              y2={CY}
              stroke="var(--muted-foreground)"
              strokeWidth={1.4}
              markerEnd="url(#hl-arrow)"
              opacity={0.5}
            />
          ))}

          {/* Test → Done branch */}
          <line
            x1={boxCX(4)}
            y1={ROW_Y - 1}
            x2={boxCX(4)}
            y2={DONE_Y + DONE_H + 3}
            stroke={done ? OK : "var(--muted-foreground)"}
            strokeWidth={1.4}
            markerEnd="url(#hl-arrow)"
            opacity={done ? 0.95 : 0.4}
          />

          {/* Done box */}
          <rect
            x={DONE_X}
            y={DONE_Y}
            width={DONE_W}
            height={DONE_H}
            rx={9}
            fill={done ? OK : "var(--muted-foreground)"}
            opacity={done ? 0.95 : 0.14}
            className="transition-all duration-300"
          />
          <text
            x={boxCX(4)}
            y={DONE_Y + DONE_H / 2 + 4}
            textAnchor="middle"
            className="font-mono"
            fontSize={13}
            fontWeight={600}
            fill={done ? "#fff" : "var(--muted-foreground)"}
          >
            Done
          </text>

          {/* repeat arrow: Inspect → down → left → up → Plan */}
          <path
            d={`M ${boxCX(5)} ${ROW_Y + BH + 1} L ${boxCX(5)} ${205} L ${boxCX(1)} ${205} L ${boxCX(1)} ${ROW_Y + BH + 3}`}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.4}
            strokeDasharray="4 4"
            markerEnd="url(#hl-arrow)"
            opacity={step.tone === "warn" && step.p === 5 ? 0.9 : 0.4}
          />
          <text x={(boxCX(5) + boxCX(1)) / 2} y={223} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
            repeat until the goal is met
          </text>

          {/* the six phase boxes */}
          {PHASES.map((label, k) => {
            const on = k === step.p
            return (
              <g key={k} className="transition-all duration-300">
                <rect
                  x={boxX(k)}
                  y={ROW_Y}
                  width={BW}
                  height={BH}
                  rx={10}
                  fill={on ? ACC : "var(--muted-foreground)"}
                  opacity={on ? 0.95 : 0.13}
                  className="transition-all duration-300"
                />
                <text
                  x={boxCX(k)}
                  y={CY + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={13}
                  fontWeight={on ? 600 : 500}
                  fill={on ? "#fff" : "var(--foreground)"}
                >
                  {label}
                </text>
              </g>
            )
          })}
        </svg>

        {/* detail panel for the active step */}
        <div className="mt-2 rounded-lg border bg-muted/20 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 font-mono text-[10px] text-white" style={{ background: ACC }}>
              {PHASE_FULL[step.p]}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">turn {step.it}</span>
          </div>

          <p className="mt-2 text-sm leading-6 text-foreground">{step.thought}</p>

          {step.tools.length > 0 ? (
            <div className="mt-3">
              <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">tool calls</div>
              <div className="mt-1 space-y-1">
                {step.tools.map((t, ti) => (
                  <div key={ti} className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                    <span style={{ color: ACC }}>›</span> {t}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 font-mono text-[10px] text-muted-foreground">no tool call — the model reasons in context</div>
          )}

          <div className="mt-3">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">observation → context</div>
            <div className="mt-1 rounded px-2 py-1 font-mono text-xs" style={{ background: `color-mix(in oklab, ${obsColor} 12%, transparent)`, color: obsColor }}>
              {step.obs}
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setI((a) => Math.max(0, a - 1))
            }}
            disabled={i === 0}
            className="cursor-pointer rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← prev
          </button>
          <button
            type="button"
            onClick={() => {
              if (i >= STEPS.length - 1) {
                setI(0)
                setPlaying(true)
              } else {
                setPlaying((p) => !p)
              }
            }}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs text-white transition-opacity hover:opacity-90"
            style={{ background: ACC }}
          >
            {i >= STEPS.length - 1 ? "↺ replay" : playing ? "❚❚ pause" : "▶ play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false)
              setI((a) => Math.min(STEPS.length - 1, a + 1))
            }}
            disabled={i === STEPS.length - 1}
            className="cursor-pointer rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            next →
          </button>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            step {i + 1}/{STEPS.length}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The model never edits the repo directly. Each phase emits a{" "}
          <span className="text-foreground">tool call</span> the harness runs, and each result is an{" "}
          <span className="text-foreground">observation</span> fed back into the next generation. The harness owns the control flow: it
          decides when to loop back and when the goal is met and the loop exits.
        </p>
      </div>
    </figure>
  )
}
