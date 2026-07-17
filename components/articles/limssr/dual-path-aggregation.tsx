"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// LIMSSR — Mask-Aware Dual-Path Aggregation (MDA). Two paths read the same
// mask m (which modalities are present) and produce a score each:
//   - uncertainty-calibrated reasoning: role-aware + mask-aware refinement; it
//     explicitly discounts low-confidence dimensions, so it degrades gracefully.
//   - cross-modal pattern recovery: cross-attention + gated weighting + a learnable
//     confidence; strong when modalities are present, shaky when they are not.
// A learnable-confidence gate blends them. Drop modalities and the recovery path's
// confidence collapses, so the gate leans on the calibrated path — which is exactly
// how MDA suppresses hallucinated imputations. The confidence dynamics are
// illustrative; the real ablation (Xu et al., 2026, Table 6) is in the prose below.

const ACCENT = "oklch(0.62 0.15 250)"

type Mod = "v" | "f" | "a"
const MODS: { id: Mod; label: string }[] = [
  { id: "v", label: "RGB" },
  { id: "f", label: "flow" },
  { id: "a", label: "audio" },
]

const W = 760
const H = 280

// path node geometry
const NX = 196
const NW = 214
const NH = 76
const P1Y = 34
const P2Y = 170
const AGX = 470
const AGW = 150
const AGY = 92
const AGH = 96

