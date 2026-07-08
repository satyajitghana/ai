"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The second half of the lens: unembed( J·h ). After the Jacobian transports an
// activation into the final-layer basis, the model's own unembedding decodes it.
// Unembedding is a dot product: logit_i = w_i · v, one row w_i per vocabulary
// token. Softmax turns those logits into a ranked list, and the lens "readout"
// is the top of that list — the token whose unembedding direction the transported
// vector points most toward.
//
// Toy: a 2D "final-layer basis", six single-token concepts as unit directions
// (spokes), and a transported vector v you rotate. Watch the readout sweep from
// one token to the next as v aligns with different unembedding rows. Rank is just
// the position in the sorted list. Pure function of the angle — deterministic,
// bounded (six tokens), safe under SSR.

const ACC = "oklch(0.70 0.15 65)" // amber — the transported vector + top-1
const TOKENS = ["Mars", "planet", "red", "orbit", "moon", "Earth"]
const K = TOKENS.length
const TEMP = 0.85 // softmax temperature on the toy logits

const S = 210 // svg square for the plane
const CX = S / 2
const CY = S / 2
const R = 74 // spoke length
const VR = 62 // transported-vector length

// unembedding rows: six unit directions, evenly spaced
const ANGLES = Array.from({ length: K }, (_, i) => (i / K) * 2 * Math.PI - Math.PI / 2)

export function UnembedReadout() {
  const [deg, setDeg] = useState(24)
  const th = (deg * Math.PI) / 180
  const vx = Math.cos(th)
  const vy = Math.sin(th)

  // logit_i = w_i · v  (both unit-ish; dot product = cosine here)
  const logits = ANGLES.map((a) => Math.cos(a) * vx + Math.sin(a) * vy)
  const mx = Math.max(...logits)
  const exps = logits.map((l) => Math.exp((l - mx) / TEMP))
  const Z = exps.reduce((s, e) => s + e, 0)
  const probs = exps.map((e) => e / Z)

  // rank the tokens by probability (fixed-size sort — bounded)
  const order = probs
    .map((p, i) => ({ i, p }))
    .sort((a, b) => b.p - a.p)
  const top1 = order[0].i
  const rankOf = new Array(K).fill(0)
  order.forEach((o, r) => (rankOf[o.i] = r + 1))

  // screen y grows downward; negate the vector-y so "up" reads up
  const sx = (dx: number, len: number) => CX + dx * len
  const sy = (dy: number, len: number) => CY - dy * len

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>unembed(J·h) · a dot product, then a ranking</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr] sm:p-4">
        {/* the plane */}
        <svg
          viewBox={`0 0 ${S} ${S}`}
          className="mx-auto w-full max-w-[240px]"
          role="img"
          aria-label="A 2D final-layer basis with six token directions as spokes and a transported activation vector. The token whose direction the vector points most toward is the top readout."
        >
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeDasharray="2 4" />
          {ANGLES.map((a, i) => {
            const ex = Math.cos(a)
            const ey = Math.sin(a)
            const on = i === top1
            return (
              <g key={i}>
                <line
                  x1={CX}
                  y1={CY}
                  x2={sx(ex, R)}
                  y2={sy(ey, R)}
                  stroke={on ? ACC : "var(--muted-foreground)"}
                  strokeOpacity={on ? 0.9 : 0.3}
                  strokeWidth={on ? 2 : 1}
                />
                <text
                  x={sx(ex, R + 14)}
                  y={sy(ey, R + 14) + 3}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fill={on ? ACC : "var(--muted-foreground)"}
                  opacity={on ? 1 : 0.7}
                >
                  {TOKENS[i]}
                </text>
              </g>
            )
          })}
          {/* transported vector v */}
          <line x1={CX} y1={CY} x2={sx(vx, VR)} y2={sy(vy, VR)} stroke={ACC} strokeWidth={2.5} />
          <circle cx={sx(vx, VR)} cy={sy(vy, VR)} r={4} fill={ACC} />
          <text x={sx(vx, VR)} y={sy(vy, VR) - 8} textAnchor="middle" className="font-mono" fontSize={9} fill={ACC}>
            J·h
          </text>
          <circle cx={CX} cy={CY} r={2.5} fill="var(--muted-foreground)" />
        </svg>

        {/* the ranked readout */}
        <div className="min-w-0">
          <div className="space-y-1.5">
            {order.map((o, r) => {
              const isTop = r === 0
              return (
                <div key={o.i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                    {r + 1}
                  </span>
                  <span
                    className={cn(
                      "w-14 shrink-0 font-mono text-[11px]",
                      isTop ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {TOKENS[o.i]}
                  </span>
                  <div className="relative h-3.5 flex-1 rounded-sm bg-muted/50">
                    <div
                      className="absolute top-0 left-0 h-full rounded-sm transition-all duration-150"
                      style={{
                        width: `${Math.max(o.p * 100, 1)}%`,
                        background: isTop ? ACC : "var(--muted-foreground)",
                        opacity: isTop ? 0.95 : 0.4,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
                    {(o.p * 100).toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>

          <label className="mt-4 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="shrink-0">rotate J·h</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={deg}
              onChange={(e) => setDeg(parseInt(e.target.value, 10))}
              className="h-1 flex-1 cursor-pointer"
              style={{ color: ACC }}
              aria-label="Rotate the transported vector"
            />
          </label>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            readout: <span style={{ color: ACC }}>{TOKENS[top1]}</span> · rank of{" "}
            <span className="text-foreground">Mars</span> = {rankOf[0]}
          </p>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        Unembedding is a dot product: each vocabulary token owns one row of{" "}
        <code className="font-mono text-[0.85em]">W_U</code>, and its logit is that row against the transported vector.
        Softmax ranks them; the lens <span style={{ color: ACC }}>readout</span> is the top of the list — the token
        whose direction <code className="font-mono text-[0.85em]">J·h</code> aligns with. The superscript rank you see
        on a real slice page is exactly this position in the sorted vocabulary. Rotate the vector and the readout hands
        off from one concept to its neighbour.
      </p>
    </figure>
  )
}
