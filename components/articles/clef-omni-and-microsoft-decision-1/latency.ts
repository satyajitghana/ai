// The latency column of Microsoft's "Accuracy, latency and calibration" chart (the blog's
// embedded widget, read 2026-10-10), next to what JevBench v1.6.1 measured before its
// self-hosted adjustment. JevBench's rule, from its own JSON: adjusted p50 = raw p50 x 2 +
// 0.15 s, "assumption, not measured". Hosted APIs get no adjustment.
// [name, as plotted (ms), raw (ms) or null, how the plotted number was produced]
export type LatencyRow = {
  name: string
  plotted: number
  raw: number | null
  how: "foundry" | "api" | "selfhosted" | "unknown"
}

export const ROWS: LatencyRow[] = [
  { name: "Microsoft-Decision-1", plotted: 85, raw: 85, how: "foundry" },
  { name: "H2O-Lightning-4B v1.1", plotted: 210, raw: 29.3, how: "selfhosted" },
  { name: "Jev 1.13.0", plotted: 240, raw: 239.1, how: "api" },
  { name: "GPT-6 Luna Decisions", plotted: 300, raw: null, how: "unknown" },
  { name: "Quyet-1.0-Large", plotted: 380, raw: 115.8, how: "selfhosted" },
  { name: "Surogate Rune 26B-A4B", plotted: 380, raw: 116.2, how: "selfhosted" },
  { name: "deck-31B", plotted: 400, raw: 127.5, how: "selfhosted" },
  { name: "GPT-6 Sol", plotted: 3010, raw: null, how: "unknown" },
]

// OpenRouter's model page, read 2026-10-10: P50 0.26 s, one provider (Azure).
export const MD1_OPENROUTER_P50 = 260
