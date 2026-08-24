"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where every byte lives on an ESP32-S3, and why the KV cache is the only thing
// that grows.
//
// Three tiers, each roughly an order of magnitude apart in size and a factor of
// three apart in bandwidth. The weights sit in the slowest tier and are read in
// place; the fastest tier holds 42 KB of scratch. Everything about the design
// follows from that inversion of the usual arrangement.
//
// Figures from the README's memory diagram and the device audit.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const TIERS = [
  {
    name: "FLASH",
    total: 16 * 1024 * 1024,
    bandwidth: "29.9 MB/s",
    color: WARM,
    parts: [
      { l: "needle partition — 13.7 MB of weights", v: 13_737_807, note: "memory-mapped, read in place, never copied into RAM" },
      { l: "firmware", v: 256 * 1024, note: "the entire engine: parser, kernels, tokenizer, constrained decoder" },
    ],
  },
  {
    name: "PSRAM",
    total: 8 * 1024 * 1024,
    bandwidth: "85.5 MB/s",
    color: ACCENT,
    parts: [
      { l: "int8 KV ring", v: 4_500_000, note: "3.3–5.8 MB depending on the schema — the only allocation that scales with context" },
      { l: "model state", v: 484 * 1024, note: "activations and per-layer buffers" },
      { l: "weight cache", v: 3_000_000, note: "opportunistic: at boot, copy the hottest matrices here if there is room" },
    ],
  },
  {
    name: "INTERNAL SRAM",
    total: 512 * 1024,
    bandwidth: "on-die",
    color: GOOD,
    parts: [{ l: "hot scratch", v: 42 * 1024, note: "x · xh · q/k/v · attention — moving this here was worth +5%" }],
  },
] as const

const fmt = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${Math.round(b / 1024)} KB`)

export function MemoryBudget() {
  const [sink, setSink] = useState(160)
  const [recent, setRecent] = useState(256)
  const rows = sink + recent

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">ESP32-S3 · 240 MHz Xtensa LX7 · ~$5</span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          weights live in the slowest tier
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {TIERS.map((t) => {
            const used = t.parts.reduce((a, p) => a + p.v, 0)
            return (
              <div key={t.name}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground">
                    {t.name} · {fmt(t.total)}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {t.bandwidth} · {((100 * used) / t.total).toFixed(0)}% committed
                  </span>
                </div>
                <div className="mt-1 flex h-5 gap-[2px] overflow-hidden rounded-sm bg-muted/40">
                  {t.parts.map((p, i) => (
                    <div
                      key={p.l}
                      title={`${p.l} — ${fmt(p.v)}`}
                      className="h-5"
                      style={{ width: `${(p.v / t.total) * 100}%`, background: t.color, opacity: 1 - i * 0.25 }}
                    />
                  ))}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {t.parts.map((p) => (
                    <li key={p.l} className="font-mono text-[9px] leading-4 text-muted-foreground">
                      <span className="text-foreground">{fmt(p.v).padStart(8)}</span> · {p.l} — {p.note}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="mt-4 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the KV allocation, which is fixed by construction
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">prefix sink</span>
              <Range min={0} max={512} step={16} value={sink} onChange={(e) => setSink(Number(e.target.value))} className="flex-1" aria-label="protected prefix tokens" accent={GOOD} />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{sink}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">recent window</span>
              <Range min={64} max={512} step={16} value={recent} onChange={(e) => setRecent(Number(e.target.value))} className="flex-1" aria-label="recent attention window" accent={ACCENT} />
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{recent}</span>
            </div>
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
            {sink} protected + {recent} recent ={" "}
            <span style={{ color: rows === 416 ? GOOD : WARM }}>{rows} physical rows</span>
            {rows === 416 ? " — exactly the allocation the old pure-ring design used" : rows > 416 ? " — over the shipped budget" : " — under the shipped budget"}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The constraint that shaped the design is the one in the middle row: 160 and 256 are not tuned numbers,
          they are the two halves of a budget that had to stay at{" "}
          <span className="text-foreground">416 rows</span>. Needle attends over a 256-token recent window; the
          engine protects the first 160 prompt tokens as an attention sink alongside it, so the system
          instructions and the head of the tool block survive decode. That costs three rows of accuracy against an
          unbounded prefix and zero bytes against the ring it replaced.
        </p>
      </div>
    </figure>
  )
}
