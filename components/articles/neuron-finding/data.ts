// Per-target best neuron of neuron-finder's own published run: Qwen3.5-4B, 46 targets, default command, LLM judge.
// Recomputed here from each target's results/<name>/ranked.json at commit 38ae049 of
// github.com/changjonathanc/neuron-finder (MIT). The first row of each ranked.json is the confirmed #1.
// hits/of: confirmed hits out of 32 fresh replies. nullP95: 95th percentile of the 16 random neurons' hit rates
// (screening stage). dose is signed. src is which screens listed the neuron. Reported by the repository; not re-run.

export type Verdict = "found" | "partial" | "not found"
export type NfRow = {
  target: string
  layer: number
  neuron: number
  dose: number
  hits: number
  of: number
  nullP95: number
  verdict: Verdict
  src: string
  runtimeS: number
}

export const NF_ROWS: NfRow[] = [
  { target: "alien", layer: 22, neuron: 2742, dose: 0.8, hits: 27, of: 32, nullP95: 0.0, verdict: "found", src: "read+write/base", runtimeS: 292 },
  { target: "angry", layer: 7, neuron: 7340, dose: -1.5, hits: 27, of: 32, nullP95: 0.0, verdict: "found", src: "write", runtimeS: 310 },
  { target: "anime", layer: 13, neuron: 4810, dose: 1.5, hits: 12, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 289 },
  { target: "anxious", layer: 17, neuron: 6056, dose: -0.8, hits: 13, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 296 },
  { target: "arrogant", layer: 11, neuron: 5233, dose: -0.8, hits: 27, of: 32, nullP95: 0.12, verdict: "found", src: "write/base", runtimeS: 434 },
  { target: "bridge", layer: 6, neuron: 7448, dose: -1.5, hits: 19, of: 32, nullP95: 0.0, verdict: "found", src: "write+write/base", runtimeS: 714 },
  { target: "calm", layer: 7, neuron: 6119, dose: 0.8, hits: 31, of: 32, nullP95: 0.12, verdict: "found", src: "read", runtimeS: 278 },
  { target: "cartoon_mascot", layer: 13, neuron: 4810, dose: 1.5, hits: 24, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 571 },
  { target: "cat", layer: 23, neuron: 7967, dose: 1.5, hits: 10, of: 32, nullP95: 0.0, verdict: "partial", src: "read", runtimeS: 308 },
  { target: "child", layer: 15, neuron: 8875, dose: -0.8, hits: 28, of: 32, nullP95: 0.0, verdict: "found", src: "write", runtimeS: 621 },
  { target: "chinese", layer: 17, neuron: 4266, dose: 0.8, hits: 27, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 301 },
  { target: "conspiracy", layer: 10, neuron: 7757, dose: 1.5, hits: 25, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 332 },
  { target: "cookie", layer: 24, neuron: 3102, dose: 0.8, hits: 13, of: 32, nullP95: 0.0, verdict: "found", src: "read+write", runtimeS: 230 },
  { target: "cowboy", layer: 6, neuron: 8991, dose: -1.5, hits: 6, of: 32, nullP95: 0.0, verdict: "partial", src: "read", runtimeS: 302 },
  { target: "emoji", layer: 14, neuron: 8187, dose: 0.8, hits: 12, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 315 },
  { target: "female", layer: 21, neuron: 7290, dose: -0.8, hits: 22, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 308 },
  { target: "flattering", layer: 9, neuron: 7515, dose: -1.5, hits: 23, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 300 },
  { target: "food", layer: 15, neuron: 2099, dose: 1.5, hits: 31, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 330 },
  { target: "formal", layer: 18, neuron: 1256, dose: -1.5, hits: 3, of: 32, nullP95: 0.0, verdict: "partial", src: "write/base", runtimeS: 574 },
  { target: "french", layer: 6, neuron: 5264, dose: -0.8, hits: 32, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 296 },
  { target: "god", layer: 7, neuron: 6870, dose: 1.5, hits: 23, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 331 },
  { target: "golden_gate", layer: 27, neuron: 7433, dose: -0.8, hits: 0, of: 32, nullP95: 0.0, verdict: "not found", src: "read", runtimeS: 303 },
  { target: "green", layer: 24, neuron: 8978, dose: -0.8, hits: 27, of: 32, nullP95: 0.0, verdict: "found", src: "read+write+write/base", runtimeS: 341 },
  { target: "happy", layer: 23, neuron: 8424, dose: -0.8, hits: 27, of: 32, nullP95: 0.12, verdict: "found", src: "write+write/base", runtimeS: 307 },
  { target: "male", layer: 12, neuron: 2888, dose: -1.5, hits: 12, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 297 },
  { target: "math", layer: 9, neuron: 7290, dose: -1.5, hits: 31, of: 32, nullP95: 0.0, verdict: "found", src: "read+write+write/base", runtimeS: 321 },
  { target: "ocean", layer: 6, neuron: 6769, dose: -2.5, hits: 27, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 324 },
  { target: "old_man", layer: 10, neuron: 7134, dose: 1.5, hits: 31, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 470 },
  { target: "owl", layer: 8, neuron: 8224, dose: -2.5, hits: 0, of: 32, nullP95: 0.0, verdict: "not found", src: "read", runtimeS: 299 },
  { target: "philosopher", layer: 15, neuron: 9125, dose: 1.5, hits: 30, of: 32, nullP95: 0.12, verdict: "found", src: "write", runtimeS: 316 },
  { target: "pirate", layer: 24, neuron: 3688, dose: 0.8, hits: 0, of: 32, nullP95: 0.0, verdict: "not found", src: "write", runtimeS: 287 },
  { target: "refusing", layer: 7, neuron: 8562, dose: 1.5, hits: 28, of: 32, nullP95: 0.12, verdict: "found", src: "read", runtimeS: 533 },
  { target: "rhyming", layer: 17, neuron: 2689, dose: 1.5, hits: 7, of: 32, nullP95: 0.0, verdict: "partial", src: "write/base", runtimeS: 309 },
  { target: "robot", layer: 17, neuron: 7776, dose: -0.8, hits: 32, of: 32, nullP95: 1.0, verdict: "not found", src: "read", runtimeS: 426 },
  { target: "rude", layer: 17, neuron: 8623, dose: 0.8, hits: 24, of: 32, nullP95: 0.0, verdict: "found", src: "write+write/base", runtimeS: 400 },
  { target: "sad", layer: 7, neuron: 8379, dose: -1.5, hits: 26, of: 32, nullP95: 0.12, verdict: "found", src: "write", runtimeS: 292 },
  { target: "san_francisco", layer: 23, neuron: 7365, dose: -0.8, hits: 0, of: 32, nullP95: 0.0, verdict: "not found", src: "read", runtimeS: 616 },
  { target: "sarcastic", layer: 14, neuron: 9113, dose: -0.8, hits: 14, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 360 },
  { target: "scientist", layer: 21, neuron: 5227, dose: 0.8, hits: 24, of: 32, nullP95: 0.0, verdict: "found", src: "write/base", runtimeS: 297 },
  { target: "shakespeare", layer: 21, neuron: 3435, dose: -1.5, hits: 3, of: 32, nullP95: 0.0, verdict: "partial", src: "read", runtimeS: 366 },
  { target: "shouting", layer: 23, neuron: 1023, dose: -0.8, hits: 21, of: 32, nullP95: 0.0, verdict: "found", src: "write+write/base", runtimeS: 306 },
  { target: "shy", layer: 11, neuron: 3963, dose: -1.5, hits: 19, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 378 },
  { target: "space", layer: 7, neuron: 8675, dose: 1.5, hits: 32, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 348 },
  { target: "spanish", layer: 6, neuron: 7756, dose: -0.8, hits: 32, of: 32, nullP95: 0.0, verdict: "found", src: "read", runtimeS: 314 },
  { target: "sports", layer: 6, neuron: 6211, dose: -2.5, hits: 32, of: 32, nullP95: 0.0, verdict: "found", src: "write", runtimeS: 339 },
  { target: "terse", layer: 17, neuron: 1783, dose: -0.8, hits: 17, of: 32, nullP95: 0.25, verdict: "found", src: "write", runtimeS: 331 },
]

