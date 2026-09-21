import { mlog, mlog10 } from "@/lib/dmath"

// Where ORPO's penalty term actually has teeth, and where it switches itself off.
//
// The odds-ratio loss is L_OR = -log σ(log OR), with OR = odds(y_w)/odds(y_l) and
// odds(y) = P/(1-P). Two exact simplifications make this drawable with almost no
// transcendental arithmetic:
//
//   -log σ(z) = log(1 + e^-z),  so with z = log OR:   L_OR = log(1 + 1/OR)
//   the gradient gate  δ = σ(-log OR) = 1/(1 + OR)    — pure arithmetic, no exp
//
// and the paper's h(d) contributes a 1/(1-P) amplifier on each side, so the pull
// this loss exerts on the rejected response's log-likelihood is δ/(1-P_l).
//
// P here is the paper's Eq. 3 quantity: the GEOMETRIC MEAN per-token probability
// of the sequence, not the joint sequence probability. That is what keeps it in a
// range where 1-P means anything, and it is why the odds ratio is not just the
// probability ratio wearing a hat.
//
// Server-rendered, zero JS. Only mlog / mlog10 touch the DOM-bound numbers.

const ACCENT = "oklch(0.70 0.16 250)"
const WARM = "oklch(0.72 0.17 55)"

const P_W = 0.6 // chosen response's geometric-mean per-token probability, held fixed
const X_LO = 0.02
const X_HI = 0.95
const Y_LO = 0.01
const Y_HI = 20

// chart geometry (viewBox units)
const W = 700
const H = 340
const PL = 46
const PR = 132
const PT = 18
const PB = 40

const odds = (p: number) => p / (1 - p)
const ODDS_W = odds(P_W)

const ratio = (pl: number) => ODDS_W / odds(pl)
const gate = (pl: number) => 1 / (1 + ratio(pl)) // δ(d)
const loss = (pl: number) => mlog(1 + 1 / ratio(pl)) // L_OR
const pullRejected = (pl: number) => gate(pl) / (1 - pl)
const pullChosen = (pl: number) => gate(pl) / (1 - P_W)

const x = (p: number) => PL + ((p - X_LO) / (X_HI - X_LO)) * (W - PL - PR)
const y = (v: number) => {
  const t = (mlog10(Math.max(v, Y_LO)) - mlog10(Y_LO)) / (mlog10(Y_HI) - mlog10(Y_LO))
  return PT + (1 - t) * (H - PT - PB)
}

