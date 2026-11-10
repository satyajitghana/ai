"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Forward cost of the two backbones on the same voxel grid, counted with my own
// cost model over Pointcept's demo scenes (sample1 indoor at 2 cm,
// sample2_outdoor at 5 cm; numpy 2.5). PTv3-B is Sonata's encoder config read
// from configs/sonata/pretrain-sonata-v1m1-0-base.py (channels 48..512, depths
// 3/3/3/12/3, 1,024-point windows, a 3x3x3 submanifold conv per block whose
// cost uses the real count of occupied neighbours). Volt-B is 768 wide, 12
// blocks, full attention over every 5x5x5 patch token, plus its dense
// tokenizer; encoders only on both sides (Volt's per-voxel decoder would add
// 74 GFLOPs on the indoor crop). GFLOPs = 2 x multiply-adds, forward only.
// "Window" is the median bounding box of a 1,024-voxel z-order window.

type Row = {
  label: string
  note: string
  ptv3: { linear: number; cpe: number; attn: number; pool: number }
  volt: { T: number; tok: number; linear: number; attn: number }
  pairs: [number, number]
  windows: [number, number, number][]
  extent: string
}

const ROWS: Record<string, Row> = {
  indoorCrop: {
    label: "indoor, 65,536-voxel crop",
    note: "the size VINO and Sonata train on indoors",
    ptv3: { linear: 139, cpe: 138, attn: 126, pool: 3 },
    volt: { T: 4425, tok: 5, linear: 752, attn: 722 },
    pairs: [328, 235],
    windows: [
      [1.01, 0.86, 0.62],
      [1.8, 1.28, 1.06],
      [3.16, 2.48, 1.28],
      [5.12, 3.84, 1.6],
      [5.44, 5.44, 2.24],
    ],
    extent: "the whole crop, from block 1",
  },
  indoorFull: {
    label: "indoor, whole room",
    note: "187,899 voxels, 12,092 tokens",
    ptv3: { linear: 378, cpe: 396, attn: 347, pool: 9 },
    volt: { T: 12092, tok: 14, linear: 2054, attn: 5390 },
    pairs: [919, 1755],
    windows: [
      [0.96, 0.78, 0.64],
      [1.28, 1.28, 1.16],
      [2.56, 2.52, 1.6],
      [6.0, 4.32, 2.56],
      [7.36, 7.68, 2.56],
    ],
    extent: "the whole room, from block 1",
  },
  outdoorCrop: {
    label: "outdoor, ~6,000-token crop",
    note: "VINO's outdoor cap; this crop gives 6,188",
    ptv3: { linear: 207, cpe: 178, attn: 139, pool: 4 },
    volt: { T: 6188, tok: 7, linear: 1051, attn: 1412 },
    pairs: [279, 459],
    windows: [
      [5.3, 3.8, 1.4],
      [6.4, 6.4, 1.6],
      [11.7, 8.7, 3.1],
      [16.6, 15.0, 4.4],
      [20.8, 20.8, 5.6],
    ],
    extent: "the whole crop, from block 1",
  },
  outdoorFull: {
    label: "outdoor, whole sweep",
    note: "128,469 voxels, 32,700 tokens: never trained on",
    ptv3: { linear: 1250, cpe: 792, attn: 693, pool: 18 },
    volt: { T: 32700, tok: 38, linear: 5555, attn: 39418 },
    pairs: [1044, 12831],
    windows: [
      [6.4, 6.25, 2.55],
      [12.7, 7.2, 3.4],
      [24.0, 12.8, 4.4],
      [25.6, 23.4, 5.6],
      [42.4, 38.4, 7.2],
    ],
    extent: "the whole sweep, from block 1",
  },
}

const KEYS = ["indoorCrop", "indoorFull", "outdoorCrop", "outdoorFull"] as const

const SEG = {
  attn: { label: "attention (QK and AV)", color: "oklch(0.62 0.17 25)" },
  linear: { label: "linear layers (QKV, proj, MLP)", color: "oklch(0.6 0.13 250)" },
  cpe: { label: "sparse conv position encoding", color: "oklch(0.68 0.12 150)" },
  io: { label: "embedding, pooling, tokenizer", color: "oklch(0.7 0.05 80)" },
} as const

