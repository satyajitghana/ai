// Where MoVA's routing happens, relative to where the KV cache starts.
//
// Transcribed from K2HorizonMoVAAttention.forward in the repository's
// modeling_k2_horizon.py. The order of operations is the whole answer to "if
// values are routed per token, what does the cache store?":
//
//   router_logits    = x @ v_router.weight.T                 (2560 -> 64)
//   weights, idx     = top-4, sigmoid scores, bias on selection only,
//                      renormalised, scaled by router_scaling_factor 2.5
//   mixed_value      = Σ_k w_k · SiLU(x @ v_experts[idx_k].T) (2560 -> 1024)
//   value_states     = mixed_value.view(..., 8, 128)
//   ...
//   past_key_values.update(key_states, value_states, layer_idx)
//
// The mixture is collapsed into one (8 × 128) tensor BEFORE the cache is
// touched. The cache therefore stores exactly what a GQA model stores, and the
// attention kernel downstream sees a bog-standard GQA tensor, which is why
// FlashAttention needs no change. Routing is a property of the write, not of
// the cache.
//
// Server-rendered inline SVG, no JS. Geometry is derived from a single column
// grid so the cache boundary lines up across all three branches.

const W = 700
const H = 360

// column x-centres
const X_IN = 66
const X_PROJ = 232
const X_MIX = 392
const X_CACHE = 530
const X_OUT = 648

const Y_Q = 60
const Y_K = 132
const Y_V = 246
const Y_CACHE = 178 // top of the cache band

const ACCENT = "var(--hg-accent, oklch(0.72 0.15 195))"

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
  accent = false,
  dashed = false,
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  accent?: boolean
  dashed?: boolean
}) {
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="4"
        fill="none"
        stroke={accent ? ACCENT : "currentColor"}
        strokeOpacity={accent ? 1 : 0.45}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text
        x={x}
        y={sub ? y - 1 : y + 4}
        textAnchor="middle"
        className="fill-current font-mono text-[10px]"
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x}
          y={y + 11}
          textAnchor="middle"
          className="fill-current font-mono text-[9px] opacity-60"
        >
          {sub}
        </text>
      ) : null}
    </g>
  )
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  accent = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  accent?: boolean
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={accent ? ACCENT : "currentColor"}
      strokeOpacity={accent ? 1 : 0.4}
      strokeWidth="1"
      markerEnd="url(#mova-arrow)"
    />
  )
}

