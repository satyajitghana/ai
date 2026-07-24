"use client"

// The bidirectional encoder (BERT), drawn distill-style on its own light "paper"
// card so the pastel boxes + dark ink read in both light and dark site themes.
// Flow runs bottom -> top: input tokens (one is [MASK]) hit token + positional
// embeddings, pass through a stack of N encoder blocks (each = multi-head
// *bidirectional* self-attention + FFN, both wrapped in Add & Norm), and the MLM
// head at the top predicts the masked word. The key contrast with a decoder is the
// bottom panel: every token attends to BOTH neighbours (no causal mask), shown as
// double-headed arcs fanning out from [MASK] to the whole sequence.
export function EncoderBert() {
  const tokens = [
    { cx: 214, t: "the" },
    { cx: 282, t: "cat" },
    { cx: 350, t: "[MASK]", mask: true },
    { cx: 418, t: "on" },
    { cx: 486, t: "mat" },
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        bidirectional encoder (bert) &middot; masked language model
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 700 712"
          className="w-full"
          role="img"
          aria-label="A bidirectional encoder (BERT). Input tokens, one of which is [MASK], flow up through token and positional embeddings into a stack of N encoder blocks. Each block is a multi-head bidirectional self-attention sub-layer and a feed-forward sub-layer, both wrapped in Add and Norm residual connections. An MLM head at the top predicts the masked word. A panel at the bottom shows that, with no causal mask, every token attends to the whole sequence in both directions."
        >
          <defs>
            <marker id="bert-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto-start-reverse">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="700" height="712" rx="10" fill="#f7f4ea" />

          {/* ---- prediction (top output) ---- */}
          <rect x="240" y="30" width="220" height="44" rx="8" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="46" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            predict [MASK]
          </text>
          <text x="350" y="62" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#4a4a4a">
            &rarr; &ldquo;sat&rdquo;
          </text>
          <line x1="350" y1="104" x2="350" y2="76" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />

          {/* ---- MLM head ---- */}
          <rect x="240" y="104" width="220" height="46" rx="8" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="120" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            MLM Head
          </text>
          <text x="350" y="136" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            softmax over vocabulary
          </text>

          {/* ---- encoder block container (x N) ---- */}
          <rect x="150" y="176" width="430" height="270" rx="12" fill="#ffffff" fillOpacity="0.5" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="5 4" />
          <text transform="rotate(-90 566 390)" x="566" y="390" textAnchor="middle" fontSize="10" fill="#6b6b6b">
            encoder block &times; N
          </text>

          {/* Add & Norm (post-FFN) */}
          <rect x="260" y="196" width="180" height="26" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="209" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#2a2a2a">
            Add &amp; Norm
          </text>
          <line x1="350" y1="196" x2="350" y2="152" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />

          {/* Feed-Forward */}
          <rect x="240" y="234" width="220" height="48" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="250" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Feed-Forward (MLP)
          </text>
          <text x="350" y="266" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            per-token &middot; d &rarr; 4d &rarr; d
          </text>
          <line x1="350" y1="234" x2="350" y2="224" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />

          {/* Add & Norm (post-attention) */}
          <rect x="260" y="296" width="180" height="26" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="309" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#2a2a2a">
            Add &amp; Norm
          </text>
          <line x1="350" y1="296" x2="350" y2="284" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />
          {/* branch dot (FFN residual tap) */}
          <circle cx="350" cy="290" r="2.6" fill="#2a2a2a" />

          {/* Multi-Head bidirectional Self-Attention */}
          <rect x="220" y="332" width="260" height="72" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="352" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Multi-Head Self-Attention
          </text>
          <text x="350" y="372" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#3b6ea5">
            bidirectional &middot; no causal mask
          </text>
          {/* tiny both-ways glyph inside the box */}
          <line x1="316" y1="390" x2="384" y2="390" stroke="#3b6ea5" strokeWidth="1.4" markerStart="url(#bert-arrow)" markerEnd="url(#bert-arrow)" />
          <line x1="350" y1="332" x2="350" y2="324" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />
          {/* branch dot (attention residual tap) */}
          <circle cx="350" cy="430" r="2.6" fill="#2a2a2a" />

          {/* ---- residual skip paths (post-norm) ---- */}
          <path d="M350,430 H500 V309 H443" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#bert-arrow)" />
          <path d="M350,290 H524 V209 H443" fill="none" stroke="#2a2a2a" strokeWidth="1.3" strokeDasharray="4 3" markerEnd="url(#bert-arrow)" />
          <text x="506" y="370" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">residual</text>
          <text x="530" y="250" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">residual</text>

          {/* ---- embeddings ---- */}
          <rect x="200" y="474" width="300" height="42" rx="7" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="350" y="495" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Token + Positional Embeddings
          </text>
          <line x1="350" y1="472" x2="350" y2="406" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />

          {/* ---- input / bidirectional-attention panel ---- */}
          <rect x="60" y="548" width="580" height="138" rx="10" fill="#ffffff" fillOpacity="0.55" stroke="#9a968c" strokeWidth="1.1" strokeDasharray="5 4" />
          <text x="350" y="566" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#4a4a4a">
            bidirectional &mdash; every token sees the whole sequence (no causal mask)
          </text>
          <line x1="350" y1="548" x2="350" y2="518" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#bert-arrow)" />

          {/* double-headed attention arcs from [MASK] to the whole sequence */}
          <path d="M350,638 Q282,600 214,638" fill="none" stroke="#3b6ea5" strokeWidth="1.3" markerStart="url(#bert-arrow)" markerEnd="url(#bert-arrow)" />
          <path d="M350,638 Q316,612 282,638" fill="none" stroke="#3b6ea5" strokeWidth="1.3" markerStart="url(#bert-arrow)" markerEnd="url(#bert-arrow)" />
          <path d="M350,638 Q384,612 418,638" fill="none" stroke="#3b6ea5" strokeWidth="1.3" markerStart="url(#bert-arrow)" markerEnd="url(#bert-arrow)" />
          <path d="M350,638 Q418,600 486,638" fill="none" stroke="#3b6ea5" strokeWidth="1.3" markerStart="url(#bert-arrow)" markerEnd="url(#bert-arrow)" />

          {/* input tokens */}
          {tokens.map((tok) => (
            <g key={tok.t}>
              <rect
                x={tok.cx - 30}
                y="640"
                width="60"
                height="40"
                rx="6"
                fill={tok.mask ? "#f5eec0" : "#efece3"}
                stroke="#2a2a2a"
                strokeWidth={tok.mask ? 1.7 : 1.4}
              />
              <text x={tok.cx} y="660" textAnchor="middle" dominantBaseline="central" fontSize={tok.mask ? "10.5" : "11"} fill="#2a2a2a">
                {tok.t}
              </text>
            </g>
          ))}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          BERT is a Transformer <em>encoder</em>: with no causal mask, every position attends to the whole
          sequence at once, so the hidden state for <code>[MASK]</code> is built from context on <em>both</em> sides.
          The MLM head then reads that position and predicts the missing word.
        </p>
      </div>
    </figure>
  )
}
