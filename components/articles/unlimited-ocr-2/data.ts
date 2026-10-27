// Numbers behind the Unlimited-OCR-2 widgets. Where each one comes from:
//   MEASURED from baidu/Unlimited-OCR-2's safetensors headers (HTTP range requests, no weights downloaded): PARAMS.
//   READ from config.json: block 32, local 4 blocks (= 128 tokens), remote top-k 12, 273 image tokens a page, 12 layers,
//   10 heads x 128, hidden 1280.
//   OUR RE-DERIVATION (sr_swa_sim.py in the article): the read-set counts in ROWS and the NumPy timings in BENCH.
//   A re-implementation of the pattern from the published code, not Baidu's kernel and not a model run.

export const BLOCK = 32
export const LOCAL_BLOCKS = 4
export const LOCAL = BLOCK * LOCAL_BLOCKS
export const REMOTE_CAP = 12
export const PER_PAGE = 273
export const LAYERS = 12
export const HIDDEN = 1280
export const KV_BYTES_PER_TOKEN = LAYERS * 2 * HIDDEN * 2 // bf16 K and V, 10 heads x 128

export const PARAMS: { id: string; label: string; n: number; active: number; note: string }[] = [
  { id: "routed", label: "Routed experts", n: 2_422_210_560, active: 2_422_210_560 * (6 / 64), note: "64 per layer, 6 used per token, layers 1-11" },
  { id: "clip", label: "CLIP encoder", n: 303_177_985, active: 0, note: "runs on the page image, not per decoded token" },
  { id: "lmhead", label: "lm_head", n: 165_478_400, active: 165_478_400, note: "129,280 x 1,280" },
  { id: "embed", label: "Embedding table", n: 165_478_400, active: 0, note: "a lookup, not a matmul" },
  { id: "sam", label: "SAM encoder", n: 95_569_152, active: 0, note: "page image, prefill only" },
  { id: "qkvo", label: "q/k/v/o", n: 78_643_200, active: 78_643_200, note: "12 layers x 4 x 1,280 x 1,280" },
  { id: "shared", label: "Shared experts", n: 75_694_080, active: 75_694_080, note: "2 per layer, always on" },
  { id: "dense", label: "Dense MLP, layer 0", n: 26_296_320, active: 26_296_320, note: "the one non-MoE layer" },
  { id: "router", label: "Router (dash_router)", n: 3_936_768, active: 3_936_768, note: "128-d q/k projections, 12 layers" },
  { id: "indexer", label: "Indexer", n: 3_935_232, active: 0, note: "rope and page ids only on this path" },
  { id: "proj", label: "Projector", n: 2_622_720, active: 0, note: "2,048 to 1,280, once per image token" },
  { id: "gates", label: "Expert gates + norms", n: 901_120 + 30_720 + 3_840, active: 901_120 + 30_720 + 1_280, note: "64 x 1,280 per MoE layer" },
]

// Our re-derivation: one decode query in the middle of the last page's output, 1,024 generated tokens a page.
export const ROWS = [
  { pages: 1, full: 793, rswa: 401, sr: 416, cand: 9 },
  { pages: 2, full: 2091, rswa: 674, sr: 448, cand: 10 },
  { pages: 5, full: 5985, rswa: 1493, sr: 416, cand: 9 },
  { pages: 10, full: 12475, rswa: 2858, sr: 416, cand: 9 },
  { pages: 20, full: 25455, rswa: 5588, sr: 448, cand: 10 },
  { pages: 50, full: 64395, rswa: 13778, sr: 448, cand: 10 },
  { pages: 100, full: 129295, rswa: 27428, sr: 448, cand: 10 },
  { pages: 200, full: 259095, rswa: 54728, sr: 416, cand: 9 },
  { pages: 300, full: 388895, rswa: 82028, sr: 416, cand: 9 },
]

// One layer, one decode step, 10 heads x 128, float32 NumPy on one CPU thread (median of 15), gathered 448 keys.
export const BENCH = [
  { s: 1024, dense: 1.75, sparse: 4.25 },
  { s: 4096, dense: 8.28, sparse: 3.15 },
  { s: 16384, dense: 36.6, sparse: 4.64 },
  { s: 32768, dense: 63.6, sparse: 3.44 },
]

export const fmt = (n: number): string => n.toLocaleString("en-US")
