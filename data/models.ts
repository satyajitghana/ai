// data/models.ts — a curated, DATED snapshot of frontier + notable LLMs for the
// /models comparison page. This is a snapshot, not a live feed: leaderboards
// churn, and figures are gathered from Artificial Analysis (Intelligence Index,
// price, output speed, latency, context) plus provider docs and Epoch's ECI.
// Any value that isn't sourced is `null`, never guessed — the UI renders around
// missing data rather than inventing it.
//
// Blended price follows Artificial Analysis's 3:1 input:output convention.

export const MODELS_SNAPSHOT_DATE = "2026-07-20"

export type Origin = "US" | "China" | "EU" | "Canada" | "Other"

export type ModelRecord = {
  name: string
  provider: string
  origin: Origin
  openWeights: boolean
  sizeB: number | null // total parameters, billions
  intelligence: number | null // Artificial Analysis Intelligence Index
  eci: number | null // Epoch Capability Index (optional)
  priceIn: number | null // USD / 1M input tokens
  priceOut: number | null // USD / 1M output tokens
  speedTps: number | null // output tokens / second
  latencyS: number | null // time to first token, seconds
  contextK: number | null // context window, thousands of tokens
  released: string | null // "YYYY-MM"
  note?: string
}

// 3:1 input:output blended price, the Artificial Analysis convention.
export function blendedPrice(m: ModelRecord): number | null {
  if (m.priceIn == null || m.priceOut == null) return null
  return Math.round((m.priceIn * 3 + m.priceOut) / 4 * 1000) / 1000
}

// Seed of sourced records. Expanded by the data-gathering pass; every field here
// is from Artificial Analysis or a provider/Epoch source (see note), null else.
export const models: ModelRecord[] = [
  {
    name: "Kimi K3",
    provider: "Moonshot",
    origin: "China",
    openWeights: true,
    sizeB: 2800,
    intelligence: 57,
    eci: 155.53,
    priceIn: null,
    priceOut: null,
    speedTps: null,
    latencyS: null,
    contextK: 256,
    released: "2026-07",
    note: "AA Index ≈57 (#3); ECI 155.53 (scaling01/Epoch); 2.8T open-weight.",
  },
  {
    name: "Fable 5",
    provider: "Anthropic",
    origin: "US",
    openWeights: false,
    sizeB: null,
    intelligence: 60,
    eci: null,
    priceIn: null,
    priceOut: null,
    speedTps: null,
    latencyS: null,
    contextK: null,
    released: null,
    note: "AA Index 60 (#1) at snapshot.",
  },
  {
    name: "GPT-5.6 Sol",
    provider: "OpenAI",
    origin: "US",
    openWeights: false,
    sizeB: null,
    intelligence: 59,
    eci: null,
    priceIn: null,
    priceOut: null,
    speedTps: null,
    latencyS: null,
    contextK: null,
    released: null,
    note: "AA Index 59 (#2) at snapshot.",
  },
]
