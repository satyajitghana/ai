// Where the option count stops being a loop bound.
//
// In upstream Laya's PyTorch `DecisionModel.forward`, `marker_pos` arrives as
// [batch, n_options] and `torch.gather` reads whatever width it is given. N is a
// tensor dimension of the *input*, so it is data. Every export freezes some of
// those dimensions into the graph, and which ones get frozen is the whole story
// of what survives the trip to a device.
//
// Row 2 is the finding /articles/jev-in-the-browser reported for the browser:
// rlcd-modernbert-151m's ONNX graph has symbolic batch and sequence axes and a
// literal 25 in the logits shape. Rows 3-5 are the same thing happening again,
// independently, on Apple silicon — and worse, because the Neural Engine
// rewrite freezes the batch and the sequence length too.
//
// Server-rendered SVG, zero JS, integer coordinates only.

type Dim = { text: string; frozen: boolean }
type Row = { runtime: string; sub: string; b: Dim; l: Dim; n: Dim; out: string }

const free = (text: string): Dim => ({ text, frozen: false })
const lock = (text: string): Dim => ({ text, frozen: true })

const ROWS: Row[] = [
  {
    runtime: "PyTorch, upstream Laya",
    sub: "torch.gather over marker_pos",
    b: free("symbolic"),
    l: free("symbolic"),
    n: free("symbolic"),
    out: "logits[B, N]",
  },
  {
    runtime: "ONNX, rlcd-modernbert-151m",
    sub: "the browser export, measured yesterday",
    b: free("batch_size"),
    l: free("sequence_length"),
    n: lock("25"),
    out: "logits[batch_size, 25]",
  },
  {
    runtime: "Core ML, ordinary export",
    sub: "laya-coreml, enumerated lengths",
    b: lock("1"),
    l: free("9-11 buckets"),
    n: lock("32"),
    out: "logits[1, 32]",
  },
  {
    runtime: "Core ML, Neural Engine",
    sub: "laya-coreml ANE, B1 / L96 / K32",
    b: lock("1"),
    l: lock("96"),
    n: lock("32"),
    out: "logits[1, 32]",
  },
  {
    runtime: "Core ML, Snake bundle",
    sub: "laya-coreml, B3 / L64 / K4",
    b: lock("3"),
    l: lock("64"),
    n: lock("4"),
    out: "logits[3, 4]",
  },
]

export function ShapeLock() {
  const W = 800
  const rowTop = 74
  const rowH = 40
  const H = rowTop + ROWS.length * rowH + 18

  const xLabel = 16
  const xB = 268
  const xL = 348
  const xN = 476
  const xOut = 568
  const wB = 72
  const wL = 120
  const wN = 84

  const cols: { x: number; w: number; head: string }[] = [
    { x: xB, w: wB, head: "batch" },
    { x: xL, w: wL, head: "sequence" },
    { x: xN, w: wN, head: "options" },
  ]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        which tensor dimensions survive the export as data, and which become literals
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A table of five inference graphs and the three tensor dimensions of a typed decision: batch, sequence length and option count. Upstream Laya in PyTorch leaves all three symbolic. The ONNX export of rlcd-modernbert-151m leaves batch and sequence symbolic and freezes the option count at twenty-five. The ordinary Core ML export of laya-coreml freezes batch at one and options at thirty-two, leaving the sequence length as a list of enumerated buckets. The Neural Engine export freezes all three at one, ninety-six and thirty-two. The Snake bundle freezes all three at three, sixty-four and four."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={xLabel} y={24}>
            N is a loop bound until somebody exports it
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={xLabel} y={42}>
            a frozen dimension is a re-export, not a longer array
          </text>
        </g>

        {cols.map((c) => (
          <text
            key={c.head}
            x={c.x + c.w / 2}
            y={62}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {c.head}
          </text>
        ))}
        <text
          x={xOut}
          y={62}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          output shape
        </text>
        <line
          x1={xLabel}
          y1={68}
          x2={W - 16}
          y2={68}
          className="stroke-border"
          strokeWidth={1}
        />

        {ROWS.map((row, i) => {
          const y = rowTop + i * rowH
          const dims = [row.b, row.l, row.n]
          return (
            <g key={row.runtime}>
              <text
                x={xLabel}
                y={y + 16}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.runtime}
              </text>
              <text
                x={xLabel}
                y={y + 29}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {row.sub}
              </text>

              {dims.map((d, j) => (
                <g key={cols[j].head}>
                  <rect
                    x={cols[j].x}
                    y={y + 3}
                    width={cols[j].w}
                    height={26}
                    rx={4}
                    className={
                      d.frozen
                        ? "fill-foreground/10 stroke-foreground/55"
                        : "fill-background stroke-border"
                    }
                    strokeWidth={d.frozen ? 1.5 : 1}
                    strokeDasharray={d.frozen ? undefined : "3 3"}
                  />
                  <text
                    x={cols[j].x + cols[j].w / 2}
                    y={y + 20}
                    textAnchor="middle"
                    className={
                      d.frozen
                        ? "fill-foreground font-mono"
                        : "fill-muted-foreground font-mono"
                    }
                    style={{ fontSize: d.frozen ? 12 : 10 }}
                  >
                    {d.text}
                  </text>
                </g>
              ))}

              <text
                x={xOut}
                y={y + 20}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.out}
              </text>

              {i < ROWS.length - 1 ? (
                <line
                  x1={xLabel}
                  y1={y + rowH - 4}
                  x2={W - 16}
                  y2={y + rowH - 4}
                  className="stroke-border"
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
              ) : null}
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Solid boxes are literals in the exported graph; dashed boxes are dimensions the
        runtime still chooses per call. The browser export froze one of the three. The
        Neural Engine export freezes all three, and the Snake bundle freezes the option
        count at{" "}
        <code>4</code> because a snake has four directions to choose between. Sources:{" "}
        <code>laya_coreml/convert.py</code>, <code>laya_coreml/ane.py</code>, and the
        shape dictionary each bundle carries in its own{" "}
        <code>coreml_config.json</code>.
      </figcaption>
    </figure>
  )
}
