// "Half the forward passes" is true and misleading. A backward pass costs about
// twice a forward pass, so counting forwards counts the cheap third of the work.
//
// Units: one forward over a token costs ~2P FLOPs for P parameters, one backward
// ~4P. Both DPO and ORPO push the chosen and the rejected sequence through the
// policy with gradients (2 × 6P = 12P). DPO adds two no-grad forwards through the
// frozen reference (2 × 2P = 4P). 16P versus 12P is a 25% saving, not 50%.
//
// Server-rendered, zero JS. Widths are proportional to those FLOP units, so the
// picture and the arithmetic cannot drift apart. Pure +−×÷ — nothing here needs
// a dmath wrapper.

const ACCENT = "oklch(0.70 0.16 250)"
const WARM = "oklch(0.72 0.17 55)"

const W = 700
const BAR_X = 128 // left edge of the bars
const BAR_W = 520 // width of a full 16P row
const UNIT = BAR_W / 16 // px per P-unit
const ROW_H = 34
const ROW_GAP = 26
const TOP = 30

type Seg = { label: string; cost: number; kind: "fwd" | "bwd" | "ref" }
type Row = { name: string; sub: string; segs: Seg[] }

const POLICY: Seg[] = [
  { label: "fwd y_w", cost: 2, kind: "fwd" },
  { label: "backward y_w", cost: 4, kind: "bwd" },
  { label: "fwd y_l", cost: 2, kind: "fwd" },
  { label: "backward y_l", cost: 4, kind: "bwd" },
]

const ROWS: Row[] = [
  {
    name: "DPO",
    sub: "policy + reference",
    segs: [
      ...POLICY,
      { label: "ref", cost: 2, kind: "ref" },
      { label: "ref", cost: 2, kind: "ref" },
    ],
  },
  {
    name: "ORPO",
    sub: "policy only",
    segs: POLICY,
  },
]

const total = (r: Row) => r.segs.reduce((a, s) => a + s.cost, 0)
const H = TOP + ROWS.length * (ROW_H + ROW_GAP) + 16

const fill = (kind: Seg["kind"]) =>
  kind === "ref" ? WARM : ACCENT
const opacity = (kind: Seg["kind"]) =>
  kind === "fwd" ? 0.55 : kind === "bwd" ? 0.24 : 0.5

export function PassLedger() {
  const dpo = total(ROWS[0])
  const orpo = total(ROWS[1])
  const saved = Math.round((1 - orpo / dpo) * 100)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one optimizer step, one preference pair · width ∝ FLOPs, in units of P
        per token
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Two horizontal bars comparing per-step cost. The DPO bar has four policy blocks — forward chosen 2P, backward chosen 4P, forward rejected 2P, backward rejected 4P — followed by two reference forward blocks of 2P each, totalling ${dpo}P. The ORPO bar has only the four policy blocks, totalling ${orpo}P. ORPO removes ${dpo - orpo}P of ${dpo}P, which is ${saved} percent, not half.`}
        >
          {ROWS.map((row, ri) => {
            const yTop = TOP + ri * (ROW_H + ROW_GAP)
            let cursor = BAR_X
            return (
              <g key={row.name}>
                <text
                  x={BAR_X - 10}
                  y={yTop + ROW_H / 2 - 2}
                  textAnchor="end"
                  className="fill-foreground font-mono font-medium"
                  fontSize={12}
                >
                  {row.name}
                </text>
                <text
                  x={BAR_X - 10}
                  y={yTop + ROW_H / 2 + 11}
                  textAnchor="end"
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {row.sub}
                </text>

                {row.segs.map((s, si) => {
                  const w = s.cost * UNIT
                  const xPos = cursor
                  cursor += w
                  return (
                    <g key={si}>
                      <rect
                        x={xPos + 1}
                        y={yTop}
                        width={w - 2}
                        height={ROW_H}
                        rx={4}
                        fill={fill(s.kind)}
                        opacity={opacity(s.kind)}
                        stroke={fill(s.kind)}
                        strokeWidth={1.2}
                        strokeDasharray={s.kind === "ref" ? "4 3" : undefined}
                      />
                      <text
                        x={xPos + w / 2}
                        y={yTop + ROW_H / 2 + 3.5}
                        textAnchor="middle"
                        className="fill-foreground font-mono"
                        fontSize={10}
                      >
                        {s.label}
                      </text>
                      <text
                        x={xPos + w / 2}
                        y={yTop + ROW_H + 12}
                        textAnchor="middle"
                        className="fill-muted-foreground font-mono"
                        fontSize={9}
                      >
                        {s.cost}P
                      </text>
                    </g>
                  )
                })}

                <text
                  x={BAR_X + BAR_W + 10}
                  y={yTop + ROW_H / 2 + 4}
                  className="fill-foreground font-mono font-semibold"
                  fontSize={12}
                >
                  {total(row)}P
                </text>
              </g>
            )
          })}

          {/* bracket over the two reference blocks — the part ORPO deletes */}
          <path
            d={`M ${BAR_X + 12 * UNIT} ${TOP - 6} L ${BAR_X + 12 * UNIT} ${TOP - 2} L ${BAR_X + BAR_W} ${TOP - 2} L ${BAR_X + BAR_W} ${TOP - 6}`}
            fill="none"
            stroke={WARM}
            strokeWidth={1.2}
          />
          <text
            x={BAR_X + 14 * UNIT}
            y={TOP - 11}
            textAnchor="middle"
            className="font-mono"
            fill={WARM}
            fontSize={9}
          >
            what ORPO deletes
          </text>
        </svg>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>forward ≈ 2P / token</span>
          <span>backward ≈ 4P / token</span>
          <span className="text-foreground">
            {orpo}P / {dpo}P = {saved}% fewer FLOPs per step
          </span>
        </div>
      </div>

      <p className="border-t px-3 py-3 text-sm leading-6 text-muted-foreground sm:px-4">
        The paper&apos;s claim is that ORPO needs &ldquo;half the number of forward
        passes&rdquo; per batch — two instead of four — and that is exactly right.
        But two of DPO&apos;s four forwards are the reference model&apos;s, and those
        run under <span className="font-mono">no_grad</span>: they have no backward
        to pay for. The work that survives is the policy&apos;s four passes, two
        forward and two backward, and those are identical in both methods. Halving
        the forwards removes a quarter of the arithmetic. The independently measured
        number is close to this: SimPO, which is reference-free in the same
        structural way, reports roughly 20% less wall-clock and about 10% less peak
        memory against a vanilla DPO implementation on 8×H100 — the gap between 25%
        and 20% being optimizer and communication work that does not shrink.
      </p>
    </figure>
  )
}
