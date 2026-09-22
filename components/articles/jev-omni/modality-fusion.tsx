// Where the decision head sits relative to the encoders — the diagram the model
// card does not ship.
//
// The interesting thing about Gemma 4 Unified is that there are no encoders to
// sit relative to. Read the base checkpoint's tensor list and the entire
// non-text parameter budget is three objects: a patch embedder that flattens a
// 48x48 pixel square and puts one Linear through it, a 3840x3840 vision
// projection, and a 640x3840 audio projection. 52,379,904 parameters against a
// 11,907,350,320-parameter decoder. Every modality becomes decoder tokens
// immediately and the decoder does all of the work.
//
// Which means the decision head does not sit after four encoders. It sits after
// one decoder, on one position — the last one — and it is a 256-way classifier.
//
// Server-rendered SVG, zero JS, integer coordinates only.

type Inlet = {
  label: string
  detail: string
  weights: string
  tokens: string
}

const INLETS: Inlet[] = [
  {
    label: "text",
    detail: "state, question, numbered options",
    weights: "embed_tokens · 248,320 × 3,840",
    tokens: "1 token per token",
  },
  {
    label: "image",
    detail: "one still, RGB",
    weights: "vision_embedder · 6,912 → 3,840",
    tokens: "280 soft tokens",
  },
  {
    label: "audio",
    detail: "mono 16 kHz, capped at 30 s",
    weights: "embed_audio · 640 → 3,840",
    tokens: "1 token per 640 samples",
  },
  {
    label: "video",
    detail: "16 frames, sampled by OpenCV",
    weights: "the image path, 16 times",
    tokens: "16 × 280 soft tokens",
  },
]

