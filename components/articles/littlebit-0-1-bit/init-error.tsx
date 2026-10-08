"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Relative Frobenius error ||W - W0|| / ||W|| of LittleBit's Dual-SVID initialization, measured
// by a numpy re-implementation of the paper's Eqs. 6-8 and quantization/modules/littlebit.py:283-343
// on three real Llama-2-7B matrices (NousResearch/Llama-2-7b-hf, read by HTTP range request),
// float64, exact SVDs. Ranks follow the code's rule (littlebit.py:55-85, floored to multiples of 8).
//
//   svd     truncated SVD at the one-path rank, no binarization (the low-rank ceiling)
//   single  Dual-SVID, one path at the one-path rank
//   flat    the same with the latent scale l replaced by its mean
//   res     Dual-SVID primary + residual, two paths at the two-path rank
//   onebit  sign(W) with a rank-1 |W| scale (OneBit-style SVID), about 1 bit per weight

type Row = { bpw: number; rs: number; rr: number; svd: number; single: number; flat: number; res: number }
type Tensor = { label: string; shape: string; note: string; onebit: number; rows: Row[] }

const DATA: Record<string, Tensor> = {
  q0: {
    label: "layer 0 q_proj",
    shape: "4,096 x 4,096",
    note: "almost low-rank: the top 80 directions hold 90% of the energy",
    onebit: 0.627,
    rows: [
      { bpw: 0.1, rs: 184, rr: 80, svd: 0.208, single: 0.823, flat: 0.91, res: 0.719 },
      { bpw: 0.3, rs: 592, rr: 288, svd: 0.089, single: 0.831, flat: 0.951, res: 0.699 },
      { bpw: 0.55, rs: 1104, rr: 544, svd: 0.042, single: 0.838, flat: 0.968, res: 0.706 },
      { bpw: 0.7, rs: 1408, rr: 696, svd: 0.029, single: 0.84, flat: 0.973, res: 0.71 },
      { bpw: 0.8, rs: 1616, rr: 800, svd: 0.022, single: 0.841, flat: 0.976, res: 0.712 },
      { bpw: 1.0, rs: 2024, rr: 1000, svd: 0.014, single: 0.842, flat: 0.98, res: 0.716 },
    ],
  },
  q15: {
    label: "layer 15 q_proj",
    shape: "4,096 x 4,096",
    note: "flat spectrum: the top 184 directions hold 36% of the energy",
    onebit: 0.605,
    rows: [
      { bpw: 0.1, rs: 184, rr: 80, svd: 0.798, single: 0.93, flat: 0.932, res: 0.929 },
      { bpw: 0.3, rs: 592, rr: 288, svd: 0.592, single: 0.869, flat: 0.879, res: 0.848 },
      { bpw: 0.55, rs: 1104, rr: 544, svd: 0.419, single: 0.829, flat: 0.85, res: 0.785 },
      { bpw: 0.7, rs: 1408, rr: 696, svd: 0.339, single: 0.815, flat: 0.843, res: 0.757 },
      { bpw: 0.8, rs: 1616, rr: 800, svd: 0.291, single: 0.808, flat: 0.841, res: 0.74 },
      { bpw: 1.0, rs: 2024, rr: 1000, svd: 0.21, single: 0.798, flat: 0.842, res: 0.714 },
    ],
  },
  d15: {
    label: "layer 15 down_proj",
    shape: "4,096 x 11,008",
    note: "flatter still: the top 280 directions hold about a fifth of the energy",
    onebit: 0.603,
    rows: [
      { bpw: 0.1, rs: 280, rr: 128, svd: 0.888, single: 0.957, flat: 0.958, res: 0.959 },
      { bpw: 0.3, rs: 872, rr: 424, svd: 0.728, single: 0.903, flat: 0.905, res: 0.898 },
      { bpw: 0.55, rs: 1624, rr: 800, svd: 0.553, single: 0.852, flat: 0.857, res: 0.837 },
      { bpw: 0.7, rs: 2064, rr: 1024, svd: 0.459, single: 0.83, flat: 0.837, res: 0.805 },
      { bpw: 0.8, rs: 2368, rr: 1176, svd: 0.397, single: 0.817, flat: 0.827, res: 0.785 },
      { bpw: 1.0, rs: 2960, rr: 1472, svd: 0.279, single: 0.797, flat: 0.812, res: 0.751 },
    ],
  },
}

