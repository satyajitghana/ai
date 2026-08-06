"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Gated MLA's whole move: a per-channel gate, derived from the token itself,
// multiplied into the MLA output before the output projection. Four preset
// tokens, twelve attention-output channels each. Bars show the raw MLA output
// magnitude (muted) and what survives the gate (accent) — the gap between
// them is what the gate throws away. Values are illustrative (the trained
// gate pattern is not published); the mechanism — token in, per-channel
// attenuation out — is real.

const ACCENT = "oklch(0.62 0.16 200)"
const N_CHANNELS = 12
const TOKENS = ["token 1", "token 2", "token 3", "token 4"]

function rawMag(c: number): number {
  return 0.42 + 0.5 * Math.abs(Math.sin((c + 1) * 0.74))
}
function gateValue(tok: number, c: number): number {
  const s = Math.sin((c + 1) * (tok * 1.3 + 0.9) + tok * 2.1)
  const t = Math.cos((c + 1) * (0.42 + tok * 0.21))
  return Math.min(1, Math.max(0.05, (s * 0.5 + t * 0.5 + 1) / 2))
}

export function GatedMLA() {
  const [tok, setTok] = useState(0)

  const rows = Array.from({ length: N_CHANNELS }, (_, c) => {
    const raw = rawMag(c)
    const gate = gateValue(tok, c)
    return { c, raw, gate, out: raw * gate }
  })
  const avgGate = rows.reduce((s, r) => s + r.gate, 0) / rows.length
  const suppressed = rows.filter((r) => r.gate < 0.5).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        gated mla · per-channel output gate
      </div>
      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {rows.map(({ c, raw, gate, out }) => (
            <div key={c} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                ch {c}
              </span>
              <div className="relative h-4 flex-1">
                {/* track */}
                <div className="absolute inset-0 rounded-sm bg-muted/40" />
                {/* raw MLA output magnitude */}
                <div
                  className="absolute top-0 h-full rounded-sm bg-muted-foreground/25"
                  style={{ width: `${raw * 100}%` }}
                />
                {/* gated (surviving) output */}
                <div
                  className="absolute top-0 h-full rounded-sm transition-all duration-300"
                  style={{ width: `${out * 100}%`, background: ACCENT, opacity: 0.9 }}
                />
              </div>
              <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {Math.round(gate * 100)}%
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-3 pl-14 font-mono text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-muted-foreground/25" /> raw MLA output
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: ACCENT }} /> after gate
          </span>
          <span className="ml-auto">gate value →</span>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap rounded-lg border p-0.5">
            {TOKENS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setTok(i)}
                aria-pressed={tok === i}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  tok === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            avg gate <span className="text-foreground">{Math.round(avgGate * 100)}%</span> · attenuated{" "}
            <span className="text-foreground">{suppressed}/{N_CHANNELS}</span>{" "}channels &lt;50%
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every channel starts at its raw MLA magnitude (muted bar). The gate is a linear
          projection of the token itself, one value per channel, applied by multiplication before
          the output projection — the accent bar is what actually reaches the rest of the model.
          Switch tokens and the pattern of what gets kept changes, because the gate is
          input-conditioned: it decides per token which attention channels were worth attending to
          and turns the rest down. Instella-MoE&rsquo;s gate is a single linear layer; the same idea
          shows up as a heavier, full-rank version in{" "}
          <a href="/articles/kimi-k3" className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">Kimi K3&rsquo;s Gated MLA</a>{" "}
          — two labs landing on the same attention-output gate independently.
        </p>
      </div>
    </figure>
  )
}
