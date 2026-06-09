// Pure status helpers for biomarkers. No I/O, no side effects — safe to call
// from server components and the treemap layout alike.

import type { Biomarker, HealthCategory } from "@/data/health"

export type HealthStatus = "optimal" | "borderline" | "low" | "elevated"

export type OptimalRange = NonNullable<Biomarker["optimalRange"]>

// Derive a status from a value and its optimal range.
//
// - inside the range (or no range)            → "optimal"
// - just outside a bound, within marginPct of
//   that bound's magnitude                     → "borderline"
// - below the min beyond the margin            → "low"
// - above the max beyond the margin            → "elevated"
//
// marginPct is a fraction of the violated bound's magnitude (default 10%).
export function deriveStatus(
  value: number,
  optimalRange?: OptimalRange,
  marginPct = 0.1
): HealthStatus {
  if (!optimalRange) return "optimal"

  const { min, max } = optimalRange

  if (max !== undefined && value > max) {
    const margin = Math.abs(max) * marginPct
    return value <= max + margin ? "borderline" : "elevated"
  }

  if (min !== undefined && value < min) {
    const margin = Math.abs(min) * marginPct
    return value >= min - margin ? "borderline" : "low"
  }

  return "optimal"
}

// Human-readable caption for a non-optimal status, e.g.
// "ELEVATED — significantly above the optimal range".
export function statusCaption(status: HealthStatus, label: string): string {
  switch (status) {
    case "elevated":
      return `ELEVATED — ${label} significantly above the optimal range`
    case "low":
      return `LOW — ${label} significantly below the optimal range`
    case "borderline":
      return `BORDERLINE — ${label} just outside the optimal range`
    case "optimal":
      return `OPTIMAL — ${label} within the optimal range`
  }
}

// CSS custom-property name carrying each category's hue (defined in
// app/globals.css). Used as `var(--health-cardiovascular)` etc.
export function categoryColorVar(category: HealthCategory): string {
  return `--health-${category.replace(/_/g, "-")}`
}

// Display label for a category (legend + captions).
export function categoryLabel(category: HealthCategory): string {
  switch (category) {
    case "cardiovascular":
      return "Cardiovascular"
    case "metabolic":
      return "Metabolic"
    case "liver_kidney":
      return "Liver / Kidney"
    case "hormonal":
      return "Hormonal"
    case "nutritional":
      return "Nutritional"
    case "blood_panel":
      return "Blood Panel"
    case "vitals":
      return "Vitals"
  }
}
