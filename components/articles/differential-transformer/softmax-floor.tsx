"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mlog2, mpow } from "@/lib/dmath"

// Why softmax cannot say zero, and what that costs as context grows.
//
// One needle with logit gap D over n - 1 distractors that all sit at logit 0:
//   needle weight  p(n) = e^D / (e^D + n - 1)
//   gap for weight p    D = ln(p / (1 - p)) + ln(n - 1)
// Every distractor gets e^0 / (e^D + n - 1) > 0, and there are n - 1 of them, so
// at a fixed gap the needle's weight falls like 1/n. Holding it steady needs a
// gap that grows like ln n. Exact arithmetic, no data; the paper's own
// measurements are in the prose next to it.

const ACCENT = "oklch(0.64 0.15 250)"
const WARM = "oklch(0.70 0.17 45)"

const LOG2_LO = 5 // n = 32
const LOG2_HI = 16 // n = 65,536
const GAPS = [2, 4, 6, 8, 10, 12]

const W = 700
const H = 300
const PL = 44
const PR = 20
const PT = 16
const PB = 44

const x = (log2n: number) => PL + ((log2n - LOG2_LO) / (LOG2_HI - LOG2_LO)) * (W - PL - PR)
const y = (p: number) => PT + (1 - p) * (H - PT - PB)

const needle = (gap: number, n: number) => {
  const eg = mexp(gap)
  return eg / (eg + n - 1)
}
const gapFor = (p: number, n: number) => mlog(p / (1 - p)) + mlog(n - 1)

const SAMPLES = 90
const ts = Array.from({ length: SAMPLES }, (_, i) => LOG2_LO + ((LOG2_HI - LOG2_LO) * i) / (SAMPLES - 1))
const path = (gap: number) =>
  ts
    .map((t, i) => `${i === 0 ? "M" : "L"} ${x(t).toFixed(2)} ${y(needle(gap, mpow(2, t))).toFixed(2)}`)
    .join(" ")

const MARKS = [32, 4096, 65536]
const fmtN = (n: number) => n.toLocaleString("en-US")
const fmtP = (p: number) => (p >= 0.1 ? p.toFixed(2) : p >= 0.001 ? p.toFixed(4) : p.toExponential(1))

export function SoftmaxFloor() {
  const [gap, setGap] = useState(4)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        softmax weight on one needle, logit gap D over n − 1 distractors at logit 0
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Needle weight against context length on a log axis from 32 to 65,536 keys, for logit gaps from 2 to 12 nats. With a gap of ${gap} nats the needle gets ${fmtP(needle(gap, 32))} of the weight at 32 keys, ${fmtP(needle(gap, 4096))} at 4,096 and ${fmtP(needle(gap, 65536))} at 65,536. Holding half the weight needs a gap of ${gapFor(0.5, 32).toFixed(2)} nats at 32 keys and ${gapFor(0.5, 65536).toFixed(2)} at 65,536.`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <g key={p}>
              <line x1={PL} x2={W - PR} y1={y(p)} y2={y(p)} stroke="var(--border)" strokeWidth={1} />
              <text
                x={PL - 6}
                y={y(p) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {p}
              </text>
            </g>
          ))}
          {[5, 7, 9, 11, 13, 15].map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - PB + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {fmtN(mpow(2, t))}
            </text>
          ))}
          <text
            x={(PL + W - PR) / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            context length n (keys, log scale) →
          </text>

          {MARKS.slice(1).map((n) => (
            <line
              key={n}
              x1={x(mlog2(n))}
              x2={x(mlog2(n))}
              y1={PT}
              y2={H - PB}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeDasharray="3 4"
              strokeWidth={1}
              opacity={0.6}
            />
          ))}

          {GAPS.map((g) => (
            <g key={g}>
              <path
                d={path(g)}
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground"
                strokeWidth={1.1}
                opacity={0.45}
              />
              <text
                x={x(LOG2_LO) + 4}
                y={y(needle(g, 32)) - 4}
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                {g < 5 ? `D=${g}` : ""}
              </text>
            </g>
          ))}
          <path d={path(gap)} fill="none" stroke={ACCENT} strokeWidth={2.6} />
          {MARKS.map((n) => (
            <circle key={n} cx={x(mlog2(n))} cy={y(needle(gap, n))} r={3.5} fill={ACCENT} />
          ))}

          {/* where the gap would need to be to keep half the weight */}
          <text
            x={x(12) + 6}
            y={y(0.5) - 6}
            className="font-mono"
            fill={WARM}
            fontSize={9.5}
          >
            half the weight needs D = ln(n − 1)
          </text>
        </svg>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MARKS.map((n) => (
            <div key={n} className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">n = {fmtN(n)}</div>
              <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">needle weight at D = {gap}</span>
                  <span style={{ color: ACCENT }}>{fmtP(needle(gap, n))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">D for 50%</span>
                  <span style={{ color: WARM }}>{gapFor(0.5, n).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">D for 90%</span>
                  <span style={{ color: WARM }}>{gapFor(0.9, n).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>logit gap D between the needle and every distractor (nats)</span>
            <span className="text-foreground tabular-nums">{gap}</span>
          </span>
          <Range
            min={1}
            max={12}
            step={0.5}
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
        </label>
      </div>

      <p className="border-t px-3 py-3 text-sm leading-6 text-muted-foreground sm:px-4">
        Exact arithmetic, not a model. Softmax gives every key a weight of at least{" "}
        <span className="font-mono">e^(z_j − max z) / Σ</span>, which is never zero, and there are{" "}
        <span className="font-mono">n − 1</span>{" "}distractors to pay. At a fixed gap the needle&apos;s weight
        falls roughly as 1/n once n is large; to hold it steady the gap has to grow like{" "}
        <span className="font-mono">ln n</span>. Real distractors do not sit at one shared logit, and that makes
        things worse, not better: spreading their logits raises the expected sum the needle competes with,
        because the average of e^z is larger than e to the average z.
      </p>
    </figure>
  )
}
