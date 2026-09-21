// The sunflower fixture that ships in jev-paint's own test suite -- 144 real Jev
// palette distributions, one per pixel of a 12x12 grid -- shown twice.
//
// Left: the argmax of each distribution. That is what Jev actually said, and it is
// a sunflower, assembled from 144 forward passes that each saw one prompt and one
// coordinate pair and nothing else.
//
// Right: the same grid with the renderer's stroke rule applied per cell. Width comes
// from that cell's own spread (1 - 1/Neff over the 16 palette colours) and the cell
// is left flat where spread falls below the 0.48 gate. The result is a confidence map
// you can read off the painting: smooth at the corners, textured through the middle.
//
// Data: computed from jev-paint/tests/fixtures/palette.json, entropy per pixel with
// no spatial interpolation. Server-rendered SVG, zero JS, all arithmetic is +-*/.

const PIGMENT: Record<number, string> = {
  6: "#7d4623", // brown
  8: "#41a541", // green
  11: "#aadcff", // sky_blue
  12: "#ffd728", // yellow
}

// [palette index, top-1 probability, spread]
const CELLS: [number, number, number][] = [
  [11,0.91,0.261], [11,0.76,0.51], [11,0.76,0.516], [11,0.69,0.59], [11,0.68,0.586], [11,0.59,0.642], [11,0.55,0.662], [11,0.59,0.642], [11,0.7,0.571], [11,0.71,0.563], [11,0.78,0.5], [11,0.9,0.301],
  [11,0.9,0.278], [11,0.76,0.515], [11,0.56,0.657], [11,0.566,0.663], [11,0.5,0.677], [11,0.49,0.678], [12,0.414,0.733], [11,0.414,0.7], [11,0.52,0.672], [11,0.52,0.665], [11,0.687,0.587], [11,0.78,0.468],
  [11,0.81,0.455], [11,0.51,0.71], [11,0.41,0.764], [12,0.31,0.766], [12,0.43,0.731], [12,0.41,0.739], [12,0.36,0.738], [12,0.47,0.726], [12,0.47,0.697], [11,0.42,0.689], [11,0.6,0.638], [11,0.71,0.552],
  [11,0.73,0.559], [11,0.43,0.742], [11,0.33,0.772], [6,0.53,0.709], [6,0.4,0.718], [6,0.43,0.717], [6,0.61,0.643], [12,0.49,0.718], [12,0.49,0.715], [12,0.51,0.693], [11,0.48,0.674], [11,0.64,0.597],
  [11,0.67,0.626], [11,0.34,0.772], [12,0.37,0.772], [6,0.39,0.751], [6,0.63,0.648], [6,0.49,0.707], [6,0.64,0.653], [12,0.46,0.743], [12,0.48,0.745], [12,0.51,0.698], [11,0.42,0.682], [11,0.6,0.617],
  [11,0.65,0.645], [11,0.38,0.769], [12,0.37,0.785], [6,0.39,0.761], [6,0.5,0.719], [6,0.74,0.579], [6,0.687,0.62], [12,0.39,0.759], [12,0.48,0.752], [12,0.5,0.724], [11,0.49,0.688], [11,0.62,0.604],
  [11,0.64,0.669], [11,0.38,0.793], [11,0.25,0.816], [6,0.47,0.765], [6,0.52,0.741], [6,0.64,0.69], [6,0.78,0.557], [6,0.46,0.761], [12,0.38,0.784], [12,0.36,0.786], [11,0.43,0.742], [11,0.687,0.577],
  [11,0.576,0.696], [11,0.37,0.768], [8,0.39,0.796], [6,0.23,0.814], [6,0.27,0.809], [6,0.323,0.801], [6,0.38,0.789], [6,0.39,0.794], [11,0.28,0.807], [11,0.36,0.788], [11,0.44,0.762], [11,0.65,0.63],
  [11,0.63,0.666], [8,0.41,0.743], [8,0.48,0.75], [8,0.42,0.791], [8,0.36,0.799], [8,0.37,0.797], [8,0.33,0.793], [8,0.36,0.798], [11,0.34,0.797], [11,0.404,0.777], [11,0.59,0.703], [11,0.7,0.612],
  [11,0.66,0.651], [8,0.44,0.739], [8,0.475,0.742], [8,0.44,0.766], [8,0.475,0.769], [8,0.44,0.776], [8,0.45,0.778], [8,0.404,0.778], [8,0.36,0.767], [11,0.48,0.754], [11,0.58,0.71], [11,0.7,0.592],
  [11,0.73,0.569], [8,0.43,0.689], [8,0.47,0.714], [8,0.49,0.73], [8,0.56,0.715], [8,0.576,0.708], [8,0.55,0.726], [8,0.45,0.719], [11,0.43,0.731], [11,0.5,0.715], [11,0.64,0.658], [11,0.74,0.575],
  [11,0.79,0.505], [11,0.71,0.595], [11,0.62,0.664], [11,0.53,0.704], [11,0.42,0.713], [11,0.41,0.717], [11,0.43,0.711], [11,0.51,0.706], [11,0.63,0.668], [11,0.66,0.642], [11,0.74,0.559], [11,0.818,0.401],
]

