// Numbers from the ARC-1.0 model card and technical report (rayline-ai/ARC-1.0, release arc-1.0-20261111).
// Success rates are percent; cost is ARC's cost per task as a percent of the paired Opus 5.5 baseline.

export type Row = { bench: string; opus: number; arc: number; cost: number; local?: number }

// Card "Opus vs ARC prefer-local" table; local picks from the report's Figure 9.
export const PREFER_LOCAL: Row[] = [
  { bench: "DeepSWE", opus: 69.9, arc: 72.3, cost: 1.1, local: 98.2 },
  { bench: "Terminal-Bench 2.1", opus: 90.7, arc: 90.5, cost: 75.7, local: 10.8 },
  { bench: "SWE-Atlas QA", opus: 61.6, arc: 62.6, cost: 1.6, local: 91.9 },
  { bench: "Tau3 Banking", opus: 42.8, arc: 35.3, cost: 17.3, local: 53.1 },
  { bench: "GPQA Diamond", opus: 89.5, arc: 92.5, cost: 12.3, local: 51.4 },
  { bench: "MMMU-Pro Vision", opus: 82.2, arc: 82.7, cost: 40.9, local: 2.1 },
]

// Card "ARC Sage vs Opus 5.5" table.
export const SAGE: Row[] = [
  { bench: "DeepSWE", opus: 69.9, arc: 68.7, cost: 7 },
  { bench: "Terminal-Bench 2.1", opus: 91.0, arc: 92.4, cost: 58 },
  { bench: "SWE-Atlas QA", opus: 61.6, arc: 62.4, cost: 13 },
  { bench: "MMMU-Pro Vision", opus: 82.2, arc: 82.9, cost: 39 },
  { bench: "GPQA Diamond", opus: 89.9, arc: 94.1, cost: 21 },
  { bench: "Tau3 Banking", opus: 42.8, arc: 33.2, cost: 17 },
]

export const HEADLINE_QUALITY = 97.5
