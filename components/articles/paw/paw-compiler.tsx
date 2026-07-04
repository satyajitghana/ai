"use client"

import { useEffect, useRef, useState } from "react"
import { SnowflakeIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The Program-as-Weights loop, made playable. A "fuzzy function" (specified in plain
// language) is compiled ONCE by a 4B compiler into a small LoRA adapter — a neural
// program. That adapter then runs on a frozen 0.6B interpreter, locally and cheaply,
// for every subsequent input. Pick a spec, press compile (watch the adapter fill in),
// then click inputs to run them through the interpreter. It's an illustration of the
// mechanism, not a live model — the outputs are the paper's example behaviors.

const INDIGO = "oklch(0.55 0.17 275)"
const GREEN = "oklch(0.68 0.15 150)"
const AMBER = "oklch(0.72 0.16 65)"

type Ex = { in: string; out: string; hot?: boolean }
type Spec = { key: string; label: string; spec: string; outLabel: string; examples: Ex[] }

const SPECS: Spec[] = [
  {
    key: "urgent",
    label: "classify urgency",
    spec: "Flag a message as urgent only if it needs action today.",
    outLabel: "urgent?",
    examples: [
      { in: "Need your signature by EOD!", out: "URGENT", hot: true },
      { in: "Newsletter: 5 tips for spring", out: "not urgent" },
      { in: "Server down, customers affected", out: "URGENT", hot: true },
      { in: "Lunch next week sometime?", out: "not urgent" },
    ],
  },
  {
    key: "log",
    label: "alert on log lines",
    spec: "Alert on log lines that a human on-call should see right now.",
    outLabel: "alert?",
    examples: [
      { in: "INFO cache warmed in 12ms", out: "ignore" },
      { in: "FATAL OOM-killed pid 4123", out: "ALERT", hot: true },
      { in: "DEBUG retry attempt 2", out: "ignore" },
      { in: "ERROR disk full on /var", out: "ALERT", hot: true },
    ],
  },
  {
    key: "intent",
    label: "rank by intent",
    spec: 'Rank a snippet by how well it answers "how do I reset my password".',
    outLabel: "match",
    examples: [
      { in: "Forgot password? Reset guide", out: "0.94", hot: true },
      { in: "Billing & invoices FAQ", out: "0.11" },
      { in: "Change account email steps", out: "0.38" },
      { in: "Two-factor reset walkthrough", out: "0.71", hot: true },
    ],
  },
]

// LoRA adapter grid geometry
const ROWS = 6
const COLS = 14

export function PawCompiler() {
  const [si, setSi] = useState(0)
  const [phase, setPhase] = useState<"idle" | "compiling" | "ready">("idle")
  const [active, setActive] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const spec = SPECS[si]

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => () => clearTimers(), [])

  function pick(i: number) {
    clearTimers()
    setSi(i); setPhase("idle"); setActive(null); setRunning(false)
  }
  function compile() {
    clearTimers()
    setActive(null)
    setPhase("compiling")
    timers.current.push(setTimeout(() => setPhase("ready"), ROWS * COLS * 8 + 350))
  }
  function run(i: number) {
    if (phase !== "ready") return
    clearTimers()
    setActive(i); setRunning(true)
    timers.current.push(setTimeout(() => setRunning(false), 520))
  }

  const filled = phase === "ready" || phase === "compiling"
  const cells = ROWS * COLS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>program-as-weights · compile once, run locally</span>
        <span className="text-muted-foreground/60">illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        {/* ── COMPILE ONCE (in the cloud) ───────────────────────────── */}
        <div className="mb-1 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
          <span>compile once · in the cloud</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {/* spec card */}
          <div className="rounded-lg border bg-background p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {SPECS.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={i === si}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                    i === si ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  style={i === si ? { background: INDIGO } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">natural-language spec</div>
            <p className="mt-1 text-sm leading-6 text-foreground">&ldquo;{spec.spec}&rdquo;</p>
          </div>

          {/* compiler + button */}
          <div className="flex flex-row items-center justify-center gap-3 sm:flex-col">
            <Arrow />
            <button
              type="button"
              onClick={compile}
              className="group flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border px-3 py-2 transition-colors hover:border-foreground/40"
              style={{ background: `${INDIGO}0f` }}
            >
              <span className="font-mono text-[10px] text-muted-foreground">4B compiler</span>
              <span className="text-sm font-semibold" style={{ color: INDIGO }}>
                {phase === "compiling" ? "compiling…" : phase === "ready" ? "recompile" : "compile ▸"}
              </span>
            </button>
            <Arrow />
          </div>

          {/* LoRA adapter grid */}
          <div className="rounded-lg border bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] text-muted-foreground">neural program · LoRA adapter</span>
              <span className="font-mono text-[10px]" style={{ color: filled ? GREEN : "var(--muted-foreground)" }}>
                {filled ? "~1 MB" : "empty"}
              </span>
            </div>
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cells }).map((_, k) => {
                const on = filled
                return (
                  <span
                    key={k}
                    className="aspect-square rounded-[2px] transition-all"
                    style={{
                      background: on ? GREEN : "var(--muted)",
                      opacity: on ? 0.35 + 0.65 * (((k * 37) % 100) / 100) : 0.25,
                      transitionDelay: phase === "compiling" ? `${k * 8}ms` : "0ms",
                      transitionDuration: "260ms",
                    }}
                  />
                )
              })}
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              {phase === "ready" ? "compiled — a small reusable artifact" : phase === "compiling" ? "emitting weights…" : "press compile"}
            </div>
          </div>
        </div>

        {/* ── RUN LOCALLY (many times) ──────────────────────────────── */}
        <div className="mb-1 mt-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/70">
          <span>run locally · every call after</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
          {/* inputs */}
          <div className={cn("rounded-lg border bg-background p-3 transition-opacity", phase === "ready" ? "opacity-100" : "opacity-45")}>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">{phase === "ready" ? "click an input to run it →" : "compile first, then run inputs"}</div>
            <div className="flex flex-col gap-1.5">
              {spec.examples.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={phase !== "ready"}
                  onClick={() => run(i)}
                  aria-pressed={active === i}
                  className={cn(
                    "cursor-pointer truncate rounded-md border px-2 py-1.5 text-left font-mono text-[11px] transition-all disabled:cursor-not-allowed",
                    active === i ? "border-transparent text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                  style={active === i ? { background: `${INDIGO}14`, boxShadow: `inset 2px 0 0 ${INDIGO}` } : undefined}
                >
                  {ex.in}
                </button>
              ))}
            </div>
          </div>

          {/* interpreter */}
          <div className="flex flex-row items-center justify-center gap-3 sm:flex-col">
            <Arrow />
            <div className="flex shrink-0 flex-col items-center gap-1 rounded-lg border px-3 py-2" style={{ background: `${GREEN}0f` }}>
              <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <SnowflakeIcon size={11} weight="fill" /> frozen
              </span>
              <span className="text-sm font-semibold" style={{ color: GREEN }}>0.6B</span>
              <span className="font-mono text-[9px] text-muted-foreground">+ LoRA</span>
            </div>
            <Arrow pulse={running} />
          </div>

          {/* output */}
          <div className="flex flex-col rounded-lg border bg-background p-3">
            <div className="font-mono text-[10px] text-muted-foreground">{spec.outLabel}</div>
            <div className="flex flex-1 items-center">
              {active === null ? (
                <span className="font-mono text-sm text-muted-foreground/50">—</span>
              ) : running ? (
                <span className="font-mono text-sm text-muted-foreground">running…</span>
              ) : (
                <span
                  className="rounded-md px-2 py-1 font-mono text-sm font-semibold"
                  style={{
                    color: spec.examples[active].hot ? AMBER : "var(--muted-foreground)",
                    background: spec.examples[active].hot ? `${AMBER}18` : "var(--muted)",
                  }}
                >
                  {spec.examples[active].out}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[9px] text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">≈1/50 the memory</span>
              <span className="rounded bg-muted px-1.5 py-0.5">30 tok/s on an M3</span>
              <span className="rounded bg-muted px-1.5 py-0.5">offline</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The foundation model runs <span className="text-foreground">once per function definition</span>, not once
          per call. It stops being a per-input problem solver and becomes a <span style={{ color: INDIGO }}>tool
          builder</span>: the compiled adapter is a small artifact you own, run locally, and reuse for free.
        </p>
      </div>
    </figure>
  )
}

function Arrow({ pulse }: { pulse?: boolean }) {
  return (
    <span className="relative hidden h-px w-8 shrink-0 bg-border sm:block">
      <span className="absolute -right-1 -top-[3px] text-[10px] text-muted-foreground/60">▸</span>
      {pulse ? (
        <span className="absolute top-[-1px] left-0 h-[3px] w-2 animate-[pawpulse_0.5s_ease-in-out] rounded-full" style={{ background: "oklch(0.68 0.15 150)" }} />
      ) : null}
      <style>{`@keyframes pawpulse{from{left:0}to{left:100%}}`}</style>
    </span>
  )
}
