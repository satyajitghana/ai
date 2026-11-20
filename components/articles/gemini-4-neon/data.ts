// Artificial Analysis Intelligence Index v5.0.1 records, read on 2026-11-20 from
// the model objects embedded in artificialanalysis.ai/models/gemini-4-neon (the
// page carries the Neon variants plus a comparison set). Fields:
//   idx    = intelligenceIndex
//   full   = intelligenceIndexCostPerTask.cost.nonCacheInput + .cacheWrite
//            (input billed at the full input rate), USD per index task
//   cached = .cacheRead (input billed at the cache-hit rate), USD per task
//   out    = .output (reasoning + answer tokens at the output rate), USD per task
//   total  = .total
//   outTok = intelligenceIndexOutputTokensPerTask.output
//   secs   = intelligenceIndexTimePerTask (seconds per index task)
//   tps    = headline.outputSpeed, ttft = headline.timeToFirstToken (s)
// AA prices Carbon at $4/$20 (its standard price) and Argon at $2/$10 (its
// introductory price, which runs to 2026-11-30). Opus 5.5 is $4/$20, Fable 5.2
// $8/$40, GPT-6.2 Astra $8/$40, GPT-6.2 Sol $2/$10, Neon $3/$15, Hydrogen
// $1.50/$7.50.

export type Fam = "neon" | "carbon" | "argon" | "hydrogen" | "opus" | "fable" | "astra" | "sol"

export type Row = {
  fam: Fam
  name: string
  effort: string
  idx: number
  full: number
  cached: number
  out: number
  total: number
  outTok: number
  secs: number
  tps: number
  ttft: number
}

export const ROWS: Row[] = [
  { fam: "neon", name: "Neon", effort: "low", idx: 44.08, full: 0.29, cached: 0.129, out: 0.326, total: 0.75, outTok: 21726, secs: 224, tps: 97.1, ttft: 13.9 },
  { fam: "neon", name: "Neon", effort: "medium", idx: 54.86, full: 0.751, cached: 0.404, out: 0.75, total: 1.9, outTok: 50000, secs: 496, tps: 100.7, ttft: 20.1 },
  { fam: "neon", name: "Neon", effort: "high", idx: 59.62, full: 1.505, cached: 0.884, out: 1.353, total: 3.74, outTok: 90188, secs: 889, tps: 101.5, ttft: 40.6 },
  { fam: "neon", name: "Neon", effort: "xhigh", idx: 61.4, full: 2.659, cached: 1.661, out: 2.124, total: 6.44, outTok: 141631, secs: 1289, tps: 109.9, ttft: 56.5 },
  { fam: "carbon", name: "Carbon", effort: "low", idx: 54.22, full: 3.284, cached: 2.179, out: 1.723, total: 7.19, outTok: 86165, secs: 1727, tps: 49.9, ttft: 8.0 },
  { fam: "carbon", name: "Carbon", effort: "medium", idx: 58.26, full: 2.798, cached: 1.728, out: 2.06, total: 6.59, outTok: 103012, secs: 1733, tps: 59.4, ttft: 33.4 },
  { fam: "carbon", name: "Carbon", effort: "high", idx: 60.03, full: 3.261, cached: 2.039, out: 2.455, total: 7.76, outTok: 122768, secs: 2389, tps: 51.4, ttft: 74.5 },
  { fam: "argon", name: "Argon", effort: "high", idx: 50.41, full: 2.833, cached: 0.976, out: 1.164, total: 4.97, outTok: 116368, secs: 1721, tps: 67.6, ttft: 47.1 },
  { fam: "hydrogen", name: "Hydrogen", effort: "high", idx: 50.79, full: 0.664, cached: 0.572, out: 0.637, total: 1.87, outTok: 84978, secs: 527, tps: 161.3, ttft: 21.9 },
  { fam: "hydrogen", name: "Hydrogen", effort: "xhigh", idx: 53.92, full: 0.794, cached: 1.208, out: 1.158, total: 3.16, outTok: 154406, secs: 941, tps: 164.2, ttft: 51.3 },
  { fam: "opus", name: "Opus 5.5", effort: "xhigh", idx: 57.44, full: 1.186, cached: 2.793, out: 2.068, total: 6.05, outTok: 103395, secs: 968, tps: 106.8, ttft: 70.1 },
  { fam: "opus", name: "Opus 5.5", effort: "max", idx: 59.11, full: 1.832, cached: 4.738, out: 3.466, total: 10.04, outTok: 173313, secs: 1543, tps: 112.3, ttft: 370.6 },
  { fam: "fable", name: "Fable 5.2", effort: "high", idx: 61.82, full: 2.593, cached: 2.597, out: 3.888, total: 9.08, outTok: 97841, secs: 911, tps: 107.4, ttft: 25.4 },
  { fam: "fable", name: "Fable 5.2", effort: "max", idx: 64.56, full: 7.121, cached: 8.525, out: 10.892, total: 26.54, outTok: 273776, secs: 2492, tps: 109.9, ttft: 249.5 },
  { fam: "astra", name: "GPT-6.2 Astra", effort: "xhigh", idx: 61.56, full: 0.844, cached: 0.788, out: 0.89, total: 2.52, outTok: 22238, secs: 465, tps: 47.8, ttft: 65.2 },
  { fam: "astra", name: "GPT-6.2 Astra", effort: "max", idx: 62.14, full: 1.162, cached: 1.195, out: 1.641, total: 4.0, outTok: 41029, secs: 857, tps: 47.9, ttft: 203.2 },
  { fam: "sol", name: "GPT-6.2 Sol", effort: "max", idx: 57.26, full: 0.31, cached: 0.301, out: 0.404, total: 1.01, outTok: 40360, secs: 564, tps: 71.6, ttft: 80.6 },
]

export const GEMINI: Fam[] = ["neon", "carbon", "argon", "hydrogen"]

export const COLOR: Record<Fam, string> = {
  neon: "oklch(0.62 0.2 30)",
  carbon: "oklch(0.45 0.03 260)",
  argon: "oklch(0.6 0.13 300)",
  hydrogen: "oklch(0.65 0.14 200)",
  opus: "oklch(0.6 0.13 60)",
  fable: "oklch(0.55 0.15 20)",
  astra: "oklch(0.55 0.12 150)",
  sol: "oklch(0.7 0.12 120)",
}