const fmt = (n: number) => n.toLocaleString("en-US")

export function ComputeSplit() {
  const [key, setKey] = useState<(typeof KEYS)[number]>("indoorCrop")
  const r = ROWS[key]
  const p = r.ptv3
  const v = r.volt
  const pt = p.linear + p.cpe + p.attn + p.pool
  const vt = v.tok + v.linear + v.attn
  const top = Math.max(pt, vt)
  const bars = [
    {
      name: "PTv3-B (Sonata encoder)",
      total: pt,
      segs: [
        ["attn", p.attn],
        ["linear", p.linear],
        ["cpe", p.cpe],
        ["io", p.pool],
      ] as const,
    },
    {
      name: `Volt-B encoder (${fmt(v.T)} tokens)`,
      total: vt,
      segs: [
        ["attn", v.attn],
        ["linear", v.linear],
        ["cpe", 0],
        ["io", v.tok],
      ] as const,
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>forward GFLOPs, same voxels, two backbones · measured on Pointcept demo scenes</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5 font-mono text-[11px]">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              aria-pressed={key === k}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-0.5 transition-colors",
                key === k ? "border-foreground/40 bg-foreground/5 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ROWS[k].label}
            </button>
          ))}
        </div>
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">{r.note}</p>

        <div className="space-y-3">
          {bars.map((b) => (
            <div key={b.name}>
              <div className="mb-1 flex justify-between font-mono text-[11px]">
                <span className="text-foreground">{b.name}</span>
                <span className="text-muted-foreground">{fmt(b.total)} GFLOPs</span>
              </div>
              <div
                className="flex h-5 overflow-hidden rounded-md bg-muted/30"
                role="img"
                aria-label={`${b.name}: ${b.segs
                  .filter(([, x]) => x > 0)
                  .map(([s, x]) => `${SEG[s].label} ${fmt(x)}`)
                  .join(", ")} GFLOPs`}
              >
                {b.segs.map(([s, x]) =>
                  x > 0 ? (
                    <div
                      key={s}
                      style={{ width: `${(x / top) * 100}%`, background: SEG[s].color }}
                      title={`${SEG[s].label}: ${fmt(x)} GFLOPs`}
                    />
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
          {Object.values(SEG).map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">Volt-B / PTv3-B FLOPs</div>
            <div className="text-foreground">{(vt / pt).toFixed(1)}x</div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">attention pairs, all blocks</div>
            <div className="text-foreground">
              {fmt(r.pairs[0])}M vs {fmt(r.pairs[1])}M
            </div>
          </div>
          <div className="rounded-md border px-2.5 py-1.5">
            <div className="text-muted-foreground">attention share in Volt-B</div>
            <div className="text-foreground">{Math.round((v.attn / vt) * 100)}%</div>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[460px] font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">what one attention sees</th>
                <th className="py-1 pr-2 font-normal">PTv3 stage 1</th>
                <th className="py-1 pr-2 font-normal">stage 2</th>
                <th className="py-1 pr-2 font-normal">stage 3</th>
                <th className="py-1 pr-2 font-normal">stage 4</th>
                <th className="py-1 font-normal">stage 5</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1 pr-2 text-muted-foreground">window, metres</td>
                {r.windows.map((w, i) => (
                  <td key={i} className="py-1 pr-2 text-foreground">
                    {w.map((x) => x.toFixed(1)).join("×")}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="py-1 pr-2 text-muted-foreground">Volt, every block</td>
                <td colSpan={5} className="py-1 text-foreground">
                  {r.extent}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted-foreground">
          FLOPs from layer shapes and real neighbour counts, not a profiler. They say nothing about wall-clock: dense
          GEMMs and FlashAttention run near peak on a GPU, sparse convolution and serialisation do not. The Volt paper
          reports Volt-B twice as fast as PTv3-S on A100 and H100.
        </p>
      </div>
    </figure>
  )
}
