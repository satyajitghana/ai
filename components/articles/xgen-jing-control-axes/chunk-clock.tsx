// What an "action" is, laid out on the clock it actually runs on.
//
// A JING case is a list of CHUNKS. Each chunk carries one long prompt, a
// `repeat` count, and optionally one control entry per repeat. A repeat is a
// SLICE, and the README's own layout formula fixes what a slice is worth:
//
//     num_frames = 17 * sum(repeat) + 5
//
// which checks out on both shipped examples — bakery_greeting sums to 21
// repeats and declares 362 frames, train_carriage_gaze sums to 29 and declares
// 498. The prompt skill states the frame rate: "The compiler targets 24 FPS
// with generation.first_chunk_size=2".
//
// So one key state lasts 17 frames = 0.7083 s, and that is the finest interval
// at which anything about the world can change. The timeline below is
// examples/bakery_greeting.json, unmodified. Server-rendered, zero JS.

const MOVE = "oklch(0.60 0.15 255)"
const SPEAK = "oklch(0.68 0.13 85)"
const HOLD = "oklch(0.62 0.03 250)"

type Chunk = {
  repeat: number
  control?: string[]
  kind: "move" | "speak" | "hold"
  label: string
}

const CHUNKS: Chunk[] = [
  { repeat: 4, control: ["w", "w", "w", "w"], kind: "move", label: "walk in" },
  { repeat: 2, kind: "hold", label: "settle" },
  { repeat: 5, kind: "speak", label: "S1 speaks" },
  { repeat: 1, kind: "hold", label: "pause" },
  { repeat: 7, kind: "speak", label: "S2 replies" },
  { repeat: 2, kind: "hold", label: "close" },
]

const SLICES = CHUNKS.reduce((s, c) => s + c.repeat, 0) // 21
const FRAMES_PER_SLICE = 17
const TAIL = 5
const FRAMES = FRAMES_PER_SLICE * SLICES + TAIL // 362
const FPS = 24
const SECONDS = FRAMES / FPS // 15.0833…
const SLICE_S = FRAMES_PER_SLICE / FPS // 0.70833…

const W = 700
const H = 232
const TRACK_X = 22
const TRACK_W = W - 44
const CELL = TRACK_W / SLICES
const TRACK_Y = 74
const TRACK_H = 34

function colour(k: Chunk["kind"]) {
  return k === "move" ? MOVE : k === "speak" ? SPEAK : HOLD
}

export function ChunkClock() {
  let at = 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>examples/bakery_greeting.json · {SLICES} slices</span>
        <span className="text-muted-foreground/60">
          {FRAMES} frames · {SECONDS.toFixed(2)} s @ {FPS} fps
        </span>
      </div>

      <div className="overflow-x-auto p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`A timeline of twenty-one slices across six prompt chunks: four slices of forward movement, two of settling, five in which the first speaker talks, one pause, seven in which the second speaker replies, and two to close. Each slice is seventeen frames, ${SLICE_S.toFixed(3)} seconds at twenty-four frames per second, and the whole clip is ${FRAMES} frames or ${SECONDS.toFixed(2)} seconds.`}
        >
          <text x={TRACK_X} y={28} className="fill-foreground font-mono" fontSize={11}>
            one slice = {FRAMES_PER_SLICE} frames = {SLICE_S.toFixed(3)} s
          </text>
          <text
            x={TRACK_X}
            y={46}
            className="fill-muted-foreground font-mono"
            fontSize={9.5}
          >
            the finest interval at which a key, a line of dialogue or the
            soundscape can change
          </text>

          {CHUNKS.map((c, ci) => {
            const x0 = TRACK_X + at * CELL
            const w = c.repeat * CELL
            const col = colour(c.kind)
            at += c.repeat
            return (
              <g key={ci}>
                {Array.from({ length: c.repeat }, (_, k) => (
                  <rect
                    key={k}
                    x={x0 + k * CELL + 1}
                    y={TRACK_Y}
                    width={CELL - 2}
                    height={TRACK_H}
                    rx={2}
                    fill={col}
                    fillOpacity={c.kind === "hold" ? 0.18 : 0.6}
                  />
                ))}
                {c.control
                  ? c.control.map((key, k) => (
                      <text
                        key={k}
                        x={x0 + k * CELL + CELL / 2}
                        y={TRACK_Y + 22}
                        textAnchor="middle"
                        className="fill-background font-mono"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {key}
                      </text>
                    ))
                  : null}
                <line
                  x1={x0 + 1}
                  x2={x0 + w - 1}
                  y1={TRACK_Y + TRACK_H + 6}
                  y2={TRACK_Y + TRACK_H + 6}
                  stroke={col}
                  strokeWidth={1.4}
                />
                <text
                  x={x0 + w / 2}
                  y={TRACK_Y + TRACK_H + 20}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={8.5}
                >
                  {c.label}
                </text>
                <text
                  x={x0 + w / 2}
                  y={TRACK_Y + TRACK_H + 31}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={8}
                >
                  {(c.repeat * SLICE_S).toFixed(2)} s
                </text>
                <text
                  x={x0 + w / 2}
                  y={TRACK_Y - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={8}
                >
                  chunk {ci + 1}
                </text>
              </g>
            )
          })}

          <line
            x1={TRACK_X}
            x2={W - 22}
            y1={168}
            y2={168}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          <text
            x={TRACK_X}
            y={186}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            Chunks 3 and 5 carry speech as a tag inside the prompt string:
          </text>
          <text
            x={TRACK_X}
            y={198}
            className="fill-foreground font-mono"
            fontSize={9}
          >
            &lt;d&gt;[English] Hello. I just arrived in town.&lt;/d&gt;
          </text>
          <text
            x={TRACK_X}
            y={210}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            and the audio as a sentence. There is no audio conditioning input.
          </text>
          <text
            x={TRACK_X}
            y={222}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            Attention is causal=False: none of these {FRAMES} frames exists
            until all do.
          </text>
        </svg>
      </div>
    </figure>
  )
}
