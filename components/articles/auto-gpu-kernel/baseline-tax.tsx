// What the scoring baseline pays before its attention kernel starts.
//
// The MLSys 2026 contest scores a DSA sparse-attention submission as the
// arithmetic mean of per-workload `FlashInfer_baseline_latency /
// your_kernel_latency`, and the baseline is a named, committed file:
// solutions/baseline/dsa/dsa_sparse_attention_.../flashinfer_wrapper_5af199.json
// in the contest dataset. Two lines of that wrapper run before it calls
// flashinfer.decode.trtllm_batch_decode_with_kv_cache_mla:
//
//     query    = torch.cat([q_nope, q_pe], dim=-1).unsqueeze(1)
//     kv_cache = torch.cat([ckv_cache, kpe_cache], dim=-1)
//
// The second one concatenates the whole paged KV cache. Every one of the 23
// sparse-attention workloads in the contest trace set declares num_pages =
// 8462 (counted from workloads/dsa_paged/dsa_sparse_attention_h16_ckv512_
// kpe64_topk2048_ps64.jsonl), so that cat materialises a fresh 624 MB tensor
// on every call, on a kernel the winning submission runs in ten microseconds.
//
// Everything below is arithmetic on declared tensor shapes, not a measurement.
// I have no B200. The byte counts are exact; the times are a lower bound —
// bytes divided by the chip's peak HBM bandwidth, which no real copy reaches.
//
// Server-rendered, zero JS. Integer byte arithmetic plus division only; no
// transcendental reaches the DOM, so lib/dmath is not needed here.

const PAGES = 8462
const PAGE_SIZE = 64
const D_CKV = 512
const D_KPE = 64
const BF16 = 2

// B200 HBM3e peak, as NVIDIA specs it. A floor, not an achievable rate.
const HBM_TB_S = 8

const CKV = PAGES * PAGE_SIZE * D_CKV * BF16
const KPE = PAGES * PAGE_SIZE * D_KPE * BF16
const CAT_OUT = CKV + KPE
const TRAFFIC = CKV + KPE + CAT_OUT

// bytes / (TB/s) -> microseconds
const us = (bytes: number) => bytes / (HBM_TB_S * 1e12) * 1e6

const MB = (bytes: number) => (bytes / 1e6).toFixed(1)

type Row = {
  label: string
  detail: string
  bytes: number
  tone: "cost" | "kernel" | "win"
}

const ROWS: Row[] = [
  {
    label: "read ckv_cache",
    detail: "[8462, 64, 512] bf16",
    bytes: CKV,
    tone: "cost",
  },
  {
    label: "read kpe_cache",
    detail: "[8462, 64, 64] bf16",
    bytes: KPE,
    tone: "cost",
  },
  {
    label: "write the concatenated cache",
    detail: "[8462, 64, 576] bf16, a fresh allocation every call",
    bytes: CAT_OUT,
    tone: "cost",
  },
]

const COST = "oklch(0.58 0.19 27)"
const WIN = "oklch(0.55 0.16 155)"

export function BaselineTax() {
  const max = TRAFFIC
  const catFloor = us(TRAFFIC)
  const winner = 10 // µs, the report's own average runtime for the submitted kernel

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one call of the scoring baseline, before the attention kernel runs
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          arithmetic on declared shapes — not a measurement
        </span>
      </div>

      <div className="space-y-3 p-3 sm:p-5">
        {ROWS.map((r) => (
          <div key={r.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm">{r.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {MB(r.bytes)} MB
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${((r.bytes / max) * 100).toFixed(2)}%`,
                  background: COST,
                }}
              />
            </div>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
              {r.detail}
            </p>
          </div>
        ))}

        <div className="border-t pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium">
              HBM traffic for <code className="font-mono text-[13px]">torch.cat</code> alone
            </span>
            <span className="font-mono text-xs">
              {MB(TRAFFIC)} MB &middot; &ge;{catFloor.toFixed(0)} &micro;s
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full rounded-full" style={{ background: COST }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
            {MB(TRAFFIC)} MB &divide; {HBM_TB_S} TB/s ={" "}
            <span className="text-foreground/80">{catFloor.toFixed(0)} &micro;s</span> at peak
            bandwidth, on a chip that never reaches peak
          </p>
        </div>

        <div className="border-t pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="text-sm font-medium">
              the submitted kernel, whole call
            </span>
            <span className="font-mono text-xs" style={{ color: WIN }}>
              {winner} &micro;s
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0.4, (winner / catFloor) * 100).toFixed(2)}%`,
                background: WIN,
              }}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
            0.010 ms, the report&rsquo;s own average over the 23 traces — about{" "}
            {(catFloor / winner).toFixed(0)}&times; inside the baseline&rsquo;s copy floor
          </p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        num_pages = 8462 on all 23 traces, counted from the contest trace set. The bar
        lengths are exact byte counts; the microsecond figures are bytes over peak HBM
        bandwidth, so they are floors. The MLA kernel the wrapper eventually calls is not
        included — it is the part nobody published a number for.
      </figcaption>
    </figure>
  )
}
