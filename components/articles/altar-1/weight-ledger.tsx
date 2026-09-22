// What 328 GB is made of, from the safetensors headers. Server-rendered, zero JS.
//
// Method: read the 39 shard headers of AikidoSec/altar-1 (8-byte length prefix,
// then the JSON dtype/shape map) and sum. A `weight_packed` int32 tensor in
// compressed-tensors `pack-quantized` format holds 8 four-bit weights per
// element, so its logical parameter count is 8x its element count; the
// `weight_scale` and `weight_zero_point` sidecars carry no parameters but do
// carry bytes.
//
// Totals: 500,825,296,352 logical parameters in 327,938,345,136 bytes, which is
// 5.238 bits per parameter -- not 4, because group_size is 32 and each group
// pays a bf16 scale plus an int8 zero point, and because 27.0B parameters were
// never quantised at all.
//
// The parent's size follows: 482.0B of the 500.8B are routed-expert parameters
// spread over 168 experts, so the unpruned 256-expert model is
// 482.0 x 256/168 + 18.8 = 753.3B parameters, or 1,506.7 GB in bf16 -- exactly
// the figure Aikido publishes. That is the cross-check that the accounting here
// is right.

const ROWS = [
  {
    label: "routed experts, 4-bit packed",
    sub: "73 of 76 MoE layers · 168 experts each",
    params: 473.8,
    gb: 236.9,
    bpw: 4.0,
    c: "oklch(0.55 0.15 280)",
  },
  {
    label: "group scales + zero points",
    sub: "one bf16 scale and one int8 zp per 32 weights",
    params: 0,
    gb: 37.0,
    bpw: null,
    c: "oklch(0.66 0.13 300)",
  },
  {
    label: "layers 3, 77 and 78, BF16",
    sub: "first MoE layer, last MoE layer, MTP head — experts unquantised",
    params: 19.0,
    gb: 38.1,
    bpw: 16,
    c: "oklch(0.60 0.15 30)",
  },
  {
    label: "everything else, BF16",
    sub: "embeddings, LM head, shared experts, dense layers, some attention",
    params: 8.0,
    gb: 15.9,
    bpw: 16,
    c: "oklch(0.68 0.13 60)",
  },
] as const

const TOTAL_GB = 327.9
const TOTAL_PARAMS = 500.8

export function WeightLedger() {
  let x = 0
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          327.9 GB, summed from 39 safetensors shard headers
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          500.8B params · 5.24 bits each
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 100 9"
          preserveAspectRatio="none"
          className="h-7 w-full"
          role="img"
          aria-label="Stacked bar of stored bytes: routed experts packed to four bits 236.9 gigabytes, group scales and zero points 37.0, three BF16 layers 38.1, everything else BF16 15.9."
        >
          {ROWS.map((r) => {
            const w = (100 * r.gb) / TOTAL_GB
            const rect = (
              <rect key={r.label} x={x} y={0} width={Math.max(w - 0.15, 0)} height={9} fill={r.c}>
                <title>{`${r.label}: ${r.gb} GB (${((100 * r.gb) / TOTAL_GB).toFixed(1)}%)`}</title>
              </rect>
            )
            x += w
            return rect
          })}
        </svg>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  what
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
                  params
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
                  stored
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
                  share
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-t">
                  <td className="px-2 py-1.5 align-top">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{ background: r.c }}
                      />
                      <span className="text-foreground">{r.label}</span>
                    </span>
                    <span className="mt-0.5 block pl-4 text-[10px] text-muted-foreground">
                      {r.sub}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right align-top text-muted-foreground">
                    {r.params > 0 ? `${r.params.toFixed(1)}B` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right align-top text-foreground">
                    {r.gb.toFixed(1)} GB
                  </td>
                  <td className="px-2 py-1.5 text-right align-top text-muted-foreground">
                    {((100 * r.gb) / TOTAL_GB).toFixed(1)}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2">
                <td className="px-2 py-1.5 text-foreground">total</td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {TOTAL_PARAMS.toFixed(1)}B
                </td>
                <td className="px-2 py-1.5 text-right text-foreground">
                  {TOTAL_GB.toFixed(1)} GB
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">5.24 bpw</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        &quot;W4A16&quot; describes the expert weights, not the file. A quarter
        of the bytes here are 16-bit: three whole layers whose experts were left
        alone, plus the embeddings, the LM head, the shared experts and the
        three dense layers — and 37 GB of group metadata, which is the price of{" "}
        <code>group_size: 32</code> with an asymmetric scheme.
      </figcaption>
    </figure>
  )
}
