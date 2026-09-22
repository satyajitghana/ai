// The forward path, drawn so the missing edge is visible.
//
// The whole GAE claim reduces to a graph question: does anything on the way to
// the point cloud read the decoded picture? In `src/stage1/gae_codec.py` both
// readouts call `_decode_trunk(z)` and then split — `dec_conv` for the feature
// hierarchy the frozen DA3 head consumes, `rgb_head` for pixels. Neither
// branch takes the other's output as an argument. This draws that, with the
// parameter counts read out of the shipped safetensors header, and marks the
// edge that would make the geometry derivative as absent.
//
// Server-rendered, zero JS.

const GEO = "oklch(0.55 0.15 250)"
const APP = "oklch(0.63 0.15 55)"
const FROZEN = "oklch(0.62 0.03 250)"

const W = 700
const H = 470

function Box({
  x,
  y,
  w,
  h,
  color,
  dashed = false,
}: {
  x: number
  y: number
  w: number
  h: number
  color: string
  dashed?: boolean
}) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={6}
      fill={color}
      fillOpacity={dashed ? 0.04 : 0.1}
      stroke={color}
      strokeWidth={1.2}
      strokeDasharray={dashed ? "4 3" : undefined}
    />
  )
}

export function TwoReadouts() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>GAE-64 forward path · one latent, two readouts</span>
        <span className="text-muted-foreground/60">params from the shipped safetensors</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A diagram of the GAE forward path. A frozen DA3-GIANT encoder turns an image into four feature levels of 3,072 channels each, which are normalised and concatenated into a 12,288-channel tensor. A 126.1 million parameter encoder compresses that to a 64-channel latent z on the same 27 by 48 patch grid. A shared 50.5 million parameter decoder trunk reads z and forks. The left fork runs a 73.5 million parameter convolution back up to the four feature levels and hands them to the frozen DA3 DPT head, which has no trained parameters and emits depth, camera rays and point maps. The right fork runs a 203.2 million parameter RGB head and emits pixels. A dashed crossed-out arrow from the RGB output back to the geometry branch is labelled: this edge does not exist."
        >
          <defs>
            <marker
              id="gae-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-foreground/50" />
            </marker>
          </defs>

          {/* ── row 1: frozen encoder → fused X → codec encoder → z ── */}
          <Box x={8} y={28} w={150} h={44} color={FROZEN} />
          <text x={83} y={47} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            DA3-GIANT encoder
          </text>
          <text x={83} y={62} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            frozen · 1.356B
          </text>

          <line x1={158} y1={50} x2={188} y2={50} stroke="currentColor" className="text-foreground/50" strokeWidth={1.2} markerEnd="url(#gae-arrow)" />

          <Box x={190} y={28} w={148} h={44} color={FROZEN} />
          <text x={264} y={47} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            4 levels, 3072 ch
          </text>
          <text x={264} y={62} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            blocks 19 / 27 / 33 / 39
          </text>

          <line x1={338} y1={50} x2={368} y2={50} stroke="currentColor" className="text-foreground/50" strokeWidth={1.2} markerEnd="url(#gae-arrow)" />

          <Box x={370} y={28} w={140} h={44} color={FROZEN} />
          <text x={440} y={47} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            normalise + concat
          </text>
          <text x={440} y={62} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            X: 12288 × 27 × 48
          </text>

          <line x1={510} y1={50} x2={540} y2={50} stroke="currentColor" className="text-foreground/50" strokeWidth={1.2} markerEnd="url(#gae-arrow)" />

          <Box x={542} y={28} w={150} h={44} color="oklch(0.6 0.12 300)" />
          <text x={617} y={47} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            Enc_φ
          </text>
          <text x={617} y={62} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            126.1M trained
          </text>

          {/* down into z */}
          <path d="M 617 72 L 617 96 L 350 96 L 350 116" fill="none" stroke="currentColor" className="text-foreground/50" strokeWidth={1.2} markerEnd="url(#gae-arrow)" />

          {/* ── the latent ── */}
          <rect x={208} y={118} width={284} height={46} rx={8} fill="oklch(0.6 0.12 300)" fillOpacity={0.16} stroke="oklch(0.6 0.12 300)" strokeWidth={1.6} />
          <text x={350} y={139} textAnchor="middle" className="fill-foreground font-mono" fontSize={13}>
            z — 64 × 27 × 48
          </text>
          <text x={350} y={155} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            82,944 numbers per view
          </text>

          <line x1={350} y1={164} x2={350} y2={188} stroke="currentColor" className="text-foreground/50" strokeWidth={1.2} markerEnd="url(#gae-arrow)" />

          {/* ── shared trunk ── */}
          <Box x={230} y={190} w={240} h={44} color="oklch(0.6 0.12 300)" />
          <text x={350} y={209} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            _decode_trunk(z)
          </text>
          <text x={350} y={224} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            shared · 50.5M
          </text>

          {/* fork */}
          <path d="M 350 234 L 350 252 L 175 252 L 175 272" fill="none" stroke={GEO} strokeWidth={1.4} markerEnd="url(#gae-arrow)" />
          <path d="M 350 234 L 350 252 L 525 252 L 525 272" fill="none" stroke={APP} strokeWidth={1.4} markerEnd="url(#gae-arrow)" />

          {/* ── geometry branch ── */}
          <Box x={90} y={274} w={170} h={44} color={GEO} />
          <text x={175} y={293} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            dec_conv
          </text>
          <text x={175} y={308} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            73.5M → 4 × 3072
          </text>

          <line x1={175} y1={318} x2={175} y2={342} stroke={GEO} strokeWidth={1.4} markerEnd="url(#gae-arrow)" />

          <Box x={90} y={344} w={170} h={46} color={GEO} dashed />
          <text x={175} y={364} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            DA3 DPT head
          </text>
          <text x={175} y={379} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            frozen · 0 trained params
          </text>

          <line x1={175} y1={390} x2={175} y2={414} stroke={GEO} strokeWidth={1.4} markerEnd="url(#gae-arrow)" />
          <text x={175} y={430} textAnchor="middle" className="font-mono" fill={GEO} fontSize={11}>
            depth · rays · point map
          </text>
          <text x={175} y={445} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            xyz = origin + depth · direction
          </text>

          {/* ── appearance branch ── */}
          <Box x={440} y={274} w={170} h={44} color={APP} />
          <text x={525} y={293} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
            rgb_head
          </text>
          <text x={525} y={308} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            203.2M · learned
          </text>

          <line x1={525} y1={318} x2={525} y2={414} stroke={APP} strokeWidth={1.4} markerEnd="url(#gae-arrow)" />
          <text x={525} y={430} textAnchor="middle" className="font-mono" fill={APP} fontSize={11}>
            RGB
          </text>
          <text x={525} y={445} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            45% of every trained codec weight
          </text>

          {/* ── the edge that is not there ── */}
          {/* cubic from the RGB output back toward the frozen head; the cross
              sits on B(0.5) = (382.1, 412.75) rather than near it */}
          <path
            d="M 505 428 C 430 432 330 400 272 378"
            fill="none"
            stroke="currentColor"
            className="text-foreground/25"
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          <g className="text-foreground/40">
            <line x1={374} y1={405} x2={390} y2={421} stroke="currentColor" strokeWidth={1.6} />
            <line x1={390} y1={405} x2={374} y2={421} stroke="currentColor" strokeWidth={1.6} />
          </g>
          <text x={382} y={437} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            no such edge
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        Both readouts take <code>z</code>{" "}
        and nothing else. The point cloud is built from the DPT head&apos;s own
        ray and depth output; RGB enters only as the colour written into each
        point.
      </figcaption>
    </figure>
  )
}
