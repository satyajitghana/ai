// Where 0.5625 comes from, and what it tells you that the post does not say.
//
// The LMSYS post gives the ratio as (8 + 1) / 16 -- nine bytes of packed data
// and block scale per sixteen values, against sixteen bytes of FP8. Written
// per element that is (4 + 8/B) / 8 bits for a block size B, and setting it
// equal to 0.5625 recovers B = 16. So the ratio is not a number that has to be
// taken on trust: it names the block size.
//
// Bars are drawn in bits per sixteen values so the block-scale sliver is
// visible at the same scale as the codes. All arithmetic is +, -, * and / on
// small integers and exact binary fractions, so lib/dmath is not needed.

type Variant = {
  key: string
  label: string
  note: string
  codeBits: number // per element
  scaleBits: number // per block
  block: number
  highlight?: boolean
}

const VARIANTS: Variant[] = [
  {
    key: "fp8",
    label: "FP8 E4M3",
    note: "one byte per value, per-tensor scale",
    codeBits: 8,
    scaleBits: 0,
    block: 16,
  },
  {
    key: "b8",
    label: "NVFP4, block 8",
    note: "not what SGLang ships",
    codeBits: 4,
    scaleBits: 8,
    block: 8,
  },
  {
    key: "b16",
    label: "NVFP4, block 16",
    note: "E2M1 codes, one E4M3 scale per 16",
    codeBits: 4,
    scaleBits: 8,
    block: 16,
    highlight: true,
  },
  {
    key: "b32",
    label: "NVFP4, block 32",
    note: "not what SGLang ships",
    codeBits: 4,
    scaleBits: 8,
    block: 32,
  },
]

const PER = 16 // draw everything per sixteen values

export function BlockBudget() {
  const W = 860
  const left = 196
  const right = 660
  const MAXBITS = 136
  const x = (b: number) => left + (b / MAXBITS) * (right - left)

  const rowH = 56
  const top = 46
  const H = top + VARIANTS.length * rowH + 30

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        bits to store sixteen K or V values · the block scale is inside the bar,
        not next to it
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Four bars measuring the bits needed to store sixteen cache values. FP8 takes 128 bits with no block scale. NVFP4 with a block of eight takes 64 bits of codes plus 16 bits of scales, 80 bits, which is 62.5 percent of FP8. With a block of sixteen it takes 64 bits of codes plus 8 bits of scale, 72 bits, which is 56.25 percent. With a block of thirty-two it takes 64 plus 4, 68 bits, 53.1 percent. Only the block-of-sixteen row matches the published 0.5625 ratio."
      >
        {[0, 32, 64, 96, 128].map((b) => (
          <g key={b}>
            <line
              x1={x(b)}
              y1={top - 12}
              x2={x(b)}
              y2={H - 22}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(b)}
              y={top - 18}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {b}
            </text>
          </g>
        ))}
        <text
          x={left}
          y={top - 32}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          bits per 16 values
        </text>

        {VARIANTS.map((v, i) => {
          const codes = v.codeBits * PER
          const scales = (v.scaleBits * PER) / v.block
          const total = codes + scales
          const ratio = total / 128
          const y = top + i * rowH
          const barH = 26
          return (
            <g key={v.key}>
              <text
                x={14}
                y={y + 15}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {v.label}
              </text>
              <text
                x={14}
                y={y + 28}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {v.note}
              </text>

              <rect
                x={left}
                y={y}
                width={x(codes) - left}
                height={barH}
                rx={2}
                className={
                  v.highlight
                    ? "fill-foreground/45 stroke-foreground"
                    : "fill-foreground/15 stroke-foreground/45"
                }
                strokeWidth={1.25}
              />
              <text
                x={left + 8}
                y={y + 17}
                className={
                  v.highlight
                    ? "fill-background font-mono"
                    : "fill-foreground font-mono"
                }
                style={{ fontSize: 10 }}
              >
                {codes} bits of codes
              </text>

              {scales > 0 ? (
                <>
                  <rect
                    x={x(codes)}
                    y={y}
                    width={x(codes + scales) - x(codes)}
                    height={barH}
                    rx={2}
                    className="fill-foreground/70 stroke-foreground"
                    strokeWidth={1.25}
                  />
                  <text
                    x={x(codes + scales) + 6}
                    y={y + 30}
                    className="fill-muted-foreground font-mono"
                    style={{ fontSize: 8.5 }}
                  >
                    + {scales} scale
                  </text>
                </>
              ) : null}

              <text
                x={x(total) + 10}
                y={y + 17}
                className={
                  v.highlight
                    ? "fill-foreground font-mono"
                    : "fill-muted-foreground font-mono"
                }
                style={{ fontSize: 11 }}
              >
                {total} bits
                {v.key === "fp8" ? "" : ` — ${(ratio * 100).toFixed(2)}%`}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The block scale is <em>inside</em> the 56.25%, not excluded from it: nine
        bytes per sixteen values against FP8&rsquo;s sixteen. Which also means
        the ratio pins the block size &mdash; solve{" "}
        <code className="font-mono">(4 + 8/B) / 8 = 0.5625</code> and you get{" "}
        <strong className="font-medium text-foreground">B = 16</strong>, with no
        need to take it on trust. What the number genuinely excludes, in the
        post&rsquo;s own words, is &ldquo;the small global-scale metadata and
        other pool or workspace overheads&rdquo;, and it assumes the FP8 baseline
        carries no per-block scale of its own.
      </figcaption>
    </figure>
  )
}
