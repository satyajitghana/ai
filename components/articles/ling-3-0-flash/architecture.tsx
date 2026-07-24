"use client"

// Ling-3.0-flash architecture — a distill-style recreation of the model's
// architecture figure, in the house "paper figure" idiom. The central
// bottom→top stack (Tokenized Text → Embedding → 7× [5×(KDA+MoE) + 1×(Gated
// MLA+MoE)] → Final RMSNorm → Linear Output → MTP head), left-side annotation
// callouts with dashed leaders, and two right-side detail-expansion boxes for
// Gated MLA and KDA (Kimi Delta Attention).
//
// Fixed paper palette (light card, dark ink, pastel fills) is intentional here:
// this reproduces a printed architecture figure and reads the same in the
// site's light and dark themes. SSR-safe: every coordinate is a literal, no
// Date / Math.random, all values ≤ 2 decimal places.

const PAPER = "#f7f4ea"
const INK = "#2a2a2a"
const GREEN = "#cfe8cf" // MoE
const BLUE = "#cfe0f5" // KDA
const SALMON = "#f5cfcf" // MLA / attention
const PURPLE = "#e0d4f0"
const YELLOW = "#f5eec0" // embedding
const NEUTRAL = "#efece3"
const WHITE = "#ffffff"
const LEAD = "#9a968c" // dashed leader lines
const NOTE = "#fbf9f2" // annotation card fill

function Box({
  x, y, w, h, fill = NEUTRAL, label, fs = 11, bold = false, dash = false, ry = 6,
}: {
  x: number; y: number; w: number; h: number; fill?: string; label?: string
  fs?: number; bold?: boolean; dash?: boolean; ry?: number
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={ry} fill={fill} stroke={INK} strokeWidth={1.3} strokeDasharray={dash ? "4 3" : undefined} />
      {label ? (
        <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={fs} fontWeight={bold ? 600 : 400}>
          {label}
        </text>
      ) : null}
    </g>
  )
}

function Op({ cx, cy, r = 10, sym, fill = WHITE, fs = 12 }: { cx: number; cy: number; r?: number; sym: string; fill?: string; fs?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={INK} strokeWidth={1.3} />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fill={INK} fontSize={fs}>{sym}</text>
    </g>
  )
}

function Line({ d, arrow = false, color = INK, w = 1.3, dash = false }: { d: string; arrow?: boolean; color?: string; w?: number; dash?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash ? "4 3" : undefined} markerEnd={arrow ? "url(#lg-arrow)" : undefined} />
}

// left-side annotation card + dashed leader to a target point on the stack
function Callout({ x, y, w, lines, tx, ty }: { x: number; y: number; w: number; lines: string[]; tx: number; ty: number }) {
  const h = 14 + lines.length * 14
  const cy = y + h / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={NOTE} stroke={LEAD} strokeWidth={1} />
      {lines.map((ln, i) => (
        <text key={i} x={x + 9} y={y + 18 + i * 14} fill={INK} fontSize={10.5}>{ln}</text>
      ))}
      {/* leader: from card right edge to the target, ending in a small dot */}
      <path d={`M ${x + w} ${cy} L ${tx} ${ty}`} fill="none" stroke={LEAD} strokeWidth={1.1} strokeDasharray="4 3" />
      <circle cx={tx} cy={ty} r={2.6} fill={LEAD} />
    </g>
  )
}