const SERIES = [
  { key: "svd", label: "truncated SVD, not binarized", color: "var(--muted-foreground)", dash: "4 3" },
  { key: "flat", label: "Dual-SVID, one path, no latent scale", color: "var(--chart-4)", dash: "2 3" },
  { key: "single", label: "Dual-SVID, one path", color: "var(--chart-2)", dash: "" },
  { key: "res", label: "Dual-SVID, primary + residual", color: "var(--chart-1)", dash: "" },
] as const

export function InitError() {
  const [key, setKey] = useState<keyof typeof DATA>("q15")
  const [pick, setPick] = useState(0)
  const t = DATA[key]

  const W = 640
  const H = 260
  const x0 = 44
  const x1 = W - 16
  const y0 = 16
  const y1 = H - 34
  const X = (b: number) => x0 + ((b - 0.1) / 0.9) * (x1 - x0)
  const Y = (e: number) => y0 + (1 - e) * (y1 - y0)
  const sel = t.rows[pick]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Dual-SVID on real Llama2-7B weights, before any training</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {t.label} · {t.shape}
        </span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(DATA).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors hover:bg-muted/30",
                k === key && "bg-muted/40 text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Relative reconstruction error against bits per weight for ${t.label}: truncated SVD falls from ${t.rows[0].svd} to ${t.rows[5].svd}, Dual-SVID with one path stays between ${t.rows[5].single} and ${t.rows[0].single}, and primary plus residual between ${Math.min(...t.rows.map((r) => r.res))} and ${Math.max(...t.rows.map((r) => r.res))}.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((e) => (
            <g key={e}>
              <line x1={x0} y1={Y(e)} x2={x1} y2={Y(e)} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={x0 - 6} y={Y(e) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {e.toFixed(2)}
              </text>
            </g>
          ))}
          <line x1={x0} y1={Y(t.onebit)} x2={x1} y2={Y(t.onebit)} stroke="var(--foreground)" strokeOpacity={0.4} />
          <text x={x1} y={Y(t.onebit) - 4} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
            sign(W) with rank-1 scales, about 1 bit: {t.onebit.toFixed(3)}
          </text>
          {t.rows.map((r, i) => (
            <g key={r.bpw} onClick={() => setPick(i)} className="cursor-pointer">
              <rect x={X(r.bpw) - 14} y={y0} width={28} height={y1 - y0} fill={i === pick ? "var(--muted)" : "transparent"} fillOpacity={0.35} />
              <text x={X(r.bpw)} y={H - 18} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                {r.bpw}
              </text>
            </g>
          ))}
          <text x={(x0 + x1) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
            target bits per weight (click a column)
          </text>
          {SERIES.map((s) => {
            const pts = t.rows.map((r) => `${X(r.bpw)},${Y(r[s.key])}`).join(" ")
            return (
              <g key={s.key}>
                <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
                {t.rows.map((r) => (
                  <circle key={r.bpw} cx={X(r.bpw)} cy={Y(r[s.key])} r={2.6} fill={s.color} />
                ))}
              </g>
            )
          })}
        </svg>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
              </svg>
              {s.label}
            </span>
          ))}
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          At {sel.bpw} BPW on {t.label} ({t.note}): one path gets rank {sel.rs}, two paths get {sel.rr} each. Relative error is{" "}
          {sel.svd.toFixed(3)} for the unbinarized SVD, {sel.single.toFixed(3)} for one Dual-SVID path ({sel.flat.toFixed(3)} without the
          latent scale) and {sel.res.toFixed(3)} with the residual path. Lower is better; 1.0 means the reconstruction explains nothing.
        </p>
      </div>
    </figure>
  )
}
