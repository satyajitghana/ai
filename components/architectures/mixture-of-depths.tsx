"use client"

// Mixture-of-Depths, drawn distill-style on its own light "paper" card so the
// pastel boxes read in both site themes. Depth runs left -> right along one
// "residual stream" rail. At each layer a Router scores every token and keeps a
// top-k subset: the SELECTED tokens flow THROUGH the transformer block (they pay
// the FLOPs), while the rest take the SKIP arc over the block straight to the
// residual Add. Two blocks are shown, and the router dots make it clear a
// different subset is selected at each layer.

// which of the 6 tokens each router selects (0-indexed) — different per layer
const SEL1 = [0, 2]
const SEL2 = [1, 2]

const ROUTER1_DOTS = [184, 197, 210, 223, 236, 249]
const ROUTER2_DOTS = [494, 507, 520, 533, 546, 559]
const INPUT_SQ = [32, 50, 68, 86, 104, 122]
const OUTPUT_SQ = [796, 814, 832, 850, 868, 886]

export function MixtureOfDepths() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        mixture-of-depths &middot; per-token skip routing
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 940 330"
          className="w-full"
          role="img"
          aria-label="A Mixture-of-Depths stack. A sequence of six tokens flows left to right along a residual rail through two transformer blocks. Before each block a router scores the tokens and selects a top-2 subset (shown as filled dots): the selected tokens pass through the block and pay its compute, while the unselected tokens take a skip arc over the block straight to the residual add. Router 1 selects tokens 1 and 3; router 2 selects a different subset, tokens 2 and 3."
        >
          <defs>
            <marker id="mod-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="940" height="330" rx="10" fill="#f7f4ea" />

          {/* ---- input token sequence ---- */}
          <text x="84" y="150" textAnchor="middle" fontSize="10" fill="#6b6b6b">tokens</text>
          <rect x="24" y="160" width="120" height="60" rx="8" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          {INPUT_SQ.map((sx, i) => (
            <g key={`in-${i}`}>
              <rect x={sx} y="179" width="13" height="22" rx="2.5" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1" />
              <text x={sx + 6.5} y="190" textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#2a2a2a">
                {i + 1}
              </text>
            </g>
          ))}
          <text x="84" y="234" textAnchor="middle" fontSize="9" fill="#6b6b6b">sequence</text>

          {/* rail: input -> router 1 */}
          <line x1="144" y1="190" x2="166" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />

          {/* ---- router 1 ---- */}
          <rect x="168" y="160" width="96" height="60" rx="8" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="216" y="176" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">router 1</text>
          {ROUTER1_DOTS.map((dx, i) => (
            <circle
              key={`r1-${i}`}
              cx={dx}
              cy="198"
              r="4.2"
              fill={SEL1.includes(i) ? "#3f6aa8" : "#e6e3da"}
              stroke={SEL1.includes(i) ? "#2a2a2a" : "#b8b4a8"}
              strokeWidth="1"
            />
          ))}
          <text x="216" y="236" textAnchor="middle" fontSize="9" fill="#6b6b6b">top-2 of 6</text>

          {/* rail: router 1 -> block 1 (with skip branch) */}
          <line x1="264" y1="190" x2="284" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />
          <circle cx="274" cy="190" r="3" fill="#2a2a2a" />

          {/* skip 1 arc over block 1 -> add 1 */}
          <path d="M274,190 C308,96 402,96 440,175" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#mod-arrow)" />
          <rect x="272" y="79" width="170" height="14" fill="#f7f4ea" />
          <text x="357" y="86" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">skip &middot; residual (bypass)</text>

          {/* ---- block 1 ---- */}
          <rect x="286" y="160" width="118" height="60" rx="8" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="345" y="182" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">block 1</text>
          <text x="345" y="200" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#4a4a4a">self-attn + MLP</text>
          <text x="345" y="236" textAnchor="middle" fontSize="9" fill="#3f6aa8">processed</text>

          {/* block 1 -> add 1 */}
          <line x1="404" y1="190" x2="424" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />
          <circle cx="440" cy="190" r="15" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="431" y1="190" x2="449" y2="190" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="440" y1="181" x2="440" y2="199" stroke="#2a2a2a" strokeWidth="1.5" />

          {/* add 1 -> router 2 */}
          <line x1="455" y1="190" x2="476" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />

          {/* ---- router 2 ---- */}
          <rect x="478" y="160" width="96" height="60" rx="8" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="526" y="176" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">router 2</text>
          {ROUTER2_DOTS.map((dx, i) => (
            <circle
              key={`r2-${i}`}
              cx={dx}
              cy="198"
              r="4.2"
              fill={SEL2.includes(i) ? "#3f6aa8" : "#e6e3da"}
              stroke={SEL2.includes(i) ? "#2a2a2a" : "#b8b4a8"}
              strokeWidth="1"
            />
          ))}
          <text x="526" y="236" textAnchor="middle" fontSize="9" fill="#6b6b6b">top-2 of 6</text>

          {/* rail: router 2 -> block 2 (with skip branch) */}
          <line x1="574" y1="190" x2="594" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />
          <circle cx="584" cy="190" r="3" fill="#2a2a2a" />

          {/* skip 2 arc over block 2 -> add 2 */}
          <path d="M584,190 C618,96 712,96 750,175" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="5 4" markerEnd="url(#mod-arrow)" />
          <rect x="600" y="79" width="134" height="14" fill="#f7f4ea" />
          <text x="667" y="86" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">skip &middot; residual</text>

          {/* ---- block 2 ---- */}
          <rect x="596" y="160" width="118" height="60" rx="8" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="655" y="182" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">block 2</text>
          <text x="655" y="200" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#4a4a4a">self-attn + MLP</text>
          <text x="655" y="236" textAnchor="middle" fontSize="9" fill="#3f6aa8">processed</text>

          {/* block 2 -> add 2 */}
          <line x1="714" y1="190" x2="734" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />
          <circle cx="750" cy="190" r="15" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="741" y1="190" x2="759" y2="190" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="750" y1="181" x2="750" y2="199" stroke="#2a2a2a" strokeWidth="1.5" />

          {/* add 2 -> output */}
          <line x1="765" y1="190" x2="786" y2="190" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mod-arrow)" />

          {/* ---- output tokens ---- */}
          <text x="848" y="150" textAnchor="middle" fontSize="10" fill="#6b6b6b">refined tokens</text>
          <rect x="788" y="160" width="120" height="60" rx="8" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          {OUTPUT_SQ.map((sx, i) => (
            <g key={`out-${i}`}>
              <rect x={sx} y="179" width="13" height="22" rx="2.5" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1" />
              <text x={sx + 6.5} y="190" textAnchor="middle" dominantBaseline="central" fontSize="7" fill="#2a2a2a">
                {i + 1}
              </text>
            </g>
          ))}
          <text x="848" y="234" textAnchor="middle" fontSize="9" fill="#6b6b6b">outputs</text>

          {/* ---- legend ---- */}
          <circle cx="300" cy="268" r="5" fill="#3f6aa8" stroke="#2a2a2a" strokeWidth="1" />
          <text x="312" y="268" textAnchor="start" dominantBaseline="central" fontSize="9.5" fill="#2a2a2a">
            selected &#8594; through block (pays FLOPs)
          </text>
          <circle cx="510" cy="268" r="5" fill="#e6e3da" stroke="#b8b4a8" strokeWidth="1" />
          <text x="522" y="268" textAnchor="start" dominantBaseline="central" fontSize="9.5" fill="#2a2a2a">
            skipped &#8594; residual bypass (free)
          </text>

          {/* ---- required tagline ---- */}
          <text x="470" y="306" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill="#6b6b6b">
            per-token, per-layer compute &mdash; only selected tokens pay
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A router at every layer keeps only a fixed fraction of tokens for the block; the rest
          <em> skip</em>{" "}it through the residual connection. Because the selected set changes layer to layer, each
          token gets a <em>different effective depth</em>{" "}&mdash; and the network spends compute only where it helps.
        </p>
      </div>
    </figure>
  )
}
