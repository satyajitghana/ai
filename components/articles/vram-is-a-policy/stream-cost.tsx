"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The half of the trade that WanGP's headline VRAM numbers do not quote.
//
// This is arithmetic on measured block sizes, not a wall-clock measurement. I
// do not own a 6 GB card and the project publishes no timing for these models,
// so the one thing I cannot measure — how long a single block takes to compute
// on your GPU — is a slider. Everything else comes out of the checkpoints:
//
//   t_transfer(block) = block_bytes / host_to_device_bandwidth
//   per block, async  = max(t_compute, t_transfer)     [mmgp: asyncTransfers=True]
//   per block, serial = t_compute + t_transfer         [profile 4+, asyncTransfers=False]
//   per forward pass  = blocks x per-block
//
// The shape is the point. mmgp prefetches block i+1 on a second CUDA stream
// while block i computes, so while compute is the larger of the two the
// offloading is genuinely free and the VRAM saving costs nothing. Past the
// crossover the GPU waits on PCIe and every extra byte of checkpoint is time.
// Profile 5, the profile that reaches the lowest VRAM, also sets
// pinnedMemory=False — pageable host memory has to be staged through a driver
// buffer, which is why its bandwidth anchor sits at the left end of the axis.
//
// Numbers reaching the DOM use only +, -, *, / and Math.round/min/max, all of
// which are exactly specified by IEEE-754, so no lib/dmath wrapper is needed.

type Model = {
  id: string
  label: string
  note: string
  blocks: number
  blockMiB: number
  baseMiB: number
  // Concurrent shuttles: Ovi's two towers are declared co-tenants
  // (ovi_handler.py coTenantsMap), so each holds its own two-block window.
  windows: number
  steps: number
  stepNote: string
}

const MODELS: Model[] = [
  {
    id: "h3",
    label: "MiniMax H3 FL2VA 33B",
    note: "int8_convrot · 50 × 616.4 MiB",
    blocks: 50,
    blockMiB: 616.4,
    baseMiB: 1643.4,
    windows: 1,
    steps: 15,
    stepNote: "README: “15-20 inference steps is a minimum”",
  },
  {
    id: "h3p",
    label: "H3 FL2VA pruned 20B",
    note: "rank8 int8 · 50 × 371.1 MiB",
    blocks: 50,
    blockMiB: 371.1,
    baseMiB: 1528.3,
    windows: 1,
    steps: 15,
    stepNote: "same minimum step count",
  },
  {
    id: "ovi",
    label: "Wan2.2 Ovi v1.1 (both towers)",
    note: "int8 · 60 × 174.3 MiB per pass",
    blocks: 60,
    blockMiB: 174.3,
    baseMiB: 1350.3,
    windows: 2,
    steps: 30,
    stepNote: "defaults/ovi_1_1.json: num_inference_steps 30",
  },
  {
    id: "yue",
    label: "YuE2 acoustic (NAR) tower",
    note: "int8 · 28 × 48.1 MiB",
    blocks: 28,
    blockMiB: 48.1,
    baseMiB: 105.5,
    windows: 1,
    steps: 64,
    stepNote: "ode_steps 32, midpoint → 2 evals per step",
  },
]

