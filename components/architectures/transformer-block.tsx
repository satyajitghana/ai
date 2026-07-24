"use client"

// The canonical pre-norm decoder-only Transformer block, drawn distill-style on
// its own light "paper" card so the pastel boxes + dark text read in both light
// and dark site themes. Flow runs bottom -> top: token + positional embeddings
// enter the stack; each block does Norm -> Self-Attention -> add, then
// Norm -> MLP -> add (the two curved dashed lines are the residual skips); the
// whole block repeats x N before a final norm and the LM head.
export function TransformerBlock() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        pre-norm decoder-only transformer block
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="-190 0 870 640"
          className="w-full"
          role="img"
          aria-label="A pre-norm decoder-only Transformer block. Token and positional embeddings enter at the bottom, flow through a LayerNorm into multi-head self-attention with a residual add, then a LayerNorm into a feed-forward MLP with a residual add. The block repeats N times, followed by a final LayerNorm and an LM head producing logits."
        >
          <defs>
            <marker id="tb-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="-190" y="0" width="870" height="640" rx="14" fill="#f7f4ea" />

          {/* ── left annotation callouts (distill-style leaders) ── */}
          <g>
            <text x="-176" y="544" fontSize="12.5" fontWeight={600} fill="#3b6ea5">Input</text>
            <text x="-176" y="560" fontSize="10" fill="#6b6b6b">tokens + positions → vectors</text>
            <path d="M-32,548 H165" fill="none" stroke="#9a968c" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="167" cy="548" r="2.2" fill="#9a968c" />

            <text x="-176" y="398" fontSize="12.5" fontWeight={600} fill="#3b6ea5">Mixing</text>
            <text x="-176" y="414" fontSize="10" fill="#6b6b6b">tokens attend to the past</text>
            <path d="M-32,402 H190" fill="none" stroke="#9a968c" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="192" cy="402" r="2.2" fill="#9a968c" />

            <text x="-176" y="233" fontSize="12.5" fontWeight={600} fill="#3b6ea5">Thinking</text>
            <text x="-176" y="249" fontSize="10" fill="#6b6b6b">per-token MLP · d→4d→d</text>
            <path d="M-32,237 H190" fill="none" stroke="#9a968c" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx="192" cy="237" r="2.2" fill="#9a968c" />
          </g>

          {/* dashed "repeat x N" block container */}
          <rect x="140" y="156" width="420" height="348" rx="12" fill="#ffffff" fillOpacity="0.5" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="5 4" />
          <text transform="rotate(-90 548 330)" x="548" y="330" textAnchor="middle" fontSize="11" fill="#6b6b6b">
            stacked  x N layers
          </text>

          {/* ---- input tokens ---- */}
          {[
            { x: 200, t: "The" },
            { x: 252, t: "cat" },
            { x: 304, t: "sat" },
            { x: 356, t: "on" },
          ].map((tok) => (
            <g key={tok.t}>
              <rect x={tok.x} y="590" width="44" height="36" rx="6" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
              <text x={tok.x + 22} y="608" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
                {tok.t}
              </text>
            </g>
          ))}
          <text x="480" y="608" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            input tokens
          </text>
          <line x1="300" y1="588" x2="300" y2="570" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- embedding + positional encoding ---- */}
          <rect x="170" y="528" width="260" height="40" rx="7" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="548" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Token Embedding + Positional Encoding
          </text>
          <line x1="300" y1="526" x2="300" y2="506" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* branch dot into the block (attention residual tap) */}
          <circle cx="300" cy="498" r="2.6" fill="#2a2a2a" />
          <line x1="300" y1="503" x2="300" y2="484" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- LayerNorm (attention) ---- */}
          <rect x="225" y="452" width="150" height="30" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="467" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            LayerNorm
          </text>
          <text x="392" y="467" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            pre-norm
          </text>
          <line x1="300" y1="452" x2="300" y2="436" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- Multi-Head Self-Attention ---- */}
          <rect x="195" y="370" width="210" height="64" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="384" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Multi-Head Self-Attention
          </text>
          {[216, 260, 304, 348].map((hx, i) => (
            <g key={hx}>
              <rect x={hx} y="400" width="36" height="24" rx="4" fill="#dce9f8" stroke="#2a2a2a" strokeWidth="1" />
              <text x={hx + 18} y="412" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#2a2a2a">
                h{i + 1}
              </text>
            </g>
          ))}
          <text x="300" y="446" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#4a4a4a">
            causal (masked) attention over past tokens
          </text>
          <line x1="300" y1="370" x2="300" y2="365" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- residual add 1 (attention) ---- */}
          <circle cx="300" cy="350" r="13" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="291" y1="350" x2="309" y2="350" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="300" y1="341" x2="300" y2="359" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="300" y1="337" x2="300" y2="318" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* branch dot into FFN sub-layer (residual tap 2) */}
          <circle cx="300" cy="327" r="2.6" fill="#2a2a2a" />

          {/* ---- LayerNorm (FFN) ---- */}
          <rect x="225" y="286" width="150" height="30" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="301" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            LayerNorm
          </text>
          <line x1="300" y1="286" x2="300" y2="262" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- Feed-Forward MLP ---- */}
          <rect x="195" y="214" width="210" height="46" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="230" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Feed-Forward (MLP)
          </text>
          <text x="300" y="246" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            d to 4d to d, per-token
          </text>
          <line x1="300" y1="214" x2="300" y2="205" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- residual add 2 (FFN) ---- */}
          <circle cx="300" cy="190" r="13" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="291" y1="190" x2="309" y2="190" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="300" y1="181" x2="300" y2="199" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="300" y1="177" x2="300" y2="158" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- residual skip paths ---- */}
          <path d="M300,498 H465 V350 H313" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#tb-arrow)" />
          <path d="M300,327 H500 V190 H313" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#tb-arrow)" />
          <text x="470" y="343" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            residual
          </text>
          <text x="505" y="183" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            residual
          </text>

          {/* ---- final norm ---- */}
          <rect x="225" y="108" width="150" height="30" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="123" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            Final LayerNorm
          </text>
          <line x1="300" y1="156" x2="300" y2="140" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />
          <line x1="300" y1="108" x2="300" y2="84" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#tb-arrow)" />

          {/* ---- LM head ---- */}
          <rect x="195" y="40" width="210" height="42" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="300" y="55" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            LM Head
          </text>
          <text x="300" y="70" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            logits over the vocabulary
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each block refines the token stream twice &mdash; self-attention lets positions mix, the MLP thinks
          per-token &mdash; and both sub-layers are wrapped in a <em>normalize &rarr; transform &rarr; add</em> residual,
          so the original signal (and its gradient) flows straight up through all N stacked layers.
        </p>
      </div>
    </figure>
  )
}
