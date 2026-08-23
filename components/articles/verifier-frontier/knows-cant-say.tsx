"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The gap between having a signal and being able to state one.
//
// Below the switch-on point, accuracy and AUROC come apart. Accuracy reads the
// model's literal `Final verdict: Yes/No`; AUROC reads the soft score
// P(Yes) / (P(Yes) + P(No)), which exists whether or not the model manages to
// write a parseable verdict. On Countdown there is a whole band of sizes where
// the second is informative and the first is at chance: 0.23M scores 0.500
// accuracy and 0.842 AUROC.
//
// That band is the "knows but can't say" regime, and it has a practical
// consequence the project draws out: at 1M under a chain-of-thought target the
// model collapses entirely — not one of 1,200 outputs parses — while the same
// model trained on a verdict-only target reaches 0.826 on Countdown and 0.934 on
// Maze. The chain of thought was not helping the model think; it was a format the
// model could not hold, placed between the model and its answer.
//
// All numbers from the sub-1M appendix table.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Row = { label: string; p: number; cAcc: number; cAuc: number; mAcc: number; fAcc: number; fAuc: number }

const ROWS: Row[] = [
  { label: "Nano-70K", p: 0.07, cAcc: 0.5, cAuc: 0.513, mAcc: 0.5, fAcc: 0.509, fAuc: 0.502 },
  { label: "Nano-150K", p: 0.15, cAcc: 0.5, cAuc: 0.74, mAcc: 0.5, fAcc: 0.509, fAuc: 0.524 },
  { label: "Nano-230K", p: 0.23, cAcc: 0.5, cAuc: 0.842, mAcc: 0.5, fAcc: 0.509, fAuc: 0.5 },
  { label: "Nano-340K", p: 0.34, cAcc: 0.501, cAuc: 0.852, mAcc: 0.5, fAcc: 0.509, fAuc: 0.513 },
  { label: "Nano-630K", p: 0.63, cAcc: 0.848, cAuc: 0.863, mAcc: 0.5, fAcc: 0.509, fAuc: 0.701 },
  { label: "Tiny-1M", p: 1, cAcc: 0.826, cAuc: 0.891, mAcc: 0.934, fAcc: 0.609, fAuc: 0.64 },
]

const REGIMES = [
  {
    key: "nothing",
    label: "nothing",
    range: "≤ 0.07M",
    headline: "AUROC 0.51 · zero verdicts parse",
    body: "At 69 thousand parameters the model can neither judge nor format. This is the true bottom — no latent signal to recover, on any of the three tasks.",
    color: WARM,
  },
  {
    key: "knows",
    label: "knows, can't say",
    range: "0.15 – 0.34M",
    headline: "AUROC 0.74 → 0.85 · accuracy still exactly chance",
    body: "The P(Yes) probe ranks correct answers above wrong ones with real skill, and the written verdict is worthless. The model has the discrimination and cannot turn it into a calibrated Yes or No. This band exists only on Countdown, whose prompts are short enough for signal to survive.",
    color: ACCENT,
  },
  {
    key: "works",
    label: "it works",
    range: "≥ 0.63M",
    headline: "Countdown accuracy 0.85",
    body: "Jumps from chance at 0.34M to as good as the entire plateau above it — a 0.63M-parameter model matching what 7B achieves within a couple of points. Maze needs 1M and faithfulness 1–2M, but each of them jumps just as abruptly.",
    color: GOOD,
  },
] as const

