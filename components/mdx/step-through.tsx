"use client"

import { Children, useState } from "react"

import { cn } from "@/lib/utils"

// Step-by-step walkthrough for explainers (e.g. Q·K → softmax → weighted sum).
// Each MDX child is one step. SSR renders step 1; buttons enhance client-side.
// The .md agent variant carries the full prose of every step regardless.
export function StepThrough({
  titles = [],
  children,
}: {
  titles?: string[]
  children: React.ReactNode
}) {
  const steps = Children.toArray(children)
  const [active, setActive] = useState(0)

  return (
    <figure className="my-8 rounded-md border">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2">
        {steps.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "cursor-pointer rounded px-2 py-1 font-mono text-xs transition-colors",
              i === active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={i === active ? "step" : undefined}
          >
            {i + 1}
            {titles[i] ? ` · ${titles[i]}` : ""}
          </button>
        ))}
      </div>
      <div className="px-4 py-2 [&>*]:my-3">{steps[active]}</div>
      <div className="flex justify-between border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={active === 0}
          className="cursor-pointer transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← prev
        </button>
        <span>
          step {active + 1}/{steps.length}
        </span>
        <button
          type="button"
          onClick={() => setActive((a) => Math.min(steps.length - 1, a + 1))}
          disabled={active === steps.length - 1}
          className="cursor-pointer transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          next →
        </button>
      </div>
    </figure>
  )
}
