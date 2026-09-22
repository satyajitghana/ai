// The controlled comparison, which is the part of the paper that argues.
//
// Seven latents dropped into the same DDT-style flow model, the same camera
// conditioning, the same training budget, the same sampler: nine views at 252²
// from one reference, 50 Euler steps, CFG 2. Only the encoder and decoder
// change. FVD is appearance; the ATE column is a separate VGGT reconstruction
// of the generated frames, so it does not share a backbone with any of the
// latents being ranked.
//
// Paper Tables 5 and 6. The two grey rows are complete external systems rather
// than latents in the shared harness, and the paper excludes them from its own
// ranking; they are here because leaving them out would flatter GAE.
//
// Server-rendered, zero JS.

type Row = {
  label: string
  re10k: number
  dl3dv: number
  ate: number
  ours?: boolean
  external?: boolean
}

const ROWS: Row[] = [
  { label: "SD-VAE", re10k: 258.6, dl3dv: 373.2, ate: 0.0072 },
  { label: "WAN2.1 VAE", re10k: 362.9, dl3dv: 596.7, ate: 0.0225 },
  { label: "RAEv2", re10k: 379.4, dl3dv: 453.4, ate: 0.0085 },
  { label: "DA3-GIANT L0", re10k: 298.6, dl3dv: 376.5, ate: 0.0085 },
  { label: "DA3-GIANT L3", re10k: 488.9, dl3dv: 584.8, ate: 0.0112 },
  { label: "GAE-128", re10k: 233.4, dl3dv: 345.2, ate: 0.0041, ours: true },
  { label: "GAE-64", re10k: 225.7, dl3dv: 287.0, ate: 0.0034, ours: true },
  { label: "GLD", re10k: 445.1, dl3dv: 587.4, ate: 0.0124, external: true },
  { label: "Gen3R", re10k: 269.7, dl3dv: 580.5, ate: 0.0090, external: true },
]

const OURS = "oklch(0.55 0.15 250)"
const REST = "oklch(0.62 0.04 250)"
const EXT = "oklch(0.68 0.03 250)"

const W = 700
const ROW_H = 36
const TOP = 34
const PLOT_L = 132
const PLOT_R = 556
const DOM = 620
const UNIT = (PLOT_R - PLOT_L) / DOM
const TICKS = [0, 200, 400, 600]

export function LatentBakeoff() {
  const H = TOP + ROWS.length * ROW_H + 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>same flow model, same protocol · only the latent changes</span>
        <span className="text-muted-foreground/60">FVD ↓ · 9 views, 252², CFG 2</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="FVD on RealEstate10K and DL3DV for nine latent spaces under a matched flow model, with VGGT trajectory error in the right column. SD-VAE 258.6 and 373.2, ATE 0.0072. WAN2.1 VAE 362.9 and 596.7, ATE 0.0225. RAEv2 379.4 and 453.4, ATE 0.0085. DA3-GIANT level 0 298.6 and 376.5, ATE 0.0085. DA3-GIANT level 3 488.9 and 584.8, ATE 0.0112. GAE-128 233.4 and 345.2, ATE 0.0041. GAE-64 225.7 and 287.0, ATE 0.0034. The external systems GLD at 445.1 and 587.4 with ATE 0.0124, and Gen3R at 269.7 and 580.5 with ATE 0.0090."
        >
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={PLOT_L + t * UNIT}
                x2={PLOT_L + t * UNIT}
                y1={TOP - 8}
                y2={TOP + ROWS.length * ROW_H - 8}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PLOT_L + t * UNIT}
                y={TOP - 14}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {t}
              </text>
            </g>
          ))}

          <text x={W - 8} y={TOP - 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            VGGT ATE ↓
          </text>

          {ROWS.map((r, i) => {
            const y = TOP + i * ROW_H
            const color = r.ours ? OURS : r.external ? EXT : REST
            return (
              <g key={r.label}>
                <text
                  x={PLOT_L - 10}
                  y={y + 18}
                  textAnchor="end"
                  className={r.ours ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={11}
                >
                  {r.label}
                </text>

                <rect
                  x={PLOT_L}
                  y={y + 3}
                  width={r.re10k * UNIT}
                  height={11}
                  rx={2}
                  fill={color}
                  opacity={r.external ? 0.5 : 0.9}
                />
                <text
                  x={PLOT_L + r.re10k * UNIT + 6}
                  y={y + 12}
                  className="font-mono"
                  fill={color}
                  fontSize={9}
                >
                  {r.re10k.toFixed(1)}
                </text>

                <rect
                  x={PLOT_L}
                  y={y + 17}
                  width={r.dl3dv * UNIT}
                  height={11}
                  rx={2}
                  fill={color}
                  opacity={r.external ? 0.25 : 0.42}
                />
                <text
                  x={PLOT_L + r.dl3dv * UNIT + 6}
                  y={y + 26}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {r.dl3dv.toFixed(1)}
                </text>

                <text
                  x={W - 8}
                  y={y + 20}
                  textAnchor="end"
                  className={r.ours ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  fontSize={10}
                >
                  {r.ate.toFixed(4)}
                </text>
              </g>
            )
          })}

          <g>
            <rect x={PLOT_L} y={H - 20} width={18} height={8} rx={2} fill={REST} opacity={0.9} />
            <text x={PLOT_L + 24} y={H - 13} className="fill-muted-foreground font-mono" fontSize={9}>
              RealEstate10K
            </text>
            <rect x={PLOT_L + 122} y={H - 20} width={18} height={8} rx={2} fill={REST} opacity={0.42} />
            <text x={PLOT_L + 146} y={H - 13} className="fill-muted-foreground font-mono" fontSize={9}>
              DL3DV
            </text>
            <text x={PLOT_L + 228} y={H - 13} className="fill-muted-foreground/70 font-mono" fontSize={9}>
              faded rows: external systems, not shared-harness latents
            </text>
          </g>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        The abstract&apos;s 12.7% and 23.1% are GAE-64 against SD-VAE, which is
        the best competing latent on both datasets. Against the geometry-native
        baseline it was distilled from — raw DA3 L0 — the gaps are 24.4% and 23.8%.
      </figcaption>
    </figure>
  )
}
