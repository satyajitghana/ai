"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where one decoded token's time goes, for the runs in the omarchy-egpu
// records. A dense decode step reads every weight on the card once, so the
// card's peak memory bandwidth sets a floor:
//
//   floor_ms = (weight GB + KV GB at this depth) / peak GB/s × 1000
//   measured_ms = 1000 / tok/s           gap = measured − floor
//
// Weight bytes: Qwen3.8-27B Q4_0's on-card model buffer, 15,065,122,816 bytes
// (14367.22 MiB, read from the GGUF header: every tensor except token_embd and
// the multi-token-prediction block 64). Llama-2-7B Q4_0: about 3.75 GB (its
// 3.56 GiB file minus the token-embedding table; reasoned). KV: 16 attention
// layers × K and V × 4 heads × 256 dims × 2 bytes = 64 KiB per cached token.
// Peaks: Arc Pro B60 456 GB/s (Intel's press deck), RTX 5060 Ti 448 GB/s
// (NVIDIA's spec). Measured tok/s are the repo's llama-bench means.
//
// The "weights over the link" toggle asks what happens if the weights stayed
// in the Mac's memory and crossed Thunderbolt every token instead.

type Run = {
  key: string
  label: string
  card: "b60" | "5060"
  gb: number
  depth: number
  tps: number
  note: string
}

const KV_PER_TOKEN = 65536
const QWEN_GB = 15.065
const LLAMA_GB = 3.75
const PEAK = { b60: 456, "5060": 448 } as const

const RUNS: Run[] = [
  { key: "q40", label: "B60 · Qwen3.8-27B Q4_0", card: "b60", gb: QWEN_GB, depth: 0, tps: 17.28, note: "five pools in VRAM, fa1, n=5" },
  { key: "shader", label: "B60 · same, shader heap only", card: "b60", gb: QWEN_GB, depth: 0, tps: 11.97, note: "descriptor and state pools behind the link" },
  { key: "d32", label: "B60 · Q4_0 at 32768 cached", card: "b60", gb: QWEN_GB, depth: 32768, tps: 14.45, note: "llama-bench -d 32768" },
  { key: "5060", label: "RTX 5060 Ti · Q4_0, Vulkan", card: "5060", gb: QWEN_GB, depth: 0, tps: 22.52, note: "same Mac, same tunnel, NVIDIA open driver" },
  { key: "l2before", label: "B60 · Llama-2-7B, stock placement", card: "b60", gb: LLAMA_GB, depth: 0, tps: 18.89, note: "xe 0014, setting off, fa1" },
  { key: "l2after", label: "B60 · Llama-2-7B, buffers in VRAM", card: "b60", gb: LLAMA_GB, depth: 0, tps: 65.96, note: "shader heap and five pools, fa1" },
]

export function DecodeBudget() {
  const [key, setKey] = useState("q40")
  const [overLink, setOverLink] = useState(false)
  const [link, setLink] = useState(4)
  const run = RUNS.find((r) => r.key === key) ?? RUNS[0]

  const kvGB = (run.depth * KV_PER_TOKEN) / 1e9
  const bytesGB = run.gb + kvGB
  const peak = PEAK[run.card]
  const floorMs = (bytesGB / peak) * 1000
  const measuredMs = 1000 / run.tps
  const gapMs = Math.max(0, measuredMs - floorMs)
  const effective = bytesGB * run.tps
  const linkMs = (run.gb / link) * 1000
  const totalMs = overLink ? linkMs + measuredMs : measuredMs
  const scale = (ms: number) => `${Math.min(100, (ms / totalMs) * 100).toFixed(2)}%`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One decoded token, split into the bandwidth floor and the rest · measured runs, reasoned floor
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {RUNS.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setKey(r.key)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              r.key === key
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="space-y-2.5 border-b px-4 py-3 text-xs">
        <label className="flex items-center gap-2 font-mono">
          <input
            type="checkbox"
            checked={overLink}
            onChange={(e) => setOverLink(e.target.checked)}
          />
          <span>what if the weights crossed Thunderbolt every token</span>
        </label>
        {overLink ? (
          <label className="flex items-center gap-3">
            <span className="w-36 shrink-0 font-mono text-muted-foreground">link GB/s</span>
            <Range
              min={1}
              max={8}
              step={0.5}
              value={link}
              onChange={(e) => setLink(Number(e.target.value))}
              aria-label="link bandwidth in GB/s"
              className="w-full"
            />
            <span className="w-14 shrink-0 text-right font-mono tabular-nums">{link.toFixed(1)}</span>
          </label>
        ) : null}
      </div>

      <div className="space-y-3 px-4 py-4 text-xs">
        <div className="flex h-5 overflow-hidden rounded-sm bg-muted">
          {overLink ? (
            <div
              className="h-5"
              style={{ width: scale(linkMs), background: "oklch(0.62 0.17 30)" }}
              title="weights over the link"
            />
          ) : null}
          <div
            className="h-5"
            style={{ width: scale(floorMs), background: "oklch(0.55 0.16 250)" }}
            title="bandwidth floor"
          />
          <div
            className="h-5"
            style={{ width: scale(gapMs), background: "oklch(0.75 0.12 85)" }}
            title="everything else"
          />
        </div>
        <div className="grid grid-cols-1 gap-1 font-mono sm:grid-cols-2">
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm" style={{ background: "oklch(0.55 0.16 250)" }} />
            floor: {bytesGB.toFixed(2)} GB at {peak} GB/s = {floorMs.toFixed(1)} ms
          </span>
          <span>
            <span className="mr-1 inline-block size-2.5 rounded-sm" style={{ background: "oklch(0.75 0.12 85)" }} />
            rest: {gapMs.toFixed(1)} ms (kernels below peak, dispatch, driver)
          </span>
          {overLink ? (
            <span>
              <span className="mr-1 inline-block size-2.5 rounded-sm" style={{ background: "oklch(0.62 0.17 30)" }} />
              link: {run.gb.toFixed(2)} GB at {link.toFixed(1)} GB/s = {(linkMs / 1000).toFixed(2)} s
            </span>
          ) : null}
        </div>
        <div className="rounded border bg-muted/40 px-3 py-2 font-mono tabular-nums">
          {overLink ? (
            <>
              ceiling with weights over the link: {(1000 / totalMs).toFixed(2)} tok/s, against {run.tps} measured
            </>
          ) : (
            <>
              measured {run.tps} tok/s = {measuredMs.toFixed(1)} ms · bandwidth ceiling{" "}
              {(peak / bytesGB).toFixed(1)} tok/s · effective {effective.toFixed(0)} GB/s ={" "}
              {((effective / peak) * 100).toFixed(0)}% of peak
            </>
          )}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {run.label}: {run.note}. The floor counts weights{run.depth ? " and the KV cache" : ""} read
        once at the card&apos;s peak bandwidth and nothing else, so no real run reaches it. The link
        toggle is a thought experiment: the measured runs keep every layer on the card.
      </figcaption>
    </figure>
  )
}