export const NF_LAYERS = 32
export const NF_NEURONS_PER_LAYER = 9216
export const NF_TOTAL_NEURONS = NF_LAYERS * NF_NEURONS_PER_LAYER // 294,912

// The funnel of one default run (the "calm" target): 163 distinct candidate neurons, 3 doses each, plus a null of
// 16 random neurons at the same 3 doses. Median over the 46 runs: 165.5 distinct candidates.
export const FUNNEL = {
  candidates: 163,
  doses: 3,
  settings: 489,
  controlNeurons: 16,
  controlSettings: 48,
  confirmed: 5,
  repliesPerSetting: 8,
  repliesPerConfirm: 32,
}

// Across all 46 published runs (22,950 steered settings and 2,208 control settings, 8 replies each at the screening
// stage), the share of settings whose hit rate reached 0.375, by which screen listed the neuron. "both" is a neuron
// the read list and at least one write list both put on the shortlist. Recomputed from results/*/ranked.json and
// controls.json; a setting is one candidate neuron at one dose. Reported by the repository, recomputed here.
export type Group = { settings: number; mean_hit: number; frac_ge_0375: number; best: number }
export const REPO_AGG: Record<"read" | "write" | "both" | "control", Group> = {
  "read": {
    "settings": 7563,
    "mean_hit": 0.023,
    "frac_ge_0375": 0.026,
    "best": 1.0
  },
  "write": {
    "settings": 14850,
    "mean_hit": 0.022,
    "frac_ge_0375": 0.025,
    "best": 1.0
  },
  "both": {
    "settings": 537,
    "mean_hit": 0.067,
    "frac_ge_0375": 0.089,
    "best": 1.0
  },
  "control": {
    "settings": 2208,
    "mean_hit": 0.013,
    "frac_ge_0375": 0.013,
    "best": 1.0
  }
}
