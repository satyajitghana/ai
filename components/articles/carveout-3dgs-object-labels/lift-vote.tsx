// How one Gaussian gets a class when the views disagree.
//
// Stage 3 is FlashSplat's closed form, implemented on gsplat's autograd. Per
// view, Carveout rasterises a stack of C+1 all-ones colour channels — one per
// class detected in that view, plus a total — multiplies the render by the
// mask stack and takes one backward pass. The gradient w.r.t. a Gaussian's
// colour IS its alpha-weighted contribution to those pixels. A[g,c] sums that
// over every view; T[g] sums the all-ones channel. The decision is then
//
//     win = argmax_c A[g,c]        assigned iff A[g,win] > gamma * (T[g] - A[g,win])
//
// which is a contribution-weighted vote over the whole view set, not a
// per-view majority and not first-wins. Note what does NOT enter it: SAM 3's
// own confidence. A detection either clears the presence threshold and its
// mask joins the stack at full weight, or it does not exist.
//
// The five views below are a WORKED EXAMPLE with made-up contributions, chosen
// so the arithmetic is checkable on screen; they are not a measurement. The
// gamma default (1.0) and the workbench override (0.30, set from an audited
// median of 0.41) are Carveout's own, from configs/default.yaml and
// docs/CALIBRATION.md. Server-rendered, zero JS.

const WIN = "oklch(0.60 0.15 255)" // the class that wins
const RIVAL = "oklch(0.68 0.13 85)" // the class that does not
const REST = "oklch(0.62 0.03 250)" // contribution outside every mask

type View = { id: string; total: number; win: number; rival: number; note: string }

const VIEWS: View[] = [
  { id: "view 03", total: 0.3, win: 0.28, rival: 0, note: "clean, front on" },
  { id: "view 11", total: 0.22, win: 0.2, rival: 0, note: "clean, oblique" },
  { id: "view 18", total: 0.26, win: 0, rival: 0.11, note: "wrong mask claims it" },
  { id: "view 24", total: 0.14, win: 0, rival: 0, note: "visible, undetected" },
  { id: "view 31", total: 0.18, win: 0.17, rival: 0, note: "clean, behind glass" },
]

const A_WIN = VIEWS.reduce((s, v) => s + v.win, 0) // 0.65
const A_RIVAL = VIEWS.reduce((s, v) => s + v.rival, 0) // 0.11
const T = VIEWS.reduce((s, v) => s + v.total, 0) // 1.10
const OUT = T - A_WIN // 0.45

const GAMMA = 1.0
const GAMMA_OVERRIDE = 0.3

const W = 700
const ROW_H = 26
const TOP = 40
const BAR_X = 104
const BAR_W = 360
const UNIT = BAR_W / 0.32 // the widest single-view total sets the scale
const SUM_X = 486

