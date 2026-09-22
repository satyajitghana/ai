// Three renderings of one row of numbers: matplotlib's defaults, the
// figures4papers house style as published, and the house style with the y-axis
// baseline put back.
//
// The data is the AUROC column of `figure_ImmunoStruct/raw_data.py`
// (data_comparison_IEDB['mean'][:, 0] and ['std'][:, 0]), and the fills are that
// file's own `colors` list, verbatim. The house-style panel reproduces
// `figure_ImmunoStruct/plot_bars.py`: top and right spines off, axes.linewidth 3,
// x ticks hidden, error bars with capsize, ylim [0.5, 0.9].
//
// The point of the third panel is that it changes nothing the house style
// specifies. Spines, palette, error bars, hidden x ticks, legend panel — all
// identical. The only edit is `set_ylim([0.5, 0.9])` -> `set_ylim([0, 0.9])`,
// and that edit is not covered by any rule in the skill.
//
// Server-rendered, no JS. Every number here is reached by +, -, * and /, all of
// which are exact per IEEE-754, so nothing needs lib/dmath — see CLAUDE.md.
//
// The bar fills are literal hex on purpose. They are the artefact under
// discussion and must not drift with the theme, so the plot area sits on an
// explicit white plate, which is the background the palette was chosen for.
// Everything structural — axis lines, labels, captions — uses CSS vars.
//
// One deliberate infidelity: plot_bars.py passes no `edgecolor`, so the
// published bars have no outline at all and the palest green sits on white
// almost invisibly. At 236 viewBox units a bar that faint reads as a rendering
// bug rather than as a design choice, so these carry a 0.18-opacity hairline.
// That is the black edge the house style asks for and this script omits — see
// the compliance table in the article.

type Row = { label: string; short: string; fill: string; mean: number; std: number }

// figure_ImmunoStruct/raw_data.py, data_comparison_IEDB
const ROWS: Row[] = [
  { label: "Prime-2.1", short: "Prime", fill: "#CFCECE", mean: 0.538, std: 0.012 },
  { label: "NetMHCpan", short: "NetMHC", fill: "#F4EEAC", mean: 0.537, std: 0.027 },
  { label: "MHCnuggets", short: "nuggets", fill: "#FBDFE2", mean: 0.546, std: 0.023 },
  { label: "MHCflurry", short: "flurry", fill: "#D9B9D4", mean: 0.577, std: 0.021 },
  { label: "DeepNeo", short: "DeepNeo", fill: "#DAA87C", mean: 0.767, std: 0.032 },
  { label: "BigMHC-EL", short: "BM-EL", fill: "#DDF3DE", mean: 0.588, std: 0.018 },
  { label: "BigMHC-IM", short: "BM-IM", fill: "#AADCA9", mean: 0.684, std: 0.028 },
  { label: "BigMHC retrained", short: "BM-re", fill: "#8BCF8B", mean: 0.793, std: 0.013 },
  { label: "ImmunoStruct (ours)", short: "ours", fill: "#3775BA", mean: 0.882, std: 0.005 },
]

const MPL_C0 = "#1f77b4" // matplotlib's default prop cycle, first colour

const W = 236
const H = 176
const L = 36
const R = 8
const T = 12
const B = 30
const PW = W - L - R
const PH = H - T - B

type Panel = {
  key: string
  title: string
  lo: number
  hi: number
  ticks: number[]
  mono: boolean // one colour for every bar, matplotlib-default style
  boxed: boolean // all four spines
  xIndex: boolean // integer x tick labels instead of none
  err: boolean
}

const PANELS: Panel[] = [
  {
    key: "mpl",
    title: "matplotlib defaults",
    lo: 0,
    hi: 0.926,
    ticks: [0, 0.2, 0.4, 0.6, 0.8],
    mono: true,
    boxed: true,
    xIndex: true,
    err: false,
  },
  {
    key: "house",
    title: "figures4papers, as published",
    lo: 0.5,
    hi: 0.9,
    ticks: [0.5, 0.6, 0.7, 0.8, 0.9],
    mono: false,
    boxed: false,
    xIndex: false,
    err: true,
  },
  {
    key: "fixed",
    title: "same rules, baseline restored",
    lo: 0,
    hi: 0.9,
    ticks: [0, 0.2, 0.4, 0.6, 0.8],
    mono: false,
    boxed: false,
    xIndex: false,
    err: true,
  },
]

// Drawn height of a bar, in axis units, under a given floor.
const drawn = (v: number, lo: number) => Math.max(v - lo, 0)

const worst = ROWS[0] // Prime-2.1, the weakest baseline
const best = ROWS[ROWS.length - 1] // ImmunoStruct
const trueRatio = best.mean / worst.mean
const houseRatio = drawn(best.mean, 0.5) / drawn(worst.mean, 0.5)

