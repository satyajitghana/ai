"use client"

import { useState } from "react"

// The fixed-budget payoff, honestly, drawn as a diagram. MSA attends to a fixed 2,048
// tokens per query (top-16 blocks × 128) no matter how long the context is — so the
// *fraction* of the context each query looks at collapses as context grows: 6% at 32k,
// 0.2% at 1M (top strip: the exact blue sliver of the full bar). But the measured
// wall-clock speedup (14.2× prefill / 7.6× decode at 1M on H800) is far less than
// 1/fraction, because the Index Branch still scans every block and sparse memory access
// is irregular (bottom chart: measured speedup vs context, the honest number). Slide the
// context length and watch both truths.

const SEL = "oklch(0.62 0.15 250)"
const AMBER = "oklch(0.72 0.16 60)"
const BUDGET = 2048 // 16 blocks × 128 tokens

const LENS = [
  { label: "32k", n: 32768, prefill: 1.6, decode: 1.4 },
  { label: "64k", n: 65536, prefill: 2.5, decode: 2.0 },
  { label: "128k", n: 131072, prefill: 4.1, decode: 3.0 },
  { label: "256k", n: 262144, prefill: 6.6, decode: 4.3 },
  { label: "512k", n: 524288, prefill: 9.9, decode: 5.8 },
  { label: "1M", n: 1048576, prefill: 14.2, decode: 7.6 },
] as const

// ── scene geometry ──
const W = 720
const H = 300
// slice strip
const SX = 24, SW = W - 48, SBY = 58, SBH = 40
// speedup chart
const CL = 62, CR = W - 24, CT = 150, CB = 262
const YMAX = 15

