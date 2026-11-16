"use client"

// Hashed n-gram memory (DeepSeek's Engram; Qwen's n-gram embedding), on the
// gallery's paper card. The last few token ids are hashed, the hash is reduced
// modulo a different prime for each head, each head fetches one row of a huge
// table that is only ever indexed, and the concatenated rows are gated by the
// hidden state and added into the residual stream at one layer. All
// coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const GREEN = "#cfe8cf"
const RED = "#8a2b2b"

const TOKENS = [
  { x: 24, t: "the" },
  { x: 82, t: "cat" },
  { x: 140, t: "sat" },
  { x: 198, t: "on" },
]

// one probe per head: head label, its y, and the table row it lands on
const HEADS = [
  { y: 118, label: "mod p₁", row: 116 },
  { y: 166, label: "mod p₂", row: 262 },
  { y: 214, label: "mod p₃", row: 180 },
  { y: 262, label: "⋮", row: -1 },
]

export function NgramMemory() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        hashed n-gram memory &middot; a lookup table beside the layers, read by hashing the last few tokens
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 420"
          className="w-full"
          role="img"
          aria-label="The last few token ids, here the bigram sat on and the trigram cat sat on, are hashed. The hash is reduced modulo a different prime for each of H heads, and each head fetches one row from a very large table that is never multiplied, only indexed, and can live in CPU memory or on disk. The fetched rows are concatenated into one vector, gated by the current hidden state, and added into the residual stream at one layer."
        >
          <defs>
            <marker id="ng-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="ng-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
            <pattern id="ng-rows" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M 0 7.5 H 8" stroke="#cfc8b4" strokeWidth="0.8" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="780" height="420" rx="10" fill={PAPER} />

          {/* tokens and the n-grams ending at the current one */}
          {TOKENS.map((k) => (
            <g key={k.t}>
              <rect x={k.x} y="44" width="52" height="28" rx="5" fill={k.t === "the" ? "#efece3" : BLUE} stroke={INK} strokeWidth="1.3" />
              <text x={k.x + 26} y="58" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill={INK}>
                {k.t}
              </text>
            </g>
          ))}
          <path d="M 140 80 L 140 86 L 250 86 L 250 80" fill="none" stroke={INK} strokeWidth="1.2" />
          <text x="195" y="99" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            2-gram
          </text>
          <path d="M 82 106 L 82 112 L 250 112 L 250 106" fill="none" stroke={INK} strokeWidth="1.2" />
          <text x="166" y="125" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            3-gram
          </text>

          <line x1="137" y1="130" x2="137" y2="160" stroke={INK} strokeWidth="1.4" markerEnd="url(#ng-a)" />
          <rect x="52" y="164" width="170" height="44" rx="7" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="137" y="180" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            hash the token ids
          </text>
          <text x="137" y="196" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            fixed odd multipliers
          </text>

          {/* fan out to heads, each with its own prime */}
          {HEADS.map((h) => (
            <g key={h.y}>
              {h.row >= 0 ? (
                <g>
                  <path d={`M 222 186 C 240 186, 240 ${h.y}, 262 ${h.y}`} fill="none" stroke={INK} strokeWidth="1.2" markerEnd="url(#ng-a)" />
                  <rect x="266" y={h.y - 15} width="70" height="30" rx="6" fill={YELLOW} stroke={INK} strokeWidth="1.3" />
                  <text x="301" y={h.y} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
                    {h.label}
                  </text>
                  <path d={`M 336 ${h.y} C 360 ${h.y}, 360 ${h.row}, 384 ${h.row}`} fill="none" stroke={RED} strokeWidth="1.3" markerEnd="url(#ng-r)" />
                </g>
              ) : (
                <text x="301" y={h.y} textAnchor="middle" dominantBaseline="central" fontSize="14" fill={INK}>
                  {h.label}
                </text>
              )}
            </g>
          ))}
          <text x="301" y="306" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            one prime per head:
          </text>
          <text x="301" y="319" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            unrelated collisions
          </text>

          {/* the table */}
          <rect x="388" y="70" width="96" height="260" fill={GREEN} stroke={INK} strokeWidth="1.4" />
          <rect x="388" y="70" width="96" height="260" fill="url(#ng-rows)" />
          {[116, 180, 262].map((y) => (
            <rect key={y} x="388" y={y - 4} width="96" height="8" fill={SALMON} stroke={RED} strokeWidth="1.3" />
          ))}
          <text x="436" y="52" textAnchor="middle" fontSize="11.5" fontWeight="600" fill={INK}>
            the table
          </text>
          <text x="436" y="348" textAnchor="middle" fontSize="10" fill={INK}>
            millions of rows
          </text>
          <text x="436" y="362" textAnchor="middle" fontSize="10" fill={INK}>
            indexed, never multiplied
          </text>
          <text x="436" y="376" textAnchor="middle" fontSize="10" fill={RED}>
            can sit in CPU RAM or on NVMe
          </text>

          {/* concatenate the rows */}
          <path d="M 484 116 C 510 116, 510 190, 530 196" fill="none" stroke={RED} strokeWidth="1.2" />
          <path d="M 484 180 C 506 180, 512 200, 530 202" fill="none" stroke={RED} strokeWidth="1.2" />
          <path d="M 484 262 C 510 262, 510 214, 530 208" fill="none" stroke={RED} strokeWidth="1.2" markerEnd="url(#ng-r)" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={534 + i * 22} y="190" width="22" height="24" fill={i === 2 ? "#efece3" : SALMON} stroke={INK} strokeWidth="1.1" />
          ))}
          <text x="578" y="180" textAnchor="middle" fontSize="10" fill={INK}>
            concatenated rows e
          </text>

          {/* gate and add into the residual stream */}
          <line x1="578" y1="216" x2="578" y2="270" stroke={INK} strokeWidth="1.4" markerEnd="url(#ng-a)" />
          <rect x="520" y="274" width="116" height="46" rx="7" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="578" y="290" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            gate
          </text>
          <text x="578" y="306" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            by the hidden state
          </text>

          <line x1="716" y1="396" x2="716" y2="48" stroke={INK} strokeWidth="1.6" markerEnd="url(#ng-a)" />
          <text x="716" y="38" textAnchor="middle" fontSize="10.5" fill="#6b6b6b">
            residual stream
          </text>
          <rect x="676" y="126" width="80" height="32" rx="6" fill={BLUE} stroke={INK} strokeWidth="1.4" />
          <text x="716" y="142" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
            layer &#8467;
          </text>
          <circle cx="716" cy="230" r="11" fill="#ffffff" stroke={INK} strokeWidth="1.4" />
          <text x="716" y="231" textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
            +
          </text>
          <path d="M 636 297 L 690 297 L 708 238" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#ng-a)" />
          <path d="M 716 350 L 660 350 L 600 322" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="4 3" markerEnd="url(#ng-a)" />
          <text x="666" y="366" textAnchor="middle" fontSize="9.5" fill="#6b6b6b">
            hidden state
          </text>

          <text x="390" y="406" textAnchor="middle" fontSize="11.5" fill="#6b6b6b">
            parameters that cost a gather, not a matmul
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The last few token ids are hashed, and each head reduces the hash modulo{" "}
          <span style={{ color: RED }}>its own prime</span>{" "}to pick one row of a very large table. Two n-grams that collide
          under one prime almost never collide under another, so the concatenated rows still identify the phrase. A gate
          computed from the hidden state decides how much of that memory enters the residual stream, at one layer or a few.
        </p>
      </div>
    </figure>
  )
}
