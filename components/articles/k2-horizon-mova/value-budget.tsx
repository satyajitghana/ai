// What MoVA actually costs, since it is not the cache.
//
// Every stored figure is summed from the safetensors headers of all 48 shards of
// IFM/K2-Horizon-MoVA-36B-A4B. Every per-token figure is the config's routing
// applied to those shapes: top-8 of 100 FFN experts plus one shared expert on 45
// layers, top-4 of 64 value experts on the same 45 layers, and dense attention
// projections everywhere.
//
// The row to read is "value projection". A plain GQA v_proj at this width is
// 2560 × 1024 = 2.62M parameters per layer. MoVA stores 64 of them and runs 4,
// so it is a 64× weight multiplier and a 4× compute multiplier on that one
// projection — and a 0× cache multiplier, which is the claim.
//
// Server-rendered, zero JS.

type Row = {
  part: string
  stored: number
  active: number
  note?: string
}

const ROWS: Row[] = [
  {
    part: "MoE feed-forward experts",
    stored: 26_542_080_000,
    active: 2_123_366_400,
    note: "top-8 of 100 · 45 layers",
  },
  {
    part: "MoVA value experts",
    stored: 7_549_747_200,
    active: 471_859_200,
    note: "top-4 of 64 · 45 layers",
  },
  {
    part: "attention q / k / o",
    stored: 1_132_462_080,
    active: 1_132_462_080,
    note: "dense, all 48 layers",
  },
  {
    part: "attention output gate",
    stored: 503_316_480,
    active: 503_316_480,
    note: "softplus, per head",
  },
  {
    part: "shared expert",
    stored: 265_420_800,
    active: 265_420_800,
  },
  {
    part: "embedding + output head",
    stored: 1_283_194_880,
    active: 1_283_194_880,
  },
  {
    part: "dense FFN, layers 0-2",
    stored: 141_557_760,
    active: 141_557_760,
  },
  {
    part: "routers, norms, dense v_proj",
    stored: 27_012_820,
    active: 27_012_820,
  },
]

const STORED = 37_444_792_020
const ACTIVE_ALL = 5_948_190_420 // includes the embedding lookup and lm_head

const PLAIN_VPROJ = 2560 * 1024

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`
  return n.toLocaleString()
}

export function ValueBudget() {
  const maxStored = Math.max(...ROWS.map((r) => r.stored))
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        K2-Horizon-MoVA-36B-A4B · summed from the safetensors headers
      </div>
      <div className="overflow-x-auto">
        <table className="my-0 w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground">
                where the parameters are
              </th>
              <th className="px-2 py-2 text-right font-mono text-xs font-medium">
                stored
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs font-medium">
                active / token
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.part} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div>{r.part}</div>
                  {r.note ? (
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {r.note}
                    </div>
                  ) : null}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-muted">
                    <div
                      className={
                        r.part === "MoVA value experts"
                          ? "h-full bg-[var(--hg-accent,oklch(0.72_0.15_195))]"
                          : "h-full bg-muted-foreground/40"
                      }
                      style={{
                        width: `${((r.stored / maxStored) * 100).toFixed(2)}%`,
                      }}
                      aria-hidden
                    />
                  </div>
                </td>
                <td className="px-2 py-2 text-right align-top font-mono text-xs tabular-nums">
                  {fmt(r.stored)}
                </td>
                <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums">
                  {fmt(r.active)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 bg-muted/40">
              <td className="px-3 py-2 font-medium">total</td>
              <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                {fmt(STORED)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                {fmt(ACTIVE_ALL)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          value projection: {(7_549_747_200 / (45 * PLAIN_VPROJ)).toFixed(0)}×
          the weights of a plain GQA `v_proj`, {(4).toFixed(0)}× the decode
          multiply-accumulates
        </span>
        <span className="text-muted-foreground">
          {" "}
          · 0× the cache
        </span>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Active counts assume every routed expert is a distinct weight read, which
        is the worst case for a single token and the right case for a batch. The
        card names 4B active and 36B stored; counting the output head but not the
        embedding lookup gives 5.31B, and counting neither gives 4.66B.
      </figcaption>
    </figure>
  )
}
