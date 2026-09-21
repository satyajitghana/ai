import {
  A100_PEAK_BW,
  A100_PEAK_FLOPS,
  passBytes,
  prefillFlops,
} from "./model-shapes"

// The diagnosis, as a budget: which phase owns the clock for a given request shape.
//
// TTFT and ITL are not two names for the same slowness. Prefill time scales with
// prompt length; stream time scales with output length, and the two live on
// different hardware limits. Put three ordinary request shapes side by side and the
// split is stark: a chat turn is essentially all decode, and a long-document
// extraction is nearly half prefill. "The model is slow" means different fixes in
// those two rows, which is the point of splitting the pipeline in the first place.
//
//   prefill = max(FLOPs / achievable FLOP/s, bytes / achievable bandwidth)
//   ITL     = bytes(context) / achievable bandwidth, at the mid-generation context
//   stream  = ITL x output tokens
//
// Efficiencies are the assumption, and they are stated on the figure: 50% of peak
// FLOP/s during prefill (a normal MFU for a dense prefill) and 80% of peak HBM
// bandwidth during decode (a well-tuned kernel). Move those and every absolute
// number moves; the ratio between the rows barely does, and the ratio is the part
// worth reading. Arithmetic on declared shapes, not a benchmark.
//
// Server-rendered, zero JS. Multiplication and division only — no transcendental
// reaches the DOM, so lib/dmath is not needed here.

const MFU = 0.5
const BW_EFF = 0.8
const ACH_FLOPS = A100_PEAK_FLOPS * MFU
const ACH_BW = A100_PEAK_BW * BW_EFF

type Shape = { label: string; sub: string; prompt: number; out: number }

const SHAPES: Shape[] = [
  { label: "chat turn", sub: "128-token prompt, 512-token answer", prompt: 128, out: 512 },
  {
    label: "code review",
    sub: "2k-token prompt, 512-token answer",
    prompt: 2048,
    out: 512,
  },
  {
    label: "long-document extraction",
    sub: "8k-token prompt, 128-token answer",
    prompt: 8192,
    out: 128,
  },
]

const PREFILL = "oklch(0.66 0.14 210)"
const DECODE = "oklch(0.66 0.15 150)"

type Budget = {
  shape: Shape
  ttft: number
  itl: number
  stream: number
  total: number
}

const budgets: Budget[] = SHAPES.map((shape) => {
  const compute = prefillFlops(shape.prompt) / ACH_FLOPS
  const memory = passBytes(shape.prompt) / ACH_BW
  const ttft = Math.max(compute, memory)
  // average context over the generation: prompt + half the output
  const itl = passBytes(shape.prompt + shape.out / 2) / ACH_BW
  const stream = itl * shape.out
  return { shape, ttft, itl, stream, total: ttft + stream }
})

const SPAN = Math.max(...budgets.map((b) => b.total))

const ms = (s: number) => (s * 1000).toFixed(s < 0.1 ? 1 : 0)

export function LatencyBudget() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          who owns the clock &middot; prefill (TTFT) vs decode (ITL &times; tokens)
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          Llama-2 7B fp16 on one A100 &middot; 50% MFU, 80% of peak bandwidth
        </span>
      </div>

      <div className="space-y-4 p-3 sm:p-5">
        {budgets.map((b) => {
          const pre = (b.ttft / SPAN) * 100
          const dec = (b.stream / SPAN) * 100
          const share = (b.ttft / b.total) * 100
          return (
            <div key={b.shape.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium">{b.shape.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {b.total.toFixed(2)} s end to end
                </span>
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80">
                {b.shape.sub}
              </p>
              <div className="mt-1.5 flex h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full"
                  style={{ width: `${pre.toFixed(2)}%`, background: PREFILL }}
                />
                <div
                  className="h-full"
                  style={{ width: `${dec.toFixed(2)}%`, background: DECODE }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px]">
                <span style={{ color: PREFILL }}>
                  TTFT {ms(b.ttft)} ms &middot; {share.toFixed(share < 1 ? 1 : 0)}% of
                  the wait
                </span>
                <span style={{ color: DECODE }}>
                  ITL {ms(b.itl)} ms &times; {b.shape.out} tokens = {b.stream.toFixed(2)}{" "}
                  s
                </span>
              </div>
            </div>
          )
        })}

        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              slow to start &rarr; prefill-bound
            </div>
            <p className="mt-0.5 text-[13px] leading-5">
              Only the long-prompt row has a TTFT a reader would notice, and it is the
              one row where prompt caching or chunked prefill pays.
            </p>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground/70">
              slow to stream &rarr; decode-bound
            </div>
            <p className="mt-0.5 text-[13px] leading-5">
              The other two are decode almost end to end. More FLOPs does nothing there;
              a smaller cache, faster memory or bigger batches is the whole menu.
            </p>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Derived from declared shapes and two stated efficiencies, not measured on a
        machine: prefill at 50% of an A100&rsquo;s 312 TFLOP/s, decode at 80% of its
        2,039 GB/s, batch 1. Absolute milliseconds move with those assumptions; the
        prefill-vs-decode split is set by the request shape and barely moves at all.
      </figcaption>
    </figure>
  )
}
