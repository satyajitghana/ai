"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ArrowsOutSimpleIcon, XIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Wraps a diagram/figure and adds an expand-to-fullscreen control. The children
// are server-rendered and always shown inline, so this degrades to a plain static
// figure with no JS (the button simply does nothing) — keeping the .md / no-JS
// variants complete. With JS, clicking opens a fullscreen overlay with the same
// content scaled up; Esc or a click on the backdrop closes it.
export function Zoomable({
  children,
  className,
  label = "figure",
}: {
  children: React.ReactNode
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <div className={cn("group/zoom relative", className)}>
        {children}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Expand ${label} to fullscreen`}
          className="absolute top-2 right-2 z-10 flex cursor-pointer items-center gap-1 rounded-md border bg-background/80 px-2 py-1 font-mono text-[10px] text-muted-foreground opacity-70 backdrop-blur-sm transition-opacity hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover/zoom:opacity-100"
        >
          <ArrowsOutSimpleIcon size={12} weight="bold" />
          expand
        </button>
      </div>

      {open && mounted
        ? createPortal(
            <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label}, fullscreen`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close fullscreen"
            className="absolute top-4 right-4 z-10 flex cursor-pointer items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon size={13} weight="bold" />
            close · esc
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] max-w-full items-center justify-center overflow-auto rounded-lg border bg-background p-3 sm:p-5 [&>figure]:my-0 [&_img]:mx-auto [&_img]:h-auto [&_img]:max-h-[82vh] [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full"
          >
            {children}
          </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
