"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What one TPU v5e chip is holding after kaggle-tpu-lab's GLM-5.3-Flash build,
// reconstructed from bytes rather than taken from the README's summary line.
//
// The expert number is exact. It comes from walking the GGUF tensor index of
// unsloth/GLM-5.3-Flash-GGUF UD-IQ3_XXS by HTTP range read (1,412 tensors over
// four shards, 129 of them expert tables), keeping only the 42 layers the serve
// kernel actually loads — `for i in range(N_LAYERS)` with N_LAYERS =
// num_hidden_layers = 45, so blk.45, the MTP layer, is never read — and then
// re-deriving the planar repack glm53/planes.py performs before device_put:
//
//   GGUF blocks, blk.3..blk.44   109,867,696,128 B  = 13.733 GB/chip
//   after the planar repack      110,717,042,688 B  = 13.840 GB/chip  (+0.77%)
//
// The overhead is not slop. The planes store each GGUF block field as a dense
// u32 plane, and the f16 block scale `d` is packed one u32 per TWO blocks, so a
// down projection whose per-chip slice is a single block rounds 2 bytes up to 4.
//
// Everything else is derived and flagged as derived. Non-expert parameters:
// 8.921B over layers 0..44 plus the untied embedding and lm_head, summed from
// the same GGUF index, held int8 (`int8_nonexpert="all"`, which covers the
// vocab-sharded embedding and lm_head too). Vision is the repo's own figure.
// Norms are the GGUF's F32 tensors. The residual is what my arithmetic cannot
// itemise against the 15.4 GB the kernel's own hbm() print reports, and it is
// shown rather than absorbed.
//
// A cache set is computed from glm53/model.py mla_cache_shapes and
// resident.py alloc_caches at max_len = 262,144 with cache_q8 and seq_shard
// over 8 chips.
//
// Arithmetic is +, -, *, / and Math.round only — exact on every engine, so no
// lib/dmath wrapper is needed and SSR and the client cannot disagree.

const GB = 1e9

// per chip, bytes
const EXPERTS = 110_717_042_688 / 8 // 13.840 GB — exact, from the GGUF headers
const NONEXPERT = 8_921_000_000 / 8 // 8.921B params at int8
const VISION = 0.14 * GB // the repo's own number: "vision: False saves ~1 min and 0.14 GB/chip"
const NORMS = 0.03 * GB // the GGUF's 638 F32 tensors, per chip

// one 262,144-token cache set, per chip, straight from the shape functions
const MLA_LAYERS = 11
const KDA_LAYERS = 34
const SET_MLA = MLA_LAYERS * (16_777_216 + 131_072 + 2_097_152 + 2048)
const SET_KDA = KDA_LAYERS * (524_288 + 18_432)
const SET = SET_MLA + SET_KDA // 227,534,848 B = 0.23 GB

const LIMIT = 16.9 * GB // what the kernel's hbm() prints as bytes_limit on chip 0
const MIN_FREE = 0.55 * GB // CFG["min_free_gb"]
const REPORTED = 15.4 * GB // what the kernel logs after the build

const ACCOUNTED = EXPERTS + NONEXPERT + VISION + NORMS
const RESIDUAL = REPORTED - ACCOUNTED

const BUILD: { label: string; bytes: number; tone: string; exact: boolean }[] = [
  { label: "routed experts, 3-bit planar", bytes: EXPERTS, tone: "#7c3aed", exact: true },
  { label: "everything else, int8", bytes: NONEXPERT, tone: "#0369a1", exact: false },
  { label: "vision tower", bytes: VISION, tone: "#0d9488", exact: false },
  { label: "f32 norms", bytes: NORMS, tone: "#65a30d", exact: false },
  { label: "residual I cannot itemise", bytes: RESIDUAL, tone: "#64748b", exact: false },
]

const gb = (b: number) => (Math.round((b / GB) * 100) / 100).toFixed(2)
const pct = (b: number) => `${Math.round((b / LIMIT) * 1000) / 10}%`

export function HbmBudget() {
  const [sets, setSets] = useState(3)

  const cacheBytes = sets * SET
  const used = REPORTED + cacheBytes
  const free = LIMIT - used
  const admits = free >= MIN_FREE

  const segs = [
    ...BUILD,
    ...(sets > 0
      ? [
          {
            label: `${sets} cache set${sets === 1 ? "" : "s"} at 262,144 tokens`,
            bytes: cacheBytes,
            tone: "#b45309",
            exact: false,
          },
        ]
      : []),
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one TPU v5e chip &middot; 16.9 GB usable HBM
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          solid = exact from the GGUF headers &middot; faded = derived
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div
          className="flex h-11 w-full overflow-hidden rounded-md border"
          role="img"
          aria-label={`HBM held per chip: ${segs
            .map((s) => `${s.label}, ${gb(s.bytes)} gigabytes`)
            .join("; ")}. Free: ${gb(Math.max(free, 0))} gigabytes of 16.9.`}
        >
          {segs.map((s) => (
            <div
              key={s.label}
              className="h-full"
              style={{
                width: `${(s.bytes / LIMIT) * 100}%`,
                backgroundColor: s.tone,
                opacity: s.exact ? 0.95 : 0.55,
              }}
            />
          ))}
          <div
            className="h-full bg-foreground/5"
            style={{ width: `${(Math.max(free, 0) / LIMIT) * 100}%` }}
          />
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {segs.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-sm"
                style={{ backgroundColor: s.tone, opacity: s.exact ? 0.95 : 0.55 }}
              />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <span className="font-mono tabular-nums">{gb(s.bytes)} GB</span>
              <span className="w-10 text-right font-mono text-[10px] text-muted-foreground">
                {pct(s.bytes)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-md border bg-background/60 p-3">
          <label
            htmlFor="hbm-sets"
            className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]"
          >
            <span>concurrent 262k cache sets</span>
            <span className="text-muted-foreground">
              {gb(SET)} GB each &middot; config allows 4, README says 3 fit
            </span>
          </label>
          <input
            id="hbm-sets"
            type="range"
            min={0}
            max={6}
            step={1}
            value={sets}
            onChange={(e) => setSets(Number(e.target.value))}
            className="mt-2 w-full accent-amber-600"
          />
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 font-mono text-xs">
            <span>
              used <span className="tabular-nums">{gb(used)}</span> / 16.90 GB
            </span>
            <span
              className={cn(
                "tabular-nums",
                admits
                  ? "text-teal-700 dark:text-teal-400"
                  : "text-rose-700 dark:text-rose-400"
              )}
            >
              free {gb(Math.max(free, 0))} GB &mdash;{" "}
              {admits
                ? "clears the 0.55 GB admission guard"
                : "under the 0.55 GB guard, the next stream waits"}
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          The guard in <code>scheduler.py</code> refuses a new stream when free
          HBM falls under <code>min_free_gb = 0.55</code>. On this reconstruction
          a fourth 262k set still clears it, by about 40 MB of a 16.9 GB chip.
          The README says three and the notebook says three; both are describing
          what happens once a 512-token prefill piece is in flight beside them. I
          have no TPU, so I cannot settle which number is right.
        </p>
      </div>
    </figure>
  )
}
