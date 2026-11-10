// Every score the argument rests on, with its source and protocol.
// "reported" rows are copied from the named source; "measured" rows are mine.

export type ScoreRow = {
  bench: "MATH-500" | "IFEval"
  label: string
  how: string
  value: number
  status: "reported" | "measured" | "unverified"
  edited: boolean
  kind: "post" | "other"
}

export const SCORE_ROWS: ScoreRow[] = [
  { bench: "MATH-500", label: "base, thinking", how: "post · 4 samples · 32,768 tok", value: 7.9, status: "reported", edited: false, kind: "post" },
  { bench: "MATH-500", label: "edit, 10 passes", how: "post · same protocol", value: 12.3, status: "reported", edited: true, kind: "post" },
  { bench: "MATH-500", label: "edit, 25 passes", how: "post · same protocol", value: 14.1, status: "reported", edited: true, kind: "post" },
  { bench: "MATH-500", label: "edit, 50 passes", how: "post · same protocol", value: 48.1, status: "reported", edited: true, kind: "post" },
  { bench: "MATH-500", label: "edit, 50 passes, re-run", how: "model repo · 2,000 answers", value: 51.0, status: "reported", edited: true, kind: "post" },
  { bench: "MATH-500", label: "base + noise, last 4 layers", how: "@yavuzbakman · 1 sample · seed 11", value: 16.2, status: "unverified", edited: true, kind: "other" },
  { bench: "MATH-500", label: "base, same reply's run", how: "@yavuzbakman · 1 sample", value: 8.8, status: "unverified", edited: false, kind: "other" },
  { bench: "MATH-500", label: "base, thinking off", how: "@dummerspast39 · protocol not given", value: 47, status: "unverified", edited: false, kind: "other" },
  { bench: "MATH-500", label: "edit, thinking off", how: "@dummerspast39 · protocol not given", value: 48, status: "unverified", edited: true, kind: "other" },
  { bench: "IFEval", label: "base, thinking", how: "post · 2 samples · 32,768 tok", value: 21.0, status: "reported", edited: false, kind: "post" },
  { bench: "IFEval", label: "edit, 50 passes", how: "post · same protocol", value: 62.3, status: "reported", edited: true, kind: "post" },
  { bench: "IFEval", label: "base, thinking", how: "Qwen model card", value: 44.0, status: "reported", edited: false, kind: "other" },
  { bench: "IFEval", label: "base, thinking off", how: "Qwen model card", value: 52.1, status: "reported", edited: false, kind: "other" },
]
