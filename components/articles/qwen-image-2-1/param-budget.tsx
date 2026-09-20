import { cn } from "@/lib/utils"

// Where Qwen-Image-2.1's 7,115,124,736 denoiser parameters actually sit, and
// what two config lines cost the model in size.
//
// Every figure below is derived from the shipped safetensors headers, pulled
// over HTTP range reads of
// Qwen/Qwen-Image-2.1/transformer/diffusion_pytorch_model-0000{1,2}-of-00002
// (8 bytes for the little-endian u64 header length, a second range read for the
// JSON header, which carries every tensor's name, dtype and shape). 297 tensors,
// all BF16, no bias tensors anywhere. The sum reconciles exactly with the
// index's own total_size of 14,230,249,472 bytes at 2 bytes per parameter.
//
// The counterfactual column is arithmetic on the same shapes, not a measurement:
// what the identical 32-layer / 4096-wide stack would weigh with per-block
// modulation (the ordinary DiT arrangement) and with mlp_ratio 4 (the ordinary
// transformer arrangement) instead of the 3 this checkpoint ships.
//
// Server-rendered, zero JS. Arithmetic is integer multiply and add only.

const D = 4096 // num_attention_heads 32 x attention_head_dim 128
const LAYERS = 32
const MLP_RATIO = 3

const ATTN_PER_BLOCK = 4 * D * D // to_q, to_k, to_v, to_out.0 — all bias-free
const MLP_PER_BLOCK = 3 * D * (D * MLP_RATIO) // SwiGLU: proj, gate_layer, out
const NORM_PER_BLOCK = 2 * 128 // attn.norm_q, attn.norm_k over head_dim

const SHARED_MODULATION = D * 4 * D // one Linear(4096 -> 4x4096) for all 32 blocks
const TIME_EMBED = 256 * D + D * D
const TXT_IN = D * D + D * D + D // text_norm, in_layer, out_layer
const IMG_IN = 64 * D
const NORM_OUT = D * D
const PROJ_OUT = D * 64

const TOTAL = 7_115_124_736

type Row = { label: string; note: string; params: number; tone: "mlp" | "attn" | "trim" }

const ROWS: Row[] = [
  {
    label: "img_mlp x32",
    note: "SwiGLU, 4,096 <-> 12,288, three matrices per block",
    params: MLP_PER_BLOCK * LAYERS,
    tone: "mlp",
  },
  {
    label: "attn x32",
    note: "q/k/v/o, one shared stream over text + images",
    params: ATTN_PER_BLOCK * LAYERS,
    tone: "attn",
  },
  {
    label: "modulation",
    note: "one Linear(4,096 -> 16,384) for every block: scale and gate, twice, no shift",
    params: SHARED_MODULATION,
    tone: "trim",
  },
  {
    label: "txt_in",
    note: "RMSNorm + GELU MLP lifting Qwen3-VL's 4,096-wide states into the stream",
    params: TXT_IN,
    tone: "trim",
  },
  {
    label: "norm_out + time_embed",
    note: "scale-only final AdaLN, sinusoidal timestep projection",
    params: NORM_OUT + TIME_EMBED,
    tone: "trim",
  },
  {
    label: "img_in + proj_out + norms",
    note: "64-channel latents in and out, per-block q/k norms",
    params: IMG_IN + PROJ_OUT + NORM_PER_BLOCK * LAYERS,
    tone: "trim",
  },
]

const PER_BLOCK_MODULATION = SHARED_MODULATION * LAYERS - SHARED_MODULATION
const MLP_RATIO_4 = (3 * D * (D * 4) - MLP_PER_BLOCK) * LAYERS
const COUNTERFACTUAL = TOTAL + PER_BLOCK_MODULATION + MLP_RATIO_4

const PIPELINE = [
  { label: "transformer", params: 7_115_124_736, note: "QwenImage21Transformer2DModel, BF16" },
  { label: "text_encoder", params: 8_767_123_696, note: "Qwen3VLForConditionalGeneration, BF16" },
  { label: "vae", params: 337_740_404, note: "AutoencoderKLQwenImage21, FP32" },
  { label: "PE rewriter", params: 9_409_813_744, note: "Qwen-Image-2.1-PE-T2I, the recommended prompt path" },
]
const PIPELINE_TOTAL = PIPELINE.reduce((a, b) => a + b.params, 0)

