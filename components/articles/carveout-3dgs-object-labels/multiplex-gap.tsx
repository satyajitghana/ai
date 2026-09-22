// The one place Carveout touches Object Multiplex, and what it leaves there.
//
// The exemplar (visual-prompt) pass is the only stage that loads
// sam3.1_multiplex.pt. It opens ONE tracking session, then, per crop:
// add_prompt on the crop's frame, propagate_in_video in both directions over
// every frame in the session, harvest, reset_session. So the session is reused
// but never shared: each propagation carries only the masklets one crop
// spawned, and the whole frame set is re-encoded once per crop.
//
// A bucket is 16 slots wide whether or not they are filled
// (multiplex_count=16). One crop that spawns one masklet therefore runs a
// memory encoder four times wider than SAM 3's over a tensor that is
// fifteen-sixteenths zeros — the 7% single-object tax the SAM 3.1 paper
// publishes, paid once per crop.
//
// Frame count 24 is Carveout's own 24 GB profile cap
// (detect.exemplar_max_frames); eight crops is the count in the code's own
// measured note about hotstart ("1 detection from 8 crops"). Server-rendered,
// zero JS.

const USED = "oklch(0.60 0.15 255)"
const IDLE = "oklch(0.62 0.03 250)"

const CROPS = 8
const FRAMES = 24 // 24 GB profile cap
const SLOTS = 16 // multiplex_count

const W = 700
const H = 268
const SLOT = 11
const SLOT_GAP = 2.5

function Bucket({
  x,
  y,
  filled,
}: {
  x: number
  y: number
  filled: number
}) {
  return (
    <g>
      {Array.from({ length: SLOTS }, (_, i) => (
        <rect
          key={i}
          x={x + i * (SLOT + SLOT_GAP)}
          y={y}
          width={SLOT}
          height={SLOT}
          rx={2}
          fill={i < filled ? USED : IDLE}
          fillOpacity={i < filled ? 0.85 : 0.22}
        />
      ))}
    </g>
  )
}

export function MultiplexGap() {
  const passesShipped = CROPS * FRAMES
  const passesPacked = FRAMES

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>exemplar pass · {CROPS} crops, {FRAMES} frames</span>
        <span className="text-muted-foreground/60">
          bucket = {SLOTS} slots, always
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Two rails. The shipped path runs one tracking session per crop, resetting between them: eight propagations over twenty-four frames each, ${passesShipped} frame passes, with one of sixteen bucket slots occupied. Packing all eight crops into one session would be twenty-four frame passes with eight of sixteen slots occupied — eight times fewer.`}
        >
          {/* --- shipped ------------------------------------------------------ */}
          <text x={14} y={28} className="fill-foreground font-mono" fontSize={11}>
            shipped: reset_session() between crops
          </text>

          {Array.from({ length: 4 }, (_, i) => (
            <g key={i}>
              <text
                x={14}
                y={54 + i * 22}
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                crop {i + 1}
              </text>
              <Bucket x={70} y={45 + i * 22} filled={1} />
              <text
                x={70 + SLOTS * (SLOT + SLOT_GAP) + 10}
                y={54 + i * 22}
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                → propagate over all {FRAMES} frames
              </text>
            </g>
          ))}
          <text
            x={70}
            y={140}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            … and four more, one session reset each
          </text>

          <rect
            x={470}
            y={40}
            width={214}
            height={106}
            rx={6}
            fill={IDLE}
            fillOpacity={0.1}
          />
          <text x={484} y={64} className="fill-foreground font-mono" fontSize={22}>
            {passesShipped}
          </text>
          <text
            x={484}
            y={80}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            frame encodes ({CROPS} × {FRAMES})
          </text>
          <text
            x={484}
            y={104}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            {CROPS} wide memory-encoder passes
          </text>
          <text
            x={484}
            y={117}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            over mostly-zero buckets, each
          </text>
          <text
            x={484}
            y={130}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            paying the ~7% single-object tax
          </text>

          <line
            x1={14}
            x2={W - 16}
            y1={158}
            y2={158}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {/* --- packed ------------------------------------------------------- */}
          <text
            x={14}
            y={182}
            className="fill-foreground font-mono"
            fontSize={11}
          >
            what a bucket is for: all {CROPS} crops in one session
          </text>

          <text
            x={14}
            y={210}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            crops 1–{CROPS}
          </text>
          <Bucket x={70} y={201} filled={CROPS} />
          <text
            x={70 + SLOTS * (SLOT + SLOT_GAP) + 10}
            y={210}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            → propagate once
          </text>

          <rect
            x={470}
            y={186}
            width={214}
            height={62}
            rx={6}
            fill={USED}
            fillOpacity={0.12}
          />
          <text x={484} y={212} className="fill-foreground font-mono" fontSize={22}>
            {passesPacked}
          </text>
          <text
            x={484}
            y={228}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            frame encodes (1 × {FRAMES})
          </text>
          <text
            x={484}
            y={241}
            fill={USED}
            className="font-mono"
            fontSize={10}
          >
            {CROPS}× fewer, same bucket width
          </text>
        </svg>
      </div>
    </figure>
  )
}
