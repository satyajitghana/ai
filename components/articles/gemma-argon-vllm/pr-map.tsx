"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { CATS, type Cat, PRS } from "./data"

// The eight [Perf] pull requests lucianommartins opened against vllm-project/vllm in the window
// the goo.gle link searches, classified by what they change. Classification: my reading of the diffs.
// "reported" is the PR author's own text.

export function PrMap() {
  const [cat, setCat] = useState<Cat | "all">("all")
  const [e2bOnly, setE2bOnly] = useState(false)
  const rows = PRS.filter((p) => (cat === "all" || p.cats.includes(cat)) && (!e2bOnly || p.e2b !== "no"))
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        {(["all", ...CATS.map((c) => c.id)] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setCat(k)}
            aria-pressed={cat === k}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              cat === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {k === "all" ? "all" : CATS.find((c) => c.id === k)?.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <input type="checkbox" checked={e2bOnly} onChange={(e) => setE2bOnly(e.target.checked)} />
          touches E2B text serving
        </label>
      </div>
      <ul className="divide-y">
        {rows.map((p) => (
          <li key={p.n} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <a href={`https://github.com/vllm-project/vllm/pull/${p.n}`} className="font-mono text-xs underline underline-offset-2">
                #{p.n}
              </a>
              <span className="text-sm font-medium">{p.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {p.state} · E2B: {p.e2b}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.cats.map((c) => (
                <span key={c} className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {CATS.find((x) => x.id === c)?.label}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed">{p.what}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">reported: {p.reported}</p>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">No pull request matches.</li>}
      </ul>
    </figure>
  )
}
