"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A System One decision model, running in the reader's own tab.
//
// The architecture this article is about — encode (context, option) once per
// option, read ONE scalar out, softmax the scalars afterwards — is the easiest
// thing there is to put in a browser. No KV cache, no sampling loop, no
// autoregression. Every model offered below is an NLI cross-encoder, which is
// exactly that shape: `logits[:, entail]` is the scalar, and the option set is
// data rather than weights.
//
// Everything here is deliberate about cost:
//   - nothing is fetched until the reader clicks. `@huggingface/transformers`
//     is dynamically imported inside the handler, so it never lands in the
//     server trace and never loads for a reader who only scrolls past.
//   - the download size is printed BEFORE the download starts.
//   - the model is kept in a ref across re-renders and cached by the browser's
//     Cache API, so a second run costs nothing.
//   - SSR renders the idle panel with no reference to the library at all.
//
// The measurement is the point. Latency is reported per decision and per
// option, because in this architecture N is a loop bound: doubling the option
// list doubles the work. That is visible here in a way no diagram makes it.

type Backend = "webgpu" | "wasm"

type ModelSpec = {
  id: string
  repo: string
  label: string
  params: string
  /** dtype passed to transformers.js */
  dtype: "q8" | "fp32" | "q4f16" | "fp16"
  /** measured bytes actually pulled over the wire on first load */
  weightsMB: number
  tokenizerMB: number
  entailIndex: number
  note: string
  /** measured too slow to offer without a GPU — see the latency table */
  needsGPU?: boolean
}

const MODELS: ModelSpec[] = [
  {
    id: "mobilebert",
    repo: "Xenova/mobilebert-uncased-mnli",
    label: "MobileBERT-MNLI",
    params: "25M",
    dtype: "q8",
    weightsMB: 25.7,
    tokenizerMB: 0.7,
    entailIndex: 0,
    note: "The cheap one. Fast, and wrong more often than you want.",
  },
  {
    id: "deberta",
    repo: "Xenova/nli-deberta-v3-xsmall",
    label: "DeBERTa-v3-xsmall NLI",
    params: "70M",
    dtype: "q8",
    weightsMB: 83.2,
    tokenizerMB: 8.3,
    entailIndex: 1,
    note: "The default. 12 layers at width 384; most of the file is a 128k vocabulary.",
  },
  {
    id: "modernbert",
    repo: "onnx-community/ModernBERT-large-zeroshot-v2.0-ONNX",
    label: "ModernBERT-large zeroshot",
    params: "395M",
    dtype: "q4f16",
    weightsMB: 283.6,
    tokenizerMB: 3.4,
    entailIndex: 0,
    needsGPU: true,
    note: "Laya-class: a 4-bit ModernBERT-large. The only one here that gets the sample decision right — and 11-33 s per 16-option decision on WASM.",
  },
]

const DEFAULT_CONTEXT =
  "Customer writes: my card was charged twice for order 88421 and the second charge has not been refunded after nine days. I have already emailed support twice and nobody has replied."

const DEFAULT_OPTIONS = [
  "a duplicate charge that needs refunding",
  "a shipping delay",
  "a complaint about slow support",
  "a question about pricing",
  "a request to cancel the account",
]

const EXTRA_OPTIONS = [
  "a technical bug report",
  "a security incident",
  "a request for a discount",
  "spam",
  "a legal threat",
  "a partnership enquiry",
  "feedback about the website",
  "a lost or stolen card report",
  "a request for an invoice copy",
  "a change of billing address",
  "a chargeback already filed with the bank",
]

type Scored = { option: string; prob: number; logit: number }

type RunInfo = {
  backend: Backend
  totalMs: number
  forwardMs: number
  tokenizeMs: number
  options: number
  tokens: number
  perOption: number
}

type Phase = "idle" | "loading" | "ready" | "error"

const PALETTE = {
  accent: "oklch(0.60 0.15 255)",
  good: "oklch(0.55 0.16 155)",
  dim: "oklch(0.65 0.02 255)",
}

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const e = xs.map((x) => mexp(x - m))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / z)
}

