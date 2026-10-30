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

// ---- the bridges axis on Qwen3-0.6B (scripts/neuron-lab/data_discover.py, output scr/disc/bridges.json) ----
// 16 texts about bridges and landmarks (A) against 30 other texts (B); contrast d' over all 86,016 neurons at token
// positions >= 1; candidates and controls drawn from layers 8..26; greedy decoding. "lift" is the change in bridge
// words per 100 words against the unsteered model; a neuron "works" at a dose if lift >= 3, it beats the best random
// control at that dose and perplexity stays within 3x the baseline (21.5).
export const BRIDGES = {
  nA: 16,
  nB: 30,
  neurons: 86016,
  replicatedOfTop40: 6,
  randomMeanAbsD: 0.16,
  randomP99AbsD: 0.59,
  maxAbsD: 1.2,
  stage1Candidates: 32,
  stage1ControlBestLift: 0.95,
  stage1CandidateBestLifts: [1.7, 1.2, 0.0, 0.0, 0.0, 0.0],
  baselinePpl: 21.5,
  pairsWorking: 0,
}
export const DOSES = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5]
export const CANDIDATES: { layer: number; neuron: number; lift: number[]; ppl: number[] }[] = [{"layer": 23, "neuron": 1505, "lift": [0.0, 0.0, 0.0, 0.0, 2.6, 6.7], "ppl": [21.7, 22.2, 22.9, 24.0, 27.1, 38.0]}, {"layer": 20, "neuron": 157, "lift": [0.0, 0.6, 0.6, 0.6, 0.6, 0.0], "ppl": [21.4, 21.5, 21.9, 22.6, 24.7, 32.6]}, {"layer": 20, "neuron": 1969, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.5, 21.9, 22.6, 23.8, 27.3, 39.5]}, {"layer": 22, "neuron": 842, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.4, 21.5, 21.8, 22.4, 25.8, 39.6]}, {"layer": 26, "neuron": 239, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [22.0, 23.1, 26.2, 31.3, 33.7, 40.0]}, {"layer": 24, "neuron": 1480, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.1, 21.1, 21.3, 21.9, 23.9, 32.5]}]
export const CONTROLS: { layer: number; neuron: number; lift: number[]; ppl: number[] }[] = [{"layer": 8, "neuron": 3071, "lift": [0.6, 0.6, 0.6, 0.6, 0.0, 0.0], "ppl": [22.0, 22.7, 23.7, 24.6, 26.7, 37.3]}, {"layer": 9, "neuron": 3053, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [22.0, 22.7, 23.7, 24.8, 28.1, 40.5]}, {"layer": 24, "neuron": 40, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.3, 21.3, 21.7, 22.3, 24.6, 33.5]}, {"layer": 22, "neuron": 1203, "lift": [0.0, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.4, 21.6, 22.0, 22.6, 24.5, 31.7]}, {"layer": 8, "neuron": 65, "lift": [0.0, 0.0, 0.0, 0.0, 0.6, 0.0], "ppl": [20.8, 20.6, 21.0, 21.7, 25.1, 58.9]}, {"layer": 22, "neuron": 1051, "lift": [0.6, 0.0, 0.0, 0.0, 0.0, 0.0], "ppl": [21.9, 22.5, 23.3, 24.5, 28.0, 47.6]}]
export const BRIDGE_SAMPLES: { prompt: string; baseline: string; steered: string }[] = [{"prompt": "The best way to learn a new skill is", "baseline": "to practice it. But what if you have to practice it in a different way? What does that mean? What are the benefits of practicing in a different way? What are the risks of", "steered": "to practice it consistently. This is because the more you practice, the more you can control the outcomes of the skill. However, the problem with the method is that it is"}, {"prompt": "Once upon a time, there was", "baseline": "a man who lived in a village called Elan. He had a lot of problems with his family, and he was very poor. He was also very lonely. He had no money to buy food", "steered": "a bridge that was very old and it was very tall. The bridge was built by the people of the kingdom of Eldorlan. The bridge was built with the help of the people of the ki"}]
