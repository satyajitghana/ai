"use client"

import { useState, type CSSProperties } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One denoising step at a time: which token blocks a flow transformer
// recomputes, which ones it reads back from a K/V cache, and what that costs.
//
// Derived arithmetic, not a benchmark. Shapes:
// - FLUX.2 Klein 9B KV: 8 double + 24 single blocks = 32 layers, d = 4096
//   (32 heads x 128), SwiGLU mlp_ratio 3. The 9B transformer config is gated;
//   the layer count comes from the benchmark repo's TaylorSeer config ("all 8
//   double and 24 single blocks"), d from its cache formula ("2 projections x
//   32 layers x reference_tokens x 4096 channels x 2 bytes"), mlp_ratio from the
//   open 4B config. 8 x 26d^2 + 24 x 13d^2 = 8.72B, which is the "9B".
//   Text is padded to max_sequence_length 512 (pipeline_flux2_klein_kv.py).
//   A 1024 x 704 reference is 64 x 44 = 2,816 tokens; a 1024 x 1024 output is
//   4,096. Mask, from _flux2_kv_causal_attention: text and target queries see
//   every key; reference queries see only reference keys.
// - Qwen-Image-2.1: 32 single-stream layers, d = 4096, mlp_ratio 3
//   (transformer/config.json). Prefix of 4,246 tokens and a 54 x 78 reference
//   latent, from the benchmark's own audit, so text is 4,246 - 4,212 = 34.
//   Mask: (q >= kv) or same_image_block.
//
// Per token per layer the linear layers cost 13d^2 multiply-accumulates in
// both models (QKV + out = 4d^2, SwiGLU = 9d^2), so 26d^2 FLOPs. Attention
// costs 4d FLOPs per (query, key) pair per layer (QK^T and AV).
//
// The uncached baseline is the one Sayak Paul measured: the same mask and the
// same fixed reference timestep, with reference states recomputed every step.
//
// Only +, -, *, / and toFixed: exact in IEEE-754, so no lib/dmath needed.

const D = 4096
const LAYERS = 32
const LIN = 26 * D * D
const ATT = 4 * D

type Preset = {
  id: string
  label: string
  kind: "klein" | "qwen"
  text: number
  refs: number
  target: number
  defaultSteps: number
  measured: Record<number, number>
}

const PRESETS: Preset[] = [
  {
    id: "klein1",
    label: "Klein 9B KV · 1 reference",
    kind: "klein",
    text: 512,
    refs: 2816,
    target: 4096,
    defaultSteps: 4,
    measured: { 4: 23.0, 8: 28.5 },
  },
  {
    id: "klein3",
    label: "Klein 9B KV · 3 references",
    kind: "klein",
    text: 512,
    refs: 8448,
    target: 4096,
    defaultSteps: 4,
    measured: { 4: 42.1, 8: 51.3 },
  },
  {
    id: "qwen1",
    label: "Qwen-Image-2.1 · 1 reference",
    kind: "qwen",
    text: 34,
    refs: 4212,
    target: 4096,
    defaultSteps: 40,
    measured: { 40: 44.7 },
  },
]

type CellState = "computed" | "cached" | "blocked" | "absent"
type RowName = "text" | "reference" | "target"
const ROWS: RowName[] = ["text", "reference", "target"]

function grid(p: Preset, first: boolean): CellState[][] {
  if (p.kind === "klein") {
    if (first) {
      return [
        ["computed", "computed", "computed"],
        ["blocked", "computed", "blocked"],
        ["computed", "computed", "computed"],
      ]
    }
    return [
      ["computed", "cached", "computed"],
      ["absent", "absent", "absent"],
      ["computed", "cached", "computed"],
    ]
  }
  if (first) {
    return [
      ["computed", "blocked", "blocked"],
      ["computed", "computed", "blocked"],
      ["computed", "computed", "computed"],
    ]
  }
  return [
    ["absent", "absent", "absent"],
    ["absent", "absent", "absent"],
    ["cached", "cached", "computed"],
  ]
}

