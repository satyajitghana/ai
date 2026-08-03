"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Sol-Engine's headline is "five techniques, 2-3x end-to-end" — but that number is
// a per-model COMPOSITION, and Sol-Attn is not in most of it. Six of these eight
// model lines are cache + kernel-fusion + (sometimes) quantization/token-pruning;
// their sparse-attention slot is PISA, not Sol-Attn. Sol-Attn itself only just
// landed, wired into two model lines whose end-to-end re-benchmark the engine's
// own README marks pending. Pick a model to see which of the five techniques
// actually compose its number. Speedups are the engine repo's own GB200,
// warmup-excluded figures (see caption); this is not a re-measurement.

type Tech = "cache" | "quant" | "kernel" | "sparse" | "prune"

const TECH_LABEL: Record<Tech, string> = {
  cache: "cache",
  quant: "quant (NVFP4)",
  kernel: "kernel fusion",
  sparse: "sparse attn",
  prune: "token prune",
}

type Row = {
  model: string
  short: string
  params: string
  techs: Tech[]
  sparseImpl?: string
  speedup: number | null
}

const ROWS: Row[] = [
  { model: "Wan2.2 TI2V-5B", short: "Wan-5B", params: "5B", techs: ["cache", "kernel"], speedup: 2.89 },
  { model: "SANA-Video", short: "SANA-Video", params: "2B", techs: ["cache", "kernel"], speedup: 2.77 },
  { model: "LingBot-Video", short: "LingBot", params: "30B-A3B MoE", techs: ["cache", "kernel", "sparse"], sparseImpl: "PISA", speedup: 2.60 },
  { model: "LTX-2.3", short: "LTX-2.3", params: "22B", techs: ["cache", "kernel", "quant", "sparse", "prune"], sparseImpl: "PISA", speedup: 2.38 },
  { model: "Cosmos3-Super", short: "Cosmos3", params: "64B", techs: ["cache", "quant"], speedup: 2.27 },
  { model: "Wan2.2-A14B", short: "Wan-A14B", params: "14B MoE", techs: ["cache", "kernel", "sparse"], sparseImpl: "PISA", speedup: 2.17 },
  { model: "HunyuanVideo-13B", short: "HunyuanVideo", params: "13B", techs: ["cache", "kernel", "sparse"], sparseImpl: "Sol-Attn", speedup: null },
  { model: "Wan2.1-T2V-14B", short: "Wan2.1-14B", params: "14B", techs: ["cache", "kernel", "sparse"], sparseImpl: "Sol-Attn", speedup: null },
]

const ACCENT = "oklch(0.62 0.15 155)"
const PENDING = "oklch(0.72 0.14 70)"

// ── geometry ──
const W = 720
const AXIS_MAX = 3.2
const ROW_H = 27
const ROW_GAP = 6
const TOP = 20
const PLOT_X = 152
const PLOT_W = W - PLOT_X - 46
const H = TOP + ROWS.length * (ROW_H + ROW_GAP) + 28
const xAt = (v: number) => PLOT_X + (v / AXIS_MAX) * PLOT_W

