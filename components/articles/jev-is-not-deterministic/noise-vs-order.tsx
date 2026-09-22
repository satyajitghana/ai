import { mexp } from "@/lib/dmath"

// How big is each effect, in the same unit, on the same items.
//
// The unit is the one openjev's own comparison reports and the one I recompute
// from the hosted model's raw logs: for a decision, the largest movement of any
// single option's probability; averaged over decisions. Putting run-to-run
// variation and option order on one axis is the whole argument — they are not
// the same size, and neither of them is zero.
//
// The top block is the hosted model, where the two arms were run on the same
// 100 items in the same run, so they are directly comparable. The bottom block
// is an open vocabulary readout, where three ways of changing the machine
// without changing the question are measured against the same fixtures.
//
// Server-rendered SVG, zero JS. Bar lengths are integer arithmetic on values
// held in units of 1e-4; the only transcendental is the odds conversion in the
// footer, which goes through lib/dmath so the string is identical on the server
// and in the browser.
const W = 920
const H = 396

const LABEL_X = 20
const BAR_X = 352
const BAR_W = 410
const AXIS_MAX = 2800 // 0.2800, in units of 1e-4
const NUM_X = 800 // right edge of the mean column
const RATE_X = 900 // right edge of the answer-change column

const ROW_H = 26

type Row = {
  label: string
  sub: string
  dp: number // mean max |Δp| over decisions, in units of 1e-4
  rate: string
  order?: boolean
}

const HOSTED: Row[] = [
  {
    label: "nothing — the same request, three times",
    sub: "identical bytes, same version echoed back",
    dp: 363,
    rate: "5 / 100",
  },
  {
    label: "the option order — three permutations",
    sub: "same state, same question, same 77 options",
    dp: 956,
    rate: "12 / 100",
    order: true,
  },
]

const LOCAL: Row[] = [
  {
    label: "the batch shape — options scored together",
    sub: "777 decisions, prompt hashes identical",
    dp: 73,
    rate: "3 / 777",
  },
  {
    label: "the cache shape — a shared state prefix",
    sub: "777 decisions, prompt hashes identical",
    dp: 74,
    rate: "3 / 777",
  },
  {
    label: "the machine — Metal instead of CUDA",
    sub: "144 decisions, same weights, same prompts",
    dp: 86,
    rate: "0 / 144",
  },
  {
    label: "the option order — reversed",
    sub: "36 pairs, both sides a fresh prefill",
    dp: 2648,
    rate: "10 / 36",
    order: true,
  },
]

const TICKS = [0, 500, 1000, 1500, 2000, 2500]

function fmt(v: number): string {
  // v is in units of 1e-4; render as a four-decimal probability.
  const s = String(v).padStart(4, "0")
  return `0.${s}`
}

function Bars({ rows, y0 }: { rows: Row[]; y0: number }) {
  return (
    <g>
      {rows.map((r, i) => {
        const y = y0 + i * ROW_H
        const w = Math.max(2, Math.round((r.dp * BAR_W) / AXIS_MAX))
        return (
          <g key={r.label}>
            <text
              x={LABEL_X}
              y={y + 10}
              className={r.order ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              style={{ fontSize: 11 }}
            >
              {r.label}
            </text>
            <text
              x={LABEL_X}
              y={y + 22}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9.5 }}
            >
              {r.sub}
            </text>
            <rect
              x={BAR_X}
              y={y + 2}
              width={w}
              height={13}
              rx={2}
              className={
                r.order
                  ? "fill-foreground/70 stroke-foreground/70"
                  : "fill-muted-foreground/30 stroke-muted-foreground/50"
              }
              strokeWidth={1}
            />
            <text
              x={NUM_X}
              y={y + 13}
              textAnchor="end"
              className={r.order ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              style={{ fontSize: 11 }}
            >
              {fmt(r.dp)}
            </text>
            <text
              x={RATE_X}
              y={y + 13}
              textAnchor="end"
              className={r.order ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              style={{ fontSize: 11 }}
            >
              {r.rate}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function NoiseVsOrder() {
  const odds = mexp(1.7101).toFixed(2)
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        how far a probability moves when something that is not the question changes
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A horizontal bar chart measuring how far an option's probability moves when something other than the question changes, in two blocks. Block one, hosted Jev on 100 Banking77 items: repeating the identical request three times moves a probability by 0.0363 on average and changes the answer on 5 of 100; permuting the option list three ways moves it by 0.0956 and changes the answer on 12 of 100. Block two, the open vocabulary readout openjev: changing the batch shape by scoring options together moves a probability by 0.0073 over 777 decisions with identical prompt hashes and changes 3 of them; changing the cache shape to a shared state prefix moves it by 0.0074 and changes 3 of 777; running on Metal instead of CUDA with the same weights and prompts moves it by 0.0086 over 144 decisions and changes none; reversing the option order moves it by 0.2648 over 36 pairs and changes 10 of 36. A footnote records that the reversal's mechanism is a position prior worth plus 1.71 logits for the first slot, which multiplies an option's odds by about 5.53."
      >
        {/* axis */}
        <g className="stroke-border" strokeWidth={1}>
          {TICKS.map((t) => {
            const x = BAR_X + Math.round((t * BAR_W) / AXIS_MAX)
            return <line key={t} x1={x} y1={34} x2={x} y2={330} strokeDasharray="3 4" />
          })}
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          {TICKS.map((t) => {
            const x = BAR_X + Math.round((t * BAR_W) / AXIS_MAX)
            return (
              <text key={t} x={x} y={28} textAnchor="middle">
                {t === 0 ? "0" : `0.${String(t / 100).padStart(2, "0")}`}
              </text>
            )
          })}
        </g>
        <text
          x={NUM_X}
          y={28}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          mean max |Δp|
        </text>
        <text
          x={RATE_X}
          y={28}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          answer changed
        </text>

        {/* ---------- hosted ---------- */}
        <rect
          x={LABEL_X}
          y={42}
          width={880}
          height={20}
          rx={3}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        <text x={LABEL_X + 10} y={56} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
          HOSTED jev-1.13.0 · 100 Banking77 items, 77 options, one run, both arms
        </text>
        <Bars rows={HOSTED} y0={72} />

        {/* ---------- local ---------- */}
        <rect
          x={LABEL_X}
          y={136}
          width={880}
          height={20}
          rx={3}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        <text
          x={LABEL_X + 10}
          y={150}
          className="fill-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          OPEN VOCABULARY READOUT · openjev on Qwen3.5-4B, committed predictions
        </text>
        <Bars rows={LOCAL} y0={166} />

        {/* ---------- footer strip ---------- */}
        <line
          x1={LABEL_X}
          y1={342}
          x2={900}
          y2={342}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <g className="font-mono" style={{ fontSize: 10.5 }}>
          <text x={LABEL_X} y={362} className="fill-foreground">
            the reversal has a mechanism, and it is a position prior:
          </text>
          <text x={LABEL_X} y={378} className="fill-muted-foreground">
            first slot = +1.71 logits over the unmoved middle option, positive on 32 of 36
            questions — ×{odds} on an option’s odds for nothing written in it
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Same unit throughout: for one decision, the largest movement of any single option’s
        probability, averaged over decisions. The three grey bars in the lower block are
        everything I could change about the machine without touching the question. The order
        bar is thirty times longer.
      </figcaption>
    </figure>
  )
}
