"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The geometry the NR network actually runs on, for any frame size.
//
// This is a line-for-line port of Geometry::fromValid and fieldAlignment from
// OpenDLSS-NR's src/nr_graph.cpp (commit 9d08f41). Every level halves its
// input and rounds up to a multiple of 4; the frame is padded to a "field"
// aligned to 2^(number of size reductions on that axis), floored at 320, and
// then — native's rule, with no stated reason — widened by one more alignment
// when both axes are a multiple of four alignments. The port refuses sizes
// where level 0 is not a whole number of 8-pixel windows (widths 1-16 and
// 25-32), because native crops there and the port does not.
//
// Checked against every example in docs/network.md and docs/execution.md:
// 512x512 -> 576x512, 768x768 -> 832x768, 644x768 -> 768x768,
// 1920x1080 -> 1920x1152, 2560x1440 -> 2560x1472, 3840x2160 -> 3840x2176.
//
// The timings are the repository's (docs/execution.md: RTX 4070 SUPER, whole
// network, minimum over 40 frames, 241 dispatches), shown only at the five
// sizes it reports. Nothing here runs the network. Integer arithmetic only.

const ACC = "oklch(0.62 0.14 250)"
const PAD = "oklch(0.70 0.14 60)"
const OK = "oklch(0.60 0.14 155)"
const BAD = "oklch(0.60 0.19 27)"

const alignUp = (v: number, a: number) => Math.floor((v + a - 1) / a) * a
const halve = (v: number) => alignUp(Math.floor((v + 1) / 2), 4)

function fieldAlignment(valid: number) {
  let reductions = 0
  let size = valid
  for (let level = 0; level < 6; level++) {
    const half = halve(size)
    if (half < size) reductions++
    if (level === 0 && half % 8 !== 0) reductions++
    size = half
  }
  return 1 << reductions
}

type Geo = {
  fw: number
  fh: number
  aw: number
  ah: number
  widened: boolean
  levels: [number, number][]
  refused: boolean
}

function geometry(w: number, h: number): Geo {
  const aw = fieldAlignment(w)
  const ah = fieldAlignment(h)
  let fw = Math.max(320, alignUp(w, aw))
  const fh = Math.max(320, alignUp(h, ah))
  const widened = fw % (4 * aw) === 0 && fh % (4 * ah) === 0
  if (widened) fw += aw
  const levels: [number, number][] = []
  let lw = fw
  let lh = fh
  for (let l = 0; l < 6; l++) {
    lw = halve(lw)
    lh = halve(lh)
    levels.push([lw, lh])
  }
  const refused = levels[0][0] % 8 !== 0 || levels[0][1] % 8 !== 0
  return { fw, fh, aw, ah, widened, levels, refused }
}

// Channels and block ranges per level (docs/network.md, src/nr_graph.cpp).
// Block 39 is the ViT's exit merge (1024 -> 512 projection + skip), not an
// attention block, so the attention blocks number 70 and the records 71.
const ROWS = [
  { name: "field", ch: 32, blocks: "0, 70", n: 2 },
  { name: "L0", ch: 32, blocks: "1–4, 66–69", n: 8 },
  { name: "L1", ch: 64, blocks: "5–8, 62–65", n: 8 },
  { name: "L2", ch: 128, blocks: "9–14, 56–61", n: 12 },
  { name: "L3", ch: 256, blocks: "15–22, 48–55", n: 16 },
  { name: "L4", ch: 512, blocks: "23–30, 40–47", n: 16 },
  { name: "L5", ch: 1024, blocks: "31–38 (ViT)", n: 8 },
] as const

const MEASURED: Record<string, { ms: number; gflop: number; tflops: number }> = {
  "512x512": { ms: 2.72, gflop: 139, tflops: 51 },
  "768x768": { ms: 2.83, gflop: 297, tflops: 105 },
  "1920x1080": { ms: 7.77, gflop: 1021, tflops: 131 },
  "2560x1440": { ms: 12.6, gflop: 1730, tflops: 137 },
  "3840x2160": { ms: 29.3, gflop: 3907, tflops: 133 },
}

