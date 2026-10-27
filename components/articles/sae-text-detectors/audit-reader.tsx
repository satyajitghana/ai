"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"

import { AUDIT, EXAMPLES, type Ex } from "./data"

// One verdict, read as a sum. The head is linear, so each bar is w_i * x_i, the same
// number the detectorscope LogRegHead returns as a feature's importance. The six
// largest terms are drawn; "other features" is whatever is left of the logit.
// Descriptions are the three tokens a feature fires on most (my stand-in for an
// auto-interp label), not model-written prose.

const KIND: Record<Ex["kind"], string> = {
  tp: "AI text, flagged",
  fn: "AI text, missed",
  tn: "human text, passed",
  fp: "human text, flagged",
}
const POS = "oklch(0.62 0.16 35)"
const NEG = "oklch(0.60 0.15 255)"

const sigmoid = (z: number) => 1 / (1 + mexp(-z))
const vis = (s: string) => s.replace(/ /g, "·")

export function AuditReader() {
  const [i, setI] = useState(0)
  const ex = EXAMPLES[i]
  const shown = ex.feats.reduce((a, f) => a + f.c, 0)
  const rest = ex.logit - AUDIT.bias - shown
  const rows = [...ex.feats.map((f) => ({ label: `f${f.id}`, sub: f.top.map(vis).join(" "), ctx: f.ctx, c: f.c })), { label: "others", sub: "all remaining features", ctx: "", c: rest }]
  const max = Math.max(...rows.map((r) => Math.abs(r.c)), 1)
  const flagged = ex.logit > AUDIT.threshold

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">read one verdict · toy detector · measured</span>
        <span className="font-mono text-xs">{KIND[ex.kind]}</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Pick a document">
          {EXAMPLES.map((e, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              className={`rounded-md border px-2 py-1 font-mono text-[11px] ${k === i ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/40"}`}
            >
              {e.domain.replace("_", " ")} · {e.kind}
            </button>
          ))}
        </div>
        <p className="rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-relaxed break-words">
          {ex.text}
          <span className="text-muted-foreground"> … ({ex.nTok} tokens read)</span>
        </p>
        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">logit</dt>
            <dd className="mt-0.5 text-sm">{ex.logit.toFixed(2)}</dd>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">P(AI)</dt>
            <dd className="mt-0.5 text-sm">{(sigmoid(ex.logit) * 100).toFixed(1)}%</dd>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">verdict at {AUDIT.threshold.toFixed(2)}</dt>
            <dd className="mt-0.5 text-sm">{flagged ? "AI" : "human"}</dd>
          </div>
        </dl>
        <ul className="mt-3 space-y-1.5">
          {rows.map((r) => {
            const w = (Math.abs(r.c) / max) * 50
            return (
              <li key={r.label} className="grid grid-cols-[3.4rem_1fr] items-center gap-2 font-mono text-[11px] sm:grid-cols-[3.4rem_1fr_9rem]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="relative h-5 rounded bg-muted/25">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/30" />
                  <span
                    className="absolute inset-y-0.5 rounded-sm"
                    style={{ background: r.c >= 0 ? POS : NEG, width: `${w}%`, left: r.c >= 0 ? "50%" : `${50 - w}%` }}
                  />
                  <span className="absolute inset-y-0 flex items-center px-1.5 text-[10px]" style={{ [r.c >= 0 ? "right" : "left"]: 2 }}>
                    {r.c >= 0 ? "+" : ""}
                    {r.c.toFixed(2)}
                  </span>
                </span>
                <span className="col-span-2 truncate text-muted-foreground sm:col-span-1" title={r.ctx}>
                  {r.ctx ? `…${r.ctx.replace(/ /g, "·")}…` : r.sub}
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Orange pushes toward AI, blue toward human. Bars are w x activation, so they add to the logit exactly (bias {AUDIT.bias.toFixed(1)}). The
          right column is the token the feature peaked on, with its neighbours; a middle dot is a space.
        </p>
      </div>
    </figure>
  )
}
