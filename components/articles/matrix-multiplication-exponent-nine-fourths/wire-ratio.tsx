"use client"

import { useRef, useState } from "react"

import { mhypot } from "@/lib/dmath"

// The heuristic of §1.3 of "The matrix multiplication exponent is nine fourths".
// Put the three tensor factors A, B, C at sites. A wire (an index shared by two
// factors) costs, per bit, the distance between its sites. T_n has three wires
// i, j, k, so its price is (perimeter) · log₂ n. A rank decomposition with r terms
// instead shares one label among all three sites; if that label costs D per bit,
// monotonicity gives perimeter · log₂ n ≤ D · log₂ r, so ω ≥ perimeter / D.
//
// Euclidean plane: the companion paper ("Euclidean geometry in the asymptotic
// spectrum of tensors") proves a bit shared by three sites costs the normalized
// mean width of their convex hull, half the perimeter for a triangle, so the
// ratio is 2 for every triangle. Tripod: the paper's critical case, tips of a
// tripod with unit arms, pairwise distance 2 (perimeter 6); if the shared label
// costs 8/3 the ratio is 6/(8/3) = 9/4. The 8/3 is the paper's number; this
// widget does not derive it.

type P = [number, number]
const W = 640
const H = 280

export function WireRatio() {
  const [mode, setMode] = useState<"plane" | "tripod">("plane")
  const [pts, setPts] = useState<P[]>([
    [140, 220],
    [320, 220],
    [220, 70],
  ])
  const drag = useRef<number | null>(null)
  const svg = useRef<SVGSVGElement | null>(null)

  const toSvg = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H] as P
  }

  const d = (a: P, b: P) => mhypot(a[0] - b[0], a[1] - b[1])
  const unit = 100 // px per unit of distance
  const [A, B, C] = pts
  const ab = d(A, B) / unit
  const bc = d(B, C) / unit
  const ca = d(C, A) / unit
  const per = mode === "plane" ? ab + bc + ca : 6
  const label = mode === "plane" ? per / 2 : 8 / 3
  const ratio = per / label

  // tripod drawing
  const O: P = [470, 160]
  const tips: P[] = [
    [470, 60],
    [383, 210],
    [557, 210],
  ]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["plane", "tripod"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md border px-2 py-1 ${mode === m ? "border-foreground/40 bg-muted font-medium" : "border-border"}`}
          >
            {m === "plane" ? "sites in the Euclidean plane (drag them)" : "tips of a tripod (the paper’s critical case)"}
          </button>
        ))}
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full touch-none select-none"
        role="img"
        aria-label="Three sites, the wires between them and the shared label"
        onPointerMove={(e) => {
          if (drag.current === null) return
          const [x, y] = toSvg(e)
          const nx = Math.min(390, Math.max(20, x))
          const ny = Math.min(H - 20, Math.max(20, y))
          setPts((p) => p.map((q, i) => (i === drag.current ? ([nx, ny] as P) : q)))
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {mode === "plane" ? (
          <g>
            <polygon points={pts.map((p) => p.join(",")).join(" ")} fill="oklch(0.55 0.15 250)" fillOpacity={0.06} />
            {[
              [A, B, "j"],
              [B, C, "k"],
              [C, A, "i"],
            ].map(([p, q, n]) => (
              <g key={n as string}>
                <line x1={(p as P)[0]} y1={(p as P)[1]} x2={(q as P)[0]} y2={(q as P)[1]} stroke="oklch(0.5 0.1 190)" strokeWidth={2} />
                <text x={((p as P)[0] + (q as P)[0]) / 2 + 6} y={((p as P)[1] + (q as P)[1]) / 2 - 6} fontSize={13} fontStyle="italic" fill="currentColor">
                  {n as string}
                </text>
              </g>
            ))}
            {pts.map((p, i) => (
              <g
                key={i}
                onPointerDown={(e) => {
                  drag.current = i
                  ;(e.target as Element).setPointerCapture?.(e.pointerId)
                }}
                style={{ cursor: "grab" }}
              >
                <circle cx={p[0]} cy={p[1]} r={16} fill="var(--background, white)" stroke="currentColor" />
                <text x={p[0]} y={p[1] + 5} fontSize={14} textAnchor="middle" fontStyle="italic" fill="currentColor">
                  {"ABC"[i]}
                </text>
              </g>
            ))}
          </g>
        ) : (
          <g>
            {tips.map((t, i) => (
              <g key={i}>
                <line x1={O[0]} y1={O[1]} x2={t[0]} y2={t[1]} stroke="oklch(0.5 0.1 190)" strokeWidth={2} />
                <circle cx={t[0]} cy={t[1]} r={16} fill="var(--background, white)" stroke="currentColor" />
                <text x={t[0]} y={t[1] + 5} fontSize={14} textAnchor="middle" fontStyle="italic" fill="currentColor">
                  {"CAB"[i]}
                </text>
              </g>
            ))}
            <text x={O[0] + 10} y={O[1] + 4} fontSize={14} fontStyle="italic" fill="oklch(0.6 0.17 30)">
              ℓ
            </text>
            <text x={60} y={110} fontSize={12} fill="currentColor" fillOpacity={0.75}>
              unit arms; every path between
            </text>
            <text x={60} y={128} fontSize={12} fill="currentColor" fillOpacity={0.75}>
              two tips runs through the centre,
            </text>
            <text x={60} y={146} fontSize={12} fill="currentColor" fillOpacity={0.75}>
              so each pair is 2 apart
            </text>
          </g>
        )}
      </svg>
      <div className="mt-2 grid gap-1 rounded-lg bg-muted/50 p-3 font-mono text-xs sm:grid-cols-3">
        <div>
          perimeter = <b>{per.toFixed(3)}</b>
        </div>
        <div>
          shared label D = <b>{mode === "plane" ? `${label.toFixed(3)} (half)` : "8/3 (paper)"}</b>
        </div>
        <div>
          ω ≥ perimeter / D = <b>{ratio.toFixed(3)}</b>
        </div>
      </div>
      <p className="mt-2 text-xs">
        {mode === "plane"
          ? "In the plane the shared label always costs half the perimeter, so however you drag the sites the bound is exactly 2. That is the bound everyone already had."
          : "On a tripod the perimeter is 6. If the three-way label costs 8/3 per bit, the bound is 6 ÷ 8/3 = 9/4. The paper's Part I is about showing a faster algorithm would rule such tripods out, and following the consequences."}
      </p>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        The paper&apos;s §1.3 heuristic: prices turn the three indices of the matrix multiplication tensor into wires with lengths, and a rank decomposition into one label shared by all three sites. The plane case uses the companion paper&apos;s mean-width theorem; the tripod&apos;s 8/3 is quoted from the paper, not derived here.
      </figcaption>
    </figure>
  )
}