export function SparsityAtScale() {
  const [i, setI] = useState(LENS.length - 1)
  const cur = LENS[i]
  const frac = (BUDGET / cur.n) * 100
  const naive = cur.n / BUDGET
  const fracStr = frac < 1 ? frac.toFixed(2) : frac.toFixed(1)

  const sliverW = Math.max((frac / 100) * SW, 3)
  const cx = (k: number) => CL + (k / (LENS.length - 1)) * (CR - CL)
  const cy = (v: number) => CB - (v / YMAX) * (CB - CT)
  const line = (key: "prefill" | "decode") =>
    LENS.map((l, k) => `${k === 0 ? "M" : "L"} ${cx(k).toFixed(1)} ${cy(l[key]).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>fixed budget · a smaller slice of a bigger context</span>
        <span className="text-muted-foreground/60">measured on H800 (paper, Fig. 4)</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`At ${cur.label} context, MSA attends 2,048 tokens — ${fracStr}% of the context — and the measured speedup is ${cur.prefill}× prefill, ${cur.decode}× decode.`}>
          <defs>
            <filter id="ss-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ── top: the exact shrinking slice ── */}
          <text x={SX} y={40} className="fill-muted-foreground font-mono" fontSize={11}>of the full context, MSA attends the exact blue sliver</text>
          <text x={W - 24} y={40} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={10}>{cur.label} · {cur.n.toLocaleString()} tok</text>

          {/* full context bar */}
          <rect x={SX} y={SBY} width={SW} height={SBH} rx={7} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          {/* attended sliver */}
          <rect x={SX} y={SBY} width={sliverW} height={SBH} rx={sliverW > 14 ? 7 : 2} fill={SEL} filter="url(#ss-soft)" className="transition-all duration-300" />
          {/* leader from sliver to label */}
          <line x1={SX + sliverW} y1={SBY} x2={SX + Math.max(sliverW, 8)} y2={SBY - 8} stroke={SEL} strokeWidth={1} opacity={0.7} />
          <text x={SX + Math.max(sliverW, 8) + 4} y={SBY - 5} className="font-mono" fontSize={10} fontWeight={600} style={{ fill: SEL }}>
            2,048 tok · {fracStr}% (exact)
          </text>
          <text x={SX} y={SBY + SBH + 16} className="fill-muted-foreground/70 font-mono" fontSize={9}>fixed budget: 16 blocks × 128 = 2,048 tokens, whatever the length · 1 / {Math.round(naive).toLocaleString()} of context</text>

          {/* ── bottom: measured speedup chart ── */}
          <text x={SX} y={CT - 18} className="fill-muted-foreground font-mono" fontSize={11}>measured speedup vs context length (H800)</text>
          <text x={CR} y={CT - 18} textAnchor="end" className="font-mono" fontSize={11}>
            <tspan style={{ fill: SEL }} fontWeight={700}>{cur.prefill}× prefill</tspan>
            <tspan className="fill-muted-foreground"> · </tspan>
            <tspan style={{ fill: AMBER }} fontWeight={700}>{cur.decode}× decode</tspan>
          </text>
          <text x={SX} y={CT - 4} className="fill-muted-foreground/70 font-mono" fontSize={9}>1/fraction = {Math.round(naive).toLocaleString()}× would be the ceiling — never reached</text>

          {/* y gridlines */}
          {[0, 5, 10, 15].map((v) => (
            <g key={v}>
              <line x1={CL} y1={cy(v)} x2={CR} y2={cy(v)} stroke="var(--border)" strokeWidth={1} opacity={0.5} strokeDasharray={v === 0 ? undefined : "2 3"} />
              <text x={CL - 8} y={cy(v) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={9}>{v}×</text>
            </g>
          ))}

          {/* current-context vertical marker */}
          <line x1={cx(i)} y1={CT - 6} x2={cx(i)} y2={CB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />

          {/* lines */}
          <path d={line("prefill")} fill="none" stroke={SEL} strokeWidth={2} className="transition-all" />
          <path d={line("decode")} fill="none" stroke={AMBER} strokeWidth={2} className="transition-all" />

          {/* points + x labels */}
          {LENS.map((l, k) => (
            <g key={l.label}>
              <circle cx={cx(k)} cy={cy(l.prefill)} r={k === i ? 4 : 2.5} fill={SEL} stroke="var(--background)" strokeWidth={k === i ? 1.5 : 0} />
              <circle cx={cx(k)} cy={cy(l.decode)} r={k === i ? 4 : 2.5} fill={AMBER} stroke="var(--background)" strokeWidth={k === i ? 1.5 : 0} />
              <text x={cx(k)} y={CB + 15} textAnchor="middle" className="font-mono" fontSize={9}
                fill={k === i ? "var(--foreground)" : "var(--muted-foreground)"} opacity={k === i ? 1 : 0.6}>{l.label}</text>
            </g>
          ))}

          {/* current readout */}
          <text x={cx(i)} y={cy(cur.prefill) - 10} textAnchor={i > 3 ? "end" : "start"} className="font-mono" fontSize={11} fontWeight={700} style={{ fill: SEL }}>{cur.prefill}× prefill</text>
          <text x={cx(i)} y={cy(cur.decode) + 18} textAnchor={i > 3 ? "end" : "start"} className="font-mono" fontSize={11} fontWeight={700} style={{ fill: AMBER }}>{cur.decode}× decode</text>

          {/* honest ceiling annotation */}
          <text x={CR} y={CT - 2} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>1/fraction = {Math.round(naive).toLocaleString()}× (theoretical ceiling, never reached)</text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">context length (drag) · {cur.label}</div>
          <input type="range" min={0} max={LENS.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.15_250)]" />
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The fraction attended falls to <span style={{ color: SEL }}>0.2% at 1M</span> — but MSA is not 500× faster.
          The measured win is <span className="text-foreground">14.2× prefill / 7.6× decode</span> at 1M, because the
          Index Branch still <em>scores every block</em> (a small linear cost) and block-sparse memory access is less
          regular than dense. The gap between the theoretical 28.4× FLOP reduction and the wall-clock number is exactly
          that overhead — and the whole advantage is a <span className="text-foreground">long-context</span> phenomenon:
          at 32k it&apos;s barely 1.6×.
        </p>
      </div>
    </figure>
  )
}
