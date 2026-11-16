"use client"

// Latent mixture-of-experts, on the gallery's paper card. The router still
// reads the full-width token, but the routed experts work in a narrower latent:
// one shared down-projection in front of them, one up-projection (after an
// RMSNorm) behind them, and any shared expert stays at full width. The plain
// MoE figure draws routing; this one draws where the width changes. All
// coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const GREEN = "#cfe8cf"
const RED = "#8a2b2b"

// a 4 x 6 grid of routed experts; four are chosen for this token
const LIT = new Set([3, 8, 14, 21])
const EXPERTS = Array.from({ length: 24 }, (_, i) => i)

export function LatentMoe() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        latent mixture-of-experts &middot; route at full width, compute the experts in a narrower latent
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 420"
          className="w-full"
          role="img"
          aria-label="A token of width d goes three ways. The router reads it at full width and picks k routed experts. A shared down-projection maps the token from width d to a narrower latent width l, the chosen experts each run a gated feed-forward network inside that latent, their weighted sum is normalised and mapped back up from l to d, and the result is added to the output of a shared expert that works at full width. Each routed expert is smaller because its input and output are l wide, not d wide."
        >
          <defs>
            <marker id="lm-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="lm-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="420" rx="10" fill={PAPER} />

          <text x="390" y="30" textAnchor="middle" fontSize="12" fill={INK}>
            y = shared(x) + W&#8593; RMSNorm( &#931;&#7522; p&#7522; E&#7522;( W&#8595; x ) )
          </text>

          {/* token */}
          <rect x="24" y="196" width="96" height="46" rx="7" fill="#efece3" stroke={INK} strokeWidth="1.5" />
          <text x="72" y="212" textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
            token x
          </text>
          <text x="72" y="229" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            width d
          </text>

          {/* router at full width */}
          <path d="M 72 194 L 72 96 L 136 96" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#lm-a)" />
          <rect x="140" y="74" width="130" height="44" rx="7" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="205" y="90" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            router
          </text>
          <text x="205" y="106" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            reads all d, picks k
          </text>
          <path d="M 270 96 L 420 96 L 420 128" fill="none" stroke={RED} strokeWidth="1.4" strokeDasharray="4 3" markerEnd="url(#lm-r)" />

          {/* down-projection */}
          <line x1="120" y1="219" x2="166" y2="219" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />
          <path d="M 170 190 L 250 204 L 250 234 L 170 248 Z" fill={BLUE} stroke={INK} strokeWidth="1.4" />
          <text x="207" y="214" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            W&#8595;
          </text>
          <text x="207" y="229" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill={INK}>
            d &rarr; &#8467;
          </text>
          <line x1="250" y1="219" x2="300" y2="219" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />

          {/* routed experts in the latent */}
          <rect x="304" y="132" width="232" height="174" rx="8" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="5 4" />
          <text x="420" y="324" textAnchor="middle" fontSize="10.5" fill={INK}>
            routed experts, each &#8467; &rarr; f &rarr; &#8467;
          </text>
          {EXPERTS.map((i) => (
            <rect
              key={i}
              x={316 + (i % 6) * 36}
              y={144 + Math.floor(i / 6) * 40}
              width="28"
              height="30"
              rx="4"
              fill={LIT.has(i) ? GREEN : "#ffffff"}
              stroke={LIT.has(i) ? RED : INK}
              strokeWidth={LIT.has(i) ? 1.8 : 0.9}
            />
          ))}

          {/* sum, norm, up-projection */}
          <line x1="536" y1="219" x2="560" y2="219" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />
          <circle cx="576" cy="219" r="12" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
          <text x="576" y="220" textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
            &#931;
          </text>
          <line x1="588" y1="219" x2="606" y2="219" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />
          <path d="M 610 204 L 690 190 L 690 248 L 610 234 Z" fill={BLUE} stroke={INK} strokeWidth="1.4" />
          <text x="652" y="214" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            W&#8593;
          </text>
          <text x="652" y="229" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill={INK}>
            &#8467; &rarr; d
          </text>
          <text x="650" y="178" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            after RMSNorm
          </text>

          {/* shared expert at full width */}
          <path d="M 72 244 L 72 372 L 300 372" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#lm-a)" />
          <rect x="304" y="350" width="232" height="44" rx="7" fill={SALMON} stroke={INK} strokeWidth="1.4" />
          <text x="420" y="366" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            shared expert
          </text>
          <text x="420" y="382" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            full width d, every token
          </text>

          {/* add and out */}
          <circle cx="730" cy="219" r="11" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
          <text x="730" y="220" textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
            +
          </text>
          <line x1="690" y1="219" x2="716" y2="219" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />
          <path d="M 536 372 L 730 372 L 730 234" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#lm-a)" />
          <line x1="730" y1="208" x2="730" y2="150" stroke={INK} strokeWidth="1.5" markerEnd="url(#lm-a)" />
          <text x="730" y="140" textAnchor="middle" fontSize="11" fill={INK}>
            y
          </text>

          <text x="420" y="58" textAnchor="middle" fontSize="10.5" fill={RED}>
            expert weights and dispatch traffic scale with &#8467;, not d
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The router still sees the whole token, but the routed experts never do: one down-projection, shared by all of them,
          maps the token into a narrower latent of width &#8467;, and one up-projection maps the weighted sum back. A routed
          expert shrinks from 3&middot;d&middot;f weights to 3&middot;&#8467;&middot;f, so a layer can hold and route to more of
          them. The price is the two projections, which are dense and run for every token.
        </p>
      </div>
    </figure>
  )
}
