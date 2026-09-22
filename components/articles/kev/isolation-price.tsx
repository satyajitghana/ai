// What exact order-invariance costs, measured by somebody who built both.
//
// The property this site has praised Jev for — options that cannot see each
// other, so the answer cannot depend on their order — is a flag in kev/model.py.
// Turning it on gives permutation invariance by construction and a measured
// mean max Δp of 1.2e-7. It was run at three sizes, and it is not in any
// released checkpoint, for two separate reasons:
//
//   1. at 4B, against its own matched control, it costs 5.8 points of
//      out-of-domain accuracy (PLAN.md, round auto-4b-r1);
//   2. on Qwen3.5 it cannot be used at all, because the Gated DeltaNet layers
//      are recurrent and ignore the attention mask the flag needs.
//
// The loss-side alternative — a symmetric KL between two option orders, --perm_kl
// — is also shipped, also unused, and does not remove the flips.
//
// Server-rendered SVG, zero JS, integer coordinates only.

type Row = {
  fix: string
  how: string
  flips: string
  delta: string
  cost: string
  shipped: string
}

const ROWS: Row[] = [
  {
    fix: "option_isolation",
    how: "each option span is its own sub-branch, all spans share one position",
    flips: "0 of 864",
    delta: "2e-7",
    cost: "−5.8 pp at 4B vs its matched control",
    shipped: "no — and unavailable on Qwen3.5",
  },
  {
    fix: "--perm_kl",
    how: "second forward pass on a shuffled list, symmetric KL between the two",
    flips: "1–3 of 36",
    delta: "0.029–0.088",
    cost: "within noise on accuracy",
    shipped: "no",
  },
  {
    fix: "nothing",
    how: "the shipped recipe: one pass, options share their question's context",
    flips: "12 of 672 at 9B",
    delta: "0.033",
    cost: "—",
    shipped: "yes, all three sizes",
  },
]

export function IsolationPrice() {
  const W = 820
  const top = 92
  const rowH = 54
  const H = top + ROWS.length * rowH + 44

  const xFix = 16
  const xFlips = 250
  const xDelta = 352
  const xCost = 452
  const xShipped = 648

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        two ways to buy order-invariance, both implemented, neither released
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A table of three approaches to option-order sensitivity in Kev. Option isolation, which makes each option span its own sub-branch sharing one position, flips zero of 864 items with a mean max probability change of 2e-7, costs 5.8 points of out-of-domain accuracy at 4B against its matched control, and is not shipped and not available on Qwen3.5 backbones. The perm_kl loss, a second forward pass on a shuffled list with a symmetric KL between the two, still flips one to three of 36 items with a 0.029 to 0.088 probability change, is within noise on accuracy, and is not shipped. Doing nothing, the shipped recipe of one pass with options sharing their question's context, flips 12 of 672 at 9B with a 0.033 probability change, and is what all three released sizes use."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={xFix} y={26}>
            the property is a flag, and the flag has a price
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xFix} y={44}>
            both fixes exist in kev/model.py and kev/train.py; neither is in a
            released checkpoint
          </text>
          <text x={xFix} y={72}>
            approach
          </text>
          <text x={xFlips} y={72}>
            flips
          </text>
          <text x={xDelta} y={72}>
            mean max Δp
          </text>
          <text x={xCost} y={72}>
            what it costs
          </text>
          <text x={xShipped} y={72}>
            released?
          </text>
        </g>
        <line
          x1={xFix}
          y1={78}
          x2={W - 16}
          y2={78}
          className="stroke-border"
          strokeWidth={1}
        />

        {ROWS.map((row, i) => {
          const y = top + i * rowH
          const on = row.fix === "nothing"
          return (
            <g key={row.fix}>
              <rect
                x={xFix - 6}
                y={y - 12}
                width={W - 20}
                height={rowH - 8}
                rx={4}
                className={
                  on ? "fill-foreground/5 stroke-foreground/30" : "fill-background"
                }
                strokeWidth={on ? 1 : 0}
              />
              <text
                x={xFix}
                y={y + 6}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.fix}
              </text>
              <text
                x={xFix}
                y={y + 20}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8 }}
              >
                {row.how.slice(0, 44)}
              </text>
              <text
                x={xFix}
                y={y + 31}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8 }}
              >
                {row.how.slice(44)}
              </text>

              <text
                x={xFlips}
                y={y + 6}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.flips}
              </text>
              <text
                x={xDelta}
                y={y + 6}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {row.delta}
              </text>
              <text
                x={xCost}
                y={y + 6}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {row.cost}
              </text>
              <text
                x={xShipped}
                y={y + 6}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {row.shipped.slice(0, 22)}
              </text>
              <text
                x={xShipped}
                y={y + 18}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {row.shipped.slice(22)}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Isolation numbers pooled from the eighteen committed trials that set{" "}
        <code>option_isolation=1</code>; the 5.8-point figure is{" "}
        <code>PLAN.md</code>&apos;s own, from round <code>auto-4b-r1</code> against
        the matched low-learning-rate incumbent. On Qwen3.5 the constructor
        refuses: <code>option_isolation needs the packed mask; not available on
        hybrid backbones</code>. So the newest family of open bases makes the
        property harder to buy, not easier.
      </figcaption>
    </figure>
  )
}
