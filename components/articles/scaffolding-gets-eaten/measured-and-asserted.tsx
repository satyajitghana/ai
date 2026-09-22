// The epistemics of the threshold claim, drawn.
//
// LEFT: the one thing that was measured. SEIG minus VIGA (VLM-only), same
// backbone (Claude Opus 4.7), same tasks, same metrics — so the difference is
// the staging and nothing else. Six metrics, two datasets, read straight out of
// Tables 1 and 2 and expressed as a relative improvement over the unstaged
// baseline, signed so that positive always means better.
//
// RIGHT: the revisit's claim plotted on the axis it lives on. One filled point
// (measured, at Opus 4.7) and one hollow point (asserted, at a stronger model,
// height unknown because no number was published). Three curves pass through
// both. "Helps a lot / almost not at all" does not distinguish them.
//
// Server-rendered SVG, zero JS. All arithmetic is + - * /, which is exact in
// IEEE-754 and identical on every engine, so nothing here can hydrate twice.
const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.64 0.16 45)"

// Tables 1 and 2, verbatim. [VIGA VLM-only, SEIG]; `up` marks metrics where
// higher is better.
const METRICS: {
  name: string
  up: boolean
  nerf: [number, number]
  edit: [number, number]
}[] = [
  { name: "PSNR", up: true, nerf: [12.33, 13.58], edit: [11.52, 12.65] },
  { name: "SSIM", up: true, nerf: [0.7122, 0.6881], edit: [0.6776, 0.6737] },
  { name: "LPIPS", up: false, nerf: [0.3506, 0.3493], edit: [0.3931, 0.3823] },
  { name: "DreamSim", up: false, nerf: [0.3693, 0.3021], edit: [0.3847, 0.3433] },
  { name: "DINO", up: true, nerf: [0.6221, 0.7188], edit: [0.5606, 0.6293] },
  { name: "CLIP", up: true, nerf: [0.8451, 0.8830], edit: [0.8366, 0.8446] },
]

// Relative improvement of the staged harness over the unstaged one, as a
// percentage, positive = better regardless of the metric's direction.
const gain = (pair: [number, number], up: boolean) => {
  const [base, seig] = pair
  const delta = up ? seig - base : base - seig
  return (delta / base) * 100
}

