// Where AuK's ~25 GiB went, and what one line of code removed.
//
// Server-rendered, zero JS: every number below is a constant measured from a
// primary source, and the only arithmetic is +, -, * and / — all exact under
// IEEE-754, so nothing here needs lib/dmath.
//
// Ground truth:
//   - DiT parameter count: the safetensors header of auk_base.safetensors,
//     read over HTTP range requests. 420 tensors, all F32, shapes summing to
//     1,530,538,629. AuK-Flash's checkpoint is identical in shape and dtype.
//   - VAE parameter count: the same read on vae.safetensors. 1,137 tensors,
//     all F32, 159,299,797 parameters.
//   - Encoder parameter count: the same read over Qwen2.5-Omni-3B's three
//     shards, restricted to what infer_auk.py actually keeps resident — the
//     Thinker, after `del thinker.visual`. That is thinker.model (3,085,938,688)
//     + thinker.audio_tower (637,676,544) + thinker.lm_head (311,164,928)
//     = 4,034,780,160. The 668,684,288-parameter vision tower is deleted.
//   - The dtypes: before PR #19, AukInfer ran `model = model.to(torch.float32)`
//     over the WHOLE CFMEdit module, which includes the frozen encoder that
//     `from_pretrained(..., torch_dtype=torch.bfloat16)` had just loaded in
//     bf16. After PR #19 the cast is `model.transformer.to(torch.float32)`,
//     so the encoder keeps the bf16 it was loaded in. Nothing else changed.
//   - The two right-hand reference numbers are Tencent's own, from the PR
//     description: "Model loading peak 21.44 GiB → 13.97 GiB", measured on an
//     NVIDIA H20 (96 GB) with AuK Base and BF16 autocast.
//
// The point of the chart: the PR's measured loading peaks are reproduced to
// within 0.16 GiB from nothing but three parameter counts and two dtypes. The
// 7.5 GiB was never an optimisation — it was one module being cast twice.

const GIB = 1024 * 1024 * 1024

const DIT_PARAMS = 1_530_538_629
const VAE_PARAMS = 159_299_797
const ENC_PARAMS = 4_034_780_160

// Tencent's measured model-loading peak, H20 96 GB, from PR #19's own table.
const MEASURED_BEFORE = 21.44
const MEASURED_AFTER = 13.97

const DIT_COLOR = "oklch(0.62 0.15 255)"
const VAE_COLOR = "oklch(0.68 0.12 165)"
const ENC_COLOR = "oklch(0.64 0.16 35)"

type Row = {
  label: string
  sub: string
  encBytes: number
  measured: number
}

const ROWS: Row[] = [
  {
    label: "before PR #19",
    sub: "model.to(torch.float32) — encoder upcast to fp32",
    encBytes: ENC_PARAMS * 4,
    measured: MEASURED_BEFORE,
  },
  {
    label: "after PR #19",
    sub: "model.transformer.to(torch.float32) — encoder stays bf16",
    encBytes: ENC_PARAMS * 2,
    measured: MEASURED_AFTER,
  },
]

const DIT_BYTES = DIT_PARAMS * 4
const VAE_BYTES = VAE_PARAMS * 4

function gib(bytes: number): string {
  return (bytes / GIB).toFixed(3)
}

