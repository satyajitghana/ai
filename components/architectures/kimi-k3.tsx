"use client"

// Kimi K3 architecture — a clean distill-style view of the two ideas that make
// K3 new: the hybrid block (KDA linear attention + Gated MLA full attention +
// Stable LatentMoE sparse FFN, interleaved) stacked into the residual stream,
// and Block Attention Residuals (AttnRes) — every residual add mixes in a gated
// read of *every* earlier block via a learnable gate α, not just the one below.
// Paper palette (light card, dark ink, pastel fills) so it reads in both site
// themes. SSR-safe: all coordinates are literals, no Date / Math.random.

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const GREEN = "#cfe8cf"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const RESID = "#8a2b2b"

function Box({ x, y, w, h, fill, label, fs = 12, bold = false }: { x: number; y: number; w: number; h: number; fill: string; label: string; fs?: number; bold?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={INK} strokeWidth={1.4} />
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={fs} fontWeight={bold ? 600 : 400}>{label}</text>
    </g>
  )
}

function Node({ cx, cy, sym, r = 11, fill = "#ffffff", color = INK }: { cx: number; cy: number; sym: string; r?: number; fill?: string; color?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={color} strokeWidth={1.4} />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={11}>{sym}</text>
    </g>
  )
}

function Line({ d, arrow = false, color = INK, w = 1.4, dash = false }: { d: string; arrow?: boolean; color?: string; w?: number; dash?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeDasharray={dash ? "5 4" : undefined}
      markerEnd={arrow ? (color === RESID ? "url(#kk-ar)" : "url(#kk-a)") : undefined}
    />
  )
}

export function KimiK3Architecture() {
  const cx = 250 // main residual spine
  const bw = 172
  const bx = cx - bw / 2 // 164
  const bh = 34
  const railX = 476 // AttnRes residual bus
  const aX = 392 // α gate column

  // active modules, bottom → top; the "+" residual add sits in the gap above each
  const mods = [
    { y: 452, label: "KDA", fill: BLUE, note: "linear attention" },
    { y: 384, label: "Stable LatentMoE", fill: GREEN, note: "sparse FFN" },
    { y: 316, label: "Gated MLA", fill: SALMON, note: "full attention" },
    { y: 248, label: "Stable LatentMoE", fill: GREEN, note: "sparse FFN" },
  ]
  const plusY = (y: number) => y - 17
  const midY = (y: number) => y + bh / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        Kimi K3 · hybrid KDA / MLA / LatentMoE block + Block Attention Residuals (AttnRes)
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 660 612" className="w-full" role="img" aria-label="Kimi K3 architecture: a hybrid block stack (KDA linear attention, Gated MLA full attention, Stable LatentMoE sparse FFN, interleaved) in the residual stream, and Block Attention Residuals where each residual add reads a gated mix of every earlier block through a learnable gate alpha, carried on a residual bus.">
          <defs>
            <marker id="kk-a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
            <marker id="kk-ar" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={RESID} />
            </marker>
          </defs>
          <rect x="0" y="0" width="660" height="612" rx="10" fill={PAPER} />

          {/* ── output (top) ── */}
          <text x={cx} y={196} textAnchor="middle" fill={INK} fontSize="12" fontWeight={600}>Output</text>
          <Line d={`M ${cx} 214 L ${cx} 205`} arrow />

          {/* ── residual bus (AttnRes) ── */}
          <Line d={`M ${railX} 214 L ${railX} 555`} color={RESID} w={1.4} />
          <text x={railX + 12} y={224} fill={RESID} fontSize="11" fontWeight={600}>residual</text>
          <text x={railX + 12} y={238} fill={RESID} fontSize="11" fontWeight={600}>bus</text>

          {/* ── active modules + residual adds + α gates ── */}
          {mods.map((m) => {
            const py = plusY(m.y)
            return (
              <g key={m.y}>
                {/* module box */}
                <Box x={bx} y={m.y} w={bw} h={bh} fill={m.fill} label={m.label} fs={m.label.length > 6 ? 11 : 12} bold />
                {/* left note */}
                <text x={bx - 12} y={midY(m.y) + 0.5} textAnchor="end" dominantBaseline="central" fill={INK} fontSize="9.5" opacity="0.8">{m.note}</text>
                {/* residual add above the module */}
                <Node cx={cx} cy={py} sym="+" r={10} />
                {/* module output → + */}
                <Line d={`M ${cx} ${m.y} L ${cx} ${py + 10}`} arrow />
                {/* + → next block up the spine */}
                <Line d={`M ${cx} ${py - 10} L ${cx} ${m.y - 34}`} arrow />
                {/* α gate reads the bus, feeds the + */}
                <Node cx={aX} cy={py} sym="α" r={11} fill={YELLOW} />
                <Line d={`M ${railX} ${py} L ${aX + 12} ${py}`} color={RESID} arrow />
                <Line d={`M ${aX - 12} ${py} L ${cx + 10} ${py}`} arrow />
                {/* module output taps into the bus (for every later block to read) */}
                <Line d={`M ${bx + bw} ${midY(m.y)} L ${railX} ${midY(m.y)}`} color={RESID} w={1.1} />
              </g>
            )
          })}

          {/* ── earlier blocks + embedding (bottom of the stack) ── */}
          <text x={cx + 16} y={510} textAnchor="start" fill={INK} fontSize="13">⋮</text>
          <text x={cx + 28} y={512} textAnchor="start" fill={INK} fontSize="10" opacity="0.8">earlier blocks</text>
          <Box x={bx} y={540} w={bw} h={bh} fill={YELLOW} label="Embedding" fs={12} bold />
          {/* spine: embedding → KDA (through the earlier blocks) */}
          <Line d={`M ${cx} 540 L ${cx} 486`} arrow />
          {/* embedding taps into the bus too */}
          <Line d={`M ${bx + bw} 557 L ${railX} 557`} color={RESID} w={1.1} />

          {/* AttnRes note */}
          <text x={cx} y={598} textAnchor="middle" fill={RESID} fontSize="10.5">
            AttnRes: each α reads a gated mix of every earlier block on the bus
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Read bottom&#8209;to&#8209;top. Kimi K3 stacks a <strong>hybrid block</strong>{" "}&mdash;{" "}
          <span style={{ color: "#3a6ea5" }}>KDA</span>{" "}(linear&#8209;time attention),{" "}
          <span style={{ color: "#b05a5a" }}>Gated MLA</span>{" "}(full attention for exact recall) and{" "}
          <span style={{ color: "#3f7d3f" }}>Stable LatentMoE</span>{" "}
          (shared + routed experts) &mdash; into the residual stream. The twist is{" "}
          <strong>Block Attention Residuals</strong>: every residual add pulls a{" "}
          <span style={{ color: RESID }}>gated read (α)</span>{" "}off a <span style={{ color: RESID }}>bus</span>{" "}carrying{" "}
          <em>every</em>{" "}
          earlier block&rsquo;s output, not just the layer below &mdash; a learnable skip across the whole depth.
        </p>
      </div>
    </figure>
  )
}
