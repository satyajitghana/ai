// "<100ms on 1 H100" against the four numbers the card actually publishes.
//
// Three of them are under 100 ms. The fourth is 504 ms, and it is the one for
// the modality the release is named after having. The card is straight about
// this — it prints all four in a row, says H200, and says preprocessing and
// network time are extra. The claim that travelled kept one of the four.
//
// The token counts are derived, not published: `num_soft_tokens: 280` per image
// and `audio_samples_per_token: 640` at the 16 kHz the loader resamples to, both
// out of google/gemma-4-12B-it's own config, and 16 frames per video out of
// jev_omni.py. They are the reason the bars look the way they do.
//
// Server-rendered SVG, zero JS, integer coordinates only.

type Row = {
  modality: string
  request: string
  ms: number
  tokens: string
}

const ROWS: Row[] = [
  { modality: "image", request: "one still", ms: 26, tokens: "≈ 280 visual" },
  {
    modality: "audio",
    request: "13 seconds, mono",
    ms: 31,
    tokens: "≈ 325 audio",
  },
  { modality: "text", request: "≈ 2k tokens", ms: 83, tokens: "≈ 2,000 text" },
  {
    modality: "video",
    request: "16 frames",
    ms: 504,
    tokens: "≈ 4,480 visual",
  },
]

const MAX = 540
const BAR_W = 420

export function ModalityLatency() {
  const W = 800
  const top = 86
  const rowH = 44
  const H = top + ROWS.length * rowH + 70

  const xLabel = 16
  const xBar = 214
  const scale = (ms: number) => Math.round((ms / MAX) * BAR_W)
  const x100 = xBar + scale(100)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        warm median latency by modality, one H200, as published
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A bar chart of Jev-Omni's published warm median latency by modality on one H200: one still image 26 milliseconds at about 280 visual tokens, 13 seconds of mono audio 31 milliseconds at about 325 audio tokens, roughly two thousand tokens of text 83 milliseconds, and a 16-frame video 504 milliseconds at about 4,480 visual tokens. A dashed vertical line marks 100 milliseconds; the first three bars fall short of it and the video bar runs five times past it. A footnote records that the figures are medians over twenty requests on an optimised backend and that preprocessing and network time are excluded."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={xLabel} y={26}>
            three of the four are under 100 ms
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xLabel} y={44}>
            the fourth is the modality the release is named for
          </text>
          <text x={xLabel} y={72}>
            request
          </text>
          <text x={xBar} y={72}>
            median ms, warm
          </text>
        </g>
        <line
          x1={xLabel}
          y1={78}
          x2={W - 16}
          y2={78}
          className="stroke-border"
          strokeWidth={1}
        />

        <line
          x1={x100}
          y1={top - 4}
          x2={x100}
          y2={top + ROWS.length * rowH - 6}
          className="stroke-foreground/50"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={x100 + 4}
          y={top + ROWS.length * rowH + 10}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          100 ms
        </text>

        {ROWS.map((row, i) => {
          const y = top + i * rowH
          const w = scale(row.ms)
          const over = row.ms > 100
          return (
            <g key={row.modality}>
              <text
                x={xLabel}
                y={y + 16}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {row.modality}
              </text>
              <text
                x={xLabel}
                y={y + 29}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {row.request} · {row.tokens}
              </text>
              <rect
                x={xBar}
                y={y + 4}
                width={w}
                height={20}
                rx={3}
                className={
                  over
                    ? "fill-foreground/70 stroke-foreground/70"
                    : "fill-foreground/25 stroke-foreground/45"
                }
                strokeWidth={1}
              />
              <text
                x={xBar + w + 8}
                y={y + 19}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.ms} ms
              </text>
            </g>
          )
        })}

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          <text x={xLabel} y={top + ROWS.length * rowH + 32}>
            medians over 20 optimised-backend requests; preprocessing and network
            time are excluded, so decoding the video is not in the 504 ms either
          </text>
          <text x={xLabel} y={top + ROWS.length * rowH + 46}>
            token counts are derived from num_soft_tokens = 280,
            audio_samples_per_token = 640 at 16 kHz, and 16 frames per video
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        All four milliseconds are the model card&apos;s own, in its own order. The
        hardware is an H200, not the H100 the claim names. A video request carries
        sixteen times an image request&apos;s visual tokens and costs nineteen
        times as long, so the cost is worse than linear in tokens; the config has
        two candidate reasons — 40 of the 48 layers use a 1,024-token sliding
        window, and vision tokens attend bidirectionally — and I have not
        separated them.
      </figcaption>
    </figure>
  )
}
