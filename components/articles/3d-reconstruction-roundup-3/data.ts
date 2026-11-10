// Numbers behind the three widgets of 3d-reconstruction-roundup-3.
//
// TRAINSPOTTING: recomputed by us from the per-sample CSVs the authors ship in
// hanyucc/trainspotting@d41efab (evaluation/results/*.csv, 1,635 samples per
// model) joined to evaluation/samples/regimes.csv. Mean over samples, as the
// paper's Table 3 does. The "all" row reproduces the README table exactly.
//
// LAMARIA: the public leaderboard at lamaria.ethz.ch/leaderboard, read on
// 2026-11-10, mono + IMU submissions with a score in every category.
//
// ROTSYNC: written by the article's numpy toy (see rotsync.ts).

export type Regime = "all" | "fixed" | "roaming" | "instance-pooled"
export type TsModel = "VGGT" | "π3" | "VGGT-Ω" | "Spotter"
export type TsMetric = "auc5" | "auc30" | "absrel" | "comp"

export const TS_SAMPLES: Record<Regime, number> = {
  all: 1635,
  fixed: 442,
  roaming: 450,
  "instance-pooled": 743,
}

// [auc5, auc30, absrel, comp]
export const TS: Record<Regime, Record<TsModel, [number, number, number, number]>> = {
  all: {
    VGGT: [11.5, 44.1, 0.16, 8.08],
    "π3": [12.5, 46.4, 0.162, 6.22],
    "VGGT-Ω": [7.2, 25.0, 0.201, 12.68],
    Spotter: [44.2, 81.2, 0.071, 1.15],
  },
  fixed: {
    VGGT: [22.8, 63.0, 0.096, 2.97],
    "π3": [26.9, 68.7, 0.083, 1.73],
    "VGGT-Ω": [20.4, 56.7, 0.12, 3.19],
    Spotter: [44.0, 79.0, 0.055, 1.23],
  },
  roaming: {
    VGGT: [6.8, 35.2, 0.203, 10.68],
    "π3": [6.9, 37.7, 0.202, 8.99],
    "VGGT-Ω": [2.9, 14.9, 0.26, 15.33],
    Spotter: [41.7, 81.0, 0.089, 1.29],
  },
  "instance-pooled": {
    VGGT: [7.6, 38.4, 0.171, 9.54],
    "π3": [7.4, 38.5, 0.184, 7.22],
    "VGGT-Ω": [2.1, 12.3, 0.214, 16.72],
    Spotter: [45.9, 82.6, 0.07, 1.03],
  },
}

export type LamariaRow = {
  name: string
  short: number
  medium: number
  long: number
  lowLight: number
  moving: number
  reproduced?: boolean
}

export const LAMARIA_MONO_IMU: LamariaRow[] = [
  { name: "FPV-SLAM", short: 61.4, medium: 44.7, long: 40.1, lowLight: 53.9, moving: 25.8 },
  { name: "Mighty Camera", short: 57.1, medium: 38.8, long: 18.5, lowLight: 36.9, moving: 15.8 },
  { name: "AnchorFlow VIO", short: 47.2, medium: 37.1, long: 24.8, lowLight: 35.1, moving: 15.6 },
  { name: "ASTRM_FLOWSLAM_v1", short: 46.9, medium: 30.1, long: 26.0, lowLight: 34.3, moving: 23.5 },
  { name: "ASTRM_SLAM_v0", short: 43.9, medium: 40.5, long: 26.4, lowLight: 29.5, moving: 23.1 },
  { name: "NeoSLAM", short: 43.3, medium: 33.6, long: 30.0, lowLight: 41.7, moving: 19.1 },
  { name: "xzyVIO", short: 32.7, medium: 20.0, long: 18.8, lowLight: 31.7, moving: 2.5 },
  { name: "AnonVIO", short: 29.8, medium: 19.0, long: 7.2, lowLight: 26.4, moving: 14.1 },
  { name: "ASTRM_SLAM_v2", short: 25.8, medium: 18.4, long: 18.5, lowLight: 23.6, moving: 8.0 },
  { name: "ORB-SLAM3", short: 23.0, medium: 10.9, long: 11.2, lowLight: 3.1, moving: 2.0, reproduced: true },
  { name: "OpenVINS+Maplab", short: 19.7, medium: 12.7, long: 5.5, lowLight: 6.9, moving: 2.0, reproduced: true },
  { name: "OpenVINS", short: 16.0, medium: 10.6, long: 5.5, lowLight: 5.5, moving: 1.5, reproduced: true },
  { name: "Kimera VIO", short: 6.8, medium: 8.3, long: 7.2, lowLight: 3.3, moving: 3.6, reproduced: true },
]

export type LamariaCat = "short" | "medium" | "long" | "lowLight" | "moving"
export const LAMARIA_CATS: { id: LamariaCat; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
  { id: "lowLight", label: "Low light" },
  { id: "moving", label: "Moving platform" },
]
