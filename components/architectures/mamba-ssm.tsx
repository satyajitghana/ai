"use client"

// Mamba / selective state space model (SSM), drawn distill-style on its own light
// "paper" card so the pastel boxes + dark text read in both site themes. The figure
// is a RECURRENT SCAN over time: four steps t=1..4, each carrying a constant-size
// state box hₜ left -> right via hₜ = Āₜ·hₜ₋₁ + B̄ₜ·xₜ. Inputs xₜ enter from below,
// outputs yₜ = Cₜ·hₜ leave above. The "selective" twist: the transition parameters
// (Δ, B, C) are computed from xₜ (input-dependent) — that is the red path.

const STEPS = [
  { cx: 135, x: "x₁", h: "h₁", y: "y₁" },
  { cx: 305, x: "x₂", h: "h₂", y: "y₂" },
  { cx: 475, x: "x₃", h: "h₃", y: "y₃" },
  { cx: 645, x: "x₄", h: "h₄", y: "y₄" },
]

// midpoints of the three inter-state gaps, for the recurrence (Ā) labels
const GAPS = [220, 390, 560]

export function MambaSsm() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        selective state space model (mamba) &middot; recurrent scan
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 470"
          className="w-full"
          role="img"
          aria-label="A selective state space model (Mamba) drawn as a recurrent scan over four time steps. At each step an input x_t enters from below, passes through a small selective gate that computes the input-dependent parameters Delta, B and C, and updates a constant-size state h_t via the recurrence h_t equals A-bar_t times h_{t-1} plus B-bar_t times x_t. Each state is carried left to right to the next step, and produces an output y_t equals C_t times h_t above. The state boxes are all the same size to convey fixed memory."
        >
          <defs>
            <marker id="mamba-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
            <marker id="mamba-arrow-red" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#8a2b2b" />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="470" rx="10" fill="#f7f4ea" />

          {/* ---- top: the two update rules ---- */}
          <text x="390" y="34" textAnchor="middle" fontSize="12.5" fill="#2a2a2a">
            state&nbsp;&nbsp;h&#8348; = &#256;&#8348;&#8201;h&#8348;&#8331;&#8321; + B&#772;&#8348;&#8201;x&#8348;
          </text>
          <text x="390" y="52" textAnchor="middle" fontSize="12.5" fill="#2a2a2a">
            output&nbsp;&nbsp;y&#8348; = C&#8348;&#8201;h&#8348;
          </text>

          {/* ---- initial state h0 feeding the scan ---- */}
          <text x="72" y="213" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            h&#8320;=0
          </text>
          <line x1="86" y1="213" x2="98" y2="213" stroke="#2a2a2a" strokeWidth="1.4" markerEnd="url(#mamba-arrow)" />

          {/* ---- horizontal recurrence between states (the Ā·hₜ₋₁ carry) ---- */}
          <line x1="171" y1="213" x2="268" y2="213" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mamba-arrow)" />
          <line x1="341" y1="213" x2="438" y2="213" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mamba-arrow)" />
          <line x1="511" y1="213" x2="608" y2="213" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mamba-arrow)" />
          {GAPS.map((mx) => (
            <g key={`ab-${mx}`}>
              <rect x={mx - 15} y="197" width="30" height="14" fill="#f7f4ea" />
              <text x={mx} y="204" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#4a4a4a">
                &#256;&#8348;
              </text>
            </g>
          ))}

          {/* ---- per-step column: input -> selective gate -> state -> output ---- */}
          {STEPS.map((s) => (
            <g key={s.h}>
              {/* input xₜ (from below) */}
              <rect x={s.cx - 30} y="392" width="60" height="38" rx="7" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
              <text x={s.cx} y="411" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
                {s.x}
              </text>
              <line x1={s.cx} y1="390" x2={s.cx} y2="346" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mamba-arrow)" />

              {/* selective gate: computes Δ,B,C from xₜ */}
              <rect x={s.cx - 42} y="300" width="84" height="44" rx="7" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
              <text x={s.cx} y="315" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">
                select
              </text>
              <text x={s.cx} y="331" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
                &#916;, B, C
              </text>
              {/* input-dependent parameters feeding the state (special red path) */}
              <line x1={s.cx} y1="298" x2={s.cx} y2="238" stroke="#8a2b2b" strokeWidth="1.6" markerEnd="url(#mamba-arrow-red)" />

              {/* constant-size state hₜ */}
              <rect x={s.cx - 35} y="190" width="70" height="46" rx="7" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.5" />
              <text x={s.cx} y="213" textAnchor="middle" dominantBaseline="central" fontSize="13" fill="#2a2a2a">
                {s.h}
              </text>

              {/* output yₜ = Cₜ hₜ (leaving above) */}
              <line x1={s.cx} y1="188" x2={s.cx} y2="108" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#mamba-arrow)" />
              <rect x={s.cx - 30} y="66" width="60" height="40" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
              <text x={s.cx} y="86" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
                {s.y}
              </text>
            </g>
          ))}

          {/* ---- selective-parameter annotation (beside the first red path) ---- */}
          <rect x="150" y="258" width="82" height="30" fill="#f7f4ea" />
          <text x="152" y="266" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#8a2b2b">
            &#916;, B, C &#8592; x&#8348;
          </text>
          <text x="152" y="280" textAnchor="start" dominantBaseline="central" fontSize="8.5" fill="#8a2b2b">
            (input-selective)
          </text>

          {/* ---- required tagline ---- */}
          <text x="390" y="450" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill="#6b6b6b">
            linear-time recurrence &middot; input-selective &middot; attention-free
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Instead of attending over the whole sequence, Mamba <em>scans</em> it: a single fixed-size state is carried
          step to step by a linear recurrence, and the transition parameters (<span style={{ color: "#8a2b2b" }}>&#916;,&nbsp;B,&nbsp;C</span>)
          are computed <em>from the input</em> &mdash; so the model can selectively remember or forget while staying linear in length.
        </p>
      </div>
    </figure>
  )
}
