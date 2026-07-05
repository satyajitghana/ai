"use client"

import { useState } from "react"

// TabFM's core move, drawn as a diagram: in-context learning for tables. You don't
// train the model — you paste labeled example rows into the context and it predicts a
// test row in ONE forward pass. Add or drop context rows and watch the prediction firm
// up (the confidence bar), exactly as a k-NN-in-latent-space intuition would suggest.
// No gradient steps ever run. Illustrative (a synthetic 2-feature, 2-class toy).

const SEL = "oklch(0.60 0.15 255)" // model / accent / class B
const MUT = "var(--muted-foreground)"

// A fixed pool of labeled example rows. label "B" = filled accent, "A" = outline only.
const POOL = [
  { a: 5.2, b: 1.1, label: "B" },
  { a: 4.8, b: 0.9, label: "B" },
  { a: 1.3, b: 6.0, label: "A" },
  { a: 5.6, b: 1.4, label: "B" },
  { a: 5.0, b: 0.7, label: "B" },
  { a: 1.7, b: 5.4, label: "A" },
  { a: 5.9, b: 1.2, label: "B" },
  { a: 4.6, b: 1.6, label: "B" },
] as const

const MAXK = POOL.length
const TEST = { a: 5.3, b: 1.0 } // near the "B" cluster

// ── scene geometry (viewBox units) ──
const W = 760
const H = 344
const MX = 26
const USABLE = W - 2 * MX
const RY = 50 // context row top
const RW = 74
const RH = 44
const TY = 176 // test row top
const TW = 168
const TH = 42
const PY = 258 // prediction node top
const PW = 236
const PH = 66

// evenly spread k context pills across the top
const pillX = (i: number, k: number) => MX + USABLE * ((i + 0.5) / k) - RW / 2

function conf(k: number) {
  if (k === 0) return 0.5
  return 0.5 + 0.46 * (1 - Math.exp(-k / 2.5))
}

export function IclDemo() {
  const [k, setK] = useState(4)
  const rows = POOL.slice(0, k)
  const c = conf(k)
  const px = W / 2
  const py = PY

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>in-context learning · the &ldquo;training set&rdquo; is just context</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${k} labeled example rows fed as context; the model predicts the test row as class B with ${(c * 100).toFixed(0)}% confidence in one forward pass, no training.`}
        >
          <defs>
            <marker id="tfm-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL} strokeWidth={1.5} />
            </marker>
            <marker id="tfm-arrow-q" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUT} strokeWidth={1.5} />
            </marker>
            <filter id="tfm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={28} className="fill-muted-foreground font-mono" fontSize={11}>
            labeled example rows (context) →
          </text>

          {/* connectors: context rows fan into the prediction (drawn behind nodes) */}
          {rows.map((_, i) => {
            const cx = pillX(i, k) + RW / 2
            return (
              <path
                key={i}
                d={curve(cx, RY + RH, px, py)}
                fill="none"
                stroke={SEL}
                strokeWidth={1.5}
                markerEnd="url(#tfm-arrow)"
                opacity={0.55}
                className="transition-all duration-300"
              />
            )
          })}
          {/* test row → prediction (the question being answered) */}
          <path d={curve(px, TY + TH, px, py)} fill="none" stroke={MUT} strokeWidth={1.5} markerEnd="url(#tfm-arrow-q)" opacity={0.7} />

          {/* context row pills */}
          {rows.map((r, i) => {
            const x = pillX(i, k)
            const filled = r.label === "B"
            return (
              <g key={i} className="transition-all duration-300">
                <rect x={x} y={RY} width={RW} height={RH} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#tfm-soft)" />
                <text x={x + 10} y={RY + 18} className="fill-foreground font-mono" fontSize={10}>{r.a.toFixed(1)}</text>
                <text x={x + 10} y={RY + 32} className="fill-muted-foreground font-mono" fontSize={10}>{r.b.toFixed(1)}</text>
                {/* label token */}
                <circle cx={x + RW - 15} cy={RY + RH / 2} r={7} fill={filled ? SEL : "var(--background)"} stroke={SEL} strokeWidth={1.5} />
                <text x={x + RW - 15} y={RY + RH / 2 + 3.5} textAnchor="middle" fontSize={9} fontWeight={600} fill={filled ? "var(--background)" : SEL}>{r.label}</text>
              </g>
            )
          })}
          {k === 0 && (
            <text x={W / 2} y={RY + 26} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>no context — the model can only guess</text>
          )}

          {/* test row */}
          <g>
            <rect x={px - TW / 2} y={TY} width={TW} height={TH} rx={8} fill="var(--muted)" stroke={MUT} strokeWidth={1.5} filter="url(#tfm-soft)" />
            <text x={px - TW / 2 + 12} y={TY + 26} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>test row</text>
            <text x={px - TW / 2 + 82} y={TY + 26} className="fill-muted-foreground font-mono" fontSize={10}>{TEST.a}, {TEST.b}</text>
            <circle cx={px + TW / 2 - 16} cy={TY + TH / 2} r={8} fill="var(--background)" stroke={MUT} strokeWidth={1.5} strokeDasharray="2 2" />
            <text x={px + TW / 2 - 16} y={TY + TH / 2 + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={MUT}>?</text>
          </g>

          {/* prediction node */}
          <g>
            <rect x={px - PW / 2} y={PY} width={PW} height={PH} rx={10} fill="var(--background)" stroke={SEL} strokeWidth={1.5} filter="url(#tfm-soft)" />
            <text x={px - PW / 2 + 14} y={PY + 22} className="fill-muted-foreground font-mono" fontSize={9}>TabFM · one forward pass</text>
            <text x={px - PW / 2 + 14} y={PY + 40} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>
              predict: <tspan fill={SEL}>class B</tspan>
            </text>
            {/* confidence bar */}
            <rect x={px - PW / 2 + 14} y={PY + 48} width={PW - 28} height={7} rx={3.5} fill="var(--muted)" />
            <rect x={px - PW / 2 + 14} y={PY + 48} width={(PW - 28) * c} height={7} rx={3.5} fill={SEL} className="transition-all duration-300" />
            <text x={px + PW / 2 - 14} y={PY + 22} textAnchor="end" className="font-mono" fontSize={11} fontWeight={700} fill={SEL}>{(c * 100).toFixed(0)}%</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>context rows (drag) · {k}</span>
            <span>0 gradient steps · {k} rows in → 1 forward pass out</span>
          </div>
          <input type="range" min={0} max={MAXK} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.60_0.15_255)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Nothing is <span className="text-foreground">trained</span>. The labeled rows are the &ldquo;training set,&rdquo;
          but they enter as <span style={{ color: SEL }}>context</span> — like examples in a prompt — and the model answers the
          test row in a single forward pass. Add rows and the prediction <span className="text-foreground">firms up</span>;
          drop them all and it can only guess. This is TabFM&rsquo;s inheritance from TabPFN and TabICL: prediction as
          <em> in-context inference</em>, not gradient fitting.
        </p>
      </div>
    </figure>
  )
}
