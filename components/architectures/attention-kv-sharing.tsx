"use client"

// KV-head sharing across MHA -> MQA -> GQA -> MLA, drawn distill-style on a light
// "paper" card so pastels read in both site themes. Every panel has the same 8
// query heads (blue) up top; what changes is how many Key/Value heads (salmon)
// sit below them: MHA gives each query its own KV, MQA shares one, GQA shares a
// handful in groups, MLA keeps a single compressed latent that is up-projected on
// the fly. Fewer KV heads = a smaller per-token KV cache (the bar at the bottom).

type Variant = "MHA" | "MQA" | "GQA" | "MLA"

const PANEL_X = [12, 188, 364, 540]
const PANEL_W = 166

const PANELS: {
  v: Variant
  sub: string
  kvLabel: string
  kvNote?: string
  cache: string
  fill: number
  costly: boolean
}[] = [
  { v: "MHA", sub: "8 Q, 8 KV (1:1)", kvLabel: "8 KV heads", cache: "8x cache", fill: 120, costly: true },
  { v: "MQA", sub: "8 Q, 1 KV", kvLabel: "1 shared KV", cache: "1x cache", fill: 15, costly: false },
  { v: "GQA", sub: "8 Q, 2 KV groups", kvLabel: "2 KV groups", cache: "2x cache", fill: 30, costly: false },
  { v: "MLA", sub: "8 Q, latent KV", kvLabel: "compressed latent c", kvNote: "up-projected to K, V", cache: "tiny (latent)", fill: 20, costly: false },
]

const qcx = (px: number, i: number) => px + 20 + i * 18
const HEADS = [0, 1, 2, 3, 4, 5, 6, 7]

export function AttentionKvSharing() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        KV-head sharing &middot; MHA &rarr; MQA &rarr; GQA &rarr; MLA
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 720 430"
          className="w-full"
          role="img"
          aria-label="A comparison of KV-head sharing across four attention variants, each with eight query heads. MHA has eight matching Key/Value heads (largest cache). MQA shares a single KV head across all queries. GQA shares two KV heads across two groups of four queries. MLA stores one small compressed latent that is up-projected into keys and values. Fewer KV heads mean a smaller per-token KV cache, shown as a bar under each panel."
        >
          <defs>
            <marker id="kv-arrow" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="720" height="430" rx="14" fill="#f7f4ea" />

          <text x="360" y="26" textAnchor="middle" dominantBaseline="central" fontSize="12" fill="#2a2a2a">
            8 query heads (blue) share ever-fewer Key/Value heads (salmon) &mdash; shrinking the KV cache
          </text>

          {PANELS.map((p, pi) => {
            const px = PANEL_X[pi]
            const cx = px + 83
            const g0 = px + 47
            const g1 = px + 119
            return (
              <g key={p.v}>
                {/* panel card */}
                <rect x={px} y="44" width={PANEL_W} height="340" rx="10" fill="#fbf9f2" stroke="#d8d4c8" strokeWidth="1" />

                {/* title + subtitle */}
                <text x={cx} y="66" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="600" fill="#2a2a2a">
                  {p.v}
                </text>
                <text x={cx} y="83" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#6b6b6b">
                  {p.sub}
                </text>

                {/* query heads */}
                {HEADS.map((i) => (
                  <rect key={`q-${i}`} x={px + 14 + i * 18} y="98" width="12" height="22" rx="3" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1" />
                ))}
                <text x={cx} y="134" textAnchor="middle" dominantBaseline="central" fontSize="9.5" fill="#6b6b6b">
                  8 query heads
                </text>

                {/* connections + KV heads, per variant */}
                {p.v === "MHA" && (
                  <>
                    {HEADS.map((i) => (
                      <line key={`l-${i}`} x1={qcx(px, i)} y1="120" x2={qcx(px, i)} y2="238" stroke="#2a2a2a" strokeWidth="1" opacity="0.4" />
                    ))}
                    {HEADS.map((i) => (
                      <rect key={`kv-${i}`} x={px + 14 + i * 18} y="238" width="12" height="28" rx="3" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1" />
                    ))}
                  </>
                )}

                {p.v === "MQA" && (
                  <>
                    {HEADS.map((i) => (
                      <line key={`l-${i}`} x1={qcx(px, i)} y1="120" x2={cx} y2="238" stroke="#2a2a2a" strokeWidth="1" opacity="0.4" />
                    ))}
                    <rect x={cx - 22} y="238" width="44" height="28" rx="5" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
                    <text x={cx} y="252" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">KV</text>
                  </>
                )}

                {p.v === "GQA" && (
                  <>
                    {HEADS.map((i) => (
                      <line
                        key={`l-${i}`}
                        x1={qcx(px, i)}
                        y1="120"
                        x2={i < 4 ? g0 : g1}
                        y2="238"
                        stroke={i < 4 ? "#3f6aa8" : "#8a5db1"}
                        strokeWidth="1"
                        opacity="0.55"
                      />
                    ))}
                    <rect x={g0 - 27} y="238" width="54" height="28" rx="5" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
                    <rect x={g1 - 27} y="238" width="54" height="28" rx="5" fill="#f5cfcf" stroke="#2a2a2a" strokeWidth="1.5" />
                    <text x={g0} y="252" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#2a2a2a">KV g1</text>
                    <text x={g1} y="252" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#2a2a2a">KV g2</text>
                  </>
                )}

                {p.v === "MLA" && (
                  <>
                    {HEADS.map((i) => (
                      <line key={`l-${i}`} x1={qcx(px, i)} y1="120" x2={cx} y2="240" stroke="#2a2a2a" strokeWidth="1" opacity="0.4" />
                    ))}
                    <rect x={cx - 27} y="240" width="54" height="24" rx="5" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1.5" />
                    <text x={cx} y="252" textAnchor="middle" dominantBaseline="central" fontSize="11" fill="#2a2a2a">c</text>
                  </>
                )}

                {/* KV label */}
                <text x={cx} y="284" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
                  {p.kvLabel}
                </text>
                {p.kvNote && (
                  <text x={cx} y="298" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#6b6b6b">
                    {p.kvNote}
                  </text>
                )}

                {/* cache-size bar */}
                <text x={cx} y="316" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#8a877e">
                  KV cache size
                </text>
                <rect x={px + 23} y="324" width="120" height="12" rx="6" fill="#e6e3da" />
                <rect x={px + 23} y="324" width={p.fill} height="12" rx="6" fill={p.costly ? "#e6a3a0" : "#a9d3a9"} />
                <text
                  x={cx}
                  y="356"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="11"
                  fontWeight="600"
                  fill={p.costly ? "#b4524a" : "#4a7a4a"}
                >
                  {p.cache}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The queries never change &mdash; only the Key/Value side collapses. Going
          MHA &rarr; MQA &rarr; GQA &rarr; MLA folds many KV heads into few, or into a single compressed latent,
          shrinking the per-token KV cache that dominates memory at long context while keeping quality nearly intact.
        </p>
      </div>
    </figure>
  )
}