const PRESETS: [number, number][] = [
  [512, 512],
  [768, 768],
  [644, 768],
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
]

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
const pct = (num: number, den: number) => ((num / den) * 100).toFixed(1)

export function FieldPyramid() {
  const [w, setW] = useState(1920)
  const [h, setH] = useState(1080)

  const g = useMemo(() => geometry(w, h), [w, h])
  const measured = MEASURED[`${w}x${h}`]

  // Field drawing: fit the padded field into a 300x170 box.
  const BOX_W = 300
  const BOX_H = 170
  const s = Math.min(BOX_W / g.fw, BOX_H / g.fh)
  const FW = g.fw * s
  const FH = g.fh * s
  const VW = w * s
  const VH = h * s
  const extra = g.fw * g.fh - w * h

  const rows = g.levels.map((lv, i) => ({ size: lv, meta: ROWS[i + 1] }))
  const vitTokens = g.levels[5][0] * g.levels[5][1]
  const vitPadded = alignUp(vitTokens, 64)

  const BUDGET_MAX = 35
  const bx = (ms: number) => `${Math.min(100, (ms / BUDGET_MAX) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">the padded field and the pyramid · Geometry::fromValid</span>
        <span className="font-mono text-[10px] text-muted-foreground">ported from src/nr_graph.cpp · integer arithmetic</span>
      </div>

      <div className="space-y-3 border-b px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(([pw, ph]) => {
            const on = pw === w && ph === h
            return (
              <button
                key={`${pw}x${ph}`}
                type="button"
                onClick={() => {
                  setW(pw)
                  setH(ph)
                }}
                aria-pressed={on}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] tabular-nums transition-colors",
                  on
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {pw}×{ph}
              </button>
            )
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              width <span className="tabular-nums text-foreground">{w}</span>
            </span>
            <Range
              min={8}
              max={3840}
              step={1}
              value={w}
              onChange={(e) => setW(Number(e.target.value))}
              aria-label="frame width in pixels"
              accent={ACC}
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              height <span className="tabular-nums text-foreground">{h}</span>
            </span>
            <Range
              min={8}
              max={2160}
              step={1}
              value={h}
              onChange={(e) => setH(Number(e.target.value))}
              aria-label="frame height in pixels"
              accent={ACC}
              className="mt-1 w-full"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,19rem)_1fr]">
        <div>
          <svg
            viewBox={`0 0 ${BOX_W + 2} ${BOX_H + 2}`}
            className="w-full"
            role="img"
            aria-label={`A ${w} by ${h} frame is run on a ${g.fw} by ${g.fh} field. The frame sits at the top left; the padding to the right and below is filled with a mirrored copy of the image.`}
          >
            <defs>
              <pattern id="odnr-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={PAD} strokeWidth="2" strokeOpacity="0.55" />
              </pattern>
            </defs>
            <rect x={1} y={1} width={FW} height={FH} fill="url(#odnr-hatch)" stroke={PAD} strokeWidth={1} />
            <rect x={1} y={1} width={VW} height={VH} fill={ACC} fillOpacity={0.22} stroke={ACC} strokeWidth={1.2} />
          </svg>
          <div className="mt-2 space-y-1 font-mono text-[11px] leading-snug">
            <div className="flex gap-2">
              <span aria-hidden className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: ACC, opacity: 0.6 }} />
              <span className="text-muted-foreground">
                valid <span className="tabular-nums text-foreground">{w}×{h}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <span aria-hidden className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PAD, opacity: 0.7 }} />
              <span className="text-muted-foreground">
                field <span className="tabular-nums text-foreground">{g.fw}×{g.fh}</span>
                {" · "}
                <span className="tabular-nums">+{pct(extra, w * h)}%</span> pixels
              </span>
            </div>
            <div className="text-muted-foreground">
              alignment <span className="tabular-nums text-foreground">{g.aw}</span> ×{" "}
              <span className="tabular-nums text-foreground">{g.ah}</span>
              {g.widened ? (
                <>
                  {" · "}
                  <span className="text-foreground">+{g.aw}</span> on the width (the unexplained step)
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {g.refused ? (
            <p className="my-0 rounded-md border px-3 py-2 text-xs" style={{ borderColor: BAD, color: BAD }}>
              Refused. Level 0 comes out at {g.levels[0][0]}×{g.levels[0][1]}, not a whole number of 8-pixel windows.
              Native runs its level-0 decoder stage on whole windows and crops in the last block here; the port does not
              implement that crop, so it throws rather than differ silently.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="my-0 w-full border-collapse font-mono text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">level</th>
                  <th className="py-1 pr-2 font-normal">size</th>
                  <th className="py-1 pr-2 text-right font-normal">ch</th>
                  <th className="py-1 pr-2 text-right font-normal">tokens</th>
                  <th className="py-1 pr-2 text-right font-normal">8×8 windows</th>
                  <th className="py-1 font-normal">blocks</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-t">
                  <td className="py-1 pr-2">field</td>
                  <td className="py-1 pr-2">
                    {g.fw}×{g.fh}
                  </td>
                  <td className="py-1 pr-2 text-right">32</td>
                  <td className="py-1 pr-2 text-right">{fmt(g.fw * g.fh)}</td>
                  <td className="py-1 pr-2 text-right">{fmt(Math.ceil(g.fw / 8) * Math.ceil(g.fh / 8))}</td>
                  <td className="py-1 text-muted-foreground">0, 70</td>
                </tr>
                {rows.map(({ size: [lw, lh], meta }) => (
                  <tr key={meta.name} className="border-t">
                    <td className="py-1 pr-2">{meta.name}</td>
                    <td className="py-1 pr-2">
                      {lw}×{lh}
                    </td>
                    <td className="py-1 pr-2 text-right">{meta.ch}</td>
                    <td className="py-1 pr-2 text-right">{fmt(lw * lh)}</td>
                    <td className="py-1 pr-2 text-right">
                      {meta.name === "L5" ? "global" : fmt(Math.ceil(lw / 8) * Math.ceil(lh / 8))}
                    </td>
                    <td className="py-1 text-muted-foreground">{meta.blocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mb-0 mt-2 text-xs text-muted-foreground">
            The ViT attends over all <span className="tabular-nums text-foreground">{fmt(vitTokens)}</span> level-5 tokens
            at once, padded to <span className="tabular-nums text-foreground">{fmt(vitPadded)}</span>. Window counts are
            for phase 0; a shifted phase adds up to a row and a column of part-empty windows.
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        {measured ? (
          <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">
                network time, RTX 4070 SUPER{" "}
                <span className="text-foreground tabular-nums">{measured.ms} ms</span>
              </span>
              <span className="text-muted-foreground tabular-nums">
                {fmt(measured.gflop)} GFLOP · {measured.tflops} TFLOP/s · reported
              </span>
            </div>
            <div className="relative h-3 rounded-sm bg-muted/40">
              <div className="h-full rounded-sm" style={{ width: bx(measured.ms), background: measured.ms > 16.67 ? BAD : OK }} />
              {[
                { ms: 8.33, l: "120 Hz" },
                { ms: 16.67, l: "60 Hz" },
                { ms: 33.33, l: "30 Hz" },
              ].map((m) => (
                <div key={m.l} className="absolute top-[-3px] h-[18px] w-px bg-foreground/50" style={{ left: bx(m.ms) }} />
              ))}
            </div>
            <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
              {[
                { ms: 8.33, l: "120 Hz" },
                { ms: 16.67, l: "60 Hz" },
                { ms: 33.33, l: "30 Hz" },
              ].map((m) => (
                <span key={m.l} className="absolute -translate-x-1/2" style={{ left: bx(m.ms) }}>
                  {m.l}
                </span>
              ))}
            </div>
            <p className="mb-0 mt-1 text-xs text-muted-foreground">
              That is {pct(measured.ms, 16.67)}% of a 60 Hz frame for the network alone. The game&apos;s own render, the
              feature preprocess and the composite come on top, and the benchmark times none of them.
            </p>
          </div>
        ) : (
          <p className="my-0 text-xs text-muted-foreground">
            The repository reports timings at 512×512, 768×768, 1920×1080, 2560×1440 and 3840×2160 only. Pick one of
            those to see its number against a frame budget.
          </p>
        )}
      </div>
    </figure>
  )
}
