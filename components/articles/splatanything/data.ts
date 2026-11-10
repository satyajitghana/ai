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

// ---------------------------------------------------------------------------
// Second round of toy runs (deep-dive, 10 November). Same numpy port, new
// ray caster (toy.py / sky.py / sweep.py), numpy 2.5.3, Python 3.13, CPU.
//
// SKY: eight 756 px, 60-degree views per capture, every 4th ray. Sky pixels get
// a large finite depth (any value past the median gives the same median). For
// each camera pitch: the sky share of pixels, the GSNorm factor with sky masked
// out of the statistic (--sky_seg) over the factor with sky inside it (the
// release default), and the median spacing of the non-sky pixels after the
// default normalization, as a multiple of the target 1/756.

export type SkyRow = { pitch: number; sky: number; ratio: number; nonsky: number }

export const SKY: Record<"street" | "aerial", SkyRow[]> = {
  street: [
    { pitch: -20, sky: 0.0134, ratio: 1.017, nonsky: 0.983 },
    { pitch: -10, sky: 0.0457, ratio: 1.14, nonsky: 0.877 },
    { pitch: -5, sky: 0.0681, ratio: 1.061, nonsky: 0.943 },
    { pitch: 0, sky: 0.0946, ratio: 1.08, nonsky: 0.926 },
    { pitch: 5, sky: 0.1244, ratio: 1.107, nonsky: 0.903 },
    { pitch: 10, sky: 0.1578, ratio: 1.142, nonsky: 0.876 },
    { pitch: 15, sky: 0.1943, ratio: 1.179, nonsky: 0.848 },
    { pitch: 20, sky: 0.234, ratio: 1.218, nonsky: 0.821 },
    { pitch: 25, sky: 0.2772, ratio: 1.29, nonsky: 0.775 },
  ],
  aerial: [
    { pitch: -60, sky: 0, ratio: 1, nonsky: 1 },
    { pitch: -45, sky: 0, ratio: 1, nonsky: 1 },
    { pitch: -30, sky: 0.0428, ratio: 1.043, nonsky: 0.959 },
    { pitch: -20, sky: 0.2228, ratio: 1.212, nonsky: 0.825 },
    { pitch: -15, sky: 0.303, ratio: 1.475, nonsky: 0.678 },
    { pitch: -10, sky: 0.3822, ratio: 2.044, nonsky: 0.489 },
    { pitch: -5, sky: 0.4571, ratio: 3.508, nonsky: 0.285 },
  ],
}

/** The Space's voxel, 0.0018, in units of the target spacing 1/756. */
export const VOXEL_IN_SPACINGS = 1.36

// MERGE: full-resolution captures (every ray), port of merge_voxels at the
// Space's voxel 0.0018 in GSNorm space. `raw` = Gaussians before the merge,
// `gs` = after. For the resolution sweep (4 views, 60 degrees) `fixed` is the
// count with a voxel fixed in metres at its 756 px size, which is what a
// constant voxel in RDNorm space amounts to for one scene. The view sweep
// keeps the camera span fixed and adds views inside it (756 px, 60 degrees).

export type MergeRow = { x: number; raw: number; gs: number; fixed?: number }

export const MERGE: Record<"object" | "room" | "street", { res: MergeRow[]; views: MergeRow[] }> = {
  object: {
    res: [
      { x: 504, raw: 735358, gs: 362958, fixed: 499742 },
      { x: 630, raw: 1148980, gs: 567038, fixed: 659576 },
      { x: 756, raw: 1654532, gs: 815822, fixed: 815822 },
      { x: 896, raw: 2324060, gs: 1146794, fixed: 995830 },
      { x: 1022, raw: 3023666, gs: 1491112, fixed: 1166490 },
    ],
    views: [
      { x: 1, raw: 413883, gs: 305959 },
      { x: 2, raw: 827766, gs: 550608 },
      { x: 4, raw: 1654532, gs: 815822 },
      { x: 8, raw: 3307780, gs: 1228218 },
      { x: 16, raw: 6615436, gs: 1893602 },
    ],
  },
  room: {
    res: [
      { x: 504, raw: 1016064, gs: 750148, fixed: 1013024 },
      { x: 630, raw: 1587600, gs: 1171612, fixed: 1354904 },
      { x: 756, raw: 2286144, gs: 1687588, fixed: 1687588 },
      { x: 896, raw: 3211264, gs: 2370068, fixed: 2092060 },
      { x: 1022, raw: 4177936, gs: 3084140, fixed: 2476816 },
    ],
    views: [
      { x: 1, raw: 571536, gs: 311526 },
      { x: 2, raw: 1143072, gs: 623052 },
      { x: 4, raw: 2286144, gs: 1687588 },
      { x: 8, raw: 4572288, gs: 2501076 },
      { x: 16, raw: 9144576, gs: 3486138 },
    ],
  },
  street: {
    res: [
      { x: 504, raw: 947435, gs: 446400, fixed: 581371 },
      { x: 630, raw: 1480356, gs: 700020, fixed: 799742 },
      { x: 756, raw: 2131732, gs: 1004665, fixed: 1004665 },
      { x: 896, raw: 2994358, gs: 1415711, fixed: 1231165 },
      { x: 1022, raw: 3895702, gs: 1842980, fixed: 1427960 },
    ],
    views: [
      { x: 1, raw: 532939, gs: 330512 },
      { x: 2, raw: 1065903, gs: 581646 },
      { x: 4, raw: 2131732, gs: 1004665 },
      { x: 8, raw: 4263285, gs: 1733361 },
      { x: 16, raw: 8526043, gs: 3035969 },
    ],
  },
}
