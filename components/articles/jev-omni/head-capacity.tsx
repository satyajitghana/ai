// The third sighting of a frozen option count, and the first one in the weights.
//
// /articles/jev-in-the-browser found N welded into an ONNX graph at 25.
// /articles/laya-mlx found it welded into six Core ML bundles at 32, and at 4 in
// the one that plays Snake. Both were export artefacts: the PyTorch model
// underneath still took whatever width it was handed.
//
// Here it is not an export. `Head256` is `Linear(3840, 256)`, trained, and the
// class an option lands in is its *position* in a numbered list. Option 3 is
// row 3 of a weight matrix. That is the same thing openjev's letter readout does
// with the vocabulary rows for "A", "B" and "C" — /articles/cua-s1-forms measured
// that one flipping on 27.8% of reversals — except the rows here were trained for
// the job rather than inherited from pretraining.
//
// Server-rendered SVG, zero JS, integer coordinates only.

const LIVE = 4
const SHOWN = 24
const CELL = 26
const GAP = 4

const OPTIONS = ["Yes", "No", "Not stated", "Ask a human"]

export function HeadCapacity() {
  const W = 840
  const gridX = 16
  const gridY = 132
  const H = gridY + CELL + 122

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the option set is not data here — it is a slice of a trained weight matrix
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A diagram of the Jev-Omni decision head. A prompt fragment numbers four options: 1 Yes, 2 No, 3 Not stated, 4 Ask a human, followed by the instruction to reply with only the number of the correct option. Below it, a row of 24 of the head's 256 output classes is drawn. The first four are filled and labelled with the four option texts; every class from index 4 onward is struck through and marked masked to minus 1e30. A note states that class index equals list position, so moving an option to another position scores it with a different row of the weight matrix, and that the row beyond 255 does not exist."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={gridX} y={26}>
            &quot;Reply with only the number of the correct option (1-K).&quot;
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={gridX} y={44}>
            the prompt numbers the options; the head has one output class per
            number
          </text>
        </g>

        {OPTIONS.map((text, i) => (
          <g key={text}>
            <text
              x={gridX + i * 190}
              y={72}
              className="fill-foreground font-mono"
              style={{ fontSize: 11 }}
            >
              {i + 1}. {text}
            </text>
            <line
              x1={gridX + i * 190 + 6}
              y1={80}
              x2={gridX + i * (CELL + GAP) + CELL / 2}
              y2={gridY - 6}
              className="stroke-foreground/35"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </g>
        ))}

        <text
          x={gridX}
          y={gridY - 18}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          Linear(3840 → 256), one row per class
        </text>

        {Array.from({ length: SHOWN }, (_, i) => {
          const x = gridX + i * (CELL + GAP)
          const live = i < LIVE
          return (
            <g key={i}>
              <rect
                x={x}
                y={gridY}
                width={CELL}
                height={CELL}
                rx={3}
                className={
                  live
                    ? "fill-foreground/15 stroke-foreground/60"
                    : "fill-background stroke-border"
                }
                strokeWidth={live ? 1.5 : 1}
              />
              <text
                x={x + CELL / 2}
                y={gridY + 17}
                textAnchor="middle"
                className={
                  live
                    ? "fill-foreground font-mono"
                    : "fill-muted-foreground font-mono"
                }
                style={{ fontSize: 10 }}
              >
                {i}
              </text>
              {live ? null : (
                <line
                  x1={x + 4}
                  y1={gridY + CELL - 4}
                  x2={x + CELL - 4}
                  y2={gridY + 4}
                  className="stroke-border"
                  strokeWidth={1}
                />
              )}
            </g>
          )
        })}
        <text
          x={gridX + SHOWN * (CELL + GAP) + 8}
          y={gridY + 17}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          … up to 255
        </text>

        <line
          x1={gridX}
          y1={gridY + CELL + 12}
          x2={gridX + LIVE * (CELL + GAP) - GAP}
          y2={gridY + CELL + 12}
          className="stroke-foreground/60"
          strokeWidth={1.5}
        />
        <text
          x={gridX}
          y={gridY + CELL + 28}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          K live classes, softmaxed
        </text>

        <line
          x1={gridX + LIVE * (CELL + GAP)}
          y1={gridY + CELL + 12}
          x2={gridX + SHOWN * (CELL + GAP) - GAP}
          y2={gridY + CELL + 12}
          className="stroke-border"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        <text
          x={gridX + LIVE * (CELL + GAP)}
          y={gridY + CELL + 28}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          masked_fill(arange(256) &gt;= counts, −1e30)
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={gridX} y={gridY + CELL + 56}>
            class index = list position, so swapping two options scores each of
            them against a different trained row
          </text>
          <text x={gridX} y={gridY + CELL + 72}>
            there is no row 256: `predict` raises on more than 256 options, and
            the card puts the supported ceiling at 20
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        From <code>load_model.py</code> (<code>Head256</code>,{" "}
        <code>output_classes: 256</code> in <code>decision_config.json</code>) and
        the four storage entries inside <code>head.pt</code>, which at fp32 are
        exactly <code>mu[1,3840]</code>, <code>sd[1,3840]</code>,{" "}
        <code>linear.weight[256,3840]</code> and <code>linear.bias[256]</code>.
        Masking before the softmax is correct arithmetic — the unused classes
        contribute nothing — and it is also the thing that makes the option count
        a property of the weights rather than of the request.
      </figcaption>
    </figure>
  )
}