// curly brace, spine vertical at x, tip bulging toward +x (toward the stack)
function Brace({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  const my = (y1 + y2) / 2
  const d =
    `M ${x} ${y1} C ${x + 7} ${y1}, ${x + 7} ${y1 + 10}, ${x + 7} ${my - 8}` +
    ` C ${x + 7} ${my - 3}, ${x + 11} ${my}, ${x + 15} ${my}` +
    ` C ${x + 11} ${my}, ${x + 7} ${my + 3}, ${x + 7} ${my + 8}` +
    ` C ${x + 7} ${y2 - 10}, ${x + 7} ${y2}, ${x} ${y2}`
  return (
    <g>
      <path d={d} fill="none" stroke={INK} strokeWidth={1.3} />
      <text x={x - 6} y={my - 8} textAnchor="end" fill={INK} fontSize={12} fontWeight={600}>×7</text>
      <text x={x - 6} y={my + 6} textAnchor="end" fill={INK} fontSize={12} fontWeight={600}>groups</text>
    </g>
  )
}

// small square bracket "]" facing left, with a repeat label
function Bracket({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  return (
    <g>
      <path d={`M ${x - 6} ${y1} L ${x} ${y1} L ${x} ${y2} L ${x - 6} ${y2}`} fill="none" stroke={INK} strokeWidth={1.3} />
      <text x={x + 5} y={(y1 + y2) / 2 + 4} fill={INK} fontSize={12} fontWeight={600}>{label}</text>
    </g>
  )
}

// one pre-norm sublayer on the central spine: split → RMSNorm → module → ⊕,
// with the residual skip arcing to the left around the boxes.
function SubLayer({ a, moduleLabel, moduleFill, connectRight = false }: { a: number; moduleLabel: string; moduleFill: string; connectRight?: boolean }) {
  const cx = 418
  const split = a + 84
  const normC = a + 62
  const modC = a + 30
  return (
    <g>
      {/* main branch spine (behind boxes) */}
      <Line d={`M ${cx} ${split} L ${cx} ${a}`} />
      {/* residual skip arc to the left, rejoining at ⊕ */}
      <Line d={`M ${cx} ${split} C 344 ${split - 12}, 344 ${a + 12}, ${cx - 9} ${a + 3}`} />
      <Box x={cx - 36} y={normC - 11} w={72} h={22} fill={NEUTRAL} label="RMSNorm" fs={10} />
      <Box x={cx - 55} y={modC - 15} w={110} h={30} fill={moduleFill} label={moduleLabel} fs={11} bold />
      <Op cx={cx} cy={a} sym="+" r={9} />
      {/* arrows into the boxes / add */}
      <Line d={`M ${cx} ${modC - 15} L ${cx} ${a + 9}`} arrow />
      {connectRight ? <Line d={`M ${cx + 55} ${modC} L 484 ${modC}`} /> : null}
    </g>
  )
}

// a vertical stack of boxes in a detail column (bottom→top), connected by arrows
function ColStack({ cx, boxes }: { cx: number; boxes: { y: number; w: number; h: number; label: string; fill?: string; fs?: number }[] }) {
  return (
    <g>
      {boxes.map((b, i) => {
        const below = boxes[i + 1] // next entry is lower on screen (higher y)
        return (
          <g key={i}>
            {below ? <Line d={`M ${cx} ${below.y} L ${cx} ${b.y + b.h}`} arrow /> : null}
            <Box x={cx - b.w / 2} y={b.y} w={b.w} h={b.h} fill={b.fill ?? NEUTRAL} label={b.label} fs={b.fs ?? 10} />
          </g>
        )
      })}
    </g>
  )
}

export function LingArchitecture() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        Ling-3.0-flash · architecture — hybrid KDA / Gated-MLA attention with a Ling-MoE FFN
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 1240 1050" className="w-full" role="img" aria-label="Ling-3.0-flash architecture: a central bottom-to-top transformer stack repeating seven groups, each with five KDA+MoE blocks and one Gated-MLA+MoE block, with left-side annotation callouts and right-side detail-expansion boxes for Multi-head Latent Attention and Kimi Delta Attention.">
          <defs>
            <marker id="lg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={INK} />
            </marker>
          </defs>
          <rect x="0" y="0" width="1240" height="1050" rx="10" fill={PAPER} />

          {/* ───────────── training objective (top) ───────────── */}
          <rect x="556" y="34" width="392" height="60" rx="6" fill={NOTE} stroke={INK} strokeWidth="1.1" strokeDasharray="4 3" />
          <text x="572" y="56" fill={INK} fontSize="11" fontWeight={600}>Training Objective</text>
          <text x="572" y="74" fill={INK} fontSize="10.5">Next-Token Prediction (NTP)</text>
          <text x="572" y="88" fill={INK} fontSize="10.5">+ Multi-Token Prediction (MTP)</text>
          <path d="M 556 78 L 434 82" fill="none" stroke={LEAD} strokeWidth="1.1" strokeDasharray="4 3" />

          {/* ───────────── central stack ───────────── */}
          {/* MTP head */}
          <Op cx={418} cy={82} sym="MTP" r={16} fs={10} fill={PURPLE} />
          <Line d="M 418 118 L 418 98" arrow />
          <text x={444} y={86} fill={INK} fontSize={10}>head</text>
          {/* Linear Output Layer */}
          <Box x={340} y={118} w={156} h={30} fill={SALMON} label="Linear Output Layer" fs={11} />
          <Line d="M 418 166 L 418 148" arrow />
          {/* Final RMSNorm */}
          <Box x={363} y={166} w={110} h={26} fill={NEUTRAL} label="Final RMSNorm" fs={10.5} />
          <Line d="M 418 234 L 418 192" arrow />

          {/* group box */}
          <rect x="326" y="234" width="184" height="404" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="6 4" />

          {/* four sublayers of the representative group (bottom→top):
              S1 KDA, S2 MoE  (×5),   S3 Gated MLA, S4 MoE  (×1) */}
          <SubLayer a={250} moduleLabel="MoE" moduleFill={GREEN} />
          <SubLayer a={346} moduleLabel="Gated MLA" moduleFill={SALMON} connectRight />
          <SubLayer a={442} moduleLabel="MoE" moduleFill={GREEN} />
          <SubLayer a={538} moduleLabel="KDA" moduleFill={BLUE} connectRight />
          {/* spine connecting the group up into Final RMSNorm and down to embedding */}
          <Line d="M 418 250 L 418 192" />
          <Line d="M 418 673 L 418 622" arrow />

          {/* RoPE feeding the Gated MLA */}
          <Box x={252} y={365} w={52} h={22} fill={YELLOW} label="RoPE" fs={10} />
          <Line d="M 304 376 L 362 376" arrow />

          {/* repeat brackets + 7-groups brace */}
          <Bracket x={486} y1={240} y2={396} label="×1" />
          <Bracket x={486} y1={402} y2={632} label="×5" />
          <Brace x={318} y1={238} y2={634} />

          {/* Token Embedding + Tokenized Text */}
          <Box x={340} y={673} w={156} h={30} fill={YELLOW} label="Token Embedding Layer" fs={11} />
          <Line d="M 418 738 L 418 703" arrow />
          <Box x={353} y={738} w={130} h={26} fill={NEUTRAL} label="Tokenized Text" fs={10.5} />

          {/* ───────────── left annotation callouts ───────────── */}
          <Callout x={20} y={110} w={196} lines={["Vocabulary size 157k"]} tx={340} ty={133} />
          <Callout x={20} y={300} w={196} lines={["1M-token context", "(RoPE · exact recall)"]} tx={252} ty={376} />
          <Callout x={20} y={430} w={196} lines={["E512A8 + 1 shared expert", "ALF-LB load balancing"]} tx={363} ty={472} />
          <Callout x={20} y={528} w={196} lines={["Linear time complexity", "(constant-size KDA state)"]} tx={363} ty={568} />
          <Callout x={20} y={600} w={196} lines={["First 2 blocks use dense", "FFN instead of MoE"]} tx={340} ty={636} />
          <Callout x={20} y={676} w={196} lines={["Embedding dimension 2,560"]} tx={340} ty={688} />

          {/* dashed connectors from the stack modules to the detail boxes */}
          <Line d="M 473 376 C 560 360, 590 330, 648 330" dash color={LEAD} />
          <Line d="M 473 568 C 560 600, 590 600, 648 600" dash color={LEAD} />

          {/* ═══════════ DETAIL BOX 1 · Multi-head Latent Attention ═══════════ */}
          <rect x="648" y="150" width="572" height="380" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="6 4" />
          <text x={934} y={172} textAnchor="middle" fill={INK} fontSize={13} fontWeight={600}>Multi-head Latent Attention</text>
          <text x={670} y={518} fill={INK} fontSize={10.5}>σ: sigmoid gate</text>

          {/* out arrow (top) + Output Projection */}
          <Line d="M 838 196 L 838 178" arrow />
          <Box x={763} y={196} w={150} h={28} fill={SALMON} label="Output Projection" fs={11} />
          {/* ⊙ gated by σ */}
          <Line d="M 838 240 L 838 226" arrow />
          <Op cx={838} cy={254} sym="⊙" r={11} />
          <Line d="M 838 286 L 838 266" arrow />
          {/* MLA core */}
          <Box x={706} y={286} w={264} h={28} fill={SALMON} label="MLA" fs={13} bold />

          {/* Q / K columns: Linear → RMSNorm → Linear → RoPE */}
          <ColStack cx={742} boxes={[
            { y: 338, w: 64, h: 24, label: "RoPE", fill: YELLOW },
            { y: 378, w: 64, h: 24, label: "Linear", fill: SALMON },
            { y: 419, w: 64, h: 22, label: "RMSNorm", fill: NEUTRAL },
            { y: 458, w: 64, h: 24, label: "Linear", fill: SALMON },
          ]} />
          <ColStack cx={838} boxes={[
            { y: 338, w: 64, h: 24, label: "RoPE", fill: YELLOW },
            { y: 378, w: 64, h: 24, label: "Linear", fill: SALMON },
            { y: 419, w: 64, h: 22, label: "RMSNorm", fill: NEUTRAL },
            { y: 458, w: 64, h: 24, label: "Linear", fill: SALMON },
          ]} />
          {/* RoPE tops feed MLA core */}
          <Line d="M 742 338 L 742 314" arrow />
          <Line d="M 838 338 L 838 314" arrow />
          {/* V column: single Linear */}
          <Box x={902} y={458} w={64} h={24} fill={SALMON} label="Linear" fs={10} />
          <text x={934} y={452} textAnchor="middle" fill={INK} fontSize={10}>V</text>
          <Line d="M 934 458 L 934 314" arrow />
          <text x={742} y={452} textAnchor="middle" fill={INK} fontSize={10}>Q</text>
          <text x={838} y={452} textAnchor="middle" fill={INK} fontSize={10}>K</text>
          {/* σ gate column */}
          <Box x={1060} y={458} w={64} h={24} fill={SALMON} label="Linear" fs={10} />
          <Op cx={1092} cy={378} sym="σ" r={11} fill={WHITE} />
          <Line d="M 1092 458 L 1092 390" arrow />
          <Line d="M 1092 366 L 1092 254 L 850 254" arrow />
          {/* input inlet */}
          <Line d="M 838 500 L 838 490" />
          <Line d="M 742 490 L 838 490 L 934 490 L 1092 490" />
          <Line d="M 742 490 L 742 482" arrow />
          <Line d="M 838 490 L 838 482" arrow />
          <Line d="M 934 490 L 934 482" arrow />
          <Line d="M 1092 490 L 1092 482" arrow />

          {/* ═══════════ DETAIL BOX 2 · KDA (Kimi Delta Attention) ═══════════ */}
          <rect x="648" y="560" width="572" height="470" rx="10" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="6 4" />
          <text x={934} y={582} textAnchor="middle" fill={INK} fontSize={13} fontWeight={600}>KDA (Kimi Delta Attention)</text>
          <text x={670} y={1018} fill={INK} fontSize={10}>σ: sigmoid gate    φ: softplus gate    δ: swish func</text>

          {/* out (top) + Output Projection */}
          <Line d="M 894 656 L 894 638" arrow />
          <Box x={814} y={656} w={160} h={28} fill={BLUE} label="Output Projection" fs={11} />
          {/* ⊙ gated by σ from the MLP gate */}
          <Line d="M 894 700 L 894 684" arrow />
          <Op cx={894} cy={714} sym="⊙" r={11} />
          <Line d="M 894 747 L 894 726" arrow />
          {/* RMSNorm */}
          <Box x={862} y={747} w={64} h={22} fill={NEUTRAL} label="RMSNorm" fs={10} />
          <Line d="M 894 786 L 894 769" arrow />
          {/* KDA core */}
          <Box x={700} y={786} w={388} h={28} fill={BLUE} label="Kimi Delta Attention" fs={12} bold />

          {/* Q / K columns: Linear → Conv → δ → L2 Norm */}
          <ColStack cx={724} boxes={[
            { y: 847, w: 58, h: 22, label: "L2 Norm", fill: NEUTRAL, fs: 9.5 },
            { y: 887, w: 30, h: 22, label: "δ", fill: WHITE, fs: 12 },
            { y: 927, w: 58, h: 22, label: "Conv", fill: NEUTRAL },
            { y: 966, w: 58, h: 24, label: "Linear", fill: BLUE },
          ]} />
          <ColStack cx={800} boxes={[
            { y: 847, w: 58, h: 22, label: "L2 Norm", fill: NEUTRAL, fs: 9.5 },
            { y: 887, w: 30, h: 22, label: "δ", fill: WHITE, fs: 12 },
            { y: 927, w: 58, h: 22, label: "Conv", fill: NEUTRAL },
            { y: 966, w: 58, h: 24, label: "Linear", fill: BLUE },
          ]} />
          <Line d="M 724 847 L 724 814" arrow />
          <Line d="M 800 847 L 800 814" arrow />
          {/* V column: Linear → Conv → δ */}
          <ColStack cx={876} boxes={[
            { y: 887, w: 30, h: 22, label: "δ", fill: WHITE, fs: 12 },
            { y: 927, w: 58, h: 22, label: "Conv", fill: NEUTRAL },
            { y: 966, w: 58, h: 24, label: "Linear", fill: BLUE },
          ]} />
          <Line d="M 876 887 L 876 814" arrow />
          {/* α column: Linear → φ */}
          <Op cx={952} cy={898} sym="φ" r={11} fill={WHITE} />
          <Box x={923} y={966} w={58} h={24} fill={BLUE} label="Linear" fs={10} />
          <Line d="M 952 966 L 952 910" arrow />
          <Line d="M 952 887 L 952 814" arrow />
          {/* β column: Linear → σ */}
          <Op cx={1028} cy={898} sym="σ" r={11} fill={WHITE} />
          <Box x={999} y={966} w={58} h={24} fill={BLUE} label="Linear" fs={10} />
          <Line d="M 1028 966 L 1028 910" arrow />
          <Line d="M 1028 887 L 1028 814" arrow />
          {/* labels for Q K V α β */}
          <text x={724} y={960} textAnchor="middle" fill={INK} fontSize={10}>Q</text>
          <text x={800} y={960} textAnchor="middle" fill={INK} fontSize={10}>K</text>
          <text x={876} y={960} textAnchor="middle" fill={INK} fontSize={10}>V</text>
          <text x={952} y={960} textAnchor="middle" fill={INK} fontSize={10}>α</text>
          <text x={1028} y={960} textAnchor="middle" fill={INK} fontSize={10}>β</text>
          {/* gate column: MLP → σ → ⊙ */}
          <Box x={1112} y={966} w={58} h={24} fill={NEUTRAL} label="MLP" fs={10} />
          <Op cx={1141} cy={898} sym="σ" r={11} fill={WHITE} />
          <Line d="M 1141 966 L 1141 910" arrow />
          <Line d="M 1141 886 L 1141 714 L 906 714" arrow />
          {/* input inlet */}
          <Line d="M 894 1002 L 894 990" />
          <Line d="M 724 990 L 1141 990" />
          {[724, 800, 876, 952, 1028, 1141].map((x) => (
            <Line key={x} d={`M ${x} 990 L ${x} 982`} arrow />
          ))}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Read the center stack bottom&#8209;to&#8209;top. Each group is <strong>5×</strong>{" "}
          <span style={{ color: "#3a6ea5" }}>KDA</span>+MoE blocks (linear&#8209;time memory) then{" "}
          <strong>1×</strong> <span style={{ color: "#b05a5a" }}>Gated&nbsp;MLA</span>+MoE (full attention with RoPE for exact
          recall), repeated <strong>×7</strong>. The right panels expand the two attention modules: <strong>Gated MLA</strong>{" "}
          (latent Q/K/V projections, RoPE, a sigmoid output gate) and <strong>KDA</strong>{" "}
          (a gated delta&#8209;rule linear
          attention with per&#8209;channel decay). A recreation of the launch architecture figure in the house paper&#8209;figure style.
        </p>
      </div>
    </figure>
  )
}
