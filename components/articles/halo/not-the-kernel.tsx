// Where the 2.8x is NOT: the expert kernel.
//
// "Beat TRL with a fused kernel" is the obvious hypothesis and Halo's own
// benchmark refutes it in four numbers. Both frameworks default to a grouped
// GEMM for the expert matmuls - transformers v5 routes gpt-oss and Qwen3-MoE
// experts through torch.nn.functional.grouped_mm, and Halo uses the same class of
// kernel. The per-expert loop is opt-in on both sides, which makes a clean 2x2.
//
// The load-bearing comparison is the dashed line: Halo running the SLOW kernel at
// EP1 (5,545 tok/s/GPU) is already 1.43x TRL running the FAST one (3,885). The
// kernel cannot be the explanation when giving Halo the worse one does not close
// the gap.
//
// All figures: agent-docs/optimization/halo-vs-stock-trl.md, 4k·b1, GC-on,
// TRL ZeRO-3, Halo ZeRO-2, gpt-oss-20b on 8x B300.
//
// Zero JS, linear axis, exact arithmetic.

type Row = {
  who: string
  detail: string
  loop: number
  grouped: number
  halo: boolean
}

const ROWS: Row[] = [
  { who: "stock TRL", detail: "ZeRO-3 · transformers v5 EP path", loop: 1940, grouped: 3885, halo: false },
  { who: "Halo EP1", detail: "32 experts per rank · dense DP=8", loop: 5545, grouped: 9009, halo: true },
  { who: "Halo EP2", detail: "16 per rank", loop: 5853, grouped: 10479, halo: true },
  { who: "Halo EP8", detail: "4 per rank", loop: 7282, grouped: 8320, halo: true },
]

const TRL_GROUPED = 3885
const X_MAX = 11000

export function NotTheKernel() {
  const W = 840
  const L = 176
  const R = 700
  const top = 78
  const rowH = 50
  const H = top + ROWS.length * rowH + 60
  const x = (v: number) => L + (v / X_MAX) * (R - L)

  const ticks = [0, 2500, 5000, 7500, 10000]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the expert kernel is not the gap · tokens/s/GPU at 4k·b1, gpt-oss-20b on 8× B300
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Four pairs of bars comparing a per-expert loop against a grouped GEMM expert kernel. Stock TRL runs 1,940 tokens per second per GPU on the loop and 3,885 on the grouped kernel, a doubling. Halo at expert-parallel size one runs 5,545 on the loop and 9,009 on the grouped kernel; at size two, 5,853 and 10,479; at size eight, 7,282 and 8,320, where the uplift collapses to 14 percent because each rank holds only four experts. A vertical line marks TRL's grouped-GEMM result at 3,885, and every Halo bar including the three slow-kernel ones sits to the right of it."
      >
        <text x={16} y={26} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          both frameworks default to grouped GEMM
        </text>
        <text x={16} y={40} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the per-expert loop is opt-in on both sides: --experts_impl eager for TRL, --no_grouped_gemm for Halo
        </text>

        <g className="font-mono" style={{ fontSize: 9.5 }}>
          <rect x={L} y={50} width={9} height={9} className="fill-muted-foreground/50" />
          <text x={L + 14} y={58} className="fill-muted-foreground">
            per-expert loop
          </text>
          <rect x={L + 130} y={50} width={9} height={9} className="fill-foreground/85" />
          <text x={L + 144} y={58} className="fill-muted-foreground">
            grouped GEMM
          </text>
        </g>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 8} x2={x(t)} y2={top + ROWS.length * rowH - 12} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={x(t)} y={top - 14} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t === 0 ? "0" : `${t / 1000}k`}
            </text>
          </g>
        ))}

        {/* TRL with its best kernel */}
        <line x1={x(TRL_GROUPED)} y1={top - 10} x2={x(TRL_GROUPED)} y2={top + ROWS.length * rowH - 6} className="stroke-destructive" strokeWidth={1.75} strokeDasharray="5 4" />

        {ROWS.map((r, i) => {
          const y = top + i * rowH
          return (
            <g key={r.who}>
              <text x={L - 12} y={y + 10} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {r.who}
              </text>
              <text x={L - 12} y={y + 21} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                {r.detail}
              </text>
              <text x={L - 12} y={y + 32} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                kernel uplift +{Math.round((100 * (r.grouped - r.loop)) / r.loop)}%
              </text>

              <rect x={x(0)} y={y} width={Math.max(1, x(r.loop) - x(0))} height={13} className="fill-muted-foreground/50" />
              <rect x={x(0)} y={y + 15} width={Math.max(1, x(r.grouped) - x(0))} height={13} className="fill-foreground/85" />

              <text x={x(r.loop) + 6} y={y + 11} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {r.loop.toLocaleString()}
                {r.halo ? `  (${(r.loop / TRL_GROUPED).toFixed(2)}× TRL's fast kernel)` : ""}
              </text>
              <text x={x(r.grouped) + 6} y={y + 26} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {r.grouped.toLocaleString()}
              </text>
            </g>
          )
        })}

        <text x={16} y={H - 30} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the dashed line is TRL with its <tspan className="fill-foreground">best</tspan> expert kernel. Halo with its <tspan className="fill-foreground">worst</tspan> one is already 1.43× past it at EP1.
        </text>
        <text x={16} y={H - 16} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          so the gap is token routing, the optimiser and the sharding default — not tiling. Halo&apos;s own docs say so: &quot;structural rather than kernel-level&quot;.
        </text>
      </svg>
    </figure>
  )
}
