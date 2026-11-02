// OURS, measured: node counts of the compiled program for the card-grid component as it grows. SSR, zero JS.
// byN: K = 6 columns, N cards, texts from a seeded generator. byK: 12 cards, K columns.
// "ops" = affine + mul + relu + step nodes of the whole program (51 outputs at N = 12).
// "dag" = nodes the page height H reaches, shared sub-expressions counted once.
// "tree" = size of H written out as one expression with nothing shared.
const BY_N = [
  { x: 1, ops: 144, dag: 105, tree: 474 },
  { x: 2, ops: 235, dag: 170, tree: 953 },
  { x: 4, ops: 409, dag: 294, tree: 2964 },
  { x: 8, ops: 735, dag: 537, tree: 7689 },
  { x: 12, ops: 1042, dag: 770, tree: 13056 },
  { x: 16, ops: 1299, dag: 949, tree: 16431 },
  { x: 24, ops: 1781, dag: 1283, tree: 26295 },
  { x: 32, ops: 2272, dag: 1620, tree: 34302 },
  { x: 48, ops: 3114, dag: 2162, tree: 52734 },
  { x: 64, ops: 3902, dag: 2650, tree: 69261 },
]
const BY_K = [
  { x: 1, ops: 226, dag: 133, tree: 518 },
  { x: 2, ops: 404, dag: 254, tree: 1366 },
  { x: 3, ops: 561, dag: 380, tree: 2640 },
  { x: 4, ops: 723, dag: 509, tree: 4649 },
  { x: 5, ops: 881, dag: 638, tree: 7528 },
  { x: 6, ops: 1042, dag: 770, tree: 13056 },
  { x: 8, ops: 1370, dag: 1034, tree: 31768 },
]
const SERIES = [
  { k: "tree", label: "H as one unshared expression", color: "oklch(0.60 0.17 30)" },
  { k: "ops", label: "whole program (51 outputs at 12 cards)", color: "oklch(0.55 0.15 250)" },
  { k: "dag", label: "H with shared sub-expressions", color: "oklch(0.60 0.15 150)" },
] as const

function Panel({ data, xmax, title, xlabel }: { data: typeof BY_N; xmax: number; title: string; xlabel: string }) {
  const W = 300
  const H = 190
  const L = 42
  const R = 10
  const T = 14
  const B = 30
  const ymax = Math.max(...data.map((d) => d.tree))
  const sx = (x: number) => L + (x / xmax) * (W - L - R)
  const sy = (y: number) => H - B - (y / ymax) * (H - B - T)
  return (
    <div>
      <div className="mb-1 font-mono text-[11px] text-muted-foreground">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={title}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={sy(ymax * f)} y2={sy(ymax * f)} stroke="currentColor" strokeOpacity={0.15} />
            <text x={L - 4} y={sy(ymax * f) + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.6}>
              {Math.round((ymax * f) / 100) / 10}k
            </text>
          </g>
        ))}
        {SERIES.map((s) => (
          <polyline
            key={s.k}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            points={data.map((d) => `${sx(d.x).toFixed(1)},${sy(d[s.k]).toFixed(1)}`).join(" ")}
          />
        ))}
        {data.map((d) => (
          <text key={d.x} x={sx(d.x)} y={H - B + 12} textAnchor="middle" fontSize={9} fill="currentColor" fillOpacity={0.6}>
            {d.x}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>
          {xlabel}
        </text>
      </svg>
    </div>
  )
}

export function SizeScaling() {
  const last = BY_N[BY_N.length - 1]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        ours, measured: how big the compiled formula gets as the component grows
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        <Panel data={BY_N} xmax={64} title="cards (six columns possible)" xlabel="cards" />
        <Panel data={BY_K} xmax={8} title="possible column counts (twelve cards)" xlabel="max columns K" />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-2.5 font-mono text-[11px]">
        {SERIES.map((s) => (
          <span key={s.k} className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-0.5 w-4" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="border-t px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        at {last.x} cards: {last.ops.toLocaleString("en-US")} nodes in the program; H alone is {last.dag.toLocaleString("en-US")} shared or{" "}
        {last.tree.toLocaleString("en-US")} unshared
      </div>
    </figure>
  )
}
