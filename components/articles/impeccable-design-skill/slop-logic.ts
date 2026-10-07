// The checks the slop bench runs, each a small port of the rule it names in
// pbakaus/impeccable at d98b0be. Thresholds are theirs; the inputs are the
// bench's own state rather than a parsed page.

import { mpow } from "@/lib/dmath"

export type Rgb = { r: number; g: number; b: number }

export function hex(h: string): Rgb {
  const n = parseInt(h.replace("#", ""), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// crates/core/src/checks/measures.rs:392 (is_cream_color): every channel at or
// above 209, ordered r >= g >= b, and r - b between 6 and 48.
export function isCream(c: Rgb): boolean {
  if (Math.min(c.r, c.g, c.b) < 209) return false
  if (!(c.r >= c.g && c.g >= c.b)) return false
  const warmth = c.r - c.b
  return warmth >= 6 && warmth <= 48
}

// WCAG 2 relative luminance and contrast ratio, the measure behind the
// `low-contrast` rule (4.5:1 for body text).
function channel(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : mpow((s + 0.055) / 1.055, 2.4)
}
function luminance(c: Rgb): number {
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

// A neutral grey at lightness `l` (0-255).
export function grey(l: number): Rgb {
  return { r: l, g: l, b: l }
}

// crates/core/src/checks/rules.rs:301 (check_borders), for a coloured stripe
// on one side: 2px or more on a rounded card, or 3px or more on a square one,
// with the other sides at 1px or less.
export function sideTab(width: number, rounded: boolean): boolean {
  if (width < 2) return false
  return rounded ? true : width >= 3
}

// `flat-type-hierarchy`: heading and body separated by less than 1.25x.
export const FLAT_RATIO = 1.25