const N = 12
const CELL = 34
const PANEL = N * CELL
const GAP = 30
const PAD = 8
const TOP = 30
const W = PAD * 2 + PANEL * 2 + GAP
const H = TOP + PANEL + 26

// The renderer's own numbers, rescaled from its 560px canvas to this 34px cell.
const SCALE = CELL / (560 / N)

function richnessOf(spread: number) {
  const relief = Math.max(0, Math.min(1, (spread - 0.48) / 0.32))
  return relief * relief * (3 - 2 * relief)
}

export function ConfidenceMap() {
  const left = PAD
  const right = PAD + PANEL + GAP

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-md border">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Two 12 by 12 grids of the same 144 Jev colour distributions. The left grid shows each pixel's most likely colour and reads as a pixel-art sunflower: blue background, yellow petals, brown centre, green leaves. The right grid replaces each cell with a brush mark whose width comes from that cell's uncertainty; the corners are left flat and the centre of the flower is densely textured."
        >
          <text x={left} y={20} className="fill-foreground font-mono text-[12px]">
            argmax per pixel — what Jev said
          </text>
          <text x={right} y={20} className="fill-foreground font-mono text-[12px]">
            the stroke rule applied to the same grid
          </text>

          {/* an opaque canvas under both panels, so the pigments read the same
              in light and dark mode instead of blending with the page */}
          <rect x={left} y={TOP} width={PANEL} height={PANEL} fill="#ffffff" />
          <rect x={right} y={TOP} width={PANEL} height={PANEL} fill="#ffffff" />

          {CELLS.map(([idx, , spread], i) => {
            const x = (i % N) * CELL
            const y = Math.floor(i / N) * CELL
            const fill = PIGMENT[idx]
            const richness = richnessOf(spread)
            const halfW = (9 + 18 * (1 - spread)) * SCALE
            const halfL = CELL / 2 + 2
            const k = halfW * 1.12
            const cx = right + x + CELL / 2
            const cy = TOP + y + CELL / 2
            const d = [
              `M ${cx} ${cy - halfL}`,
              `C ${cx + k} ${cy - halfL * 0.42} ${cx + k} ${cy + halfL * 0.42} ${cx} ${cy + halfL}`,
              `C ${cx - k} ${cy + halfL * 0.42} ${cx - k} ${cy - halfL * 0.42} ${cx} ${cy - halfL}`,
              "Z",
            ].join(" ")
            return (
              <g key={i}>
                <rect
                  x={left + x}
                  y={TOP + y}
                  width={CELL + 0.6}
                  height={CELL + 0.6}
                  fill={fill}
                />
                <rect
                  x={right + x}
                  y={TOP + y}
                  width={CELL + 0.6}
                  height={CELL + 0.6}
                  fill={fill}
                  opacity={0.38}
                />
                {richness > 0.02 ? (
                  <path d={d} fill={fill} opacity={0.45 + 0.55 * richness} />
                ) : null}
              </g>
            )
          })}
          <rect
            x={left}
            y={TOP}
            width={PANEL}
            height={PANEL}
            className="fill-none stroke-foreground/25"
            strokeWidth={1}
          />
          <rect
            x={right}
            y={TOP}
            width={PANEL}
            height={PANEL}
            className="fill-none stroke-foreground/25"
            strokeWidth={1}
          />

          <text
            x={left}
            y={TOP + PANEL + 18}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            144 independent forward passes, 16 colours each
          </text>
          <text
            x={right}
            y={TOP + PANEL + 18}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            flat cells = below the 0.48 gate · width is to scale, length is not
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 font-mono text-xs leading-5 text-muted-foreground">
        Jev is surest around the border of the sky — top-1 of 0.91 in the top-left
        corner and 0.90 in the top-right — and least sure inside the flower head, where
        it bottoms out at 0.23. The renderer turns that straight into paint: six of the
        144 cells fall under the gate and get no mark at all, the outer ring gets thin
        faint ones, and the flower head is at full texture. That makes the painting a
        picture of where the model was unsure — an illustration of calibration, not a
        measurement of it. Nothing here has been compared against a ground-truth
        sunflower, and a reliability diagram needs one.
      </figcaption>
    </figure>
  )
}
