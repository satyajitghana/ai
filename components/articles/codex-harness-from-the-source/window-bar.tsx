"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CATALOG } from "./data"
import { Chip, Panel, Src, fmt } from "./ui"

// Thresholds computed by toy 3 from the repo's own catalog (models-manager/models.json) with the formulas at
// protocol/src/openai_models.rs:552-575 and core/src/session/context_window.rs:35-110.
const BUFFER = 16384
const ASYNC_PCT = 65

export function WindowBar() {
  const [slug, setSlug] = useState("gpt-6-astra")
  const [buffer, setBuffer] = useState(false)
  const m = CATALOG.find((c) => c.slug === slug) ?? CATALOG[0]
  const pct = (n: number) => `${(n / m.window) * 100}%`
  const marks = [
    { n: Math.round((m.window * ASYNC_PCT) / 100), label: `async compaction ${ASYNC_PCT}% (feature off by default; base inferred)`, cls: "bg-violet-500" },
    { n: m.auto, label: "auto-compact limit (90%)", cls: "bg-amber-500" },
    ...(buffer ? [{ n: m.auto + BUFFER, label: "+ fallback buffer (only with a token-budget fallback prompt)", cls: "bg-amber-500/50" }] : []),
    { n: m.full, label: "hard limit (95%)", cls: "bg-rose-500" },
  ]
  return (
    <Panel title="Where compaction fires for each model in the shipped catalog" sub="from models.json: 12 models; the arithmetic is the code's">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATALOG.map((c) => (
          <Chip key={c.slug} active={slug === c.slug} onClick={() => setSlug(c.slug)}>{c.slug}</Chip>
        ))}
      </div>
      <div className="relative mt-8 h-6 rounded bg-muted">
        <div className="absolute inset-y-0 left-0 rounded-l bg-emerald-500/30" style={{ width: pct(m.auto) }} />
        <div className="absolute inset-y-0 rounded-sm bg-amber-500/25" style={{ left: pct(m.auto), width: `${((m.full - m.auto) / m.window) * 100}%` }} />
        <div className="absolute inset-y-0 rounded-r bg-rose-500/20" style={{ left: pct(m.full), right: 0 }} />
        {marks.map((k, i) => (
          <div key={k.label} className="absolute inset-y-0" style={{ left: pct(k.n) }}>
            <div className={cn("h-6 w-0.5", k.cls)} />
            <div className={cn("absolute -top-6 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground", i % 2 ? "-translate-x-full pr-1" : "pl-1")}>{fmt(k.n)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-muted-foreground"><span>0</span><span>{fmt(m.window)} tokens</span></div>
      <ul className="mt-3 grid gap-1 text-[12.5px] sm:grid-cols-2">
        {marks.map((k) => (
          <li key={k.label} className="flex items-center gap-2"><span className={cn("inline-block h-2.5 w-2.5 rounded-sm", k.cls)} /> <span className="text-muted-foreground">{k.label}:</span> <span className="tabular-nums">{fmt(k.n)}</span></li>
        ))}
      </ul>
      <label className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
        <input type="checkbox" checked={buffer} onChange={(e) => setBuffer(e.target.checked)} /> show the {fmt(BUFFER)}-token fallback buffer
      </label>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">model</th><th className="pr-3 font-medium">window</th><th className="pr-3 font-medium">auto 90%</th><th className="pr-3 font-medium">hard 95%</th><th className="pr-3 font-medium">incremental tools</th><th className="pr-3 font-medium">tool mode</th><th className="font-medium">prompt words</th>
            </tr>
          </thead>
          <tbody>
            {CATALOG.map((c) => (
              <tr key={c.slug} className={cn("border-b border-border/60", c.slug === slug && "bg-muted/50")}>
                <td className="py-1 pr-3 font-mono">{c.slug}</td><td className="pr-3 tabular-nums">{fmt(c.window)}</td><td className="pr-3 tabular-nums">{fmt(c.auto)}</td><td className="pr-3 tabular-nums">{fmt(c.full)}</td><td className="pr-3">{c.lite ? "yes" : "no"}</td><td className="pr-3">{c.toolMode ?? "none"}</td><td className="tabular-nums">{fmt(c.words)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">The catalog&apos;s own <code>auto_compact_token_limit</code> is null for all twelve, so the default 90% applies. <Src>protocol/src/openai_models.rs:552-575</Src></p>
    </Panel>
  )
}
