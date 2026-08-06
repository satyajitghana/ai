"use client"

import { useState } from "react"

// Precision vs. recall for ADR and three baselines (ALRPHFS, GuardAgent,
// LlamaFirewall), toggled between the two benchmarks in the paper's Table 2:
// ADR-Bench (302 enterprise tasks, 42 malicious — severe class imbalance) and
// AgentDojo (93 academic prompt-injection tasks, close to balanced). The point
// worth seeing: baselines look almost competitive on AgentDojo, then collapse
// on ADR-Bench, where the false-positive counts (shown below the plot) make
// them unusable against a benign-heavy enterprise traffic mix.
//
// SSR-safe: fixed data, literal coordinates rounded to 2dp, no Date/Math.random.

const ACC = "oklch(0.68 0.14 200)" // teal — ADR
const MUTE = "oklch(0.62 0.02 260)" // gray — baselines
const FP_COLOR = "oklch(0.62 0.2 25)" // red-ish — false-positive emphasis

const r2 = (n: number) => Math.round(n * 100) / 100

type Point = { name: string; p: number; r: number; f1: number; fp: number; tasks: number }

type Bench = {
  label: string
  sub: string
  points: Point[]
}

const BENCH: Record<"adrbench" | "dojo", Bench> = {
  adrbench: {
    label: "ADR-Bench",
    sub: "302 enterprise tasks · 42 malicious, 260 benign",
    points: [
      { name: "ADR", p: 1.0, r: 0.667, f1: 0.8, fp: 0, tasks: 260 },
      { name: "ALRPHFS", p: 0.333, r: 0.405, f1: 0.366, fp: 34, tasks: 260 },
      { name: "GuardAgent", p: 0.231, r: 0.214, f1: 0.222, fp: 30, tasks: 260 },
      { name: "LlamaFirewall", p: 0.167, r: 0.19, f1: 0.178, fp: 40, tasks: 260 },
    ],
  },
  dojo: {
    label: "AgentDojo",
    sub: "93 prompt-injection tasks · 38 malicious, 55 benign",
    points: [
      { name: "ADR", p: 0.927, r: 1.0, f1: 0.962, fp: 3, tasks: 55 },
      { name: "ALRPHFS", p: 0.914, r: 0.842, f1: 0.877, fp: 3, tasks: 55 },
      { name: "GuardAgent", p: 0.771, r: 0.711, f1: 0.74, fp: 8, tasks: 55 },
      { name: "LlamaFirewall", p: 0.638, r: 0.974, f1: 0.771, fp: 21, tasks: 55 },
    ],
  },
}

const W = 640
const H = 400
const PL = 56, PR = 604, PT = 30, PB = 320
const xPix = (x: number) => r2(PL + x * (PR - PL))
const yPix = (y: number) => r2(PB - y * (PB - PT))
const TICKS = [0, 0.25, 0.5, 0.75, 1.0]

export function DetectorScatter() {
  const [key, setKey] = useState<"adrbench" | "dojo">("adrbench")
  const bench = BENCH[key]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>precision vs. recall · detector comparison</span>
        <span className="text-muted-foreground/50">{bench.sub}</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setKey("adrbench")}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            style={
              key === "adrbench"
                ? { background: ACC, color: "#fff" }
                : { background: "var(--muted)", color: "var(--muted-foreground)" }
            }
          >
            ADR-Bench
          </button>
          <button
            type="button"
            onClick={() => setKey("dojo")}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            style={
              key === "dojo"
                ? { background: ACC, color: "#fff" }
                : { background: "var(--muted)", color: "var(--muted-foreground)" }
            }
          >
            AgentDojo
          </button>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter of precision against recall on ${bench.label}. ${bench.points
            .map((pt) => `${pt.name}: precision ${pt.p.toFixed(3)}, recall ${pt.r.toFixed(3)}, F1 ${pt.f1.toFixed(3)}, ${pt.fp} false positives`)
            .join(". ")}.`}
        >
          {/* gridlines */}
          {TICKS.map((t) => (
            <g key={`v${t}`}>
              <line x1={xPix(t)} y1={PT} x2={xPix(t)} y2={PB} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={xPix(t)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          {TICKS.map((t) => (
            <g key={`h${t}`}>
              <line x1={PL} y1={yPix(t)} x2={PR} y2={yPix(t)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={PL - 8} y={yPix(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {t.toFixed(2)}
              </text>
            </g>
          ))}

          <text x={(PL + PR) / 2} y={PB + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            precision →
          </text>
          <text x={16} y={(PT + PB) / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10} transform={`rotate(-90 16 ${(PT + PB) / 2})`}>
            recall →
          </text>

          {/* points */}
          {bench.points.map((pt) => {
            const isADR = pt.name === "ADR"
            const cx = xPix(pt.p)
            const cy = yPix(pt.r)
            return (
              <g key={pt.name}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isADR ? 9 : 6}
                  fill={isADR ? ACC : MUTE}
                  fillOpacity={isADR ? 1 : 0.55}
                  stroke="var(--background)"
                  strokeWidth={1.5}
                />
                <text
                  x={cx}
                  y={cy - (isADR ? 15 : 12)}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={isADR ? 11 : 9}
                  fontWeight={isADR ? 600 : 400}
                  fill={isADR ? ACC : "var(--muted-foreground)"}
                >
                  {pt.name}
                </text>
                <text
                  x={cx}
                  y={cy + (isADR ? 24 : 20)}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  F1 {pt.f1.toFixed(3)}
                </text>
              </g>
            )
          })}
        </svg>

        {/* false-positive strip */}
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          {bench.points.map((pt) => (
            <div key={pt.name} className="rounded-lg border bg-muted/20 p-2">
              <div className="truncate font-mono text-[10px] text-muted-foreground">{pt.name}</div>
              <div
                className="font-mono text-base tabular-nums"
                style={{ color: pt.fp === 0 ? ACC : pt.fp >= 20 ? FP_COLOR : "var(--foreground)" }}
              >
                {pt.fp} FP
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">of {pt.tasks} benign</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          On <span className="text-foreground">AgentDojo</span>{" "}— a balanced academic prompt-injection set —
          every detector looks reasonable; ALRPHFS even nears ADR&apos;s precision. Switch to{" "}
          <span className="text-foreground">ADR-Bench</span>, built from real enterprise telemetry with a{" "}
          13.9% attack rate, and the baselines collapse: 30 to 40 false alarms out of 260 benign tasks, which is
          what &quot;unsuitable for production&quot; means in practice — that volume of false alarms would swamp
          a human review queue. ADR holds <span style={{ color: ACC }}>zero false positives</span>{" "}on both.
        </p>
      </div>
    </figure>
  )
}
