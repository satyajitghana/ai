// Per-layer numbers for Qwen3-0.6B, read from public/neuron-lab/qwen3-0.6b/ (meta.json and layers/L*.json),
// which scripts/neuron-lab/ computes on a fixed corpus: 69,596 tokens of English Wikipedia text plus French,
// Spanish and German Wikipedia (WikiText-103 train chunks and wikimedia/wikipedia 20231101).
//   RES_NORM[L]    median length of the residual stream leaving layer L, over tokens at positions >= 1
//   COL_MEDIAN[L]  median length of a neuron's down_proj column in layer L (3,072 neurons)
//   PEAK_MEDIAN[L] median over the layer's neurons of their largest absolute activation on that corpus
//   PEAK_MAX[L]    the largest absolute activation any neuron of the layer reached
export const LAYERS = 28
export const NEURONS = 3072
export const RES_NORM: number[] = [7.83, 10.36, 12.21, 15.13, 17.25, 20.53, 22.32, 24.22, 26.0, 29.97, 36.67, 45.01, 47.36, 51.04, 53.29, 59.13, 75.99, 94.7, 116.2, 144.87, 185.35, 235.55, 291.88, 350.29, 438.14, 525.48, 604.29, 584.04]
export const COL_MEDIAN: number[] = [0.847, 0.721, 0.765, 0.779, 0.779, 0.833, 0.811, 0.796, 0.809, 0.775, 0.739, 0.772, 0.772, 0.746, 0.735, 0.734, 0.748, 0.75, 0.782, 0.835, 0.9, 0.979, 1.033, 1.062, 1.08, 1.075, 1.033, 0.835]
export const PEAK_MEDIAN: number[] = [1.577, 2.641, 3.575, 5.096, 5.005, 4.191, 4.504, 4.748, 4.632, 4.479, 4.464, 4.168, 3.973, 4.403, 4.571, 5.184, 6.861, 9.242, 11.329, 14.602, 18.542, 24.038, 28.765, 35.927, 38.599, 41.019, 48.91, 62.529]
export const PEAK_MAX: number[] = [7.6, 23.1, 3336.4, 24.2, 25.0, 19.0, 39.0, 88.2, 29.8, 27.7, 93.5, 46.0, 23.1, 34.1, 63.2, 38.8, 38.4, 82.5, 83.3, 101.6, 138.7, 197.7, 247.7, 281.5, 270.5, 272.0, 746.8, 1447.1]

// Engine facts (Qwen3-0.6B config and the engine's own layout): 28 layers, 8 key/value heads of 128, f32 KV.
export const KV_BYTES_PER_TOKEN = 28 * 2 * 8 * 128 * 4 // 229,376 per sequence
export const DOWNLOAD_MB = 651 // Qwen3-0.6B-Q8_0.gguf (639.4 MB) + tokenizer.json (11.4 MB)
export const WEIGHTS_MB = 680 // engine's own figure for the unpacked tensors held in memory
