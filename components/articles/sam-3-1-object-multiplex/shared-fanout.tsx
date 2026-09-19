// What Object Multiplex actually shares, in tensor shapes.
//
// SAM 3 already encoded the frame once and reused it for every object. What it
// replicated was the memory path: one memory bank, one memory encode, one
// memory attention and one mask decode PER OBJECT. Multiplex keeps the frame
// encode exactly where it was and moves the memory path into a bucket space of
// M = 16 fixed slots, so it runs ceil(N / M) times instead of N times.
//
// The picture is drawn for N = 20, the smallest count that needs a second
// bucket, because that is where both halves of the design are visible at once:
// the sharing, and the twelve empty slots you pay for anyway.
//
// Shapes are read from the shipped code — image_size=1008 and backbone_stride=14
// give a 72x72 = 5184-token grid; interpol_size=[1152,1152] is the mask
// downsampler's input; multiplex_count=16 with input_channel_multiplier=2 is
// the 32-channel first convolution; 80 = 16 obj-score + 16 IoU + 48 mask tokens.
//
// Server-rendered SVG, zero JS; every coordinate is an integer literal.

const ACCENT = "oklch(0.58 0.16 250)"

const N_OBJECTS = 20
const SLOTS = 16
const FILLED_B1 = 4

const W = 880
const H = 476

const RX = 456 // multiplex region left edge
const RW = 404

type Stage = { y: number; h: number; title: string; shape: string; note: string }

const STAGES: Stage[] = [
  {
    y: 112,
    h: 52,
    title: "memory encoder — mask downsampler",
    shape: "[2, 32, 1152, 1152] → [2, 256, 72, 72]",
    note: "32 channels = 16 slot masks + 16 conditioning flags",
  },
  {
    y: 172,
    h: 52,
    title: "memory attention",
    shape: "7 memory frames × 5184 tokens, 2 passes",
    note: "the expanded frame features enter here",
  },
  {
    y: 232,
    h: 58,
    title: "mask decoder",
    shape: "80 tokens per bucket = 16 + 16 + 48",
    note: "object embeddings are ADDED to the mask tokens, not concatenated",
  },
]

