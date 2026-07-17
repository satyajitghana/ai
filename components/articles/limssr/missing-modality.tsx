"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// LIMSSR — missing modalities at TRAINING and inference time.
// Toggle which of {RGB video, optical flow, audio} are present. A naive multimodal
// model has fixed input slots: a missing modality is zero-filled and its Spearman
// correlation collapses (worst case, audio-only: rho = 0.177). LIMSSR replaces the
// missing slot with a special token plus a textual "which modalities are missing"
// condition, and prompts the LLM to INFER the missing modality's latent role from the
// available context — no feature reconstruction. Numbers are the real FS1000 results
// (Xu et al., 2026, Table 1): naive = MLP-Mixer, ours = LIMSSR. Both are tested under
// missing modalities; LIMSSR additionally *trains* under them.

const ACCENT = "oklch(0.62 0.15 250)"
const WARN = "oklch(0.58 0.19 25)"

type Mod = "v" | "f" | "a"
const MODS: { id: Mod; short: string; label: string }[] = [
  { id: "v", short: "RGB", label: "RGB video" },
  { id: "f", short: "flow", label: "optical flow" },
  { id: "a", short: "audio", label: "audio" },
]

// Spearman rho on FS1000 by available-modality set, 3-bit key = v f a.
const RHO_NAIVE: Record<string, number> = {
  "111": 0.819, "110": 0.722, "101": 0.542, "011": 0.474,
  "100": 0.623, "010": 0.472, "001": 0.177,
}
const RHO_LIMSSR: Record<string, number> = {
  "111": 0.891, "110": 0.854, "101": 0.891, "011": 0.709,
  "100": 0.853, "010": 0.618, "001": 0.687,
}

const W = 760
const H = 250
const ROWS = [56, 118, 180] // row centres
const SLOT_X = 14
const SLOT_W = 92
const SLOT_H = 44
const FUS_X = 140
const FUS_W = 52
const FUS_CY = 118
const SC_X = 216
const SC_W = 122
const SC_Y = 78
const SC_H = 80

