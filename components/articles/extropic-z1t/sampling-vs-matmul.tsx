"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"

// The two computational primitives, side by side, from Extropic's own description
// (extropic.ai/writing/z1t, September 4 2026):
//
//  - GPU dense matmul: y = Wx computed directly. Any element of W can be nonzero;
//    a cache hierarchy gives every core access to every other core's data, so the
//    "connectivity" is effectively all-to-all and the result is exact and deterministic
//    on one pass.
//
//  - Z1 tanh-linear unit: a visible pbit v is wired to exactly 16 neighbor pbits h_j,
//    fixed in silicon ("each pbit has 16 tunable couplings"). Conditioned on its
//    neighbors, v is Bernoulli, not deterministic:
//        E[v | h] = tanh( b_v + sum_j J_j h_j )
//    A single draw of v is one bit, not the expectation. The post's own encoding
//    section gets a usable real number only by drawing N samples and averaging:
//        y ~= (1/N) sum_k v^(k)
//    and gives a precision bound for that average, sigma / sqrt(N) <= 1 / 2^k, i.e.
//    effective bits k <= 0.5 * log2(N) - log2(sigma). We plot that bound below with
//    sigma = 1 (a spin's own maximum standard deviation, since v in {-1,+1}) -- the
//    post doesn't publish a measured sigma, so this traces the shape of the tradeoff
//    it describes, not a reproduction of an unpublished constant.
//
//  - The N = 32 default is not arbitrary: the post's own latency model is "25
//    sequential sampling layers ... 16.0 µs Z1 sampling (25 x 32 samples at 50 MHz)".
//    25 x 32 = 800 cycles; 800 / 50e6 = 16.0 µs, exactly their published number --
//    so 32 samples/pbit is the actual sample count behind Z1T's own 8.74 nJ and
//    16.0 µs figures, not a round number chosen for this widget.
//
//  - Energy per sample, from the post's "Model details": 1.3e-14 J (13 fJ).

const SAMPLE_ENERGY_FJ = 13 // 1.3e-14 J
const N_STEPS = [1, 2, 4, 8, 16, 32, 64, 128]
const DEFAULT_N_IDX = 5 // N = 32

const GOLD = "oklch(0.78 0.15 90)"
const COPPER = "oklch(0.62 0.14 45)"

type Mode = "dense" | "sparse"

// A 7x7 field of nodes; center is the output. Sparse mode wires it to exactly
// 16 fixed neighbors in a starburst -- deliberately not a compact local blob,
// echoing the post's own "each pbit has 16 tunable couplings" star diagrams.
const GRID = 7
const CENTER = 3
const SPARSE_OFFSETS: [number, number][] = [
  [-3, -2], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -2],
  [3, 2], [2, 3], [1, 3], [0, 3], [-1, 3], [-2, 3], [-3, 2],
  [-3, 0], [3, 0],
]

