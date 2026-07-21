import { z } from "zod"

// data/models.ts — a curated, DATED snapshot of frontier + notable LLMs for the
// /models comparison page. A snapshot, not a live feed: leaderboards churn.
// Figures are from Artificial Analysis (current Intelligence Index, price,
// output speed, latency, context) plus provider docs and Epoch's ECI. Any value
// that isn't sourced is `null`, never guessed — the UI renders around missing
// data. Blended price follows AA's 3:1 input:output convention.

export const MODELS_SNAPSHOT_DATE = "2026-07-20"

export type Origin = "US" | "China" | "EU" | "Canada" | "UAE" | "Korea" | "Israel" | "India" | "Other"

export type ModelRecord = {
  name: string
  provider: string
  origin: Origin
  openWeights: boolean
  sizeB: number | null
  intelligence: number | null
  eci: number | null
  priceIn: number | null
  priceOut: number | null
  speedTps: number | null
  latencyS: number | null
  contextK: number | null
  released: string | null
  article?: string
  note?: string
}

export function blendedPrice(m: ModelRecord): number | null {
  if (m.priceIn == null || m.priceOut == null) return null
  return Math.round(((m.priceIn * 3 + m.priceOut) / 4) * 1000) / 1000
}

export const models: ModelRecord[] = [
  { name: "Fable 5", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 60, eci: null, priceIn: 10, priceOut: 50, speedTps: 68, latencyS: 116.24, contextK: 1000, released: "2026-06", note: "AA; Anthropic $10/$50" },
  { name: "GPT-5.6 Sol", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 59, eci: null, priceIn: 5, priceOut: 30, speedTps: 63, latencyS: 142.61, contextK: 1000, released: "2026-07", note: "AA; $5/$30" },
  { name: "Kimi K3", provider: "Moonshot", origin: "China", openWeights: true, sizeB: 2800, intelligence: 57, eci: 155.53, priceIn: 3.0, priceOut: 15.0, speedTps: 62, latencyS: 1.99, contextK: 1000, released: "2026-07", note: "AA (Index 57, $3/$15, 1M ctx, Jul 2026); scaling01 (2.8T, ECI 155.53, open-weight)" },
  { name: "Qwen3.7 Max", provider: "Alibaba", origin: "China", openWeights: false, sizeB: null, intelligence: 56.6, eci: null, priceIn: 2.5, priceOut: 7.5, speedTps: 203.1, latencyS: 2.42, contextK: 1000, released: "2026-05", note: "Index 56.6 (top Chinese, #5 overall), $2.50/$7.50, 203 tps, 1M ctx, closed" },
  { name: "Opus 4.8", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 56, eci: null, priceIn: 5, priceOut: 25, speedTps: 60, latencyS: 30.89, contextK: 1000, released: "2026-05", note: "AA; $5/$25" },
  { name: "GPT-5.5", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 55, eci: null, priceIn: 5, priceOut: 30, speedTps: 81, latencyS: 74.87, contextK: 1050, released: "2026-04", note: "AA; $5/$30" },
  { name: "GPT-5.6 Terra", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 55, eci: null, priceIn: 2.5, priceOut: 15, speedTps: 153, latencyS: 136.65, contextK: 1000, released: "2026-07", note: "AA; $2.50/$15" },
  { name: "MiniMax M3", provider: "MiniMax", origin: "China", openWeights: true, sizeB: 428, intelligence: 55, eci: null, priceIn: 0.3, priceOut: 1.2, speedTps: 96, latencyS: 1.65, contextK: 1000, released: "2026-06", note: "428B/23B active, Index 55 (reasoning), $0.30/$1.20, 1M ctx, open" },
  { name: "Grok 4.5", provider: "xAI", origin: "US", openWeights: false, sizeB: null, intelligence: 54, eci: null, priceIn: 2.0, priceOut: 6.0, speedTps: 69.8, latencyS: 10.27, contextK: 500, released: "2026-07", note: "AA; xAI flagship" },
  { name: "Kimi K2.6", provider: "Moonshot", origin: "China", openWeights: true, sizeB: 1000, intelligence: 54, eci: null, priceIn: 0.6, priceOut: 2.5, speedTps: null, latencyS: null, contextK: 262, released: "2026-04", note: "1T MoE/32B active, Index 54, $0.60/$2.50, 262K ctx, open (modified MIT)" },
  { name: "Opus 4.7", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 54, eci: null, priceIn: 5, priceOut: 25, speedTps: 53, latencyS: 20.46, contextK: 1000, released: "2026-04", note: "AA; $5/$25" },
  { name: "Sonnet 5", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 53, eci: null, priceIn: 3, priceOut: 15, speedTps: 84, latencyS: 157.99, contextK: 1000, released: "2026-06", note: "AA; $3/$15" },
  { name: "GLM-5.2", provider: "Zhipu", origin: "China", openWeights: true, sizeB: 753, intelligence: 51, eci: null, priceIn: 0.93, priceOut: 3.0, speedTps: 168.2, latencyS: null, contextK: 1000, released: "2026-06", note: "753B, Index 51, $0.93/$3.00, 1M ctx, open (MIT)" },
  { name: "GPT-5.6 Luna", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 51, eci: null, priceIn: 1, priceOut: 6, speedTps: 199, latencyS: 78.97, contextK: 1000, released: "2026-07", note: "AA; $1/$6" },
  { name: "Muse Spark 1.1", provider: "Meta", origin: "US", openWeights: false, sizeB: null, intelligence: 51, eci: null, priceIn: 1.25, priceOut: 4.25, speedTps: 123.8, latencyS: 1.27, contextK: 1000, released: "2026-07", note: "AA; Meta flagship (reasoning), proprietary" },
  { name: "Gemini 3.5 Flash", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 50, eci: null, priceIn: 1.5, priceOut: 9, speedTps: 165, latencyS: 20.31, contextK: 1000, released: "2026-05", note: "AA; $1.50/$9" },
  { name: "Sonnet 4.6", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 47, eci: null, priceIn: 3, priceOut: 15, speedTps: 56, latencyS: 84.69, contextK: 1000, released: "2026-02", note: "AA; $3/$15" },
  { name: "Gemini 3.1 Pro", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 46, eci: null, priceIn: 2, priceOut: 12, speedTps: 129, latencyS: 33.44, contextK: 1000, released: "2026-02", note: "AA; $2/$12" },
  { name: "DeepSeek V4 Pro", provider: "DeepSeek", origin: "China", openWeights: true, sizeB: 1600, intelligence: 44, eci: null, priceIn: 0.435, priceOut: 0.87, speedTps: 61.8, latencyS: 1.77, contextK: 1000, released: "2026-04", note: "1.6T/49B active, Index 44, $0.435/$0.87, 1M ctx, open (MIT)" },
  { name: "GPT-5.3 Codex", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 44, eci: null, priceIn: null, priceOut: null, speedTps: 143, latencyS: 62.98, contextK: 400, released: null, note: "AA" },
  { name: "Opus 4.6", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 44, eci: null, priceIn: null, priceOut: null, speedTps: 44, latencyS: 19.49, contextK: 1000, released: "2026-02", note: "AA" },
  { name: "Muse Spark", provider: "Meta", origin: "US", openWeights: false, sizeB: null, intelligence: 43, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 262, released: "2026-04", note: "AA; Meta's first closed model" },
  { name: "Hy3", provider: "Tencent", origin: "China", openWeights: true, sizeB: 295, intelligence: 41, eci: null, priceIn: 0.14, priceOut: 0.56, speedTps: null, latencyS: null, contextK: 256, released: "2026-07", note: "Hunyuan Hy3, 295B/21B active, Index 41, 256K ctx, open (Apache 2.0)" },
  { name: "Gemini 3 Pro", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 40, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 1000, released: null, note: "AA preview" },
  { name: "Grok Build 0.1", provider: "xAI", origin: "US", openWeights: false, sizeB: null, intelligence: 40, eci: null, priceIn: 1.0, priceOut: 2.0, speedTps: 79, latencyS: 0.54, contextK: 256, released: "2026-06", note: "AA; coding model; xAI list price" },
  { name: "Gemini 3 Flash", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 38, eci: null, priceIn: null, priceOut: null, speedTps: 190, latencyS: 7.03, contextK: 1000, released: null, note: "AA" },
  { name: "Grok 4.3", provider: "xAI", origin: "US", openWeights: false, sizeB: null, intelligence: 38, eci: null, priceIn: 1.25, priceOut: 2.5, speedTps: 123.6, latencyS: 28.02, contextK: 1000, released: "2026-04", note: "AA" },
  { name: "Nemotron 3 Ultra 550B A55B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 550, intelligence: 38, eci: null, priceIn: 0.675, priceOut: 2.675, speedTps: 209.2, latencyS: 1.23, contextK: 262, released: "2026-06", note: "AA v4.1; hybrid Mamba-Transformer MoE, 55B active" },
  { name: "Grok 4", provider: "xAI", origin: "US", openWeights: false, sizeB: null, intelligence: 33, eci: null, priceIn: 5.5, priceOut: 27.5, speedTps: null, latencyS: null, contextK: 256, released: "2025-07", note: "AA" },
  { name: "Haiku 4.5", provider: "Anthropic", origin: "US", openWeights: false, sizeB: null, intelligence: 30, eci: null, priceIn: 1, priceOut: 5, speedTps: 105, latencyS: 16.21, contextK: 200, released: "2025-10", note: "AA; $1/$5" },
  { name: "Mistral Medium 3.5", provider: "Mistral", origin: "EU", openWeights: true, sizeB: 128, intelligence: 30, eci: null, priceIn: 1.5, priceOut: 7.5, speedTps: 123.5, latencyS: 2.09, contextK: 256, released: "2026-04", note: "AA; top Mistral (reasoning)" },
  { name: "o3", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 30, eci: null, priceIn: 2, priceOut: 8, speedTps: 159, latencyS: 7.07, contextK: 200, released: null, note: "AA; $2/$8" },
  { name: "Step 3.7 Flash", provider: "StepFun", origin: "China", openWeights: true, sizeB: 196, intelligence: 30, eci: null, priceIn: 0.2, priceOut: 1.15, speedTps: null, latencyS: null, contextK: 262, released: "2026-05", note: "196B/~11B active VLM, Index 30, $0.20/$1.15, 262K ctx, open" },
  { name: "Gemma 4 31B", provider: "Google", origin: "US", openWeights: true, sizeB: 31, intelligence: 29, eci: null, priceIn: 0.03, priceOut: null, speedTps: 35, latencyS: 1.16, contextK: 256, released: "2026-04", note: "AA; open; hosted price" },
  { name: "GPT-5.5 Instant", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 29, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 400, released: "2026-06", note: "AA index/context" },
  { name: "Gemini 2.5 Pro", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 26, eci: null, priceIn: 1.25, priceOut: 10, speedTps: 143, latencyS: 21.49, contextK: 1000, released: null, note: "AA; $1.25/$10" },
  { name: "Gemma 4 26B A4B", provider: "Google", origin: "US", openWeights: true, sizeB: 26, intelligence: 26, eci: null, priceIn: 0.03, priceOut: null, speedTps: 47, latencyS: 1.07, contextK: 256, released: "2026-04", note: "AA; MoE 26B/4B active; open" },
  { name: "Gemini 3.1 Flash-Lite", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 25, eci: null, priceIn: 0.25, priceOut: 1.5, speedTps: 333, latencyS: 5.83, contextK: 1000, released: "2026-05", note: "AA; $0.25/$1.50" },
  { name: "Nemotron 3 Super 120B A12B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 120, intelligence: 25, eci: null, priceIn: 0.25, priceOut: 0.775, speedTps: 191.6, latencyS: 1.37, contextK: 1000, released: "2026-03", note: "AA v4.1; MoE 12.7B active" },
  { name: "gpt-oss-120b", provider: "OpenAI", origin: "US", openWeights: true, sizeB: 120, intelligence: 24, eci: null, priceIn: 0.06, priceOut: null, speedTps: 312, latencyS: 0.85, contextK: 131, released: null, note: "AA; open; hosted price varies" },
  { name: "Command A+", provider: "Cohere", origin: "Canada", openWeights: true, sizeB: 218, intelligence: 23, eci: null, priceIn: 0, priceOut: 0, speedTps: 178.7, latencyS: 0.43, contextK: 192, released: "2026-05", note: "AA; MoE 218B/25B active; Apache 2.0; free" },
  { name: "Gemma 4 12B", provider: "Google", origin: "US", openWeights: true, sizeB: 12, intelligence: 22, eci: null, priceIn: null, priceOut: null, speedTps: 110, latencyS: 2.54, contextK: 256, released: "2026-04", note: "AA; open" },
  { name: "Apriel-1.6-15B-Thinker", provider: "ServiceNow", origin: "US", openWeights: true, sizeB: 15, intelligence: 21, eci: null, priceIn: 0, priceOut: 0, speedTps: null, latencyS: null, contextK: 128, released: "2025-11", note: "AA v4.1=21; MIT, multimodal, served free" },
  { name: "Mercury 2", provider: "Inception", origin: "US", openWeights: false, sizeB: null, intelligence: 21, eci: null, priceIn: 0.25, priceOut: 0.75, speedTps: 1072.2, latencyS: 4.24, contextK: 128, released: "2026-02", note: "AA; diffusion LLM, #1 output speed" },
  { name: "Gemini 2.5 Flash", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 20, eci: null, priceIn: 0.3, priceOut: 2.5, speedTps: 235, latencyS: 14.95, contextK: 1000, released: null, note: "AA; $0.30/$2.50" },
  { name: "Mistral Small 4", provider: "Mistral", origin: "EU", openWeights: true, sizeB: 119, intelligence: 20, eci: null, priceIn: 0.15, priceOut: 0.6, speedTps: 169.7, latencyS: 0.72, contextK: 256, released: "2026-03", note: "AA; MoE 119B/6.5B active" },
  { name: "North Mini Code", provider: "Cohere", origin: "Canada", openWeights: true, sizeB: 30, intelligence: 20, eci: null, priceIn: 0, priceOut: 0, speedTps: 119.0, latencyS: 0.35, contextK: 256, released: "2026-06", note: "AA; MoE 30B/3B active; Apache 2.0; free" },
  { name: "Devstral 2", provider: "Mistral", origin: "EU", openWeights: true, sizeB: 125, intelligence: 19, eci: null, priceIn: 0, priceOut: 0, speedTps: 75.6, latencyS: 1.37, contextK: 256, released: "2025-12", note: "AA; coding, open; $0 free/self-host" },
  { name: "Hermes 4 405B", provider: "Nous Research", origin: "US", openWeights: true, sizeB: 405, intelligence: 19, eci: null, priceIn: 1.0, priceOut: 3.0, speedTps: 38.6, latencyS: null, contextK: 130, released: "2025-08", note: "AA v4.1 (reasoning); Llama-3.1-405B base" },
  { name: "o3-mini", provider: "OpenAI", origin: "US", openWeights: false, sizeB: null, intelligence: 19, eci: null, priceIn: null, priceOut: null, speedTps: 236, latencyS: 6.44, contextK: 200, released: null, note: "AA" },
  { name: "Magistral Medium 1.2", provider: "Mistral", origin: "EU", openWeights: false, sizeB: null, intelligence: 18, eci: null, priceIn: null, priceOut: null, speedTps: 42, latencyS: 1.8, contextK: 131, released: null, note: "AA (reasoning); blended-only price" },
  { name: "Grok 4.1 Fast", provider: "xAI", origin: "US", openWeights: false, sizeB: null, intelligence: 17, eci: null, priceIn: 0.2, priceOut: 0.5, speedTps: null, latencyS: null, contextK: 2000, released: "2025-11", note: "AA II/ctx; xAI list price" },
  { name: "Mistral Large 3", provider: "Mistral", origin: "EU", openWeights: true, sizeB: 675, intelligence: 16, eci: null, priceIn: 0.5, priceOut: 1.5, speedTps: 51.3, latencyS: 1.12, contextK: 256, released: "2025-12", note: "AA; MoE 675B/41B active; Apache 2.0" },
  { name: "gpt-oss-20b", provider: "OpenAI", origin: "US", openWeights: true, sizeB: 20, intelligence: 15, eci: null, priceIn: 0.02, priceOut: null, speedTps: 205, latencyS: 0.79, contextK: 131, released: null, note: "AA; open; hosted price varies" },
  { name: "Nemotron 3 Nano Omni 30B A3B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 30, intelligence: 15, eci: null, priceIn: 0.07, priceOut: 0.3, speedTps: 293, latencyS: null, contextK: 256, released: "2026-04", note: "AA/OpenRouter; omnimodal, 3B active" },
  { name: "Llama 4 Maverick", provider: "Meta", origin: "US", openWeights: true, sizeB: 402, intelligence: 14, eci: null, priceIn: 0.35, priceOut: 0.85, speedTps: 112.5, latencyS: 0.97, contextK: 1000, released: "2025-04", note: "AA; MoE 402B/17B active" },
  { name: "Nova 2.0 Pro Preview", provider: "Amazon", origin: "US", openWeights: false, sizeB: null, intelligence: 14, eci: null, priceIn: 1.25, priceOut: 10.0, speedTps: 113.8, latencyS: 1.1, contextK: 256, released: "2025-11", note: "AA" },
  { name: "Nova Premier", provider: "Amazon", origin: "US", openWeights: false, sizeB: null, intelligence: 13, eci: null, priceIn: 2.5, priceOut: 12.5, speedTps: 27.7, latencyS: 2.98, contextK: 1000, released: "2025-04", note: "AA" },
  { name: "Gemma 4 E4B", provider: "Google", origin: "US", openWeights: true, sizeB: 4, intelligence: 12, eci: null, priceIn: null, priceOut: null, speedTps: 94, latencyS: 1.13, contextK: 128, released: "2026-04", note: "AA; open" },
  { name: "Nova 2.0 Lite", provider: "Amazon", origin: "US", openWeights: false, sizeB: null, intelligence: 12, eci: null, priceIn: 0.3, priceOut: 2.5, speedTps: 159.3, latencyS: 1.03, contextK: 1000, released: "2025-10", note: "AA" },
  { name: "OLMo 3 32B Think", provider: "AI2", origin: "US", openWeights: true, sizeB: 32, intelligence: 12, eci: null, priceIn: 0.15, priceOut: 0.5, speedTps: null, latencyS: null, contextK: 64, released: "2025-11", note: "AA v4.1; first fully-open 32B reasoning model" },
  { name: "Gemini 2.5 Flash-Lite", provider: "Google", origin: "US", openWeights: false, sizeB: null, intelligence: 11, eci: null, priceIn: 0.1, priceOut: 0.4, speedTps: 216, latencyS: 0.37, contextK: 1000, released: null, note: "AA; $0.10/$0.40" },
  { name: "Llama 4 Scout", provider: "Meta", origin: "US", openWeights: true, sizeB: 109, intelligence: 10, eci: null, priceIn: 0.175, priceOut: 0.625, speedTps: 87.3, latencyS: 0.8, contextK: 10000, released: "2025-04", note: "AA; MoE 109B/17B active; 10M ctx" },
  { name: "Phi-4 Multimodal", provider: "Microsoft", origin: "US", openWeights: true, sizeB: null, intelligence: 10, eci: null, priceIn: null, priceOut: null, speedTps: 16.6, latencyS: null, contextK: 128, released: null, note: "AA; text+image+speech" },
  { name: "Gemma 4 E2B", provider: "Google", origin: "US", openWeights: true, sizeB: 2, intelligence: 9, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2026-04", note: "AA; open" },
  { name: "Granite 4.1 30B", provider: "IBM", origin: "US", openWeights: true, sizeB: 30, intelligence: 9, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 512, released: "2026-04", note: "AA v4.1; dense, Apache 2.0" },
  { name: "Granite 4.1 3B", provider: "IBM", origin: "US", openWeights: true, sizeB: 3, intelligence: 9, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 512, released: "2026-04", note: "AA v4.1; dense, Apache 2.0" },
  { name: "Command A", provider: "Cohere", origin: "Canada", openWeights: true, sizeB: 111, intelligence: 8, eci: null, priceIn: 2.5, priceOut: 10.0, speedTps: 63.3, latencyS: 1.68, contextK: 256, released: "2025-03", note: "AA; open CC-BY-NC" },
  { name: "LFM2.5-8B-A1B", provider: "Liquid AI", origin: "US", openWeights: true, sizeB: 8, intelligence: 8, eci: null, priceIn: null, priceOut: null, speedTps: 337, latencyS: 2.92, contextK: 33, released: null, note: "AA; MoE 8B/1B active; open" },
  { name: "Nova Pro", provider: "Amazon", origin: "US", openWeights: false, sizeB: null, intelligence: 8, eci: null, priceIn: 0.8, priceOut: 3.2, speedTps: null, latencyS: null, contextK: 300, released: "2024-12", note: "AA" },
  { name: "OLMo 3 7B Instruct", provider: "AI2", origin: "US", openWeights: true, sizeB: 7, intelligence: 8, eci: null, priceIn: 0.1, priceOut: 0.2, speedTps: null, latencyS: null, contextK: 64, released: "2025-11", note: "AA v4.1" },
  { name: "OLMo 3.1 32B Think", provider: "AI2", origin: "US", openWeights: true, sizeB: 32, intelligence: 8, eci: null, priceIn: 0, priceOut: 0, speedTps: null, latencyS: null, contextK: 64, released: "2026-01", note: "AA v4.1; fully-open reasoning; free/self-host" },
  { name: "Gemma 3 27B", provider: "Google", origin: "US", openWeights: true, sizeB: 27, intelligence: 7, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: null, note: "AA; open" },
  { name: "Granite 4.1 8B", provider: "IBM", origin: "US", openWeights: true, sizeB: 8, intelligence: 7, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 512, released: "2026-04", note: "AA v4.1; dense, Apache 2.0" },
  { name: "Nemotron 3 Nano 30B A3B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 30, intelligence: 7, eci: null, priceIn: 0.05, priceOut: 0.2, speedTps: 114.7, latencyS: 0.96, contextK: 1000, released: "2025-12", note: "AA v4.1; MoE 3.6B active" },
  { name: "Jamba 1.7 Large", provider: "AI21", origin: "Israel", openWeights: true, sizeB: 398, intelligence: 5, eci: null, priceIn: 2.0, priceOut: 8.0, speedTps: 56.8, latencyS: 1.63, contextK: 256, released: "2025-07", note: "AA; hybrid Transformer/SSM MoE 398B/94B active" },
  { name: "Phi-4", provider: "Microsoft", origin: "US", openWeights: true, sizeB: 14, intelligence: 5, eci: null, priceIn: 0.125, priceOut: 0.5, speedTps: null, latencyS: null, contextK: 16, released: "2024-12", note: "AA; MIT" },
  { name: "Reka Flash 3", provider: "Reka", origin: "US", openWeights: true, sizeB: 21, intelligence: 4, eci: null, priceIn: 0.2, priceOut: 0.8, speedTps: null, latencyS: null, contextK: 128, released: "2025-03", note: "AA; 21B open" },
  { name: "Jamba 1.6 Mini", provider: "AI21", origin: "Israel", openWeights: true, sizeB: null, intelligence: 3, eci: null, priceIn: null, priceOut: null, speedTps: 181, latencyS: 0.76, contextK: 256, released: null, note: "AA; blended-only price" },
  { name: "Gemma 3 270M", provider: "Google", origin: "US", openWeights: true, sizeB: 0.27, intelligence: 2, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: null, note: "AA; open" },
  { name: "LFM2.5-VL-1.6B", provider: "Liquid AI", origin: "US", openWeights: true, sizeB: 1.6, intelligence: 1, eci: null, priceIn: null, priceOut: null, speedTps: 418, latencyS: 4.04, contextK: 33, released: null, note: "AA; VLM, open" },
  { name: "Codestral Mamba 7B", provider: "Mistral AI", origin: "EU", openWeights: true, sizeB: 7, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 256, released: "2024-07", note: "SSM coder; Apache-2.0; HF" },
  { name: "DBRX Instruct", provider: "Databricks", origin: "US", openWeights: true, sizeB: 132, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: "2024-03", note: "Fine-grained MoE, 36B active" },
  { name: "DeepSeek V4 Flash", provider: "DeepSeek", origin: "China", openWeights: true, sizeB: 284, intelligence: null, eci: null, priceIn: 0.14, priceOut: 0.28, speedTps: null, latencyS: null, contextK: 1000, released: "2026-04", note: "284B/13B active, $0.14/$0.28, 1M ctx, open (MIT); AA Index not separately reported" },
  { name: "DeepSeek-R1-Distill-Llama-70B", provider: "DeepSeek", origin: "China", openWeights: true, sizeB: 70, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-01", note: "R1 distill, Llama3.3 base; HF" },
  { name: "DeepSeek-R1-Distill-Qwen-32B", provider: "DeepSeek", origin: "China", openWeights: true, sizeB: 32, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-01", note: "R1 distill, Qwen2.5 base; HF" },
  { name: "ERNIE 5.1", provider: "Baidu", origin: "China", openWeights: false, sizeB: null, intelligence: null, eci: null, priceIn: 0.59, priceOut: 2.65, speedTps: null, latencyS: null, contextK: 128, released: "2026-05", note: "sparse MoE, $0.59/$2.65, 128K ctx, closed; AA Index not cleanly published" },
  { name: "Falcon-180B", provider: "TII", origin: "UAE", openWeights: true, sizeB: 180, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 2, released: "2023-09", note: "TII license; HF" },
  { name: "Falcon-H1-34B", provider: "TII", origin: "UAE", openWeights: true, sizeB: 34, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 256, released: "2025-05", note: "hybrid attention-SSM, rivals 70B; HF" },
  { name: "Granite 4.0 H-Small", provider: "IBM", origin: "US", openWeights: true, sizeB: 32, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-10", note: "Hybrid MoE, 9B active; Apache 2.0" },
  { name: "Hermes 4 70B", provider: "Nous Research", origin: "US", openWeights: true, sizeB: 70, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 131, released: "2025-08", note: "HF; Llama-3.1-70B base" },
  { name: "Llama 3.1 405B", provider: "Meta", origin: "US", openWeights: true, sizeB: 405, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-07", note: "Meta/HF" },
  { name: "Llama 3.1 8B", provider: "Meta", origin: "US", openWeights: true, sizeB: 8, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-07", note: "Meta/HF" },
  { name: "Llama 3.2 3B", provider: "Meta", origin: "US", openWeights: true, sizeB: 3, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-09", note: "Meta edge; HF" },
  { name: "Llama 3.3 70B", provider: "Meta", origin: "US", openWeights: true, sizeB: 70, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-12", note: "Meta; matches 3.1 405B at 70B; HF" },
  { name: "Llama 4 Behemoth", provider: "Meta", origin: "US", openWeights: false, sizeB: 2000, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: null, released: null, note: "MoE ~288B active; preview, not released" },
  { name: "Llama-3.1-Nemotron-Ultra-253B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 253, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "HF; reasoning-toggle, from Llama 3.1" },
  { name: "Llama-3.3-Nemotron-Super-49B v1.5", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 49, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-07", note: "HF; NAS-distilled from Llama 3.3 70B" },
  { name: "Mistral NeMo 12B", provider: "Mistral AI", origin: "EU", openWeights: true, sizeB: 12, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-07", note: "with NVIDIA; Apache-2.0; HF" },
  { name: "Mistral Small 3.2", provider: "Mistral AI", origin: "EU", openWeights: true, sizeB: 24, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-06", note: "24B; Apache-2.0; HF" },
  { name: "Mixtral 8x22B", provider: "Mistral AI", origin: "EU", openWeights: true, sizeB: 141, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 64, released: "2024-04", note: "MoE 39B active; HF" },
  { name: "Mixtral 8x7B", provider: "Mistral AI", origin: "EU", openWeights: true, sizeB: 46.7, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: "2023-12", note: "MoE 12.9B active; HF" },
  { name: "Nemotron Nano 9B v2", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 9, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-08", note: "arXiv 2508.14444; hybrid, pruned from 12B" },
  { name: "Nemotron-H 56B", provider: "NVIDIA", origin: "US", openWeights: true, sizeB: 56, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 8, released: "2025-04", note: "ADLR; hybrid Mamba-Transformer" },
  { name: "Phi-3.5-MoE", provider: "Microsoft", origin: "US", openWeights: true, sizeB: 42, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-08", note: "MoE 6.6B active; HF" },
  { name: "Phi-4-reasoning-plus", provider: "Microsoft", origin: "US", openWeights: true, sizeB: 14, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: "2025-04", note: "reasoning; HF" },
  { name: "Qwen2.5-72B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 72, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-09", note: "Qwen2.5 dense flagship; HF" },
  { name: "Qwen2.5-Coder-32B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 32, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2024-11", note: "Qwen2.5-Coder flagship; HF" },
  { name: "Qwen3-14B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 14, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "Qwen3 dense; HF" },
  { name: "Qwen3-235B-A22B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 235, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "Qwen3 MoE flagship, 22B active; HF" },
  { name: "Qwen3-30B-A3B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 30, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "Qwen3 MoE, 3B active; HF" },
  { name: "Qwen3-32B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 32, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "Qwen3 dense; HF" },
  { name: "Qwen3-4B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 4, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: "2025-04", note: "Qwen3 dense; HF" },
  { name: "Qwen3-8B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 8, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-04", note: "Qwen3 dense; HF" },
  { name: "Qwen3-Coder-480B-A35B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 480, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 256, released: "2025-07", note: "Qwen3-Coder MoE, 35B active; HF" },
  { name: "Qwen3-VL-235B-A22B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 235, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 256, released: "2025-09", note: "Qwen3-VL MoE, 22B active; HF" },
  { name: "Qwen3.8 Max", provider: "Alibaba", origin: "China", openWeights: false, sizeB: 2400, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: null, released: "2026-07", note: "Alibaba preview 2026-07; 2.4T MoE multimodal; weights promised, not yet released" },
  { name: "QwQ-32B", provider: "Alibaba", origin: "China", openWeights: true, sizeB: 32, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-03", note: "Qwen reasoning model; HF" },
  { name: "SmolLM3-3B", provider: "Hugging Face", origin: "US", openWeights: true, sizeB: 3, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 128, released: "2025-07", note: "dual-mode reasoner; HF" },
  { name: "Snowflake Arctic", provider: "Snowflake", origin: "US", openWeights: true, sizeB: 480, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 4, released: "2024-04", note: "Dense-MoE, 17B active, 128 experts" },
  { name: "Solar Pro 2", provider: "Upstage", origin: "Korea", openWeights: true, sizeB: 31, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: null, released: null, note: "Upstage sLLM, hybrid reasoning" },
  { name: "SOLAR-10.7B", provider: "Upstage", origin: "Korea", openWeights: true, sizeB: 10.7, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 4, released: "2023-12", note: "depth up-scaling; Apache-2.0; HF" },
  { name: "Yi-1.5-34B", provider: "01.AI", origin: "China", openWeights: true, sizeB: 34, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: 32, released: "2024-05", note: "HF" },
  { name: "Zamba2-7B", provider: "Zyphra", origin: "US", openWeights: true, sizeB: 7, intelligence: null, eci: null, priceIn: null, priceOut: null, speedTps: null, latencyS: null, contextK: null, released: "2024-10", note: "Hybrid SSM-Transformer (Mamba2)" },
]

// Validated at import so a bad edit fails the build.
const schema = z.array(z.object({
  name: z.string(), provider: z.string(), origin: z.string(), openWeights: z.boolean(),
  sizeB: z.number().nullable(), intelligence: z.number().nullable(), eci: z.number().nullable(),
  priceIn: z.number().nullable(), priceOut: z.number().nullable(), speedTps: z.number().nullable(),
  latencyS: z.number().nullable(), contextK: z.number().nullable(), released: z.string().nullable(),
  article: z.string().optional(), note: z.string().optional(),
}))
schema.parse(models)
