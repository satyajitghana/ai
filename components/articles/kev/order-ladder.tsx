// Option-order sensitivity is a continuum, and this is what it looks like when
// you put every committed measurement on one axis.
//
// Three articles on this site have treated order-invariance as a binary — a
// per-option scorer cannot express the failure, a vocabulary readout cannot avoid
// it. Kev's own trial ledger says the boundary is real but almost nobody is on
// it. The option_isolation arm sits at 2e-7, which is fp32 noise and the only
// honest reading of "invariant by construction". Every ordinary Kev sits between
// 0.033 and 0.090. Jev sits at 0.020, five orders of magnitude above the arm
// that is exactly invariant and a third of the way down to the smallest Kev.
//
// x is log10 of the mean per-question maximum probability change under a
// permuted option list; the label on each row is the argmax flip rate at that
// point. Numbers pooled from every committed report.json and result.json in
// jaredpalmer/kev at 1c35199 (see public/articles/kev/data/option-order.json).
//
// Server-rendered SVG, zero JS. mlog10 from lib/dmath so the server and the
// browser serialize the same coordinates.

import { mlog10 } from "@/lib/dmath"

type Row = {
  label: string
  sub: string
  delta: number
  flip: string
  mark: "arm" | "jev" | "kev"
}

const ROWS: Row[] = [
  {
    label: "option_isolation arm",
    sub: "18 evals · 864 items · 0 flips",
    delta: 2e-7,
    flip: "0.0%",
    mark: "arm",
  },
  {
    label: "Jev 1.13, hosted",
    sub: "7 runs · 324 items · 0 flips",
    delta: 0.0202,
    flip: "0.0%",
    mark: "jev",
  },
  {
    label: "Kev, Qwen3.5-9B",
    sub: "14 evals · 672 items · 12 flips",
    delta: 0.0326,
    flip: "1.8%",
    mark: "kev",
  },
  {
    label: "Kev, Qwen3.5-4B",
    sub: "32 evals · 1,536 items · 59 flips",
    delta: 0.0369,
    flip: "3.8%",
    mark: "kev",
  },
  {
    label: "Kev, Qwen3.5-0.8B",
    sub: "10 evals · 480 items · 29 flips",
    delta: 0.0544,
    flip: "6.0%",
    mark: "kev",
  },
  {
    label: "Kev, Qwen2.5-0.5B prototype",
    sub: "10 evals · 504 items · 77 flips",
    delta: 0.0895,
    flip: "15.3%",
    mark: "kev",
  },
]

const LO = -7.5
const HI = -0.7

export function OrderLadder() {
  const W = 820
  const top = 96
  const rowH = 40
  const H = top + ROWS.length * rowH + 58

  const xAxis = 300
  const axisW = 456
  const pos = (d: number) => {
    const t = (mlog10(d) - LO) / (HI - LO)
    return xAxis + Math.round(t * axisW)
  }

  const ticks: { at: number; text: string }[] = [
    { at: 1e-7, text: "1e-7" },
    { at: 1e-5, text: "1e-5" },
    { at: 1e-3, text: "0.001" },
    { at: 1e-2, text: "0.01" },
    { at: 1e-1, text: "0.1" },
  ]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        how far the probabilities move when the option list is shuffled
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A logarithmic ladder of mean maximum probability change under a shuffled option list. Kev's option-isolation arm sits at 2e-7 over 18 evaluations and 864 items with zero answer flips. Jev 1.13 sits at 0.0202 over seven runs and 324 items, also with zero flips. Kev on Qwen3.5-9B sits at 0.0326 with a 1.8 percent flip rate, Qwen3.5-4B at 0.0369 with 3.8 percent, Qwen3.5-0.8B at 0.0544 with 6.0 percent, and the Qwen2.5-0.5B prototype at 0.0895 with 15.3 percent. A note marks the isolation arm as fp32 noise and observes that Jev flips nothing while still moving five orders of magnitude more than the arm that is invariant by construction."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={16} y={26}>
            zero flips is not the same measurement as zero movement
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={16} y={44}>
            and only one row here is actually at zero
          </text>
          <text x={16} y={72}>
            model / arm
          </text>
          <text x={xAxis} y={72}>
            mean max Δp, log scale
          </text>
        </g>
        <line
          x1={16}
          y1={78}
          x2={W - 16}
          y2={78}
          className="stroke-border"
          strokeWidth={1}
        />

        {ticks.map((t) => (
          <g key={t.text}>
            <line
              x1={pos(t.at)}
              y1={top - 6}
              x2={pos(t.at)}
              y2={top + ROWS.length * rowH - 12}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.6}
            />
            <text
              x={pos(t.at)}
              y={top + ROWS.length * rowH + 4}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {t.text}
            </text>
          </g>
        ))}

        {ROWS.map((row, i) => {
          const y = top + i * rowH
          const cx = pos(row.delta)
          const r = row.mark === "kev" ? 6 : 7
          return (
            <g key={row.label}>
              <text
                x={16}
                y={y + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.label}
              </text>
              <text
                x={16}
                y={y + 27}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {row.sub}
              </text>
              <line
                x1={xAxis}
                y1={y + 10}
                x2={cx}
                y2={y + 10}
                className="stroke-border"
                strokeWidth={1}
              />
              <circle
                cx={cx}
                cy={y + 10}
                r={r}
                className={
                  row.mark === "arm"
                    ? "fill-background stroke-foreground/70"
                    : row.mark === "jev"
                      ? "fill-foreground stroke-foreground"
                      : "fill-foreground/35 stroke-foreground/60"
                }
                strokeWidth={row.mark === "kev" ? 1 : 1.5}
              />
              <text
                x={cx + r + 8}
                y={y + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {row.delta < 1e-5 ? "2e-7" : row.delta.toFixed(4)}
              </text>
              <text
                x={cx + r + 62}
                y={y + 14}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                flips {row.flip}
              </text>
            </g>
          )
        })}

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          <text x={16} y={H - 26}>
            hollow = permutation-invariant by construction (the movement left is
            fp32 noise) · solid = the hosted model · grey = an ordinary Kev
          </text>
          <text x={16} y={H - 12}>
            items repeat across trials of one suite: this is a population of
            checkpoints, not a population of questions
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Every suite ships a <code>permuted</code> variant of each Choice question;{" "}
        <code>kev.benchmark.summarize</code> realigns it to its parent by option
        key and records both numbers. Jev flips nothing in 324 permuted questions
        across seven runs — and moves 0.0202, which is 100,000× the arm that
        cannot move at all. Kev&apos;s own <code>PLAN.md</code> draws the same
        conclusion in one line: &ldquo;Jev&apos;s zero observed argmax flips do
        not prove architectural invariance. Its probabilities move under
        permutation.&rdquo;
      </figcaption>
    </figure>
  )
}
