"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CASES, type Case } from "./data"

// One row of the run per depth: the + pole of the sampled neuron whose input-side reads found the most of its firing
// tokens (a fixed rule, not a hand pick). Every token list is read off this run's own files: the lens reads are computed
// on Qwen3-0.6B with true gradients (J- and K-style), the steering list is the tokens whose log-probability rose most when
// the pole's write was added at a typical top activation to held-out documents, the firing list is the tokens at the
// pole's top firings over the activation corpus (this site's articles).

function Chips({ tokens, tone }: { tokens: string[]; tone?: "fire" | "write" | "read" }) {
  if (!tokens.length) return <span className="text-muted-foreground">none</span>
  const cls =
    tone === "fire"
      ? "border-amber-500/40 bg-amber-500/10"
      : tone === "write"
        ? "border-blue-500/40 bg-blue-500/10"
        : "border-emerald-500/40 bg-emerald-500/10"
  return (
    <span className="flex flex-wrap gap-1">
      {tokens.map((t, i) => (
        <code key={i} className={cn("rounded border px-1.5 py-0.5 text-[11px] leading-none", cls)}>
          {t.replace(/ /g, "␣") || "·"}
        </code>
      ))}
    </span>
  )
}

export function CaseReadings() {
  const [i, setI] = useState(Math.min(2, Math.max(0, CASES.length - 1)))
  const c: Case | undefined = CASES[i]
  if (!c) return null
  const rows: { label: string; hint: string; tokens: string[]; tone: "fire" | "write" | "read" }[] = [
    { label: "fires on", hint: "tokens at its top firings in the activation corpus", tokens: c.fires, tone: "fire" },
    { label: "write, logit lens", hint: "W_U · norm(write), no layers above", tokens: c.writeLogit, tone: "write" },
    { label: "write, J-style", hint: "first-order response of the final residual to the write", tokens: c.writeJ, tone: "write" },
    { label: "steering raises", hint: "measured: tokens whose log-probability rose most", tokens: c.steered, tone: "write" },
    { label: "input, K-style", hint: "input tokens that push the residual along the read direction", tokens: c.readK, tone: "read" },
    { label: "input, embedding", hint: "read direction · token embedding, no layers below", tokens: c.readEmbed, tone: "read" },
    { label: "input, J-style", hint: "what the read direction makes the model say", tokens: c.readJ, tone: "read" },
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the best + pole at each sampled depth, by input-side hits (not a typical one) · Qwen3-0.6B · measured</span>
        <div className="flex flex-wrap gap-1">
          {CASES.map((k, j) => (
            <button
              key={k.layer}
              type="button"
              onClick={() => setI(j)}
              aria-pressed={i === j}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === j ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              L{k.layer}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-mono text-sm">
          L{c.layer} n{c.neuron} +
          <span className="ml-3 text-xs text-muted-foreground">
            r(logit lens, steering) {c.rLogit?.toFixed(2) ?? "n/a"} · r(J-style, steering) {c.rJ?.toFixed(2) ?? "n/a"} · push {c.rel?.toFixed(2) ?? "n/a"}× the residual
          </span>
        </p>
        <dl className="mt-3 grid gap-x-4 gap-y-2.5 sm:grid-cols-[9.5rem_1fr]">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="pt-0.5 font-mono text-[11px] text-muted-foreground" title={r.hint}>
                {r.label}
              </dt>
              <dd>
                <Chips tokens={r.tokens} tone={r.tone} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">␣ marks a leading space. Hover a row label for what that read computes.</p>
      </div>
    </figure>
  )
}
