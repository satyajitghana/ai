"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Mercury 3 against GPT-6 Luna and Claude Haiku 5.5, from published numbers
// only: Inception's launch table (its own figures, the comparators given as
// "~130" and "~240"), OpenRouter's three-day P50 throughput and weighted price
// paid (as posted by Deedy Das on 20 Oct 2026), and the list prices on
// OpenRouter's model API. Nothing here is a measurement of mine. The
// answer-length slider is the one thing the published numbers leave out:
// tokens/s counts reasoning tokens, so a model that thinks longer finishes
// later at the same rate.

type Model = {
  key: string
  name: string
  lab: number
  routed: number
  color: string
}

const MODELS: Model[] = [
  { key: "m", name: "Mercury 3", lab: 1068, routed: 302, color: "oklch(0.62 0.13 185)" },
  { key: "l", name: "GPT-6 Luna", lab: 130, routed: 79, color: "oklch(0.62 0.12 150)" },
  { key: "h", name: "Claude Haiku 5.5", lab: 240, routed: 187, color: "oklch(0.62 0.13 45)" },
]

type PriceView = "list" | "launch" | "paid"
const PRICES: Record<PriceView, { label: string; note: string; rows: Record<string, [number, number]> }> = {
  list: {
    label: "regular list",
    note: "Mercury 3's price once the launch discount ends; Luna and Haiku list prices under their long-context tiers.",
    rows: { m: [0.2, 0.7], l: [0.1, 0.5], h: [0.1, 0.5] },
  },
  launch: {
    label: "launch (50% off)",
    note: "The prices in Inception's table: Mercury 3 at half price, the others at list.",
    rows: { m: [0.1, 0.35], l: [0.1, 0.5], h: [0.1, 0.5] },
  },
  paid: {
    label: "OpenRouter, paid",
    note: "Weighted average price actually paid over three days: caching, cache writes, long-context tiers and the Flex tier all move it.",
    rows: { m: [0.022, 0.3594], l: [0.0434, 0.4534], h: [0.0856, 0.5698] },
  },
}

const SCALE = 1100

export function SpeedGap() {
  const [mult, setMult] = useState(10) // Mercury's tokens per answer, in tenths of the rival's
  const [view, setView] = useState<PriceView>("launch")
  const m = mult / 10
  const merc = MODELS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">launch chart vs routed traffic</span>
        <span className="font-mono text-[10px] text-muted-foreground">reported numbers · ratios are arithmetic on them</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="space-y-3">
          {MODELS.map((x) => (
            <div key={x.key}>
              <div className="mb-1 font-mono text-[11px] text-foreground">{x.name}</div>
              <Bar value={x.lab} color={x.color} label="Inception table" solid />
              <Bar value={x.routed} color={x.color} label="OpenRouter P50" />
            </div>
          ))}
          <div className="font-mono text-[10px] text-muted-foreground">
            output tokens per second · solid: Inception&apos;s launch table (comparators &quot;~&quot;) · hatched: OpenRouter, 3-day median
          </div>
        </div>

        <label className="block">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>Mercury 3 writes this many tokens per answer, relative to the rival</span>
            <span className="text-foreground">{m.toFixed(1)}x</span>
          </span>
          <Range
            min={5}
            max={30}
            step={1}
            value={mult}
            onChange={(e) => setMult(Number(e.target.value))}
            aria-label="Mercury 3 tokens per answer relative to the rival"
            className="mt-1.5 w-full"
          />
        </label>

        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">time-to-answer speed-up</th>
                <th className="py-1 text-right font-normal">launch table</th>
                <th className="py-1 text-right font-normal">OpenRouter</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.slice(1).map((x) => {
                const lab = merc.lab / x.lab / m
                const routed = merc.routed / x.routed / m
                return (
                  <tr key={x.key} className="border-t">
                    <td className="py-1.5 text-foreground">vs {x.name}</td>
                    <td className={cn("py-1.5 text-right", lab < 1 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      {lab.toFixed(2)}x
                    </td>
                    <td className={cn("py-1.5 text-right", routed < 1 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                      {routed.toFixed(2)}x
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(Object.keys(PRICES) as PriceView[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                aria-pressed={view === k}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  view === k
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {PRICES[k].label}
              </button>
            ))}
          </div>
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">$ per million tokens</th>
                <th className="py-1 text-right font-normal">input</th>
                <th className="py-1 text-right font-normal">output</th>
                <th className="py-1 text-right font-normal">output vs Mercury</th>
              </tr>
            </thead>
            <tbody>
              {MODELS.map((x) => {
                const [i, o] = PRICES[view].rows[x.key]
                const mo = PRICES[view].rows.m[1]
                return (
                  <tr key={x.key} className="border-t">
                    <td className="py-1.5 text-foreground">{x.name}</td>
                    <td className="py-1.5 text-right">{i < 0.1 ? i.toFixed(4) : i.toFixed(2)}</td>
                    <td className="py-1.5 text-right">{o.toFixed(o < 1 && view === "paid" ? 4 : 2)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{x.key === "m" ? "·" : `${(o / mo).toFixed(2)}x`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">{PRICES[view].note}</p>
        </div>
      </div>
    </figure>
  )
}

function Bar({ value, color, label, solid }: { value: number; color: string; label: string; solid?: boolean }) {
  const pct = (value / SCALE) * 100
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-4 flex-1 rounded-sm bg-muted/30">
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            width: `${pct.toFixed(2)}%`,
            background: solid
              ? color
              : `repeating-linear-gradient(135deg, ${color} 0 4px, transparent 4px 7px)`,
            border: solid ? undefined : `1px solid ${color}`,
          }}
        />
      </div>
      <span className="w-40 shrink-0 font-mono text-[10px] text-muted-foreground">
        <span className="text-foreground">{value.toLocaleString("en-US")}</span> {label}
      </span>
    </div>
  )
}
