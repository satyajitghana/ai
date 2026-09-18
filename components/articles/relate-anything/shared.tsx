"use client"

// Shared chrome and palette for the three RelateAnything interactives.
//
// The colour language is consistent across all three: GATE/blue is the thing
// the released weights actually do, BUF/amber is a stored artifact that
// disagrees with them, FLAG/violet is a corpus-derived label, and MODEL/green
// marks the model in a comparison where the baseline (MUTED) sees no pixels.

export const GATE = "oklch(0.58 0.15 255)" // what the released gate computes
export const BUF = "oklch(0.70 0.14 75)" // the buffer stored in the checkpoint
export const FLAG = "oklch(0.58 0.19 305)" // the corpus spatial flag
export const MODEL = "oklch(0.55 0.15 155)" // RelateAnything
export const MUTED = "oklch(0.62 0.03 250)" // the pixel-free / baseline side
export const WARN = "oklch(0.60 0.18 25)" // the configuration to distrust

export function FigureCard({
  label,
  right,
  children,
}: {
  label: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 font-mono text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0">
          {right ?? <span className="text-muted-foreground/50">measured</span>}
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </figure>
  )
}

export function Legend({
  items,
}: {
  items: { color: string; label: string; ring?: boolean }[]
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{
              background: it.ring ? "transparent" : it.color,
              boxShadow: it.ring ? `inset 0 0 0 1.5px ${it.color}` : undefined,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

/** A segmented control. Zero dependencies, keyboard-reachable, wraps on phones. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; accent?: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-md border p-0.5"
      >
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className="cursor-pointer rounded-[5px] px-2 py-1 font-mono text-[11px] transition-colors"
              style={
                on
                  ? {
                      background: o.accent ?? "var(--foreground)",
                      color: "var(--background)",
                    }
                  : undefined
              }
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