const fmt = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`

function Measured() {
  const W = 470
  const rowH = 44
  const top = 30
  const H = top + METRICS.length * rowH + 30
  const zero = 258 // x of the 0% line
  const perPct = 8 // px per percentage point
  const barH = 11

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Relative improvement of the staged harness over the unstaged baseline at a fixed backbone, six metrics, two datasets. On NeRF synthetic: PSNR plus 10.1 percent, SSIM minus 3.4 percent, LPIPS plus 0.4 percent, DreamSim plus 18.2 percent, DINO plus 15.5 percent, CLIP plus 4.5 percent. On Edit3D: PSNR plus 9.8 percent, SSIM minus 0.6 percent, LPIPS plus 2.7 percent, DreamSim plus 10.8 percent, DINO plus 12.3 percent, CLIP plus 1.0 percent."
    >
      <text x={0} y={12} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
        worse
      </text>
      <text x={W} y={12} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
        better
      </text>

      {/* gridlines at -5, 0, +5, +10, +15, +20 */}
      {[-5, 0, 5, 10, 15, 20].map((t) => (
        <g key={t}>
          <line
            x1={zero + t * perPct}
            y1={top - 8}
            x2={zero + t * perPct}
            y2={H - 24}
            className="stroke-border"
            strokeWidth={t === 0 ? 1.5 : 1}
            strokeDasharray={t === 0 ? undefined : "2 4"}
          />
          <text
            x={zero + t * perPct}
            y={H - 12}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            {t === 0 ? "0" : `${t > 0 ? "+" : "−"}${Math.abs(t)}%`}
          </text>
        </g>
      ))}

      {METRICS.map((m, i) => {
        const y = top + i * rowH
        const gN = gain(m.nerf, m.up)
        const gE = gain(m.edit, m.up)
        const bar = (g: number, by: number, color: string) => {
          const w = Math.abs(g) * perPct
          const x = g >= 0 ? zero : zero - w
          return (
            <g>
              <rect x={x} y={by} width={Math.max(w, 1)} height={barH} rx={1.5} fill={color} opacity={g >= 0 ? 0.9 : 0.45} />
              <text
                x={g >= 0 ? x + w + 5 : x - 5}
                y={by + barH - 2}
                textAnchor={g >= 0 ? "start" : "end"}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {fmt(g)}
              </text>
            </g>
          )
        }
        return (
          <g key={m.name}>
            <text x={0} y={y + 12} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              {m.name}
            </text>
            <text x={0} y={y + 24} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
              {m.up ? "higher is better" : "lower is better"}
            </text>
            {bar(gN, y + 2, ACCENT)}
            {bar(gE, y + 2 + barH + 3, "var(--muted-foreground)")}
          </g>
        )
      })}
    </svg>
  )
}

function Asserted() {
  const W = 470
  const H = 292
  const left = 56
  const right = W - 18
  const base = H - 46 // y of 0%
  const perPct = 8

  const yAt = (pct: number) => base - pct * perPct
  const xMeasured = 158
  const xAsserted = 392

  const yM = yAt(15.5) // DINO on NeRF synthetic, the largest clean gain
  const yA = yAt(1.5) // "almost not at all" — a guess, which is why it is hollow

  // Three curves through the same two points. A step, a knee, a straight line.
  const curves = [
    `M ${xMeasured} ${yM} C ${xMeasured + 130} ${yM}, ${xAsserted - 40} ${yM}, ${xAsserted - 18} ${yA} L ${xAsserted} ${yA}`,
    `M ${xMeasured} ${yM} C ${xMeasured + 70} ${yM}, ${xAsserted - 95} ${yA}, ${xAsserted} ${yA}`,
    `M ${xMeasured} ${yM} L ${xAsserted} ${yA}`,
  ]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="The revisit's claim plotted against base-model capability. A filled point marks the measured staging gain of about 15 percent at Claude Opus 4.7. A hollow point marks the asserted near-zero gain at a stronger model; its height is unknown because no number was published. Three different curves — a late step, a smooth knee, and a straight line — all pass through both points, so the words sharp threshold do not distinguish between them."
    >
      {/* axes */}
      <line x1={left} y1={base} x2={right} y2={base} className="stroke-border" strokeWidth={1.5} />
      <line x1={left} y1={22} x2={left} y2={base} className="stroke-border" strokeWidth={1.5} />

      {[0, 5, 10, 15].map((t) => (
        <g key={t}>
          <line x1={left} y1={yAt(t)} x2={right} y2={yAt(t)} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" opacity={t === 0 ? 0 : 0.7} />
          <text x={left - 6} y={yAt(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            {`+${t}%`}
          </text>
        </g>
      ))}

      <text x={left} y={14} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
        how much the staging helps
      </text>

      {/* the three curves */}
      {curves.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={WARM} strokeWidth={1.6} strokeDasharray="5 4" opacity={0.75} />
      ))}

      {/* measured point */}
      <circle cx={xMeasured} cy={yM} r={5} fill={ACCENT} />
      <line x1={xMeasured} y1={yM + 7} x2={xMeasured} y2={base} className="stroke-border" strokeWidth={1} />
      <text x={xMeasured} y={base + 15} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 10 }}>
        Opus 4.7
      </text>
      <text x={xMeasured} y={base + 27} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
        measured, n = 48 images
      </text>

      {/* asserted point */}
      <circle cx={xAsserted} cy={yA} r={5} fill="var(--background)" stroke={WARM} strokeWidth={2} strokeDasharray="2.6 2.2" />
      <line x1={xAsserted} y1={yA + 7} x2={xAsserted} y2={base} className="stroke-border" strokeWidth={1} strokeDasharray="2 3" />
      <text x={xAsserted} y={base + 15} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 10 }}>
        Astra
      </text>
      <text x={xAsserted} y={base + 27} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
        asserted, no number
      </text>

      <text x={right} y={base - 6} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
        base-model capability &#8594;
      </text>
    </svg>
  )
}

export function MeasuredAndAsserted() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one measurement, one assertion, and the axis between them
      </div>
      <div className="grid gap-px bg-border md:grid-cols-2">
        <div className="bg-background px-3 py-3">
          <p className="mb-2 font-mono text-[11px] text-foreground">
            measured · staging gain at a fixed backbone
          </p>
          <p className="mb-3 font-mono text-[10px] leading-4 text-muted-foreground">
            SEIG minus VIGA (VLM-only), Claude Opus 4.7 in both. Blue is NeRF synthetic,
            grey is Edit3D.
          </p>
          <Measured />
        </div>
        <div className="bg-background px-3 py-3">
          <p className="mb-2 font-mono text-[11px] text-foreground">
            asserted · the same gain at a stronger model
          </p>
          <p className="mb-3 font-mono text-[10px] leading-4 text-muted-foreground">
            The revisit reports a shape, not a value. Three curves fit it equally well.
          </p>
          <Asserted />
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Left panel: computed from Tables 1 and 2, positive means better on that metric&apos;s
        own direction. Right panel: an argument diagram, not a measurement — only the filled
        point has a number behind it, and the hollow one&apos;s height is my guess at what
        &quot;almost not at all&quot; means.
      </figcaption>
    </figure>
  )
}
