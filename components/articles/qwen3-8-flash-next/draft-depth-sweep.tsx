"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// vcruz305/Qwen3.8-Flash-Next-EXL3-DGX-Spark-recipe, README as of 2026-09-07
// (fetched via `git clone --depth 1`). Two separate measurements on one DGX
// Spark (GB10, 128 GB unified memory), single in-flight request, turboderp's
// `3.05bpw_h5_ng5` EXL3 pack served through the author's own vllm-exl3 plugin.
//
// Sweep: MTP draft depth k against decode tok/s, 32K configured context,
// TTFT excluded. Run counts are NOT equal — four runs each for no-draft, k=1
// and k=2, but seven for k=3 — and k=3 is the config that loses. As a
// bar-of-means that asymmetry is invisible; the "means only" toggle below
// reproduces that view deliberately, on top of the real one.
//
// Long prompt: a separate, single probe at 122,902 input tokens (262,144
// configured), 128 output tokens. MTP k=2 wins decode (about 43 vs 26.2
// tok/s) and LOSES time-to-first-token (110.6s vs 107.0s) — the win is
// purely in decode, stated plainly because the recipe's own README says so.
//
// Every number below is reproduced verbatim from the README's "Headline" and
// "Long context" tables; nothing here is independently re-measured.

const MUTED = "oklch(0.62 0.03 250)"
const K1 = "oklch(0.68 0.13 85)"
const K2 = "oklch(0.55 0.16 155)"
const K3 = "oklch(0.58 0.19 27)"
const TTFT_C = "oklch(0.68 0.13 85)"
const DECODE_C = "oklch(0.55 0.16 155)"

type Row = { k: 0 | 1 | 2 | 3; label: string; color: string; runs: number[] }

const SWEEP: Row[] = [
  { k: 0, label: "no draft", color: MUTED, runs: [27.97, 27.56, 27.16, 27.35] },
  { k: 1, label: "k=1", color: K1, runs: [36.37, 33.8, 35.26, 35.28] },
  { k: 2, label: "k=2", color: K2, runs: [37.3, 38.88, 41.34, 39.32] },
  { k: 3, label: "k=3", color: K3, runs: [37.91, 34.44, 36.73, 38.18, 35.08, 37.35, 35.22] },
]

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

const LONG = {
  noDraft: { ttft: 107.0, decode: 26.2 },
  k2: { ttft: 110.6, decode: 43 },
}

