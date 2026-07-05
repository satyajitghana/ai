"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// The Program-as-Weights loop, drawn as a composed pipeline. A "fuzzy function"
// (specified in plain language) is compiled ONCE by a 4B compiler into a small LoRA
// adapter — a neural program. That adapter loads into a frozen 0.6B interpreter that
// then runs locally and cheaply for every subsequent input. Pick a spec, press compile
// (watch the adapter fill in), then click inputs to run them through the interpreter.
// It's an illustration of the mechanism, not a live model — the outputs are the paper's
// example behaviors.

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

// ── scene geometry (viewBox units) ─────────────────────────────
const W = 740
const H = 330
const xA = 24, wA = 182 // col A (spec / input)
const xB = 252, wB = 170 // col B (compiler / interpreter)
const xC = 468, wC = 248 // col C (adapter / output)
const yT = 52, hT = 62 // top row
const yB = 214, hB = 76 // bottom row
const cyT = yT + hT / 2
const cyB = yB + hB / 2
const cxA = xA + wA / 2
const cxB = xB + wB / 2
const cxC = xC + wC / 2

// adapter fill grid
const ACOLS = 24, AROWS = 3
const gx = xC + 10, gy = yT + 22, gw = wC - 20, gh = 30
const gap = 1.8
const cellW = (gw - (ACOLS - 1) * gap) / ACOLS
const cellH = (gh - (AROWS - 1) * gap) / AROWS

