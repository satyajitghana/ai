"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Inkling 2 Mini unrolled. Layout from the released config.json and the GGUF
// header: 24 stored layers, loop core = layers 6..17 (loop.start 6, loop.end 18),
// global attention on layers 5, 11, 17, 23 (sliding_window_pattern), window 1024,
// 8 KV heads x 128 dims.
//
// Readouts (my arithmetic, labelled as such in the article):
//   layer applications per token  = 12 + 12 P
//   effective active parameters   = 3.4 + 1.0 (P - 1) B   (the model card's rule, stated for 1..5)
//   bytes read per token, batch 1 = 1.347 + 0.905 P GB    (UD-Q4_K_M tensor sizes from the GGUF header:
//       once-run dense 0.361 + 8/128 of 7.899 GB of experts + output head 0.492;
//       per pass: core dense 0.475 + 8/128 of 6.880 GB of experts)
//   KV per token (F16, global layers) = (2 + 2P) x 4 KiB, if every pass keeps its own cache
//       (llama.cpp's inkling2_loop does; the lab does not say how its own stack does it)
//   sliding-window KV (fixed)          = (10 + 10P) x 4 KiB x 1024

const CORE = "oklch(0.62 0.15 255)"
const ONCE = "oklch(0.62 0.03 260)"
const GLOBAL = "oklch(0.72 0.16 60)"
const GLOBALS = new Set([5, 11, 17, 23])

function cell(layer: number, pass: number | null, key: string) {
  const core = layer >= 6 && layer < 18
  const g = GLOBALS.has(layer)
  return (
    <div
      key={key}
      title={`layer ${layer}${pass ? `, pass ${pass}` : ""}${g ? ", global attention" : ", 1,024-token window"}`}
      className="h-6 min-w-0 flex-1 rounded-[3px] border"
      style={{
        background: core ? CORE : ONCE,
        opacity: pass && pass > 1 ? 0.78 : 1,
        borderColor: g ? GLOBAL : "transparent",
        borderWidth: g ? 2 : 1,
      }}
    />
  )
}

export function LoopUnroll() {
  const [p, setP] = useState(3)

  const apps = 12 + 12 * p
  const effB = 3.4 + 1.0 * (p - 1)
  const readGB = 1.347 + 0.905 * p
  const kvKiB = (2 + 2 * p) * 4
  const kv128kGiB = (kvKiB * 131072) / (1024 * 1024)
  const swaMiB = (10 + 10 * p) * 4
  const stated = p <= 5

  const row: { layer: number; pass: number | null }[] = []
  for (let l = 0; l < 6; l++) row.push({ layer: l, pass: null })
  for (let q = 1; q <= p; q++) for (let l = 6; l < 18; l++) row.push({ layer: l, pass: q })
  for (let l = 18; l < 24; l++) row.push({ layer: l, pass: null })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Inkling 2 Mini, unrolled: 24 stored layers, P passes through 6..17</span>
        <span className="text-muted-foreground/60">layout from config.json; costs are my arithmetic</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="mb-1.5 font-mono text-[11px] text-muted-foreground">stored once on disk (24 layers)</div>
          <div className="flex gap-[3px]">{Array.from({ length: 24 }, (_, l) => cell(l, null, `s${l}`))}</div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>what one token runs through ({apps} layer applications)</span>
            <span>
              {p} {p === 1 ? "pass" : "passes"}
            </span>
          </div>
          <div className="flex flex-wrap gap-[2px]">
            {row.map((r, i) => (
              <div key={i} className="w-[calc((100%-46px)/24)] min-w-[6px]">
                {cell(r.layer, r.pass, `r${i}`)}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ONCE }} /> runs once (prelude, final block)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CORE }} /> loop core, shared weights
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ borderColor: GLOBAL }} /> global attention layer
            </span>
          </div>
        </div>

        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>passes through the core</span>
            <span className="tabular-nums">{p}</span>
          </div>
          <Range min={1} max={6} step={1} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="passes through the loop core" />
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            Mini is fixed at 3. The research variant was trained on 1 to 5; llama.cpp accepts 1 to 6.
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "effective active", v: stated ? `${effB.toFixed(1)}B` : "not stated", s: "card: +1.0B per extra pass" },
            { k: "read per token, batch 1", v: `${readGB.toFixed(2)} GB`, s: "UD-Q4_K_M, from tensor sizes" },
            { k: "global KV per token", v: `${kvKiB} KiB`, s: `${kv128kGiB.toFixed(1)} GiB at 131,072 tokens` },
            { k: "window KV, fixed", v: `${swaMiB} MiB`, s: "1,024 tokens per local layer" },
          ].map((c) => (
            <div key={c.k} className="rounded-lg border bg-background/60 p-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{c.k}</div>
              <div className="mt-0.5 font-mono text-lg tabular-nums">{c.v}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{c.s}</div>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The file holds 24 layers whatever P is. Each pass re-reads the core&apos;s attention weights and the 8 experts it routes to, and,
        in llama.cpp, writes its own keys and values. The KV figures assume an F16 cache and that per-pass layout.
      </figcaption>
    </figure>
  )
}
