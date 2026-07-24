"use client"

// A Diffusion Transformer (DiT / MMDiT) drawn distill-style on a light "paper"
// card so the pastel boxes read in both site themes. The main column runs
// bottom -> top: a noisy image latent (grid of patches) -> Patchify + Embed ->
// a stack of DiT blocks -> predicted noise epsilon. The block is conditioned by
// adaptive LayerNorm (adaLN): the timestep t and the caption are pooled through a
// small MLP that emits a scale/shift (gamma, beta) modulating the block's norm
// (the red path). In the MMDiT variant, image tokens and text tokens keep their
// own projections but flow through one *joint* self-attention.
export function DiffusionTransformer() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        transformer denoiser &middot; adaln conditioning &middot; joint text+image attention
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 820 660"
          className="w-full"
          role="img"
          aria-label="A Diffusion Transformer (DiT / MMDiT). The main column runs bottom to top: a noisy image latent shown as a 3 by 3 grid of patches is patchified and embedded into image tokens, passes through a DiT block, and produces the predicted noise epsilon at the top. Conditioning on the left: a timestep and a caption are pooled through a small adaLN MLP that emits a scale and shift (gamma, beta), shown in red, that modulate the block's adaLN norm. Inside the block, image tokens and text tokens keep their own projections but flow through one joint self-attention, then a per-token MLP; the block repeats N times."
        >
          <defs>
            <marker id="dit-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
            <marker id="dit-arrow-red" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#8a2b2b" />
            </marker>
          </defs>

          <rect x="0" y="0" width="820" height="660" rx="10" fill="#f7f4ea" />

          {/* ───────── conditioning column (left) ───────── */}
          <text x="150" y="224" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            conditioning
          </text>

          {/* adaLN MLP */}
          <rect x="40" y="235" width="220" height="64" rx="7" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="150" y="258" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            adaLN MLP
          </text>
          <text x="150" y="278" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            pool(t, caption) &rarr; &gamma;, &beta;
          </text>

          {/* timestep + caption inputs */}
          <rect x="40" y="350" width="80" height="42" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="80" y="371" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            timestep t
          </text>
          <rect x="136" y="350" width="124" height="42" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="198" y="365" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            caption
          </text>
          <text x="198" y="381" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            text prompt
          </text>
          <line x1="80" y1="350" x2="80" y2="301" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="198" y1="350" x2="198" y2="301" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />

          {/* adaLN modulation path (red) into the block's norm */}
          <path d="M260,267 H360 V318 H403" fill="none" stroke="#8a2b2b" strokeWidth="1.5" markerEnd="url(#dit-arrow-red)" />
          <rect x="276" y="248" width="70" height="16" fill="#f7f4ea" />
          <text x="311" y="257" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#8a2b2b">
            adaLN &gamma;,&beta;
          </text>

          {/* ───────── DiT block container ───────── */}
          <rect x="340" y="118" width="450" height="287" rx="10" fill="#ffffff" fillOpacity="0.55" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="360" y="132" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            DiT block
          </text>
          <text transform="rotate(-90 776 262)" x="776" y="262" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            stacked &times; N
          </text>

          {/* two input streams (own projections) */}
          <rect x="405" y="352" width="130" height="38" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="470" y="366" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            image tokens
          </text>
          <text x="470" y="381" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#4a4a4a">
            own proj
          </text>
          <rect x="625" y="352" width="130" height="38" rx="7" fill="#e0d4f0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="690" y="366" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            text tokens
          </text>
          <text x="690" y="381" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#4a4a4a">
            own proj
          </text>

          {/* adaLN-Norm (modulated) */}
          <rect x="405" y="300" width="350" height="36" rx="7" fill="#f5eec0" stroke="#8a2b2b" strokeWidth="1.5" />
          <text x="580" y="318" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
            adaLN-Norm &middot; scale &gamma;, shift &beta;
          </text>

          {/* joint self-attention */}
          <rect x="405" y="214" width="350" height="64" rx="8" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="580" y="238" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            Joint Self-Attention
          </text>
          <text x="580" y="258" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#4a4a4a">
            image + text tokens attend together
          </text>

          {/* per-stream MLP */}
          <rect x="405" y="150" width="130" height="42" rx="7" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="470" y="167" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            MLP
          </text>
          <text x="470" y="181" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#4a4a4a">
            per-token
          </text>
          <rect x="625" y="150" width="130" height="42" rx="7" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="690" y="167" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            MLP
          </text>
          <text x="690" y="181" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#4a4a4a">
            per-token
          </text>

          {/* internal flow arrows */}
          <line x1="470" y1="352" x2="470" y2="338" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="690" y1="352" x2="690" y2="338" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="470" y1="300" x2="470" y2="280" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="690" y1="300" x2="690" y2="280" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="470" y1="214" x2="470" y2="194" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="690" y1="214" x2="690" y2="194" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />

          {/* image stream out -> epsilon; text stream carried on */}
          <line x1="470" y1="150" x2="470" y2="92" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <line x1="690" y1="150" x2="690" y2="124" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <text x="690" y="110" textAnchor="middle" dominantBaseline="central" fontSize="8" fill="#6b6b6b">
            to next block
          </text>

          {/* ───────── output: predicted noise ───────── */}
          <rect x="410" y="44" width="120" height="48" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="470" y="60" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            predicted noise
          </text>
          <text x="470" y="76" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            = &epsilon; (output)
          </text>

          {/* ───────── inputs from below: patchify + noisy latent ───────── */}
          <line x1="470" y1="435" x2="470" y2="392" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <rect x="400" y="435" width="140" height="43" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="470" y="451" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            Patchify + Embed
          </text>
          <text x="470" y="467" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            patches &rarr; tokens
          </text>
          <line x1="470" y1="505" x2="470" y2="480" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />

          {/* text tokens come from the caption sequence */}
          <line x1="690" y1="420" x2="690" y2="392" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#dit-arrow)" />
          <text x="690" y="433" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            caption tokens
          </text>

          {/* noisy latent as a 3x3 grid of patches */}
          <rect x="414" y="505" width="112" height="112" rx="8" fill="#efece3" fillOpacity="0.5" stroke="#2a2a2a" strokeWidth="1.3" />
          {[513, 547, 581].map((cy, r) =>
            [422, 456, 490].map((cx, c) => (
              <rect
                key={`p-${r}-${c}`}
                x={cx}
                y={cy}
                width="28"
                height="28"
                rx="4"
                fill={(r + c) % 2 === 0 ? "#d9e2ef" : "#e8e2d6"}
                stroke="#2a2a2a"
                strokeWidth="1"
              />
            )),
          )}
          <text x="540" y="548" textAnchor="start" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
            noisy latent z_t
          </text>
          <text x="540" y="564" textAnchor="start" dominantBaseline="central" fontSize="9" fill="#6b6b6b">
            (3&times;3 patches)
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A Diffusion Transformer denoises image latents by treating patches as tokens: a stack of blocks predicts the
          noise <em>&epsilon;</em>, while the timestep and caption are pooled through a small MLP that
          <em> adaptively modulates</em> each block&rsquo;s norm (adaLN). In the MMDiT variant, image and text tokens keep
          separate projections but mix through one <em>joint</em> self-attention.
        </p>
      </div>
    </figure>
  )
}