export function SamplingVsMatmul() {
  const [mode, setMode] = useState<Mode>("sparse")
  const [nIdx, setNIdx] = useState(DEFAULT_N_IDX)

  const N = N_STEPS[nIdx]
  const energyFj = SAMPLE_ENERGY_FJ * N
  const bits = Math.max(0, 0.5 * mlog2(N)) // sigma = 1, so -log2(sigma) = 0

  const SPACING = 44
  const PAD = 34
  const W = PAD * 2 + (GRID - 1) * SPACING
  const H = W
  const pos = (i: number) => PAD + i * SPACING

  const nodes: { x: number; y: number; on: boolean; isCenter: boolean }[] = []
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const isCenter = r === CENTER && c === CENTER
      const on =
        isCenter ||
        (mode === "dense" ? true : SPARSE_OFFSETS.some(([dr, dc]) => CENTER + dr === r && CENTER + dc === c))
      nodes.push({ x: pos(c), y: pos(r), on, isCenter })
    }
  }
  const center = { x: pos(CENTER), y: pos(CENTER) }
  const edges = nodes.filter((n) => n.on && !n.isCenter)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one output, two ways to compute it</span>
        <div className="flex gap-1.5">
          {(
            [
              ["dense", "GPU: dense matmul"],
              ["sparse", "Z1: sampled tanh-linear"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="mx-auto overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="max-w-full">
              <title>
                {mode === "dense"
                  ? "A seven by seven field of nodes. The center output node connects by a line to every other node in the field: full, all-to-all reach."
                  : "A seven by seven field of nodes. The center output pbit connects by a line to exactly sixteen fixed neighbors spread around it in a starburst; every other node in the field is dim and unconnected."}
              </title>
              {edges.map((n, i) => (
                <line
                  key={i}
                  x1={center.x}
                  y1={center.y}
                  x2={n.x}
                  y2={n.y}
                  stroke={mode === "dense" ? COPPER : GOLD}
                  strokeOpacity={mode === "dense" ? 0.22 : 0.55}
                  strokeWidth={mode === "dense" ? 1 : 1.4}
                />
              ))}
              {nodes.map((n, i) => (
                <circle
                  key={i}
                  cx={n.x}
                  cy={n.y}
                  r={n.isCenter ? 6 : n.on ? 3.6 : 2.2}
                  fill={n.isCenter ? (mode === "dense" ? COPPER : GOLD) : n.on ? (mode === "dense" ? COPPER : GOLD) : "currentColor"}
                  fillOpacity={n.isCenter ? 1 : n.on ? 0.75 : 0.15}
                />
              ))}
            </svg>
          </div>

          <div className="text-sm leading-6 text-muted-foreground">
            {mode === "dense" ? (
              <>
                <span className="text-foreground">y = Wx</span>, computed directly. Any element of{" "}
                <span className="text-foreground">W</span> can be nonzero, a cache hierarchy makes every input
                reachable from every output, and one pass gives an exact, deterministic answer.
              </>
            ) : (
              <>
                Output pbit <span className="text-foreground">v</span> is wired to exactly{" "}
                <span className="text-foreground">16</span> neighbors, fixed in silicon. Conditioned on them it is
                Bernoulli, not deterministic — <span className="text-foreground">E[v|h] = tanh(local field)</span> —
                so one draw is a single bit, not the answer.
              </>
            )}
          </div>
        </div>

        <div className="mt-4 border-t pt-3">
          <div className="mb-2 font-mono text-[10px] text-muted-foreground">what a sample costs (sparse mode only)</div>
          <div className="flex items-center gap-2">
            <span className="w-32 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              samples averaged, N
            </span>
            <Range
              min={0}
              max={N_STEPS.length - 1}
              step={1}
              value={nIdx}
              onChange={(e) => setNIdx(Number(e.target.value))}
              className="flex-1"
              aria-label="number of samples averaged per pbit"
              accent={GOLD}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">N={N}</span>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">energy, N × 13 fJ</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: GOLD }}>
                {energyFj.toLocaleString()} fJ
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                effective precision (σ=1 bound)
              </div>
              <div className="font-mono text-xs tabular-nums" style={{ color: GOLD }}>
                ~{bits.toFixed(1)} extra bits
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">at N=32</div>
              <div className="font-mono text-[11px]" style={{ color: N === 32 ? GOLD : "currentColor", opacity: N === 32 ? 1 : 0.5 }}>
                25 layers × 32 = 800 cycles ÷ 50 MHz = 16.0 µs
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          A GPU&rsquo;s dense matmul and Z1&rsquo;s tanh-linear unit are answering different questions. The GPU computes{" "}
          <span className="text-foreground">Wx</span> once, exactly, over whichever inputs the weight matrix
          names — nothing about the hardware limits how many that can be. Z1 cannot: every coupling is wired into
          the die, fixed at 16 neighbors per pbit, and what comes back from any one of them is a single stochastic
          bit. The post&rsquo;s own encoding math turns that into a usable number by averaging — more samples buys more
          effective precision, on a curve of steeply diminishing returns (doubling N adds roughly half a bit) — and
          every one of those samples has an energy cost that a deterministic multiply never pays. The N=32 mark
          above is not illustrative filler: it&rsquo;s the exact per-layer sample count Extropic&rsquo;s own 8.74 nJ and 16.0 µs
          Z1T figures are built on.
        </p>
      </div>
    </figure>
  )
}
