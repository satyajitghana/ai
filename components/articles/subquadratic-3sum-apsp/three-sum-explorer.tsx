"use client"

// Two halves. The top runs the textbook quadratic 3SUM (sort, then for each i
// walk two pointers inward) on a small fixed array, one comparison per click,
// and counts comparisons against n^2/2. The bottom is the gap between that
// baseline and the new bound: the speedup the exponent alone buys is
// n^(2 - 1.999125) = n^0.000875 (Theorem 22 of arXiv 2610.06783, via
// Corollary 26), computed here in log space because the interesting n have
// hundreds of digits. Constants are ignored, which flatters the new algorithm.
//
// Dual-native: the article's prose gives the same walk-through and the same
// thresholds (2x at n = 2^1143, about 10^344).

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

const ARR = [-25, -10, -7, -3, 2, 4, 8, 10] // sorted; -10 + 2 + 8 = 0 and -7 + -3 + 10 = 0

type Step = { i: number; lo: number; hi: number; sum: number; hit: boolean }

function trace(a: number[]): Step[] {
  const out: Step[] = []
  for (let i = 0; i < a.length - 2; i++) {
    let lo = i + 1
    let hi = a.length - 1
    while (lo < hi) {
      const s = a[i] + a[lo] + a[hi]
      out.push({ i, lo, hi, sum: s, hit: s === 0 })
      if (s === 0) {
        lo++
        hi--
      } else if (s < 0) lo++
      else hi--
    }
  }
  return out
}

// log10 of the speedup n^0.000875 for n = 10^e
const SAVE = 2 - 1.999125

export function ThreeSumExplorer() {
  const steps = useMemo(() => trace(ARR), [])
  const [k, setK] = useState(0)
  const [e, setE] = useState(9)
  const st = steps[Math.min(k, steps.length - 1)]
  const hits = steps.slice(0, k + 1).filter((s) => s.hit)
  const n = ARR.length

  const speedLog = e * SAVE // log10 of n^0.000875
  const speed = speedLog < 6 ? mpow(10, speedLog) : null

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="mb-2 font-mono text-xs text-muted-foreground">
        textbook 3SUM: sort, fix a[i], walk two pointers inward
      </div>
      <div className="flex flex-wrap gap-1.5 font-mono text-sm">
        {ARR.map((v, j) => {
          const role = j === st.i ? "i" : j === st.lo ? "lo" : j === st.hi ? "hi" : ""
          const tone =
            role === "i"
              ? "border-blue-500 bg-blue-500/15"
              : role
                ? "border-orange-500 bg-orange-500/15"
                : j < st.i
                  ? "opacity-40"
                  : ""
          return (
            <div key={j} className={`flex w-12 flex-col items-center rounded border px-1 py-1 ${tone}`}>
              <span>{v}</span>
              <span className="text-[10px] text-muted-foreground">{role || " "}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          type="button"
          className="rounded border px-2 py-1 hover:bg-muted"
          onClick={() => setK((x) => Math.max(0, x - 1))}
        >
          back
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 hover:bg-muted"
          onClick={() => setK((x) => Math.min(steps.length - 1, x + 1))}
        >
          next comparison
        </button>
        <button type="button" className="rounded border px-2 py-1 hover:bg-muted" onClick={() => setK(0)}>
          reset
        </button>
        <span className="text-muted-foreground">
          comparison {k + 1} of {steps.length} (n = {n}, n²/2 = {(n * n) / 2})
        </span>
      </div>
      <p className="mt-2 font-mono text-xs">
        {ARR[st.i]} + {ARR[st.lo]} + {ARR[st.hi]} = {st.sum}{" "}
        {st.hit ? "→ zero, a solution" : st.sum < 0 ? "→ too small, move lo right" : "→ too big, move hi left"}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        found so far:{" "}
        {hits.length === 0
          ? "none"
          : hits.map((h) => `(${ARR[h.i]}, ${ARR[h.lo]}, ${ARR[h.hi]})`).join("  ")}
      </p>

      <div className="mt-6 mb-2 font-mono text-xs text-muted-foreground">
        the frontier: what n^1.999125 buys over n² (constants ignored)
      </div>
      <label className="flex items-center gap-3 font-mono text-xs">
        <span className="w-28 shrink-0">n = 10^{e}</span>
        <Range min={3} max={1200} step={1} value={e} onChange={(ev) => setE(Number(ev.target.value))} />
      </label>
      <dl className="mt-3 grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="text-muted-foreground">n² operations</dt>
        <dd>10^{2 * e}</dd>
        <dt className="text-muted-foreground">n^1.999125</dt>
        <dd>10^{(1.999125 * e).toFixed(2)}</dd>
        <dt className="text-muted-foreground">speedup from the exponent</dt>
        <dd>
          {speed !== null ? `${speed.toFixed(speed < 10 ? 3 : 1)}x` : `10^${speedLog.toFixed(2)}x`}
          {e < 344 ? "  (below 2x until n ≈ 10^344)" : ""}
        </dd>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        A billion numbers (n = 10^9) gets a 1.8% exponent dividend, before the algorithm pays any of its
        constants. The hypothesis was never a claim about practical sizes; it said the exponent 2 could not
        move at all, and it moved by 0.000875.
      </p>
    </div>
  )
}
