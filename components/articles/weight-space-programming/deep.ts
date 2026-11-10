// Measured for the second pass of this article (2026-11-10).
//
// RUNS: read from RikiyaT/lm_understand-logs, exp8_math/eval/<run>/parts/math500_s*of10/.
// Accuracy is avg@4 over all 500 MATH-500 problems (math500_per_problem.json, each sample's
// math-verify grade). Loop counts come from the first sample of the first 20 problems in
// each of the ten shards (math500_first_samples.jsonl.gz): 200 full texts per run, thinking
// on, 32,768-token cap. "loopOpen" = a loop onset was found (>= 90% of the non-empty lines in
// the next 3,000 characters repeat an earlier line) and the answer never wrote </think>.

export type Run = {
  key: "unedited" | "p10c" | "p25c" | "p50c"
  label: string
  edit: string
  changed: string
  acc: number
  pass4: number
  closed: number
  looped: number
  loopThenClosed: number
  whitespace: number
  firstRight: number
  medianWait: number
  levels: { acc: number; pass4: number; loopOpen: number; n: number }[]
}

// n per level in the 200 first samples: 21, 44, 41, 44, 50. Problems per level in MATH-500: 43, 90, 105, 128, 134.
export const LEVEL_PROBLEMS = [43, 90, 105, 128, 134] as const

export const RUNS: Run[] = [
  {
    key: "unedited",
    label: "base",
    edit: "no edit",
    changed: "0",
    acc: 7.9,
    pass4: 15.4,
    closed: 13,
    looped: 183,
    loopThenClosed: 0,
    whitespace: 0,
    firstRight: 15,
    medianWait: 940,
    levels: [
      { acc: 27.3, pass4: 44.2, loopOpen: 16, n: 21 },
      { acc: 15.8, pass4: 30.0, loopOpen: 38, n: 44 },
      { acc: 7.6, pass4: 14.3, loopOpen: 38, n: 41 },
      { acc: 3.3, pass4: 9.4, loopOpen: 42, n: 44 },
      { acc: 0.9, pass4: 3.0, loopOpen: 49, n: 50 },
    ],
  },
  {
    key: "p10c",
    label: "10 passes",
    edit: "30 rank-one edits, layers 8-22",
    changed: "72,986,982",
    acc: 12.3,
    pass4: 25.2,
    closed: 41,
    looped: 167,
    loopThenClosed: 11,
    whitespace: 0,
    firstRight: 33,
    medianWait: 911,
    levels: [
      { acc: 39.5, pass4: 67.4, loopOpen: 8, n: 21 },
      { acc: 21.4, pass4: 40.0, loopOpen: 25, n: 44 },
      { acc: 13.8, pass4: 31.4, loopOpen: 34, n: 41 },
      { acc: 6.4, pass4: 15.6, loopOpen: 39, n: 44 },
      { acc: 2.1, pass4: 6.0, loopOpen: 50, n: 50 },
    ],
  },
  {
    key: "p25c",
    label: "25 passes",
    edit: "head 7 of layer 15 zeroed",
    changed: "262,144",
    acc: 14.1,
    pass4: 28.0,
    closed: 29,
    looped: 169,
    loopThenClosed: 6,
    whitespace: 0,
    firstRight: 26,
    medianWait: 847,
    levels: [
      { acc: 34.9, pass4: 60.5, loopOpen: 14, n: 21 },
      { acc: 25.6, pass4: 46.7, loopOpen: 30, n: 44 },
      { acc: 16.7, pass4: 33.3, loopOpen: 35, n: 41 },
      { acc: 8.6, pass4: 20.3, loopOpen: 37, n: 44 },
      { acc: 3.0, pass4: 8.2, loopOpen: 47, n: 50 },
    ],
  },
  {
    key: "p50c",
    label: "50 passes",
    edit: "64 neurons x 2 layers, alpha 6",
    changed: "130,188",
    acc: 48.1,
    pass4: 64.0,
    closed: 152,
    looped: 71,
    loopThenClosed: 54,
    whitespace: 11,
    firstRight: 92,
    medianWait: 166,
    levels: [
      { acc: 80.8, pass4: 93.0, loopOpen: 0, n: 21 },
      { acc: 68.9, pass4: 83.3, loopOpen: 4, n: 44 },
      { acc: 56.7, pass4: 79.0, loopOpen: 2, n: 41 },
      { acc: 41.6, pass4: 61.7, loopOpen: 5, n: 44 },
      { acc: 23.1, pass4: 32.1, loopOpen: 6, n: 50 },
    ],
  },
]

