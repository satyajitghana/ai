"use client"

import { useMemo, useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Structural pruning of the SuperPoint backbone, with the architecture read
// straight from PrunaSuperPoint's models/superpoint.py:
//
//   channels = [64, 64, 128, 128, 256], stride 8 (three 2x pools).
//   Backbone = eight 3x3 convs in four blocks; a pool halves H and W after
//   blocks 0, 1 and 2, so block 0 runs at full resolution and block 3 at 1/64
//   of the area. Two heads sit on the backbone output at H/8 x W/8: a detector
//   (two convs -> 65 logits = 8x8 cells + 1 dustbin) and a descriptor (two
//   convs -> 256-d). The heads are never pruned.
//
// A conv at H'xW' with c_in -> c_out and a kxk kernel costs H'*W'*c_in*c_out*k^2
// multiply-accumulates. Everything here is +, -, *, / and integer compares,
// which are exact on every engine, so SSR and the browser render identical
// digits (no transcendentals, no dmath needed). MACs are computed at the stated
// input resolution; latency and quality are the model card's measured numbers,
// shown only when the on-screen config matches a card variant exactly.

const C_BB = "oklch(0.58 0.2 300)" // Pruna purple, backbone
const C_HEAD = "oklch(0.62 0.03 260)" // heads: the fixed floor
const C_SAVE = "oklch(0.64 0.17 150)" // reclaimed compute

// Backbone layer plan. px = spatial pixels at 640x480; prunes the OUTPUT width.
// The input of layer i is the output of layer i-1 (layer 0's input is the image).
type Layer = { name: string; px: number; k: number }
const BACKBONE: Layer[] = [
  { name: "backbone_0_0", px: 640 * 480, k: 3 },
  { name: "backbone_0_1", px: 640 * 480, k: 3 },
  { name: "backbone_1_0", px: 320 * 240, k: 3 },
  { name: "backbone_1_1", px: 320 * 240, k: 3 },
  { name: "backbone_2_0", px: 160 * 120, k: 3 },
  { name: "backbone_2_1", px: 160 * 120, k: 3 },
  { name: "backbone_3_0", px: 80 * 60, k: 3 },
  { name: "backbone_3_1", px: 80 * 60, k: 3 },
]
// Heads at H/8 x W/8 = 80x60. (in, out, k) are fixed.
const HEADS: { name: string; px: number; cin: number; cout: number; k: number }[] = [
  { name: "detector_0", px: 80 * 60, cin: 128, cout: 256, k: 3 },
  { name: "detector_1", px: 80 * 60, cin: 256, cout: 65, k: 1 },
  { name: "descriptor_0", px: 80 * 60, cin: 128, cout: 256, k: 3 },
  { name: "descriptor_1", px: 80 * 60, cin: 256, cout: 256, k: 1 },
]
const HEAD_MAC = HEADS.reduce((s, h) => s + h.px * h.cin * h.cout * h.k * h.k, 0)

const BLOCKS = [
  { rows: [0, 1], res: "640×480", note: "full resolution" },
  { rows: [2, 3], res: "320×240", note: "after 1 pool" },
  { rows: [4, 5], res: "160×120", note: "after 2 pools" },
  { rows: [6, 7], res: "80×60", note: "after 3 pools" },
]

const ORIGINAL = [64, 64, 64, 64, 128, 128, 128, 128]

type Preset = {
  key: string
  label: string
  widths: number[]
  lat640: [number, number]
  lat1080: [number, number]
  covIn: number
  descIn: number | null
}
// Measured on a Jetson Orin Nano 8GB, FP16 TensorRT engines; lat = our
// benchmark / trtexec (ms). Quality on the UZH-FPV Indoor trace, 1024 keypoints:
// keypoints covered (max 1024) / mean descriptor L2 difference (0 = identical).
const PRESETS: Preset[] = [
  { key: "orig", label: "original", widths: ORIGINAL, lat640: [17.8, 16.8], lat1080: [111.1, 109.6], covIn: 1024, descIn: 0 },
  { key: "light", label: "pruned-light · no training", widths: [32, 64, 64, 64, 128, 128, 128, 128], lat640: [14.4, 13.5], lat1080: [86.9, 84.6], covIn: 637, descIn: 0.92 },
  { key: "pruned", label: "pruned · distilled", widths: [16, 16, 24, 32, 64, 128, 128, 128], lat640: [9.6, 8.5], lat1080: [54.2, 52.9], covIn: 817, descIn: 0.24 },
]

function macsOf(widths: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < BACKBONE.length; i++) {
    const cin = i === 0 ? 1 : widths[i - 1]
    const cout = widths[i]
    const L = BACKBONE[i]
    out.push(L.px * cin * cout * L.k * L.k)
  }
  return out
}

