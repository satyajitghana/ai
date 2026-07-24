"use client"

// Kimi K3 architecture — a distill-style recreation of the paper figure:
// the Stable LatentMoE and Kimi Delta Attention (KDA) modules (left), and the
// Block Attention Residuals backbone with the AttnRes operation α (right).
// The figure keeps its own light "paper" background so the pastel blocks and
// dark labels read the same in the site's light and dark themes.
// SSR-safe: all coordinates are literals, no Date / random.

const PAPER = "#f7f4ea"
const INK = "#2a2a2a"
const GREEN = "#cfe8cf"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const PURPLE = "#e0d4f0"
const YELLOW = "#f5eec0"
const NEUTRAL = "#efece3"
const RESID = "#8a2b2b"

function Box({
  x, y, w, h, fill = NEUTRAL, label, fs = 12, bold = false, dash = false,
}: {
  x: number; y: number; w: number; h: number; fill?: string; label: string; fs?: number; bold?: boolean; dash?: boolean
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={INK} strokeWidth={1.4} strokeDasharray={dash ? "4 3" : undefined} />
      <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={fs} fontWeight={bold ? 600 : 400}>
        {label}
      </text>
    </g>
  )
}

function Node({ cx, cy, r = 9, sym }: { cx: number; cy: number; r?: number; sym: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="white" stroke={INK} strokeWidth={1.4} />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={12}>{sym}</text>
    </g>
  )
}

// straight connector with optional arrowhead
function Line({ d, arrow = false, color = INK, w = 1.4, dash = false }: { d: string; arrow?: boolean; color?: string; w?: number; dash?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash ? "4 3" : undefined} markerEnd={arrow ? "url(#kk-arrow)" : undefined} />
}

