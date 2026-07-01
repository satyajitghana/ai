"use client"

// The evidence behind the design. If you measure how much each layer actually
// changes the residual stream — the representational "work" it does — the early
// layers do most of it and the late layers mostly refine. Uniform width spends the
// same capacity on a late layer that barely moves the representation as on an early
// one that transforms it. Tapering matches capacity to where the work is. Bars =
// illustrative per-layer representation change; the line = the tapered width
// allocation, which tracks it. Static SVG — no JS required.

const L = 12

// illustrative "representation change per layer": large early, small late
const change = Array.from({ length: L }, (_, l) => 0.15 + 0.85 * Math.exp(-l / 3.5))
// tapered width allocation (cosine), same shape family
const width = Array.from({ length: L }, (_, l) => 0.35 + 0.65 * (0.5 * (1 + Math.cos((Math.PI * l) / (L - 1)))))

export function WhyEarly() {
  const W = 620
  const H = 260
  const padL = 40
  const padR = 20
  const padT = 18
  const padB = 40
  const bw = (W - padL - padR) / L
  const sy = (v: number) => padT + (1 - v) * (H - padT - padB)

  const BAR = "oklch(0.7 0.04 260)"
  const LINE = "oklch(0.72 0.15 285)"

  const linePts = width.map((v, l) => `${padL + bw * (l + 0.5)},${sy(v)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        where the work happens · representation change vs allocated width, by depth
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Per-layer representation change is large in early layers and small in late layers; the tapered width allocation follows the same decreasing shape.">
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          {change.map((v, l) => (
            <rect
              key={l}
              x={padL + bw * l + 3}
              y={sy(v)}
              width={bw - 6}
              height={H - padB - sy(v)}
              rx="2"
              fill={BAR}
              fillOpacity="0.55"
            />
          ))}
          {[0, 3, 6, 9, 11].map((l) => (
            <text key={l} x={padL + bw * (l + 0.5)} y={H - padB + 15} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">L{l}</text>
          ))}
          {/* tapered width line */}
          <polyline points={linePts} fill="none" stroke={LINE} strokeWidth="2.5" />
          {width.map((v, l) => (
            <circle key={l} cx={padL + bw * (l + 0.5)} cy={sy(v)} r="3" fill={LINE} />
          ))}
          <text x={W - padR} y={sy(width[L - 1]) - 8} textAnchor="end" fontFamily="monospace" fontSize="10" fill={LINE}>tapered width</text>
          <text x={padL + bw * 2} y={sy(change[1]) - 6} fontFamily="monospace" fontSize="10" fill="currentColor" fillOpacity="0.6">representation change</text>
          <text x={(W) / 2} y={H - 4} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45">layer depth →</text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Later layers largely <span className="text-foreground">refine</span> rather than transform —
          they nudge the residual stream where early layers rewrite it. Uniform allocation ignores that
          and spends equal capacity everywhere. Tapering pours width into the layers doing the heavy
          lifting, which is why the same parameter budget buys a better model.
        </p>
      </div>
    </figure>
  )
}
