"use client"

// Hyper-connections (and DeepSeek's manifold-constrained mHC), on the gallery's
// paper card. The residual stream is widened into N parallel streams. Around
// each sublayer three small maps act: H_pre reads the sublayer's input as a
// weighted sum of streams, H_post writes its output back with one weight per
// stream, and H_res mixes the streams with each other. mHC keeps H_res doubly
// stochastic. All coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const RED = "#8a2b2b"

const LANES = [168, 204, 240, 276] // y of the four streams

// a doubly stochastic 4x4 example: every row and every column sums to 1
const DS = [
  [0.7, 0.1, 0.1, 0.1],
  [0.1, 0.6, 0.2, 0.1],
  [0.1, 0.2, 0.6, 0.1],
  [0.1, 0.1, 0.1, 0.7],
]

export function HyperConnections() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        hyper-connections &middot; N residual streams, three small maps around each sublayer
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 430"
          className="w-full"
          role="img"
          aria-label="Four parallel residual streams run left to right. Before a sublayer, H pre reads one input vector from them as a weighted sum. The sublayer, attention or an MLP, runs once on that single vector. H post writes its output back into every stream with one weight per stream. Between the read and the write, H res mixes the four streams with each other. In mHC that mixing matrix is kept doubly stochastic: non-negative, with every row and column summing to one, shown as a small example matrix, so no product of them across depth can amplify the signal."
        >
          <defs>
            <marker id="hc-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="hc-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="430" rx="10" fill={PAPER} />

          <text x="390" y="30" textAnchor="middle" fontSize="12" fill={INK}>
            X&#8343;&#8330;&#8321; = H&#691;&#7497;&#738; X&#8343; + H&#7510;&#7506;&#738;&#7511; F( H&#7510;&#691;&#7497; X&#8343; )
          </text>

          {/* the streams */}
          {LANES.map((y, i) => (
            <g key={y}>
              <text x="34" y={y} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
                {`x${"₁₂₃₄"[i]}`}
              </text>
              <line x1="50" y1={y} x2="372" y2={y} stroke="#3a6ea5" strokeWidth="2" />
              <line x1="468" y1={y} x2="740" y2={y} stroke="#3a6ea5" strokeWidth="2" markerEnd="url(#hc-a)" />
            </g>
          ))}
          <text x="60" y="306" fontSize="10" fill="#6b6b6b">
            N = 4 streams, each the model&rsquo;s width
          </text>

          {/* H_pre: weighted read of all streams */}
          {LANES.map((y) => (
            <line key={`p${y}`} x1="150" y1={y} x2="190" y2="114" stroke={INK} strokeWidth="1" />
          ))}
          <rect x="148" y="86" width="84" height="28" rx="6" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="190" y="100" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
            H&#7510;&#691;&#7497; read
          </text>
          <line x1="232" y1="100" x2="292" y2="100" stroke={INK} strokeWidth="1.5" markerEnd="url(#hc-a)" />

          {/* the sublayer, run once */}
          <rect x="296" y="72" width="188" height="56" rx="8" fill={SALMON} stroke={INK} strokeWidth="1.5" />
          <text x="390" y="92" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="600" fill={INK}>
            F: attention or MLP
          </text>
          <text x="390" y="110" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            runs once, on one vector
          </text>
          <line x1="484" y1="100" x2="544" y2="100" stroke={INK} strokeWidth="1.5" markerEnd="url(#hc-a)" />

          {/* H_post: write back with one weight per stream */}
          <rect x="548" y="86" width="90" height="28" rx="6" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="593" y="100" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
            H&#7510;&#7506;&#738;&#7511; write
          </text>
          {LANES.map((y) => (
            <line key={`q${y}`} x1="593" y1="114" x2="640" y2={y - 3} stroke={INK} strokeWidth="1" markerEnd="url(#hc-a)" />
          ))}

          {/* H_res: mix the streams */}
          <rect x="372" y="148" width="96" height="148" rx="8" fill={BLUE} stroke={INK} strokeWidth="1.4" />
          {[
            [0, 1],
            [1, 0],
            [2, 3],
            [3, 2],
            [1, 2],
            [2, 1],
          ].map(([a, b]) => (
            <line key={`${a}${b}`} x1="380" y1={LANES[a]} x2="460" y2={LANES[b]} stroke="#3a6ea5" strokeWidth="1" opacity="0.7" />
          ))}
          <text x="420" y="320" textAnchor="middle" fontSize="11" fontWeight="600" fill={INK}>
            H&#691;&#7497;&#738; mixes streams
          </text>
          <text x="420" y="334" textAnchor="middle" fontSize="10" fill="#6b6b6b">
            an N &times; N matrix
          </text>

          {/* mHC constraint */}
          <line x1="560" y1="350" x2="560" y2="412" stroke="#d9d4c3" strokeWidth="1" />
          <text x="580" y="316" fontSize="11" fontWeight="600" fill={RED}>
            mHC: H&#691;&#7497;&#738; doubly stochastic
          </text>
          {DS.map((row, r) =>
            row.map((v, c) => (
              <g key={`${r}${c}`}>
                <rect x={600 + c * 30} y={330 + r * 18} width="30" height="18" fill="#3a6ea5" fillOpacity={v} stroke={INK} strokeWidth="0.6" />
                <text x={615 + c * 30} y={339 + r * 18} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={v > 0.5 ? "#ffffff" : INK}>
                  {v.toFixed(1)}
                </text>
              </g>
            )),
          )}
          <text x="580" y="416" fontSize="9.5" fill="#6b6b6b">
            rows and columns each sum to 1
          </text>
          <text x="60" y="372" fontSize="10.5" fill={INK}>
            Plain HC leaves H&#691;&#7497;&#738; free, so its product across many layers
          </text>
          <text x="60" y="388" fontSize="10.5" fill={INK}>
            can grow or shrink geometrically. A doubly stochastic matrix
          </text>
          <text x="60" y="404" fontSize="10.5" fill={INK}>
            cannot amplify, and neither can any product of them.
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The residual stream becomes N streams, but each sublayer still runs once on one vector, so its cost does not change.
          What is new is three tiny maps around it: a weighted read, a weighted write, and a{" "}
          <span style={{ color: "#3a6ea5" }}>stream mixer</span>. mHC constrains the mixer so that{" "}
          <span style={{ color: RED }}>rows and columns sum to one</span>, which restores the stability the identity path of a
          plain residual gave for free.
        </p>
      </div>
    </figure>
  )
}
