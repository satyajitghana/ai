"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// An annotated CPU-vs-GPU trace lane, redrawn from the two runs in the Hugging
// Face torch.profiler post (NVIDIA A100-SXM4-80GB, bf16, y = matmul(x, w) + b).
// Toggle flips between the SAME code at two matrix sizes:
//   - 64x64   -> overhead-bound: GPU does 23.1us of work inside a 2.31ms CPU wall.
//   - 4096x4096 -> compute-bound: the gemm kernel (4.285ms) fills the wall.
// The shared time axis is the CPU wall of each run; segment widths are the real
// aggregate numbers from key_averages(). Everything renders synchronously on the
// server first (no timers, no random, no unbounded loops) — pure and deterministic.

const CPU = "oklch(0.68 0.14 250)" // launch / CPU-side ops (blue)
const GPU = "oklch(0.64 0.16 150)" // GPU kernel time (green)
const SYNC = "oklch(0.7 0.15 45)" // cudaDeviceSynchronize (Perfetto orange)

type Mode = {
  key: string
  size: string
  verdict: string
  cpuWall: string
  gpuBusy: string
  // fractions of the CPU wall (the shared axis)
  syncFrac: number // cudaDeviceSynchronize share of the wall
  launchFrac: number // launch + other CPU-side dispatch
  gpuFrac: number // GPU busy share of the wall (gemm + elementwise)
  gemmFrac: number // gemm share of the wall
  kernel: string
  idlePct: string
  note: string
}

const MODES: Mode[] = [
  {
    key: "64",
    size: "64 x 64",
    verdict: "overhead-bound",
    cpuWall: "2.314 ms",
    gpuBusy: "23.1 us",
    syncFrac: 1.786 / 2.314, // cudaDeviceSynchronize 77.2%
    launchFrac: 1 - 1.786 / 2.314,
    gpuFrac: 0.0231 / 2.314, // ~1%
    gemmFrac: 0.014272 / 2.314,
    kernel: "ampere_bf16_s16816gemm_bf16_64x64_...",
    idlePct: "~98%",
    note: "The GPU finishes in 23 us, then the CPU sits in cudaDeviceSynchronize (1.786 ms, 77% of the wall) and per-call launch overhead. Compute is a rounding error; the fix is to stop launching so many tiny kernels (batch, or torch.compile).",
  },
  {
    key: "4096",
    size: "4096 x 4096",
    verdict: "compute-bound",
    cpuWall: "4.908 ms",
    gpuBusy: "4.495 ms",
    syncFrac: 4.63 / 4.908, // cudaDeviceSynchronize 94.3% — but now it is real waiting
    launchFrac: 1 - 4.63 / 4.908,
    gpuFrac: 4.495 / 4.908, // ~92%
    gemmFrac: 4.285 / 4.908, // ~87%
    kernel: "ampere_bf16_s16816gemm_bf16_128x256_...",
    idlePct: "~8%",
    note: "The gemm kernel alone is 4.285 ms (95% of GPU time). cudaDeviceSynchronize is still 94% of the CPU wall — but here it is the CPU legitimately blocked on real GPU work, not overhead. This kernel is the thing to optimize.",
  },
]

const W = 760
const H = 250
const LANE_X = 150 // left gutter for lane labels
const TRACK_W = W - LANE_X - 20
const CPU_Y = 66
const GPU_Y = 150
const BAR_H = 30

