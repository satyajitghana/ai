"use client"

// How many copies it takes to move one request's KV from a prefill worker to a
// decoder, under the two vLLM layouts Prime Intellect compared.
//
//   LBHNC (layer-major): each layer owns its own cache tensor, so one logical
//   block is LAYERS separate regions and needs LAYERS descriptors.
//   BLHNC (block-major): a block's data for every layer sits together, so one
//   logical block is one contiguous region.
//
// This is the idealised model: one region per layer per block, one descriptor
// per region, no merging of neighbouring blocks. It counts only the MLA latent
// rows (352 B per token per layer in NVFP4). The post's measured counts
// (19,559 vs ~1,940) do not fit it exactly; the article says by how much.
//
// 78 layers: GLM-5.3 config.json. Log scale goes through lib/dmath.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

const LAYERS = 78
const ROW = 352

const LM_BLOCKS = [64, 256, 1024]
const BM_BLOCKS = [16, 64, 256]

function fmtInt(n: number) {
  return Math.round(n).toLocaleString("en-US")
}

function fmtBytes(b: number) {
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`
  return `${(b / 1e3).toFixed(1)} KB`
}

function Picker({
  label,
  values,
  value,
  onPick,
}: {
  label: string
  values: number[]
  value: number
  onPick: (v: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span className="mr-1">{label}</span>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onPick(v)}
          aria-pressed={v === value}
          className={cn(
            "cursor-pointer rounded-md px-2 py-1 transition-colors",
            v === value
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

export function CopyCount() {
  const [ktok, setKtok] = useState(200)
  const [lmB, setLmB] = useState(1024)
  const [bmB, setBmB] = useState(64)
  const tokens = ktok * 1000

  const lmBlocks = Math.ceil(tokens / lmB)
  const bmBlocks = Math.ceil(tokens / bmB)
  const lmCopies = lmBlocks * LAYERS
  const bmCopies = bmBlocks
  const lmSize = lmB * ROW
  const bmSize = bmB * ROW * LAYERS
  const totalBytes = tokens * ROW * LAYERS

  const W = 860
  const left = 150
  const right = 700
  const lo = 2 // 100 copies
  const hi = 6 // 1,000,000 copies
  const x = (n: number) =>
    left + ((mlog10(Math.max(n, 100)) - lo) / (hi - lo)) * (right - left)

  const bars = [
    {
      name: "layer-major",
      sub: `LBHNC · ${lmB}-tok blocks`,
      n: lmCopies,
      size: lmSize,
      cls: "fill-orange-500/70 stroke-orange-600",
      y: 40,
    },
    {
      name: "block-major",
      sub: `BLHNC · ${bmB}-tok blocks`,
      n: bmCopies,
      size: bmSize,
      cls: "fill-lime-500/70 stroke-lime-600",
      y: 100,
    },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        copies to move one request&rsquo;s latent KV · 78 layers · NVFP4 rows
        (352 B) · idealised: one copy per contiguous region
      </div>

      <div className="space-y-2 px-3 pt-3 sm:px-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">request length</span>
          <Range
            min={8}
            max={256}
            step={8}
            value={ktok}
            onChange={(e) => setKtok(Number(e.target.value))}
            className="min-w-[160px] flex-1 cursor-pointer"
            aria-label="Request length in thousands of tokens"
          />
          <span className="w-16 text-right text-foreground">{ktok}K tok</span>
        </label>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Picker
            label="layer-major block"
            values={LM_BLOCKS}
            value={lmB}
            onPick={setLmB}
          />
          <Picker
            label="block-major block"
            values={BM_BLOCKS}
            value={bmB}
            onPick={setBmB}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} 170`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label={`Copies on a log scale for a ${ktok} thousand token request. Layer-major with ${lmB}-token blocks needs ${fmtInt(lmCopies)} copies of ${fmtBytes(lmSize)} each. Block-major with ${bmB}-token blocks needs ${fmtInt(bmCopies)} copies of ${fmtBytes(bmSize)} each. Both move the same ${fmtBytes(totalBytes)}.`}
        >
          {[100, 1000, 10000, 100000, 1000000].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                y1={24}
                x2={x(t)}
                y2={146}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={x(t)}
                y={162}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {t.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {bars.map((b) => (
            <g key={b.name}>
              <text
                x={left - 12}
                y={b.y + 14}
                textAnchor="end"
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {b.name}
              </text>
              <text
                x={left - 12}
                y={b.y + 28}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {b.sub}
              </text>
              <rect
                x={left}
                y={b.y}
                width={x(b.n) - left}
                height={30}
                rx={2}
                className={b.cls}
                strokeWidth={1}
              />
              <text
                x={x(b.n) + 8}
                y={b.y + 13}
                className="fill-foreground font-mono"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {fmtInt(b.n)}
              </text>
              <text
                x={x(b.n) + 8}
                y={b.y + 27}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {fmtBytes(b.size)} each
              </text>
            </g>
          ))}
        </svg>
      </div>

      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Same {fmtBytes(totalBytes)} either way. Layer-major pays one copy per
        layer per block, so its count is 78 &times; blocks and each copy is a
        single layer&rsquo;s slice of one block. Block-major pays one per block.
        This is the idealised count for each layout; the post&rsquo;s measured
        descriptor counts do not fit it exactly, and the article works out
        where they part.
      </figcaption>
    </figure>
  )
}
