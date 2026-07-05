"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// A long-horizon agent trajectory, drawn as a climbing chain. Each step is
// think → act (tool call) → observe → verify; the verifier's outcome is what makes
// the step a *trainable* target, not just text. Steps chain into trajectories that
// average ~45K tokens — the "horizon" Agents-A1 scales instead of parameters. The
// chain climbs toward that horizon; scrub or play to walk it. Illustrative.

const ACCENT = "oklch(0.72 0.15 195)"
const OK = "oklch(0.66 0.15 150)"
const BAD = "oklch(0.63 0.2 25)"
const HORIZON = 45000

const STEPS = [
  { phase: "act", act: "search(\"reactant ↔ product enthalpy 2024\")", obs: "3 candidate papers returned", ok: true, tok: 3100 },
  { phase: "act", act: "open(paper_2).read(section=\"Methods\")", obs: "method uses DFT at ωB97X-D/def2", ok: true, tok: 9800 },
  { phase: "act", act: "code: run_dft(mol, basis=\"def2-TZVP\")", obs: "SCF did not converge", ok: false, tok: 18200 },
  { phase: "act", act: "code: run_dft(mol, basis=\"def2-TZVP\", damp=0.3)", obs: "ΔH = −altered, converged", ok: true, tok: 27500 },
  { phase: "verify", act: "verify(ΔH against reported value)", obs: "within 1.2 kcal/mol — accepted", ok: true, tok: 34600 },
  { phase: "answer", act: "answer(ΔH = −41.8 kcal/mol, cite paper_2)", obs: "task complete", ok: true, tok: 41900 },
] as const

// scene geometry (viewBox units)
const W = 760
const H = 260
const PL = 46
const PR = 22
const PT = 30
const PB = 58
const NW = 30 // node radius-ish (rendered as rounded square)
const NH = 26

const cx = (i: number) => PL + (i / (STEPS.length - 1)) * (W - PL - PR)
const cy = (tok: number) => PT + (1 - tok / HORIZON) * (H - PT - PB)

export function AgentLoop() {
  const [k, setK] = useState(STEPS.length - 1)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % STEPS.length), 1700)
    return () => clearInterval(id)
  }, [playing])

  const cur = STEPS[k]
  const shownTok = cur.tok
  const pct = Math.round((shownTok / HORIZON) * 100)

  // filled horizon area under the shown portion of the chain
  const baseY = H - PB
  const area =
    `M ${cx(0)} ${baseY} ` +
    STEPS.slice(0, k + 1).map((s, i) => `L ${cx(i)} ${cy(s.tok)}`).join(" ") +
    ` L ${cx(k)} ${baseY} Z`

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one long-horizon trajectory · think → act → observe → verify</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Step ${k + 1} of ${STEPS.length}, trajectory at ${shownTok.toLocaleString()} of ~45,000 tokens`}>
          <defs>
            <marker id="a1al-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="a1al-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
            <linearGradient id="a1al-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.2} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* horizon reference line */}
          <line x1={PL} x2={W - PR} y1={cy(HORIZON)} y2={cy(HORIZON)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />
          <text x={W - PR} y={cy(HORIZON) - 6} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>~45K-token horizon</text>

          {/* filled climb */}
          <path d={area} fill="url(#a1al-fill)" className="transition-all duration-500" />

          {/* connectors between consecutive steps (drawn behind nodes) */}
          {STEPS.slice(1).map((s, idx) => {
            const i = idx + 1
            const shown = i <= k
            return (
              <path
                key={i}
                d={curve(cx(i - 1), cy(STEPS[i - 1].tok), cx(i), cy(s.tok))}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.5}
                markerEnd="url(#a1al-arrow)"
                opacity={shown ? 0.85 : 0.16}
                className="transition-all duration-500"
              />
            )
          })}

          {/* step nodes */}
          {STEPS.map((s, i) => {
            const shown = i <= k
            const active = i === k
            const color = s.ok ? OK : BAD
            return (
              <g key={i} className="transition-all duration-300">
                <rect
                  x={cx(i) - NW / 2}
                  y={cy(s.tok) - NH / 2}
                  width={NW}
                  height={NH}
                  rx={7}
                  fill="var(--background)"
                  stroke={shown ? color : "var(--border)"}
                  strokeWidth={active ? 2 : 1.5}
                  opacity={shown ? 1 : 0.4}
                  filter={active ? "url(#a1al-soft)" : undefined}
                />
                <text x={cx(i)} y={cy(s.tok) + 3.5} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={shown ? color : "var(--muted-foreground)"}>
                  {s.ok ? "✓" : "✗"}
                </text>
                <text x={cx(i)} y={H - PB + 18} textAnchor="middle" className={cn("font-mono", active ? "fill-foreground" : "fill-muted-foreground/70")} fontSize={10}>
                  {i + 1}
                </text>
                <text x={cx(i)} y={H - PB + 32} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={8}>
                  {(s.tok / 1000).toFixed(1)}k
                </text>
              </g>
            )
          })}

          <text x={PL} y={16} className="fill-muted-foreground font-mono" fontSize={10}>tokens accumulated ↑</text>
        </svg>

        {/* scrubber */}
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>step {k + 1} / {STEPS.length} (drag)</span>
            <span className="tabular-nums text-foreground">{shownTok.toLocaleString()} tok · {pct}% of horizon</span>
          </div>
          <input
            type="range"
            min={0}
            max={STEPS.length - 1}
            value={k}
            onChange={(e) => { setPlaying(false); setK(Number(e.target.value)) }}
            className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]"
          />
        </div>

        {/* active-step detail — grid-stacked so height never shifts; minmax(0,1fr)
            column so the long code line truncates instead of stretching the figure */}
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)]">
          {STEPS.map((s, i) => (
            <div
              key={i}
              aria-hidden={i !== k}
              className={cn(
                "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-2.5 transition-opacity duration-300",
                i === k ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ borderLeftColor: s.ok ? OK : BAD }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-foreground">{s.act}</span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px]"
                  style={{ background: `${s.ok ? OK : BAD}22`, color: s.ok ? OK : BAD }}
                >
                  {s.ok ? "verify ✓" : "verify ✗"}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] text-muted-foreground">→ {s.obs}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The <span className="text-foreground">verifier outcome</span> on each step — did the code
          converge, did the answer match — is what turns a raw trace into a{" "}
          <span className="text-foreground">trainable target</span>. Chaining hundreds of these is the
          horizon Agents-A1 scales, instead of the parameter count.
        </p>
      </div>
    </figure>
  )
}
