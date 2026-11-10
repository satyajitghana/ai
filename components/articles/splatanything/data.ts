// Numbers behind the SplatAnything widgets. Two sources, kept apart:
//
// TOY: my numpy run (gsnorm_toy.py, numpy 2.5.3, Python 3.13, CPU). Six
// ray-cast captures, 8 views each (the cubemap has 4 faces from one centre),
// 96 x 96 rays per view with the full-resolution focal length. For each scene:
// the median per-pixel Gaussian spacing D / sqrt(fx * fy) after each
// normalization, and how a single constant scale predictor (fitted as the
// geometric mean of the ideal scale over all six scenes, ideal sigma = 0.7 x
// local spacing) lands against each scene's ideal.
//
// PAPER: arXiv 2611.08264v1, Table 3 / Table 12 (normalization ablation,
// views 1-64) and Table 1 (seven datasets, averaged over 4-64 views).

export type NormId = "RD" | "CD" | "D" | "GS"

export const NORMS: { id: NormId; label: string; long: string }[] = [
  { id: "RD", label: "RDNorm", long: "mean distance to the reference camera" },
  { id: "CD", label: "CDNorm", long: "median camera-centre distance" },
  { id: "D", label: "DNorm", long: "median depth" },
  { id: "GS", label: "GSNorm", long: "median Gaussian spacing" },
]

export type ToyScene = {
  id: string
  label: string
  W: number
  fov: number
  medianDepth: number // metres
  // median Gaussian spacing after each normalization (GSNorm is 1 by construction)
  spacing: Record<NormId, number | null>
  // constant predictor, median of predicted / ideal scale
  ratio: Record<"RD" | "D" | "GS", number>
  holes: Record<"RD" | "D" | "GS", number> // share of pixels with sigma under half the ideal
  blur: Record<"RD" | "D" | "GS", number> // share of pixels with sigma over twice the ideal
}

export const TOY: ToyScene[] = [
  {
    id: "obj504",
    label: "Object, 504 px",
    W: 504,
    fov: 45,
    medianDepth: 0.437,
    spacing: { RD: 0.001374, CD: 0.002437, D: 0.001644, GS: 1 },
    ratio: { RD: 0.877, D: 0.934, GS: 0.977 },
    holes: { RD: 0.07, D: 0.05, GS: 0.04 },
    blur: { RD: 0, D: 0, GS: 0 },
  },
  {
    id: "obj1022",
    label: "Object, 1022 px",
    W: 1022,
    fov: 45,
    medianDepth: 0.437,
    spacing: { RD: 0.000678, CD: 0.001202, D: 0.000811, GS: 1 },
    ratio: { RD: 1.778, D: 1.894, GS: 0.977 },
    holes: { RD: 0, D: 0, GS: 0.04 },
    blur: { RD: 0.08, D: 0.31, GS: 0 },
  },
  {
    id: "room",
    label: "Indoor room",
    W: 756,
    fov: 70,
    medianDepth: 3.663,
    spacing: { RD: 0.001603, CD: 0.01131, D: 0.001852, GS: 1 },
    ratio: { RD: 0.752, D: 0.829, GS: 0.977 },
    holes: { RD: 0, D: 0, GS: 0 },
    blur: { RD: 0, D: 0, GS: 0 },
  },
  {
    id: "street",
    label: "Street canyon",
    W: 896,
    fov: 80,
    medianDepth: 9.79,
    spacing: { RD: 0.001142, CD: 0.00573, D: 0.001873, GS: 1 },
    ratio: { RD: 1.055, D: 0.82, GS: 0.977 },
    holes: { RD: 0.15, D: 0.24, GS: 0.17 },
    blur: { RD: 0.38, D: 0.33, GS: 0.37 },
  },
  {
    id: "aerial",
    label: "Aerial",
    W: 1022,
    fov: 60,
    medianDepth: 156.2,
    spacing: { RD: 0.000895, CD: 0.011031, D: 0.00113, GS: 1 },
    ratio: { RD: 1.346, D: 1.359, GS: 0.977 },
    holes: { RD: 0, D: 0, GS: 0 },
    blur: { RD: 0, D: 0.01, GS: 0 },
  },
  {
    id: "cube",
    label: "Cubemap, 95° FoV",
    W: 756,
    fov: 95,
    medianDepth: 2.3,
    spacing: { RD: 0.00231, CD: null, D: 0.002887, GS: 1 },
    ratio: { RD: 0.522, D: 0.532, GS: 0.977 },
    holes: { RD: 0.38, D: 0.37, GS: 0 },
    blur: { RD: 0, D: 0, GS: 0 },
  },
]

/** max / min of the median spacing across the toy scenes (measured). */
export const TOY_SPREAD: Record<NormId, number> = { RD: 3.41, CD: 9.41, D: 3.56, GS: 1 }

/** Ideal sigma as a multiple of local spacing in the toy. */
export const IDEAL_K = 0.7

// Paper, Table 12 (Table 3 for the scale-calibration row). Lower is better.
export const VIEWS = [1, 4, 8, 16, 32, 64] as const

export type AblationRow = { id: string; label: string; dists: number[]; lpips: number[] }

export const ABLATION: AblationRow[] = [
  { id: "RD", label: "RDNorm", dists: [0.308, 0.223, 0.223, 0.218, 0.225, 0.224], lpips: [0.394, 0.278, 0.272, 0.268, 0.277, 0.25] },
  { id: "RDcal", label: "RDNorm + scale calibration", dists: [0.323, 0.249, 0.252, 0.245, 0.253, 0.234], lpips: [0.4, 0.309, 0.308, 0.3, 0.305, 0.265] },
  { id: "CD", label: "CDNorm", dists: [0.793, 0.217, 0.216, 0.214, 0.221, 0.224], lpips: [1.027, 0.284, 0.28, 0.28, 0.291, 0.26] },
  { id: "D", label: "DNorm", dists: [0.307, 0.224, 0.225, 0.218, 0.224, 0.224], lpips: [0.413, 0.284, 0.278, 0.273, 0.282, 0.254] },
  { id: "GS", label: "GSNorm", dists: [0.294, 0.198, 0.196, 0.19, 0.197, 0.217], lpips: [0.367, 0.245, 0.237, 0.232, 0.241, 0.229] },
]

// Paper, Table 1: RGB-only (no pose) rows for SplatAnything and the same
// WorldMirror 2.0 base with its own Gaussian head (Mirror2-GS).
export const DATASETS = ["ScanNet", "NRGBD", "DL3DV", "Tanks & Temples", "Mip-NeRF 360", "ETH3D", "DTU"] as const

export const TABLE1 = {
  ours: { dists: [0.184, 0.195, 0.221, 0.252, 0.233, 0.147, 0.229], lpips: [0.207, 0.183, 0.156, 0.299, 0.463, 0.049, 0.483] },
  mirror2: { dists: [0.193, 0.235, 0.246, 0.306, 0.283, 0.205, 0.347], lpips: [0.222, 0.237, 0.188, 0.351, 0.528, 0.07, 0.617] },
}
