"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// KV cache of one sequence in Kolibri-1, from config.json: 50 blocks, every
// fifth full attention (10), the rest sliding-window over 513 positions (512
// preceding + the current token), 4 KV heads of dim 128. A full block caches
// every token; a window block never holds more than 513. Compared against the
// same model with all 50 blocks full, which is Kolibri Origin's layout.
// Bytes are exact integers; GB is decimal (1e9).

const KV_PER_TOKEN_LAYER = 2 * 4 * 128 // K and V, 4 heads, dim 128 = 1,024 values
const FULL = 10
const SWA = 40
const WINDOW = 513
const WEIGHTS_GB = 78.827 // summed safetensors size of the FP8 checkpoint
const B200_GB = 192

const STOPS = [4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288, 1048576]
const label = (t: number) => (t >= 1048576 ? "1M" : `${t / 1024}k`)

function kv(tokens: number, bytes: number) {
  const full = FULL * KV_PER_TOKEN_LAYER * tokens * bytes
  const swa = SWA * KV_PER_TOKEN_LAYER * Math.min(tokens, WINDOW) * bytes
  const allFull = (FULL + SWA) * KV_PER_TOKEN_LAYER * tokens * bytes
  return { full, swa, hybrid: full + swa, allFull }
}

const gb = (b: number) => b / 1e9
const fmt = (b: number) =>
  gb(b) >= 0.1 ? `${gb(b) >= 10 ? gb(b).toFixed(1) : gb(b).toFixed(2)}\u00a0GB` : `${(b / 1e6).toFixed(1)}\u00a0MB`

export function KvCache() {
  const [i, setI] = useState(6) // 256k, the trained context
  const [fp8, setFp8] = useState(true)
  const tokens = STOPS[i]
  const bytes = fp8 ? 1 : 2
  const r = kv(tokens, bytes)
  const maxB = kv(1048576, bytes).allFull
  const fit = Math.floor((B200_GB - WEIGHTS_GB) / gb(r.hybrid))

  const rows = [
    { k: "Kolibri: 10 full + 40 window", v: r.hybrid, color: "#0f766e" },
    { k: "  of which the 40 window blocks", v: r.swa, color: "#5eead4" },
    { k: "All 50 blocks full (Origin's layout)", v: r.allFull, color: "#94a3b8" },
  ]

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">KV cache for one sequence</div>

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.k}>
            <div className="mb-0.5 flex items-baseline justify-between font-mono text-xs text-muted-foreground">
              <span className="whitespace-pre">{row.k}</span>
              <strong className="text-foreground">
                {fmt(row.v)}
              </strong>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted/40">
              <div className="h-full rounded" style={{ width: `${Math.max(0.4, (row.v / maxB) * 100).toFixed(2)}%`, background: row.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          Context: <strong className="font-mono text-foreground">{label(tokens)}</strong> tokens ({tokens.toLocaleString("en-US")})
          {tokens === 262144 ? " — trained length" : tokens === 1048576 ? " — validated by extrapolation" : ""}
          <Range min={0} max={STOPS.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="context length" className="mt-1 w-full" />
        </label>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">KV dtype:</span>
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setFp8(v)}
              aria-pressed={fp8 === v}
              className={`rounded-md border px-2 py-0.5 font-mono ${fp8 === v ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {v ? "FP8 (as evaluated)" : "BF16"}
            </button>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-2">
        <span>
          saving vs all-full: <strong className="text-foreground">{(r.allFull / r.hybrid).toFixed(2)}x</strong>
        </span>
        <span>
          such sequences beside the weights on one B200 (192 GB, no activations):{" "}
          <strong className="text-foreground">{fit}</strong>
        </span>
      </figcaption>
    </figure>
  )
}
