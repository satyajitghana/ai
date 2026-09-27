// OrcaSAQ-2's bit allocation, block by block. Server-rendered, zero JS.
//
// Read from orcarouter/OrcaSAQ-2-27B's safetensors headers: every quantized
// projection is an EXL3 `.trellis` int16 tensor whose last dimension is 16 x
// bits (a 16x16 tile of 256 weights at K bits packs 16K int16s), so 48 means 3
// bits, 56 means 3.5, 64 means 4, 32 means 2. Cross-checked against the
// per-tensor `bits_per_weight` in quantization_config.json: all 400 agree, and
// the parameter-weighted mean is 3.2114.
//
// Codes: 2 / 3 / h (3.5) / 4, and "." where a block has no such projection
// (48 blocks are Gated DeltaNet, every fourth is full attention).

const ROLES: { key: string; label: string; bits: string }[] = [
  { key: "gdn.qkv", label: "GDN in_proj_qkv", bits: "333.333.333.333.333.333.333.333.333.333.333.333.333.333.333.333." },
  { key: "gdn.z", label: "GDN in_proj_z", bits: "333.333.333.333.333.3hh.hhh.hhh.hhh.hhh.hh3.333.333.333.333.333." },
  { key: "gdn.out", label: "GDN out_proj", bits: "333.333.333.333.333.3hh.hhh.hhh.hhh.hhh.hhh.hhh.hhh.hhh.hhh.hhh." },
  { key: "attn.q", label: "attn q_proj", bits: "...h...h...h...h...h...h...h...h...3...3...3...3...3...3...3...3" },
  { key: "attn.k", label: "attn k_proj", bits: "...h...h...h...h...h...h...h...h...h...h...h...h...h...h...h...h" },
  { key: "attn.v", label: "attn v_proj", bits: "...4...4...4...4...4...4...4...4...4...4...4...4...4...4...4...4" },
  { key: "attn.o", label: "attn o_proj", bits: "...3...3...3...3...3...3...3...3...3...3...3...3...3...3...3...3" },
  { key: "mlp.gate", label: "MLP gate_proj", bits: "hhhhhh333333222222333333hhhhhh33333333333333333hhhhhh44444444444" },
  { key: "mlp.up", label: "MLP up_proj", bits: "333333333333333333333333hhhhhh33333333333hhhhhh333333hhhhhh44444" },
  { key: "mlp.down", label: "MLP down_proj", bits: "33333333333333333333333333333333333hhhhhh333333hhhhhh44444444444" },
]

// Parameter-weighted mean bits per block, from the same headers.
const BLOCK_AVG = [
  3.12, 3.12, 3.12, 3.23, 3.12, 3.12, 3.0, 3.11, 3.0, 3.0, 3.0, 3.11, 2.77, 2.77, 2.77, 2.87,
  2.77, 2.77, 3.0, 3.11, 3.0, 3.08, 3.08, 3.11, 3.32, 3.32, 3.32, 3.35, 3.32, 3.32, 3.08, 3.11,
  3.08, 3.08, 3.08, 3.14, 3.2, 3.2, 3.2, 3.14, 3.2, 3.2, 3.16, 3.14, 3.16, 3.16, 3.16, 3.26,
  3.27, 3.27, 3.27, 3.26, 3.27, 3.62, 3.62, 3.62, 3.62, 3.62, 3.62, 3.74, 3.74, 3.74, 3.74, 3.74,
]

const SCALE: Record<string, { bits: number; fill: string; label: string }> = {
  "2": { bits: 2, fill: "oklch(0.64 0.17 30)", label: "2 bits" },
  "3": { bits: 3, fill: "oklch(0.72 0.06 250)", label: "3 bits" },
  h: { bits: 3.5, fill: "oklch(0.58 0.12 250)", label: "3.5 bits" },
  "4": { bits: 4, fill: "oklch(0.42 0.14 265)", label: "4 bits" },
}

const LABEL_W = 92
const CELL = 8.6
const ROW_H = 13
const GAP = 1
const TOP = 14
const GRID_W = LABEL_W + 64 * CELL
const AVG_TOP = TOP + ROLES.length * ROW_H + 10
const AVG_H = 44
const H = AVG_TOP + AVG_H + 18