// smooth horizontal connector
const hcurve = (x1: number, x2: number, y: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2} ${y}`
}
// bridge from adapter (top) down-left into interpreter (bottom)
const bridge = (() => {
  const x1 = cxC, y1 = yT + hT
  const x2 = cxB, y2 = yB
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
})()
// flow the running dot follows: input → interpreter → output
const flowPath = `M ${xA + wA} ${cyB} L ${xB} ${cyB} L ${xB + wB} ${cyB} L ${xC} ${cyB}`

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s)

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
    setActive(null); setRunning(false)
    setPhase("compiling")
    timers.current.push(setTimeout(() => setPhase("ready"), ACOLS * AROWS * 6 + 320))
  }
  function run(i: number) {
    if (phase !== "ready") return
    clearTimers()
    setActive(i); setRunning(true)
    timers.current.push(setTimeout(() => setRunning(false), 520))
  }

  const filled = phase === "ready" || phase === "compiling"
  const outVal = active === null ? null : spec.examples[active]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>program-as-weights · compile once, run locally</span>
        <span className="text-muted-foreground/60">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label="Pipeline: a natural-language spec is compiled once by a 4B compiler into a small LoRA adapter, which loads into a frozen 0.6B interpreter that runs each input locally to produce an output.">
          <defs>
            <marker id="paw-ar-i" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={INDIGO} strokeWidth={1.5} />
            </marker>
            <marker id="paw-ar-g" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GREEN} strokeWidth={1.5} />
            </marker>
            <filter id="paw-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* band labels */}
          <text x={xA} y={34} className="fill-muted-foreground/70 font-mono" fontSize={10} letterSpacing="0.06em">COMPILE ONCE · IN THE CLOUD</text>
          <line x1={xA + 224} y1={30} x2={W - 24} y2={30} stroke="var(--border)" strokeWidth={1} />
          <text x={xA} y={yB - 14} className="fill-muted-foreground/70 font-mono" fontSize={10} letterSpacing="0.06em">RUN LOCALLY · EVERY CALL AFTER</text>
          <line x1={xA + 246} y1={yB - 18} x2={W - 24} y2={yB - 18} stroke="var(--border)" strokeWidth={1} />

          {/* connectors (behind nodes) */}
          <path d={hcurve(xA + wA, xB, cyT)} fill="none" stroke={INDIGO} strokeWidth={1.5} opacity={0.75} markerEnd="url(#paw-ar-i)" />
          <path d={hcurve(xB + wB, xC, cyT)} fill="none" stroke={INDIGO} strokeWidth={1.5} opacity={filled ? 0.85 : 0.35} markerEnd="url(#paw-ar-i)" className="transition-opacity duration-300" />
          <path d={bridge} fill="none" stroke={GREEN} strokeWidth={1.5} strokeDasharray="4 3" opacity={filled ? 0.8 : 0.28} markerEnd="url(#paw-ar-g)" className="transition-opacity duration-300" />
          <path d={hcurve(xA + wA, xB, cyB)} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={phase === "ready" ? 0.75 : 0.28} markerEnd="url(#paw-ar-g)" className="transition-opacity duration-300" />
          <path d={hcurve(xB + wB, xC, cyB)} fill="none" stroke={GREEN} strokeWidth={1.5} opacity={phase === "ready" ? 0.75 : 0.28} markerEnd="url(#paw-ar-g)" className="transition-opacity duration-300" />

          {/* bridge label */}
          <text x={(cxC + cxB) / 2 + 6} y={cyB - (cyB - (yT + hT)) / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>loads once</text>

          {/* running dot */}
          {running && active !== null && (
            <circle key={active} r={3.2} fill={GREEN}>
              <animateMotion dur="0.5s" fill="freeze" path={flowPath} />
            </circle>
          )}

          {/* ── spec node ── */}
          <g>
            <rect x={xA} y={yT} width={wA} height={hT} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#paw-soft)" />
            <text x={xA + 12} y={yT + 20} className="fill-muted-foreground font-mono" fontSize={9}>natural-language spec</text>
            <text x={xA + 12} y={yT + 42} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>{spec.label}</text>
          </g>

          {/* ── 4B compiler node ── */}
          <g>
            <rect x={xB} y={yT} width={wB} height={hT} rx={10} fill="var(--background)" stroke={INDIGO} strokeWidth={1.5} filter="url(#paw-soft)" />
            <text x={cxB} y={yT + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={13} fontWeight={600}>4B compiler</text>
            <text x={cxB} y={yT + 44} textAnchor="middle" fontSize={11} fontWeight={600} style={{ fill: INDIGO }} className="font-mono">
              {phase === "compiling" ? "compiling…" : phase === "ready" ? "compiled ✓" : "press compile"}
            </text>
          </g>

          {/* ── LoRA adapter node ── */}
          <g>
            <rect x={xC} y={yT} width={wC} height={hT} rx={10} fill="var(--background)" stroke={filled ? GREEN : "var(--border)"} strokeWidth={1.5} filter="url(#paw-soft)" className="transition-colors duration-300" />
            <text x={xC + 12} y={yT + 16} className="fill-muted-foreground font-mono" fontSize={9}>neural program · LoRA adapter</text>
            <text x={xC + wC - 12} y={yT + 16} textAnchor="end" fontSize={9} className="font-mono" style={{ fill: filled ? GREEN : "var(--muted-foreground)" }}>{filled ? "~1 MB" : "empty"}</text>
            {Array.from({ length: ACOLS * AROWS }, (_, k) => {
              const r = Math.floor(k / ACOLS), c = k % ACOLS
              const on = filled
              return (
                <rect key={k} x={gx + c * (cellW + gap)} y={gy + r * (cellH + gap)} width={cellW} height={cellH} rx={1}
                  fill={on ? GREEN : "var(--muted)"}
                  style={{
                    opacity: on ? 0.32 + 0.68 * (((k * 37) % 100) / 100) : 0.3,
                    transitionProperty: "opacity, fill",
                    transitionDuration: "240ms",
                    transitionDelay: phase === "compiling" ? `${k * 6}ms` : "0ms",
                  }} />
              )
            })}
          </g>

          {/* ── input node ── */}
          <g>
            <rect x={xA} y={yB} width={wA} height={hB} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#paw-soft)" />
            <text x={xA + 12} y={yB + 20} className="fill-muted-foreground font-mono" fontSize={9}>input</text>
            {outVal ? (
              <text x={xA + 12} y={yB + 44} className="fill-foreground font-mono" fontSize={10}>{clip(outVal.in, 25)}</text>
            ) : (
              <text x={xA + 12} y={yB + 44} className="fill-muted-foreground/60 font-mono" fontSize={10}>{phase === "ready" ? "click an input below" : "compile first"}</text>
            )}
          </g>

          {/* ── frozen 0.6B interpreter node ── */}
          <g>
            <rect x={xB} y={yB} width={wB} height={hB} rx={10} fill="var(--background)" stroke={running ? GREEN : "var(--border)"} strokeWidth={running ? 2 : 1.5} filter="url(#paw-soft)" className="transition-all duration-200" />
            <text x={cxB} y={yB + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>❄ frozen interpreter</text>
            <text x={cxB} y={yB + 46} textAnchor="middle" className="fill-foreground font-mono" fontSize={17} fontWeight={700}>0.6B</text>
            <text x={cxB} y={yB + 64} textAnchor="middle" fontSize={10} className="font-mono" style={{ fill: filled ? GREEN : "var(--muted-foreground)" }}>+ LoRA</text>
          </g>

          {/* ── output node ── */}
          <g>
            <rect x={xC} y={yB} width={wC} height={hB} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#paw-soft)" />
            <text x={xC + 12} y={yB + 20} className="fill-muted-foreground font-mono" fontSize={9}>{spec.outLabel}</text>
            {outVal === null ? (
              <text x={cxC} y={yB + 50} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={16}>—</text>
            ) : running ? (
              <text x={cxC} y={yB + 50} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={13}>running…</text>
            ) : (
              <>
                <rect x={cxC - (outVal.out.length * 8 + 24) / 2} y={yB + 32} width={outVal.out.length * 8 + 24} height={30} rx={6}
                  fill={outVal.hot ? `${AMBER}22` : "var(--muted)"} />
                <text x={cxC} y={yB + 52} textAnchor="middle" className="font-mono" fontSize={15} fontWeight={700}
                  style={{ fill: outVal.hot ? AMBER : "var(--muted-foreground)" }}>{outVal.out}</text>
              </>
            )}
          </g>
        </svg>

        {/* ── controls ── */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">spec</span>
            {SPECS.map((s, i) => (
              <button key={s.key} type="button" onClick={() => pick(i)} aria-pressed={i === si}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", i === si ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={i === si ? { background: INDIGO } : undefined}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={compile}
            className="ml-auto cursor-pointer rounded-md border px-3 py-1 font-mono text-[11px] font-semibold transition-colors hover:border-foreground/40"
            style={{ color: INDIGO, background: `${INDIGO}0f` }}>
            {phase === "compiling" ? "compiling…" : phase === "ready" ? "recompile" : "compile ▸"}
          </button>
        </div>

        <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
          <span className="font-mono text-[10px] text-muted-foreground/70">spec: </span>
          <span className="text-foreground">&ldquo;{spec.spec}&rdquo;</span>
        </p>

        <div className={cn("mt-3 transition-opacity", phase === "ready" ? "opacity-100" : "opacity-50")}>
          <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">{phase === "ready" ? "click an input to run it through the interpreter" : "compile first, then run inputs"}</div>
          <div className="flex flex-wrap gap-1.5">
            {spec.examples.map((ex, i) => (
              <button key={i} type="button" disabled={phase !== "ready"} onClick={() => run(i)} aria-pressed={active === i}
                className={cn("cursor-pointer rounded-md border px-2 py-1.5 text-left font-mono text-[11px] transition-all disabled:cursor-not-allowed", active === i ? "border-transparent text-foreground" : "text-muted-foreground hover:text-foreground")}
                style={active === i ? { background: `${INDIGO}14`, boxShadow: `inset 2px 0 0 ${INDIGO}` } : undefined}>
                {ex.in}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[9px] text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5">≈1/50 the memory</span>
          <span className="rounded bg-muted px-1.5 py-0.5">30 tok/s on an M3</span>
          <span className="rounded bg-muted px-1.5 py-0.5">offline</span>
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
