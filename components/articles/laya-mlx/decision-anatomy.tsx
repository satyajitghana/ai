// What one Snake "decision" actually costs the Neural Engine bundle.
//
// A decision is not one model call. laya_coreml/snake/policy.py asks three typed
// questions per move — one `choice` over the four directions and two `noul`
// propositions, each of which renders as a fixed [false, true] pair — and the
// ANE adapter runs them as three sequential B=1 predictions. So a per-decision
// latency without an option count is not a latency at all.
//
// The two occupancy numbers below are the exported shapes against the measured
// traffic: 32 marker slots per call whatever the question, 96 token positions per
// call whatever the prompt, against 150-155 real tokens per decision across all
// 4,920 benchmark decisions the repository publishes.
//
// Server-rendered SVG, zero JS.

type Call = { id: string; kind: string; used: number; note: string }

const CALLS: Call[] = [
  { id: "move", kind: "choice", used: 4, note: "UP · DOWN · LEFT · RIGHT" },
  { id: "risk", kind: "noul", used: 2, note: "false · true" },
  { id: "food", kind: "noul", used: 2, note: "false · true" },
]

const SLOTS = 32
const LENGTH = 96
const TOKENS = 152 // median input_tokens per decision, summed over the three calls

export function DecisionAnatomy() {
  const W = 800
  const boxY = 68
  const boxH = 104
  const boxW = 240
  const boxGap = 22
  const barY = 206
  const barX = 20
  const barW = 760
  const barH = 26
  const H = 300

  const usedSlots = CALLS.reduce((a, c) => a + c.used, 0)
  const totalSlots = SLOTS * CALLS.length
  const totalPositions = LENGTH * CALLS.length
  const slotPct = ((usedSlots / totalSlots) * 100).toFixed(1)
  const padPct = (((totalPositions - TOKENS) / totalPositions) * 100).toFixed(1)
  const realW = Math.round((barW * TOKENS) / totalPositions)
  const seg = Math.round(barW / CALLS.length)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one Snake decision · three sequential calls · aac6fef/laya-multilingual-coreml-ane
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="One Snake decision broken into its three model calls. The move question is a choice over four directions and fills four of the bundle's thirty-two marker slots. The risk and food questions are boolean propositions and fill two slots each. Eight of ninety-six exported marker slots carry an option. Below, a bar shows that the three calls together attend over two hundred and eighty-eight token positions while carrying about one hundred and fifty-two real tokens."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={20} y={24}>
            a decision is three questions, and the options are 4, 2 and 2
          </text>
        </g>
        <text
          x={20}
          y={42}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          the bundle exports 32 marker slots and a 96-token window for every one of them
        </text>

        {CALLS.map((c, i) => {
          const x0 = 20 + i * (boxW + boxGap)
          return (
            <g key={c.id}>
              <rect
                x={x0}
                y={boxY}
                width={boxW}
                height={boxH}
                rx={5}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <text
                x={x0 + 12}
                y={boxY + 20}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {c.id}
              </text>
              <text
                x={x0 + 58}
                y={boxY + 20}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {c.kind} · {c.note}
              </text>
              <text
                x={x0 + 12}
                y={boxY + 38}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                marker slots — {c.used} of {SLOTS} occupied
              </text>
              {Array.from({ length: SLOTS }, (_, k) => {
                const col = k % 16
                const row = k < 16 ? 0 : 1
                const filled = k < c.used
                return (
                  <rect
                    key={k}
                    x={x0 + 12 + col * 14}
                    y={boxY + 48 + row * 16}
                    width={11}
                    height={11}
                    rx={2}
                    className={
                      filled
                        ? "fill-foreground stroke-foreground"
                        : "fill-muted/30 stroke-border"
                    }
                    strokeWidth={1}
                  />
                )
              })}
              <text
                x={x0 + 12}
                y={boxY + 96}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9 }}
              >
                one forward pass · B = 1 · L = {LENGTH}
              </text>
            </g>
          )
        })}

        <text
          x={barX}
          y={barY - 12}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          token positions attended over, all three calls — {TOKENS} real of{" "}
          {totalPositions} exported
        </text>
        <rect
          x={barX}
          y={barY}
          width={barW}
          height={barH}
          rx={4}
          className="fill-muted/30 stroke-border"
          strokeWidth={1}
        />
        <rect
          x={barX}
          y={barY}
          width={realW}
          height={barH}
          rx={4}
          className="fill-foreground/70"
        />
        {[1, 2].map((i) => (
          <line
            key={i}
            x1={barX + i * seg}
            y1={barY}
            x2={barX + i * seg}
            y2={barY + barH}
            className="stroke-background"
            strokeWidth={1.5}
          />
        ))}
        <text
          x={barX + realW + 10}
          y={barY + 17}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          padding
        </text>

        <g className="font-mono" style={{ fontSize: 11 }}>
          <text x={barX} y={H - 22} className="fill-foreground">
            {usedSlots} of {totalSlots} marker slots carry an option — {slotPct}%
          </text>
          <text x={barX + 380} y={H - 22} className="fill-foreground">
            {padPct}% of the attended positions are padding
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The occupancy is not waste the author overlooked — it is the price of a fixed
        graph, and the repository says so, noting in its own design notes that
        &ldquo;Snake does not need 96 tokens&rdquo; and that a dedicated B3/L64 Neural
        Engine export would be separate work. The token total is the median of{" "}
        <code>input_tokens</code>
        {" across every benchmark decision, which ranges 150-155 and never moves; the "}
        {"per-question split is not published, so the bar shows the sum against the sum."}
      </figcaption>
    </figure>
  )
}
