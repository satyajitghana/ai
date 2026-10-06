// Where MiniMax H3's bytes go on the way to an 8 GiB card. Server-rendered, zero JS.
//
// Every "measured" figure is read from a file: the transformer index's
// total_size (OpenVDN/vdn-minimax-h3, h3-base/transformer), safetensors headers
// read over HTTP range requests (block 0 of h3-base and of the prepared
// OpenVDN/vdn-minimax-h3-edge cache), and FreeVideo's own model_files.json for
// the text encoder. "Reasoned" rows are arithmetic on those.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const MUTED = "oklch(0.62 0.03 250)"

type Row = { label: string; sub: string; gb: number; color: string; tag: "measured" | "reasoned" }

const SCALE = 70 // GB, full width

const TRANSFORMER: Row[] = [
  {
    label: "H3 transformer, BF16 as released",
    sub: "33.14B parameters · 50 blocks + 2 refiner blocks",
    gb: 66.28,
    color: MUTED,
    tag: "measured",
  },
  {
    label: "… without the AdaLN projections",
    sub: "50 × 96768×2688 weights replaced by 8-step tables (0.22 GB)",
    gb: 40.26,
    color: WARM,
    tag: "reasoned",
  },
  {
    label: "… with the wide matrices in FP8",
    sub: "50 × 432.4 MB blocks + 0.93 GB root · VDN branch included",
    gb: 22.55,
    color: ACCENT,
    tag: "measured",
  },
]

const AROUND: Row[] = [
  {
    label: "Qwen3-VL-32B text encoder, BF16",
    sub: "MiniMaxAI/MiniMax-H3 text_encoder shards",
    gb: 66.71,
    color: MUTED,
    tag: "measured",
  },
  {
    label: "… NVFP4 AWQ, as FreeVideo installs it",
    sub: "runs in its own process, exits before the transformer loads",
    gb: 15.69,
    color: ACCENT,
    tag: "measured",
  },
  {
    label: "Video VAE, BF16",
    sub: "decoder is 36 transformer blocks; streamed below a 20 GiB budget",
    gb: 10.42,
    color: WARM,
    tag: "measured",
  },
]

function Rows({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-medium">{r.label}</span>
            <span className="shrink-0 font-mono">
              {r.gb.toFixed(2)} GB{" "}
              <span className="text-[10px] text-muted-foreground">{r.tag}</span>
            </span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded bg-muted/30">
            <div
              className="h-full rounded"
              style={{ width: `${((r.gb / SCALE) * 100).toFixed(2)}%`, background: r.color }}
            />
          </div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">{r.sub}</div>
        </div>
      ))}
    </div>
  )
}

export function WeightLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        bytes on disk, decimal GB · bar width out of 70 GB
      </div>
      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            the denoiser
          </div>
          <Rows rows={TRANSFORMER} />
        </div>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            what runs around it
          </div>
          <Rows rows={AROUND} />
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Even after both cuts the transformer is 22.55 GB, nearly three times an 8 GiB card. Nothing
        here makes it fit. It makes it small enough to stream: with 16 GiB of system RAM even the
        host cannot hold all of it, and the project&apos;s own grid marks that configuration as
        re-reading part of the stack from disk on every step.
      </figcaption>
    </figure>
  )
}