// DOSE / CONTROLS: measured on a CPU (PyTorch 2.14.1, transformers 5.20.2, bfloat16, 2 threads).
// Six base-model answers from the edited repository's eval/samples_base_math500.jsonl, each split
// at its loop onset: 43,214 tokens before the onsets and 7,327 in the ~3,000-character loop tails.
// Weights rebuilt from the base checkpoint with u and the 64 columns recovered from the diff;
// alpha 6 reproduces the published tensors to within bfloat16 rounding. Values: mean change in
// log-probability per token (nats) against the unedited weights, averaged over the six answers.
export type DoseRow = {
  label: string
  alpha?: number
  what: string
  dHead: number
  dTail: number
  tailMin: number
  tailMax: number
  logged: string | null
}

export const DOSES: DoseRow[] = [
  { alpha: 0, label: "alpha 0", what: "the unedited model", dHead: 0, dTail: 0, tailMin: 0, tailMax: 0, logged: null },
  { alpha: 1, label: "alpha 1", what: "the 64 columns stop writing along u", dHead: -0.0023, dTail: -0.0026, tailMin: -0.0036, tailMax: -0.0014, logged: "all 3,584 columns, pass 10: 11 → 42 of 128" },
  { alpha: 2, label: "alpha 2", what: "the 64 columns write -1x their old component", dHead: -0.005, dTail: -0.0063, tailMin: -0.0092, tailMax: -0.0036, logged: "all columns, pass 19: 21 → 110 of 256" },
  { alpha: 3, label: "alpha 3", what: "-2x", dHead: -0.0083, dTail: -0.0117, tailMin: -0.0158, tailMax: -0.0081, logged: "all columns, pass 20: 21 → 123 of 256" },
  { alpha: 4, label: "alpha 4", what: "-3x", dHead: -0.0121, dTail: -0.0194, tailMin: -0.0237, tailMax: -0.0142, logged: "64 columns, pass 27 (16,384 cap): 13 → 47 of 128" },
  { alpha: 6, label: "alpha 6", what: "-5x: the published edit", dHead: -0.0212, dTail: -0.0495, tailMin: -0.0891, tailMax: -0.0355, logged: "pass 30: 7 → 35 of 64; frozen, pass 34: 2 → 34 of 64" },
  { alpha: 8, label: "alpha 8", what: "-7x", dHead: -0.0348, dTail: -0.1283, tailMin: -0.3074, tailMax: -0.0721, logged: null },
  { alpha: 12, label: "alpha 12", what: "-11x", dHead: -0.0839, dTail: -0.6252, tailMin: -1.2394, tailMax: -0.2224, logged: null },
]

export const CONTROLS: DoseRow[] = [
  { label: "published edit", what: "u, the 64 chosen columns, both layers", dHead: -0.0212, dTail: -0.0495, tailMin: -0.0891, tailMax: -0.0355, logged: "pass 34: 2 → 34 of 64" },
  { label: "random direction", what: "a random unit vector orthogonal to u, same 64 columns", dHead: -0.0003, dTail: -0.0001, tailMin: -0.0004, tailMax: 0.0001, logged: "norm-matched random, pass 23: 14 → 16 of 128" },
  { label: "top |u·W| columns", what: "u, but the 64 columns with the largest write along u", dHead: -0.0164, dTail: -0.0241, tailMin: -0.0352, tailMax: -0.0181, logged: null },
  { label: "layer 15 only", what: "the published edit in layer 15, layer 19 untouched", dHead: -0.0136, dTail: -0.027, tailMin: -0.03, tailMax: -0.0207, logged: null },
  { label: "layer 19 only", what: "the published edit in layer 19, layer 15 untouched", dHead: -0.0103, dTail: -0.0124, tailMin: -0.0177, tailMax: -0.0073, logged: null },
  { label: "all columns, alpha 1", what: "u removed from every column of both matrices", dHead: -0.0044, dTail: -0.0037, tailMin: -0.0054, tailMax: -0.0019, logged: "pass 10: 11 → 42 of 128" },
]

// Residual stream along u after each edited layer, mean per token (base weights / published edit),
// and the part written by the 64 chosen neurons, on the same six answers.
export const RESID = {
  l15: { head: [0.934, 0.295], tail: [2.101, 0.041], chosenHead: 0.106, chosenTail: 0.343, allNeuronsTail: 0.43 },
  l19: { head: [1.863, 0.638], tail: [3.823, 0.292] },
} as const
