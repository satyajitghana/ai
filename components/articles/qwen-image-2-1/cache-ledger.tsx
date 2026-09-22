import { Fragment } from "react"

import { cn } from "@/lib/utils"

// Three third-party measurements of the Qwen-Image-2.1 prefix KV cache, put
// against the same arithmetic the `PrefixCache` widget already does.
//
// The shapes are the shipped ones: num_layers 32, num_attention_heads 32,
// attention_head_dim 128 -> d = 4096, mlp_ratio 3, patch_size 1, VAE
// scale_factor_spatial 16, so an H x W image is exactly (H/16) x (W/16) tokens.
// Per layer, per token, the bias-free linear layers cost 13d^2 MACs; attention
// costs 2 MACs per (query, key) pair per layer per head-dim unit. Pair counts
// are exact under `allowed = (q_idx >= kv_idx) | same_image_block`.
//
// Nothing here is timed by me. The timings are the sources', quoted; the
// predictions are derived. Arithmetic is +, -, *, / only — every one of those
// is exactly rounded per IEEE-754 on any engine, so no lib/dmath wrapper is
// needed and the server and client agree bit for bit.

const LAYERS = 32
const D = 4096
const LINEAR_MACS_PER_TOKEN_PER_LAYER = 13 * D * D
const TEXT_TOKENS = 256 // a short instruction, stated rather than measured
const A100_BF16_TFLOPS = 312 // NVIDIA's dense BF16 tensor-core peak for A100

/** Sum of key positions visible to every query, under (q >= kv) | same_image_block. */
function blockCausalPairs(segments: { len: number; image: boolean }[]): number {
  let pairs = 0
  let start = 0
  for (const seg of segments) {
    const end = start + seg.len
    if (seg.image) {
      pairs += seg.len * end
    } else {
      for (let i = start; i < end; i++) pairs += i + 1
    }
    start = end
  }
  return pairs
}

const macs = (tokens: number, pairs: number) =>
  tokens * LINEAR_MACS_PER_TOKEN_PER_LAYER * LAYERS + 2 * pairs * D * LAYERS

/** MAC cost of one denoising job, with and without the prefix cache. */
function job(refs: number, refPx: number, targetPx: number, steps: number) {
  const refTokens = (refPx / 16) * (refPx / 16)
  const targetTokens = (targetPx / 16) * (targetPx / 16)
  const segments = [
    { len: TEXT_TOKENS, image: false },
    ...Array.from({ length: refs }, () => ({ len: refTokens, image: true })),
    { len: targetTokens, image: true },
  ]
  const total = TEXT_TOKENS + refs * refTokens + targetTokens
  const prefill = macs(total, blockCausalPairs(segments))
  const decode = macs(targetTokens, targetTokens * total)
  const cached = prefill + (steps - 1) * decode
  const uncached = steps * prefill
  return { total, targetTokens, prefill, decode, cached, uncached, ratio: uncached / cached }
}

// --- measurement 1: warmed A100, DiT time only ------------------------------
const A100 = job(2, 1024, 1024, 40)
const A100_UNCACHED_S = 50.57
const A100_CACHED_S = 19.86
const A100_MEASURED = A100_UNCACHED_S / A100_CACHED_S
// two FLOPs per multiply-add
const tflops = (m: number, s: number) => (2 * m) / s / 1e12
const A100_TFLOPS_UNCACHED = tflops(A100.uncached, A100_UNCACHED_S)
const A100_TFLOPS_CACHED = tflops(A100.cached, A100_CACHED_S)

// --- measurement 2: RTX 5070 Ti, whole job ----------------------------------
const TI = job(1, 512, 512, 4)
const TI_BEFORE_S = 9.82
const TI_AFTER_S = 7.57
const TI_MEASURED = TI_BEFORE_S / TI_AFTER_S
// If the DiT is a fraction f of the uncached job and the cache speeds only the
// DiT by `TI.ratio`, then (before - after) = f * before * (1 - 1 / ratio).
const TI_DIT_SHARE =
  (TI_BEFORE_S - TI_AFTER_S) / (TI_BEFORE_S * (1 - 1 / TI.ratio))

