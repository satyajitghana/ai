// "Up to 2.8× the throughput of stock TRL" — against which TRL?
//
// Halo publishes the whole matrix, which is the reason this chart can exist. All
// twenty-five cells below are `agent-docs/optimization/halo-vs-stock-trl.md`,
// transcribed: gpt-oss-20b on 8× B300, bf16, FA4 + Liger, grouped_mm experts,
// gradient checkpointing on, synthetic fixed-length data, tokens/s/GPU.
//
// The distinction the chart draws is the one that decides how to read the
// headline. Stock TRL runs FSDP2 `full_shard`, which is ZeRO-3: it re-gathers
// all 20.7B parameters every micro-step. Halo's default is ZeRO-2. So the
// columns marked "sharding differs" compare two different memory strategies as
// well as two frameworks, and the one marked "matched" does not.
//
// Both readings are Halo's own. The README quotes the matched one — "2.7× at 25%
// less peak memory when both sides shard ZeRO-3" — which reproduces exactly from
// the 16k·b1 row: 17,464 ÷ 6,513 = 2.68 at 37.9 GB against 50.6.
//
// Zero JS, exact arithmetic throughout.

type Cell = { tps: number; gb: number }
type Shape = {
  shape: string
  trl: Cell
  ep1z2: Cell
  ep1z3: Cell
  ep2z2: Cell
  ep8z2: Cell
}

const SHAPES: Shape[] = [
  { shape: "4k·b1", trl: { tps: 3885, gb: 47.6 }, ep1z2: { tps: 9009, gb: 60 }, ep1z3: { tps: 5560, gb: 28.7 }, ep2z2: { tps: 10479, gb: 77 }, ep8z2: { tps: 8320, gb: 26 } },
  { shape: "4k·b2", trl: { tps: 5519, gb: 48.2 }, ep1z2: { tps: 15429, gb: 67 }, ep1z3: { tps: 6874, gb: 29.3 }, ep2z2: { tps: 15314, gb: 77 }, ep8z2: { tps: 9352, gb: 37 } },
  { shape: "4k·b4", trl: { tps: 6759, gb: 50.6 }, ep1z2: { tps: 18823, gb: 81 }, ep1z3: { tps: 10082, gb: 41.6 }, ep2z2: { tps: 17949, gb: 91 }, ep8z2: { tps: 10128, gb: 53 } },
  { shape: "16k·b1", trl: { tps: 6513, gb: 50.6 }, ep1z2: { tps: 18304, gb: 76 }, ep1z3: { tps: 17464, gb: 37.9 }, ep2z2: { tps: 16407, gb: 85 }, ep8z2: { tps: 9747, gb: 49 } },
  { shape: "16k·b2", trl: { tps: 7466, gb: 55.6 }, ep1z2: { tps: 20730, gb: 107 }, ep1z3: { tps: 18742, gb: 68.4 }, ep2z2: { tps: 17219, gb: 124 }, ep8z2: { tps: 9552, gb: 92 } },
]

type Col = { key: keyof Omit<Shape, "shape">; label: string; sharding: string; matched: boolean }

const COLS: Col[] = [
  { key: "ep1z2", label: "EP1", sharding: "ZeRO-2", matched: false },
  { key: "ep2z2", label: "EP2", sharding: "ZeRO-2", matched: false },
  { key: "ep8z2", label: "EP8", sharding: "ZeRO-2", matched: false },
  { key: "ep1z3", label: "EP1", sharding: "ZeRO-3 — matched", matched: true },
]

export function ShardingGrid() {
  const W = 840
  const L = 96
  const colW = 176
  const headTop = 54
  const rowTop = 96
  const rowH = 40
  const H = rowTop + SHAPES.length * rowH + 62

  const MAX = 3
  const barW = 116
  const bw = (r: number) => Math.min(barW, (barW * r) / MAX)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Halo ÷ stock TRL, tokens/s/GPU · gpt-oss-20b on 8× B300 · peak GB underneath
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[800px]"
        role="img"
        aria-label="A grid of Halo-over-TRL throughput ratios for five training shapes and four Halo configurations. In the three left columns, where Halo runs ZeRO-2 against TRL's ZeRO-3, the ratios run from 1.28 to 2.81 times, with expert-parallel size one and two reaching the high twos. In the right column, where both sides shard ZeRO-3 and the comparison is matched, the ratios are 1.43, 1.25 and 1.49 at four-thousand-token sequences but 2.68 and 2.51 at sixteen thousand, because ZeRO-3's parameter re-gather is a fixed cost that a short step cannot hide. Peak memory is printed under each cell; the matched column uses less memory than TRL in every row."
      >
        {COLS.map((c, ci) => (
          <g key={c.key}>
            <text x={L + ci * colW + barW / 2} y={headTop - 12} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              Halo {c.label}
            </text>
            <text
              x={L + ci * colW + barW / 2}
              y={headTop + 2}
              textAnchor="middle"
              className={c.matched ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              style={{ fontSize: 9 }}
            >
              {c.sharding}
            </text>
          </g>
        ))}
        <text x={16} y={headTop - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          shape
        </text>
        <text x={16} y={headTop + 2} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          TRL ZeRO-3
        </text>

        {/* separate the matched column */}
        <line x1={L + 3 * colW - 18} y1={headTop - 26} x2={L + 3 * colW - 18} y2={rowTop + SHAPES.length * rowH - 6} className="stroke-border" strokeWidth={1.5} />

        {SHAPES.map((s, ri) => {
          const y = rowTop + ri * rowH
          return (
            <g key={s.shape}>
              <text x={16} y={y + 11} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {s.shape}
              </text>
              <text x={16} y={y + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                {s.trl.tps.toLocaleString()} · {s.trl.gb} GB
              </text>
              {COLS.map((c, ci) => {
                const cell = s[c.key]
                const r = cell.tps / s.trl.tps
                const x0 = L + ci * colW
                return (
                  <g key={c.key}>
                    <rect x={x0} y={y} width={barW} height={13} className="fill-muted/60" />
                    <rect x={x0} y={y} width={bw(r)} height={13} className={c.matched ? "fill-destructive" : "fill-foreground/80"} />
                    <text x={x0 + bw(r) + 5} y={y + 11} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                      {r.toFixed(2)}×
                    </text>
                    <text x={x0} y={y + 24} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                      {cell.tps.toLocaleString()} · {cell.gb} GB
                      {cell.gb < s.trl.gb ? `  (−${(100 - (100 * cell.gb) / s.trl.gb).toFixed(0)}% mem)` : ""}
                    </text>
                  </g>
                )
              })}
            </g>
          )
        })}

        <line x1={16} y1={H - 44} x2={W - 16} y2={H - 44} className="stroke-border" strokeWidth={1} />
        <text x={16} y={H - 28} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the headline 2.8× is the left three columns — Halo&apos;s ZeRO-2 default against TRL&apos;s ZeRO-3 default, which re-gathers 20.7B params every micro-step
        </text>
        <text x={16} y={H - 14} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          matched at ZeRO-3 the gap is 1.25–1.49× at 4k and 2.51–2.68× at 16k, at less memory in every row — and that is the number Halo&apos;s own README quotes
        </text>
      </svg>
    </figure>
  )
}