// Host-to-device bandwidth, GB/s (GB = 1e9, the unit PCIe is quoted in).
const BW_MIN = 2
const BW_MAX = 28
const ANCHORS = [
  { bw: 6, label: "3.0 ×16, pageable" },
  { bw: 11.5, label: "3.0 ×16, pinned" },
  { bw: 24, label: "4.0 ×16, pinned" },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const SAMPLES = 130

function transferMs(blockMiB: number, bwGBs: number): number {
  return ((blockMiB * 1048576) / (bwGBs * 1e9)) * 1000
}

export function StreamCost() {
  const [modelIdx, setModelIdx] = useState(0)
  const [bwTenths, setBwTenths] = useState(115) // 11.5 GB/s
  const [computeMs, setComputeMs] = useState(30)

  const m = MODELS[modelIdx]
  const bw = bwTenths / 10
  const tTransfer = transferMs(m.blockMiB, bw)
  const perBlockAsync = Math.max(computeMs, tTransfer)
  const perBlockSerial = computeMs + tTransfer
  const passAsync = (m.blocks * perBlockAsync) / 1000
  const passSerial = (m.blocks * perBlockSerial) / 1000
  const passIdeal = (m.blocks * computeMs) / 1000
  const tax = passIdeal > 0 ? (passAsync - passIdeal) / passIdeal : 0
  // Bandwidth at which transfer stops hiding behind compute.
  const bwCrossover = (m.blockMiB * 1048576) / (computeMs / 1000) / 1e9
  const resident = m.baseMiB + 2 * m.windows * m.blockMiB

  const W = 720
  const H = 200
  const PAD = { l: 42, r: 14, t: 14, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  const grid = Array.from({ length: SAMPLES + 1 }, (_, i) => BW_MIN + (i / SAMPLES) * (BW_MAX - BW_MIN))
  const yOf = (bwv: number) => (m.blocks * Math.max(computeMs, transferMs(m.blockMiB, bwv))) / 1000
  const yMax = Math.max(yOf(BW_MIN), passIdeal * 1.6)

  const X = (bwv: number) => PAD.l + ((bwv - BW_MIN) / (BW_MAX - BW_MIN)) * iw
  const Y = (s: number) => PAD.t + ih - (Math.min(s, yMax) / yMax) * ih

  const path = grid
    .map((bwv, i) => `${i === 0 ? "M" : "L"}${X(bwv).toFixed(2)} ${Y(yOf(bwv)).toFixed(2)}`)
    .join(" ")

  return (
    <figure className="my-8 rounded-md border bg-muted/20 px-4 py-4">
      <figcaption className="mb-3 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        what a low-VRAM profile costs in seconds
      </figcaption>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {MODELS.map((mm, i) => (
          <button
            key={mm.id}
            type="button"
            onClick={() => setModelIdx(i)}
            aria-pressed={i === modelIdx}
            className="rounded-[3px] border px-2 py-1 font-mono text-[11px] transition-colors"
            style={
              i === modelIdx
                ? { background: ACCENT, color: "white", borderColor: ACCENT }
                : undefined
            }
          >
            {mm.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            host → device bandwidth{" "}
            <span className="text-foreground">{bw.toFixed(1)} GB/s</span>
          </span>
          <Range
            min={BW_MIN * 10}
            max={BW_MAX * 10}
            step={5}
            value={bwTenths}
            onChange={(e) => setBwTenths(Number(e.target.value))}
            accent={ACCENT}
            className="mt-1 w-full"
            aria-label="Host to device bandwidth in gigabytes per second"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] text-muted-foreground">
            compute per block{" "}
            <span className="text-foreground">{computeMs} ms</span> — the one
            number I could not measure
          </span>
          <Range
            min={2}
            max={200}
            step={1}
            value={computeMs}
            onChange={(e) => setComputeMs(Number(e.target.value))}
            accent={WARM}
            className="mt-1 w-full"
            aria-label="Compute time per block in milliseconds"
          />
        </label>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Seconds per forward pass for ${m.label} against host-to-device bandwidth. Below ${bwCrossover.toFixed(1)} gigabytes per second the curve rises because PCIe, not the GPU, sets the pace; above it the curve flattens onto the compute floor of ${passIdeal.toFixed(2)} seconds.`}
      >
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + ih} stroke={MUTED} strokeWidth="1" opacity="0.5" />
        <line x1={PAD.l} y1={PAD.t + ih} x2={PAD.l + iw} y2={PAD.t + ih} stroke={MUTED} strokeWidth="1" opacity="0.5" />

        {/* compute floor: the fastest this pass can ever be */}
        <line
          x1={PAD.l}
          y1={Y(passIdeal)}
          x2={PAD.l + iw}
          y2={Y(passIdeal)}
          stroke={GOOD}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text
          x={PAD.l + iw - 2}
          y={Y(passIdeal) + 11}
          fill={GOOD}
          fontSize="9"
          fontFamily="monospace"
          textAnchor="end"
        >
          compute floor {passIdeal.toFixed(2)} s
        </text>

        {ANCHORS.map((a) => (
          <g key={a.label}>
            <line
              x1={X(a.bw)}
              y1={PAD.t}
              x2={X(a.bw)}
              y2={PAD.t + ih}
              stroke={MUTED}
              strokeWidth="1"
              opacity="0.25"
            />
            <text
              x={X(a.bw)}
              y={PAD.t + ih + 20}
              fill={MUTED}
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="middle"
            >
              {a.label}
            </text>
          </g>
        ))}

        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" />

        <circle cx={X(bw)} cy={Y(passAsync)} r="4" fill={ACCENT} />
        <text
          x={Math.min(X(bw) + 8, W - 92)}
          y={Y(passAsync) - 7}
          fill={ACCENT}
          fontSize="10"
          fontFamily="monospace"
        >
          {passAsync.toFixed(2)} s / pass
        </text>

        <text x={PAD.l - 6} y={PAD.t + 8} fill={MUTED} fontSize="9" fontFamily="monospace" textAnchor="end">
          {yMax.toFixed(1)}s
        </text>
        <text x={PAD.l - 6} y={PAD.t + ih} fill={MUTED} fontSize="9" fontFamily="monospace" textAnchor="end">
          0
        </text>
        <text x={PAD.l} y={PAD.t + ih + 20} fill={MUTED} fontSize="8.5" fontFamily="monospace">
          {BW_MIN} GB/s
        </text>
        <text
          x={PAD.l + iw}
          y={PAD.t + ih + 20}
          fill={MUTED}
          fontSize="8.5"
          fontFamily="monospace"
          textAnchor="end"
        >
          {BW_MAX} GB/s
        </text>
      </svg>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">resident weights</dt>
          <dd className="mt-0.5">{(resident / 1024).toFixed(2)} GiB</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">transfer / block</dt>
          <dd className="mt-0.5">{tTransfer.toFixed(1)} ms</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">offload tax</dt>
          <dd className="mt-0.5" style={{ color: tax > 0.01 ? WARM : GOOD }}>
            {tax <= 0.001 ? "free" : `+${Math.round(tax * 100)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">free above</dt>
          <dd className="mt-0.5">{bwCrossover.toFixed(1)} GB/s</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        At the settings above, one full generation is{" "}
        <span className="font-mono text-foreground">
          {(passAsync * m.steps).toFixed(0)}s
        </span>{" "}
        of streamed forward passes ({m.steps} passes — {m.stepNote}), against{" "}
        <span className="font-mono">{(passIdeal * m.steps).toFixed(0)}s</span> if
        every weight were already resident. Turn off prefetching, which is what
        WanGP&apos;s profile 4+ does (<code>asyncTransfers = False</code>), and
        the same pass costs{" "}
        <span className="font-mono">{passSerial.toFixed(2)}s</span> instead of{" "}
        <span className="font-mono">{passAsync.toFixed(2)}s</span>. Attention,
        VAE decode and sampler overhead are not in any of these numbers; this is
        the block stack alone.
      </p>
    </figure>
  )
}
