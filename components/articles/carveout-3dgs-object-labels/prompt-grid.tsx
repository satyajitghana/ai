// Where the probe's time actually goes, and what is shared.
//
// Carveout's detection stage calls SAM 3's IMAGE path: `proc.set_image(img)`
// once per rendered view, then `proc.set_text_prompt(prompt=concept, state)`
// once per concept against that cached state. So the Perception Encoder runs
// 40 times on the measured scene and the prompt-conditioned half — text
// encoder, fusion, DETR decoder, mask head — runs 40 x 73 = 2,920 times.
//
// The numbers are Carveout's own README: 73 prompts x 40 views in 5.0 minutes,
// "~0.1 s per prompt and view", 8 GB, RTX 5090. Server-rendered, zero JS: the
// shape is the argument and none of it moves.

const SHARED = "oklch(0.55 0.16 155)" // the once-per-view backbone
const PER = "oklch(0.60 0.15 255)" // the once-per-prompt head

const VIEWS = 40
const PROMPTS = 73
const PAIRS = VIEWS * PROMPTS // 2,920
const SECONDS = 300 // 5.0 min, README "Performance and sizing"

const W = 700
const H = 292

// One view's column, drawn at the left: a wide encoder block, then a stack of
// narrow head blocks. Only eight heads are drawn; the rest is an ellipsis and a
// count, because 73 rectangles say nothing 8 do not.
const COL_X = 46
const COL_W = 116
const ENC_Y = 64
const ENC_H = 34
const HEAD_Y = 116
const HEAD_H = 13
const HEAD_GAP = 4
const HEADS_DRAWN = 8

export function PromptGrid() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stage 2 probe · one scene, measured</span>
        <span className="text-muted-foreground/60">RTX 5090</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A diagram of Carveout's detection stage. Per rendered view, one shared Perception Encoder pass feeds a stack of per-prompt decoder passes. Across the measured scene that is 40 encoder passes and 2,920 prompt-conditioned passes, taking 300 seconds in total at about 0.103 seconds per prompt and view."
        >
          {/* --- one view --------------------------------------------------- */}
          <text
            x={COL_X}
            y={44}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            one rendered view
          </text>

          <rect
            x={COL_X}
            y={ENC_Y}
            width={COL_W}
            height={ENC_H}
            rx={4}
            fill={SHARED}
            fillOpacity={0.18}
            stroke={SHARED}
            strokeWidth={1.5}
          />
          <text
            x={COL_X + COL_W / 2}
            y={ENC_Y + 14}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={9.5}
          >
            set_image()
          </text>
          <text
            x={COL_X + COL_W / 2}
            y={ENC_Y + 26}
            textAnchor="middle"
            fill={SHARED}
            className="font-mono"
            fontSize={9}
          >
            encoder · once
          </text>

          <line
            x1={COL_X + COL_W / 2}
            x2={COL_X + COL_W / 2}
            y1={ENC_Y + ENC_H}
            y2={HEAD_Y - 2}
            stroke="currentColor"
            className="text-foreground/40"
            strokeWidth={1}
          />

          {Array.from({ length: HEADS_DRAWN }, (_, i) => (
            <rect
              key={i}
              x={COL_X}
              y={HEAD_Y + i * (HEAD_H + HEAD_GAP)}
              width={COL_W}
              height={HEAD_H}
              rx={2.5}
              fill={PER}
              fillOpacity={0.16}
              stroke={PER}
              strokeWidth={1}
            />
          ))}
          <text
            x={COL_X + COL_W / 2}
            y={HEAD_Y + 9.5}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={8.5}
          >
            set_text_prompt()
          </text>
          <text
            x={COL_X + COL_W / 2}
            y={HEAD_Y + HEADS_DRAWN * (HEAD_H + HEAD_GAP) + 12}
            textAnchor="middle"
            fill={PER}
            className="font-mono"
            fontSize={9}
          >
            × {PROMPTS} concepts
          </text>

          {/* --- the multiplier --------------------------------------------- */}
          <text
            x={210}
            y={150}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={16}
          >
            ×
          </text>
          <text
            x={210}
            y={168}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            {VIEWS}
          </text>
          <text
            x={210}
            y={180}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            views
          </text>

          {/* --- the totals -------------------------------------------------- */}
          <line
            x1={258}
            x2={258}
            y1={40}
            y2={H - 22}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {[
            {
              y: 72,
              c: SHARED,
              n: `${VIEWS}`,
              k: "encoder passes",
              s: "the frame is encoded once, whatever the vocabulary",
            },
            {
              y: 132,
              c: PER,
              n: PAIRS.toLocaleString("en-US"),
              k: "prompt-conditioned passes",
              s: "text encoder + fusion + DETR decoder + mask head, per concept",
            },
            {
              y: 192,
              c: "currentColor",
              n: `${SECONDS} s`,
              k: "wall clock",
              s: `${(SECONDS / PAIRS).toFixed(3)} s per prompt and view · peak 8 GB`,
            },
          ].map((r) => (
            <g key={r.k}>
              <rect
                x={284}
                y={r.y - 20}
                width={4}
                height={34}
                rx={2}
                fill={r.c}
                className={r.c === "currentColor" ? "text-foreground/40" : ""}
              />
              <text
                x={300}
                y={r.y - 2}
                className="fill-foreground font-mono"
                fontSize={19}
              >
                {r.n}
              </text>
              <text
                x={300 + r.n.length * 11.6 + 10}
                y={r.y - 2}
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {r.k}
              </text>
              <text
                x={300}
                y={r.y + 13}
                className="fill-muted-foreground font-mono"
                fontSize={9.5}
              >
                {r.s}
              </text>
            </g>
          ))}

          <line
            x1={284}
            x2={W - 20}
            y1={224}
            y2={224}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
          <text
            x={284}
            y={244}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            no memory bank · no masklets · no tracker
          </text>
          <text
            x={284}
            y={258}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            so nothing on this page is what Object Multiplex
          </text>
          <text
            x={284}
            y={272}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            makes cheaper
          </text>
        </svg>
      </div>
    </figure>
  )
}
