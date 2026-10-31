// Every number below is measured (weights) or copied from the paper's own tables (benchmarks, REPORTED).
export type Group = "language" | "vision" | "mtp"
export type WeightRow = { id: string; label: string; group: Group; shape: string; post: number; xiaomi: number; xiaomiPost: number }
// Relative L2 distances between sampled tensors (bf16, read over HTTP range requests):
// post = Qwen3.5-0.8B vs Qwen3.5-0.8B-Base, xiaomi = Xiaomi-OCR-0 vs Base, xiaomiPost = Xiaomi-OCR-0 vs Qwen3.5-0.8B.
export const WEIGHTS: WeightRow[] = [
  {
    "id": "model.language_model.layers.0.mlp.down_proj.weight",
    "label": "L0.mlp.down_proj",
    "group": "language",
    "shape": "1024x3584",
    "post": 0.0679,
    "xiaomi": 0.612,
    "xiaomiPost": 0.6161
  },
  {
    "id": "model.language_model.layers.3.self_attn.q_proj.weight",
    "label": "L3.attn.q_proj",
    "group": "language",
    "shape": "4096x1024",
    "post": 0.0416,
    "xiaomi": 0.3873,
    "xiaomiPost": 0.3888
  },
  {
    "id": "model.language_model.layers.12.mlp.gate_proj.weight",
    "label": "L12.mlp.gate_proj",
    "group": "language",
    "shape": "3584x1024",
    "post": 0.0919,
    "xiaomi": 0.5208,
    "xiaomiPost": 0.5279
  },
  {
    "id": "model.language_model.layers.12.linear_attn.in_proj_qkv.weight",
    "label": "L12.dn.in_proj_qkv",
    "group": "language",
    "shape": "6144x1024",
    "post": 0.0555,
    "xiaomi": 0.4024,
    "xiaomiPost": 0.4053
  },
  {
    "id": "model.language_model.layers.23.mlp.down_proj.weight",
    "label": "L23.mlp.down_proj",
    "group": "language",
    "shape": "1024x3584",
    "post": 0.0712,
    "xiaomi": 0.7923,
    "xiaomiPost": 0.7953
  },
  {
    "id": "model.language_model.layers.23.mlp.up_proj.weight",
    "label": "L23.mlp.up_proj",
    "group": "language",
    "shape": "3584x1024",
    "post": 0.0672,
    "xiaomi": 0.6565,
    "xiaomiPost": 0.6593
  },
  {
    "id": "model.visual.blocks.0.attn.qkv.weight",
    "label": "vis.blk 0.attn.qkv",
    "group": "vision",
    "shape": "2304x768",
    "post": 0.0,
    "xiaomi": 0.3052,
    "xiaomiPost": 0.3052
  },
  {
    "id": "model.visual.blocks.6.mlp.linear_fc1.weight",
    "label": "vis.blk 6.mlp.linear_fc1",
    "group": "vision",
    "shape": "3072x768",
    "post": 0.0,
    "xiaomi": 0.3665,
    "xiaomiPost": 0.3665
  },
  {
    "id": "model.visual.blocks.11.mlp.linear_fc2.weight",
    "label": "vis.blk 11.mlp.linear_fc2",
    "group": "vision",
    "shape": "768x3072",
    "post": 0.0,
    "xiaomi": 0.3965,
    "xiaomiPost": 0.3965
  },
  {
    "id": "model.visual.merger.linear_fc1.weight",
    "label": "vis.merger.linear_fc1",
    "group": "vision",
    "shape": "3072x3072",
    "post": 0.0642,
    "xiaomi": 0.4319,
    "xiaomiPost": 0.4363
  },
  {
    "id": "model.visual.merger.linear_fc2.weight",
    "label": "vis.merger.linear_fc2",
    "group": "vision",
    "shape": "1024x3072",
    "post": 0.0657,
    "xiaomi": 0.4316,
    "xiaomiPost": 0.4368
  },
  {
    "id": "mtp.fc.weight",
    "label": "mtp.fc",
    "group": "mtp",
    "shape": "1024x2048",
    "post": 0.18,
    "xiaomi": 0.9042,
    "xiaomiPost": 0.922
  },
  {
    "id": "mtp.layers.0.mlp.down_proj.weight",
    "label": "mtp.L0.mlp.down_proj",
    "group": "mtp",
    "shape": "1024x3584",
    "post": 0.1747,
    "xiaomi": 0.8214,
    "xiaomiPost": 0.8217
  }
]
export const PARAM_GROUPS = [
  { id: "embed", label: "token embeddings (tied)", n: 254279680, note: "248,320 x 1,024; 600 of 600 sampled rows differ from Base" },
  { id: "language", label: "24 language layers", n: 498113344, note: "18 Gated DeltaNet + 6 full-attention layers, SwiGLU MLP 3,584" },
  { id: "vision", label: "vision tower", n: 100592896, note: "12 blocks, width 768, patch 16, 2x2 merger to 1,024" },
  { id: "mtp", label: "multi-token-prediction head", n: 20452864, note: "kept and trained during CPT, per the paper" },
] as const
export const PARAM_TOTAL = 873438784
export type BenchRow = { m: string; size: string; b: number; overall: number; ours?: boolean }
export const BENCH: Record<"omni16" | "real5" | "wild", { name: string; rows: BenchRow[]; counted: number; rank: number; rankUnder1B: number; underCount: number }> = {
  omni16: { name: "OmniDocBench v1.6", counted: 34, rank: 2, rankUnder1B: 1, underCount: 8, rows: [
    {
        "m": "TeleOCR",
        "size": "1.2B",
        "b": 1.2,
        "overall": 96.87
    },
    {
        "m": "Ours",
        "size": "0.8B",
        "b": 0.8,
        "overall": 96.83,
        "ours": true
    },
    {
        "m": "OvisOCR2",
        "size": "0.8B",
        "b": 0.8,
        "overall": 96.58
    },
    {
        "m": "PaddleOCR-VL-1.6",
        "size": "0.9B",
        "b": 0.9,
        "overall": 96.33
    },
    {
        "m": "MinerU2.5-Pro",
        "size": "1.2B",
        "b": 1.2,
        "overall": 95.75
    },
    {
        "m": "GLM-OCR",
        "size": "0.9B",
        "b": 0.9,
        "overall": 95.22
    },
    {
        "m": "PaddleOCR-VL-1.5",
        "size": "0.9B",
        "b": 0.9,
        "overall": 94.93
    },
    {
        "m": "HunyuanOCR-1.5",
        "size": "1B",
        "b": 1.0,
        "overall": 94.74
    },
    {
        "m": "PaddleOCR-VL",
        "size": "0.9B",
        "b": 0.9,
        "overall": 94.18
    },
    {
        "m": "OpenDoc-0.1B",
        "size": "0.1B",
        "b": 0.1,
        "overall": 90.67
    },
    {
        "m": "Dolphin-1.5",
        "size": "0.3B",
        "b": 0.3,
        "overall": 86.52
    }
] },
  real5: { name: "Real5-OmniDocBench", counted: 30, rank: 1, rankUnder1B: 1, underCount: 11, rows: [
    {
        "m": "Ours",
        "size": "0.8B",
        "b": 0.8,
        "overall": 95.24,
        "ours": true
    },
    {
        "m": "PaddleOCR-VL-1.6",
        "size": "0.9B",
        "b": 0.9,
        "overall": 93.19
    },
    {
        "m": "OvisOCR2",
        "size": "0.8B",
        "b": 0.8,
        "overall": 92.29
    },
    {
        "m": "PaddleOCR-VL-1.5",
        "size": "0.9B",
        "b": 0.9,
        "overall": 92.05
    },
    {
        "m": "GLM-OCR",
        "size": "0.9B",
        "b": 0.9,
        "overall": 90.32
    },
    {
        "m": "MonkeyOCRv2-B-Parsing",
        "size": "0.7B",
        "b": 0.7,
        "overall": 89.22
    },
    {
        "m": "MinerU2.5-Pro",
        "size": "1.2B",
        "b": 1.2,
        "overall": 88.94
    },
    {
        "m": "MonkeyOCRv2-S-Parsing",
        "size": "0.6B",
        "b": 0.6,
        "overall": 87.9
    },
    {
        "m": "MinerU2.5",
        "size": "1.2B",
        "b": 1.2,
        "overall": 85.61
    },
    {
        "m": "PaddleOCR-VL",
        "size": "0.9B",
        "b": 0.9,
        "overall": 85.54
    },
    {
        "m": "MinerU2-VLM",
        "size": "0.9B",
        "b": 0.9,
        "overall": 76.95
    },
    {
        "m": "Dolphin",
        "size": "322M",
        "b": 0.322,
        "overall": 61.78
    },
    {
        "m": "Dolphin-1.5",
        "size": "0.3B",
        "b": 0.3,
        "overall": 61.48
    }
] },
  wild: { name: "Wild-OmniDocBench", counted: 10, rank: 2, rankUnder1B: 1, underCount: 5, rows: [
    {
        "m": "TeleOCR",
        "size": "1.2B",
        "b": 1.2,
        "overall": 88.53
    },
    {
        "m": "Ours",
        "size": "0.8B",
        "b": 0.8,
        "overall": 87.94,
        "ours": true
    },
    {
        "m": "OvisOCR2",
        "size": "0.8B",
        "b": 0.8,
        "overall": 87.91
    },
    {
        "m": "PaddleOCR-VL-1.6",
        "size": "0.9B",
        "b": 0.9,
        "overall": 87.36
    },
    {
        "m": "MinerU2.5-Pro",
        "size": "1.2B",
        "b": 1.2,
        "overall": 87.33
    },
    {
        "m": "GLM-OCR",
        "size": "0.9B",
        "b": 0.9,
        "overall": 85.08
    },
    {
        "m": "PaddleOCR-VL-1.5",
        "size": "0.9B",
        "b": 0.9,
        "overall": 84.64
    },
    {
        "m": "HunyuanOCR-1.5",
        "size": "1B",
        "b": 1.0,
        "overall": 77.62
    }
] },
}