const SAMPLES = 140
const xs = Array.from({ length: SAMPLES }, (_, i) => X_LO + ((X_HI - X_LO) * i) / (SAMPLES - 1))
const path = (f: (p: number) => number) =>
  xs.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p).toFixed(2)} ${y(f(p)).toFixed(2)}`).join(" ")

const DECADES = [0.01, 0.1, 1, 10]
const X_TICKS = [0.1, 0.3, 0.5, 0.7, 0.9]

// the three readouts under the plot
const STOPS = [
  { pl: 0.05, head: "rejected already unlikely", note: "term is asleep" },
  { pl: 0.6, head: "dead heat, P_l = P_w", note: "gate exactly half open" },
  { pl: 0.9, head: "rejected beats chosen", note: "term is shouting" },
]

const fmt = (v: number) =>
  v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(3) : v.toFixed(4)

export function OddsPenalty() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        ORPO&apos;s odds-ratio term vs the probability it assigns the rejected
        response · chosen held at P(y_w) = {P_W}
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Log-scale plot against the rejected response's geometric-mean per-token probability, from ${X_LO} to ${X_HI}, with the chosen response fixed at ${P_W}. Three curves rise monotonically from left to right. The pull on the rejected response, delta over one minus P, rises from ${fmt(pullRejected(0.05))} at P equals 0.05 to ${fmt(pullRejected(0.9))} at P equals 0.9 — a factor of about 240. The gradient gate delta rises from ${fmt(gate(0.05))} to ${fmt(gate(0.9))}. The loss itself rises from ${fmt(loss(0.05))} to ${fmt(loss(0.9))}. All three are near zero while the rejected response is already unlikely.`}
        >
          {/* decade gridlines */}
          {DECADES.map((d) => (
            <g key={d}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y(d)}
                y2={y(d)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
              />
              <text
                x={PL - 7}
                y={y(d) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {d < 1 ? d.toFixed(2) : d}
              </text>
            </g>
          ))}

          {/* x axis ticks */}
          {X_TICKS.map((t) => (
            <text
              key={t}
              x={x(t)}
              y={H - PB + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {t.toFixed(1)}
            </text>
          ))}
          <text
            x={(PL + W - PR) / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            P(y_l) — rejected response, geometric-mean per-token probability →
          </text>

          {/* the dead-heat marker */}
          <line
            x1={x(P_W)}
            x2={x(P_W)}
            y1={PT}
            y2={H - PB}
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1}
            strokeDasharray="3 4"
            opacity={0.7}
          />
          <text
            x={x(P_W) - 5}
            y={PT + 11}
            textAnchor="end"
            className="fill-muted-foreground font-mono"
            fontSize={9}
          >
            OR = 1
          </text>

          {/* curves, least important first */}
          <path d={path(loss)} fill="none" stroke={WARM} strokeWidth={1.6} strokeDasharray="5 4" />
          <path
            d={path(gate)}
            fill="none"
            stroke="currentColor"
            className="text-muted-foreground"
            strokeWidth={1.6}
          />
          <path
            d={path(pullChosen)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.6}
            opacity={0.45}
          />
          <path d={path(pullRejected)} fill="none" stroke={ACCENT} strokeWidth={2.6} />

          {/* right-hand curve labels */}
          <g>
            <text
              x={W - PR + 8}
              y={y(pullRejected(X_HI)) + 3}
              className="fill-foreground font-mono font-medium"
              fontSize={10}
            >
              pull on y_l
            </text>
            <text
              x={W - PR + 8}
              y={y(pullRejected(X_HI)) + 15}
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              δ / (1 − P_l)
            </text>

            {/* pull-on-y_w and L_OR end within 5px of each other on the log
                axis, so their labels are nudged apart by hand */}
            <text
              x={W - PR + 8}
              y={y(pullChosen(X_HI)) + 12}
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              pull on y_w
            </text>

            <text
              x={W - PR + 8}
              y={y(gate(X_HI)) + 3}
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              gate δ
            </text>

            <text
              x={W - PR + 8}
              y={y(loss(X_HI)) - 7}
              className="font-mono"
              fill={WARM}
              fontSize={10}
            >
              loss L_OR
            </text>
          </g>
        </svg>

        {/* numeric readouts at three points on the x axis */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {STOPS.map((s) => (
            <div key={s.pl} className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">
                P(y_l) = {s.pl.toFixed(2)} · {s.head}
              </div>
              <div className="mt-1.5 space-y-0.5 font-mono text-[11px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">odds ratio</span>
                  <span className="text-foreground">{fmt(ratio(s.pl))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">L_OR</span>
                  <span className="text-foreground">{fmt(loss(s.pl))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">gate δ</span>
                  <span className="text-foreground">{fmt(gate(s.pl))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">pull on y_l</span>
                  <span style={{ color: ACCENT }}>{fmt(pullRejected(s.pl))}</span>
                </div>
              </div>
              <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
                {s.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="border-t px-3 py-3 text-sm leading-6 text-muted-foreground sm:px-4">
        Log vertical axis, four decades. The curve that matters is the thick one:
        the coefficient this loss puts on{" "}
        <span className="font-mono">∇ log P(y_l)</span>, which is the gate{" "}
        <span className="font-mono">δ = 1/(1+OR)</span> times the{" "}
        <span className="font-mono">1/(1−P_l)</span> amplifier from{" "}
        <span className="font-mono">h(d)</span>. It runs from{" "}
        {fmt(pullRejected(0.05))} when the rejected response is already unlikely to{" "}
        {fmt(pullRejected(0.9))} when the model prefers it — a factor of{" "}
        {Math.round(pullRejected(0.9) / pullRejected(0.05))}. That asymmetry is the
        whole design: on a pair the model already has right, the penalty term
        contributes essentially nothing and the plain SFT term runs the show; on a
        pair the model has backwards, the penalty dominates. &ldquo;Weak penalty,
        strong adaptation&rdquo; is not a slogan about magnitudes, it is a statement
        about <em>which examples</em> get penalised. Curves computed from the
        paper&apos;s Eq. 7 and Eq. 9–10 with the chosen side pinned at{" "}
        {P_W}; moving that pin slides the curves sideways without changing the shape.
      </p>
    </figure>
  )
}
