// What the handbook's KV-cache calculator says, and what the model actually
// holds, for one 262,144-token sequence of Qwen3-Next-80B-A3B-Instruct.
//
// The calculator's standard mode is
//     2 * B * S * L * H * D * (Q/8)
// with H labelled "Attention Heads (H)" and the surrounding page pointing the
// reader at the number of attention heads in config.json. Every field below is
// read straight out of that config:
//
//   num_hidden_layers        48
//   full_attention_interval   4   -> 12 full-attention layers, 36 gated DeltaNet
//   num_attention_heads      16
//   num_key_value_heads       2
//   head_dim                256
//   hidden_size            2048   (the "simplified" mode's H x D)
//   linear_num_value_heads   32 , linear_key_head_dim / linear_value_head_dim 128
//   linear_conv_kernel_dim    4
//
// Two factors separate the two numbers and they multiply: grouped-query
// attention shares each cached head across 8 query heads, and three quarters of
// the layers keep a fixed recurrent state instead of a cache. 16/2 * 48/12 = 32.
//
// Integer arithmetic throughout; nothing here needs lib/dmath.

const LAYERS = 48
const FULL_LAYERS = 12
const Q_HEADS = 16
const KV_HEADS = 2
const HEAD_DIM = 256
const HIDDEN = 2048
const BYTES = 2 // fp16 / bf16
const SEQ = 262144

const GIB = 1024 * 1024 * 1024
const MIB = 1024 * 1024

// bytes per token, three readings of the same model
const CALC = 2 * LAYERS * Q_HEADS * HEAD_DIM * BYTES
const SIMPLE = 2 * LAYERS * HIDDEN * BYTES
const GQA_ONLY = 2 * LAYERS * KV_HEADS * HEAD_DIM * BYTES
const TRUE = 2 * FULL_LAYERS * KV_HEADS * HEAD_DIM * BYTES

// The part that does not grow with context: 36 gated-DeltaNet layers, each
// holding a [32 value heads x 128 x 128] recurrent matrix in fp32 (2 MiB) plus
// a convolution history of conv_dim x (kernel-1) = 8,192 x 3. The conv history
// is a rounding error at either dtype; fp32 is the larger reading and is used
// here so the fixed share is not understated.
const GDN_LAYERS = LAYERS - FULL_LAYERS
const GDN_STATE = GDN_LAYERS * 32 * 128 * 128 * 4
const GDN_CONV = GDN_LAYERS * (128 * 16 * 2 + 128 * 32) * 3 * 4
const FIXED = GDN_STATE + GDN_CONV

const SHORT = 2048

type Step = { label: string; sub: string; bytes: number; tone: "bad" | "mid" | "good" }

const STEPS: Step[] = [
  {
    label: "calculator, standard mode",
    sub: `H = num_attention_heads = ${Q_HEADS}, L = ${LAYERS}`,
    bytes: CALC,
    tone: "bad",
  },
  {
    label: "÷ 8 — grouped-query attention",
    sub: `${Q_HEADS} query heads share ${KV_HEADS} cached KV heads`,
    bytes: GQA_ONLY,
    tone: "mid",
  },
  {
    label: "÷ 4 — hybrid attention",
    sub: `only ${FULL_LAYERS} of ${LAYERS} layers keep a cache at all`,
    bytes: TRUE,
    tone: "good",
  },
]

