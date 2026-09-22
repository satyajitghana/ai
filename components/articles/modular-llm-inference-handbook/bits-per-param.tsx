// What a quantized checkpoint actually weighs, against the handbook's
// `Memory (GB) = P * (Q / 8) * (1 + Overhead)` weight term.
//
// Measured, not quoted. For each repository I pulled every `.safetensors`
// header with two HTTP range requests each (8 bytes of length prefix, then the
// JSON header), summed `data_offsets` for the exact byte count and
// `prod(shape)` for the exact tensor-element count. The denominator for bits
// per parameter is the parameter count of the bf16 checkpoint of the same
// model, so scale tensors and packing metadata count against the budget rather
// than inflating the divisor:
//
//   Llama-3.1-8B   8,030,261,248 params   (unsloth/Meta-Llama-3.1-8B-Instruct)
//   Llama-3.3-70B 70,553,706,816 params   (derived from the FP4 checkpoint:
//                 34,225,520,640 U8 bytes x 2 fp4 values + 2,102,665,536 bf16)
//
// The pattern: the formula is exact in bf16 and gets worse the harder you
// quantize, because embeddings, the LM head, norms and the per-group scales
// stay at high precision and become a larger share of a shrinking file.
//
// All arithmetic is * and /.

type Ckpt = {
  label: string
  repo: string
  nominal: number // the handbook's Q
  bytes: number
  params: number
  presetP: number // the handbook's preset value for P, in billions
}

const CKPTS: Ckpt[] = [
  {
    label: "Llama-3.1-8B, bf16",
    repo: "unsloth/Meta-Llama-3.1-8B-Instruct",
    nominal: 16,
    bytes: 16060522496,
    params: 8030261248,
    presetP: 8,
  },
  {
    label: "Llama-3.1-8B, FP8 dynamic",
    repo: "RedHatAI/…-FP8-dynamic",
    nominal: 8,
    bytes: 9083953152,
    params: 8030261248,
    presetP: 8,
  },
  {
    label: "Llama-3.1-8B, W4A16",
    repo: "RedHatAI/…-quantized.w4a16",
    nominal: 4,
    bytes: 5735587840,
    params: 8030261248,
    presetP: 8,
  },
  {
    label: "Llama-3.3-70B, NVFP4",
    repo: "nvidia/Llama-3.3-70B-Instruct-FP4",
    nominal: 4,
    bytes: 42709045632,
    params: 70553706816,
    presetP: 70,
  },
  {
    label: "Llama-3.3-70B, W4A16",
    repo: "RedHatAI/…-quantized.w4a16",
    nominal: 4,
    bytes: 39525311232,
    params: 70553706816,
    presetP: 70,
  },
]

const bits = (c: Ckpt) => (c.bytes * 8) / c.params
const formulaGB = (c: Ckpt) => c.presetP * (c.nominal / 8)
const realGB = (c: Ckpt) => c.bytes / 1e9

export function BitsPerParam() {
  const W = 880
  const H = 342
  const left = 226
  const right = 600
  const top = 56
  const rowH = 52
  const MAXB = 17

  const x = (b: number) => left + (b / MAXB) * (right - left)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        measured bits per parameter, from each checkpoint&rsquo;s own
        safetensors headers &middot; hollow tick = the nominal bit width the
        formula uses
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[840px]"
        role="img"
        aria-label="Five horizontal bars of measured bits per parameter for real checkpoints, each with a marker for the nominal bit width. A bf16 Llama-3.1-8B measures exactly 16 bits per parameter. An FP8 version of the same model measures 9.05 against a nominal 8. A four-bit W4A16 version measures 5.71 against a nominal 4, making the formula 43 percent low. A 70B NVFP4 checkpoint measures 4.84 and a 70B W4A16 checkpoint 4.48, both against a nominal 4. The formula is exact at bf16 and worst on small models at low precision."
      >
        {[0, 4, 8, 12, 16].map((b) => (
          <g key={b}>
            <line
              x1={x(b)}
              y1={top - 16}
              x2={x(b)}
              y2={top + CKPTS.length * rowH - 22}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.5}
            />
            <text
              x={x(b)}
              y={top - 24}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {b}
            </text>
          </g>
        ))}
        <text
          x={right + 6}
          y={top - 24}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          bits/param
        </text>

        {CKPTS.map((c, i) => {
          const y0 = top + i * rowH
          const b = bits(c)
          const err = (realGB(c) / formulaGB(c) - 1) * 100
          const bad = err > 20
          return (
            <g key={c.label + c.repo}>
              <text
                x={left - 12}
                y={y0 + 14}
                textAnchor="end"
                className="fill-foreground font-mono"
                style={{ fontSize: 11.5 }}
              >
                {c.label}
              </text>
              <text
                x={left - 12}
                y={y0 + 27}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                {c.repo}
              </text>

              <rect
                x={x(0)}
                y={y0}
                width={x(b) - x(0)}
                height={22}
                rx={2}
                className={
                  bad
                    ? "fill-destructive/30 stroke-destructive"
                    : "fill-foreground/35 stroke-foreground/80"
                }
                strokeWidth={1.25}
              />
              <line
                x1={x(c.nominal)}
                y1={y0 - 4}
                x2={x(c.nominal)}
                y2={y0 + 26}
                className="stroke-foreground"
                strokeWidth={2}
              />
              <text
                x={x(b) + 10}
                y={y0 + 10}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {b.toFixed(2)} bits &middot; {realGB(c).toFixed(2)} GB
              </text>
              <text
                x={x(b) + 10}
                y={y0 + 23}
                className={
                  bad
                    ? "fill-destructive font-mono"
                    : "fill-muted-foreground font-mono"
                }
                style={{ fontSize: 10 }}
              >
                formula says {formulaGB(c).toFixed(1)} GB &mdash;{" "}
                {err >= 0 ? "+" : ""}
                {err.toFixed(1)}%
              </text>
            </g>
          )
        })}

        <text
          x={left - 12}
          y={top + CKPTS.length * rowH + 4}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          the pattern
        </text>
        <text
          x={left}
          y={top + CKPTS.length * rowH + 4}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          exact at bf16, 13% low at 8 bits, 43% low at 4 &mdash; and the 8B is
          worse than the 70B because a fixed high-precision remainder is a
          bigger share of a smaller file
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        &ldquo;4-bit&rdquo; names the format of the matrices, not the weight of
        the file. Every checkpoint here keeps its embedding table, LM head and
        norms at high precision and adds a scale per quantization group, so the
        effective width lands between 4.48 and 5.71 bits. The formula is a good
        estimate of the thing it names and an increasingly bad estimate of the
        thing you have to fit on the card.
      </figcaption>
    </figure>
  )
}
