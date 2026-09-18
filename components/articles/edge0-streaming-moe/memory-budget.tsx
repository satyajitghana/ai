"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where Edge0's peak-memory number actually goes, built from the checkpoint's
// own safetensors headers rather than from anybody's README.
//
// Every byte below was read by HTTP range request against
// huggingface.co/Edge0/Edge0-35B-A3B-preview and .../Edge0-8B-A1B-preview:
// 8 bytes for the header length, then the JSON header, then the unpacked width
// recovered from each tensor's .scales group count. 1,757 tensors for the 35B
// tier, 1,196 for the 8B. No weights downloaded.
//
// The point the widget makes is the one the pitch elides. "Peak memory is
// bounded by the active set, not the parameter count" is true, and the active
// set is the only part of the bar that moves with K. Everything to its left —
// attention, the untied lm_head, the embedding table, the shared expert, the
// router gates, and the two adapter files that make the pipeline work — is a
// fixed floor that streaming can never touch. For the 35B tier that floor is
// 1.46 GiB before a single expert is read.
//
// Arithmetic is +, -, *, / and Math.round only: exact on every engine, so no
// lib/dmath wrapper is needed and no SSR/client coordinate can disagree.

type Slice = { label: string; bytes: number; kind: "fixed" | "adapter" | "expert" }

type Tier = {
  id: string
  name: string
  repo: string
  moeLayers: number
  perExpert: number
  nativeK: number
  shippedK: number
  fixed: Slice[]
  adapters: Slice[]
  published: { label: string; bytes: number; where: string }[]
}

const GIB = 1024 * 1024 * 1024
const MIB = 1024 * 1024

const TIERS: Tier[] = [
  {
    id: "35b",
    name: "edge0-35b",
    repo: "Edge0/Edge0-35B-A3B-preview",
    moeLayers: 40,
    perExpert: 1_769_472,
    nativeK: 8,
    shippedK: 4,
    fixed: [
      { label: "attention (40 layers)", bytes: 723_784_960, kind: "fixed" },
      { label: "lm_head (untied)", bytes: 286_064_640, kind: "fixed" },
      { label: "embed_tokens", bytes: 286_064_640, kind: "fixed" },
      { label: "shared expert", bytes: 70_865_920, kind: "fixed" },
      { label: "router gates (8-bit)", bytes: 22_282_240, kind: "fixed" },
      { label: "norms", bytes: 331_776, kind: "fixed" },
    ],
    adapters: [
      { label: "prerouter (33 heads, fp16)", bytes: 138_412_032, kind: "adapter" },
      { label: "recovery LoRA (r=16)", bytes: 42_332_160, kind: "adapter" },
    ],
    published: [
      { label: "1.7 GiB", bytes: 1.7 * GIB, where: "iPhone 16 Pro demo video" },
      { label: "2.9 GiB", bytes: 2.9 * GIB, where: "README + paper, M4 Pro" },
      { label: "3.32 GiB", bytes: 3400 * 1_000_000, where: "peak_active_mem_mb=3400" },
    ],
  },
  {
    id: "8b",
    name: "edge0-8b",
    repo: "Edge0/Edge0-8B-A1B-preview",
    moeLayers: 23,
    perExpert: 1_327_104,
    nativeK: 8,
    shippedK: 8,
    fixed: [
      { label: "attention (24 layers, MLA)", bytes: 217_143_360, kind: "fixed" },
      { label: "lm_head (untied)", bytes: 135_806_976, kind: "fixed" },
      { label: "embed_tokens", bytes: 135_806_976, kind: "fixed" },
      { label: "dense MLP (layer 0)", bytes: 69_173_248, kind: "fixed" },
      { label: "shared expert", bytes: 30_523_392, kind: "fixed" },
      { label: "router gates", bytes: 13_031_168, kind: "fixed" },
      { label: "norms", bytes: 76_800, kind: "fixed" },
    ],
    adapters: [
      { label: "prerouter (16 heads, fp16)", bytes: 38_797_312, kind: "adapter" },
      { label: "recovery LoRA (r=16)", bytes: 16_379_904, kind: "adapter" },
    ],
    published: [
      { label: "1.0 GiB", bytes: 1.0 * GIB, where: "README + HF card" },
      { label: "1.37 GiB", bytes: 1400 * 1_000_000, where: "peak_active_mem_mb=1400" },
      { label: "1.4 GiB", bytes: 1.4 * GIB, where: "options.py prod_k8 docstring" },
      { label: "1.5 GiB", bytes: 1.5 * GIB, where: "arXiv Table 1" },
    ],
  },
]

const KS = [1, 2, 4, 8]
const COLORS = { fixed: "#475569", adapter: "#b91c1c", expert: "#0369a1" }

const r2 = (n: number) => Math.round(n * 100) / 100
const gib = (b: number) => `${r2(b / GIB)} GiB`
const mib = (b: number) => `${r2(b / MIB)} MiB`

