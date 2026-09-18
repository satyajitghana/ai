// The same model, two deployments, and a cost that moves house.
//
// Server-rendered, zero JS. Every constant is measured, not quoted; the only
// arithmetic is +, -, * and /, all exact under IEEE-754, so lib/dmath is not
// needed here.
//
// Ground truth:
//   - KV bytes/token = 42 layers x 2 KV heads x 128 head_dim x 2 (K and V)
//     x 2 bytes (f16) = 43,008. This is the number the rest of the article
//     derives, straight out of openbmb/MiniCPM5-2B's config.json.
//   - 1,561,318,368 bytes for MiniCPM5-2B-Q4_K_M.gguf and 1,834,167,351 bytes
//     for the eight files of Mike0021/MiniCPM5-2B-ONNX at revision 04a6c49 --
//     both read from Content-Length after following the Hugging Face CDN
//     redirect, not from a card.
//   - 534,773,760 bytes of FP16 embedding: vocab_size 130,560 x hidden_size
//     2,048 x 2 bytes, which is 510.00 MiB exactly, and exactly the sum of
//     onnx_data_5 and onnx_data_6 (267,386,880 bytes each). The conversion
//     notes call it "lossless splitting of the 510 MiB embedding allocation
//     into four 127.5 MiB tensors"; 133,693,440 bytes is 127.5 MiB, and four
//     of them is the whole table. The split is visible in the byte sizes.
//   - 8,192 is the browser app's stated prompt-plus-output budget; 131,072 is
//     max_position_embeddings.
//
// The point: at 131K the KV cache is 78% of the bill and the weights are the
// rounding error. In a browser tab at 8K it inverts -- the cache is 16%, and
// one FP16 lookup table is larger than the entire cache.

const KV_BYTES_PER_TOKEN = 42 * 2 * 128 * 2 * 2 // 43,008

const NATIVE_CTX = 131_072
const BROWSER_CTX = 8_192

const GGUF_Q4KM = 1_561_318_368
const ONNX_WEIGHTS = 1_834_167_351
const EMBED_FP16 = 130_560 * 2_048 * 2 // 534,773,760
const EMBED_SHARD = EMBED_FP16 / 4 // 133,693,440 = 127.5 MiB
const ONNX_QUANTIZED = ONNX_WEIGHTS - EMBED_FP16

const MIB = 1024 * 1024

const KV_COLOR = "oklch(0.64 0.16 35)"
const W_COLOR = "oklch(0.62 0.15 255)"
const EMBED_COLOR = "oklch(0.72 0.14 85)"

type Lane = {
  label: string
  sub: string
  segments: { name: string; bytes: number; color: string }[]
}

const LANES: Lane[] = [
  {
    label: "llama.cpp, RTX 3060, 131,072 tokens",
    sub: "MiniCPM5-2B-Q4_K_M.gguf, f16 KV cache",
    segments: [
      { name: "weights", bytes: GGUF_Q4KM, color: W_COLOR },
      { name: "KV cache", bytes: KV_BYTES_PER_TOKEN * NATIVE_CTX, color: KV_COLOR },
    ],
  },
  {
    label: "transformers.js + WebGPU, 8,192 tokens",
    sub: "MiniCPM5-2B-ONNX q4f16, f16 KV cache",
    segments: [
      { name: "FP16 embedding", bytes: EMBED_FP16, color: EMBED_COLOR },
      { name: "int4 weights", bytes: ONNX_QUANTIZED, color: W_COLOR },
      { name: "KV cache", bytes: KV_BYTES_PER_TOKEN * BROWSER_CTX, color: KV_COLOR },
    ],
  },
]

function gb(bytes: number): string {
  return (bytes / 1e9).toFixed(3)
}

function pct(part: number, whole: number): string {
  return ((part / whole) * 100).toFixed(1)
}