export function KimiK3Architecture() {
  // backbone module rows (bottom → top), right column
  const bx = 812 // block left
  const bw = 150
  const rows = [
    { y: 470, label: "KDA", fill: BLUE },
    { y: 400, label: "Stable LatentMoE", fill: GREEN },
    { y: 300, label: "Gated MLA", fill: SALMON },
    { y: 230, label: "Stable LatentMoE", fill: GREEN },
  ]
  const busX = 1120 // residual bus on the far right

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        Kimi K3 · Stable LatentMoE + KDA modules, and the Block Attention Residuals backbone
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 1180 780" className="w-full" role="img" aria-label="Kimi K3 architecture: the Stable LatentMoE and Kimi Delta Attention modules on the left, and the Block Attention Residuals backbone with per-module AttnRes alpha residual gating on the right.">
          <defs>
            <marker id="kk-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
            <marker id="kk-arrow-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={RESID} />
            </marker>
          </defs>
          <rect x="0" y="0" width="1180" height="780" rx="10" fill={PAPER} />

          {/* ───────── LEFT-TOP: Stable LatentMoE ───────── */}
          <rect x="28" y="40" width="470" height="300" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="5 4" />
          {/* legend */}
          <rect x="48" y="56" width="14" height="14" rx="3" fill={GREEN} stroke={INK} strokeWidth="1.2" />
          <text x="68" y="67" fill={INK} fontSize="11">Shared Expert</text>
          <rect x="48" y="76" width="14" height="14" rx="3" fill={BLUE} stroke={INK} strokeWidth="1.2" />
          <text x="68" y="87" fill={INK} fontSize="11">Routed Expert</text>

          {/* sum at top */}
          <Node cx={250} cy={104} sym="+" />
          <Line d="M250 95 L250 60" arrow />
          {/* experts row */}
          {/* shared */}
          <Box x={96} y={168} w={34} h={30} fill={GREEN} label="1" bold />
          <Box x={140} y={168} w={34} h={30} fill={GREEN} label="2" bold />
          {/* routed */}
          <Box x={252} y={168} w={30} h={30} fill={NEUTRAL} label="1" />
          <Box x={288} y={168} w={30} h={30} fill={BLUE} label="2" bold />
          <Box x={324} y={168} w={30} h={30} fill={NEUTRAL} label="3" />
          <text x={372} y={187} fill={INK} fontSize="13">· · ·</text>
          <Box x={402} y={168} w={30} h={30} fill={BLUE} label="N" bold />
          {/* connect experts up to sum */}
          <Line d="M113 168 L240 112" />
          <Line d="M157 168 L246 113" />
          <Line d="M300 168 L258 113" />
          <Line d="M417 168 L262 112" />
          {/* routed norm+linear column under the routed experts */}
          <Box x={300} y={214} w={92} h={26} fill={NEUTRAL} label="Norm" fs={11} />
          <Box x={300} y={250} w={92} h={26} fill={SALMON} label="Linear" fs={11} />
          <Node cx={346} cy={200} sym="+" r={8} />
          <Line d="M346 208 L346 168" />
          <Line d="M346 214 L346 208" />
          <Line d="M346 250 L346 240" />
          {/* router */}
          <Box x={150} y={250} w={96} h={30} fill="white" label="Router" fs={12} />
          <rect x={222} y={258} width="16" height="14" fill="none" stroke={INK} strokeWidth="1" />
          <path d="M225 272 L225 266 M230 272 L230 262 M235 272 L235 268" stroke={INK} strokeWidth="1.4" />
          {/* input up into router + routed linear */}
          <Line d="M198 320 L198 282" arrow />
          <Line d="M198 288 L150 266" />
          <Line d="M244 266 L300 262" />
          {/* shared experts input */}
          <Line d="M113 320 L113 198" />
          <Line d="M157 320 L157 198" />
          <text x={252} y={330} fill={INK} fontSize="12" fontWeight={600}>Stable LatentMoE</text>

          {/* ───────── LEFT-BOTTOM: KDA ───────── */}
          <rect x="28" y="392" width="470" height="360" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="5 4" />
          {/* top output linear */}
          <Box x={196} y={410} w={110} h={30} fill={SALMON} label="Linear" />
          <Line d="M251 410 L251 384" arrow />
          {/* gate multiply */}
          <Node cx={251} cy={462} sym="×" />
          <Line d="M251 453 L251 440" arrow />
          {/* norm */}
          <Box x={206} y={484} w={90} h={28} fill={NEUTRAL} label="Norm" fs={11} />
          <Line d="M251 484 L251 471" arrow />
          {/* kimi delta attention */}
          <Box x={120} y={524} w={262} h={34} fill={BLUE} label="Kimi Delta Attention" fs={13} bold />
          <Line d="M251 524 L251 512" arrow />
          {/* bottom projection row */}
          <Box x={116} y={686} w={56} h={28} fill={SALMON} label="Linear" fs={11} />
          <Box x={198} y={686} w={56} h={28} fill={SALMON} label="Linear" fs={11} />
          {/* trapezoids (up/down proj) */}
          <path d="M276 686 L316 686 L306 714 L286 714 z" fill={GREEN} stroke={INK} strokeWidth="1.3" />
          <path d="M330 714 L370 714 L360 686 L340 686 z" fill={GREEN} stroke={INK} strokeWidth="1.3" />
          <Box x={390} y={686} w={56} h={28} fill={SALMON} label="Linear" fs={11} />
          {/* conv + norm nodes above the first two linears */}
          <Node cx={144} cy={664} r={8} sym="−" />
          <Box x={122} y={624} w={44} h={24} fill={NEUTRAL} label="Conv" fs={10} />
          <Node cx={144} cy={602} r={9} sym="L2" />
          <Node cx={226} cy={664} r={8} sym="−" />
          <Box x={204} y={624} w={44} h={24} fill={NEUTRAL} label="Conv" fs={10} />
          <Node cx={296} cy={664} r={8} sym="−" />
          <Node cx={350} cy={664} r={8} sym="−" />
          <Node cx={418} cy={664} r={8} sym="−" />
          {/* wiring bottom → KDA */}
          <Line d="M144 686 L144 672" />
          <Line d="M144 656 L144 648" />
          <Line d="M144 624 L144 611" />
          <Line d="M144 593 L144 558" />
          <Line d="M226 686 L226 672" />
          <Line d="M226 656 L226 648" />
          <Line d="M226 624 L226 558" />
          <Line d="M296 686 L296 672" /><Line d="M296 656 L296 558" />
          <Line d="M350 686 L350 672" /><Line d="M350 656 L350 558" />
          <Line d="M418 686 L418 672" /><Line d="M418 656 L418 471" />
          {/* the last linear feeds the gate from the side */}
          <Line d="M418 471 L268 462" />
          {/* input */}
          <Line d="M251 744 L251 714" arrow />
          <text x={252} y={742} fill={INK} fontSize="12" fontWeight={600}>KDA (Kimi Delta Attention)</text>

          {/* dashed pointers linking modules to the backbone */}
          <Line d="M498 150 L812 250" dash color="#9a968c" />
          <Line d="M498 560 L812 470" dash color="#9a968c" />

          {/* ───────── RIGHT: Block Attention Residuals backbone ───────── */}
          {/* output */}
          <text x={888} y={58} textAnchor="middle" fill={INK} fontSize="12">Output</text>
          <Node cx={888} cy={82} sym="α" />
          <Box x={846} y={72} w={22} h={20} fill={GREEN} label="w" fs={10} />
          <Line d="M888 72 L888 66" arrow />

          {/* repeated group box */}
          <rect x="792" y="150" width="300" height="360" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="5 4" />
          <text x={770} y={250} textAnchor="end" fill={INK} fontSize="13">1×</text>
          <text x={770} y={452} textAnchor="end" fill={INK} fontSize="13">3×</text>

          {rows.map((r, i) => {
            const cyPlus = r.y - 22
            return (
              <g key={i}>
                <Box x={bx} y={r.y} w={bw} h={30} fill={r.fill} label={r.label} fs={r.label.length > 6 ? 11 : 12} bold />
                {/* residual add above the module */}
                <Node cx={bx + bw / 2} cy={cyPlus} sym="+" r={8} />
                <Line d={`M${bx + bw / 2} ${r.y} L${bx + bw / 2} ${cyPlus + 8}`} arrow />
                {/* alpha + w gate to the right of each module */}
                <Node cx={bx + bw + 40} cy={r.y + 15} sym="α" r={9} />
                <Box x={bx + bw + 29} y={r.y - 5} w={22} h={18} fill={GREEN} label="w" fs={9} />
                <Line d={`M${bx + bw + 31} ${r.y + 15} L${bx + bw} ${r.y + 15}`} arrow />
                {/* the alpha feeds the add above */}
                <Line d={`M${bx + bw + 40} ${r.y + 6} L${bx + bw + 40} ${cyPlus} L${bx + bw / 2 + 8} ${cyPlus}`} color={RESID} />
              </g>
            )
          })}
          {/* vertical spine connecting adds up to output */}
          <Line d="M887 208 L887 92" />
          <Line d="M887 278 L887 250" />
          <Line d="M887 378 L887 350" />
          <Line d="M887 448 L887 420" />
          {/* module inputs from below the spine */}
          <Line d="M887 500 L887 470" arrow />

          {/* lower blocks */}
          <Box x={bx} y={540} w={bw} h={28} fill={PURPLE} label="Block n−1" fs={11} />
          <Box x={bx} y={578} w={bw} h={28} fill={PURPLE} label="Block n−2" fs={11} />
          <Box x={bx} y={616} w={bw} h={28} fill={PURPLE} label="Block n−3" fs={11} />
          <text x={bx + bw / 2} y={666} textAnchor="middle" fill={INK} fontSize="14">⋮</text>
          <Box x={bx} y={684} w={bw} h={30} fill={YELLOW} label="Embedding" fs={12} bold />
          <Line d="M887 540 L887 510" />
          <Line d="M887 578 L887 568" /><Line d="M887 616 L887 606" /><Line d="M887 684 L887 660" />

          {/* residual bus: every earlier block + embedding fans into every α */}
          {[684, 616, 578, 540].map((sy, i) => (
            <Line key={i} d={`M${bx + bw} ${sy + 14} L${busX} ${sy + 14}`} color={RESID} w={1.1} />
          ))}
          <Line d={`M${busX} 82 L${busX} 698`} color={RESID} w={1.2} />
          {rows.map((r, i) => (
            <Line key={i} d={`M${busX} ${r.y + 15} L${bx + bw + 51} ${r.y + 15}`} color={RESID} w={1.1} arrow />
          ))}
          <Line d={`M${busX} 82 L899 82`} color={RESID} w={1.1} arrow />

          <text x={942} y={734} textAnchor="middle" fill={INK} fontSize="12" fontWeight={600}>Block Attention Residuals (AttnRes α)</text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two module types repeat down the stack — <strong>KDA</strong> (Kimi Delta Attention: a gated delta-rule
          linear-attention block) and <strong>Stable LatentMoE</strong> (shared + routed experts under a stabilizing
          norm), interleaved with a <strong>Gated MLA</strong>{" "}
          full-attention layer. The twist is the residual
          pathway: every module&rsquo;s output is mixed back through an <strong>AttnRes</strong> gate{" "}
          <span style={{ color: RESID }}>α</span> that can read <em>all</em> earlier blocks and the embedding, not just
          the one below it — a learnable, weighted skip across the whole depth.
        </p>
      </div>
    </figure>
  )
}
