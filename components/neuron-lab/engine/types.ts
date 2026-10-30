// Shared types for the in-browser Qwen3-0.6B engine (no DOM, no Node APIs).

/** Random-access reader over the model file (OPFS file, HTTP Range, or a local file in tests). */
export interface ByteSource {
  readonly size: number
  /** Fill `dst` (length bytes) from `offset`. */
  read(offset: number, dst: Uint8Array): Promise<void>
}

export interface Calibration {
  resNormMedian: number[] // [layers]
  colNorm: number[][] // [layers][neurons]
}

export interface Steer {
  layer: number
  neuron: number
  dose: number
  /** Test hook: an absolute activation shift that replaces the dose-derived one. */
  delta?: number
}

export interface GenerateOptions {
  prompt: string
  steers: Steer[]
  maxNewTokens: number
  temperature: number
  topK: number
  seed: number
  onToken: (t: string, info: { index: number }) => void
  signal?: AbortSignal
}

/** Several steered variants of one prompt decoded together (one pass over the weights per token). */
export interface GenerateManyOptions {
  prompt: string
  /** One steer list per variant (1-4), e.g. [-dose, none, +dose] for the three-column comparison. */
  variants: Steer[][]
  maxNewTokens: number
  temperature: number
  topK: number
  seed: number
  onToken: (variant: number, t: string, info: { index: number }) => void
  signal?: AbortSignal
}

export interface GenerateResult {
  text: string
  tokens: number
  msPerToken: number
}

export interface ActivationsResult {
  tokens: string[]
  /** Max over tokens of the MLP hidden activation (silu(gate)*up), index layer*3072+neuron. */
  max: Float32Array
  /** Per-token activation of one neuron; present when the text was short enough to keep them all. */
  byToken?: (layer: number, neuron: number) => Float32Array
}

export type ProgressFn = (frac: number, msg: string) => void
