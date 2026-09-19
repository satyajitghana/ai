// What one Splash decode step reads out of DRAM, drawn to scale.
//
// Every byte below is computed from the repository, not quoted from anyone.
// The Q4 pack is exactly 9 bytes per 16 weights (`q4PackedBytes` in
// runtime/model/WeightStore.cpp) — 4.5 bits per weight, a 32-byte nibble block
// plus a bf16 scale and a bf16 bias for every group of 64 inputs. The tensor
// shapes come from `Qwen3_8Layout` and `DFlashDraftLayout`; the GDN state
// geometry from `GdnStateLayout`.
//
// The step is one Metal command buffer: the 5-layer draft runs over 8 rows,
// the 64-layer target verifies the same 8 rows, and everything is submitted
// together. The weight matrices are read once for the whole block, which is the
// entire point — the same bytes serve up to 8 tokens instead of 1.
//
// Server-rendered, zero JS.

const SEGMENTS = [
  {
    key: "target",
    label: "target, 64 layers",
    bytes: 14.44,
    note: "48 Gated DeltaNet + 16 gated-attention layers, dense SwiGLU, and the 248,320-row LM head. Q4 at 4.5 bits.",
    tone: 1,
  },
  {
    key: "draft",
    label: "DFlash 2 draft",
    bytes: 1.266,
    note: "5 layers at hidden 5120, the [5120 × 25600] context projection, and 254 MB of rank-256 selector codebooks.",
    tone: 0.62,
  },
  {
    key: "head",
    label: "LM head, again",
    bytes: 0.715,
    note: "The draft has no head of its own. It runs the target's [248,320 × 5120] projection, so that matrix is streamed twice per step.",
    tone: 0.42,
  },
  {
    key: "state",
    label: "GDN state r/w",
    bytes: 0.308,
    note: "48 recurrent layers × 48 heads × 128 × 128, in fp32: 144 MiB read and 144 MiB written back, every step, per lane.",
    tone: 0.26,
  },
] as const

const TOTAL = SEGMENTS.reduce((s, x) => s + x.bytes, 0)

const ACCENT = "oklch(0.58 0.15 245)"

// Geometry.
const W = 760
const BAR_X = 16
const BAR_W = W - 32
const BAR_Y = 54
const BAR_H = 44
const H = 210

export function ByteLedger() {
  let cursor = BAR_X
  const laid = SEGMENTS.map((s) => {
    const w = (s.bytes / TOTAL) * BAR_W
    const seg = { ...s, x: cursor, w }
    cursor += w
    return seg
  })

  // Ticks every 4 GB along the bar.
  const ticks = [0, 4, 8, 12, 16]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One decode step · Qwen3.8-27B · bytes off the memory bus
      </div>
      <div className="px-2 py-4 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A bar drawn to scale showing the 16.73 gigabytes a single Splash decode step reads from memory for Qwen3.8-27B: 14.44 GB of target weights, 1.27 GB of draft weights, a second 0.72 GB read of the language-model head, and 0.31 GB of Gated DeltaNet recurrent state read and written back."
        >
          <defs>
            <filter id="splash-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* scale */}
          {ticks.map((t) => {
            const x = BAR_X + (t / TOTAL) * BAR_W
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={BAR_Y - 10}
                  x2={x}
                  y2={BAR_Y + BAR_H + 8}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <text
                  x={x}
                  y={BAR_Y - 16}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono"
                  fontSize={10}
                >
                  {t} GB
                </text>
              </g>
            )
          })}

          {/* the bar */}
          {laid.map((s) => (
            <g key={s.key}>
              <rect
                x={s.x}
                y={BAR_Y}
                width={Math.max(s.w - 1.5, 1)}
                height={BAR_H}
                rx={3}
                fill={ACCENT}
                fillOpacity={s.tone * 0.55}
                stroke={ACCENT}
                strokeWidth={1.5}
                filter="url(#splash-soft)"
              />
            </g>
          ))}

          {/* total bracket */}
          <path
            d={`M ${BAR_X} ${BAR_Y + BAR_H + 14} L ${BAR_X} ${BAR_Y + BAR_H + 20} L ${BAR_X + BAR_W} ${BAR_Y + BAR_H + 20} L ${BAR_X + BAR_W} ${BAR_Y + BAR_H + 14}`}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
          />
          <text
            x={BAR_X + BAR_W / 2}
            y={BAR_Y + BAR_H + 34}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={11}
          >
            16.73 GB, read to produce at most 8 tokens
          </text>

          {/* leader lines to the two widest segments only; the rest are in the table */}
          {laid.slice(0, 2).map((s) => {
            const cx = s.x + s.w / 2
            return (
              <g key={`lead-${s.key}`}>
                <text
                  x={cx}
                  y={BAR_Y + BAR_H / 2 + 4}
                  textAnchor="middle"
                  className="fill-foreground font-mono"
                  fontSize={s.key === "target" ? 12 : 10}
                >
                  {s.bytes.toFixed(2)}
                </text>
              </g>
            )
          })}

          <text
            x={BAR_X}
            y={H - 36}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            32K of context adds 1.09 GB of int8 KV on top — 16 attention layers only,
          </text>
          <text
            x={BAR_X}
            y={H - 22}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            because the other 48 keep a fixed-size recurrent state instead.
          </text>
        </svg>

        <dl className="mt-4 space-y-2 px-1 text-xs sm:px-2">
          {SEGMENTS.map((s) => (
            <div key={s.key} className="flex gap-3">
              <dt className="flex w-32 shrink-0 items-baseline gap-2 font-mono text-foreground sm:w-44">
                <span
                  aria-hidden
                  className="mt-[3px] inline-block h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ background: ACCENT, opacity: 0.3 + s.tone * 0.7 }}
                />
                <span className="truncate">{s.label}</span>
              </dt>
              <dd className="text-muted-foreground">
                <span className="font-mono text-foreground">
                  {s.bytes.toFixed(3)} GB
                </span>{" "}
                — {s.note}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </figure>
  )
}
