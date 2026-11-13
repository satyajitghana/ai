"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CDP_DOMAINS, CDP_MISSING, CDP_STUBBED } from "./data"

// Kitesurf's Chrome DevTools Protocol surface, counted from packages/engine/src/cdp/*.ts at 4a29038
// against the command list of devtools-protocol 0.0.1669207 (the version the repo pins). A method is
// "handled" when its case label has a body that does more than return an empty object; that says the
// engine does something for it, not that it does all of it. "Accepted" methods are case labels that
// return {} on purpose. Any other method of these domains also falls through to `return {}`.

const TONE = {
  real: "oklch(0.68 0.15 150)",
  noop: "oklch(0.8 0.1 85)",
  rest: "oklch(0.9 0.01 260)",
}

export function CdpMatrix() {
  const [open, setOpen] = useState<string>("Page")
  const sel = CDP_DOMAINS.find((d) => d[0] === open) ?? CDP_DOMAINS[0]
  const totalReal = CDP_DOMAINS.reduce((s, d) => s + d[2].length, 0)
  const totalNoop = CDP_DOMAINS.reduce((s, d) => s + d[3].length, 0)
  const totalCmds =
    CDP_DOMAINS.reduce((s, d) => s + d[1], 0) + CDP_STUBBED.reduce((s, d) => s + d[1], 0) + CDP_MISSING.reduce((s, d) => s + d[1], 0)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the CDP Kitesurf speaks: {totalReal} handled, {totalNoop} accepted as no-ops, of {totalCmds} commands in the protocol
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE.real }} /> handled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE.noop }} /> accepted, does nothing
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TONE.rest }} /> rest of the domain: also returns {"{}"}
        </span>
      </div>
      <ul className="space-y-0.5 px-4 py-3 text-xs">
        {CDP_DOMAINS.map(([d, n, real, noop]) => (
          <li key={d}>
            <button
              type="button"
              aria-pressed={open === d}
              onClick={() => setOpen(d)}
              className={cn("flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-muted/60", open === d && "bg-muted/60")}
            >
              <span className="w-24 shrink-0 font-mono text-[11px]">{d}</span>
              <span className="flex h-3 min-w-0 flex-1 overflow-hidden rounded-[2px]" aria-hidden>
                <span style={{ width: `${((real.length / n) * 100).toFixed(2)}%`, background: TONE.real }} />
                <span style={{ width: `${((noop.length / n) * 100).toFixed(2)}%`, background: TONE.noop }} />
                <span className="flex-1" style={{ background: TONE.rest }} />
              </span>
              <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {real.length}+{noop.length} / {n}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t px-4 py-3 text-xs" aria-live="polite">
        <div className="mb-1 font-mono text-[11px] text-muted-foreground">{sel[0]}: handled</div>
        <div className="flex flex-wrap gap-1">
          {sel[2].map((m) => (
            <code key={m} className="rounded px-1 py-0.5 text-[10px]" style={{ background: TONE.real, color: "black" }}>
              {m}
            </code>
          ))}
        </div>
        {sel[3].length ? (
          <>
            <div className="mt-2 mb-1 font-mono text-[11px] text-muted-foreground">{sel[0]}: accepted, does nothing</div>
            <div className="flex flex-wrap gap-1">
              {sel[3].map((m) => (
                <code key={m} className="rounded px-1 py-0.5 text-[10px]" style={{ background: TONE.noop, color: "black" }}>
                  {m}
                </code>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="border-t px-4 py-3 text-[11px] text-muted-foreground">
        <p>
          <span className="text-foreground">{CDP_STUBBED.length} more domains</span> answer every method with {"{}"}:{" "}
          {CDP_STUBBED.map((d) => d[0]).join(", ")}.
        </p>
        <p className="mt-1">
          <span className="text-foreground">{CDP_MISSING.length} domains</span> are not routed at all and return a
          &quot;wasn&apos;t found&quot; error: {CDP_MISSING.map((d) => d[0]).join(", ")}.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Counted from <code>packages/engine/src/cdp/</code> at commit 4a29038 against devtools-protocol 0.0.1669207. The
        29 vendor methods in the <code>Kitesurf.*</code> domain are left out.
      </figcaption>
    </figure>
  )
}
