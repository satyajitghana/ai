"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why the plot in the post has error bars you can drive a bus through.
//
// The post is unusually candid about this: "it's very difficult to estimate the
// exact speed-ups because it's highly dependent on the latency of the tools, the
// number of tokens generated, the load of your serving engine, and the actual
// choices the harness makes." That last clause is the killer. An RLM decides at
// runtime how many sub-calls to make and how many turns to take, so two runs of
// the same task on the same model are not two samples of one quantity — they
// are two different amounts of work.
//
// This control puts a known speed-up into a simulated experiment and asks
// whether n runs can see it. Everything is a deterministic Lehmer generator, so
// the same settings always produce the same experiment; only the seed moves it.
//
// The point is not that the effect is fake. The mechanism plainly works — you
// can see it in the timeline above without measuring anything. The point is that
// a five-run experiment over trajectories that vary by ±40% cannot resolve
// 1.15×, and the honest thing to report in that situation is what the post
// reports: a range, and the reason it is a range.

const ACCENT = "oklch(0.42 0.05 250)"
const WARM = "oklch(0.62 0.16 35)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

// two-sided 95% t critical values, df = n - 1
const TCRIT: Record<number, number> = {
  2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262,
  10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12,
  17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 24: 2.064, 29: 2.045, 39: 2.023,
}
const tcrit = (df: number) => {
  if (df <= 1) return 12.706
  if (TCRIT[df]) return TCRIT[df]
  const keys = Object.keys(TCRIT).map(Number).sort((a, b) => a - b)
  const k = keys.find((x) => x >= df)
  return k ? TCRIT[k] : 1.96
}

const BASE_WALL = 1000 // arbitrary seconds, the scale does not matter