function hcurve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function DualPathAggregation() {
  const [present, setPresent] = useState<Record<Mod, boolean>>({ v: true, f: false, a: false })

  const count = (present.v ? 1 : 0) + (present.f ? 1 : 0) + (present.a ? 1 : 0)
  const miss = 3 - count

  // illustrative confidences
  const conf1 = 0.85 - 0.05 * miss // calibrated reasoning: degrades gracefully
  const conf2 = 0.9 * (count / 3) // cross-modal recovery: collapses as modalities go
  const w1 = conf1 / (conf1 + conf2) // learnable-confidence gate
  const w2 = 1 - w1

  function toggle(m: Mod) {
    if (present[m] && count === 1) return
    setPresent((p) => ({ ...p, [m]: !p[m] }))
  }

  const p1cy = P1Y + NH / 2
  const p2cy = P2Y + NH / 2
  const maskCy = 140

  const pathNode = (
    y: number,
    tag: string,
    l1: string,
    l2: string,
    sub: string,
    conf: number,
    accent: boolean
  ) => {
    const barW = 118
    const stroke = accent ? ACCENT : "var(--border)"
    return (
      <g>
        <rect x={NX} y={y} width={NW} height={NH} rx={11} fill="var(--background)" stroke={stroke} strokeWidth={1.5} filter="url(#dp-soft)" />
        <rect x={NX + NW - 56} y={y + 9} width={48} height={15} rx={7} fill={accent ? ACCENT : "var(--muted)"} opacity={accent ? 0.16 : 1} />
        <text x={NX + NW - 32} y={y + 19} textAnchor="middle" className="font-mono" fontSize={8.5} fill={accent ? ACCENT : "var(--muted-foreground)"}>
          {tag}
        </text>
        <text x={NX + 14} y={y + 21} className="fill-foreground font-mono" fontSize={11.5} fontWeight={600}>
          {l1}
        </text>
        <text x={NX + 14} y={y + 35} className="fill-foreground font-mono" fontSize={11.5} fontWeight={600}>
          {l2}
        </text>
        <text x={NX + 14} y={y + 50} className="fill-muted-foreground font-mono" fontSize={8.5}>
          {sub}
        </text>
        {/* confidence bar */}
        <rect x={NX + 14} y={y + NH - 16} width={barW} height={6} rx={3} fill="var(--muted)" />
        <rect x={NX + 14} y={y + NH - 16} width={Math.max(barW * conf, 2)} height={6} rx={3} fill={accent ? ACCENT : "var(--muted-foreground)"} className="transition-all duration-300" />
        <text x={NX + 14 + barW + 8} y={y + NH - 10} className="font-mono" fontSize={9} fill={accent ? ACCENT : "var(--muted-foreground)"}>
          {conf.toFixed(2)}
        </text>
      </g>
    )
  }

  // split-bar geometry inside aggregation node
  const sbX = AGX + 16
  const sbY = AGY + 30
  const sbW = 20
  const sbH = AGH - 42
  const top = sbH * w1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mask-aware dual-path aggregation</span>
        <span className="text-muted-foreground/50">gate weights, illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`With ${count} of 3 modalities present, the gate puts weight ${(w1 * 100).toFixed(0)} percent on the calibrated reasoning path and ${(w2 * 100).toFixed(0)} percent on the cross-modal recovery path.`}>
          <defs>
            <marker id="dp-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="dp-arrow-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="dp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* mask -> paths */}
          <path d={hcurve(110, maskCy, NX, p1cy)} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.75} />
          <path d={hcurve(110, maskCy, NX, p2cy)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} opacity={0.6} />

          {/* paths -> aggregation, thickness = gate weight */}
          <path d={hcurve(NX + NW, p1cy, AGX, AGY + AGH * 0.32)} fill="none" stroke={ACCENT} strokeWidth={1 + 4 * w1} markerEnd="url(#dp-arrow)" opacity={0.9} className="transition-all duration-300" />
          <path d={hcurve(NX + NW, p2cy, AGX, AGY + AGH * 0.68)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1 + 4 * w2} markerEnd="url(#dp-arrow-m)" opacity={0.85} className="transition-all duration-300" />

          {/* aggregation -> output */}
          <path d={hcurve(AGX + AGW, maskCy, 656, maskCy)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#dp-arrow)" opacity={0.9} />

          {/* mask node */}
          <rect x={18} y={maskCy - 38} width={92} height={76} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#dp-soft)" />
          <text x={64} y={maskCy - 22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            mask m
          </text>
          {MODS.map((mod, i) => {
            const on = present[mod.id]
            const cx = 34 + i * 20
            return (
              <g key={mod.id}>
                <rect x={cx - 8} y={maskCy - 12} width={16} height={16} rx={4} fill={on ? ACCENT : "var(--muted)"} opacity={on ? 0.9 : 1} />
                <text x={cx} y={maskCy - 0.5} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill={on ? "var(--background)" : "var(--muted-foreground)"}>
                  {on ? "1" : "0"}
                </text>
                <text x={cx} y={maskCy + 22} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
                  {mod.label}
                </text>
              </g>
            )
          })}

          {/* path nodes */}
          {pathNode(P1Y, "path 1", "uncertainty-calibrated", "reasoning", "role-aware · mask-aware refine", conf1, true)}
          {pathNode(P2Y, "path 2", "cross-modal pattern", "recovery", "cross-attn · gated · learn. conf.", conf2, false)}

          {/* aggregation node */}
          <rect x={AGX} y={AGY} width={AGW} height={AGH} rx={11} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#dp-soft)" />
          <text x={AGX + 14} y={AGY + 18} className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>
            mask-aware
          </text>
          <text x={AGX + 14} y={AGY + 30} className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>
            aggregation
          </text>
          {/* weight split bar */}
          <rect x={sbX} y={sbY} width={sbW} height={sbH} rx={4} fill="var(--muted-foreground)" opacity={0.5} />
          <rect x={sbX} y={sbY} width={sbW} height={Math.max(top, 2)} rx={4} fill={ACCENT} className="transition-all duration-300" />
          <text x={sbX + sbW + 8} y={sbY + 10} className="font-mono" fontSize={9} fill={ACCENT}>
            reason {(w1 * 100).toFixed(0)}%
          </text>
          <text x={sbX + sbW + 8} y={sbY + sbH - 1} className="fill-muted-foreground font-mono" fontSize={9}>
            recover {(w2 * 100).toFixed(0)}%
          </text>

          {/* output node */}
          <rect x={656} y={maskCy - 26} width={90} height={52} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#dp-soft)" />
          <text x={701} y={maskCy - 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={15} fontWeight={700}>
            ŷ
          </text>
          <text x={701} y={maskCy + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>
            quality score
          </text>
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
            {count}/3 present &middot; gate <span style={{ color: ACCENT }}>{(w1 * 100).toFixed(0)}%</span> reason / {(w2 * 100).toFixed(0)}% recover
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          When every modality is present the two paths agree and split the vote. Drop modalities and the
          recovery path has little left to cross-attend over, so its <span className="text-foreground">learnable
          confidence</span> falls and the gate shifts weight to the calibrated path &mdash; the one that already
          discounts what it cannot trust. That shift is the anti-hallucination mechanism: on FS1000 the full gate
          cuts mean-squared error from <span className="text-foreground">18.18</span> (simple fusion) to{" "}
          <span style={{ color: ACCENT }}>14.08</span>, at &rho; 0.789. (Gate dynamics illustrative.)
        </p>
      </div>
    </figure>
  )
}