function stepFlops(p: Preset, first: boolean): number {
  const { text: T, refs: R, target: I } = p
  if (p.kind === "klein") {
    const pairsTI = (T + I) * (T + R + I)
    if (first) return LAYERS * (LIN * (T + R + I) + ATT * (pairsTI + R * R))
    return LAYERS * (LIN * (T + I) + ATT * pairsTI)
  }
  const P = T + R
  if (first) {
    const pairs = (T * (T + 1)) / 2 + R * P + I * (P + I)
    return LAYERS * (LIN * (P + I) + ATT * pairs)
  }
  return LAYERS * (LIN * I + ATT * I * (P + I))
}

const COLORS = {
  computed: "#3b82f6",
  cached: "#14b8a6",
}

function cellStyle(s: CellState): CSSProperties {
  if (s === "computed") return { background: COLORS.computed }
  if (s === "cached")
    return {
      background: `repeating-linear-gradient(45deg, ${COLORS.cached}, ${COLORS.cached} 4px, ${COLORS.cached}55 4px, ${COLORS.cached}55 8px)`,
    }
  return {}
}

const CELL_TEXT: Record<CellState, string> = {
  computed: "computed",
  cached: "K/V from cache",
  blocked: "masked",
  absent: "no query",
}

const tf = (f: number) => (f / 1e12).toFixed(1)