export function MemoryBudget() {
  const [tierId, setTierId] = useState("35b")
  const [k, setK] = useState(4)

  const tier = TIERS.find((t) => t.id === tierId) ?? TIERS[0]
  const fixedTotal = tier.fixed.reduce((a, s) => a + s.bytes, 0)
  const adapterTotal = tier.adapters.reduce((a, s) => a + s.bytes, 0)
  const expertTotal = k * tier.moeLayers * tier.perExpert
  const floor = fixedTotal + adapterTotal
  const total = floor + expertTotal

  const maxPublished = Math.max(...tier.published.map((p) => p.bytes))
  const axisMax = Math.max(total, maxPublished) * 1.08
  const pct = (b: number) => `${r2((b / axisMax) * 100)}%`

  const segments: Slice[] = [
    { label: "non-expert weights", bytes: fixedTotal, kind: "fixed" },
    { label: "adapters", bytes: adapterTotal, kind: "adapter" },
    { label: `experts, K=${k}`, bytes: expertTotal, kind: "expert" },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          measured memory floor vs. published peak
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          safetensors headers, 18 Sept 2026
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5" role="group" aria-label="tier">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTierId(t.id)
                  setK(t.shippedK)
                }}
                aria-pressed={t.id === tierId}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                  t.id === tierId
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              routed width K
            </span>
            <div className="flex rounded-md border p-0.5" role="group" aria-label="routed width K">
              {KS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setK(v)}
                  aria-pressed={v === k}
                  className={cn(
                    "rounded px-2 py-1 font-mono text-xs transition-colors",
                    v === k
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">
          <span className="text-foreground">{tier.repo}</span> · config.json says{" "}
          <span className="text-foreground">num_experts_per_tok: {tier.nativeK}</span> · edge0
          ships <span className="text-foreground">top_k={tier.shippedK}</span> ·{" "}
          {mib(tier.perExpert)} per expert, {tier.moeLayers} MoE layers
        </p>

        <div className="mt-4">
          <div className="relative h-14 w-full overflow-hidden rounded-md border bg-muted/20">
            <div className="flex h-full">
              {segments.map((s) => (
                <div
                  key={s.label}
                  style={{ width: pct(s.bytes), background: COLORS[s.kind] }}
                  className="h-full"
                  title={`${s.label} — ${mib(s.bytes)}`}
                />
              ))}
            </div>
            {tier.published.map((p) => (
              <div
                key={p.label}
                className="absolute top-0 h-full border-l-2 border-dashed border-foreground/70"
                style={{ left: pct(p.bytes) }}
                aria-hidden
              />
            ))}
          </div>

          {/* Markers are staggered over three rows and flipped to the left of
              their rule once they pass 68% of the axis, so neighbouring peaks
              (2.9 and 3.32 GiB, or 1.37 and 1.4) never overprint each other. */}
          <div className="relative mt-1 h-16">
            {tier.published.map((p, i) => {
              const at = (p.bytes / axisMax) * 100
              const flip = at > 68
              return (
                <span
                  key={p.label}
                  className={cn(
                    "absolute font-mono text-[9px] leading-[1.15] whitespace-nowrap text-muted-foreground",
                    flip ? "-translate-x-full pr-1.5 text-right" : "pl-1.5"
                  )}
                  style={{ left: pct(p.bytes), top: `${(i % 3) * 20}px` }}
                >
                  <span className="text-foreground">{p.label}</span>
                  <br />
                  {p.where}
                </span>
              )
            })}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {[
            ["fixed floor", gib(fixedTotal), "non-expert weights"],
            ["+ adapters", gib(floor), "prerouter + LoRA"],
            [`+ experts K=${k}`, gib(total), "every layer's set at once"],
            ["expert share", `${r2((expertTotal / total) * 100)}%`, "of the measured total"],
          ].map(([a, b, c]) => (
            <div key={a} className="rounded-md border bg-muted/20 px-2.5 py-2">
              <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
                {a}
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{b}</dd>
              <dd className="font-mono text-[9px] text-muted-foreground">{c}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {segments.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: COLORS[s.kind] }}
              />
              {s.label} — {mib(s.bytes)}
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Only the right-hand segment moves with{" "}
          <span className="font-mono text-foreground">K</span>. The 35B tier&rsquo;s floor is{" "}
          <span className="text-foreground">1.46 GiB</span> of weights that have to be resident
          for the whole forward pass before a single expert is read, and{" "}
          <span className="text-foreground">172 MiB</span> of that is the two adapter files the
          pipeline needs to work at all &mdash; the prerouter alone is{" "}
          <span className="text-foreground">132 MiB</span>, about 4.4% of the 2.9 GiB budget it
          is there to defend. Hold every layer&rsquo;s K=4 set simultaneously and you get 1.73
          GiB; hold only the four-layer staged window, 1.49. The iPhone demo&rsquo;s 1.7 GiB
          peak sits inside that window. The Mac mini&rsquo;s 2.9 GiB is the same floor plus about
          1.2 GiB of expert cache, KV and allocator slack. The 8B tier is the same shape one
          order down: a 0.61 GiB floor, 0.84 GiB with every layer&rsquo;s K=8 set held at once,
          against published peaks of 1.0, 1.37, 1.4 and 1.5 GiB.
        </p>
      </div>
    </figure>
  )
}
