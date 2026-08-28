"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GPU-hours per 100 optimizer updates, measured on 8 GPUs, from the paper's
// Table 2 (App Sec. efficiency profile) and repo README. The abstract's
// "40% / 63% cheaper" figures are both stated *relative to DiffusionNFT* —
// this widget puts ReFL alongside both backbones to show that framing is
// exact but narrower than it first reads: on Z-Image-Turbo, ReFL is cheaper
// than DiffusionOPSD, not more expensive.

const OPSD = "oklch(0.60 0.15 255)"
const NFT = "oklch(0.58 0.19 27)"
const REFL = "oklch(0.68 0.13 85)"

type Backbone = "sd35" | "zimage"

const DATA: Record<Backbone, { method: string; gpuh: number; colour: string; note: string }[]> = {
  sd35: [
    { method: "DiffusionNFT", gpuh: 47.2, colour: NFT, note: "212.4 s/update · 47.8 GB peak" },
    { method: "ReFL", gpuh: 47.7, colour: REFL, note: "reported in-paper" },
    { method: "DiffusionOPSD", gpuh: 28.2, colour: OPSD, note: "126.9 s/update · 50.0 GB peak" },
  ],
  zimage: [
    { method: "DiffusionNFT", gpuh: 405.8, colour: NFT, note: "1826.2 s/update · 49.9 GB peak" },
    { method: "ReFL", gpuh: 102.1, colour: REFL, note: "reported in-paper — cheaper than OPSD here" },
    { method: "DiffusionOPSD", gpuh: 149.8, colour: OPSD, note: "674.0 s/update · 61.5 GB peak" },
  ],
}

const LABEL: Record<Backbone, string> = { sd35: "SD3.5-M", zimage: "Z-Image-Turbo" }

export function EfficiencyBars() {
  const [bb, setBb] = useState<Backbone>("sd35")
  const rows = DATA[bb]
  const max = Math.max(...rows.map((r) => r.gpuh)) * 1.08

  const W = 700
  const X0 = 128
  const BAR = W - X0 - 90
  const ROWH = 44

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          GPU-hours per 100 optimizer updates · 8×GPU, {LABEL[bb]}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">wall-clock, measured not estimated</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DATA) as Backbone[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setBb(k)}
              aria-pressed={bb === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                bb === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {LABEL[k]}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${rows.length * ROWH + 10}`}
            width={W}
            height={rows.length * ROWH + 10}
            role="img"
            className="min-w-[560px] max-w-full"
          >
            <title>
              {`GPU-hours per 100 optimizer updates on ${LABEL[bb]}: ${rows.map((r) => `${r.method} ${r.gpuh}`).join(", ")}.`}
            </title>
            {rows.map((r, i) => {
              const y = 8 + i * ROWH
              const w = (r.gpuh / max) * BAR
              return (
                <g key={r.method}>
                  <text x={X0 - 10} y={y + 15} fontSize={10} textAnchor="end" fill={r.colour} fontFamily="ui-monospace, monospace">
                    {r.method}
                  </text>
                  <rect x={X0} y={y} width={BAR} height={26} rx={3} fill="currentColor" fillOpacity={0.06} />
                  <rect x={X0} y={y} width={Math.max(2, w)} height={26} rx={3} fill={r.colour} fillOpacity={0.82} />
                  <text x={X0 + w + 8} y={y + 17} fontSize={10} fill={r.colour} fontFamily="ui-monospace, monospace">
                    {r.gpuh.toFixed(1)}
                  </text>
                  <text x={X0} y={y + 38} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                    {r.note}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The abstract&rsquo;s efficiency claim is precise about its baseline: &ldquo;reduces training
          GPU-hours <em>relative to DiffusionNFT</em> by 40% on SD3.5-M and 63% on Z-Image-Turbo.&rdquo;
          Both numbers check out exactly — 28.2 against NFT&rsquo;s 47.2 is a 40.3% cut,
          149.8 against 405.8 is a 63.1% cut.
          <br />
          <br />
          Switch to Z-Image-Turbo and add ReFL to the comparison, though, and{" "}
          <span className="text-foreground">DiffusionOPSD is not the cheapest method shown</span> —{" "}
          <span style={{ color: REFL }}>ReFL</span> runs at 102.1 GPU-hours per 100 updates, a third
          less than OPSD&rsquo;s 149.8. OPSD still wins on final held-out quality across all ten
          reward-matched Z-Image-Turbo evaluators, ReFL included — the paper is explicit that this is a
          <em> quality</em> win at that cost, not a claim to be the cheapest option on the table. The
          scope was always DiffusionNFT; reading it as &ldquo;cheaper than everything&rdquo; would be
          the reader&rsquo;s error, not the abstract&rsquo;s.
        </p>
      </div>
    </figure>
  )
}
