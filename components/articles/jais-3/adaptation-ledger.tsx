// What Jais 3 changed relative to K2 Horizon, size by size.
//
// Measured on 2026-10-16 from the Hugging Face repositories, no weights loaded
// whole:
//   tokenizer — the LFS SHA-256 of tokenizer.json on both sides
//   tensors   — names and shapes from every safetensors header on both sides
//   params    — the sum of those shapes
//   drift     — median over attention and MLP projections of
//               ‖jais − base‖ / ‖base‖, on the first 16,384 values of each
//               matrix fetched by HTTP range request (main against main).
//               The 32B figure covers layers 0-27 of its 64. The 36B and 375B
//               were not sampled.
//
// Server-rendered, zero JS.

type Row = {
  size: string
  params: number
  tensors: number
  vocab: number
  ctx: string
  config: string
  drift: number | null
}

const ROWS: Row[] = [
  { size: "0.9B", params: 1_078_285_824, tensors: 255, vocab: 64_256, ctx: "128K", config: "dtype field only", drift: 0.405 },
  { size: "3.7B", params: 5_058_255_360, tensors: 327, vocab: 250_624, ctx: "512K", config: "serialisation defaults", drift: 0.185 },
  { size: "7B", params: 8_999_178_240, tensors: 327, vocab: 250_624, ctx: "512K", config: "serialisation defaults", drift: 0.158 },
  { size: "32B", params: 34_779_304_960, tensors: 579, vocab: 250_624, ctx: "512K", config: "initializer_range", drift: 0.077 },
  { size: "MoVA-36B-A4B", params: 37_444_792_020, tensors: 16_998, vocab: 250_624, ctx: "512K", config: "router_aux_loss_coef", drift: null },
  { size: "375B-A23B", params: 379_167_159_168, tensors: 34_076, vocab: 250_624, ctx: "512K", config: "both of the above", drift: null },
]

function fmtParams(n: number): string {
  return n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(0)}M`
}

export function AdaptationLedger() {
  const maxDrift = 0.5
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        K2 Horizon → Jais 3 · read from the repositories, size by size
      </div>
      <div className="overflow-x-auto">
        <table className="my-0 w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 font-mono text-xs">
              <th className="px-3 py-2 text-left font-medium">size</th>
              <th className="px-2 py-2 text-right font-medium">params</th>
              <th className="px-2 py-2 text-right font-medium">tensors</th>
              <th className="px-2 py-2 text-right font-medium">vocab</th>
              <th className="px-2 py-2 text-left font-medium">tokenizer</th>
              <th className="px-2 py-2 text-left font-medium">config change</th>
              <th className="px-3 py-2 text-left font-medium">weight drift</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.size} className="border-b last:border-b-0">
                <td className="px-3 py-2 font-medium">{r.size}</td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{fmtParams(r.params)}</td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                  {r.tensors.toLocaleString("en-US")}
                  <div className="text-[10px] text-muted-foreground">same names, shapes</div>
                </td>
                <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                  {r.vocab.toLocaleString("en-US")}
                  <div className="text-[10px] text-muted-foreground">{r.ctx} context</div>
                </td>
                <td className="px-2 py-2 font-mono text-xs">identical sha256</td>
                <td className="px-2 py-2 font-mono text-xs">{r.config}</td>
                <td className="px-3 py-2">
                  {r.drift === null ? (
                    <span className="font-mono text-xs text-muted-foreground">not sampled</span>
                  ) : (
                    <>
                      <div className="h-2 w-full overflow-hidden rounded-sm bg-muted">
                        <div
                          className="h-full bg-emerald-600/70"
                          style={{ width: `${((r.drift / maxDrift) * 100).toFixed(1)}%` }}
                          aria-hidden
                        />
                      </div>
                      <div className="font-mono text-[10px] tabular-nums">{r.drift.toFixed(3)} median</div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        Weight drift is the median relative change of the attention and MLP projections, sampled.
        Unrelated matrices of equal norm would read about 1.41; a light fine-tune, well under 0.01. The architecture
        file, the tokenizer and every tensor shape are unchanged; only the values moved, and the
        smaller the model, the further.
      </figcaption>
    </figure>
  )
}