export function BrowserBudget() {
  const W = 560
  const barMax = W - 92
  const max = Math.max(...LANES.map((l) => l.segments.reduce((a, s) => a + s.bytes, 0)))
  const scale = (bytes: number) => (bytes / max) * barMax

  const nativeKv = KV_BYTES_PER_TOKEN * NATIVE_CTX
  const browserKv = KV_BYTES_PER_TOKEN * BROWSER_CTX
  const nativeTotal = GGUF_Q4KM + nativeKv
  const browserTotal = ONNX_WEIGHTS + browserKv

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          config.json KV geometry &middot; file sizes measured after the CDN redirect
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">decimal GB</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 136`} width={W} height={136} role="img" className="w-full">
          <title>
            {`At 131,072 tokens the KV cache is ${pct(nativeKv, nativeTotal)}% of ${gb(nativeTotal)} GB. In a browser tab at 8,192 tokens it is ${pct(browserKv, browserTotal)}% of ${gb(browserTotal)} GB, and the FP16 embedding table alone is ${pct(EMBED_FP16, browserTotal)}%.`}
          </title>
          {LANES.map((lane, i) => {
            const y = 22 + i * 54
            const total = lane.segments.reduce((a, s) => a + s.bytes, 0)
            let x = 0
            return (
              <g key={lane.label}>
                <text x={0} y={y - 11} fontSize={9.5} fill="currentColor" fontFamily="ui-monospace, monospace">
                  {lane.label}
                </text>
                <text
                  x={0}
                  y={y - 2}
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.55}
                  fontFamily="ui-monospace, monospace"
                >
                  {lane.sub}
                </text>
                {lane.segments.map((s) => {
                  const w = scale(s.bytes)
                  const seg = (
                    <rect
                      key={s.name}
                      x={x}
                      y={y + 3}
                      width={w}
                      height={18}
                      rx={2}
                      fill={s.color}
                      fillOpacity={0.82}
                    />
                  )
                  x += w
                  return seg
                })}
                <text
                  x={x + 7}
                  y={y + 16}
                  fontSize={9}
                  fill="currentColor"
                  fontFamily="ui-monospace, monospace"
                >
                  {gb(total)} GB
                </text>
              </g>
            )
          })}
          <text
            x={0}
            y={130}
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.6}
            fontFamily="ui-monospace, monospace"
          >
            <tspan fill={EMBED_COLOR}>&#9632;</tspan> FP16 embedding (510 MiB, four shards)
            &nbsp;&nbsp;
            <tspan fill={W_COLOR}>&#9632;</tspan> quantized weights
            &nbsp;&nbsp;
            <tspan fill={KV_COLOR}>&#9632;</tspan> KV cache at full context
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10.5px] sm:grid-cols-4">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">KV share at 131K</div>
            <div className="text-foreground">{pct(nativeKv, nativeTotal)}%</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">KV share at 8K</div>
            <div className="text-foreground">{pct(browserKv, browserTotal)}%</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">embedding share</div>
            <div className="text-foreground">{pct(EMBED_FP16, ONNX_WEIGHTS)}%</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">one embedding shard</div>
            <div className="text-foreground">{(EMBED_SHARD / MIB).toFixed(1)} MiB</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The 8:1 GQA ratio is doing the same work in both lanes; only the context budget changed, and that is
          enough to invert which side of the ledger matters. At 131,072 tokens the cache is{" "}
          {pct(nativeKv, nativeTotal)}% of the bill and the quant choice is almost irrelevant. At the browser
          build&rsquo;s 8,192-token budget the cache falls to {(browserKv / MIB).toFixed(0)} MiB &mdash;{" "}
          {pct(browserKv, browserTotal)}% &mdash; and the single largest object in the tab becomes the FP16
          embedding table, {(EMBED_FP16 / MIB).toFixed(0)} MiB of it, which WebGPU will not accept as one binding
          and which the conversion therefore cuts into four {(EMBED_SHARD / MIB).toFixed(1)} MiB pieces. That is
          why a &ldquo;4-bit&rdquo; browser build ({gb(ONNX_WEIGHTS)} GB) is{" "}
          {pct(ONNX_WEIGHTS - GGUF_Q4KM, GGUF_Q4KM)}% larger on disk than the Q4_K_M GGUF ({gb(GGUF_Q4KM)} GB) of
          the same checkpoint. Reading the GGUF&rsquo;s own tensor table,{" "}
          <code className="font-mono text-xs">token_embd.weight</code> is held at Q4_K &mdash; 4.5 bits, 150 MB for
          the same matrix &mdash; while this export leaves it at sixteen. One tensor, 3.6&times; the bytes.
        </p>
      </div>
    </figure>
  )
}
