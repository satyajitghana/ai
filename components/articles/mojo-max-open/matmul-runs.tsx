"use client"

// The matmul runs from the article, verbatim. Shared 4-core cloud VM (Intel
// Xeon @ 2.10GHz, AVX-512), CPU only, every process under `nice -n 19` while
// other jobs held the load average near 9.8. Mojo 1.2.0 from PyPI; NumPy
// 2.5.4 on scipy-openblas 0.3.34 (SkylakeX kernels). Each Mojo and NumPy
// figure is the best of five calls inside one process; three processes
// ("rounds") were run, interleaved. Pure Python ran at n = 128 because n = 512
// would take minutes; its rate is comparable, its time is not.
//
// GFLOP/s = 2 n^3 / seconds. All arithmetic here is * / and log10 via dmath.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

type Series = { id: string; label: string; sub: string; n: number; ms: number[]; tone: "mojo" | "numpy" | "py" }

const SERIES: Series[] = [
  { id: "py", label: "Pure Python", sub: "triple loop, n = 128", n: 128, ms: [563.1, 554.0, 475.1, 598.5, 423.1, 803.2], tone: "py" },
  { id: "naive", label: "Mojo naive", sub: "same triple loop, scalar", n: 512, ms: [304.382368, 263.699274, 402.364981], tone: "mojo" },
  { id: "simd", label: "Mojo vectorize", sub: "i-k-j order, 16-wide SIMD", n: 512, ms: [6.564135, 6.355364, 8.057109], tone: "mojo" },
  { id: "block", label: "Mojo 4x32 block", sub: "8 accumulators in registers", n: 512, ms: [2.156174, 2.054937, 3.270955], tone: "mojo" },
  { id: "np1", label: "NumPy, 1 thread", sub: "OpenBLAS sgemm", n: 512, ms: [1.943, 2.008, 1.878], tone: "numpy" },
  { id: "np2", label: "NumPy, 2 threads", sub: "OpenBLAS sgemm", n: 512, ms: [1.069, 1.368, 19.672], tone: "numpy" },
]

const gflops = (n: number, ms: number) => (2 * n * n * n) / (ms * 1e6)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const TONE: Record<Series["tone"], string> = {
  mojo: "var(--color-chart-5, #e76f51)",
  numpy: "var(--color-chart-2, #2a9d8f)",
  py: "var(--color-muted-foreground, #888)",
}

const LO = 0.001
const HI = 1000

export function MatmulRuns() {
  const [unit, setUnit] = useState<"gf" | "ms">("gf")

  const W = 760
  const left = 170
  const right = W - 70
  const top = 34
  const rowH = 40
  const shown = unit === "ms" ? SERIES.filter((s) => s.n === 512) : SERIES
  const H = top + shown.length * rowH + 14
  const val = (s: Series, ms: number) => (unit === "gf" ? gflops(s.n, ms) : ms)
  const x = (v: number) => left + ((mlog10(v) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))) * (right - left)
  const ticks = [0.001, 0.01, 0.1, 1, 10, 100, 1000]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          512 x 512 float32 matmul &middot; measured &middot; shared 4-core VM, CPU only, nice 19
        </span>
        <span className="inline-flex overflow-hidden rounded-md border text-xs">
          {(["gf", "ms"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={"px-2.5 py-1 " + (unit === u ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              {u === "gf" ? "GFLOP/s (higher is better)" : "milliseconds (lower is better)"}
            </button>
          ))}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Log-scale dot plot of measured matrix multiply speed. Pure Python reaches about 0.0075 GFLOP/s. A naive Mojo triple loop reaches about 0.88. Mojo's vectorize helper in i-k-j order reaches about 41. A Mojo kernel holding a four by thirty-two block of C in eight SIMD registers reaches about 125, close to single-threaded NumPy on OpenBLAS at about 138, and two-threaded NumPy at about 196."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 12} x2={x(t)} y2={H - 10} className="stroke-border" strokeOpacity={0.6} />
            <text x={x(t)} y={top - 18} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {t >= 1 ? t.toLocaleString("en-US") : String(t)}
            </text>
          </g>
        ))}
        {shown.map((s, i) => {
          const y = top + i * rowH + 14
          const vals = s.ms.map((m) => val(s, m))
          const med = val(s, median(s.ms))
          return (
            <g key={s.id}>
              <text x={left - 12} y={y - 1} textAnchor="end" className="fill-foreground" style={{ fontSize: 12.5, fontWeight: 600 }}>
                {s.label}
              </text>
              <text x={left - 12} y={y + 13} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {s.sub}
              </text>
              <line x1={x(LO)} y1={y + 3} x2={x(med)} y2={y + 3} stroke={TONE[s.tone]} strokeWidth={9} strokeOpacity={0.35} />
              {vals.map((v, k) => (
                <circle key={k} cx={x(v)} cy={y + 3} r={3.6} fill={TONE[s.tone]} />
              ))}
              <text x={x(med) + 10} y={y + 7} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {med < 0.1 ? med.toFixed(4) : med < 10 ? med.toFixed(2) : med.toFixed(1)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-[11px] text-muted-foreground">
        Dots are individual runs (each the best of five calls); the bar ends at the median. Log scale. Pure Python ran at n = 128, so it
        appears only as a rate. One two-thread NumPy run landed at 19.7 ms because other jobs on the machine took the second core.
      </figcaption>
    </figure>
  )
}
