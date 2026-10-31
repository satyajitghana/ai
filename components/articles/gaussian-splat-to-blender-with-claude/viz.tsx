import type { ReactNode } from "react"

export const ACCENT = "oklch(0.62 0.16 35)"
export const STREAM = "oklch(0.60 0.15 255)"
export const GREEN = "oklch(0.60 0.14 150)"
export const VIOLET = "oklch(0.58 0.16 305)"
export const MONO = "ui-monospace, monospace"

export function Frame({
  label,
  right,
  children,
  note,
}: {
  label: string
  right?: ReactNode
  children: ReactNode
  note?: ReactNode
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        {right}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
      {note ? (
        <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">{note}</figcaption>
      ) : null}
    </figure>
  )
}

export function T({
  x,
  y,
  children,
  size = 10,
  anchor = "start",
  fill = "currentColor",
  opacity = 0.8,
  weight,
}: {
  x: number
  y: number
  children: ReactNode
  size?: number
  anchor?: "start" | "middle" | "end"
  fill?: string
  opacity?: number
  weight?: number
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor={anchor}
      fontFamily={MONO}
      fill={fill}
      fillOpacity={opacity}
      fontWeight={weight}
    >
      {children}
    </text>
  )
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
        (active
          ? "border-foreground/30 bg-muted/50 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  )
}