export function LiftVote() {
  const H = TOP + VIEWS.length * ROW_H + 132

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stage 3 · one Gaussian, five views</span>
        <span className="text-muted-foreground/60">worked example</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Five views each contribute a bar split into in-mask contribution for the winning class, in-mask contribution for a rival class, and contribution outside every mask. Summed, the winning class holds 0.65 against 0.45 outside it, which clears the default gamma of 1.0 by 0.20."
        >
          <text
            x={BAR_X}
            y={26}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            per-view contribution of this Gaussian
          </text>
          <text
            x={SUM_X}
            y={26}
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            running totals
          </text>

          {VIEWS.map((v, i) => {
            const y = TOP + i * ROW_H
            const wWin = v.win * UNIT
            const wRival = v.rival * UNIT
            const wRest = (v.total - v.win - v.rival) * UNIT
            return (
              <g key={v.id}>
                <text
                  x={12}
                  y={y + 14}
                  className="fill-muted-foreground font-mono"
                  fontSize={9.5}
                >
                  {v.id}
                </text>
                <rect
                  x={BAR_X}
                  y={y + 4}
                  width={wWin}
                  height={13}
                  fill={WIN}
                  fillOpacity={0.85}
                />
                <rect
                  x={BAR_X + wWin}
                  y={y + 4}
                  width={wRival}
                  height={13}
                  fill={RIVAL}
                  fillOpacity={0.85}
                />
                <rect
                  x={BAR_X + wWin + wRival}
                  y={y + 4}
                  width={wRest}
                  height={13}
                  fill={REST}
                  fillOpacity={0.4}
                />
                <text
                  x={BAR_X + v.total * UNIT + 8}
                  y={y + 14}
                  className="fill-muted-foreground font-mono"
                  fontSize={8.5}
                >
                  {v.note}
                </text>
              </g>
            )
          })}

          <line
            x1={BAR_X}
            x2={BAR_X + BAR_W}
            y1={TOP + VIEWS.length * ROW_H + 4}
            y2={TOP + VIEWS.length * ROW_H + 4}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />

          {/* --- the accumulators ------------------------------------------- */}
          {[
            { label: "A[salon chair]", v: A_WIN, c: WIN },
            { label: "A[barber chair]", v: A_RIVAL, c: RIVAL },
            { label: "T (all views)", v: T, c: REST },
          ].map((r, i) => {
            const y = TOP + VIEWS.length * ROW_H + 26 + i * 22
            return (
              <g key={r.label}>
                <text
                  x={12}
                  y={y + 10}
                  className="fill-muted-foreground font-mono"
                  fontSize={9.5}
                >
                  {r.label}
                </text>
                <rect
                  x={BAR_X}
                  y={y}
                  width={(r.v / T) * BAR_W}
                  height={12}
                  fill={r.c}
                  fillOpacity={r.c === REST ? 0.4 : 0.85}
                />
                <text
                  x={BAR_X + (r.v / T) * BAR_W + 8}
                  y={y + 10}
                  className="fill-foreground font-mono"
                  fontSize={9.5}
                >
                  {r.v.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* --- the gate ---------------------------------------------------- */}
          <g>
            <text
              x={SUM_X}
              y={TOP + 14}
              className="fill-foreground font-mono"
              fontSize={10}
            >
              A_win &gt; γ · (T − A_win)
            </text>
            <text
              x={SUM_X}
              y={TOP + 34}
              className="fill-muted-foreground font-mono"
              fontSize={9.5}
            >
              {A_WIN.toFixed(2)} &gt; {GAMMA.toFixed(1)} × {OUT.toFixed(2)}
            </text>
            <text
              x={SUM_X}
              y={TOP + 50}
              fill={WIN}
              className="font-mono"
              fontSize={11}
            >
              assigned, by {(A_WIN - GAMMA * OUT).toFixed(2)}
            </text>

            <line
              x1={SUM_X}
              x2={W - 20}
              y1={TOP + 64}
              y2={TOP + 64}
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
            />
            <text
              x={SUM_X}
              y={TOP + 82}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              γ = {GAMMA.toFixed(1)} default; a class seen
            </text>
            <text
              x={SUM_X}
              y={TOP + 94}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              in few views accumulates T
            </text>
            <text
              x={SUM_X}
              y={TOP + 106}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              everywhere and A nowhere, so
            </text>
            <text
              x={SUM_X}
              y={TOP + 118}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              it needs an override — the
            </text>
            <text
              x={SUM_X}
              y={TOP + 130}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              workbench class ships at {GAMMA_OVERRIDE.toFixed(2)}.
            </text>
          </g>

          {/* --- legend ------------------------------------------------------ */}
          <g>
            {[
              { c: WIN, t: "in the winning class's mask", x: 12 },
              { c: RIVAL, t: "in a rival class's mask", x: 224 },
              { c: REST, t: "in no mask", x: 400 },
            ].map((l) => (
              <g key={l.t}>
                <rect
                  x={l.x}
                  y={H - 22}
                  width={9}
                  height={9}
                  fill={l.c}
                  fillOpacity={l.c === REST ? 0.4 : 0.85}
                />
                <text
                  x={l.x + 14}
                  y={H - 14}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {l.t}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </figure>
  )
}
