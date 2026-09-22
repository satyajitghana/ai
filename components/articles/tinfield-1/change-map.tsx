import { cn } from "@/lib/utils"

// What a fine-tune actually touched, measured rather than described.
//
// Tinfield 1 and Qwen3.8-Flash-Next publish byte-identical safetensors indices —
// same 1,658 tensor names, same shard assignment, same 359,999,963,128-byte
// total. That makes a direct byte comparison cheap: fetch the same offset range
// out of the same shard in both repositories and check whether the bytes match.
// Every row below is that comparison, run at four offsets (0%, 33%, 66%, 99%) of
// each tensor so a partial edit could not hide outside the sampled window, on
// early / middle / late layers. Parameter counts are summed from the safetensors
// headers of the whole checkpoint, not from the sampled windows.
//
// Server-rendered, zero JS: the table is the argument, and it has to survive in
// the .md twin and in print.

type Row = {
  group: string
  detail: string
  params: number
  changed: boolean
}

const ROWS: Row[] = [
  // Changed — every linear map in the attention and residual-routing path.
  {
    group: "linear_attn.in_proj_{qkv,z,a,b}",
    detail: "36 linear-attention layers",
    params: 1_518_796_800,
    changed: true,
  },
  {
    group: "linear_attn.out_proj",
    detail: "36 linear-attention layers",
    params: 566_231_040,
    changed: true,
  },
  {
    group: "self_attn.{q,k,v,o}_proj",
    detail: "12 full-attention layers",
    params: 597_688_320,
    changed: true,
  },
  {
    group: "hyper-connection mixers",
    detail: "attn + mlp + top-level, all 48 layers",
    params: 639_631_360,
    changed: true,
  },
  // Unchanged — everything that costs memory.
  {
    group: "mlp.experts.{gate_up,down}_proj",
    detail: "512 experts × 48 layers",
    params: 120_795_955_200,
    changed: false,
  },
  {
    group: "ple.ple_embedding.ngram_embedding.shard_*",
    detail: "the engram table, 128 shards, one layer",
    params: 51_200_245_760,
    changed: false,
  },
  {
    group: "embed_tokens + lm_head",
    detail: "248,320 × 2,560, twice",
    params: 1_271_398_400,
    changed: false,
  },
  {
    group: "mtp.*",
    detail: "the whole multi-token-prediction module",
    params: 2_607_150_848,
    changed: false,
  },
  {
    group: "mlp.shared_expert + mlp.gate",
    detail: "shared FFN and every router",
    params: 298_967_040,
    changed: false,
  },
  {
    group: "visual.*",
    detail: "27-layer vision tower and merger",
    params: 448_931_056,
    changed: false,
  },
  {
    group: "norms, conv1d, A_log, dt_bias, indexer",
    detail: "every RMSNorm and every state-dynamics parameter",
    params: 54_985_635,
    changed: false,
  },
]

const TOTAL = 179_999_981_459
const CHANGED = 3_322_347_520

const fmtB = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(1)}M`

export function ChangeMap() {
  const changed = ROWS.filter((r) => r.changed)
  const same = ROWS.filter((r) => !r.changed)
  const pct = (CHANGED / TOTAL) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Tinfield-1 vs Qwen3.8-Flash-Next · byte comparison at four offsets per
        tensor
      </div>

      <div className="px-4 pt-4 pb-1">
        <div className="flex h-6 w-full overflow-hidden rounded-sm border">
          <div
            className="bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
            style={{ width: `${pct.toFixed(3)}%` }}
            aria-hidden
          />
          <div className="flex-1 bg-muted" aria-hidden />
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs">
          <span className="text-foreground">
            changed 3,322,347,520 params · {pct.toFixed(2)}%
          </span>
          <span className="text-muted-foreground">
            byte-identical 176,677,633,939 params · 353.4 GB
          </span>
        </div>
      </div>

      <table className="my-0 w-full border-collapse text-sm">
        <tbody>
          <Section label="Changed" rows={changed} tone="changed" />
          <Section label="Byte-identical" rows={same} tone="same" />
        </tbody>
      </table>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Parameter counts summed from the full safetensors headers; verdicts from
        256 KiB and 128 KiB range reads at 0 / 33 / 66 / 99% of each tensor, on
        early, middle and late layers. Sampling cannot prove a tensor is
        untouched everywhere — only that nothing moved in the windows read.
      </figcaption>
    </figure>
  )
}

function Section({
  label,
  rows,
  tone,
}: {
  label: string
  rows: Row[]
  tone: "changed" | "same"
}) {
  const subtotal = rows.reduce((a, r) => a + r.params, 0)
  return (
    <>
      <tr>
        <th
          colSpan={2}
          className="border-y bg-muted/50 px-3 py-1.5 text-left font-mono text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {label}
        </th>
        <th className="border-y bg-muted/50 px-3 py-1.5 text-right font-mono text-xs font-normal text-muted-foreground">
          {fmtB(subtotal)}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.group} className="border-b last:border-b-0">
          <td className="w-1 py-2 pl-3">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full align-middle",
                tone === "changed"
                  ? "bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
                  : "bg-muted-foreground/40"
              )}
              aria-hidden
            />
            <span className="sr-only">{label}</span>
          </td>
          <td className="py-2 pr-3 pl-2">
            <code className="font-mono text-xs break-all">{r.group}</code>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {r.detail}
            </div>
          </td>
          <td className="py-2 pr-3 text-right align-top font-mono text-xs whitespace-nowrap">
            {fmtB(r.params)}
          </td>
        </tr>
      ))}
    </>
  )
}
