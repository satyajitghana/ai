// How a hybrid model's linear-attention layers set the page size for its
// attention layers, and what that costs per request.
//
// All inputs are from the vLLM post's KV-cache section for Qwen3.8-2.4T:
//   full-attention state  4 KV heads x 256 head dim x 1 byte (float8_e4m3fn)
//                         x 2 for K and V = 2,048 B = 2 KiB per token per layer
//   GDN SSM state         128 value heads x 128 x 128 x 2 bytes (bf16) = 4 MiB
//                         per request per layer
//   GDN conv state        (128 x 16 x 2 + 128 x 128) x 3 x 2 bytes = 120 KiB
//   92 layers: 23 full attention, 69 GDN
// Block size is then align(4216 KiB / 2 KiB, 16) = 2,112 tokens, and one block
// is 2,112 x 2 KiB = 4.125 MiB.
//
// The per-request total recomputed here lands on the post's stated 759 MiB
// exactly, which is the point of showing the working.
//
// Integer and exact-binary-fraction arithmetic only; lib/dmath is not needed.

const FULL_LAYERS = 23
const GDN_LAYERS = 69
const KIB_PER_TOKEN_PER_LAYER = 2
const GDN_STATE_KIB = 4 * 1024 + 120 // 4 MiB SSM + 120 KiB conv
const BLOCK_TOKENS = 2112
const BLOCK_MIB = (BLOCK_TOKENS * KIB_PER_TOKEN_PER_LAYER) / 1024

const ISL = 8192
const OSL = 1024
const TOKENS = ISL + OSL

const FULL_BLOCKS_PER_LAYER = Math.ceil(TOKENS / BLOCK_TOKENS)
const FULL_BLOCKS = FULL_BLOCKS_PER_LAYER * FULL_LAYERS
const GDN_BLOCKS = GDN_LAYERS
const TOTAL_BLOCKS = FULL_BLOCKS + GDN_BLOCKS

const FULL_MIB = FULL_BLOCKS * BLOCK_MIB
const GDN_MIB = GDN_BLOCKS * BLOCK_MIB
const TOTAL_MIB = FULL_MIB + GDN_MIB

export function BlockArithmetic() {
  const W = 860
  const H = 268
  const left = 40
  const right = 700
  const barY = 128
  const barH = 44

  const x = (mib: number) => left + (mib / TOTAL_MIB) * (right - left)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one request · Qwen3.8-2.4T · 8,192 in + 1,024 out · block size 2,112
        tokens, set by the GDN state
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A single bar representing 759 mebibytes of KV cache for one request, split in two. The left segment is 474.375 mebibytes across 115 blocks: five blocks in each of 23 full-attention layers. The right segment is 284.625 mebibytes across 69 blocks: exactly one block in each of 69 gated DeltaNet layers, whose state does not grow with context. Above the left segment, a note marks that five blocks of 2,112 tokens is 10,560 slots for 9,216 tokens, so 12.7 percent of the full-attention allocation is never written."
      >
        <text
          x={left}
          y={38}
          className="fill-foreground font-mono"
          style={{ fontSize: 12 }}
        >
          GDN state {GDN_STATE_KIB.toLocaleString("en-US")} KiB &divide; full-attn{" "}
          {KIB_PER_TOKEN_PER_LAYER} KiB/token ={" "}
          {GDN_STATE_KIB / KIB_PER_TOKEN_PER_LAYER}, aligned to 16 &rarr;{" "}
          {BLOCK_TOKENS.toLocaleString("en-US")} tokens per block
        </text>
        <text
          x={left}
          y={56}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          one block = {BLOCK_TOKENS.toLocaleString("en-US")} &times;{" "}
          {KIB_PER_TOKEN_PER_LAYER} KiB = {BLOCK_MIB} MiB. vLLM&rsquo;s usual
          block is 16 tokens; this one is {BLOCK_TOKENS / 16}&times; coarser.
        </text>

        <text
          x={left}
          y={92}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          {FULL_BLOCKS_PER_LAYER} blocks &times; {FULL_LAYERS} full-attention
          layers = {FULL_BLOCKS}
        </text>
        <text
          x={left}
          y={108}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          {FULL_BLOCKS_PER_LAYER} &times;{" "}
          {BLOCK_TOKENS.toLocaleString("en-US")} ={" "}
          {(FULL_BLOCKS_PER_LAYER * BLOCK_TOKENS).toLocaleString("en-US")} slots
          for {TOKENS.toLocaleString("en-US")} tokens &mdash;{" "}
          {(
            (1 - TOKENS / (FULL_BLOCKS_PER_LAYER * BLOCK_TOKENS)) *
            100
          ).toFixed(1)}
          % never written
        </text>

        <rect
          x={x(0)}
          y={barY}
          width={x(FULL_MIB) - x(0)}
          height={barH}
          rx={3}
          className="fill-foreground/45 stroke-foreground"
          strokeWidth={1.25}
        />
        <text
          x={x(0) + 12}
          y={barY + 20}
          className="fill-background font-mono"
          style={{ fontSize: 12 }}
        >
          full attention · {FULL_BLOCKS} blocks
        </text>
        <text
          x={x(0) + 12}
          y={barY + 35}
          className="fill-background font-mono"
          style={{ fontSize: 10 }}
        >
          {FULL_MIB} MiB · grows with every token
        </text>

        <rect
          x={x(FULL_MIB)}
          y={barY}
          width={x(TOTAL_MIB) - x(FULL_MIB)}
          height={barH}
          rx={3}
          className="fill-foreground/12 stroke-foreground/55"
          strokeWidth={1.25}
        />
        <text
          x={x(FULL_MIB) + 12}
          y={barY + 20}
          className="fill-foreground font-mono"
          style={{ fontSize: 12 }}
        >
          GDN · {GDN_BLOCKS} blocks
        </text>
        <text
          x={x(FULL_MIB) + 12}
          y={barY + 35}
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {GDN_MIB} MiB · fixed, whatever the context
        </text>

        <text
          x={x(TOTAL_MIB) + 12}
          y={barY + 27}
          className="fill-foreground font-mono"
          style={{ fontSize: 13 }}
        >
          {TOTAL_MIB} MiB
        </text>

        <text
          x={left}
          y={barY + barH + 34}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {TOTAL_BLOCKS} blocks &times; {BLOCK_MIB} MiB ={" "}
          {TOTAL_MIB.toFixed(0)} MiB per request &mdash; the figure the
          post&rsquo;s concurrency column divides by
        </text>
        <text
          x={left}
          y={barY + barH + 50}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {((GDN_MIB / TOTAL_MIB) * 100).toFixed(1)}% of a request&rsquo;s KV
          budget has nothing to do with how long the request is
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Because one gated-DeltaNet state is{" "}
        <strong className="font-medium text-foreground">2,108&times;</strong> a
        full-attention token, the block has to be big enough to hold it &mdash;
        and the attention layers then have to use the same block. A 9,216-token
        request rounds up to 10,560 slots in each of 23 layers, and 37.5% of the
        per-request budget is recurrent state that a 200-token request would pay
        in full. On a hybrid model, the linear layers set the page size for
        everyone.
      </figcaption>
    </figure>
  )
}
