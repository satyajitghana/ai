"use client"

import type { ComponentPropsWithoutRef, CSSProperties } from "react"

import { cn } from "@/lib/utils"

// The house range control for every article diagram. It's a real
// <input type="range"> underneath — so keyboard, drag, focus, and the standard
// onChange(event) contract are untouched — restyled into the site look: a thin
// rounded rail, an accent-filled progress portion up to the thumb, and a ringed
// thumb that lifts on hover. Drop it in exactly where a native range went; pass
// the same min/max/value/step/onChange. `accent` (any CSS color) tints the fill
// and thumb; omit it to inherit the house accent. All visual styling lives in
// the `.hg-range` rules in app/globals.css, keyed off two CSS custom properties.
type RangeProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  accent?: string
}

export function Range({
  accent,
  className,
  style,
  min,
  max,
  value,
  ...rest
}: RangeProps) {
  const lo = Number(min ?? 0)
  const hi = Number(max ?? 100)
  const v = Number(value ?? lo)
  const pct = hi > lo ? Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)) : 0

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      className={cn("hg-range", className)}
      style={
        {
          ...(accent ? { "--hg-accent": accent } : {}),
          "--hg-fill": `${pct.toFixed(2)}%`,
          ...style,
        } as CSSProperties
      }
      {...rest}
    />
  )
}
