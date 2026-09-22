// What has to fit in 32 GiB for a 256K context to exist at all on one RTX 5090.
//
// The weight arena is measured: docs/performance/qwen3.8-27b.md reports
// "19.729 GiB for NVFP4" against 16.672 GiB for the groupwise-int profile.
//
// The KV column is computed from the published geometry in
// docs/maintainer/qwen3_5-model.md: 64 text layers of which 16 are full
// attention, 4 KV heads, head dimension 256. Per token and per full-attention
// layer that is 4 x 256 elements each of K and V. The per-codec byte counts
// follow the cache kernels in src/ops/kv_cache/:
//   bf16  2 bytes/element
//   fp8   the row-256 E4M3 codec, 256 bytes plus one FP16 row scale
//   k8v4  K as above; V as the group-16 packed E2M1 codec, 128 bytes of codes
//         plus 16 one-byte E4M3 group scales per 256-element row
// Both K8V4 operands are Hadamard-rotated first, which costs no storage.
//
// Only +, -, * and / on integers and exact binary fractions, so lib/dmath is
// not needed; anything transcendental would have to go through it.

const CARD_GIB = 32
const WEIGHTS = 19.729

const LAYERS = 16 // full-attention layers; the other 48 are gated DeltaNet
const KV_HEADS = 4
const HEAD_DIM = 256
const CTX = 262144

// bytes per token, summed over the full-attention layers
const perToken = (kBytes: number, vBytes: number) =>
  LAYERS * KV_HEADS * (kBytes + vBytes)

const BF16 = perToken(HEAD_DIM * 2, HEAD_DIM * 2)
const FP8 = perToken(HEAD_DIM + 2, HEAD_DIM + 2)
const K8V4 = perToken(HEAD_DIM + 2, HEAD_DIM / 2 + HEAD_DIM / 16)

const GIB = 1024 * 1024 * 1024

type Row = { name: string; note: string; bytesPerToken: number }

const ROWS: Row[] = [
  {
    name: "bf16",
    note: "the default --kv-dtype",
    bytesPerToken: BF16,
  },
  {
    name: "fp8",
    note: "row-256 E4M3, K and V",
    bytesPerToken: FP8,
  },
  {
    name: "k8v4",
    note: "FP8 keys, 4-bit values — what this recipe ships",
    bytesPerToken: K8V4,
  },
]

export function MemoryFit() {
  const W = 860
  const left = 128
  const right = 700
  const MAXG = 38
  const x = (g: number) => left + (g / MAXG) * (right - left)

  const rowH = 62
  const top = 48
  const H = top + ROWS.length * rowH + 40

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        RTX 5090, 32 GiB · Huihui Qwen3.8-27B NVFP4 weight arena 19.729 GiB · KV
        for a full 262,144-token context
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Three stacked bars against a 38 gibibyte ruler with the 32 gibibyte card limit marked. Each bar is the 19.729 gibibyte weight arena plus the KV cache for a full 262,144-token context. With bf16 keys and values the cache is 16.00 gibibytes and the total is 35.73, past the card limit. With fp8 it is 8.06 and the total is 27.79, inside. With k8v4 it is 6.28 and the total is 26.01, leaving about six gibibytes of headroom."
      >
        {[0, 8, 16, 24, 32].map((g) => (
          <g key={g}>
            <line
              x1={x(g)}
              y1={top - 14}
              x2={x(g)}
              y2={H - 30}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(g)}
              y={top - 20}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {g}
            </text>
          </g>
        ))}
        <text
          x={left}
          y={top - 34}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          GiB
        </text>

        <line
          x1={x(CARD_GIB)}
          y1={top - 14}
          x2={x(CARD_GIB)}
          y2={H - 30}
          className="stroke-destructive"
          strokeWidth={1.75}
        />
        <text
          x={x(CARD_GIB) + 6}
          y={top - 20}
          className="fill-destructive font-mono"
          style={{ fontSize: 10 }}
        >
          32 GiB card
        </text>

        {ROWS.map((r, i) => {
          const kv = (r.bytesPerToken * CTX) / GIB
          const total = WEIGHTS + kv
          const y = top + i * rowH
          const barH = 30
          const fits = total < CARD_GIB
          return (
            <g key={r.name}>
              <text
                x={14}
                y={y + 16}
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {r.name}
              </text>
              <text
                x={14}
                y={y + 29}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {r.note}
              </text>
              <text
                x={14}
                y={y + 42}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {(r.bytesPerToken / 1024).toFixed(2)} KiB/token
              </text>

              <rect
                x={left}
                y={y}
                width={x(WEIGHTS) - left}
                height={barH}
                rx={2}
                className="fill-foreground/45 stroke-foreground"
                strokeWidth={1.25}
              />
              <text
                x={left + 8}
                y={y + 20}
                className="fill-background font-mono"
                style={{ fontSize: 10 }}
              >
                weights 19.73
              </text>

              <rect
                x={x(WEIGHTS)}
                y={y}
                width={x(total) - x(WEIGHTS)}
                height={barH}
                rx={2}
                className={
                  fits
                    ? "fill-foreground/12 stroke-foreground/50"
                    : "fill-destructive/20 stroke-destructive"
                }
                strokeWidth={1.25}
              />
              <text
                x={x(WEIGHTS) + 8}
                y={y + 20}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                KV {kv.toFixed(2)}
              </text>

              <text
                x={x(total) + 10}
                y={y + 20}
                className={
                  fits
                    ? "fill-foreground font-mono"
                    : "fill-destructive font-mono"
                }
                style={{ fontSize: 11 }}
              >
                {total.toFixed(2)} GiB
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Quantizing the cache is not what makes the 256K context possible &mdash;
        FP8 already fits, with 4.2 GiB to spare. What K8V4 buys is a further 1.8
        GiB, and it buys it by halving only the values. The reason any of this
        fits on a consumer card is upstream of the codec:{" "}
        <strong className="font-medium text-foreground">
          48 of this model&rsquo;s 64 layers are gated DeltaNet
        </strong>{" "}
        and keep a fixed 144 MiB recurrent state instead of a cache that grows.
        Only 16 layers are drawn here, because only 16 layers have a KV cache at
        all.
      </figcaption>
    </figure>
  )
}
