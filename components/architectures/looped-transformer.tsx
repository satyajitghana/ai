"use client"

// Looped / recurrent-depth Transformer, drawn distill-style on its own light
// "paper" card so the pastel boxes read in both site themes. ONE transformer
// block is reused for K passes (weight-tied): the ghosted copies behind it hint
// at the repetition. Input embeddings enter at the bottom and merge into the
// block; the block's output loops back into its own input (the bold red curve on
// the left) K times — latent reasoning — before finally exiting to the LM head.

export function LoopedTransformer() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        looped transformer &middot; weight-tied recurrent depth
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 680 460"
          className="w-full"
          role="img"
          aria-label="A looped, weight-tied Transformer. Input embeddings enter at the bottom and merge into a single shared transformer block. The block's output loops back into its own input, shown as a bold red curved arrow on the left, repeating K times as latent reasoning. Faint copies behind the block indicate the same weights are reused each pass. After K passes the signal exits upward to the LM head. Depth is bought with more FLOPs, not more parameters."
        >
          <defs>
            <marker id="loop-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
            <marker id="loop-arrow-red" markerWidth="10" markerHeight="10" refX="6" refY="3.2" orient="auto">
              <path d="M0,0 L7,3.2 L0,6.4 Z" fill="#8a2b2b" />
            </marker>
          </defs>

          <rect x="0" y="0" width="680" height="460" rx="10" fill="#f7f4ea" />

          {/* ---- LM head (exit, top) ---- */}
          <rect x="310" y="60" width="180" height="42" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="400" y="81" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill="#2a2a2a">
            LM head &#8594; output
          </text>

          {/* exit after K passes: branch -> head */}
          <line x1="400" y1="150" x2="400" y2="104" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#loop-arrow)" />
          <text x="418" y="126" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            exit after &#215;K
          </text>
          <circle cx="400" cy="150" r="3" fill="#2a2a2a" />

          {/* block output up to the branch */}
          <line x1="400" y1="170" x2="400" y2="152" stroke="#2a2a2a" strokeWidth="1.5" />

          {/* ---- shared transformer block (with ghost copies for the K reuse) ---- */}
          <rect x="324" y="184" width="180" height="110" rx="8" fill="#dbe6f5" stroke="#b8c6da" strokeWidth="1" />
          <rect x="317" y="177" width="180" height="110" rx="8" fill="#c4d8f0" stroke="#9fb6d6" strokeWidth="1" />
          <rect x="310" y="170" width="180" height="110" rx="8" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="400" y="214" textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#2a2a2a">
            Transformer Block
          </text>
          <text x="400" y="234" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            self-attention + MLP
          </text>
          <text x="400" y="252" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#3f6aa8">
            weight-tied &middot; shared
          </text>

          {/* ---- merge node (input + loop-back feed in) ---- */}
          <circle cx="400" cy="322" r="13" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="391" y1="322" x2="409" y2="322" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="400" y1="313" x2="400" y2="331" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="420" y="322" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">merge</text>
          <line x1="400" y1="309" x2="400" y2="282" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#loop-arrow)" />

          {/* ---- input embeddings (bottom) ---- */}
          <rect x="312" y="360" width="176" height="42" rx="7" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="400" y="381" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            input embeddings
          </text>
          <line x1="400" y1="360" x2="400" y2="337" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#loop-arrow)" />

          {/* ---- loop-back path: block output -> back into the block's input ---- */}
          <path
            d="M400,150 C300,150 232,164 232,240 C232,300 300,322 387,322"
            fill="none"
            stroke="#8a2b2b"
            strokeWidth="2.2"
            markerEnd="url(#loop-arrow-red)"
          />
          <rect x="120" y="188" width="96" height="14" fill="#f7f4ea" />
          <text x="214" y="196" textAnchor="end" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            latent reasoning loop
          </text>
          <rect x="138" y="225" width="78" height="16" fill="#f7f4ea" />
          <text x="214" y="232" textAnchor="end" dominantBaseline="central" fontSize="13" fontWeight={700} fill="#8a2b2b">
            &#215; K passes
          </text>
          <rect x="110" y="241" width="106" height="14" fill="#f7f4ea" />
          <text x="214" y="248" textAnchor="end" dominantBaseline="central" fontSize="8.5" fill="#8a2b2b">
            (same weights every pass)
          </text>

          {/* ---- required tagline ---- */}
          <text x="340" y="430" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill="#6b6b6b">
            shared weights &middot; depth paid in FLOPs, not parameters
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A looped Transformer runs one <em>shared</em>{" "}block over and over &mdash; the output of a pass is fed back as
          the next pass&rsquo;s input &mdash; so it gets the effective depth of a much taller model while storing the
          parameters of just a single layer. The extra reasoning is paid for in <em>compute</em>, not weights.
        </p>
      </div>
    </figure>
  )
}