export function BrowserScorer() {
  const [spec, setSpec] = useState<ModelSpec>(MODELS[1])
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState<{ received: number; total: number; file: string } | null>(null)
  const [message, setMessage] = useState("")
  const [backend, setBackend] = useState<Backend | null>(null)
  const [gpu, setGpu] = useState<{ available: boolean; detail: string } | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)

  const [context, setContext] = useState(DEFAULT_CONTEXT)
  const [options, setOptions] = useState<string[]>(DEFAULT_OPTIONS)
  const [scored, setScored] = useState<Scored[] | null>(null)
  const [run, setRun] = useState<RunInfo | null>(null)
  const [busy, setBusy] = useState(false)

  // The model and tokenizer live outside React state on purpose: they are big,
  // opaque and must never be compared or cloned by a re-render.
  const engine = useRef<{ tokenizer: unknown; model: unknown; repo: string } | null>(null)

  // Feature detection has to happen after mount — `navigator.gpu` does not
  // exist on the server, and reading it during render would break SSR.
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      const nav = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }
      if (!nav.gpu) {
        if (!cancelled)
          setGpu({
            available: false,
            detail: "No WebGPU in this browser. Safari and Firefox still ship it off by default; everything below will run on the WASM backend instead.",
          })
        return
      }
      try {
        const adapter = (await nav.gpu.requestAdapter()) as
          | { info?: { vendor?: string; architecture?: string; description?: string } }
          | null
        if (cancelled) return
        if (!adapter) {
          setGpu({ available: false, detail: "WebGPU is present but no adapter was granted — falling back to WASM." })
          return
        }
        const i = adapter.info ?? {}
        const name = [i.vendor, i.architecture, i.description].filter(Boolean).join(" · ")
        setGpu({ available: true, detail: name || "adapter reported no identity" })
      } catch {
        if (!cancelled) setGpu({ available: false, detail: "requestAdapter() threw — falling back to WASM." })
      }
    }
    void probe()
    return () => {
      cancelled = true
    }
  }, [])

  const totalMB = spec.weightsMB + spec.tokenizerMB

  const load = useCallback(async () => {
    setPhase("loading")
    setMessage("")
    setProgress(null)
    setScored(null)
    setRun(null)
    const t0 = performance.now()
    try {
      // Dynamic, inside the handler: the library is ~1.3 MB of JS plus a WASM
      // runtime, and nothing about it should be reachable from a server build.
      const tx = await import("@huggingface/transformers")
      const { env, AutoTokenizer, AutoModelForSequenceClassification } = tx
      env.allowLocalModels = false

      const wantGPU = gpu?.available === true
      const device: Backend = wantGPU ? "webgpu" : "wasm"
      // q8 weights have no WebGPU kernels worth the name, so the GPU path uses
      // the 4-bit/fp16 export instead. Same architecture, different file.
      const dtype = device === "webgpu" && spec.dtype === "q8" ? "fp32" : spec.dtype

      const onProgress = (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status === "progress" && p.total) {
          setProgress({ received: p.loaded ?? 0, total: p.total, file: p.file ?? "" })
        } else if (p.status === "done" && p.file) {
          setProgress((prev) => (prev && prev.file === p.file ? null : prev))
        }
      }

      const tokenizer = await AutoTokenizer.from_pretrained(spec.repo, { progress_callback: onProgress })
      let model
      try {
        model = await AutoModelForSequenceClassification.from_pretrained(spec.repo, {
          dtype,
          device,
          progress_callback: onProgress,
        })
        setBackend(device)
      } catch (gpuErr) {
        if (device !== "webgpu") throw gpuErr
        if (spec.needsGPU) {
          // Falling back to WASM here would hand the reader an 11-33 s decision.
          throw new Error(
            "WebGPU session failed to build, and this model is too slow on the WASM fallback to run it anyway. Pick a smaller one.",
          )
        }
        setMessage("WebGPU session failed to build; retrying on WASM.")
        model = await AutoModelForSequenceClassification.from_pretrained(spec.repo, {
          dtype: spec.dtype,
          device: "wasm",
          progress_callback: onProgress,
        })
        setBackend("wasm")
      }

      engine.current = { tokenizer, model, repo: spec.repo }
      setLoadMs(performance.now() - t0)
      setProgress(null)
      setPhase("ready")
    } catch (err) {
      setPhase("error")
      setMessage(err instanceof Error ? err.message : String(err))
    }
  }, [gpu, spec])

  const score = useCallback(async () => {
    const eng = engine.current
    if (!eng) return
    const live = options.map((o) => o.trim()).filter(Boolean)
    if (live.length < 2) {
      setMessage("Two options minimum — a softmax over one number is always 1.0.")
      return
    }
    setBusy(true)
    setMessage("")
    try {
      const tokenizer = eng.tokenizer as (
        texts: string[],
        opts: Record<string, unknown>,
      ) => Promise<{ input_ids: { dims: number[] } }>
      const model = eng.model as (inputs: unknown) => Promise<{ logits: { tolist: () => number[][] } }>

      const t0 = performance.now()
      // One (context, option) pair per option. This is the whole architecture:
      // the option set is an input, not a shape in the weights.
      const inputs = await tokenizer(
        live.map(() => context),
        {
          text_pair: live.map((o) => `This example is ${o}.`),
          padding: true,
          truncation: true,
          max_length: 256,
        },
      )
      const t1 = performance.now()
      const { logits } = await model(inputs)
      const rows = logits.tolist()
      const t2 = performance.now()

      const scalars = rows.map((r) => r[spec.entailIndex])
      const probs = softmax(scalars)
      setScored(
        live
          .map((option, i) => ({ option, prob: probs[i], logit: scalars[i] }))
          .sort((a, b) => b.prob - a.prob),
      )
      setRun({
        backend: backend ?? "wasm",
        totalMs: t2 - t0,
        forwardMs: t2 - t1,
        tokenizeMs: t1 - t0,
        options: live.length,
        tokens: inputs.input_ids.dims[1] ?? 0,
        perOption: (t2 - t0) / live.length,
      })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [backend, context, options, spec])

  const setOption = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, j) => (j === i ? v : o)))
  const removeOption = (i: number) => setOptions((prev) => prev.filter((_, j) => j !== i))
  const addOption = () =>
    setOptions((prev) => {
      if (prev.length >= 16) return prev
      const next = EXTRA_OPTIONS.find((o) => !prev.includes(o))
      return [...prev, next ?? `option ${prev.length + 1}`]
    })

  const pct = progress && progress.total ? (progress.received / progress.total) * 100 : 0

  return (
    <figure className="my-8 rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>per-option scalar scoring · your machine · nothing leaves the tab</span>
        {backend ? (
          <span className="rounded border px-1.5 py-0.5 text-foreground">{backend.toUpperCase()}</span>
        ) : null}
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        {/* ── model picker + download gate ─────────────────────────────── */}
        {phase === "idle" || phase === "error" ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {MODELS.map((m) => {
                const on = m.id === spec.id
                // Measured at 11.4-32.6 s for a 16-option decision on the WASM
                // backend. Offering that to a reader without a GPU is offering
                // them a frozen tab, so it is off until an adapter is confirmed.
                const blocked = m.needsGPU === true && gpu?.available !== true
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSpec(m)}
                    aria-pressed={on}
                    disabled={blocked}
                    className={cn(
                      "rounded border p-2.5 text-left transition-colors",
                      on ? "border-foreground/50 bg-muted/50" : "hover:bg-muted/30",
                      blocked && "cursor-not-allowed opacity-45 hover:bg-transparent",
                    )}
                  >
                    <div className="font-mono text-xs text-foreground">{m.label}</div>
                    <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {m.params} · {m.dtype} ·{" "}
                      <span className="text-foreground">
                        {(m.weightsMB + m.tokenizerMB).toFixed(0)} MB
                      </span>
                    </div>
                    <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      {blocked ? "Needs WebGPU — measured at 11-33 s per decision on the WASM backend, so it is disabled here rather than freezing your tab." : m.note}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="rounded border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
              Clicking below downloads <span className="font-mono text-foreground">{totalMB.toFixed(1)} MB</span>{" "}
              of weights and tokenizer from the Hugging Face CDN, plus the ONNX Runtime WASM
              binary (about 25 MB, from jsDelivr). It is cached after the first run. Nothing has
              been fetched yet.
              {gpu ? (
                <div className="mt-2">
                  {gpu.available ? (
                    <>
                      WebGPU: <span className="font-mono text-foreground">available</span> —{" "}
                      <span className="font-mono">{gpu.detail}</span>
                    </>
                  ) : (
                    <>WebGPU: {gpu.detail}</>
                  )}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded border border-foreground/30 bg-foreground/5 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/10"
            >
              Download {totalMB.toFixed(0)} MB and run it here
            </button>

            {phase === "error" ? (
              <p className="font-mono text-xs text-destructive">Load failed: {message}</p>
            ) : null}
          </div>
        ) : null}

        {/* ── download progress ────────────────────────────────────────── */}
        {phase === "loading" ? (
          <div className="space-y-2">
            <div className="font-mono text-xs text-muted-foreground">
              {progress
                ? `${progress.file} — ${(progress.received / 1048576).toFixed(1)} / ${(progress.total / 1048576).toFixed(1)} MB`
                : "resolving files…"}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
              <div
                className="h-full transition-[width] duration-150"
                style={{ width: `${pct.toFixed(1)}%`, background: PALETTE.accent }}
              />
            </div>
            {message ? <p className="font-mono text-[11px] text-muted-foreground">{message}</p> : null}
          </div>
        ) : null}

        {/* ── the decision ─────────────────────────────────────────────── */}
        {phase === "ready" ? (
          <div className="space-y-3">
            <div className="font-mono text-[11px] text-muted-foreground">
              {spec.repo} · loaded in {loadMs ? (loadMs / 1000).toFixed(1) : "?"}s ·{" "}
              {backend === "webgpu" ? "WebGPU" : "WASM"}
            </div>

            <label className="block space-y-1">
              <span className="font-mono text-xs text-muted-foreground">context</span>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                rows={3}
                className="w-full resize-y rounded border bg-background p-2 font-mono text-xs leading-relaxed text-foreground"
              />
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground">
                  options — {options.length}, each scored on its own
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={addOption}
                    disabled={options.length >= 16}
                    className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    + option
                  </button>
                </div>
              </div>
              {options.map((o, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    value={o}
                    onChange={(e) => setOption(i, e.target.value)}
                    className="min-w-0 flex-1 rounded border bg-background px-2 py-1 font-mono text-xs text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label={`remove option ${i + 1}`}
                    disabled={options.length <= 2}
                    className="rounded border px-2 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void score()}
                disabled={busy}
                className="rounded border border-foreground/30 bg-foreground/5 px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-50"
              >
                {busy ? "scoring…" : "score"}
              </button>
              {run ? (
                <span className="font-mono text-[11px] text-muted-foreground">
                  {run.totalMs.toFixed(0)} ms for {run.options} options ·{" "}
                  {run.perOption.toFixed(0)} ms/option · {run.tokens} tokens ·{" "}
                  forward {run.forwardMs.toFixed(0)} ms, tokenize {run.tokenizeMs.toFixed(0)} ms
                </span>
              ) : null}
            </div>

            {message ? <p className="font-mono text-[11px] text-destructive">{message}</p> : null}

            {scored ? (
              <div className="space-y-1 border-t pt-3">
                {scored.map((s) => (
                  <div key={s.option} className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs text-foreground">{s.option}</div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div
                          className="h-full"
                          style={{
                            width: `${(s.prob * 100).toFixed(2)}%`,
                            background: s === scored[0] ? PALETTE.good : PALETTE.dim,
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {(s.prob * 100).toFixed(1)}%
                      <span className="ml-2 text-[11px] opacity-60">
                        {s.logit >= 0 ? "+" : ""}
                        {s.logit.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Every option is encoded with the context in its own row, the head emits one scalar per
        row, and the softmax is taken over those scalars — so the option list is an input, not a
        shape in the weights. Add options and the latency grows with them; that linearity is the
        architecture, not the implementation. The right-hand number is the raw entailment logit
        before the softmax.
      </figcaption>
    </figure>
  )
}
