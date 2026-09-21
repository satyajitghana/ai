// What 36,032 parameters actually cost to run.
//
// The cell embedder is the only part of TabFM that reads a table cell, and it
// is the smallest module in the model by four orders of magnitude. It is not
// the cheapest to execute. Every cell is grouped with two others, each of the
// three is blown up by 32 learned Fourier frequencies into a sin/cos pair, and
// the result is projected to 256 dimensions TWICE — once through the numeric
// head and once through the categorical head — before a torch.where picks per
// cell and a sum collapses the group axis.
//
// The parameter column is the safetensors shapes. The activation column is
// integer arithmetic over those shapes for one 4096-row chunk (the shipped
// _ROW_CHUNK_SIZE) of a 100-column table, at the dtypes the code names: float32
// through the Fourier expansion, compute dtype (bf16) after in_linear.
//
// Server-rendered SVG, zero JS. Every number and every bar width is a literal
// integer, so there is nothing for Node and the browser to disagree about.

type Param = { name: string; shape: string; count: string }

const PARAMS: Param[] = [
  { name: "fourier_frequencies", shape: "[3, 32]", count: "96" },
  { name: "fourier_frequencies_cat", shape: "[3, 32]", count: "96" },
  { name: "in_linear", shape: "[64 → 256]", count: "16,640" },
  { name: "in_linear_cat", shape: "[64 → 256]", count: "16,640" },
  { name: "y_embedder_lookup", shape: "[10, 256]", count: "2,560" },
]

type Step = {
  op: string
  shape: string
  dtype: string
  size: string
  // Bar widths are sqrt-scaled against the largest tensor and hardcoded as
  // integers; the byte counts beside them are the linear truth.
  w: number
  peak?: boolean
}

const STEPS: Step[] = [
  { op: "x — the table", shape: "[1, 4096, 100]", dtype: "bf16", size: "0.8 MiB", w: 11 },
  { op: "_group → gather ×3", shape: "[1, 4096, 100, 3, 1]", dtype: "f32", size: "4.7 MiB", w: 27 },
  { op: "g · ω — 32 freqs", shape: "[1, 4096, 100, 3, 32]", dtype: "f32", size: "150 MiB", w: 150 },
  { op: "cat(sin, cos)", shape: "[1, 4096, 100, 3, 64]", dtype: "f32", size: "300 MiB", w: 212 },
  { op: "in_linear — numeric", shape: "[1, 4096, 100, 3, 256]", dtype: "bf16", size: "600 MiB", w: 300 },
  { op: "in_linear_cat — always", shape: "[1, 4096, 100, 3, 256]", dtype: "bf16", size: "600 MiB", w: 300 },
  { op: "where(cat_mask, …)", shape: "[1, 4096, 100, 3, 256]", dtype: "bf16", size: "600 MiB", w: 300, peak: true },
  { op: ".sum(-2) → one/cell", shape: "[1, 4096, 100, 256]", dtype: "bf16", size: "200 MiB", w: 173 },
]

const W = 940
const ROW_H = 34
const TOP = 132
const BAR_X = 452

export function CellShapes() {
  const H = TOP + STEPS.length * ROW_H + 74

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        CellEmbedder · 36,032 parameters · one 4,096-row chunk of a 100-column table
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Two panels. The first itemises every weight in TabFM's cell embedder: two Fourier frequency tables of shape three by thirty-two at ninety-six weights each, two linear maps from sixty-four to two hundred fifty-six dimensions at sixteen thousand six hundred and forty each, and a ten by two hundred fifty-six label embedding of two thousand five hundred and sixty, summing to thirty-six thousand and thirty-two. The second panel is a ladder of the tensors those weights produce for one four-thousand-and-ninety-six-row chunk of a hundred-column table, drawn as bars: the table itself is under a megabyte; grouping each cell with two others makes it 4.7 megabytes; multiplying by thirty-two Fourier frequencies makes it 150 megabytes; concatenating sine and cosine makes it 300 megabytes; projecting to two hundred fifty-six dimensions makes it 600 megabytes, and that happens twice because the categorical path is computed for every cell whether or not the column is categorical; the where that picks between them is a third 600-megabyte tensor, so 1.76 gigabytes is live at once; summing over the group axis brings it back to 200 megabytes, one vector per cell."
      >
        {/* ---------------- panel 1: the parameters ---------------- */}
        <text x={20} y={18} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          THE PARAMETERS — every weight that reads a cell
        </text>

        {PARAMS.map((p, i) => (
          <g key={p.name}>
            <rect
              x={20 + i * 156}
              y={30}
              width={148}
              height={46}
              rx={4}
              className="fill-background stroke-border"
              strokeWidth={1.5}
            />
            <text x={29 + i * 156} y={46} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
              {p.name}
            </text>
            <text
              x={29 + i * 156}
              y={60}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {p.shape}
            </text>
            <text x={29 + i * 156} y={72} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
              {p.count}
            </text>
          </g>
        ))}

        <text x={806} y={50} className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          = 36,032
        </text>
        <text x={806} y={66} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          0.0022% of the
        </text>
        <text x={806} y={78} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          1,639,444,522
        </text>

        <line x1={20} y1={100} x2={W - 20} y2={100} className="stroke-border" strokeWidth={1} />

        {/* ---------------- panel 2: the activation ladder ---------------- */}
        <text x={20} y={120} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          THE ACTIVATIONS — what those 36,032 weights push around, per chunk
        </text>

        {STEPS.map((s, i) => {
          const y = TOP + i * ROW_H
          return (
            <g key={s.op}>
              <text x={20} y={y + 14} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {s.op}
              </text>
              <text
                x={196}
                y={y + 14}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {s.shape} · {s.dtype}
              </text>
              <rect
                x={BAR_X}
                y={y + 3}
                width={s.w}
                height={14}
                rx={2}
                className={s.peak ? "fill-foreground/60" : "fill-muted"}
              />
              <text
                x={BAR_X + s.w + 8}
                y={y + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {s.size}
              </text>
            </g>
          )
        })}

        {/* the brace beside the three 600 MiB tensors */}
        <path
          d={`M 812 ${TOP + 4 * ROW_H + 3} L 818 ${TOP + 4 * ROW_H + 3} L 818 ${
            TOP + 7 * ROW_H - 3
          } L 812 ${TOP + 7 * ROW_H - 3}`}
          fill="none"
          className="stroke-foreground/50"
          strokeWidth={1.5}
        />
        <text x={826} y={TOP + 5 * ROW_H + 10} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          1.76 GiB
        </text>
        <text
          x={826}
          y={TOP + 5 * ROW_H + 24}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          live at once
        </text>

        <g
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
          transform={`translate(20, ${TOP + STEPS.length * ROW_H + 22})`}
        >
          <text y={0}>
            Both projections run for every cell: the categorical head is computed on numeric columns and
            thrown away by the where.
          </text>
          <text y={15}>
            This is why _ROW_CHUNK_SIZE = 4096 exists — the code&rsquo;s own comment says the expansion
            &ldquo;materializes [B,T,HC,G,E]; chunk over rows
          </text>
          <text y={30}>
            so that huge intermediate never exists in full.&rdquo; A hundred columns is modest;
            max_num_features caps a member at 500, which is 5× these bars.
          </text>
        </g>
      </svg>
    </figure>
  )
}