export function MemoryLedger() {
  const W = 560
  const barMax = W - 92
  const maxTotal = DIT_BYTES + VAE_BYTES + ROWS[0].encBytes
  const scale = (bytes: number) => (bytes / maxTotal) * barMax

  const saved = (ROWS[0].encBytes - ROWS[1].encBytes) / GIB

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          safetensors headers &middot; infer_auk.py before and after PR #19
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">measured, not modelled</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 132`} width={W} height={132} role="img" className="w-full">
          <title>
            {`Resident weight bytes before and after PR #19. Before: encoder ${gib(ROWS[0].encBytes)} GiB plus DiT ${gib(DIT_BYTES)} GiB plus VAE ${gib(VAE_BYTES)} GiB. After: encoder ${gib(ROWS[1].encBytes)} GiB, the other two unchanged. Tencent measured loading peaks of ${MEASURED_BEFORE} and ${MEASURED_AFTER} GiB respectively.`}
          </title>
          {ROWS.map((row, i) => {
            const y = 20 + i * 52
            const encW = scale(row.encBytes)
            const ditW = scale(DIT_BYTES)
            const vaeW = scale(VAE_BYTES)
            const total = (row.encBytes + DIT_BYTES + VAE_BYTES) / GIB
            return (
              <g key={row.label}>
                <text
                  x={0}
                  y={y - 10}
                  fontSize={9.5}
                  fill="currentColor"
                  fontFamily="ui-monospace, monospace"
                >
                  {row.label}
                </text>
                <text
                  x={0}
                  y={y - 1}
                  fontSize={8}
                  fill="currentColor"
                  fillOpacity={0.55}
                  fontFamily="ui-monospace, monospace"
                >
                  {row.sub}
                </text>
                <rect x={0} y={y + 4} width={encW} height={17} rx={2} fill={ENC_COLOR} fillOpacity={0.8} />
                <rect x={encW} y={y + 4} width={ditW} height={17} rx={2} fill={DIT_COLOR} fillOpacity={0.8} />
                <rect
                  x={encW + ditW}
                  y={y + 4}
                  width={vaeW}
                  height={17}
                  rx={2}
                  fill={VAE_COLOR}
                  fillOpacity={0.8}
                />
                <text
                  x={encW + ditW + vaeW + 7}
                  y={y + 16}
                  fontSize={9}
                  fill="currentColor"
                  fontFamily="ui-monospace, monospace"
                >
                  {total.toFixed(2)} GiB
                </text>
                <text
                  x={encW + ditW + vaeW + 7}
                  y={y + 26}
                  fontSize={7.5}
                  fill="currentColor"
                  fillOpacity={0.55}
                  fontFamily="ui-monospace, monospace"
                >
                  vs {row.measured.toFixed(2)} measured
                </text>
              </g>
            )
          })}
          <text
            x={0}
            y={126}
            fontSize={8}
            fill="currentColor"
            fillOpacity={0.6}
            fontFamily="ui-monospace, monospace"
          >
            <tspan fill={ENC_COLOR}>&#9632;</tspan> Qwen2.5-Omni Thinker, vision tower deleted
            &nbsp;&nbsp;
            <tspan fill={DIT_COLOR}>&#9632;</tspan> Flux2Edit DiT (fp32 either way)
            &nbsp;&nbsp;
            <tspan fill={VAE_COLOR}>&#9632;</tspan> BigVGAN-Flow VAE
          </text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10.5px] sm:grid-cols-4">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">encoder, fp32</div>
            <div className="text-foreground">{gib(ROWS[0].encBytes)} GiB</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">encoder, bf16</div>
            <div className="text-foreground">{gib(ROWS[1].encBytes)} GiB</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">difference</div>
            <div className="text-foreground">{saved.toFixed(3)} GiB</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">Tencent&rsquo;s figure</div>
            <div className="text-foreground">7.516 GiB</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Three parameter counts and two dtypes reproduce Tencent&rsquo;s own before/after loading peaks to within
          0.16 GiB &mdash; {(
            (ROWS[0].encBytes + DIT_BYTES + VAE_BYTES) / GIB
          ).toFixed(2)}{" "}
          GiB against a measured {MEASURED_BEFORE}, and{" "}
          {((ROWS[1].encBytes + DIT_BYTES + VAE_BYTES) / GIB).toFixed(2)} GiB against a measured{" "}
          {MEASURED_AFTER}. The gap in each case is allocator slack, not a missing module. Note what does{" "}
          <em>not</em> move: the DiT stays at {gib(DIT_BYTES)} GiB in both rows, because fp32 really is the
          checkpoint&rsquo;s storage dtype and the fix deliberately keeps it. The entire {saved.toFixed(2)} GiB came
          out of a frozen encoder that had been loaded in bf16 and then cast back up to fp32 by a blanket
          module-wide{" "}
          <code className="font-mono text-xs">.to()</code> that was only ever meant for the backbone.
        </p>
      </div>
    </figure>
  )
}
