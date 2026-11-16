"use client"

// Gated DeltaNet hybrid, drawn on the gallery's light "paper" card. Left: one
// block of the 3:1 stack (three Gated DeltaNet layers, then one full-attention
// layer), each layer tagged with what it keeps per sequence. Right: what one
// Gated DeltaNet head does to its state matrix for one token: decay it, erase
// what it held along the key, write the new value, read with the query. The
// Kimi K3 figure already draws a KDA/MLA stack; this one draws the state.
// All coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const RED = "#8a2b2b"

// a 4x4 state matrix; shade = how much is stored in that cell
const PREV = [0.55, 0.2, 0.35, 0.1, 0.3, 0.6, 0.15, 0.4, 0.1, 0.25, 0.5, 0.2, 0.45, 0.1, 0.3, 0.55]
const NEXT = [0.5, 0.18, 0.32, 0.09, 0.85, 0.7, 0.9, 0.75, 0.09, 0.22, 0.45, 0.18, 0.4, 0.09, 0.27, 0.5]

function Grid({ x, y, cells, hiRow }: { x: number; y: number; cells: number[]; hiRow?: number }) {
  return (
    <g>
      {cells.map((v, i) => (
        <rect
          key={i}
          x={x + (i % 4) * 16}
          y={y + Math.floor(i / 4) * 16}
          width="16"
          height="16"
          fill="#3a6ea5"
          fillOpacity={v}
          stroke={INK}
          strokeWidth="0.6"
        />
      ))}
      <rect x={x} y={y} width="64" height="64" fill="none" stroke={INK} strokeWidth="1.4" />
      {hiRow !== undefined ? (
        <rect x={x - 2} y={y + hiRow * 16 - 1} width="68" height="18" fill="none" stroke={RED} strokeWidth="1.8" />
      ) : null}
    </g>
  )
}

function Op({ x, y, w, title, formula, fill }: { x: number; y: number; w: number; title: string; formula: string; fill: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="46" rx="7" fill={fill} stroke={INK} strokeWidth="1.4" />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
        {title}
      </text>
      <text x={x + w / 2} y={y + 33} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
        {formula}
      </text>
    </g>
  )
}

const LAYERS = [
  { y: 92, label: "full attention", fill: SALMON, keep: "KV cache grows" },
  { y: 152, label: "Gated DeltaNet", fill: BLUE, keep: "fixed state" },
  { y: 212, label: "Gated DeltaNet", fill: BLUE, keep: "fixed state" },
  { y: 272, label: "Gated DeltaNet", fill: BLUE, keep: "fixed state" },
]