export function SharedFanout() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        SAM 3.1 Object Multiplex · N = 20 objects · multiplex_count = 16
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A dataflow diagram for twenty tracked objects. On the left, one video frame enters the Perception Encoder once and comes out as a tensor of five thousand one hundred and eighty-four tokens by one by two hundred fifty-six; a caption notes this single encode per frame was already shared in SAM 3. Below it, twenty object masks are drawn as twenty small squares. Both streams feed a dashed region on the right labelled multiplex space, in which everything runs twice rather than twenty times: the frame tokens are expanded to two buckets by a stride-zero view that copies no bytes, and the twenty masks are muxed into two rows of sixteen slots, the first row full and the second holding four objects and twelve empty padding slots. Inside the region, three stages run once per bucket — the mask downsampler taking thirty-two channels, sixteen slot masks plus sixteen conditioning flags, down to a two hundred fifty-six channel memory; memory attention over seven memory frames of five thousand one hundred and eighty-four tokens; and a mask decoder with eighty tokens per bucket, sixteen object-score plus sixteen IoU plus forty-eight mask tokens, with the per-object embeddings added onto the mask tokens rather than concatenated. The output is demuxed back to twenty masks and the twelve padding slots are discarded. A panel at lower left shows what SAM 3 does with the same twenty objects: twenty empty boxes, one memory bank, one memory encode, one memory attention and one mask decode each, on every frame."
      >
        {/* ================= left: what is produced once ================= */}
        <text x={20} y={20} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          ONCE PER FRAME — shared in SAM 3 already
        </text>

        <rect x={20} y={34} width={90} height={44} rx={4} className="fill-background stroke-border" strokeWidth={1.5} />
        <text x={30} y={52} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          frame t
        </text>
        <text x={30} y={66} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          1008 × 1008
        </text>

        <line x1={110} y1={56} x2={132} y2={56} className="stroke-foreground/60" strokeWidth={1.5} />
        <path d="M 132 56 L 125 52 L 125 60 Z" className="fill-foreground/60" />

        <rect x={134} y={28} width={158} height={56} rx={4} className="fill-background stroke-border" strokeWidth={1.5} />
        <text x={144} y={46} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          Image Encoder
        </text>
        <text x={144} y={60} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          Perception Encoder
        </text>
        <text x={144} y={73} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          stride 14 → 72 × 72
        </text>

        <line x1={292} y1={56} x2={314} y2={56} className="stroke-foreground/60" strokeWidth={1.5} />
        <path d="M 314 56 L 307 52 L 307 60 Z" className="fill-foreground/60" />

        <rect x={316} y={42} width={110} height={28} rx={3} className="fill-muted stroke-border" strokeWidth={1.2} />
        <text x={324} y={60} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          [5184, 1, 256]
        </text>

        <text x={20} y={100} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          One encode per frame, whatever N is — the memory path scaled.
        </text>

        {/* ---- the per-object masks ---- */}
        <text x={20} y={144} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          ONCE PER OBJECT — the masks from frame t−1
        </text>
        {Array.from({ length: N_OBJECTS }, (_, i) => i).map((i) => (
          <rect
            key={i}
            x={20 + i * 14}
            y={156}
            width={11}
            height={16}
            rx={2}
            fill={ACCENT}
            fillOpacity={0.55}
          />
        ))}
        <text x={20} y={190} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          [20, 1, 1152, 1152]
        </text>

        {/* ---- fan-in arrows ---- */}
        <path
          d="M 426 56 C 440 56, 442 62, 452 62"
          fill="none"
          className="stroke-foreground/60"
          strokeWidth={1.5}
        />
        <path d="M 454 62 L 447 58 L 447 66 Z" className="fill-foreground/60" />
        <text x={264} y={120} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
          .expand(-1, 2, -1)
        </text>
        <text x={264} y={132} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          stride-0 view · no copy
        </text>

        <path
          d="M 300 164 C 380 164, 400 100, 452 96"
          fill="none"
          className="stroke-foreground/60"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <path d="M 454 96 L 447 92 L 447 100 Z" className="fill-foreground/60" />
        <text x={306} y={206} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
          mux_matrix @ x
        </text>
        <text x={306} y={218} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          a partial permutation
        </text>

        {/* ---- what SAM 3 does with the same twenty objects ---- */}
        <text x={20} y={252} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          SAM 3, THE SAME TWENTY OBJECTS
        </text>
        {Array.from({ length: N_OBJECTS }, (_, i) => i).map((i) => (
          <rect
            key={`legacy-${i}`}
            x={20 + (i % 10) * 29}
            y={264 + Math.floor(i / 10) * 24}
            width={25}
            height={19}
            rx={3}
            className="fill-background stroke-border"
            strokeWidth={1.2}
          />
        ))}
        <text x={20} y={326} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          One memory bank, one memory encode, one memory attention and one
        </text>
        <text x={20} y={339} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          mask decode — twenty of each, on every frame.
        </text>

        {/* ================= right: the multiplex region ================= */}
        <rect
          x={RX}
          y={16}
          width={RW}
          height={324}
          rx={6}
          fill={ACCENT}
          fillOpacity={0.05}
          stroke={ACCENT}
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text x={RX + 10} y={34} className="font-mono" fill={ACCENT} style={{ fontSize: 10 }}>
          MULTIPLEX SPACE — runs ⌈20 / 16⌉ = 2 times, not 20
        </text>

        {/* slot grid: 2 buckets x 16 slots */}
        {[0, 1].map((b) =>
          Array.from({ length: SLOTS }, (_, i) => i).map((i) => {
            const on = b === 0 || i < FILLED_B1
            return (
              <rect
                key={`${b}-${i}`}
                x={RX + 10 + i * 24}
                y={44 + b * 24}
                width={20}
                height={18}
                rx={2}
                fill={on ? ACCENT : "none"}
                fillOpacity={on ? 0.55 : 0}
                stroke={ACCENT}
                strokeOpacity={on ? 0 : 0.45}
                strokeWidth={1}
                strokeDasharray={on ? undefined : "3 2"}
              />
            )
          })
        )}
        <text x={RX + 10} y={104} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          bucket 0: 16 objects · bucket 1: 4 objects + 12 padding slots, encoded as zeros
        </text>

        {/* the three stages */}
        {STAGES.map((s) => (
          <g key={s.title}>
            <rect
              x={RX + 10}
              y={s.y}
              width={RW - 20}
              height={s.h}
              rx={4}
              className="fill-background stroke-border"
              strokeWidth={1.5}
            />
            <text x={RX + 20} y={s.y + 17} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
              {s.title}
            </text>
            <text
              x={RX + 20}
              y={s.y + 31}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {s.shape}
            </text>
            <text
              x={RX + 20}
              y={s.y + 44}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {s.note}
            </text>
          </g>
        ))}

        <rect
          x={RX + 10}
          y={298}
          width={RW - 20}
          height={26}
          rx={3}
          className="fill-muted stroke-border"
          strokeWidth={1.2}
        />
        <text x={RX + 20} y={316} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          [2, 16, 3, 1152, 1152] — every slot, filled or not
        </text>

        {/* ================= demux back out ================= */}
        <path
          d="M 560 340 C 560 392, 430 398, 302 392"
          fill="none"
          className="stroke-foreground/60"
          strokeWidth={1.5}
        />
        <path d="M 300 392 L 308 389 L 307 397 Z" className="fill-foreground/60" />
        <text x={580} y={362} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
          demux_matrix @ x — 12 padding slots dropped
        </text>

        {Array.from({ length: N_OBJECTS }, (_, i) => i).map((i) => (
          <rect
            key={`out-${i}`}
            x={20 + i * 14}
            y={382}
            width={11}
            height={16}
            rx={2}
            fill={ACCENT}
            fillOpacity={0.55}
          />
        ))}
        <text x={20} y={416} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          [20, 3, 1152, 1152] — 20 masks, back in data space
        </text>

        <line x1={20} y1={430} x2={W - 20} y2={430} className="stroke-border" strokeWidth={1} />
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          <text x={20} y={448}>
            SAM 3 runs the dashed region&rsquo;s three stages 20 times. SAM 3.1 runs them twice — and pays
            for 12 empty slots in the second bucket.
          </text>
          <text x={20} y={462}>
            At N = 1 there is one bucket, fifteen slots of padding, and the whole 32-channel memory encoder.
            That is the published 7% tax.
          </text>
        </g>
      </svg>
    </figure>
  )
}
