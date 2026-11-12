// Per-step gate values of the released nvidia/dvlt checkpoint, channel means over 768 channels.
// MEASURED by me: the six gate MLPs (IntervalDepthScaling: Linear 128->64, SiLU, Linear 64->2304, +1) were
// range-fetched from model.safetensors and evaluated in NumPy on the code's own time grid,
// t_i = linspace(0, 1, K)[i], t_next = t_(i+1), last step (1, 1). attn = s_attn, mlp = s_mlp, out = s_out.
export type GateSeries = { attn: number[]; mlp: number[]; out: number[] }
export const GATES: Record<8 | 12 | 16, { frame: GateSeries; global: GateSeries }> = {
  8: {
    frame: {
      attn: [0.635, 0.649, 0.663, 0.675, 0.685, 0.693, 0.698, 0.7],
      mlp: [0.775, 0.78, 0.783, 0.785, 0.786, 0.785, 0.782, 0.777],
      out: [0.732, 0.773, 0.81, 0.843, 0.871, 0.894, 0.914, 0.927],
    },
    global: {
      attn: [0.767, 0.747, 0.73, 0.714, 0.699, 0.685, 0.673, 0.666],
      mlp: [0.886, 0.886, 0.885, 0.884, 0.882, 0.88, 0.878, 0.873],
      out: [0.862, 0.863, 0.864, 0.864, 0.865, 0.866, 0.867, 0.869],
    },
  },
  12: {
    frame: {
      attn: [0.634, 0.643, 0.652, 0.66, 0.669, 0.676, 0.683, 0.688, 0.693, 0.696, 0.698, 0.7],
      mlp: [0.774, 0.777, 0.779, 0.782, 0.783, 0.785, 0.785, 0.785, 0.784, 0.783, 0.78, 0.777],
      out: [0.728, 0.754, 0.779, 0.803, 0.825, 0.845, 0.863, 0.88, 0.894, 0.907, 0.919, 0.927],
    },
    global: {
      attn: [0.769, 0.756, 0.744, 0.733, 0.722, 0.712, 0.703, 0.694, 0.686, 0.678, 0.671, 0.666],
      mlp: [0.885, 0.885, 0.885, 0.884, 0.883, 0.882, 0.881, 0.88, 0.879, 0.878, 0.876, 0.873],
      out: [0.863, 0.863, 0.864, 0.864, 0.865, 0.865, 0.866, 0.866, 0.867, 0.867, 0.868, 0.869],
    },
  },
  16: {
    frame: {
      attn: [0.633, 0.64, 0.646, 0.653, 0.659, 0.665, 0.671, 0.677, 0.682, 0.686, 0.69, 0.693, 0.696, 0.697, 0.699, 0.7],
      mlp: [0.774, 0.776, 0.777, 0.779, 0.781, 0.782, 0.784, 0.784, 0.785, 0.785, 0.785, 0.784, 0.783, 0.781, 0.779, 0.777],
      out: [0.726, 0.745, 0.764, 0.782, 0.8, 0.816, 0.832, 0.846, 0.86, 0.872, 0.884, 0.894, 0.904, 0.913, 0.921, 0.927],
    },
    global: {
      attn: [0.769, 0.76, 0.751, 0.743, 0.735, 0.727, 0.719, 0.712, 0.705, 0.698, 0.692, 0.686, 0.68, 0.674, 0.669, 0.666],
      mlp: [0.885, 0.884, 0.884, 0.884, 0.884, 0.883, 0.882, 0.882, 0.881, 0.88, 0.879, 0.878, 0.877, 0.876, 0.875, 0.873],
      out: [0.863, 0.863, 0.864, 0.864, 0.864, 0.865, 0.865, 0.865, 0.866, 0.866, 0.867, 0.867, 0.867, 0.868, 0.868, 0.869],
    },
  },
}

// Figure 8 of the paper (arXiv 2605.30215), values read from the SVG's path coordinates, averaged over
// DTU, ETH3D, 7-Scenes, ScanNet++ and nuScenes. "native": run K steps on a K-step time grid.
// "exit": decode step k of one 16-step pass.
export const NATIVE: Record<number, { auc3: number; auc30: number; rel: number }> = {
  8: { auc3: 0.431, auc30: 0.886, rel: 0.0366 },
  10: { auc3: 0.508, auc30: 0.906, rel: 0.0328 },
  12: { auc3: 0.546, auc30: 0.913, rel: 0.0313 },
  14: { auc3: 0.562, auc30: 0.917, rel: 0.0308 },
  16: { auc3: 0.567, auc30: 0.918, rel: 0.0306 },
}
export const EXIT: Record<number, { auc3: number; auc30: number; rel: number }> = {
  8: { auc3: 0.309, auc30: 0.871, rel: 0.0404 },
  10: { auc3: 0.42, auc30: 0.895, rel: 0.036 },
  12: { auc3: 0.503, auc30: 0.908, rel: 0.0333 },
  14: { auc3: 0.55, auc30: 0.915, rel: 0.0315 },
  16: { auc3: 0.567, auc30: 0.918, rel: 0.0306 },
}

// Baselines: TFLOPs and params from the paper's Table 3 (24 views, A100); the three averages are my
// means over the five benchmarks of Tables 1 (Rel. L2) and 2 (AUC@3, AUC@30).
export const BASELINES: { name: string; params: number; tf: number; auc3: number; auc30: number; rel: number }[] = [
  { name: "DA3-L", params: 356, tf: 71.4, auc3: 0.277, auc30: 0.798, rel: 0.0904 },
  { name: "VGGT-Ω-1B", params: 1144, tf: 99.8, auc3: 0.47, auc30: 0.907, rel: 0.0318 },
  { name: "MapAnything", params: 1228, tf: 148.4, auc3: 0.344, auc30: 0.833, rel: 0.0786 },
  { name: "Pi3", params: 959, tf: 153.8, auc3: 0.452, auc30: 0.886, rel: 0.0334 },
  { name: "DA3-G", params: 1201, tf: 178.7, auc3: 0.413, auc30: 0.847, rel: 0.0594 },
  { name: "VGGT", params: 1257, tf: 190.0, auc3: 0.395, auc30: 0.84, rel: 0.044 },
]

// My FLOP model of one looped step (2 FLOPs per multiply-add, square 504 px input: 1,296 patches + 5 tokens
// per view, width 768, MLP 3072). Linear layers 2 x 2 x 12 x 768^2 per token; frame attention 4 x 1,301 x 768
// per token; global attention 4 x (views x 1,301) x 768 per token. At 24 views: 0.88 + 0.12 + 3.00 TFLOPs.
export const TOK = 1301
export const D = 768
export const PAPER_TF_16 = 75.9 // Table 3, K = 16, 24 views
export function loopTF(views: number) {
  const n = views * TOK
  const linear = (2 * 2 * 12 * D * D * n) / 1e12
  const frame = (4 * TOK * D * n) / 1e12
  const global = (4 * n * D * n) / 1e12
  return { linear, frame, global, total: linear + frame + global }
}
