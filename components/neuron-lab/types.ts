// Shapes of the static data under public/neuron-lab/<model>/ and of the engine.
// The loader in data.ts normalises what the DATA pipeline writes into these.

export interface ModelMeta {
  model: string
  layers: number
  neurons: number
  hidden: number
  vocab: number
  resNormMedian: number[]
  colNorm: number[][]
  corpus?: { name: string; tokens: number; license: string }
  generated?: string
}

export interface LayerLens {
  up: string[][]
  down: string[][]
  actMax: number[]
  /** most negative activation (SwiGLU units can go negative); absent in older files */
  actMin?: number[]
  actMean: number[]
}

/** Largest absolute activation of a neuron over the reference corpus. */
export const peakOf = (lens: LayerLens, n: number) => Math.max(lens.actMax[n], -(lens.actMin?.[n] ?? 0))

export interface Context {
  text: string
  tokenIndex: number
  act: number
  /** language of the source passage, when the pipeline recorded it */
  lang?: string
}

export interface Edge {
  layer: number
  neuron: number
  /** signed weight-level cosine (positive: this neuron's write pushes the target toward firing) */
  score: number
  /** the cosine with the target's up row, when the pipeline stored it */
  up?: number
}

export interface Steer {
  layer: number
  neuron: number
  dose: number
}

export interface DiscoverySample {
  prompt: string
  baseline: string
  steered: string
}

export interface Discovery {
  id: string
  label: string
  axis: string
  neurons: Steer[]
  evidence?: { contrastScore?: number; controlScores?: number[] }
  samples: DiscoverySample[]
  coherenceNote?: string
}

export type NeuronKey = `${number}.${number}`
export const nkey = (layer: number, neuron: number): NeuronKey => `${layer}.${neuron}`
export const fmtNeuron = (layer: number, neuron: number) => `L${layer} N${neuron}`

export interface Recipe {
  steers: Steer[]
}

// What the UI needs from the in-browser engine (see components/neuron-lab/engine.ts).
export interface GenerateArgs {
  prompt: string
  steers: Steer[]
  maxNewTokens: number
  temperature: number
  topK: number
  seed: number
  onToken: (t: string, info: { index: number }) => void
  signal?: AbortSignal
}

export interface GenerateManyArgs {
  prompt: string
  variants: Steer[][]
  maxNewTokens: number
  temperature: number
  topK: number
  seed: number
  onToken: (variant: number, t: string, info: { index: number }) => void
  signal?: AbortSignal
}

export interface NeuronEngine {
  /** Human description of what loading means (download size etc.). */
  info: { model: string; downloadMB: number; memoryMB: number; backend: string }
  isLoaded(): boolean
  cached(): Promise<"cached" | "missing" | "unknown">
  load(onProgress: (frac: number, msg: string) => void): Promise<void>
  unload(): void
  generate(a: GenerateArgs): Promise<{ text: string; tokens: number; msPerToken: number }>
  /** Several steered variants of one prompt decoded together (1-4); the engine does one pass over the weights per token. */
  generateMany?(a: GenerateManyArgs): Promise<{ text: string; tokens: number; msPerToken: number }[]>
  activations(text: string): Promise<{ tokens: string[]; max: Float32Array }>
}