export function KnowsCantSay() {
  const [sel, setSel] = useState("knows")
  const r = REGIMES.find((x) => x.key === sel) ?? REGIMES[0]

  const W = 720
  const H = 168
  const PAD = { l: 66, r: 96, t: 16, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const X = (i: number) => PAD.l + (i / (ROWS.length - 1)) * iw
  const Y = (v: number) => PAD.t + ih - ((v - 0.45) / 0.5) * ih
  const line = (k: "cAcc" | "cAuc") =>
    ROWS.map((row, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(row[k]).toFixed(1)}`).join(" ")

  const hi = sel === "nothing" ? [0] : sel === "knows" ? [1, 2, 3] : [4, 5]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Countdown below one million parameters · verdict-only target
        </span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          AUROC 0.84 at 0.500 accuracy
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {REGIMES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: x.color }} />
              {x.label} · {x.range}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full">
            <title>
              Countdown accuracy and AUROC across six sub-million-parameter verifiers. Accuracy stays pinned at
              chance until 0.63M while AUROC climbs steadily from 0.51 to 0.86.
            </title>
            {[0.5, 0.7, 0.9].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={g === 0.5 ? 0.28 : 0.09} strokeDasharray={g === 0.5 ? "3 3" : undefined} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g.toFixed(2)}
                </text>
              </g>
            ))}

            {hi.map((i) => (
              <rect
                key={i}
                x={X(i) - iw / (2 * (ROWS.length - 1))}
                y={PAD.t}
                width={iw / (ROWS.length - 1)}
                height={ih}
                fill={r.color}
                fillOpacity={0.09}
              />
            ))}

            <path d={line("cAuc")} fill="none" stroke={ACCENT} strokeWidth={2} />
            <path d={line("cAcc")} fill="none" stroke={WARM} strokeWidth={2} />
            {ROWS.map((row, i) => (
              <g key={row.label}>
                <circle cx={X(i)} cy={Y(row.cAuc)} r={3} fill={ACCENT} />
                <circle cx={X(i)} cy={Y(row.cAcc)} r={3} fill={WARM} />
                <text
                  x={X(i)}
                  y={PAD.t + ih + 14}
                  fontSize={9}
                  fill="currentColor"
                  fillOpacity={hi.includes(i) ? 0.9 : 0.4}
                  textAnchor="middle"
                  fontFamily="ui-monospace, monospace"
                >
                  {row.p < 1 ? `${Math.round(row.p * 1000)}K` : "1M"}
                </text>
              </g>
            ))}

            <text x={PAD.l + iw + 6} y={Y(ROWS[5].cAuc) + 3} fontSize={9} fill={ACCENT} fontFamily="ui-monospace, monospace">
              AUROC
            </text>
            <text x={PAD.l + iw + 6} y={Y(ROWS[5].cAcc) + 14} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              accuracy
            </text>
            <text x={4} y={PAD.t + 8} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              Countdown
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: r.color }}>
            {r.label} · {r.range} · {r.headline}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{r.body}</div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the same 1M model, two training targets, one frozen test set
          </div>
          <div className="mt-2 space-y-1">
            {[
              { l: "chain-of-thought target · Countdown", v: 0.5, note: "not one of 1,200 outputs emits a parseable verdict", c: WARM },
              { l: "verdict-only target · Countdown", v: 0.826, note: "matches the 2M–10M plateau", c: GOOD },
              { l: "chain-of-thought target · Maze", v: 0.5, note: "same collapse", c: WARM },
              { l: "verdict-only target · Maze", v: 0.934, note: "matches the entire ladder, up to 7B", c: GOOD },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2">
                <span className="w-56 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.l}</span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div className="h-4 rounded-sm" style={{ width: `${x.v * 100}%`, background: x.c }} />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                  {x.v.toFixed(3)}
                </span>
                <span className="hidden w-64 shrink-0 font-mono text-[9px] text-muted-foreground lg:inline">{x.note}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The bottom panel is the finding I would take away from this whole project. A one-million-parameter model
          asked to reason first and then answer produces{" "}
          <span className="text-foreground">zero usable verdicts out of twelve hundred</span>: it echoes the
          puzzle&rsquo;s numbers correctly and then degenerates into pretraining babble. Remove the requirement to
          write a rationale, train on the single verdict token, and the same model on the same frozen test set
          reaches 0.826 and 0.934.
          <br />
          <br />
          Chain of thought is usually framed as a capability you unlock. At this scale it is a format cost you
          impose, and the model pays for it with the only thing it was asked to produce. The discrimination was
          always there — the AUROC line says so three sizes earlier — it just could not survive being routed
          through a paragraph.
        </p>
      </div>
    </figure>
  )
}