export function EngineStack() {
  const [selected, setSelected] = useState(0)
  const row = ROWS[selected]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>sol-engine · five techniques, composed per model</span>
        <span className="text-muted-foreground/50">GB200, warmup-excluded</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="End-to-end speedup by model in Sol-Engine, decomposed by which of five acceleration techniques compose it">
          <defs>
            <filter id="es-soft" x="-30%" y="-40%" width="160%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
            <pattern id="es-hatch" width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <line x1={0} y1={0} x2={0} y2={6} stroke={PENDING} strokeWidth={2} opacity={0.55} />
            </pattern>
          </defs>

          {/* gridlines + dense baseline */}
          {[1, 2, 3].map((v) => (
            <g key={v}>
              <line x1={xAt(v)} y1={TOP - 6} x2={xAt(v)} y2={H - 24} stroke="var(--border)" strokeWidth={1} opacity={v === 1 ? 0.7 : 0.35} strokeDasharray={v === 1 ? "3 3" : undefined} />
              <text x={xAt(v)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{v}×</text>
            </g>
          ))}
          <text x={xAt(1)} y={TOP - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>dense</text>

          {ROWS.map((r, i) => {
            const y = TOP + i * (ROW_H + ROW_GAP)
            const isSel = i === selected
            const hasNum = r.speedup != null
            return (
              <g key={r.model} opacity={isSel ? 1 : 0.55} className="transition-opacity duration-200">
                <text x={PLOT_X - 10} y={y + ROW_H / 2 + 4} textAnchor="end" className="font-mono" fontSize={10} fill={isSel ? "var(--foreground)" : "var(--muted-foreground)"} fontWeight={isSel ? 600 : 400}>
                  {r.short}
                </text>
                {hasNum ? (
                  <rect
                    x={xAt(1)}
                    y={y + 3}
                    width={Math.max(xAt(r.speedup!) - xAt(1), 2)}
                    height={ROW_H - 6}
                    rx={4}
                    fill={r.sparseImpl === "Sol-Attn" ? ACCENT : "oklch(0.62 0.02 260)"}
                    opacity={isSel ? 0.9 : 0.5}
                    filter={isSel ? "url(#es-soft)" : undefined}
                  />
                ) : (
                  <rect x={xAt(1)} y={y + 3} width={xAt(1.55) - xAt(1)} height={ROW_H - 6} rx={4} fill="url(#es-hatch)" stroke={PENDING} strokeWidth={1} strokeDasharray="3 2" opacity={isSel ? 0.95 : 0.6} />
                )}
                <text x={hasNum ? xAt(r.speedup!) + 8 : xAt(1.55) + 8} y={y + ROW_H / 2 + 4} className="font-mono" fontSize={10} fontWeight={600} fill={hasNum ? (isSel ? "var(--foreground)" : "var(--muted-foreground)") : PENDING}>
                  {hasNum ? `${r.speedup!.toFixed(2)}×` : "pending"}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex flex-wrap gap-1.5">
          {ROWS.map((r, i) => (
            <button
              key={r.model}
              type="button"
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                selected === i ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.short}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="font-semibold text-foreground">{row.model}</span>
            <span className="text-muted-foreground">({row.params})</span>
            <span className="text-muted-foreground">·</span>
            {row.techs.map((t, i) => (
              <span key={t} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-muted-foreground/50">+</span>}
                <span
                  className={cn(
                    "rounded-md border px-1.5 py-0.5",
                    t === "sparse" && row.sparseImpl === "Sol-Attn" ? "border-transparent text-background" : "text-muted-foreground"
                  )}
                  style={t === "sparse" && row.sparseImpl === "Sol-Attn" ? { background: ACCENT } : undefined}
                >
                  {TECH_LABEL[t]}{t === "sparse" ? ` (${row.sparseImpl})` : ""}
                </span>
              </span>
            ))}
            <span className="ml-auto text-muted-foreground">
              {row.speedup != null ? `${row.speedup.toFixed(2)}× end-to-end` : "end-to-end: re-benchmark pending"}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Six of these eight lines never touch Sol-Attn at all — their sparse-attention slot, where they have
          one, is <span className="text-foreground">PISA</span>, an earlier piecewise sparse-attention method
          from the same group. Sol-Attn is wired into two lines (highlighted{" "}
          <span style={{ color: ACCENT }}>green</span> above) as of the same day this paper posted, and the
          engine repo itself marks their end-to-end number{" "}
          <span style={{ color: PENDING }}>pending</span> re-benchmark — it does not yet claim a shipped number
          for Sol-Attn in the engine. The paper&apos;s own separate integration test (different two models,
          B200 rather than GB200) reports 3.48× and 5.08×; that is a real number, just not one measured on
          this table under this harness.
        </p>
      </div>
    </figure>
  )
}