// --- measurement 3: RTX 3090, ComfyUI acceptance record ---------------------
const T2I_40 = job(0, 1024, 1024, 40)
const REF1_40 = job(1, 1024, 1024, 40)
const REF2_40 = job(2, 1024, 1024, 40)
const JOBS = [
  { label: "text to image", seconds: 37.581, cached: 1, uncached: 1 },
  {
    label: "one-reference edit",
    seconds: 37.106,
    cached: REF1_40.cached / T2I_40.cached,
    uncached: REF1_40.uncached / T2I_40.cached,
  },
  {
    label: "two-reference edit",
    seconds: 44.554,
    cached: REF2_40.cached / T2I_40.cached,
    uncached: REF2_40.uncached / T2I_40.cached,
  },
]
const T2I_SECONDS = JOBS[0].seconds

// --- the cache itself, in bytes ---------------------------------------------
// K and V, post-RoPE, bf16, every layer: 2 tensors * d * 2 bytes * 32 layers.
const CACHE_BYTES_PER_TOKEN = 2 * D * 2 * LAYERS // 524,288 = 0.5 MiB
const A100_PREFIX_TOKENS = A100.total - A100.targetTokens
const CACHE_GIB = (A100_PREFIX_TOKENS * CACHE_BYTES_PER_TOKEN) / 1073741824
const A100_MEM_DELTA = 36.0 - 32.3

const SCALE = 4 // bar axis, in x
const bar = (x: number) => `${(x * 100) / SCALE}%`

function Row({
  label,
  value,
  x,
  tone,
}: {
  label: string
  value: string
  x: number
  tone: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground sm:w-32">
        {label}
      </span>
      <div className="relative h-5 flex-1 rounded-sm bg-muted/50">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-sm", tone)}
          style={{ width: bar(x) }}
        />
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums sm:w-24">
        {value}
      </span>
    </div>
  )
}