export function StepCache() {
  const [pid, setPid] = useState("klein1")
  const p = PRESETS.find((x) => x.id === pid) ?? PRESETS[0]
  const [steps, setSteps] = useState(p.defaultSteps)
  const [cur, setCur] = useState(1)

  const pick = (next: Preset) => {
    setPid(next.id)
    setSteps(next.defaultSteps)
    setCur(1)
  }

  const step = Math.min(cur, steps)
  const first = step === 1
  const full = stepFlops(p, true)
  const dec = stepFlops(p, false)
  const thisStep = first ? full : dec

  const uncachedSoFar = full * step
  const cachedSoFar = full + dec * (step - 1)
  const uncachedRun = full * steps
  const cachedRun = full + dec * (steps - 1)
  const saving = (1 - cachedRun / uncachedRun) * 100
  const measured = p.measured[steps]

  const cachedTokens = p.kind === "klein" ? p.refs : p.text + p.refs
  const cacheGiB = (2 * LAYERS * cachedTokens * D * 2) / (1024 * 1024 * 1024)

  const total = p.text + p.refs + p.target
  const segs: { name: string; tokens: number; state: "computed" | "cached" }[] = [
    {
      name: "text",
      tokens: p.text,
      state: !first && p.kind === "qwen" ? "cached" : "computed",
    },
    { name: "reference", tokens: p.refs, state: first ? "computed" : "cached" },
    { name: "noisy target", tokens: p.target, state: "computed" },
  ]

  const cells = grid(p, first)

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Which token blocks a flow transformer recomputes or reads from a K/V cache at each denoising step, with derived FLOPs and cache size"
      data-step-cache={`${pid}-${steps}-${step}`}
    >
      <div className="flex flex-wrap gap-2 border-b px-4 py-3">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => pick(x)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              x.id === pid
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            denoising steps in the run
          </span>
          <Range
            min={1}
            max={50}
            step={1}
            value={steps}
            onChange={(e) => {
              const v = Number(e.target.value)
              setSteps(v)
              if (cur > v) setCur(v)
            }}
            className="mt-2 w-full"
            aria-label="number of denoising steps"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">{steps}</span>
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">
            looking at step
          </span>
          <Range
            min={1}
            max={steps}
            step={1}
            value={step}
            onChange={(e) => setCur(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="current denoising step"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {step}{" "}
            <span className="text-muted-foreground">
              {first ? "(prefill: everything runs, the cache is written)" : "(decode: the cache is read)"}
            </span>
          </span>
        </label>
      </div>

      <div className="border-b px-4 py-4">
        <div className="mb-2 font-mono text-xs text-muted-foreground">
          tokens through the blocks at step {step} ({total.toLocaleString("en-US")} in the full sequence)
        </div>
        <div className="flex h-9 w-full overflow-hidden rounded border">
          {segs.map((s) => (
            <div
              key={s.name}
              title={`${s.name}: ${s.tokens.toLocaleString("en-US")} tokens`}
              className="flex min-w-[2px] items-center justify-center overflow-hidden border-r font-mono text-[10px] text-white last:border-r-0"
              style={{ width: `${(s.tokens / total) * 100}%`, ...cellStyle(s.state) }}
            >
              {s.tokens / total > 0.12 ? s.name : ""}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums text-muted-foreground">
          {segs.map((s) => (
            <div key={s.name}>
              {s.name}: {s.tokens.toLocaleString("en-US")}
              <br />
              {s.state === "computed" ? "recomputed" : "K/V cached, not run"}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 border-b px-4 py-4 md:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-2 font-mono text-xs text-muted-foreground">
            attention at step {step}: query rows, key columns
          </div>
          <table className="border-separate border-spacing-1 font-mono text-[10px]">
            <thead>
              <tr>
                <th />
                {ROWS.map((c) => (
                  <th key={c} className="px-1 font-normal text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, i) => (
                <tr key={r}>
                  <th className="pr-2 text-right font-normal text-muted-foreground">{r}</th>
                  {cells[i].map((s, j) => (
                    <td
                      key={j}
                      className={cn(
                        "h-12 w-16 rounded text-center align-middle sm:w-20",
                        s === "computed" || s === "cached" ? "text-white" : "text-muted-foreground",
                        s === "blocked" && "border bg-muted/40",
                        s === "absent" && "border border-dashed",
                      )}
                      style={cellStyle(s)}
                    >
                      {CELL_TEXT[s]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {p.kind === "qwen" && first && (
            <p className="mt-2 max-w-xs text-[11px] text-muted-foreground">
              Text is causal within itself; the real layout interleaves text and references, and the rule
              is the same: a prefix token never sees anything after it.
            </p>
          )}
        </div>

        <div className="space-y-3 font-mono text-xs tabular-nums">
          <Meter
            label={`this step: ${tf(thisStep)} TFLOP`}
            value={thisStep}
            max={full}
            note={first ? "full sequence" : `${((thisStep / full) * 100).toFixed(0)}% of a full step`}
          />
          <Meter
            label={`steps 1-${step}, cached: ${tf(cachedSoFar)} TFLOP`}
            value={cachedSoFar}
            max={uncachedSoFar}
            note={`uncached: ${tf(uncachedSoFar)} TFLOP`}
          />
          <div className="rounded border px-3 py-2">
            <div>
              whole run of {steps}: <b>{saving.toFixed(1)}%</b> fewer transformer FLOPs
            </div>
            <div className="text-muted-foreground">
              {measured !== undefined
                ? `measured end-to-end latency saving on an A100: ${measured.toFixed(1)}%`
                : "no measurement at this step count"}
            </div>
          </div>
          <div className="rounded border px-3 py-2">
            <div>
              cache held: <b>{cacheGiB.toFixed(3)} GiB</b> in bf16
            </div>
            <div className="text-muted-foreground">
              2 x {LAYERS} layers x {cachedTokens.toLocaleString("en-US")} tokens x {D} x 2 bytes
            </div>
          </div>
        </div>
      </div>

      <figcaption className="px-4 py-3 text-xs text-muted-foreground">
        Derived from the configs and the diffusers masks, not timed. Transformer FLOPs only: the text encoder
        and VAE are outside the count, which is why the measured saving sits a few points under the model. Solid
        blue is recomputed this step; hatched teal is K/V read from the cache.
      </figcaption>
    </figure>
  )
}

function Meter({
  label,
  value,
  max,
  note,
}: {
  label: string
  value: number
  max: number
  note: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div>
      <div>{label}</div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded bg-muted">
        <div className="h-full rounded" style={{ width: `${pct}%`, background: COLORS.computed }} />
      </div>
      <div className="mt-0.5 text-muted-foreground">{note}</div>
    </div>
  )
}
