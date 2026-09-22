// The 48-block stack, drawn from paradigma-inc/limite-1b-violetto's own
// config.json. Server-rendered, zero JS.
//
// Fields used, verbatim:
//   num_hidden_layers 48 · hidden_size 1280 · num_attention_heads 10
//   num_key_value_heads 2 · head_dim 128 · intermediate_size 3328
//   sliding_window 1024 · global_every 4 · global_nope true
//   global_layers [3,7,11,15,19,23,27,31,35,39,43,47]
//   ve_layers [1,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46] · ve_dim 128
//   mudd true · mudd_layers [24,47] · mudd_taps 3
//   mudd_tap_idx {"24":[0,12,24], "47":[0,23,47]}
//
// The shape matters because it is not a scaled-down Llama. Three of the four
// design choices here -- value embeddings, MuDD dense connections, norms with
// no learnable weight -- come out of the NanoGPT speedrun lineage, and the
// fourth (36 local blocks to 12 global) is the whole of the throughput story.

const LAYERS = 48
const GLOBAL = new Set([3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43, 47])
const VE = new Set([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46])
const MUDD = new Map<number, number[]>([
  [24, [0, 12, 24]],
  [47, [0, 23, 47]],
])

const LOCAL_C = "oklch(0.62 0.12 200)"
const GLOBAL_C = "oklch(0.58 0.16 28)"
const VE_C = "oklch(0.64 0.15 300)"
const MUDD_C = "oklch(0.62 0.14 140)"

export function LayerStack() {
  const W = 720
  const L = 30
  const R = 18
  const trackW = W - L - R
  const cellW = trackW / LAYERS
  const blockY = 96
  const blockH = 34
  const H = 210

  const cx = (i: number) => L + i * cellW + cellW / 2

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          config.json, drawn — 48 blocks, hidden 1280, 10 heads over 2 KV heads
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          1,035,253,888 params
        </span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[620px]"
          role="img"
          aria-label="A 48-block transformer stack. Blocks 3, 7, 11 and every fourth block through 47 are global attention with no positional encoding; the other 36 blocks use a 1024-token sliding window. Value embeddings are injected at 16 blocks starting at block 1 and every third block after. Multi-way dynamic dense connections tap blocks 0, 12 and 24 into block 24, and blocks 0, 23 and 47 into block 47."
        >
          {/* MuDD taps, drawn above the stack */}
          {[...MUDD.entries()].map(([dst, taps], k) => {
            const y = 26 + k * 26
            return (
              <g key={dst}>
                {taps.map((src) => (
                  <path
                    key={src}
                    d={`M ${cx(src)} ${blockY - 3} C ${cx(src)} ${y}, ${cx(dst)} ${y}, ${cx(dst)} ${blockY - 3}`}
                    fill="none"
                    stroke={MUDD_C}
                    strokeWidth={1.2}
                    opacity={0.8}
                  />
                ))}
                <text
                  x={cx(dst) + 6}
                  y={y + 2}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8 }}
                >
                  MuDD → block {dst}
                </text>
              </g>
            )
          })}

          {/* the stack */}
          {Array.from({ length: LAYERS }, (_, i) => {
            const isG = GLOBAL.has(i)
            return (
              <rect
                key={i}
                x={L + i * cellW}
                y={blockY}
                width={Math.max(cellW - 1.2, 1)}
                height={blockH}
                rx={1.5}
                fill={isG ? GLOBAL_C : LOCAL_C}
                opacity={isG ? 0.95 : 0.55}
              >
                <title>
                  {`block ${i} · ${isG ? "global attention, NoPE, full 131,072-token span" : "sliding window, 1,025 keys"}${VE.has(i) ? " · value embedding injected" : ""}`}
                </title>
              </rect>
            )
          })}

          {/* value-embedding injections, below */}
          {Array.from({ length: LAYERS }, (_, i) =>
            VE.has(i) ? (
              <g key={i}>
                <line
                  x1={cx(i)}
                  x2={cx(i)}
                  y1={blockY + blockH}
                  y2={blockY + blockH + 14}
                  stroke={VE_C}
                  strokeWidth={1.4}
                />
                <circle cx={cx(i)} cy={blockY + blockH + 16} r={2.4} fill={VE_C} />
              </g>
            ) : null
          )}
          <text
            x={L}
            y={blockY + blockH + 33}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 8 }}
          >
            value embeddings — a second 151,680 × 256 table, injected at 16 blocks
          </text>

          {[0, 3, 11, 23, 24, 35, 47].map((i) => (
            <text
              key={i}
              x={cx(i)}
              y={blockY - 8}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 8 }}
            >
              {i}
            </text>
          ))}

          <text
            x={L}
            y={H - 20}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            36 sliding-window blocks · 12 global NoPE blocks · window 1024 (span 1025 keys)
          </text>
          <text
            x={L}
            y={H - 7}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            rms norms carry no learnable weight · attention softmax scale pinned to 0.1 · logits
            softcapped
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Every position and count is read from <code>config.json</code>. The 3:1
        local-to-global ratio is the only one of these choices that shows up in
        the KV-cache arithmetic; the rest are sample-efficiency tricks that cost
        nothing at inference.
      </figcaption>
    </figure>
  )
}