export function ModalityFusion() {
  const W = 840
  const top = 84
  const rowH = 46
  const H = top + INLETS.length * rowH + 126

  const xLabel = 16
  const xWeights = 120
  const xBus = 468
  const busW = 96
  const xStack = 604
  const stackW = 220

  const busTop = top - 8
  const busBottom = top + INLETS.length * rowH - 2

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        four modalities, one token stream, one readout position
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A diagram of Jev-Omni's path from input to probabilities. Four inlets on the left — text, image, audio and video — each pass through a single projection into one shared token stream: text through the 248,320 by 3,840 embedding table, an image through a 6,912 to 3,840 patch embedder producing 280 soft tokens, audio through a 640 to 3,840 projection at one token per 640 samples, and video through the image path sixteen times for sixteen times 280 tokens. The token stream feeds a 48-layer Gemma 4 decoder of 11,907,350,320 parameters. Only the hidden state at the last position is read. It passes through a standardisation step and a single Linear layer of 3,840 by 256, producing 256 logits. Logits at index greater than or equal to the live option count are masked to minus 1e30, and a softmax over the surviving first N gives the probabilities."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={xLabel} y={26}>
            no encoder towers: every modality is a projection into the decoder
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xLabel} y={44}>
            52,379,904 parameters of stock Gemma 4 front end · 11,907,350,320 of
            fine-tuned decoder
          </text>
          <text x={xLabel} y={70}>
            input
          </text>
          <text x={xWeights} y={70}>
            the only weights between it and the decoder
          </text>
          <text x={xBus} y={70}>
            token stream
          </text>
          <text x={xStack} y={70}>
            decoder and readout
          </text>
        </g>
        <line
          x1={xLabel}
          y1={76}
          x2={W - 16}
          y2={76}
          className="stroke-border"
          strokeWidth={1}
        />

        {/* the shared token bus */}
        <rect
          x={xBus}
          y={busTop}
          width={busW}
          height={busBottom - busTop}
          rx={4}
          className="fill-foreground/5 stroke-foreground/40"
          strokeWidth={1.5}
        />
        <text
          x={xBus + busW / 2}
          y={(busTop + busBottom) / 2 - 4}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          one
        </text>
        <text
          x={xBus + busW / 2}
          y={(busTop + busBottom) / 2 + 10}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          sequence
        </text>

        {INLETS.map((inlet, i) => {
          const y = top + i * rowH
          const mid = y + 16
          return (
            <g key={inlet.label}>
              <text
                x={xLabel}
                y={mid}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {inlet.label}
              </text>
              <text
                x={xLabel}
                y={mid + 13}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {inlet.detail}
              </text>

              <rect
                x={xWeights}
                y={y + 2}
                width={300}
                height={28}
                rx={4}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <text
                x={xWeights + 10}
                y={mid}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {inlet.weights}
              </text>
              <text
                x={xWeights + 10}
                y={mid + 12}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {inlet.tokens}
              </text>

              <line
                x1={xWeights + 300}
                y1={mid}
                x2={xBus - 4}
                y2={mid}
                className="stroke-foreground/40"
                strokeWidth={1}
              />
              <polygon
                points={`${xBus - 4},${mid} ${xBus - 11},${mid - 4} ${xBus - 11},${mid + 4}`}
                className="fill-foreground/50"
              />
            </g>
          )
        })}

        {/* decoder + head stack */}
        <rect
          x={xStack}
          y={busTop}
          width={stackW}
          height={56}
          rx={4}
          className="fill-background stroke-foreground/55"
          strokeWidth={1.5}
        />
        <text
          x={xStack + 12}
          y={busTop + 22}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          Gemma 4 decoder, 48 layers
        </text>
        <text
          x={xStack + 12}
          y={busTop + 38}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          11,907,350,320 params, fp32
        </text>

        <line
          x1={xBus + busW}
          y1={busTop + 28}
          x2={xStack - 4}
          y2={busTop + 28}
          className="stroke-foreground/40"
          strokeWidth={1}
        />
        <polygon
          points={`${xStack - 4},${busTop + 28} ${xStack - 11},${busTop + 24} ${xStack - 11},${busTop + 32}`}
          className="fill-foreground/50"
        />

        <line
          x1={xStack + stackW / 2}
          y1={busTop + 56}
          x2={xStack + stackW / 2}
          y2={busTop + 76}
          className="stroke-foreground/40"
          strokeWidth={1}
        />
        <text
          x={xStack + stackW / 2 + 8}
          y={busTop + 72}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          last position only
        </text>

        <rect
          x={xStack}
          y={busTop + 76}
          width={stackW}
          height={52}
          rx={4}
          className="fill-foreground/5 stroke-foreground/55"
          strokeWidth={1.5}
        />
        <text
          x={xStack + 12}
          y={busTop + 96}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          Head256
        </text>
        <text
          x={xStack + 12}
          y={busTop + 112}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          (h − mu) / sd → Linear(3840, 256)
        </text>

        <line
          x1={xStack + stackW / 2}
          y1={busTop + 128}
          x2={xStack + stackW / 2}
          y2={busTop + 148}
          className="stroke-foreground/40"
          strokeWidth={1}
        />
        <text
          x={xStack + 12}
          y={busTop + 166}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          256 logits
        </text>
        <text
          x={xStack + 12}
          y={busTop + 180}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          index ≥ K masked to −1e30
        </text>
        <text
          x={xStack + 12}
          y={busTop + 194}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          softmax over the first K
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Drawn from <code>jev_omni.py</code>, <code>load_model.py</code> and the
        safetensors headers of both repositories. The four inlets are not four
        encoders: <code>vision_embedder</code> is one <code>Linear</code> over a
        flattened 48×48 pixel square, <code>embed_audio</code> is one{" "}
        <code>Linear</code> over 640 raw samples, and video is the image path run
        sixteen times. All three belong to stock{" "}
        <code>google/gemma-4-12B-it</code>, which the loader downloads separately;
        this release fine-tuned the decoder and trained the head.
      </figcaption>
    </figure>
  )
}