const ORIG_MACS = macsOf(ORIGINAL)
const ORIG_BB = ORIG_MACS.reduce((a, b) => a + b, 0)
const ORIG_TOTAL = ORIG_BB + HEAD_MAC
const MAXBAR = Math.max(...ORIG_MACS) // backbone_0_1 original, the bottleneck

const G = 1e9
const fmtG = (m: number) => (m / G >= 10 ? (m / G).toFixed(1) : (m / G).toFixed(2))
const sameWidths = (a: number[], b: number[]) => a.every((v, i) => v === b[i])

// SVG geometry
const W = 720
const ROW = 23
const TOP = 40
const LABEL_X = 150
const BAR_X0 = 156
const BAR_X1 = 648
const VAL_X = 714
const H = TOP + (BACKBONE.length + HEADS.length) * ROW + 30
const barW = (m: number) => Math.max(1.5, (m / MAXBAR) * (BAR_X1 - BAR_X0))

export function PruneStack() {
  const [widths, setWidths] = useState<number[]>(ORIGINAL)

  const macs = useMemo(() => macsOf(widths), [widths])
  const bbTotal = macs.reduce((a, b) => a + b, 0)
  const total = bbTotal + HEAD_MAC
  const bbCut = ORIG_BB / bbTotal
  const totalCut = ORIG_TOTAL / total

  const preset = PRESETS.find((p) => sameWidths(p.widths, widths)) ?? null

  const applyPreset = (p: Preset) => setWidths([...p.widths])
  const setBottleneck = (c: number) => setWidths((w) => [c, ...w.slice(1)])

  const latTxt = preset
    ? `${preset.lat640[0]} / ${preset.lat640[1]} ms at 640×480, ${preset.lat1080[0]} / ${preset.lat1080[1]} ms at 1080p`
    : "not measured for this custom config"
  const spd640 = preset && preset.key !== "orig"
    ? (PRESETS[0].lat640[1] / preset.lat640[1])
    : null
  const spd1080 = preset && preset.key !== "orig"
    ? (PRESETS[0].lat1080[1] / preset.lat1080[1])
    : null

  const summary = `This config keeps ${widths[0]} channels out of backbone_0_0 (into backbone_0_1). The eight backbone convs cost ${fmtG(bbTotal)} GMACs at 640×480, ${bbCut.toFixed(2)}× below the original ${fmtG(ORIG_BB)}; with the two unpruned heads (${fmtG(HEAD_MAC)} GMACs, fixed) the whole network is ${fmtG(total)} GMACs, ${totalCut.toFixed(2)}× below the original ${fmtG(ORIG_TOTAL)}. ${
    preset
      ? preset.key === "orig"
        ? "This is the original model: 1024/1024 keypoints covered and zero descriptor difference by definition."
        : `Measured: ${latTxt}; ${preset.covIn} of 1024 keypoints covered and ${preset.descIn} mean descriptor L2 difference on the indoor trace.`
      : "Latency and quality are only reported by the card for its named variants, not this custom one."
  }`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>SuperPoint backbone · structural pruning · MACs at 640×480</span>
        <span className="text-muted-foreground/50">one forward pass</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={summary}>
          <text x={BAR_X0} y={20} className="fill-muted-foreground font-mono" fontSize={10}>
            multiply-accumulates per layer · ghost = original · bar = this config
          </text>
          <text x={VAL_X} y={20} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            GMACs
          </text>

          {/* block resolution bands */}
          {BLOCKS.map((b) => {
            const y0 = TOP + b.rows[0] * ROW - 4
            const h = b.rows.length * ROW
            return (
              <g key={b.res}>
                <rect x={2} y={y0} width={W - 4} height={h} rx={5} fill={C_BB} opacity={0.04} />
                <text x={6} y={y0 + 13} className="font-mono" fontSize={9.5} fontWeight={600} style={{ fill: C_BB }}>
                  {b.res}
                </text>
                <text x={6} y={y0 + 24} className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {b.note}
                </text>
              </g>
            )
          })}

          {/* backbone bars */}
          {BACKBONE.map((L, i) => {
            const y = TOP + i * ROW + ROW / 2
            const cin = i === 0 ? 1 : widths[i - 1]
            const cout = widths[i]
            const ocin = i === 0 ? 1 : ORIGINAL[i - 1]
            const ocout = ORIGINAL[i]
            const pruned = cin !== ocin || cout !== ocout
            const ow = barW(ORIG_MACS[i])
            const cw = barW(macs[i])
            const isBottleneck = i === 1
            return (
              <g key={L.name}>
                <text x={LABEL_X} y={y + 3} textAnchor="end" className="font-mono" fontSize={9.5} style={{ fill: isBottleneck ? C_BB : "var(--muted-foreground)" }}>
                  {L.name}
                </text>
                {/* ghost original */}
                <rect x={BAR_X0} y={y - 7} width={ow} height={14} rx={2.5} fill={C_SAVE} opacity={pruned ? 0.16 : 0} />
                {/* current */}
                <rect x={BAR_X0} y={y - 7} width={cw} height={14} rx={2.5} fill={C_BB} opacity={isBottleneck ? 0.95 : 0.7} />
                <text x={BAR_X0 + 4} y={y + 3} className="font-mono" fontSize={8.5} fill="white" opacity={cw > 42 ? 0.9 : 0}>
                  {cin}→{cout}
                </text>
                {cw <= 42 ? (
                  <text x={BAR_X0 + cw + 4} y={y + 3} className="fill-muted-foreground font-mono" fontSize={8.5}>
                    {cin}→{cout}
                  </text>
                ) : null}
                <text x={VAL_X} y={y + 3} textAnchor="end" className="font-mono" fontSize={9} style={{ fill: pruned ? C_SAVE : "var(--foreground)" }}>
                  {fmtG(macs[i])}
                </text>
              </g>
            )
          })}

          {/* heads: the fixed floor */}
          {HEADS.map((hd, i) => {
            const y = TOP + (BACKBONE.length + i) * ROW + ROW / 2
            const m = hd.px * hd.cin * hd.cout * hd.k * hd.k
            const cw = barW(m)
            return (
              <g key={hd.name}>
                <text x={LABEL_X} y={y + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9.5}>
                  {hd.name}
                </text>
                <rect x={BAR_X0} y={y - 7} width={cw} height={14} rx={2.5} fill={C_HEAD} opacity={0.6} />
                <text x={BAR_X0 + cw + 4} y={y + 3} className="fill-muted-foreground font-mono" fontSize={8.5}>
                  {hd.cin}→{hd.cout}
                </text>
                <text x={VAL_X} y={y + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                  {fmtG(m)}
                </text>
              </g>
            )
          })}
          <text x={LABEL_X} y={TOP + (BACKBONE.length + HEADS.length) * ROW + 14} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={8.5}>
            heads · never pruned
          </text>
          <text x={BAR_X0} y={TOP + (BACKBONE.length + HEADS.length) * ROW + 14} className="fill-muted-foreground font-mono" fontSize={8.5}>
            the fixed floor: run at 80×60, plus NMS and top-k on the full-size heatmap
          </text>
        </svg>

        {/* bottleneck slider */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>prune the bottleneck — backbone_0_0 output channels (drag)</span>
            <span>
              <span className="text-foreground">{widths[0]}</span> of 64
            </span>
          </div>
          <Range min={8} max={64} step={8} value={widths[0]} onChange={(e) => setBottleneck(Number(e.target.value))} className="w-full cursor-pointer" accent={C_BB} />
        </div>

        {/* presets */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2">
          <span className="font-mono text-[10px] text-muted-foreground">card variants</span>
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              aria-pressed={preset?.key === p.key}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                preset?.key === p.key ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={preset?.key === p.key ? { background: C_BB } : undefined}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* readout */}
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <div className="text-muted-foreground">backbone MACs</div>
            <div className="text-foreground">{fmtG(bbTotal)} G · {bbCut.toFixed(2)}×</div>
          </div>
          <div>
            <div className="text-muted-foreground">whole-net MACs</div>
            <div className="text-foreground">{fmtG(total)} G · {totalCut.toFixed(2)}×</div>
          </div>
          <div>
            <div className="text-muted-foreground">measured latency</div>
            <div className="text-foreground">{spd1080 ? `${spd1080.toFixed(2)}× at 1080p` : preset?.key === "orig" ? "baseline" : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">covered / desc. diff</div>
            <div className="text-foreground">{preset ? `${preset.covIn} / ${preset.descIn}` : "—"}</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {summary}{" "}
          {spd1080 && spd640
            ? `Notice the gap: the compute falls ${totalCut.toFixed(2)}× but the wall clock only ${spd1080.toFixed(2)}× at 1080p (${spd640.toFixed(2)}× at 640×480). The pruned channels are at the front of the backbone, so they remove real work; the heads, the non-maximum suppression and the top-k do not shrink, and they set a floor latency cannot drop below.`
            : "Drag the bottleneck down to 32 to land exactly on pruned-light, or pick pruned · distilled to prune the first six layers — then watch how far below the compute saving the measured latency sits."}
        </p>
      </div>
    </figure>
  )
}
