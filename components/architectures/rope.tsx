"use client"

// Rotary Position Embedding (RoPE), drawn distill-style on a light "paper" card so
// it reads in both light and dark site themes. Top row: the SAME query/key vector at
// positions m = 1, 2, 3, each rotated by an angle that grows with position
// (theta = m * 25 degrees). Bottom: two tokens' rotated vectors in one plane; the
// red arc is the angle between them, which equals (m - n) * step. All rotated
// endpoints are precomputed to two decimals and hard-coded literals -- no runtime
// trig, Date, or randomness -- so the figure is deterministic and SSR-safe.
export function Rope() {
  const circles = [
    { cx: 160, tip: "209.85,146.76", arcEnd: "181.75,159.86", label: "m = 1 · 25°" },
    { cx: 380, tip: "415.35,127.87", arcEnd: "395.43,151.62", label: "m = 2 · 50°" },
    { cx: 600, tip: "614.24,116.87", arcEnd: "606.21,146.82", label: "m = 3 · 75°" },
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        rotary position embedding (rope) &middot; position = rotation
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 760 560"
          className="w-full"
          role="img"
          aria-label="Rotary Position Embedding. The top row shows the same query/key vector at positions one, two and three, each rotated by an angle proportional to its position: twenty-five, fifty and seventy-five degrees. The bottom shows two tokens' rotated vectors in a single plane; the red arc marks the angle between them, which equals the relative offset m minus n times the per-step angle. So the dot product used by attention depends only on the relative distance between positions, not on their absolute values."
        >
          <defs>
            <marker id="rope-arrow" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
            <marker id="rope-mut" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#9a968c" />
            </marker>
          </defs>

          <rect x="0" y="0" width="760" height="560" rx="10" fill="#f7f4ea" />

          {/* title */}
          <text x="380" y="44" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight={600} fill="#2a2a2a">
            position m rotates the query/key vector by an angle &prop; m
          </text>
          <text x="380" y="66" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#6b6b6b">
            the rotation grows with position &mdash; here &theta; = m &middot; 25&deg;
          </text>

          {/* ===== three position dials ===== */}
          {circles.map((c) => (
            <g key={c.cx}>
              <circle cx={c.cx} cy="170" r="68" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1.3" />
              {/* axes */}
              <line x1={c.cx - 60} y1="170" x2={c.cx + 60} y2="170" stroke="#b8b4a8" strokeWidth="1" />
              <line x1={c.cx} y1="110" x2={c.cx} y2="230" stroke="#b8b4a8" strokeWidth="1" />
              {/* base vector (position 0 reference) */}
              <line x1={c.cx} y1="170" x2={c.cx + 55} y2="170" stroke="#9a968c" strokeWidth="1.3" strokeDasharray="4 3" />
              {/* rotation arc */}
              <path d={`M${c.cx + 24},170 A24,24 0 0 0 ${c.arcEnd}`} fill="none" stroke="#8a2b2b" strokeWidth="1.4" />
              {/* rotated vector */}
              <line x1={c.cx} y1="170" x2={c.tip.split(",")[0]} y2={c.tip.split(",")[1]} stroke="#2a2a2a" strokeWidth="1.7" markerEnd="url(#rope-arrow)" />
              <circle cx={c.cx} cy="170" r="2.4" fill="#2a2a2a" />
              {/* label */}
              <text x={c.cx} y="262" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill="#2a2a2a">{c.label}</text>
            </g>
          ))}

          {/* increment hints between dials */}
          <line x1="234" y1="170" x2="306" y2="170" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#rope-mut)" />
          <text x="270" y="158" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#8a877e">+25&deg;</text>
          <line x1="454" y1="170" x2="526" y2="170" stroke="#9a968c" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#rope-mut)" />
          <text x="490" y="158" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#8a877e">+25&deg;</text>

          {/* divider */}
          <line x1="40" y1="292" x2="720" y2="292" stroke="#c8c3b6" strokeWidth="1" strokeDasharray="5 5" />

          {/* ===== relative-offset panel ===== */}
          <text x="380" y="314" textAnchor="middle" dominantBaseline="central" fontSize="12.5" fontWeight={600} fill="#2a2a2a">
            the dot product of two rotated vectors depends only on (m &minus; n)
          </text>

          {/* combined dial for two tokens */}
          <circle cx="200" cy="410" r="90" fill="#ffffff" stroke="#2a2a2a" strokeWidth="1.3" />
          <line x1="122" y1="410" x2="278" y2="410" stroke="#b8b4a8" strokeWidth="1" />
          <line x1="200" y1="332" x2="200" y2="488" stroke="#b8b4a8" strokeWidth="1" />
          {/* red angle-between arc (the special path) */}
          <path d="M238.06,392.25 A42,42 0 0 0 210.87,369.43" fill="none" stroke="#8a2b2b" strokeWidth="1.7" />
          <text x="252" y="404" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#8a2b2b">50&deg;</text>
          {/* k at position n = 1 (25 deg) */}
          <line x1="200" y1="410" x2="267.97" y2="378.30" stroke="#3f6aa8" strokeWidth="1.8" markerEnd="url(#rope-arrow)" />
          <text x="274" y="380" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#3f6aa8">k &middot; pos n</text>
          {/* q at position m = 3 (75 deg) */}
          <line x1="200" y1="410" x2="219.41" y2="337.56" stroke="#4a7a4a" strokeWidth="1.8" markerEnd="url(#rope-arrow)" />
          <text x="196" y="330" textAnchor="end" dominantBaseline="central" fontSize="10" fill="#4a7a4a">q &middot; pos m</text>
          <circle cx="200" cy="410" r="2.6" fill="#2a2a2a" />

          {/* explanation card */}
          <rect x="330" y="350" width="390" height="140" rx="10" fill="#efece3" stroke="#2a2a2a" strokeWidth="1.3" />
          <text x="350" y="384" textAnchor="start" dominantBaseline="central" fontSize="13" fontWeight={600} fill="#2a2a2a">
            attention sees only relative distance
          </text>
          <text x="350" y="414" textAnchor="start" dominantBaseline="central" fontSize="12.5" fontFamily="monospace" fill="#2a2a2a">
            &#x27e8; q(m), k(n) &#x27e9; = g(q, k, m &minus; n)
          </text>
          <text x="350" y="442" textAnchor="start" dominantBaseline="central" fontSize="11.5" fill="#4a4a4a">
            the score depends only on the relative offset
          </text>
          <text x="350" y="462" textAnchor="start" dominantBaseline="central" fontSize="11.5" fill="#4a4a4a">
            (m &minus; n) &mdash; never on absolute position m or n.
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          RoPE encodes a position by <em>rotating</em>{" "}each pair of feature dimensions by an angle proportional to
          that position. Because a dot product only cares about the angle <em>between</em>{" "}two vectors, attention
          ends up reading the relative distance <code>(m &minus; n)</code> for free.
        </p>
      </div>
    </figure>
  )
}
