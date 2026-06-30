"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// A long-horizon agent trajectory, stepping. Each step is think → act (tool call) →
// observe → verify; the verifier's outcome is what makes the step a *trainable* target,
// not just text. Steps chain into trajectories that average ~45K tokens — the "horizon"
// Agents-A1 scales instead of parameters. A token meter climbs as the trajectory grows.
// Auto-plays; loops. Degrades to a static list of steps with no JS.

const STEPS = [
  { act: "search(\"reactant ↔ product enthalpy 2024\")", obs: "3 candidate papers returned", ok: true, tok: 3100 },
  { act: "open(paper_2).read(section=\"Methods\")", obs: "method uses DFT at ωB97X-D/def2", ok: true, tok: 9800 },
  { act: "code: run_dft(mol, basis=\"def2-TZVP\")", obs: "SCF did not converge", ok: false, tok: 18200 },
  { act: "code: run_dft(mol, basis=\"def2-TZVP\", damp=0.3)", obs: "ΔH = −altered, converged", ok: true, tok: 27500 },
  { act: "verify(ΔH against reported value)", obs: "within 1.2 kcal/mol — accepted", ok: true, tok: 34600 },
  { act: "answer(ΔH = −41.8 kcal/mol, cite paper_2)", obs: "task complete", ok: true, tok: 41900 },
] as const

export function AgentLoop() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % (STEPS.length + 1)), 1700)
    return () => clearInterval(id)
  }, [playing])

  const shownTok = k === 0 ? 0 : STEPS[Math.min(k, STEPS.length) - 1].tok
  const pct = Math.round((shownTok / 45000) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>one long-horizon trajectory · think → act → observe → verify</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-4">
        <div className="space-y-1.5">
          {STEPS.map((s, i) => {
            const shown = i < k
            const active = i === k - 1
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 transition-all",
                  active ? "border-foreground/40 bg-muted/40" : shown ? "opacity-100" : "opacity-25"
                )}
              >
                <span className="truncate font-mono text-[11px] text-foreground">{s.act}</span>
                <span className="truncate font-mono text-[10px] text-muted-foreground">→ {s.obs}</span>
                <span
                  className="rounded px-1.5 py-0.5 font-mono text-[9px]"
                  style={{
                    background: shown ? (s.ok ? "oklch(0.72 0.15 150 / 0.18)" : "oklch(0.72 0.15 25 / 0.18)") : "transparent",
                    color: shown ? (s.ok ? "oklch(0.62 0.15 150)" : "oklch(0.62 0.16 25)") : "transparent",
                  }}
                >
                  {s.ok ? "verify ✓" : "verify ✗"}
                </span>
              </div>
            )
          })}
        </div>

        {/* token horizon meter */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>trajectory length · climbing toward the ~45K-token average</span>
            <span className="tabular-nums text-foreground">{shownTok.toLocaleString()} tok</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, background: "oklch(0.72 0.15 195)" }} />
          </div>
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
