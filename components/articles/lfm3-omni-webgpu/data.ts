// Every number here is read from a file, not typed from a press release:
// params from the safetensors headers of LiquidAI/LFM3-Omni-2B (and its
// audio_tokenizer/), bytes from the GGUF tensor tables of
// LiquidAI/LFM3-Omni-2B-GGUF (Q4_K_M text model + Q8_0 mmproj, the pair the
// Space loads by default), shapes from config.json.

export const MB = 1_000_000

export type Part = {
  id: string
  label: string
  params: number
  bytes: number // as the Space loads it: Q4_K_M text model, Q8_0 mmproj
  fmt: string
  file: "LFM3-Omni-2B-Q4_K_M.gguf" | "mmproj-LFM3-Omni-2B-Q8_0.gguf"
}

export const PARTS: Part[] = [
  { id: "blk", label: "backbone blocks (24 layers)", params: 1_466_657_600, bytes: 876_340_480, fmt: "Q4_K + Q6_K", file: "LFM3-Omni-2B-Q4_K_M.gguf" },
  { id: "embd", label: "token embedding / LM head (tied)", params: 262_144_000, bytes: 215_040_000, fmt: "Q6_K", file: "LFM3-Omni-2B-Q4_K_M.gguf" },
  { id: "aenc", label: "speech encoder", params: 109_505_344, bytes: 116_911_360, fmt: "Q8_0", file: "mmproj-LFM3-Omni-2B-Q8_0.gguf" },
  { id: "depth", label: "depth decoder + code embeddings", params: 133_468_352, bytes: 141_906_944, fmt: "Q8_0", file: "mmproj-LFM3-Omni-2B-Q8_0.gguf" },
  { id: "codec", label: "codec decoder", params: 36_377_858, bytes: 38_820_680, fmt: "Q8_0", file: "mmproj-LFM3-Omni-2B-Q8_0.gguf" },
  { id: "vis", label: "vision tower", params: 164_206_336, bytes: 176_249_856, fmt: "Q8_0", file: "mmproj-LFM3-Omni-2B-Q8_0.gguf" },
  { id: "proj", label: "connectors", params: 30_946_816, bytes: 32_921_600, fmt: "Q8_0", file: "mmproj-LFM3-Omni-2B-Q8_0.gguf" },
]

export const part = (id: string) => PARTS.find((p) => p.id === id)!

// Rates, from config.json / feature extractor / codec config.
export const IN_POS_PER_S = 12.5 // 16 kHz, hop 160 => 100 mel frames/s, stride 8
export const OUT_FRAMES_PER_S = 12.5 // 24 kHz / 1920 samples per frame
export const TEXT_PER_S_INTERLEAVED = 6.25 // 6 text tokens per 12 audio frames
export const NUM_CODEBOOKS = 12

// KV geometry from config.json text_config: 24 layers = 13 conv + 6 full + 5 sliding.
export const FULL_LAYERS = 6
export const RING_LAYERS = 5
export const CONV_LAYERS = 13
export const KV_HEADS = 4
export const HEAD_DIM = 128
export const kvBytesPerPos = (dtypeBytes: number) => FULL_LAYERS * 2 * KV_HEADS * HEAD_DIM * dtypeBytes // 12,288 at f16

export function fmtBytes(b: number) {
  if (b >= 1e9) return (b / 1e9).toFixed(2) + " GB"
  if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB"
  if (b >= 1e3) return (b / 1e3).toFixed(1) + " KB"
  return Math.round(b) + " B"
}