function hcurve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function MissingModality() {
  const [present, setPresent] = useState<Record<Mod, boolean>>({ v: true, f: false, a: false })

  const key = `${present.v ? 1 : 0}${present.f ? 1 : 0}${present.a ? 1 : 0}`
  const count = (present.v ? 1 : 0) + (present.f ? 1 : 0) + (present.a ? 1 : 0)
  const rhoNaive = RHO_NAIVE[key] ?? 0
  const rhoLimssr = RHO_LIMSSR[key] ?? 0

  function toggle(m: Mod) {
    // keep at least one modality present
    if (present[m] && count === 1) return
    setPresent((p) => ({ ...p, [m]: !p[m] }))
  }

  const renderPanel = (ox: number, mode: "naive" | "limssr", rho: number) => {
    const isL = mode === "limssr"
    const good = isL
    const valColor = good ? ACCENT : rho < 0.5 ? WARN : "var(--muted-foreground)"
    const barW = SC_W - 28
    return (
      <g key={mode}>
        <text x={ox + SLOT_X} y={26} className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
          {isL ? "LIMSSR" : "naive fusion"}
        </text>
        <text x={ox + SLOT_X} y={40} className="fill-muted-foreground font-mono" fontSize={9}>
          {isL ? "special token + prompt → infer" : "fixed slots → zero-fill"}
        </text>

        {/* connectors modality -> fusion */}
        {MODS.map((mod, i) => {
          const on = present[mod.id]
          const stroke = on ? (good ? ACCENT : "var(--muted-foreground)") : good ? ACCENT : "var(--border)"
          return (
            <path
              key={mod.id}
              d={hcurve(ox + SLOT_X + SLOT_W, ROWS[i], ox + FUS_X, FUS_CY)}
              fill="none"
              stroke={stroke}
              strokeWidth={1.5}
              strokeDasharray={on ? undefined : "4 3"}
              opacity={on ? 0.85 : good ? 0.7 : 0.3}
              className="transition-all duration-300"
            />
          )
        })}
        {/* fusion -> score */}
        <path
          d={hcurve(ox + FUS_X + FUS_W, FUS_CY, ox + SC_X, SC_Y + SC_H / 2)}
          fill="none"
          stroke={good ? ACCENT : "var(--muted-foreground)"}
          strokeWidth={1.5}
          markerEnd={`url(#mm-arrow-${mode})`}
          opacity={0.85}
        />

        {/* modality slots */}
        {MODS.map((mod, i) => {
          const on = present[mod.id]
          const y = ROWS[i] - SLOT_H / 2
          const status = on ? "present" : good ? "⟨token⟩" : "zero-fill"
          const fill = on ? "var(--background)" : good ? "var(--background)" : "var(--muted)"
          const stroke = on ? ACCENT : good ? ACCENT : "var(--border)"
          return (
            <g key={mod.id} className="transition-all duration-300">
              <rect
                x={ox + SLOT_X}
                y={y}
                width={SLOT_W}
                height={SLOT_H}
                rx={8}
                fill={fill}
                fillOpacity={!on && !good ? 0.5 : 1}
                stroke={stroke}
                strokeWidth={1.5}
                strokeDasharray={on ? undefined : "4 3"}
                filter={on ? "url(#mm-soft)" : undefined}
              />
              {on ? <circle cx={ox + SLOT_X + 12} cy={y + 12} r={2.6} fill={ACCENT} /> : null}
              <text x={ox + SLOT_X + SLOT_W / 2} y={ROWS[i] - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600} opacity={on || good ? 1 : 0.6}>
                {mod.short}
              </text>
              <text x={ox + SLOT_X + SLOT_W / 2} y={ROWS[i] + 12} textAnchor="middle" fontSize={8.5} className="font-mono" fill={on ? "var(--muted-foreground)" : good ? ACCENT : "var(--muted-foreground)"}>
                {status}
              </text>
            </g>
          )
        })}

        {/* fusion node */}
        <rect x={ox + FUS_X} y={52} width={FUS_W} height={132} rx={9} fill="var(--background)" stroke={good ? ACCENT : "var(--border)"} strokeWidth={1.5} filter="url(#mm-soft)" />
        <text x={ox + FUS_X + FUS_W / 2} y={FUS_CY - 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
          {isL ? "LLM" : "concat"}
        </text>
        <text x={ox + FUS_X + FUS_W / 2} y={FUS_CY + 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
          {isL ? "+LoRA" : "MLP"}
        </text>

        {/* score node */}
        <rect x={ox + SC_X} y={SC_Y} width={SC_W} height={SC_H} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#mm-soft)" />
        <text x={ox + SC_X + SC_W / 2} y={SC_Y + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
          Spearman &rho;
        </text>
        <text x={ox + SC_X + SC_W / 2} y={SC_Y + 44} textAnchor="middle" className="font-mono" fontSize={22} fontWeight={700} fill={valColor} style={{ transition: "fill 300ms" }}>
          {rho.toFixed(3)}
        </text>
        <rect x={ox + SC_X + 14} y={SC_Y + SC_H - 16} width={barW} height={6} rx={3} fill="var(--muted)" />
        <rect x={ox + SC_X + 14} y={SC_Y + SC_H - 16} width={Math.max(barW * rho, 2)} height={6} rx={3} fill={valColor} className="transition-all duration-300" />
      </g>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>drop a modality &middot; watch each model react</span>
        <span className="text-muted-foreground/50">FS1000, real &rho;</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`With modalities ${key} present, naive fusion scores ${rhoNaive.toFixed(3)} Spearman correlation and LIMSSR scores ${rhoLimssr.toFixed(3)}.`}>
          <defs>
            <marker id="mm-arrow-naive" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <marker id="mm-arrow-limssr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="mm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* divider */}
          <line x1={W / 2} y1={16} x2={W / 2} y2={H - 12} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />

          {renderPanel(0, "naive", rhoNaive)}
          {renderPanel(W / 2 + 20, "limssr", rhoLimssr)}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">present</span>
            {MODS.map((mod) => {
              const on = present[mod.id]
              const last = on && count === 1
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => toggle(mod.id)}
                  disabled={last}
                  aria-pressed={on}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                    on ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                    last && "cursor-not-allowed opacity-60"
                  )}
                  style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
                >
                  {mod.label}
                </button>
              )
            })}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {count}/3 present &middot; naive <span style={{ color: rhoNaive < 0.5 ? WARN : undefined }}>{rhoNaive.toFixed(3)}</span> &middot;{" "}
            LIMSSR <span style={{ color: ACCENT }}>{rhoLimssr.toFixed(3)}</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The naive model owns a fixed slot per modality. Remove one and it feeds zeros, so the score slides
          &mdash; and with audio only it falls to <span className="text-foreground">0.177</span>, barely above chance.
          LIMSSR turns the empty slot into a <span style={{ color: ACCENT }}>special token</span> and tells the LLM,
          in words, which modalities are gone; the LLM infers the missing part&rsquo;s latent role from what
          remains rather than reconstructing it, holding <span style={{ color: ACCENT }}>0.687</span> on the same
          audio-only case. (Illustrative pipeline; &rho; values are the paper&rsquo;s FS1000 numbers.)
        </p>
      </div>
    </figure>
  )
}