export function TraceLanes() {
  const [i, setI] = useState(0)
  const m = MODES[i]

  const x = (frac: number) => LANE_X + frac * TRACK_W
  const w = (frac: number) => Math.max(frac * TRACK_W, 1.5)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>trace lanes · A100, bf16 · same code, two sizes</span>
        <span className="text-muted-foreground/50">redrawn from the post</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* mode toggle */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {MODES.map((mode, mi) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => setI(mi)}
              aria-pressed={i === mi}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === mi ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={i === mi ? { background: GPU } : undefined}
            >
              {mode.size} · {mode.verdict}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`CPU and GPU trace lanes for the ${m.size} run, ${m.verdict}. GPU busy ${m.gpuBusy} inside a ${m.cpuWall} CPU wall.`}>
          <defs>
            <pattern id="tl-idle" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="transparent" />
              <line x1="0" y1="0" x2="0" y2="7" stroke="var(--muted-foreground)" strokeWidth="1" opacity="0.25" />
            </pattern>
          </defs>

          {/* wall bracket */}
          <line x1={LANE_X} y1={38} x2={x(1)} y2={38} stroke="var(--border)" />
          <line x1={LANE_X} y1={34} x2={LANE_X} y2={42} stroke="var(--border)" />
          <line x1={x(1)} y1={34} x2={x(1)} y2={42} stroke="var(--border)" />
          <text x={(LANE_X + x(1)) / 2} y={30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            CPU wall · {m.cpuWall}
          </text>

          {/* CPU lane */}
          <text x={LANE_X - 12} y={CPU_Y + BAR_H / 2 + 4} textAnchor="end" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>CPU</text>
          <text x={LANE_X - 12} y={CPU_Y + BAR_H / 2 + 18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>main thread</text>
          {/* launch / dispatch region (left) */}
          <rect x={x(0)} y={CPU_Y} width={w(m.launchFrac)} height={BAR_H} rx={3} fill={CPU} opacity={0.9} className="transition-all duration-500" />
          {/* cudaDeviceSynchronize (right) */}
          <rect x={x(m.launchFrac)} y={CPU_Y} width={w(m.syncFrac)} height={BAR_H} rx={3} fill={SYNC} opacity={0.9} className="transition-all duration-500" />
          <text x={x(m.launchFrac) + w(m.syncFrac) / 2} y={CPU_Y + BAR_H / 2 + 3.5} textAnchor="middle" className="font-mono" fontSize={9} fill="oklch(0.22 0 0)">
            cudaDeviceSynchronize
          </text>

          {/* GPU lane */}
          <text x={LANE_X - 12} y={GPU_Y + BAR_H / 2 + 4} textAnchor="end" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>GPU</text>
          <text x={LANE_X - 12} y={GPU_Y + BAR_H / 2 + 18} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8}>stream 7</text>
          {/* idle track */}
          <rect x={x(0)} y={GPU_Y} width={TRACK_W} height={BAR_H} rx={3} fill="url(#tl-idle)" stroke="var(--border)" strokeWidth={0.5} />
          {/* gemm kernel — starts after launch, executes for gemmFrac of the wall */}
          <rect x={x(m.launchFrac)} y={GPU_Y} width={w(m.gemmFrac)} height={BAR_H} rx={3} fill={GPU} opacity={0.95} className="transition-all duration-500" />
          {m.gpuFrac > 0.1 ? (
            <text x={x(m.launchFrac) + w(m.gemmFrac) / 2} y={GPU_Y + BAR_H / 2 + 3.5} textAnchor="middle" className="font-mono" fontSize={9} fill="oklch(0.18 0 0)">
              ampere bf16 gemm
            </text>
          ) : null}

          {/* GPU-idle callout */}
          <text x={x(1)} y={GPU_Y - 8} textAnchor="end" className="font-mono" fontSize={10} fill={m.gpuFrac > 0.1 ? GPU : SYNC}>
            GPU idle {m.idlePct}
          </text>
          {/* dependency arrow: CPU launch -> GPU exec */}
          <path d={`M ${x(m.launchFrac)} ${CPU_Y + BAR_H} L ${x(m.launchFrac)} ${GPU_Y}`} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
        </svg>

        {/* stat row */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "CPU wall", v: m.cpuWall, c: CPU },
            { k: "GPU busy", v: m.gpuBusy, c: GPU },
            { k: "GPU idle", v: m.idlePct, c: SYNC },
            { k: "verdict", v: m.verdict, c: "var(--foreground)" },
          ].map((s) => (
            <div key={s.k} className="rounded-md border bg-background/40 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{s.k}</div>
              <div className="font-mono text-sm" style={{ color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{m.note}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CPU }} /> CPU launch / dispatch</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SYNC }} /> cudaDeviceSynchronize</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: GPU }} /> GPU kernel</span>
        </div>
      </div>
    </figure>
  )
}