const TONE: Record<Row["tone"], string> = {
  mlp: "bg-foreground/80",
  attn: "bg-foreground/45",
  trim: "bg-foreground/20",
}

const pct = (n: number, of: number) => ((n * 100) / of).toFixed(1)
const bn = (n: number) => (n / 1_000_000_000).toFixed(2)

export function ParamBudget() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-param-budget={TOTAL}
      aria-label="Parameter budget of the Qwen-Image-2.1 denoiser, read from its safetensors headers"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        transformer/ — 297 tensors, all BF16, {TOTAL.toLocaleString("en-US")}{" "}
        parameters
      </div>

      <div className="space-y-2 px-4 py-4">
        {ROWS.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-right font-mono text-xs sm:w-44">
              {r.label}
            </span>
            <div className="relative h-6 flex-1 rounded-sm bg-muted/50">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-sm", TONE[r.tone])}
                style={{ width: `${(r.params * 100) / TOTAL}%` }}
              />
            </div>
            <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums sm:w-28">
              {pct(r.params, TOTAL)}%
            </span>
          </div>
        ))}
      </div>

      <ul className="my-0 list-none space-y-1 border-t px-4 py-3 pl-4 text-xs text-muted-foreground">
        {ROWS.map((r) => (
          <li key={r.label} className="my-0">
            <span className="font-mono text-foreground">{r.label}</span>{" "}
            — {r.params.toLocaleString("en-US")} params. {r.note}
          </li>
        ))}
      </ul>

      <div className="border-t px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          the same 32 x 4,096 stack, built the ordinary way
        </p>
        <dl className="mt-2 grid gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-2">
          <dt className="text-muted-foreground">as shipped</dt>
          <dd className="my-0 tabular-nums">{bn(TOTAL)}B</dd>
          <dt className="text-muted-foreground">
            + modulation per block, not shared
          </dt>
          <dd className="my-0 tabular-nums">
            +{bn(PER_BLOCK_MODULATION)}B
          </dd>
          <dt className="text-muted-foreground">+ mlp_ratio 4, not 3</dt>
          <dd className="my-0 tabular-nums">+{bn(MLP_RATIO_4)}B</dd>
          <dt className="font-medium text-foreground">would weigh</dt>
          <dd className="my-0 font-medium tabular-nums">
            {bn(COUNTERFACTUAL)}B
          </dd>
        </dl>
        <p className="mt-3 mb-0 text-xs text-muted-foreground">
          Two config lines —{" "}
          <span className="font-mono text-foreground">mlp_ratio: 3</span>{" "}
          and a single shared modulation projection — take{" "}
          {bn(PER_BLOCK_MODULATION + MLP_RATIO_4)}B off the denoiser, which is{" "}
          {pct(PER_BLOCK_MODULATION + MLP_RATIO_4, COUNTERFACTUAL)}% of what the
          conventional arrangement would have cost. Depth and width are unchanged.
        </p>
      </div>

      <div className="border-t px-4 py-4">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          what the &ldquo;7B&rdquo; sits inside
        </p>
        <div className="mt-3 space-y-2">
          {PIPELINE.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-right font-mono text-xs sm:w-44">
                {p.label}
              </span>
              <div className="relative h-5 flex-1 rounded-sm bg-muted/50">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-sm",
                    p.label === "transformer"
                      ? "bg-foreground/80"
                      : "bg-foreground/30"
                  )}
                  style={{ width: `${(p.params * 100) / PIPELINE_TOTAL}%` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right font-mono text-xs tabular-nums sm:w-28">
                {bn(p.params)}B
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 mb-0 text-xs text-muted-foreground">
          {PIPELINE_TOTAL.toLocaleString("en-US")}{" "}
          parameters end to end on the path the README recommends. The denoiser
          everybody quotes is{" "}
          {pct(TOTAL, PIPELINE_TOTAL)}% of it. Drop the optional prompt rewriter
          and the pipeline you still have to download is{" "}
          {bn(PIPELINE_TOTAL - 9_409_813_744)}B.
        </p>
      </div>
    </figure>
  )
}
