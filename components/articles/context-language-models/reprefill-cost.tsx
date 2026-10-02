"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The paper's own prefix-reuse FLOPs formula (Appendix C), evaluated for the
// Qwen3.6-27B example it works out (Appendix C, "Example: Qwen3.6-27B"). A turn
// has a prompt of P tokens and generates G; the server reuses the longest
// matching prefix of R tokens and re-prefills the rest. Drag R — the position
// where the edit lands — and watch the cost. These are the paper's constants
// and the formula reproduces its three reported points exactly (see the prose).
//
//   F_t = C_token*(U_t + G_t) + C_attn*[ 0.5*(P^2 - R^2) + G_t*P_t + 0.5*G_t^2 ]
//   with U_t = P_t - R_t.
//
// Only +, -, *, / are used; P*P is exact, so no lib/dmath wrappers are needed.

const C_TOKEN = 48.7e9 // FLOPs per processed token (Qwen3.6-27B, paper)
const C_ATTN = 3.93e5 // FLOPs per query-key pair (paper)
const P = 20000 // prompt tokens (paper's illustrative turn)
const G = 500 // generated tokens (paper's illustrative turn)

function flops(R: number): number {
  const U = P - R
  const attn = 0.5 * (P * P - R * R) + G * P + 0.5 * G * G
  return C_TOKEN * (U + G) + C_ATTN * attn
}

const APPEND_R = 18000 // the paper's append-only point
const BASE = flops(APPEND_R) // ~1.41e14

const MARKS = [
  { r: 18000, label: "append-only" },
  { r: 10000, label: "mid-context edit" },
  { r: 0, label: "edit at the start" },
]

function e14(n: number): string {
  return (n / 1e14).toFixed(2)
}

// Deterministic thousands separator (no Intl, so server and client agree).
function withCommas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

export function ReprefillCost() {
  const [r, setR] = useState(10000)

  const f = flops(r)
  const ratio = f / BASE
  const reusedPct = (r / P) * 100
  const reprefillPct = ((P - r) / P) * 100
  const costPct = (f / flops(0)) * 100 // bar scaled to the worst case

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one Qwen3.6-27B turn · P = 20,000, G = 500 · prefix-reuse FLOPs</span>
        <span className="text-muted-foreground/50">paper formula</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* context strip: reused prefix | re-prefilled suffix */}
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>reused prefix: {Math.round(reusedPct)}%</span>
          <span>re-prefilled: {Math.round(reprefillPct)}%</span>
        </div>
        <div className="flex h-6 w-full overflow-hidden rounded-md border font-mono text-[10px]">
          <div
            className="flex items-center justify-center bg-[oklch(0.60_0.15_255_/_0.25)] text-foreground"
            style={{ width: `${reusedPct}%` }}
          >
            {reusedPct > 18 ? "cache reused" : ""}
          </div>
          <div
            className="flex items-center justify-center bg-[oklch(0.63_0.19_25_/_0.3)] text-foreground"
            style={{ width: `${reprefillPct}%` }}
          >
            {reprefillPct > 22 ? "re-prefill" : ""}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-4">
          <div>
            <div className="font-mono text-3xl font-semibold text-foreground">
              {e14(f)}
              <span className="ml-1 text-base text-muted-foreground">x10^14</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">FLOPs this turn</div>
          </div>
          <div className="pb-1">
            <div className="font-mono text-xl font-semibold" style={{ color: "oklch(0.63 0.19 25)" }}>
              {ratio.toFixed(1)}x
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">of an append-only turn</div>
          </div>
        </div>

        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${costPct}%`, backgroundColor: "oklch(0.63 0.19 25)" }}
          />
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>reusable prefix R (drag the edit point)</span>
            <span className="text-foreground">R = {withCommas(r)} tok</span>
          </div>
          <Range
            min={0}
            max={P}
            step={500}
            value={r}
            onChange={(e) => setR(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent="oklch(0.63 0.19 25)"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            {MARKS.map((m) => (
              <button
                key={m.r}
                type="button"
                onClick={() => setR(m.r)}
                className="underline-offset-2 hover:text-foreground hover:underline"
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Appending to the context reuses 18,000 of the 20,000 prompt tokens and
          costs <span className="text-foreground">1.41</span> x10^14 FLOPs — prefix
          caching avoids 87% of what the turn would need cold. An edit in the
          middle leaves 10,000 reusable tokens and the cost climbs to{" "}
          <span className="text-foreground">5.74</span> x10^14. An edit at the
          start reuses nothing and costs <span className="text-foreground">10.81</span>{" "}
          x10^14 — <span className="text-foreground">7.7x</span> the append-only
          turn. That re-prefill tax is the price of arbitrary edits, and it is
          exactly what prefix-reuse FLOPs measure and Suffix Cache Reuse attacks.
        </p>
      </div>
    </figure>
  )
}
