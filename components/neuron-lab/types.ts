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
  /** add mode: a dose in residual-norm units. mul mode: the factor the activation is multiplied by (1 = unchanged, 0 = ablated). */
  dose: number
  mode?: "add" | "mul"
}

export interface DiscoverySample {
  prompt: string
  baseline: string
  steered: string
}

export interface DiscoveryEvidence {
  contrastScore?: number
  dEven?: number
  dOdd?: number
  /** change in axis words per 100 words against the unsteered model, and the bar it had to clear */
  lift?: number
  minLift?: number
  perplexity?: number
  baselinePerplexity?: number
  /** share of repeated trigrams in the steered samples and in the unsteered ones (percent) */
  repetitionPct?: number
  baselineRepetitionPct?: number
  controlScores?: {
    bestRandomLiftAtDose?: number
    randomPerplexityRange?: [number, number]
    stage1BestRandomLifts?: number[]
  }
}

export interface Discovery {
  id: string
  label: string
  axis: string
  kind?: "single" | "pair"
  neurons: Steer[]
  evidence?: DiscoveryEvidence
  samples: DiscoverySample[]
  coherenceNote?: string
}

/** One axis of the search, hits and misses alike (qwen3-0.6b-findings.json). */
export interface AxisFinding {
  axis: string
  label: string
  kind: string
  verdict: "works" | "miss"
  contrast: { setA: number; setB: number; topAbsD: number; randomMeanAbsD: number; randomP99AbsD: number; splitHalfReplicated_top40: number }
  screened: number
  controlsStage1: { n: number; top: number[]; meanBestLift: number }
  scores?: { minLift?: number; baselinePerplexity?: number; pairsTried?: number; pairsWorking?: number }
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

export interface EngineBackendReport {
  backend: "cpu" | "webgpu"
  adapter?: { vendor: string; architecture: string; description: string; fallback: boolean; maxBinding: number }
}

export interface NeuronEngine {
  /** What is selected right now: the model, how much it downloads and holds, and what runs it. Reflects select() and setBackend(). */
  readonly info: { model: string; downloadMB: number; memoryMB: number; backend: string }
  modelId(): string
  /** Choose the model the next load() fetches. Unloads whatever was loaded, so memory is freed. */
  select(id: string): void
  isLoaded(): boolean
  /** Is this model's file already in the browser's storage? (default: the selected model) */
  cached(id?: string): Promise<"cached" | "missing" | "unknown">
  load(onProgress: (frac: number, msg: string) => void): Promise<void>
  unload(): void
  /** True when navigator.gpu exists, so the opt-in WebGPU backend can be offered. */
  readonly webgpuAvailable: boolean
  backend(): "cpu" | "webgpu"
  setBackend(kind: "cpu" | "webgpu", onProgress?: (frac: number, msg: string) => void): Promise<EngineBackendReport>
  generate(a: GenerateArgs): Promise<{ text: string; tokens: number; msPerToken: number }>
  /** Several steered variants of one prompt decoded together (1-4); the engine does one pass over the weights per token. */
  generateMany?(a: GenerateManyArgs): Promise<{ text: string; tokens: number; msPerToken: number }[]>
  activations(text: string): Promise<{ tokens: string[]; max: Float32Array }>
}
