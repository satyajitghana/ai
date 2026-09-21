// The published multipliers, factored.
//
// 245x and 112x are ratios of median cost per attempt. Both comparisons change
// two things at once — the interface AND the model — so each one factors into a
// product of two ratios that can be read off the same board:
//
//   interface effect : hold the model at GPT-6 Astra, change WebMCP for a
//                      screen- or code-driving interface.
//   price effect     : hold the interface at WebMCP, change GPT-6 Astra for
//                      Jev + Mercury 2.5.
//
// All four medians come from results/canonical/results.csv, 147 attempts each.
// Only divisions here, so no lib/dmath wrappers are needed.
//
// Server-rendered, zero JS.

const JEV = 0.00106396
const ASTRA_WM = 0.0171
const ASTRA_CODE = 0.118676
const ASTRA_CU = 0.26078

const x = (v: number) => `${v.toFixed(2)}x`

function Cell({
  iface,
  cost,
  solved,
  tokens,
  factor,
  emphasis,
}: {
  iface: string
  cost: number
  solved: string
  tokens: string
  factor?: string
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-sm border px-2.5 py-2 ${
        emphasis ? "border-foreground/40 bg-foreground/[0.04]" : "border-border"
      }`}
    >
      <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        {iface}
      </p>
      <p className="font-mono text-sm leading-6 font-semibold">
        ${cost.toFixed(6)}
      </p>
      <p className="font-mono text-[10px] text-muted-foreground">
        {solved} solved · {tokens} tok
      </p>
      {factor ? (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{factor}</p>
      ) : null}
    </div>
  )
}

export function CostFactors() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        median model cost per attempt · 49 tasks × 3 attempts each
      </div>

      <div className="space-y-2 px-3 py-3">
        <p className="font-mono text-[11px] font-semibold">GPT-6 Astra</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Cell
            iface="WebMCP"
            cost={ASTRA_WM}
            solved="49/49"
            tokens="2,575"
            factor="baseline for this row"
            emphasis
          />
          <Cell
            iface="code execution"
            cost={ASTRA_CODE}
            solved="49/49"
            tokens="10,982"
            factor={`${x(ASTRA_CODE / ASTRA_WM)} the WebMCP cell`}
          />
          <Cell
            iface="computer use"
            cost={ASTRA_CU}
            solved="45/49"
            tokens="20,560"
            factor={`${x(ASTRA_CU / ASTRA_WM)} the WebMCP cell`}
          />
        </div>

        <div className="flex items-center gap-2 pt-1 pl-1">
          <span className="font-mono text-xs text-muted-foreground">↓</span>
          <span className="font-mono text-[11px]">
            {x(ASTRA_WM / JEV)} — same interface, same 49 tasks, different models
          </span>
        </div>

        <p className="font-mono text-[11px] font-semibold">Jev 1.13.0 + Mercury 2.5</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Cell
            iface="WebMCP"
            cost={JEV}
            solved="49/49"
            tokens="9,793"
            factor="the rank-1 row"
            emphasis
          />
        </div>
      </div>

      <div className="space-y-1 border-t px-3 py-2">
        <p className="font-mono text-[11px] leading-6">
          <span className="font-semibold">{x(ASTRA_CU / JEV)}</span> ={" "}
          {x(ASTRA_CU / ASTRA_WM)} interface × {x(ASTRA_WM / JEV)} price
        </p>
        <p className="font-mono text-[11px] leading-6">
          <span className="font-semibold">{x(ASTRA_CODE / JEV)}</span> ={" "}
          {x(ASTRA_CODE / ASTRA_WM)} interface × {x(ASTRA_WM / JEV)} price
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 text-center font-mono text-[11px] leading-5 text-muted-foreground">
        Both headline multipliers carry the same {x(ASTRA_WM / JEV)} price term. What
        WebMCP itself buys, with the model held fixed, is the other factor:{" "}
        {x(ASTRA_CU / ASTRA_WM)} against screenshots and {x(ASTRA_CODE / ASTRA_WM)}{" "}
        against code execution.
      </figcaption>
    </figure>
  )
}