function Chart({ p }: { p: Panel }) {
  const span = p.hi - p.lo
  const y = (v: number) => T + PH - ((v - p.lo) / span) * PH
  const step = PW / ROWS.length
  const bw = step * 0.78

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`AUROC for nine immunogenicity predictors, drawn ${p.title}. The y-axis runs from ${p.lo} to ${p.hi}.`}
    >
      {/* the white plate the palette was designed against */}
      <rect x={L} y={T} width={PW} height={PH} fill="#ffffff" />

      {p.ticks.map((t) => (
        <g key={t}>
          <line
            x1={L - 3}
            y1={y(t)}
            x2={L}
            y2={y(t)}
            stroke="var(--foreground)"
            strokeWidth={p.boxed ? 0.8 : 1.4}
          />
          <text
            x={L - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize={7.5}
          >
            {t.toFixed(1)}
          </text>
        </g>
      ))}

      {ROWS.map((r, i) => {
        const x = L + i * step + (step - bw) / 2
        const top = y(r.mean)
        const base = T + PH
        const h = Math.max(base - top, 0.4)
        return (
          <g key={r.label}>
            <rect
              x={x}
              y={top}
              width={bw}
              height={h}
              fill={p.mono ? MPL_C0 : r.fill}
              stroke="#000000"
              strokeOpacity={p.mono ? 0 : 0.18}
              strokeWidth={0.4}
            />
            {p.err ? (
              <g stroke="#111111" strokeWidth={0.9} fill="none">
                <line x1={x + bw / 2} y1={y(r.mean - r.std)} x2={x + bw / 2} y2={y(r.mean + r.std)} />
                <line x1={x + bw / 2 - 2.5} y1={y(r.mean + r.std)} x2={x + bw / 2 + 2.5} y2={y(r.mean + r.std)} />
                <line x1={x + bw / 2 - 2.5} y1={y(r.mean - r.std)} x2={x + bw / 2 + 2.5} y2={y(r.mean - r.std)} />
              </g>
            ) : null}
            {p.xIndex ? (
              <text
                x={x + bw / 2}
                y={T + PH + 10}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={7}
              >
                {i}
              </text>
            ) : null}
          </g>
        )
      })}

      {/* spines: all four on the matplotlib default, left + bottom otherwise */}
      <line x1={L} y1={T + PH} x2={L + PW} y2={T + PH} stroke="var(--foreground)" strokeWidth={p.boxed ? 0.8 : 2} />
      <line x1={L} y1={T} x2={L} y2={T + PH} stroke="var(--foreground)" strokeWidth={p.boxed ? 0.8 : 2} />
      {p.boxed ? (
        <>
          <line x1={L} y1={T} x2={L + PW} y2={T} stroke="var(--foreground)" strokeWidth={0.8} />
          <line x1={L + PW} y1={T} x2={L + PW} y2={T + PH} stroke="var(--foreground)" strokeWidth={0.8} />
        </>
      ) : null}

      <text
        x={10}
        y={T + PH / 2}
        textAnchor="middle"
        transform={`rotate(-90 10 ${T + PH / 2})`}
        className="fill-muted-foreground font-mono"
        fontSize={8}
      >
        AUROC
      </text>

      <text
        x={L + PW / 2}
        y={H - 5}
        textAnchor="middle"
        className="fill-muted-foreground font-mono"
        fontSize={7}
      >
        {p.xIndex ? "method index" : "method (see legend)"}
      </text>
    </svg>
  )
}

export function SameNineNumbers() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>ImmunoStruct IEDB · AUROC · nine methods</span>
        <span className="hidden text-muted-foreground/50 sm:inline">raw_data.py, verbatim</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-3">
          {PANELS.map((p) => (
            <div key={p.key}>
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">{p.title}</div>
              <Chart p={p} />
            </div>
          ))}
        </div>

        {/* legend — the house style spends a whole subplot on this */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3 font-mono text-[10px] text-muted-foreground">
          {ROWS.map((r) => (
            <span key={r.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-[2px] ring-1 ring-black/15"
                style={{ background: r.fill }}
              />
              {r.label} · {r.mean.toFixed(3)}
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Left is what you get with no style at all: one colour, four spines,
          integer tick labels, and a y-axis that starts at zero because that is
          matplotlib&apos;s default for bars. Middle is the published figure. It
          fixes everything the house style has a rule about — the palette carries
          rank, the chart junk is gone, the error bars are there — and it also
          moves the floor to{" "}
          <span className="text-foreground">0.5</span>. In that panel
          ImmunoStruct&apos;s bar is{" "}
          <span className="text-foreground">{houseRatio.toFixed(1)}x</span>{" "}
          the height of Prime-2.1&apos;s. The numbers are{" "}
          <span className="text-foreground">{trueRatio.toFixed(2)}x</span>{" "}
          apart. Right keeps every rule and puts the floor back.
        </p>
      </div>
    </figure>
  )
}
