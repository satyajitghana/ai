"use client"

// The encoder-decoder (seq2seq) Transformer, drawn distill-style on a light "paper"
// card so it reads in both light and dark site themes. Two stacks stand side by
// side. LEFT = encoder: bidirectional self-attention + FFN over the source. RIGHT =
// decoder: masked (causal) self-attention, then cross-attention, then FFN, each in
// an Add & Norm. The money detail is the cross-attention connector: the encoder's
// top output is routed through the gap and fed into the decoder's cross-attention
// block as its keys/values. Source tokens enter at the encoder bottom, target tokens
// (shifted right) at the decoder bottom, and the generated token leaves the top.
export function EncoderDecoder() {
  const src = [
    { cx: 136, t: "der" },
    { cx: 210, t: "Hund" },
    { cx: 284, t: "bellt" },
  ]
  const tgt = [
    { cx: 472, t: "[BOS]" },
    { cx: 546, t: "the" },
    { cx: 620, t: "dog" },
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        encoder&ndash;decoder transformer (seq2seq) &middot; t5 / bart
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 760 690"
          className="w-full"
          role="img"
          aria-label="An encoder-decoder Transformer. On the left, an encoder stack applies bidirectional self-attention and a feed-forward network over the source tokens. On the right, a decoder stack applies masked self-attention, then cross-attention, then a feed-forward network, each wrapped in Add and Norm. The encoder's output is routed across into the decoder's cross-attention block as its keys and values. Source tokens enter at the encoder bottom, target tokens shifted right enter at the decoder bottom, and a Linear plus Softmax head emits the next output token at the top."
        >
          <defs>
            <marker id="ed-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="760" height="690" rx="10" fill="#f7f4ea" />

          {/* ===== column labels ===== */}
          <text transform="rotate(-90 90 320)" x="90" y="320" textAnchor="middle" fontSize="10" fill="#6b6b6b">encoder &times; N</text>
          <text transform="rotate(-90 678 314)" x="678" y="314" textAnchor="middle" fontSize="10" fill="#6b6b6b">decoder &times; N</text>

          {/* ===== ENCODER stack ===== */}
          <rect x="100" y="180" width="220" height="268" rx="12" fill="#ffffff" fillOpacity="0.5" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="5 4" />

          {/* Add & Norm (post-FFN) */}
          <rect x="135" y="212" width="150" height="26" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="210" y="225" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">Add &amp; Norm</text>

          {/* FFN */}
          <rect x="120" y="252" width="180" height="46" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="210" y="275" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Feed-Forward</text>
          <line x1="210" y1="252" x2="210" y2="240" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Add & Norm (post-attention) */}
          <rect x="135" y="316" width="150" height="26" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="210" y="329" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">Add &amp; Norm</text>
          <line x1="210" y1="316" x2="210" y2="300" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Self-Attention (bidirectional) */}
          <rect x="110" y="356" width="200" height="66" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="210" y="376" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Self-Attention</text>
          <text x="210" y="394" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#3b6ea5">bidirectional</text>
          <line x1="176" y1="408" x2="244" y2="408" stroke="#3b6ea5" strokeWidth="1.3" markerStart="url(#ed-arrow)" markerEnd="url(#ed-arrow)" />
          <line x1="210" y1="356" x2="210" y2="344" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* encoder embeddings + entry arrow */}
          <line x1="210" y1="556" x2="210" y2="424" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />
          <rect x="110" y="556" width="200" height="38" rx="7" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="210" y="575" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#2a2a2a">input embedding + pos</text>

          {/* source tokens */}
          <line x1="210" y1="612" x2="210" y2="596" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />
          {src.map((tok) => (
            <g key={tok.t}>
              <rect x={tok.cx - 32} y="612" width="64" height="40" rx="6" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.4" />
              <text x={tok.cx} y="632" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#2a2a2a">{tok.t}</text>
            </g>
          ))}
          <text x="210" y="668" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#6b6b6b">source &middot; German</text>

          {/* ===== DECODER stack ===== */}
          <rect x="430" y="180" width="232" height="268" rx="12" fill="#ffffff" fillOpacity="0.5" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="5 4" />

          {/* Add & Norm (post-FFN) */}
          <rect x="466" y="194" width="160" height="22" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="205" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#2a2a2a">Add &amp; Norm</text>

          {/* FFN */}
          <rect x="451" y="224" width="190" height="42" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="245" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Feed-Forward</text>
          <line x1="546" y1="224" x2="546" y2="218" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Add & Norm (post-cross) */}
          <rect x="466" y="276" width="160" height="22" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="287" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#2a2a2a">Add &amp; Norm</text>
          <line x1="546" y1="276" x2="546" y2="268" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Cross-Attention */}
          <rect x="446" y="306" width="200" height="52" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="322" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Cross-Attention</text>
          <text x="546" y="340" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#8a2b2b">K,V from encoder</text>
          <line x1="546" y1="306" x2="546" y2="300" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Add & Norm (post-self) */}
          <rect x="466" y="372" width="160" height="22" rx="6" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="383" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#2a2a2a">Add &amp; Norm</text>
          <line x1="546" y1="372" x2="546" y2="360" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* Masked Self-Attention */}
          <rect x="446" y="402" width="200" height="40" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="415" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Masked Self-Attention</text>
          <text x="546" y="431" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#3b6ea5">causal &middot; past only</text>
          <line x1="546" y1="402" x2="546" y2="396" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* decoder embeddings + entry arrow */}
          <line x1="546" y1="556" x2="546" y2="444" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />
          <rect x="446" y="556" width="200" height="38" rx="7" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="575" textAnchor="middle" dominantBaseline="central" fontSize="10.5" fill="#2a2a2a">output embedding + pos</text>

          {/* target tokens (shifted right) */}
          <line x1="546" y1="612" x2="546" y2="596" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />
          {tgt.map((tok) => (
            <g key={tok.t}>
              <rect x={tok.cx - 32} y="612" width="64" height="40" rx="6" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.4" />
              <text x={tok.cx} y="632" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">{tok.t}</text>
            </g>
          ))}
          <text x="546" y="668" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#6b6b6b">target &middot; shifted right</text>

          {/* ===== decoder head + output ===== */}
          <rect x="446" y="72" width="200" height="40" rx="7" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="92" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">Linear &rarr; Softmax</text>
          <line x1="546" y1="194" x2="546" y2="114" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          <rect x="470" y="24" width="152" height="38" rx="7" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="546" y="43" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">output: barks</text>
          <line x1="546" y1="72" x2="546" y2="64" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#ed-arrow)" />

          {/* ===== cross-attention connector: encoder output -> decoder cross-attn ===== */}
          <path d="M210,212 V160 H378 V332 H446" fill="none" stroke="#8a2b2b" strokeWidth="1.7" markerEnd="url(#ed-arrow)" />
          <circle cx="210" cy="212" r="2.8" fill="#8a2b2b" />
          <text x="294" y="151" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#8a2b2b">encoder output &rarr; K,V</text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The encoder reads the whole source at once and produces a set of vectors; the decoder generates the
          target left-to-right, and at each step its <span style={{ color: "#8a2b2b" }}>cross-attention</span>{" "}queries
          that encoder output &mdash; the one wire that turns two stacks into a translator.
        </p>
      </div>
    </figure>
  )
}