export function CacheLadder() {
  const W = 880
  const H = 320
  const left = 250
  const right = 700
  const top = 58
  const rowH = 58

  const x = (b: number) => left + (b / CALC) * (right - left)
  const gib = (b: number) => (b * SEQ) / GIB

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Qwen3-Next-80B-A3B-Instruct &middot; one sequence of{" "}
        {SEQ.toLocaleString("en-US")} tokens &middot; fp16 KV &middot; bars are
        bytes per token, labels are the whole sequence
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[840px]"
        role="img"
        aria-label="Three stacked bars for one 262,144-token sequence of Qwen3-Next-80B. The handbook's KV cache calculator, filled in with the model's 16 attention heads and 48 layers, gives 786,432 bytes per token, which is 192 gibibytes for the sequence. Dividing by eight for grouped-query attention, since 16 query heads share 2 cached key-value heads, gives 98,304 bytes per token or 24 gibibytes. Dividing by four again because only 12 of the 48 layers keep a KV cache at all gives 24,576 bytes per token or 6 gibibytes. The two corrections multiply to 32."
      >
        {STEPS.map((s, i) => {
          const y0 = top + i * rowH
          const cls =
            s.tone === "bad"
              ? "fill-destructive/30 stroke-destructive"
              : s.tone === "mid"
                ? "fill-foreground/20 stroke-foreground/70"
                : "fill-foreground/70 stroke-foreground"
          return (
            <g key={s.label}>
              <text
                x={left - 14}
                y={y0 + 15}
                textAnchor="end"
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {s.label}
              </text>
              <text
                x={left - 14}
                y={y0 + 30}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {s.sub}
              </text>
              <rect
                x={x(0)}
                y={y0}
                width={Math.max(2, x(s.bytes) - x(0))}
                height={26}
                rx={2}
                className={cls}
                strokeWidth={1.25}
              />
              <text
                x={Math.max(x(s.bytes), x(0) + 2) + 10}
                y={y0 + 12}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {gib(s.bytes).toFixed(0)} GiB
              </text>
              <text
                x={Math.max(x(s.bytes), x(0) + 2) + 10}
                y={y0 + 25}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {s.bytes.toLocaleString("en-US")} B/token
              </text>
            </g>
          )
        })}

        {/* the simplified mode, on the same model, disagreeing with the standard one */}
        <line
          x1={x(SIMPLE)}
          y1={top - 26}
          x2={x(SIMPLE)}
          y2={top + 2 * rowH + 26}
          className="stroke-destructive"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text
          x={x(SIMPLE) + 6}
          y={top - 30}
          className="fill-destructive font-mono"
          style={{ fontSize: 10 }}
        >
          same calculator, &ldquo;simplified&rdquo; mode (H&times;D = hidden_size{" "}
          {HIDDEN}) &rarr; {gib(SIMPLE).toFixed(0)} GiB
        </text>

        <g transform={`translate(${left - 14}, ${top + 3 * rowH + 4})`}>
          <text
            x={0}
            y={0}
            textAnchor="end"
            className="fill-foreground font-mono"
            style={{ fontSize: 12 }}
          >
            overstatement
          </text>
          <text
            x={14}
            y={0}
            className="fill-foreground font-mono"
            style={{ fontSize: 12 }}
          >
            {Q_HEADS / KV_HEADS}&times; (GQA) &times; {LAYERS / FULL_LAYERS}
            &times; (hybrid) = {CALC / TRUE}&times;
          </text>
          <text
            x={14}
            y={18}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            192 GiB does not fit on an H200. 6 GiB fits on a laptop card with
            room to spare.
          </text>
          <text
            x={14}
            y={36}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            and {(FIXED / MIB).toFixed(1)} MiB of recurrent state is fixed
            &mdash; at a {SHORT.toLocaleString("en-US")}-token request that is{" "}
            {((FIXED / (FIXED + TRUE * SHORT)) * 100).toFixed(0)}% of the
            request&rsquo;s KV budget and none of it grows with context
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Both corrections are properties of the model, not of the serving stack,
        and both are in the same <code>config.json</code> the handbook tells you
        to read &mdash; just not in the fields it names. The calculator&rsquo;s
        own two modes also disagree with each other by 2&times; here, because
        this model&rsquo;s{" "}
        <code>num_attention_heads &times; head_dim</code> is twice its{" "}
        <code>hidden_size</code>.
      </figcaption>
    </figure>
  )
}
