"use client"

// Shared pieces for this article's live UI SDK widgets: the class strings that
// dress the unstyled parts in the site's tokens, a few inline icons (the site
// has no icon package), and <Specimen>, the card each component sits in. A
// specimen listens to its own component through observe() from
// @ui-sdk/react/observe, so the readout under it is the library's own report
// of what changed, why, and who changed it.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"

import { observe, type ObservedChange } from "@ui-sdk/react/observe"

import { cn } from "@/lib/utils"

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"

const ui = {
  focusRing,
  field: cn(
    "h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground",
    focusRing,
  ),
  trigger: cn(
    "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm text-foreground data-[open]:border-foreground/40",
    focusRing,
  ),
  button: cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted data-[open]:bg-muted",
    focusRing,
  ),
  solid: cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-sm font-medium text-background hover:opacity-90",
    focusRing,
  ),
  popup: cn(
    "z-50 min-w-(--anchor-width) max-w-[calc(100vw-2rem)] max-h-[min(18rem,var(--available-height))] overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-lg outline-none",
    "origin-(--transform-origin) transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none",
    // A select or menu with presentation="auto" becomes a bottom sheet on a
    // small touch screen; the library positions it, this only shapes it.
    "data-[presentation=sheet]:max-h-[70vh] data-[presentation=sheet]:w-full data-[presentation=sheet]:max-w-none data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:p-2 data-[presentation=sheet]:pb-[max(0.5rem,env(safe-area-inset-bottom))]",
  ),
  item: "flex cursor-default select-none items-center justify-between gap-3 rounded-sm px-2 py-1.5 outline-none data-highlighted:bg-muted data-[disabled]:opacity-40 data-[presentation=sheet]:py-2.5",
  label: "text-xs font-medium text-muted-foreground",
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4 shrink-0", className)}
    >
      <path d={d} />
    </svg>
  )
}

const icons = {
  chevronDown: "m6 9 6 6 6-6",
  chevronRight: "m9 18 6-6-6-6",
  chevronLeft: "m15 18-6-6 6-6",
  check: "M20 6 9 17l-5-5",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z",
  folder: "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z",
  minus: "M5 12h14",
  plus: "M12 5v14M5 12h14",
  more: "M12 6h.01M12 12h.01M12 18h.01",
  x: "M18 6 6 18M6 6l12 12",
}

// What a specimen shows under its component: the last change observe()
// reported, in words. Values are trimmed so a color or a long list fits.
function describeChange(c: ObservedChange) {
  const show = (v: unknown) => {
    if (v === null || v === undefined || v === "") return "none"
    const s = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)
    return s.length > 28 ? `${s.slice(0, 27)}…` : s
  }
  return { what: `${c.key} ${show(c.previous)} → ${show(c.value)}`, why: `${c.reason}, ${c.source}` }
}

type KeyHint = { k: string; does: string; match: string[] }

function Specimen({
  name,
  title,
  keys,
  children,
  className,
}: {
  /** The package entry, as imported: `select` for @ui-sdk/react/select. */
  name: string
  title: string
  keys: KeyHint[]
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [last, setLast] = useState<{ what: string; why: string; agent: boolean } | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const stop = observe(
      (change) => {
        // Open and highlight changes are noise for a reader; values are the point.
        if (change.key === "open" || change.key === "highlighted") return
        setLast({ ...describeChange(change), agent: change.source === "agent" })
      },
      { within: () => ref.current },
    )
    return () => {
      stop()
      clearTimeout(timer.current)
    }
  }, [])

  // Lights the key chip a reader just pressed while focus was inside, so the
  // keyboard support is visible without opening devtools.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const hit = keys.find((h) => h.match.includes(e.key) || (h.match.includes("a-z") && /^[a-z0-9]$/i.test(e.key)))
    if (!hit) return
    setPressed(hit.k)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPressed(null), 700)
  }

  return (
    <div
      ref={ref}
      onKeyDownCapture={onKeyDown}
      className={cn("flex min-w-0 flex-col gap-3 rounded-md border border-border bg-background/40 p-3", className)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <code className="truncate font-mono text-[11px] text-muted-foreground">{name}</code>
      </div>
      <div className="min-w-0">{children}</div>
      <ul className="flex flex-wrap gap-1" aria-label={`${title} keys`}>
        {keys.map((h) => (
          <li
            key={h.k}
            className={cn(
              "flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors duration-150",
              pressed === h.k && "border-foreground bg-foreground text-background",
            )}
          >
            <kbd className="font-mono font-medium">{h.k}</kbd>
            <span>{h.does}</span>
          </li>
        ))}
      </ul>
      <p className="min-h-8 border-t border-border pt-2 font-mono text-[11px] leading-snug text-muted-foreground" aria-live="polite">
        {last ? (
          <>
            <span className="text-foreground">{last.what}</span>
            <br />
            {last.why}
          </>
        ) : (
          "observe() is listening. Change it."
        )}
      </p>
    </div>
  )
}

export { Icon, icons, Specimen, ui, type KeyHint }