export function MovaPath() {
  const experts = [0, 1, 2, 3]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        K2HorizonMoVAAttention.forward · one layer, one token
      </div>
      <div className="overflow-x-auto px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="min-w-[560px]"
          role="img"
          aria-label="Diagram of one MoVA attention layer. The hidden state fans out to a query projection, a key projection, and a router that selects four of sixty-four value experts. The four expert outputs are combined into a single eight-head value tensor before the KV cache is written, so the cache stores the same shapes a grouped-query-attention model would."
        >
          <defs>
            <marker
              id="mova-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="currentColor" fillOpacity="0.55" />
            </marker>
          </defs>

          {/* cache band */}
          <rect
            x={X_CACHE - 72}
            y={Y_CACHE - 76}
            width={144}
            height={152}
            rx="6"
            fill="currentColor"
            fillOpacity="0.045"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeDasharray="5 4"
          />
          <text
            x={X_CACHE}
            y={Y_CACHE - 84}
            textAnchor="middle"
            className="fill-current font-mono text-[10px] opacity-70"
          >
            KV cache
          </text>

          {/* input */}
          <Box x={X_IN} y={Y_K + 28} w={92} h={34} label="x" sub="2560" />

          {/* query */}
          <Arrow x1={X_IN + 46} y1={Y_K + 20} x2={X_PROJ - 52} y2={Y_Q} />
          <Box
            x={X_PROJ}
            y={Y_Q}
            w={104}
            h={34}
            label="q_proj"
            sub="32 × 128"
          />
          <Arrow x1={X_PROJ + 52} y1={Y_Q} x2={X_OUT - 44} y2={Y_Q + 46} />

          {/* key */}
          <Arrow x1={X_IN + 46} y1={Y_K + 24} x2={X_PROJ - 52} y2={Y_K} />
          <Box
            x={X_PROJ}
            y={Y_K}
            w={104}
            h={34}
            label="k_proj"
            sub="8 × 128"
          />
          <Arrow x1={X_PROJ + 52} y1={Y_K} x2={X_CACHE - 44} y2={Y_CACHE - 40} />
          <Box
            x={X_CACHE}
            y={Y_CACHE - 40}
            w={84}
            h={30}
            label="K"
            sub="8 × 128"
          />

          {/* value path — routed */}
          <Arrow
            x1={X_IN + 46}
            y1={Y_K + 38}
            x2={X_PROJ - 52}
            y2={Y_V - 34}
            accent
          />
          <Box
            x={X_PROJ}
            y={Y_V - 34}
            w={104}
            h={34}
            label="v_router"
            sub="2560 → 64"
            accent
          />
          <text
            x={X_PROJ}
            y={Y_V - 8}
            textAnchor="middle"
            className="fill-current font-mono text-[9px] opacity-70"
          >
            sigmoid · top-4
          </text>

          {experts.map((e) => {
            const y = Y_V + 6 + e * 26
            return (
              <g key={e}>
                <Arrow
                  x1={X_PROJ + 52}
                  y1={Y_V - 30}
                  x2={X_MIX - 44}
                  y2={y}
                  accent
                />
                <Box
                  x={X_MIX}
                  y={y}
                  w={86}
                  h={22}
                  label={`V${e} · SiLU`}
                  accent
                />
              </g>
            )
          })}
          <text
            x={X_MIX}
            y={Y_V - 18}
            textAnchor="middle"
            className="fill-current font-mono text-[9px] opacity-70"
          >
            4 of 64 experts, each 2560 → 1024
          </text>

          {experts.map((e) => {
            const y = Y_V + 6 + e * 26
            return (
              <Arrow
                key={`m${e}`}
                x1={X_MIX + 43}
                y1={y}
                x2={X_CACHE - 44}
                y2={Y_CACHE + 42}
                accent
              />
            )
          })}
          <Box
            x={X_CACHE}
            y={Y_CACHE + 42}
            w={84}
            h={30}
            label="V"
            sub="8 × 128"
            accent
          />
          <text
            x={X_CACHE}
            y={Y_CACHE + 74}
            textAnchor="middle"
            className="fill-current font-mono text-[9px] opacity-70"
          >
            Σ wₖ · SiLU(Vₖx)
          </text>

          {/* attention + gate */}
          <Arrow
            x1={X_CACHE + 44}
            y1={Y_CACHE - 40}
            x2={X_OUT - 44}
            y2={Y_Q + 54}
          />
          <Arrow
            x1={X_CACHE + 44}
            y1={Y_CACHE + 42}
            x2={X_OUT - 44}
            y2={Y_Q + 62}
          />
          <Box
            x={X_OUT}
            y={Y_Q + 58}
            w={92}
            h={36}
            label="FlashAttn"
            sub="unmodified"
          />
          <Arrow x1={X_OUT} y1={Y_Q + 76} x2={X_OUT} y2={Y_Q + 106} />
          <Box
            x={X_OUT}
            y={Y_Q + 124}
            w={92}
            h={34}
            label="× softplus"
            sub="gate_proj"
          />
          <Arrow x1={X_OUT} y1={Y_Q + 141} x2={X_OUT} y2={Y_Q + 171} />
          <Box x={X_OUT} y={Y_Q + 189} w={92} h={30} label="o_proj" />
        </svg>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        The routed mixture is collapsed to one 8 × 128 tensor before
        `past_key_values.update` is called, so the cache stores exactly the GQA
        shapes and the attention kernel never learns that routing happened.
        Transcribed from `modeling_k2_horizon.py`.
      </figcaption>
    </figure>
  )
}
