"use client"

import { useState } from "react"

// The whole Inkling network as one data-flow diagram, with the MoE feed-forward
// block opened up. Three modalities tokenize into one 6144-dim stream, an
// embedding RMSNorm normalizes it at entry, then 66 decoder blocks each run
// hybrid attention + a mixture-of-experts FFN, and the top feeds an LM head plus
// 8 multi-token-prediction layers. Scrub the token to see which 6 of 256 routed
// experts fire (the 2 shared experts are always on). All labels are from the
// released config.json.

const ACC = "oklch(0.62 0.15 255)" // routed / active
const SHARED = "oklch(0.7 0.15 60)" // shared experts
const MUTED = "var(--muted-foreground)"

const NE = 256
const K = 6
const COLS = 32
const ROWS = NE / COLS // 8

// deterministic "router" score for expert e at token t (no RNG)
function topK(t: number): Set<number> {
  const scored = Array.from({ length: NE }, (_, e) => ({
    e,
    s: Math.sin(e * 0.7 + t * 1.3) * 0.6 + Math.cos(e * 0.31 - t * 0.9) * 0.4,
  }))
  scored.sort((a, b) => b.s - a.s)
  return new Set(scored.slice(0, K).map((x) => x.e))
}

const W = 760

export function NetworkDiagram() {
  const [tok, setTok] = useState(7)
  const chosen = topK(tok)

  // layout anchors (viewBox units)
  const cx = W / 2
  const curveV = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  // expert grid geometry
  const gx = 150
  const gy = 384
  const cw = 15
  const ch = 11
  const gap = 4
  const gridW = COLS * cw + (COLS - 1) * gap
  const ex = (i: number) => gx + (i % COLS) * (cw + gap)
  const ey = (i: number) => gy + Math.floor(i / COLS) * (ch + gap)
  const routerY = 350
  const combineY = gy + ROWS * (ch + gap) + 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Inkling · one 6144-dim stream, 66 blocks, 256-expert MoE</span>
        <span className="text-muted-foreground/50">from config.json</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 560`} className="w-full" role="img" aria-label="Inkling architecture: three modalities into a shared stream, an embedding norm, 66 decoder blocks with hybrid attention and a 256-expert mixture-of-experts, then an LM head and 8 multi-token-prediction layers.">
          <defs>
            <marker id="nd-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUTED} strokeWidth={1.5} />
            </marker>
            <marker id="nd-arr-a" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACC} strokeWidth={1.4} />
            </marker>
            <filter id="nd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- inputs: three modalities ---- */}
          {[
            { x: 40, t: "Text tokens", s: "vocab 201k" },
            { x: 300, t: "Image patches", s: "40×40 → hMLP ×4" },
            { x: 540, t: "Audio", s: "dMel · 80 mel" },
          ].map((m, i) => (
            <g key={i}>
              <rect x={m.x} y={16} width={180} height={38} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#nd-soft)" />
              <text x={m.x + 90} y={34} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{m.t}</text>
              <text x={m.x + 90} y={47} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>{m.s}</text>
              <path d={curveV(m.x + 90, 54, cx, 78)} fill="none" stroke={MUTED} strokeWidth={1.4} markerEnd="url(#nd-arr)" opacity={0.7} />
            </g>
          ))}

          {/* shared hidden */}
          <rect x={cx - 120} y={80} width={240} height={30} rx={8} fill="var(--muted)" opacity={0.35} stroke="var(--border)" strokeWidth={1.5} />
          <text x={cx} y={99} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>shared hidden · 6144-dim</text>
          <path d={curveV(cx, 110, cx, 126)} fill="none" stroke={MUTED} strokeWidth={1.5} markerEnd="url(#nd-arr)" />

          {/* embedding RMSNorm (the surprise) */}
          <rect x={cx - 110} y={126} width={220} height={30} rx={8} fill="var(--background)" stroke={SHARED} strokeWidth={1.75} filter="url(#nd-soft)" />
          <text x={cx} y={145} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>Embedding RMSNorm</text>
          <path d={curveV(cx, 156, cx, 172)} fill="none" stroke={MUTED} strokeWidth={1.5} markerEnd="url(#nd-arr)" />

          {/* ---- decoder block ×66 container ---- */}
          <rect x={24} y={172} width={W - 48} height={296} rx={12} fill="var(--muted)" opacity={0.12} stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 4" />
          <text x={40} y={190} className="fill-muted-foreground font-mono" fontSize={10}>decoder block · ×66 (55 sliding-window · 11 global)</text>

          {/* attention sub-block */}
          <rect x={150} y={202} width={460} height={64} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#nd-soft)" />
          <text x={cx} y={220} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>RMSNorm → hybrid attention → +residual</text>
          <text x={cx} y={235} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>64 Q / 8 KV (16 KV local) · relative bias · sliding-window 512</text>
          <text x={cx} y={249} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>short conv k=4 on K/V + residual · log-scale past 128k</text>
          <path d={curveV(cx, 266, cx, 286)} fill="none" stroke={MUTED} strokeWidth={1.5} markerEnd="url(#nd-arr)" />

          {/* MoE FFN — the centerpiece */}
          <text x={cx} y={300} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={700}>RMSNorm → Mixture-of-Experts FFN → +residual</text>

          {/* router */}
          <rect x={cx - 150} y={332} width={300} height={30} rx={7} fill="var(--background)" stroke={ACC} strokeWidth={1.5} filter="url(#nd-soft)" />
          <text x={cx} y={351} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>router · sigmoid gate · top-6 · route×8</text>

          {/* connectors router -> chosen experts */}
          {[...chosen].map((e) => (
            <path key={e} d={curveV(cx, 362, ex(e) + cw / 2, ey(e))} fill="none" stroke={ACC} strokeWidth={1} markerEnd="url(#nd-arr-a)" opacity={0.55} />
          ))}

          {/* experts grid: 256 cells, 6 lit */}
          {Array.from({ length: NE }, (_, i) => {
            const on = chosen.has(i)
            return (
              <rect
                key={i}
                x={ex(i)}
                y={ey(i)}
                width={cw}
                height={ch}
                rx={2}
                fill={on ? ACC : "var(--muted)"}
                opacity={on ? 0.95 : 0.32}
                stroke={on ? ACC : "none"}
                strokeWidth={on ? 1 : 0}
                filter={on ? "url(#nd-soft)" : undefined}
                className="transition-all duration-200"
              />
            )
          })}
          <text x={gx} y={gy - 6} className="fill-muted-foreground font-mono" fontSize={9}>
            256 routed experts · <tspan fill={ACC} fontWeight={600}>6 active</tspan>
          </text>

          {/* shared experts */}
          <rect x={gx} y={combineY} width={120} height={22} rx={5} fill={SHARED} opacity={0.9} filter="url(#nd-soft)" />
          <text x={gx + 60} y={combineY + 15} textAnchor="middle" className="font-mono" fontSize={9.5} fontWeight={600} fill="var(--background)">2 shared · sink</text>
          <text x={gx + 132} y={combineY + 15} className="fill-muted-foreground font-mono" fontSize={8.5}>always on</text>

          {/* combine + exit */}
          <path d={curveV(cx, combineY + 34, cx, combineY + 50)} fill="none" stroke={MUTED} strokeWidth={1.5} markerEnd="url(#nd-arr)" />
          <text x={cx} y={combineY + 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>norm-after-topk weighted sum + 2 shared →</text>

          {/* final norm */}
          <rect x={cx - 100} y={478} width={200} height={28} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#nd-soft)" />
          <text x={cx} y={496} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>Final RMSNorm</text>

          {/* outputs: LM head + MTP */}
          <path d={curveV(cx, 506, cx - 150, 528)} fill="none" stroke={MUTED} strokeWidth={1.4} markerEnd="url(#nd-arr)" opacity={0.7} />
          <path d={curveV(cx, 506, cx + 150, 528)} fill="none" stroke={MUTED} strokeWidth={1.4} markerEnd="url(#nd-arr)" opacity={0.7} />
          <rect x={cx - 250} y={528} width={200} height={26} rx={7} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />
          <text x={cx - 150} y={545} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>LM head · vocab 201k</text>
          <rect x={cx + 50} y={528} width={200} height={26} rx={7} fill="var(--background)" stroke={SHARED} strokeWidth={1.5} />
          <text x={cx + 150} y={545} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>8× MTP layers</text>
        </svg>

        {/* token scrubber */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>token (drag) — which 6 experts route</span>
            <span className="tabular-nums text-foreground">token {tok} · {[...chosen].sort((a, b) => a - b).join(", ")}</span>
          </div>
          <input type="range" min={0} max={40} value={tok} onChange={(e) => setTok(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.15_255)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every token walks the same 6144-dim stream: an <span style={{ color: SHARED }}>embedding RMSNorm</span> at
          entry, then 66 blocks of hybrid attention and a <span style={{ color: ACC }}>256-expert</span> FFN where a
          sigmoid router lights just <span className="text-foreground">6</span> experts (the{" "}
          <span style={{ color: SHARED }}>2 shared</span> ones always fire), and finally an LM head beside{" "}
          <span className="text-foreground">8 multi-token-prediction layers</span> for speculative decoding. Drag the
          token and watch the routed set change — that sparsity is why only 41B of 975B parameters do work per token.
        </p>
      </div>
    </figure>
  )
}