export function CacheLedger() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-cache-ledger={A100_MEASURED.toFixed(2)}
      aria-label="Measured prefix KV cache speedups against the cost model derived from the shipped config"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        measured speedup vs. what the mask arithmetic predicts
      </div>

      <div className="space-y-2 border-b px-4 py-4">
        <p className="my-0 font-mono text-xs">
          A100, warmed, 2 references, 1024px, 40 steps —{" "}
          <span className="text-muted-foreground">DiT time only</span>
        </p>
        <Row
          label="predicted"
          value={`${A100.ratio.toFixed(2)}x`}
          x={A100.ratio}
          tone="bg-foreground/25"
        />
        <Row
          label="measured"
          value={`${A100_MEASURED.toFixed(2)}x`}
          x={A100_MEASURED}
          tone="bg-foreground/80"
        />
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          {A100_UNCACHED_S}s &rarr; {A100_CACHED_S}s. The measurement is{" "}
          <span className="font-mono text-foreground tabular-nums">
            {((A100_MEASURED * 100) / A100.ratio).toFixed(1)}%
          </span>{" "}
          of the arithmetic bound.
        </p>
      </div>

      <div className="space-y-2 border-b px-4 py-4">
        <p className="my-0 font-mono text-xs">
          RTX 5070 Ti, 1 reference, 512px, 4 steps —{" "}
          <span className="text-muted-foreground">whole job</span>
        </p>
        <Row
          label="predicted, DiT"
          value={`${TI.ratio.toFixed(2)}x`}
          x={TI.ratio}
          tone="bg-foreground/25"
        />
        <Row
          label="measured, job"
          value={`${TI_MEASURED.toFixed(2)}x`}
          x={TI_MEASURED}
          tone="bg-foreground/80"
        />
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          {TI_BEFORE_S}s &rarr; {TI_AFTER_S}s, end to end. The text encoder and
          the VAE are outside the cache&rsquo;s reach, so the two numbers measure
          different things; reconciling them puts the DiT at{" "}
          <span className="font-mono text-foreground tabular-nums">
            {(TI_DIT_SHARE * 100).toFixed(0)}%
          </span>{" "}
          of that job.
        </p>
      </div>

      <div className="border-b px-4 py-4">
        <p className="my-0 font-mono text-xs">
          RTX 3090, ComfyUI INT8, 1024px, 40 steps —{" "}
          <span className="text-muted-foreground">
            no before/after, so read it as an exclusion
          </span>
        </p>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1 font-mono text-xs tabular-nums sm:gap-x-5">
          <span className="text-muted-foreground">job</span>
          <span className="text-right text-muted-foreground">observed</span>
          <span className="text-right text-muted-foreground">if cached</span>
          <span className="text-right text-muted-foreground">if not</span>
          {JOBS.map((j) => (
            <Fragment key={j.label}>
              <span className="truncate">{j.label}</span>
              <span className="text-right">
                {(j.seconds / T2I_SECONDS).toFixed(2)}x
              </span>
              <span className="text-right text-muted-foreground">
                {j.cached.toFixed(2)}x
              </span>
              <span className="text-right text-muted-foreground">
                {j.uncached.toFixed(2)}x
              </span>
            </Fragment>
          ))}
        </div>
        <p className="mt-3 mb-0 text-xs text-muted-foreground">
          Each column is that job&rsquo;s cost relative to plain text-to-image on
          the same server. The runs were sequential and differ in cache warmth, so
          the observed column is an acceptance record rather than a benchmark —
          but adding a second reference costs{" "}
          <span className="font-mono text-foreground tabular-nums">
            {(JOBS[2].seconds / T2I_SECONDS).toFixed(2)}x
          </span>
          , and without the cache it could not have been cheaper than{" "}
          <span className="font-mono text-foreground tabular-nums">
            {JOBS[2].uncached.toFixed(2)}x
          </span>
          .
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-1 border-b px-4 py-4 font-mono text-sm sm:grid-cols-2">
        <span className="text-muted-foreground">
          effective throughput, prefix recomputed
        </span>
        <span className="tabular-nums">
          {A100_TFLOPS_UNCACHED.toFixed(0)} TFLOPS (
          {((A100_TFLOPS_UNCACHED * 100) / A100_BF16_TFLOPS).toFixed(0)}% of peak)
        </span>
        <span className="text-muted-foreground">
          effective throughput, prefix cached
        </span>
        <span className="tabular-nums">
          {A100_TFLOPS_CACHED.toFixed(0)} TFLOPS (
          {((A100_TFLOPS_CACHED * 100) / A100_BF16_TFLOPS).toFixed(0)}% of peak)
        </span>
      </div>

      <div className="grid gap-x-6 gap-y-1 border-b px-4 py-4 font-mono text-sm sm:grid-cols-2">
        <span className="text-muted-foreground">
          K and V per prefix token, all {LAYERS} layers, bf16
        </span>
        <span className="tabular-nums">
          {CACHE_BYTES_PER_TOKEN.toLocaleString("en-US")} bytes ={" "}
          {CACHE_BYTES_PER_TOKEN / 1048576} MiB
        </span>
        <span className="text-muted-foreground">
          prefix of the A100 run ({A100_PREFIX_TOKENS.toLocaleString("en-US")}{" "}
          tokens)
        </span>
        <span className="tabular-nums">{CACHE_GIB.toFixed(2)} GiB</span>
        <span className="font-medium text-foreground">
          measured memory increase
        </span>
        <span className="font-medium tabular-nums">
          {A100_MEM_DELTA.toFixed(1)} G ={" "}
          {((A100_MEM_DELTA * 100) / CACHE_GIB).toFixed(0)}% of it
        </span>
      </div>

      <figcaption className="px-4 py-3 text-xs text-muted-foreground">
        The timings are the three sources&rsquo;, quoted. The predictions are
        derived from the shipped config the same way{" "}
        <span className="font-mono">PrefixCache</span>{" "}
        derives its token shares:
        exact block-causal pair counts, 13d&sup2; linear MACs per token per layer,
        one full prefill step and {40 - 1} cached ones, ignoring normalisation,
        the VAE and the text encoder. A prompt is assumed at {TEXT_TOKENS} tokens
        and a reference at its stated resolution, so a different prompt length
        moves the predictions by well under a percent.
      </figcaption>
    </figure>
  )
}
