"use client"

import { useState } from "react"
import { ArrowsOutSimpleIcon, ArrowsInSimpleIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Wraps a long code block so it shows a preview height with a fade and an
// "expand" control, then opens to the full listing. It renders the full,
// server-highlighted code as children, so with no JS (the .md / agent variants)
// the entire file is present — only the collapse is JS. `collapsedHeight` is the
// preview height in px; `label` names the file in the toolbar.
export function CodeCollapse({
  children,
  label = "full source",
  collapsedHeight = 420,
}: {
  children: React.ReactNode
  label?: string
  collapsedHeight?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  // only collapse once mounted — SSR/no-JS shows the whole thing
  if (typeof window !== "undefined" && !mounted) setMounted(true)
  const collapsed = mounted && !open

  return (
    <figure className="my-6 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>{label}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          {open ? <ArrowsInSimpleIcon size={12} weight="bold" /> : <ArrowsOutSimpleIcon size={12} weight="bold" />}
          {open ? "collapse" : "show full file"}
        </button>
      </div>

      <div
        className={cn("relative", collapsed && "overflow-hidden")}
        style={collapsed ? { maxHeight: collapsedHeight } : undefined}
      >
        {/* strip the inner <pre>'s own border/margin so it sits flush in the frame */}
        <div className="[&>pre]:my-0 [&>pre]:rounded-none [&>pre]:border-0">{children}</div>
        {collapsed ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute inset-x-0 bottom-0 flex h-24 cursor-pointer items-end justify-center bg-gradient-to-t from-background via-background/80 to-transparent pb-3 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label={`Show full ${label}`}
          >
            <span className="flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5">
              <ArrowsOutSimpleIcon size={12} weight="bold" />
              show full file
            </span>
          </button>
        ) : null}
      </div>
    </figure>
  )
}