export function VarianceTrap() {
  const [runs, setRuns] = useState(5)
  const [spread, setSpread] = useState(40) // ± percent of trajectory-length variation
  const [effect, setEffect] = useState(115) // the true speed-up, as a percent
  const [seed, setSeed] = useState(7)

  // Lehmer / Park-Miller. Only integer multiply and modulo, both exact at these
  // magnitudes, so server and client agree bit for bit.
  let s = (seed * 48271 + 11) % 2147483647 || 1
  const rnd = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }

  const v = spread / 100
  const speedup = effect / 100

  const base: number[] = []
  const spec: number[] = []
  for (let i = 0; i < runs; i++) {
    // how much work this trajectory happened to be — shared by both arms,
    // because it is a property of the task, not of the schedule
    const work = 1 - v + 2 * v * rnd()
    // the trajectories are re-rolled per arm: the harness makes its own choices
    const work2 = 1 - v + 2 * v * rnd()
    base.push(BASE_WALL * work)
    spec.push((BASE_WALL * work2) / speedup)
  }

  const stat = (xs: number[]) => {
    const n = xs.length
    const m = xs.reduce((a, b) => a + b, 0) / n
    const ss = xs.reduce((a, b) => a + (b - m) * (b - m), 0)
    const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0
    const half = n > 1 ? (tcrit(n - 1) * sd) / Math.sqrt(n) : 0
    return { m, sd, lo: m - half, hi: m + half, half }
  }

  const B = stat(base)
  const S = stat(spec)
  const overlap = S.hi >= B.lo
  const observed = B.m / S.m

  // how many runs would separate the intervals, at this variance and effect
  const pooledSd = (B.sd + S.sd) / 2
  const gap = Math.abs(B.m - S.m)
  const halfWidths = gap > 0 ? (2 * 2.0 * pooledSd) / gap : 0
  const needed = gap > 0 ? Math.max(2, Math.ceil(halfWidths * halfWidths)) : 999

  const W = 700
  const H = 168
  const X0 = 92
  const MAXV = Math.max(B.hi, ...base, ...spec) * 1.08
  const px = (t: number) => X0 + (t / MAXV) * (W - X0 - 96)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          a simulated experiment with a known {speedup.toFixed(2)}× effect
        </span>
        <span className="font-mono text-[10px]" style={{ color: overlap ? BAD : GOOD }}>
          {overlap ? "intervals overlap — not resolved" : "intervals separate — resolved"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`Two horizontal bars of mean wall time with 95% t-intervals, over ${runs} simulated runs with a true speed-up of ${speedup.toFixed(2)} times. The observed ratio is ${observed.toFixed(2)} times and the intervals ${overlap ? "overlap, so the experiment cannot rule out no effect" : "do not overlap"}.`}
            </title>

            {(
              [
                ["base RLM", B, base, ACCENT, 24],
                ["+ spec PTC", S, spec, WARM, 84],
              ] as const
            ).map(([label, st, xs, colour, y]) => (
              <g key={label}>
                <text x={X0 - 10} y={y + 13} fontSize={9} textAnchor="end" fill={colour} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
                <rect x={px(0)} y={y} width={Math.max(2, px(st.m) - px(0))} height={20} rx={3} fill={colour} fillOpacity={0.7} />
                {/* the 95% t-interval */}
                <line x1={px(Math.max(0, st.lo))} y1={y + 10} x2={px(st.hi)} y2={y + 10} stroke="currentColor" strokeWidth={1.4} />
                {[Math.max(0, st.lo), st.hi].map((e) => (
                  <line key={e} x1={px(e)} y1={y + 4} x2={px(e)} y2={y + 16} stroke="currentColor" strokeWidth={1.4} />
                ))}
                {/* the individual runs */}
                {xs.map((x, i) => (
                  <circle key={i} cx={px(x)} cy={y + 28} r={2.4} fill={colour} fillOpacity={0.55} />
                ))}
                <text x={px(st.hi) + 8} y={y + 13} fontSize={8.5} fill={colour} fontFamily="ui-monospace, monospace">
                  {st.m.toFixed(0)}s
                </text>
                <text x={X0 - 10} y={y + 31} fontSize={7} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  {runs} runs
                </text>
              </g>
            ))}

            <line x1={X0} y1={140} x2={W - 96} y2={140} stroke="currentColor" strokeOpacity={0.2} />
            <text x={X0} y={154} fontSize={7.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              0
            </text>
            <text x={W - 96} y={154} fontSize={7.5} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
              wall time →
            </text>
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          {(
            [
              ["runs each", runs, setRuns, 3, 40, 1, ACCENT, "how many times each arm is repeated"],
              ["trajectory ±", spread, setSpread, 0, 70, 5, WARM, "how much the amount of work varies from run to run, as a percentage"],
              ["true speed-up", effect, setEffect, 100, 160, 1, GOOD, "the real underlying effect, as a percentage"],
              ["seed", seed, setSeed, 1, 40, 1, "oklch(0.55 0.10 300)", "which draw of the experiment to look at"],
            ] as const
          ).map(([label, val, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={val}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {label === "true speed-up" ? `${(val / 100).toFixed(2)}×` : label === "trajectory ±" ? `${val}%` : val}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "true speed-up", v: `${speedup.toFixed(2)}×`, c: GOOD },
            { l: "observed", v: `${observed.toFixed(2)}×`, c: Math.abs(observed - speedup) > 0.1 ? BAD : WARM },
            {
              l: "runs to separate",
              v: needed > 400 ? "—" : `≈ ${needed}`,
              c: needed > runs ? BAD : GOOD,
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 font-mono text-[9px] text-muted-foreground">
          simulated, not measured — a deterministic generator with a known effect planted in it
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Leave the true effect at 1.15× and walk the seed slider through a few values at five runs.
          The observed ratio wanders from well under 1 to well over 1.3, and the intervals overlap
          almost every time. That is not a defect of the simulation; it is what the post&rsquo;s own
          plot looks like, and it is why the post reports a range rather than a number.
          <br />
          <br />
          The reason is that an RLM chooses its own trajectory. Two runs of the same task are not
          two measurements of one quantity — they are{" "}
          <span className="text-foreground">two different amounts of work</span>, and the spread
          between them dwarfs a 15% scheduling gain. Drag the trajectory slider to zero and five
          runs resolve the effect instantly; drag it back up and watch how many runs the third
          readout starts asking for. This is the tax on benchmarking anything agentic, and it is
          the reason to trust the mechanism here more than the measurement of it.
        </p>
      </div>
    </figure>
  )
}
