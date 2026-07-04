"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The TurboQuant pipeline, drawn as a composed flow: one K/V vector enters on the left
// and leaves as one unbiased inner-product estimate on the right. The clever part is the
// last two stages — an MSE-optimal quantizer is biased when you use it to estimate inner
// products (which is all attention does), so TurboQuant quantizes the residual with a
// 1-bit Quantized-JL transform to cancel the bias. Step through, or let it auto-advance.

const ACCENT = "oklch(0.72 0.15 195)"

const STAGES = [
  {
    key: "rotate",
    short: "rotate",
    sym: "x ↦ H·x",
    name: "1 · rotate",
    what: "Multiply the key/value vector by a random orthogonal matrix (a Hadamard/QR rotation).",
    why: "It spreads energy evenly across coordinates, so each coordinate follows the same known Beta distribution — no outliers, no per-vector surprises.",
  },
  {
    key: "quantize",
    short: "quantize",
    sym: "Q₍b₋₁₎(·)",
    name: "2 · scalar-quantize",
    what: "Apply a per-coordinate optimal (Lloyd-Max) scalar quantizer at b−1 bits.",
    why: "Because the post-rotation distribution is known analytically, the optimal quantizer is precomputed once — data-free, no calibration set. This is the “online” property.",
  },
  {
    key: "residual",
    short: "residual",
    sym: "sign · 1-bit",
    name: "3 · 1-bit QJL on the residual",
    what: "Take what the MSE quantizer missed (the residual) and store just its sign under a random projection — 1 bit per dimension.",
    why: "An MSE-optimal quantizer is *biased* for inner products. The 1-bit Quantized-JL residual is exactly the correction that cancels that bias.",
  },
  {
    key: "estimate",
    short: "estimate",
    sym: "⟨q,k̂⟩ + δ",
    name: "4 · unbiased inner product",
    what: "Reconstruct scores as the MSE estimate plus the QJL correction term.",
    why: "Attention is inner products through a softmax — a biased score systematically warps the attention weights. Unbiasedness keeps the attention distribution faithful, which is why quality holds at 3.5 bits/channel.",
  },
] as const

// scene geometry (viewBox units)
const W = 820
const H = 172
const MX = 64
const NW = 152
const GAP = 28
const NY = 54
const NH = 64
const NCY = NY + NH / 2
const nodeX = (k: number) => MX + k * (NW + GAP)

export function Pipeline() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % STAGES.length), 2800)
    return () => clearInterval(id)
  }, [playing])

  const link = (k: number) => {
    const x1 = nodeX(k) + NW
    const x2 = nodeX(k + 1)
    const my = NCY - 13
    return `M ${x1} ${NCY} C ${(x1 + x2) / 2} ${my}, ${(x1 + x2) / 2} ${my}, ${x2} ${NCY}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>TurboQuant · rotate → quantize → correct</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Four-stage pipeline; stage ${i + 1} of ${STAGES.length} (${STAGES[i].short}) active. A K/V vector flows in and an unbiased inner-product estimate flows out.`}>
          <defs>
            <marker id="tqp-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="tqp-arrow-muted" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6.5" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--border)" strokeWidth={1.5} />
            </marker>
            <filter id="tqp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* top label */}
          <text x={MX} y={28} className="fill-muted-foreground font-mono" fontSize={11}>one K/V vector → four transforms → one unbiased score</text>

          {/* input stub */}
          <path d={`M 18 ${NCY + 9} C 34 ${NCY + 9}, 44 ${NCY}, ${MX - 5} ${NCY}`} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#tqp-arrow)" opacity={0.9} />
          <text x={18} y={NCY - 6} className="fill-muted-foreground font-mono" fontSize={9}>k / v</text>

          {/* connectors between stages (behind nodes) */}
          {STAGES.slice(0, -1).map((_, k) => {
            const on = k < i
            return (
              <path key={k} d={link(k)} fill="none" stroke={on ? ACCENT : "var(--border)"} strokeWidth={1.5} markerEnd={`url(#${on ? "tqp-arrow" : "tqp-arrow-muted"})`} opacity={on ? 0.9 : 0.7} className="transition-opacity duration-300" />
            )
          })}

          {/* output stub */}
          <path d={`M ${nodeX(3) + NW + 5} ${NCY} C ${nodeX(3) + NW + 22} ${NCY}, ${W - 34} ${NCY - 9}, ${W - 18} ${NCY - 9}`} fill="none" stroke={i === STAGES.length - 1 ? ACCENT : "var(--border)"} strokeWidth={1.5} markerEnd={`url(#${i === STAGES.length - 1 ? "tqp-arrow" : "tqp-arrow-muted"})`} opacity={0.9} />
          <text x={W - 18} y={NCY + 16} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>score</text>

          {/* stage nodes */}
          {STAGES.map((st, k) => {
            const active = k === i
            const x = nodeX(k)
            return (
              <g key={st.key} onClick={() => setI(k)} className="cursor-pointer">
                <rect x={x} y={NY} width={NW} height={NH} rx={11} fill="var(--background)" stroke={active ? ACCENT : "var(--border)"} strokeWidth={active ? 1.8 : 1.2} filter={active ? "url(#tqp-soft)" : undefined} className="transition-all duration-300" />
                <rect x={x} y={NY} width={NW} height={NH} rx={11} fill={ACCENT} opacity={active ? 0.1 : 0} className="transition-opacity duration-300" />
                <circle cx={x + 20} cy={NY + 19} r={11} fill={active ? ACCENT : "var(--muted)"} className="transition-colors duration-300" />
                <text x={x + 20} y={NY + 23} textAnchor="middle" fontSize={11} fontWeight={600} fill={active ? "var(--background)" : "var(--muted-foreground)"} className="font-mono">{k + 1}</text>
                <text x={x + NW / 2 + 12} y={NY + 24} textAnchor="middle" fontSize={13} fontWeight={600} className="fill-foreground font-mono">{st.short}</text>
                <text x={x + NW / 2} y={NY + 47} textAnchor="middle" fontSize={12} className={cn("font-mono transition-colors duration-300", active ? "fill-foreground" : "fill-muted-foreground/70")}>{st.sym}</text>
              </g>
            )
          })}
        </svg>

        {/* keyboard-accessible stage control */}
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">stage</span>
          {STAGES.map((st, k) => (
            <button key={st.key} type="button" onClick={() => { setPlaying(false); setI(k) }} aria-pressed={k === i}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", k === i ? "border-transparent text-background" : "text-muted-foreground hover:text-foreground")}
              style={k === i ? { background: ACCENT } : undefined}>
              {k + 1}
            </button>
          ))}
        </div>

        {/* detail panel — grid-stacked so height is constant across stages */}
        <div className="mt-4 grid">
          {STAGES.map((st, k) => (
            <div
              key={st.key}
              aria-hidden={k !== i}
              className={cn(
                "col-start-1 row-start-1 rounded-md border-l-2 bg-muted/30 px-3 py-3 transition-opacity duration-300",
                k === i ? "opacity-100" : "pointer-events-none opacity-0"
              )}
              style={{ borderLeftColor: ACCENT }}
            >
              <div className="font-mono text-xs text-foreground">{st.name}</div>
              <p className="mt-1.5 text-sm leading-6">
                <span className="font-medium text-foreground">What:</span> <span className="text-muted-foreground">{st.what}</span>
              </p>
              <p className="mt-1 text-sm leading-6">
                <span className="font-medium text-foreground">Why:</span> <span className="text-muted-foreground">{st.why}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </figure>
  )
}
