import { mlog } from "@/lib/dmath"

// jev-paint's confidence-to-brush rule, drawn to scale.
//
// The renderer turns each pixel's colour distribution into one number:
//
//   spread = 1 - exp(-H)           H = Shannon entropy in nats
//          = 1 - 1/Neff            Neff = exp(H), the effective number of colours
//
// and then uses it twice, in opposite directions:
//
//   radius = 9 + 18*(1 - spread)   (+ up to 5 of jitter) -- confident => WIDER
//   relief = clamp((spread - 0.48) / 0.32, 0, 1)
//   richness = relief^2 * (3 - 2*relief)   -- the stroke is placed with this probability
//
// So the headline "the more confident Jev is, the wider the brush" is true of the
// width rule and is cancelled at the confident end by the gate: below spread 0.48
// -- fewer than 1.92 effective colours -- no stroke is placed at all and the flat
// underpainting shows through. The widest strokes the rule can draw are the ones
// it almost never draws.
//
// Server-rendered SVG, zero JS. All geometry is +-*/ on literal constants; the only
// transcendental is the entropy label, which goes through lib/dmath.

const GATE_LO = 0.48
const GATE_HI = 0.8

const SAMPLES: { neff: number; note?: string }[] = [
  { neff: 1, note: "one colour" },
  { neff: 1.5 },
  { neff: 1 / (1 - GATE_LO), note: "the gate" },
  { neff: 2, note: "coin flip" },
  { neff: 3 },
  { neff: 5, note: "full texture" },
  { neff: 16, note: "uniform" },
]

function richnessOf(spread: number) {
  const relief = Math.max(0, Math.min(1, (spread - GATE_LO) / (GATE_HI - GATE_LO)))
  return relief * relief * (3 - 2 * relief)
}

// A tapered vertical brush mark: half-width r, half-length l, centred on (cx, cy).
function mark(cx: number, cy: number, r: number, l: number) {
  const k = r * 1.12
  return [
    `M ${cx} ${cy - l}`,
    `C ${cx + k} ${cy - l * 0.42} ${cx + k} ${cy + l * 0.42} ${cx} ${cy + l}`,
    `C ${cx - k} ${cy + l * 0.42} ${cx - k} ${cy - l * 0.42} ${cx} ${cy - l}`,
    "Z",
  ].join(" ")
}

export function BrushWidth() {
  const colW = 108
  const pad = 14
  const W = pad * 2 + colW * SAMPLES.length
  const bandTop = 58
  const bandH = 150
  const axisY = bandTop + bandH + 18
  const gateH = 34
  const gateTop = axisY + 42
  const H = gateTop + gateH + 52

  const cols = SAMPLES.map((s, i) => {
    const spread = 1 - 1 / s.neff
    const radius = 9 + 18 * (1 - spread)
    const step = 4 + 12 * (1 - spread)
    const richness = richnessOf(spread)
    return {
      ...s,
      spread,
      radius,
      // the renderer walks up to 4 steps either side of the seed point
      half: Math.min(bandH / 2 - 6, 4 * step),
      richness,
      cx: pad + colW * i + colW / 2,
      nats: mlog(s.neff),
    }
  })

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-md border">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="Seven brush marks drawn to scale against the number of effective colours in the pixel distribution. Marks get narrower as the distribution spreads out, but below 1.92 effective colours no mark is drawn at all."
        >
          <text
            x={pad}
            y={22}
            className="fill-foreground font-mono text-[12px] font-semibold"
          >
            radius = 9 + 18 × (1 − spread)
          </text>
          <text x={pad} y={40} className="fill-muted-foreground font-mono text-[11px]">
            spread = 1 − 1/N_eff · drawn at the renderer&apos;s own scale, 560px canvas
          </text>

          {/* the flat zone: nothing is painted here */}
          <rect
            x={pad}
            y={bandTop}
            width={colW * 3}
            height={bandH}
            className="fill-foreground/[0.04]"
          />
          <line
            x1={pad + colW * 3}
            y1={bandTop}
            x2={pad + colW * 3}
            y2={gateTop + gateH}
            className="stroke-foreground/35"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={pad + colW * 1.5}
            y={bandTop + bandH / 2}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[11px]"
          >
            no stroke placed
          </text>

          {cols.map((c) => (
            <g key={c.neff}>
              {c.richness > 0 ? (
                <path
                  d={mark(c.cx, bandTop + bandH / 2, c.radius, c.half)}
                  className="fill-foreground/75"
                />
              ) : (
                <path
                  d={mark(c.cx, bandTop + bandH / 2, c.radius, c.half)}
                  className="fill-none stroke-foreground/25"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )}
              <text
                x={c.cx}
                y={axisY}
                textAnchor="middle"
                className="fill-foreground font-mono text-[11px]"
              >
                {c.neff.toFixed(2)}
              </text>
              <text
                x={c.cx}
                y={axisY + 15}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {c.spread.toFixed(2)} · {c.nats.toFixed(2)} nats
              </text>
              {c.note ? (
                <text
                  x={c.cx}
                  y={axisY + 29}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[10px] italic"
                >
                  {c.note}
                </text>
              ) : null}

              {/* the gate: probability the stroke is placed at all */}
              <rect
                x={c.cx - 26}
                y={gateTop}
                width={52}
                height={gateH}
                className="fill-foreground/[0.06]"
              />
              <rect
                x={c.cx - 26}
                y={gateTop + gateH - gateH * c.richness}
                width={52}
                height={gateH * c.richness}
                className="fill-foreground/70"
              />
              <text
                x={c.cx}
                y={gateTop + gateH + 15}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {c.richness === 0
                  ? "0%"
                  : c.richness >= 0.995
                    ? "100%"
                    : `${(c.richness * 100).toFixed(1)}%`}
              </text>
            </g>
          ))}

          <text
            x={pad}
            y={axisY + 29}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            N_eff
          </text>
          <text
            x={pad}
            y={gateTop + 14}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            stroke
          </text>
          <text
            x={pad}
            y={gateTop + 26}
            className="fill-muted-foreground font-mono text-[10px]"
          >
            placed
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 font-mono text-xs leading-5 text-muted-foreground">
        The width rule and the gate pull in opposite directions. Reading left to right,
        the mark gets narrower and shorter as Jev&apos;s colour distribution spreads out —
        that is the &ldquo;more confident, wider brush&rdquo; claim, and it is real. But
        the bottom row is the probability the renderer places that mark at all, and it is
        zero until the distribution carries more than 1.92 effective colours. The three
        widest marks on this chart are drawn dashed because they are never painted.
      </figcaption>
    </figure>
  )
}
