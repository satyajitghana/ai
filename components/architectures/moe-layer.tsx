"use client"

// A Mixture-of-Experts FFN layer, distill-style on its own light "paper" card so
// the pastel boxes stay readable in both site themes. A token's hidden vector hits
// a Router that softmaxes over the experts and keeps the top-2 (highlighted blue);
// an always-on shared expert (green) also runs; the rest stay grey/idle. The active
// experts' outputs are gate-weighted and summed into the new hidden vector.

const EXPERTS = [
  { cx: 102, label: "Shared", sub: "always on", kind: "shared" as const },
  { cx: 188, label: "E1", sub: "idle", kind: "idle" as const },
  { cx: 274, label: "E2", sub: "g = 0.66", kind: "active" as const },
  { cx: 360, label: "E3", sub: "idle", kind: "idle" as const },
  { cx: 446, label: "E4", sub: "idle", kind: "idle" as const },
  { cx: 532, label: "E5", sub: "g = 0.34", kind: "active" as const },
  { cx: 618, label: "E6", sub: "idle", kind: "idle" as const },
]

const FILL = { shared: "#cfe8cf", active: "#cfe0f5", idle: "#e6e3da" }
const GATE = { shared: "#4a7a4a", active: "#3f6aa8", idle: "#9a968c" }

export function MoeLayer() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        mixture-of-experts FFN layer &middot; router picks top-2
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 720 580"
          className="w-full"
          role="img"
          aria-label="A Mixture-of-Experts feed-forward layer. A token hidden vector feeds a router that applies a softmax and selects the top-2 of six routed experts (E2 and E5, highlighted). An always-on shared expert also runs. The active experts' outputs are weighted by their gate values and summed into the output hidden vector, while idle experts are greyed out."
        >
          <defs>
            <marker id="moe-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="720" height="580" rx="14" fill="#f7f4ea" />

          {/* legend */}
          <g>
            <rect x="560" y="40" width="13" height="13" rx="3" fill={FILL.shared} stroke="#2a2a2a" strokeWidth="1" />
            <text x="580" y="47" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#2a2a2a">shared (always-on)</text>
            <rect x="560" y="62" width="13" height="13" rx="3" fill={FILL.active} stroke="#2a2a2a" strokeWidth="1" />
            <text x="580" y="69" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#2a2a2a">routed, top-2</text>
            <rect x="560" y="84" width="13" height="13" rx="3" fill={FILL.idle} stroke="#b8b4a8" strokeWidth="1" />
            <text x="580" y="91" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#8a877e">idle (not selected)</text>
          </g>

          {/* ---- output ---- */}
          <rect x="300" y="76" width="120" height="40" rx="7" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="360" y="96" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">MoE output</text>

          {/* ---- weighted sum ---- */}
          <circle cx="360" cy="168" r="15" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="350" y1="168" x2="370" y2="168" stroke="#2a2a2a" strokeWidth="1.5" />
          <line x1="360" y1="158" x2="360" y2="178" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="384" y="168" textAnchor="start" dominantBaseline="central" fontSize="11" fill="#2a2a2a">gated weighted sum</text>
          <line x1="360" y1="153" x2="360" y2="120" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#moe-arrow)" />

          {/* ---- active experts -> weighted sum ---- */}
          {EXPERTS.filter((e) => e.kind !== "idle").map((e) => (
            <line
              key={`up-${e.label}`}
              x1={e.cx}
              y1="250"
              x2="360"
              y2="182"
              stroke={GATE[e.kind]}
              strokeWidth="1.6"
              markerEnd="url(#moe-arrow)"
            />
          ))}

          {/* section label */}
          <text x="360" y="230" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
            experts (each a small FFN)
          </text>

          {/* ---- expert boxes ---- */}
          {EXPERTS.map((e) => (
            <g key={e.label}>
              <rect
                x={e.cx - 37}
                y="250"
                width="74"
                height="88"
                rx="8"
                fill={FILL[e.kind]}
                stroke={e.kind === "idle" ? "#b8b4a8" : "#2a2a2a"}
                strokeWidth="1.5"
                opacity={e.kind === "idle" ? 0.7 : 1}
              />
              <text
                x={e.cx}
                y="286"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fill={e.kind === "idle" ? "#8a877e" : "#2a2a2a"}
              >
                {e.label}
              </text>
              <text
                x={e.cx}
                y="308"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fill={e.kind === "idle" ? "#8a877e" : "#4a4a4a"}
              >
                FFN
              </text>
              <text
                x={e.cx}
                y="242"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fill={e.kind === "idle" ? "#a5a196" : GATE[e.kind]}
              >
                {e.sub}
              </text>
            </g>
          ))}

          {/* ---- router -> experts (gate lines) ---- */}
          {EXPERTS.map((e) => (
            <line
              key={`gate-${e.label}`}
              x1="360"
              y1="430"
              x2={e.cx}
              y2="338"
              stroke={GATE[e.kind]}
              strokeWidth={e.kind === "idle" ? 1 : 1.6}
              strokeDasharray={e.kind === "idle" ? "3 3" : undefined}
              opacity={e.kind === "idle" ? 0.55 : 1}
              markerEnd={e.kind === "idle" ? undefined : "url(#moe-arrow)"}
            />
          ))}

          {/* ---- router ---- */}
          <rect x="250" y="430" width="220" height="46" rx="7" fill="#f5eec0" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="360" y="446" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">Router</text>
          <text x="360" y="462" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#4a4a4a">
            linear &rarr; softmax &rarr; keep top-2
          </text>
          <line x1="360" y1="498" x2="360" y2="478" stroke="#2a2a2a" strokeWidth="1.5" markerEnd="url(#moe-arrow)" />

          {/* ---- input hidden vector ---- */}
          <rect x="300" y="498" width="120" height="40" rx="7" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.5" />
          <text x="360" y="518" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">h &middot; token</text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only the <span style={{ color: GATE.active }}>top-2 routed experts</span> (plus an
          <span style={{ color: GATE.shared }}> always-on shared expert</span>) fire for any given token, so a layer
          can hold a huge pile of parameters while each token pays the compute of just a few small FFNs.
        </p>
      </div>
    </figure>
  )
}