export function DraftDepthSweep() {
  const [everyRun, setEveryRun] = useState(true)

  const W = 700
  const X0 = 150
  const X1 = 636
  const DOM0 = 26
  const DOM1 = 42
  const PX = (v: number) => X0 + ((v - DOM0) / (DOM1 - DOM0)) * (X1 - X0)
  const ROW_H = 38
  const TOP = 30
  const SWEEP_H = TOP + SWEEP.length * ROW_H + 14

  const k2Mean = mean(SWEEP[2].runs)
  const k0Mean = mean(SWEEP[0].runs)
  const lift = (k2Mean / k0Mean - 1) * 100

  // second panel: two grouped metrics, each its own scale
  const BW = 300
  const BX0 = 92
  const ttftMax = Math.max(LONG.noDraft.ttft, LONG.k2.ttft) * 1.08
  const decMax = Math.max(LONG.noDraft.decode, LONG.k2.decode) * 1.15
  const barW = (v: number, max: number) => (v / max) * BW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          MTP draft depth k, decode tok/s, one DGX Spark
        </span>
        <span className="font-mono text-[10px]" style={{ color: K2 }}>
          k=2 wins the mean · k=3 runs it seven times, not four
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">32K context, single request, TTFT excluded</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                [true, "every run"],
                [false, "means only"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setEveryRun(v)}
                aria-pressed={everyRun === v}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  everyRun === v
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${SWEEP_H}`} width={W} height={SWEEP_H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {everyRun
                ? `Draft depth sweep, every run plotted: no draft (4 runs, mean 27.51 tok/s), k=1 (4 runs, mean 35.18), k=2 (4 runs, mean 39.21, the fastest single run at 41.34), k=3 (7 runs, mean 36.42). k=2 has the highest mean despite fewer runs than k=3.`
                : `The same sweep with individual runs hidden, showing only the mean for each draft depth — the four-run and seven-run samples are no longer distinguishable.`}
            </title>

            {[28, 32, 36, 40].map((t) => (
              <g key={t}>
                <line x1={PX(t)} y1={TOP - 6} x2={PX(t)} y2={SWEEP_H - 20} stroke="currentColor" strokeOpacity={0.07} />
                <text x={PX(t)} y={SWEEP_H - 8} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {t}
                </text>
              </g>
            ))}

            {SWEEP.map((row, i) => {
              const y = TOP + i * ROW_H
              const m = mean(row.runs)
              return (
                <g key={row.k}>
                  <line x1={X0} y1={y} x2={X1} y2={y} stroke="currentColor" strokeOpacity={0.06} />
                  <text x={4} y={y + 4} fontSize={10} fill="currentColor" fillOpacity={0.8} fontFamily="ui-monospace, monospace">
                    {row.label}
                  </text>
                  <text x={4} y={y + 15} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {everyRun ? `n=${row.runs.length}` : "n=?"}
                  </text>

                  {everyRun &&
                    row.runs.map((v, ri) => (
                      <circle key={ri} cx={PX(v)} cy={y} r={3.4} fill={row.color} fillOpacity={0.55} />
                    ))}

                  {/* mean marker */}
                  <line x1={PX(m)} y1={y - 10} x2={PX(m)} y2={y + 10} stroke={row.color} strokeWidth={2.4} />
                  <text
                    x={PX(m)}
                    y={y - 14}
                    fontSize={8.5}
                    textAnchor="middle"
                    fill={row.color}
                    fontFamily="ui-monospace, monospace"
                  >
                    {m.toFixed(2)}
                  </text>
                </g>
              )
            })}

            {/* connecting line across means, so the k=2 peak / k=3 dip reads at a glance */}
            <path
              d={SWEEP.map((row, i) => `${i === 0 ? "M" : "L"} ${PX(mean(row.runs)).toFixed(2)} ${(TOP + i * ROW_H).toFixed(2)}`).join(
                " ",
              )}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeWidth={1.2}
              strokeDasharray="2 3"
            />

            <text x={(X0 + X1) / 2} y={16} fontSize={8} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              decode tok/s
            </text>
          </svg>
        </div>

        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          {everyRun
            ? "every dot is one measured run · the mean tick is the same statistic either view shows"
            : "means only — this is what a bar-of-means chart shows: k=3's extra three runs have vanished from view, not just from the plot"}
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              separate probe · 122,902-token prompt, 128 output tokens, one request
            </span>
            <span className="font-mono text-[10px]" style={{ color: DECODE_C }}>
              decode +64% · TTFT +3.4s
            </span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <svg viewBox={`0 0 ${W} 108`} width={W} height={108} role="img" className="min-w-[660px] max-w-full">
              <title>
                {`At 122,902 input tokens, time to first token is 107.0 seconds with no draft and 110.6 seconds with MTP k=2 — slightly slower. Decode is 26.2 tokens per second with no draft and about 43 with MTP k=2 — the entire win is in decode, not prefill.`}
              </title>
              {(
                [
                  { name: "time to first token (s)", nd: LONG.noDraft.ttft, k2: LONG.k2.ttft, max: ttftMax, color: TTFT_C, y: 8, worse: true },
                  { name: "decode (tok/s)", nd: LONG.noDraft.decode, k2: LONG.k2.decode, max: decMax, color: DECODE_C, y: 60, worse: false },
                ] as const
              ).map((m) => (
                <g key={m.name}>
                  <text x={0} y={m.y + 4} fontSize={8.5} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                    {m.name}
                  </text>
                  <text x={BX0 - 6} y={m.y + 14} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    no draft
                  </text>
                  <rect x={BX0} y={m.y + 6} width={Math.max(2, barW(m.nd, m.max))} height={10} rx={2} fill={MUTED} fillOpacity={0.75} />
                  <text x={BX0 + barW(m.nd, m.max) + 5} y={m.y + 14} fontSize={8} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                    {m.nd.toFixed(1)}
                  </text>

                  <text x={BX0 - 6} y={m.y + 30} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    MTP k=2
                  </text>
                  <rect x={BX0} y={m.y + 22} width={Math.max(2, barW(m.k2, m.max))} height={10} rx={2} fill={m.color} fillOpacity={0.85} />
                  <text
                    x={BX0 + barW(m.k2, m.max) + 5}
                    y={m.y + 30}
                    fontSize={8}
                    fill={m.color}
                    fontFamily="ui-monospace, monospace"
                  >
                    {m.k2.toFixed(1)} {m.worse ? "(slower)" : "(faster)"}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            { l: "k=2 mean, 32K", v: "39.21 tok/s", c: K2 },
            { l: "lift over no-draft", v: `+${lift.toFixed(1)}%`, c: K2 },
            { l: "k=3 sample size", v: "7 runs vs 4", c: K3 },
            { l: "123K-prompt TTFT", v: "110.6s vs 107.0s", c: TTFT_C },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Switch off &ldquo;every run&rdquo; and the chart doesn&rsquo;t just simplify — it hides the one fact that
          matters for reading it honestly. k=3&rsquo;s mean sits on seven runs, not four, and it is also the
          configuration that loses: more tokens drafted per step, more of them rejected, and the extra work costs
          more than it returns. That is the accepted-tokens-versus-draft-cost tradeoff this article covers for MTP
          in general, here with a number attached — k=2 beats no-draft by{" "}
          <span className="text-foreground">{lift.toFixed(1)}%</span> on the mean and by more on its best single run
          (41.34 tok/s), while k=3 gives some of that back despite running the sweep three extra times.
          <br />
          <br />
          The long-prompt probe is the more interesting result precisely because it complicates the story rather than
          confirming it. At 122,902 input tokens, MTP k=2 still wins decode convincingly —{" "}
          <span style={{ color: DECODE_C }}>about 43 tok/s against 26.2</span> — but it is slightly{" "}
          <em>slower</em>{" "}to first token, 110.6 seconds against 107.0. Prefill does not run through the draft
          model at all here, so that 3.6-second gap is scheduling and setup overhead, not the mechanism this article
          otherwise credits with a win. The recipe&rsquo;s own README says as much and doesn&rsquo;t round it away —
          MTP earns its keep entirely in decode, and the honest read is that it costs a little at the front of the
          response to buy a lot in the middle of it.
        </p>
      </div>
    </figure>
  )
}