export function GatedDeltaNetHybrid() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        gated deltanet hybrid &middot; three recurrent layers, then one that attends in full
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 430"
          className="w-full"
          role="img"
          aria-label="Left: one block of a hybrid stack, read bottom to top: three Gated DeltaNet layers, each keeping a fixed-size state, then one full-attention layer whose key-value cache grows with every token; the block repeats N times. Right: one Gated DeltaNet head processing one token. The previous state matrix S is multiplied by a decay alpha, then the memory erases what it held along the key k with strength beta, then writes the new value v along k with strength beta, giving the new state. A query reads the new state with one product. The gates alpha and beta and the key, value and query are computed from the current token."
        >
          <defs>
            <marker id="gdn-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="gdn-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="430" rx="10" fill={PAPER} />

          {/* ---- left: one block of the stack ---- */}
          <text x="135" y="40" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
            one block, read bottom to top
          </text>
          {LAYERS.map((l) => (
            <g key={l.y}>
              <rect x="50" y={l.y} width="150" height="40" rx="7" fill={l.fill} stroke={INK} strokeWidth="1.5" />
              <text x="125" y={l.y + 14} textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
                {l.label}
              </text>
              <text x="125" y={l.y + 29} textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill={l.fill === SALMON ? RED : "#3a6ea5"}>
                {l.keep}
              </text>
              <line x1="125" y1={l.y + 96} x2="125" y2={l.y + 44} stroke={INK} strokeWidth="1.4" markerEnd="url(#gdn-a)" />
            </g>
          ))}
          <text x="125" y="380" textAnchor="middle" fontSize="11" fill={INK}>
            hidden state from the block below
          </text>
          <line x1="125" y1="92" x2="125" y2="66" stroke={INK} strokeWidth="1.4" markerEnd="url(#gdn-a)" />
          <text x="125" y="58" textAnchor="middle" fontSize="10" fill="#6b6b6b">
            to the next block
          </text>
          {/* repeat bracket */}
          <path d="M 36 92 L 28 92 L 28 336 L 36 336" fill="none" stroke={INK} strokeWidth="1.3" />
          <text x="20" y="214" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="600" fill={INK}>
            &times;N
          </text>

          <line x1="262" y1="40" x2="262" y2="392" stroke="#d9d4c3" strokeWidth="1" />

          {/* ---- right: one head, one token ---- */}
          <text x="520" y="40" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
            one Gated DeltaNet head, one token
          </text>
          <text x="520" y="62" textAnchor="middle" fontSize="11.5" fill={INK}>
            S&#8348; = &#945;&#8348; (I &minus; &#946;&#8348; k&#8348;k&#8348;&#7488;) S&#8348;&#8331;&#8321; + &#946;&#8348; k&#8348;v&#8348;&#7488;
          </text>

          {/* row 1: previous state -> decay -> erase */}
          <Grid x={290} y={98} cells={PREV} />
          <text x="322" y="178" textAnchor="middle" fontSize="11" fill={INK}>
            S&#8348;&#8331;&#8321;
          </text>
          <text x="322" y="192" textAnchor="middle" fontSize="9" fill="#6b6b6b">
            d&#8342; &times; d&#7525; per head
          </text>
          <line x1="358" y1="130" x2="390" y2="130" stroke={INK} strokeWidth="1.5" markerEnd="url(#gdn-a)" />
          <Op x={394} y={107} w={130} title="decay" formula="&times; &#945;&#8348; (0 to 1)" fill={YELLOW} />
          <line x1="524" y1="130" x2="556" y2="130" stroke={INK} strokeWidth="1.5" markerEnd="url(#gdn-a)" />
          <Op x={560} y={107} w={190} title="erase along k&#8348;" formula="&minus; &#946;&#8348; k&#8348; (k&#8348;&#7488; S)" fill={YELLOW} />

          {/* row 2: write -> new state -> read */}
          <line x1="655" y1="153" x2="655" y2="208" stroke={INK} strokeWidth="1.5" markerEnd="url(#gdn-a)" />
          <Op x={560} y={212} w={190} title="write along k&#8348;" formula="+ &#946;&#8348; k&#8348; v&#8348;&#7488;" fill={YELLOW} />
          <line x1="560" y1="235" x2="474" y2="235" stroke={INK} strokeWidth="1.5" markerEnd="url(#gdn-a)" />
          <Grid x={400} y={203} cells={NEXT} hiRow={1} />
          <text x="432" y="284" textAnchor="middle" fontSize="11" fill={INK}>
            S&#8348;
          </text>
          <line x1="400" y1="235" x2="352" y2="235" stroke={INK} strokeWidth="1.5" markerEnd="url(#gdn-a)" />
          <rect x="282" y="216" width="66" height="38" rx="19" fill="#f5cfcf" stroke={INK} strokeWidth="1.4" />
          <text x="315" y="229" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            read
          </text>
          <text x="315" y="243" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill={INK}>
            S&#8348;&#7488;q&#8348;
          </text>
          <text x="432" y="300" textAnchor="middle" fontSize="9" fill={RED}>
            the row along k&#8348; now holds v&#8348;
          </text>

          {/* inputs from the token (red: computed from x_t) */}
          <rect x="560" y="326" width="190" height="40" rx="7" fill="#efece3" stroke={INK} strokeWidth="1.4" />
          <text x="655" y="340" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
            token x&#8348;
          </text>
          <text x="655" y="356" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill={RED}>
            &rarr; q&#8348;, k&#8348;, v&#8348;, &#945;&#8348;, &#946;&#8348;
          </text>
          <line x1="655" y1="324" x2="655" y2="262" stroke={RED} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#gdn-r)" />
          <line x1="740" y1="324" x2="740" y2="157" stroke={RED} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#gdn-r)" />
          <path d="M 560 346 L 500 346 L 500 157" fill="none" stroke={RED} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#gdn-r)" />

          <text x="390" y="412" textAnchor="middle" fontSize="11.5" fill="#6b6b6b">
            fixed memory on three layers in four &middot; exact lookup left to the fourth
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A Gated DeltaNet layer keeps a{" "}<span style={{ color: "#3a6ea5" }}>matrix of fixed size</span>{" "}per head instead of a
          cache. Each token first shrinks it by a decay &#945;, then reads what the matrix already stores for its key and replaces
          it with the new value, at a strength &#946; the token picks. Three such layers share each block with one full-attention
          layer, whose{" "}<span style={{ color: RED }}>cache still grows</span>{" "}and does the exact retrieval a summary cannot.
        </p>
      </div>
    </figure>
  )
}
