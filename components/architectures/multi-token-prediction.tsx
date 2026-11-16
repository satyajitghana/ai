"use client"

// Multi-token prediction in DeepSeek-V3's sequential form, on the gallery's
// paper card. The main model predicts token i+1. Each MTP module k takes the
// previous depth's hidden state and the embedding of the token k steps ahead,
// normalises both, concatenates and projects them, runs one transformer block,
// and predicts one token further, through the same output head. The embedding
// and head are shared. All coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const GREEN = "#cfe8cf"
const RED = "#8a2b2b"

const COLS = [
  { x: 40, title: "main model", input: "t₁ … tᵢ", block: "transformer × L", out: "tᵢ₊₁" },
  { x: 290, title: "MTP module 1", input: "tᵢ₊₁", block: "1 transformer block", out: "tᵢ₊₂" },
  { x: 540, title: "MTP module 2", input: "tᵢ₊₂", block: "1 transformer block", out: "tᵢ₊₃" },
]

function Box({ x, y, w, h, fill, label, sub }: { x: number; y: number; w: number; h: number; fill: string; label: string; sub?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill={fill} stroke={INK} strokeWidth="1.4" />
      <text x={x + w / 2} y={sub ? y + h / 2 - 7 : y + h / 2} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
        {label}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 8} textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
          {sub}
        </text>
      ) : null}
    </g>
  )
}

export function MultiTokenPrediction() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        multi-token prediction &middot; sequential modules that each look one token further
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 450"
          className="w-full"
          role="img"
          aria-label="Three columns, read bottom to top. The main model embeds tokens 1 to i, runs its transformer stack and predicts token i plus 1 through the output head. MTP module 1 takes the main model's hidden state and the embedding of token i plus 1, normalises both, concatenates them and projects them back to model width, runs one transformer block and predicts token i plus 2 through the same output head. MTP module 2 repeats this one step further and predicts token i plus 3. The embedding and the output head are shared by all three columns. At inference the modules can be dropped, or used to draft tokens that the main model verifies."
        >
          <defs>
            <marker id="mtp-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="mtp-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="450" rx="10" fill={PAPER} />

          {COLS.map((c, i) => {
            const cx = c.x + 100
            return (
              <g key={c.title}>
                <text x={cx} y="30" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
                  {c.title}
                </text>
                {/* prediction */}
                <rect x={cx - 40} y="44" width="80" height="28" rx="14" fill={SALMON} stroke={INK} strokeWidth="1.4" />
                <text x={cx} y="58" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill={INK}>
                  {c.out}
                </text>
                <line x1={cx} y1="94" x2={cx} y2="76" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                <Box x={c.x + 20} y={96} w={160} h={30} fill={GREEN} label="output head" sub={i === 0 ? undefined : "shared"} />
                <line x1={cx} y1="164" x2={cx} y2="130" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                <Box x={c.x + 20} y={166} w={160} h={34} fill={BLUE} label={c.block} />
                {i > 0 ? (
                  <g>
                    <line x1={cx} y1="226" x2={cx} y2="204" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                    <Box x={c.x + 20} y={228} w={160} h={34} fill={YELLOW} label="concat, project M" sub="2d → d" />
                    <line x1={c.x + 60} y1="294" x2={c.x + 60} y2="266" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                    <line x1={c.x + 140} y1="294" x2={c.x + 140} y2="266" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                    <Box x={c.x + 20} y={296} w={80} h={28} fill="#efece3" label="RMSNorm" />
                    <Box x={c.x + 100} y={296} w={80} h={28} fill="#efece3" label="RMSNorm" />
                    <line x1={c.x + 140} y1="350" x2={c.x + 140} y2="328" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                  </g>
                ) : (
                  <line x1={cx} y1="350" x2={cx} y2="204" stroke={INK} strokeWidth="1.4" markerEnd="url(#mtp-a)" />
                )}
                <Box x={i === 0 ? c.x + 20 : c.x + 100} y={352} w={i === 0 ? 160 : 80} h={30} fill={GREEN} label="embedding" sub={i === 0 ? undefined : "shared"} />
                <text x={i === 0 ? cx : c.x + 140} y="404" textAnchor="middle" fontSize="11" fill={INK}>
                  {c.input}
                </text>
                <line x1={i === 0 ? cx : c.x + 140} y1="394" x2={i === 0 ? cx : c.x + 140} y2="386" stroke={INK} strokeWidth="1.4" />
              </g>
            )
          })}

          {/* hidden state carried to the next depth (the causal chain) */}
          <path d="M 220 183 L 250 183 L 250 340 L 350 340 L 350 328" fill="none" stroke={RED} strokeWidth="1.5" markerEnd="url(#mtp-r)" />
          <path d="M 470 183 L 500 183 L 500 340 L 600 340 L 600 328" fill="none" stroke={RED} strokeWidth="1.5" markerEnd="url(#mtp-r)" />
          <text x="255" y="262" fontSize="9.5" fill={RED}>
            h&#8304;
          </text>
          <text x="505" y="262" fontSize="9.5" fill={RED}>
            h&#185;
          </text>

          <text x="390" y="432" textAnchor="middle" fontSize="11.5" fill="#6b6b6b">
            training: a loss at every depth &middot; inference: drop the modules, or let them draft for the main model
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each module sees the{" "}<span style={{ color: RED }}>hidden state of the depth before it</span>{" "}and the real next
          token, so its guess one step further is conditioned on everything to its left. That keeps the causal chain that
          independent parallel heads give up. During training each depth adds a loss; at inference the modules either go away
          or propose tokens the main model checks in one pass.
        </p>
      </div>
    </figure>
  )
}