const avgY = (b: number) => AVG_TOP + AVG_H - ((b - 2.5) / (4 - 2.5)) * AVG_H

export function BitMap() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          OrcaSAQ-2 · bits per decoder projection, blocks 0–63
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          read from trellis shapes in the safetensors headers
        </span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${GRID_W + 4} ${H}`}
          className="min-w-[560px] w-full"
          role="img"
          aria-label="Heat map of OrcaSAQ-2 bits per projection across 64 blocks. Value projections are 4 bits and key projections 3.5 bits in every full-attention block; MLP gate projections drop to 2 bits in blocks 12 to 17; the MLPs of blocks 53 to 63 rise to 3.5 and 4 bits. Per-block averages run from 2.77 to 3.74 bits."
        >
          {[0, 8, 16, 24, 32, 40, 48, 56, 63].map((b) => (
            <text
              key={b}
              x={LABEL_W + b * CELL + CELL / 2}
              y={10}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={7}
            >
              {b}
            </text>
          ))}

          {ROLES.map((r, ri) => (
            <g key={r.key}>
              <text
                x={LABEL_W - 4}
                y={TOP + ri * ROW_H + ROW_H / 2 + 2.5}
                textAnchor="end"
                className="fill-foreground font-mono"
                fontSize={7.5}
              >
                {r.label}
              </text>
              {r.bits.split("").map((c, bi) => {
                const s = SCALE[c]
                if (!s) return null
                return (
                  <rect
                    key={bi}
                    x={LABEL_W + bi * CELL + GAP / 2}
                    y={TOP + ri * ROW_H + GAP / 2}
                    width={CELL - GAP}
                    height={ROW_H - GAP}
                    rx={1}
                    fill={s.fill}
                  >
                    <title>{`block ${bi} · ${r.label} · ${s.label}`}</title>
                  </rect>
                )
              })}
            </g>
          ))}

          {/* per-block average */}
          <text x={LABEL_W - 4} y={AVG_TOP + AVG_H / 2 + 2.5} textAnchor="end" className="fill-foreground font-mono" fontSize={7.5}>
            block mean
          </text>
          {[3, 3.5].map((t) => (
            <g key={t}>
              <line x1={LABEL_W} x2={GRID_W} y1={avgY(t)} y2={avgY(t)} stroke="currentColor" className="text-border" strokeWidth={0.5} strokeDasharray="2 2" />
              <text x={GRID_W + 2} y={avgY(t) + 2.5} className="fill-muted-foreground font-mono" fontSize={6.5}>
                {t}
              </text>
            </g>
          ))}
          {BLOCK_AVG.map((b, i) => (
            <rect
              key={i}
              x={LABEL_W + i * CELL + GAP / 2}
              y={avgY(b)}
              width={CELL - GAP}
              height={AVG_TOP + AVG_H - avgY(b)}
              fill={b < 3 ? SCALE["2"].fill : b >= 3.5 ? SCALE["4"].fill : SCALE["h"].fill}
              opacity={0.85}
            >
              <title>{`block ${i}: ${b.toFixed(2)} bits per weight`}</title>
            </rect>
          ))}
          <text x={LABEL_W} y={H - 4} className="fill-muted-foreground font-mono" fontSize={7}>
            y axis from 2.5 to 4 bits · outside the blocks: embedding int8, LM head 6-bit, MTP head 4-bit
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {Object.entries(SCALE).map(([k, s]) => (
            <span key={k} className="flex items-center gap-1.5 font-mono text-[10px]">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.fill }} />
              <span className="text-muted-foreground">{s.label}</span>
            </span>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        Two kinds of structure. By role, fixed everywhere: every value projection 4 bits, every
        key projection 3.5, every attention output and every GDN qkv projection 3. By depth,
        bands of about six blocks: the only 2-bit tensors are the MLP gates of blocks 12–17,
        and the MLPs of blocks 53–63 get 3.5 and 4. Block 0 gets nothing its neighbours do not.
      </figcaption>
    </figure>
  )
}
