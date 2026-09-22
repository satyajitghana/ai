// The reliability diagram neither release drew, from the predictions both of
// them committed.
//
// AgentJev publishes 2,000 per-question calibrated probabilities and the 2,000
// Laya probabilities it measured on the same rows, so the curve is arithmetic on
// files already in the repository. Both models sit under the diagonal in every
// populated bin: they are not over-confident anywhere, they are under-confident
// everywhere. That is the opposite of the failure a confidence-gated router is
// usually warned about, and it has a cause — the training target is a teacher's
// spread, whose mean top mass on this split is 0.659, and a model trained to
// reproduce that spread reports 0.624 while being right 0.793 of the time.
//
// Server-rendered SVG, zero JS. All arithmetic is +, -, * and / on the committed
// bin counts.

type Bin = { lo: number; n: number; conf: number; acc: number }

// 10 equal-width bins on top-1 confidence; the two lowest bins are empty for both.
const AGENTJEV: Bin[] = [
  { lo: 0.2, n: 4, conf: 0.29, acc: 0.5 },
  { lo: 0.3, n: 96, conf: 0.376, acc: 0.448 },
  { lo: 0.4, n: 440, conf: 0.458, acc: 0.568 },
  { lo: 0.5, n: 524, conf: 0.546, acc: 0.779 },
  { lo: 0.6, n: 345, conf: 0.641, acc: 0.881 },
  { lo: 0.7, n: 205, conf: 0.743, acc: 0.946 },
  { lo: 0.8, n: 176, conf: 0.849, acc: 0.989 },
  { lo: 0.9, n: 210, conf: 0.952, acc: 1.0 },
]

const LAYA: Bin[] = [
  { lo: 0.2, n: 4, conf: 0.28, acc: 0.5 },
  { lo: 0.3, n: 247, conf: 0.367, acc: 0.538 },
  { lo: 0.4, n: 600, conf: 0.45, acc: 0.663 },
  { lo: 0.5, n: 559, conf: 0.543, acc: 0.783 },
  { lo: 0.6, n: 234, conf: 0.645, acc: 0.914 },
  { lo: 0.7, n: 150, conf: 0.748, acc: 1.0 },
  { lo: 0.8, n: 190, conf: 0.855, acc: 0.995 },
  { lo: 0.9, n: 16, conf: 0.916, acc: 1.0 },
]

const PAD = 46
const SIZE = 268
const X0 = PAD
const Y0 = 18
const px = (v: number) => X0 + v * SIZE
const py = (v: number) => Y0 + (1 - v) * SIZE
const W = X0 + SIZE + 96
const H = Y0 + SIZE + 46

const TICKS = [0, 0.25, 0.5, 0.75, 1]

function path(bins: Bin[]) {
  return bins.map((b, i) => `${i ? "L" : "M"} ${px(b.conf).toFixed(2)} ${py(b.acc).toFixed(2)}`).join(" ")
}

export function Reliability() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Typed Decisions test split · 2,000 questions each · 10 equal-width confidence bins
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="A reliability diagram. The diagonal marks perfect calibration. Two curves, AgentJev and Laya, both lie entirely above the diagonal, meaning accuracy exceeds stated confidence in every bin. AgentJev runs from 0.376 confidence at 0.448 accuracy up to 0.952 confidence at 1.0 accuracy; its widest gap is 0.24 at the 0.6 to 0.7 bin. Laya runs from 0.367 at 0.538 to 0.916 at 1.0, with a widest gap of 0.27, also around 0.6 to 0.7. A dotted vertical rule marks 0.659, the mean top mass of the teacher distribution the models were trained on. Circle areas mark how many of the 2,000 questions fall in each bin."
      >
        {/* grid */}
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={px(t)} y1={Y0} x2={px(t)} y2={py(0)} className="stroke-border" strokeWidth={0.75} strokeDasharray="2 5" />
            <line x1={X0} y1={py(t)} x2={px(1)} y2={py(t)} className="stroke-border" strokeWidth={0.75} strokeDasharray="2 5" />
            <text x={px(t)} y={py(0) + 15} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {t}
            </text>
            <text x={X0 - 8} y={py(t) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
              {t}
            </text>
          </g>
        ))}

        {/* perfect calibration */}
        <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} className="stroke-foreground/45" strokeWidth={1.25} />
        <text x={px(0.78)} y={py(0.78) + 14} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          perfectly calibrated
        </text>

        {/* the teacher's own mean top mass */}
        <line x1={px(0.659)} y1={Y0} x2={px(0.659)} y2={py(0)} className="stroke-foreground/50" strokeWidth={1} strokeDasharray="4 3" />
        <text x={px(0.659) + 4} y={Y0 + 10} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          teacher 0.659
        </text>

        {/* curves */}
        <path d={path(LAYA)} className="fill-none stroke-foreground/35" strokeWidth={1.5} />
        <path d={path(AGENTJEV)} className="fill-none stroke-foreground/80" strokeWidth={1.75} />

        {LAYA.map((b) => (
          <circle key={`l${b.lo}`} cx={px(b.conf)} cy={py(b.acc)} r={2 + b.n / 160} className="fill-foreground/25" />
        ))}
        {AGENTJEV.map((b) => (
          <circle key={`a${b.lo}`} cx={px(b.conf)} cy={py(b.acc)} r={2 + b.n / 160} className="fill-foreground/75" />
        ))}

        {/* legend */}
        <g>
          <line x1={px(1) + 12} y1={Y0 + 20} x2={px(1) + 32} y2={Y0 + 20} className="stroke-foreground/80" strokeWidth={1.75} />
          <text x={px(1) + 36} y={Y0 + 23.5} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
            AgentJev
          </text>
          <text x={px(1) + 12} y={Y0 + 37} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            ECE 0.169
          </text>
          <line x1={px(1) + 12} y1={Y0 + 58} x2={px(1) + 32} y2={Y0 + 58} className="stroke-foreground/35" strokeWidth={1.5} />
          <text x={px(1) + 36} y={Y0 + 61.5} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
            Laya
          </text>
          <text x={px(1) + 12} y={Y0 + 75} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            ECE 0.217
          </text>
          <text x={px(1) + 12} y={Y0 + 104} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            circle area
          </text>
          <text x={px(1) + 12} y={Y0 + 116} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            = bin count
          </text>
        </g>

        <text x={X0} y={H - 6} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          stated confidence →
        </text>
        <text
          x={12}
          y={Y0 + SIZE / 2}
          transform={`rotate(-90 12 ${Y0 + SIZE / 2})`}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          observed accuracy →
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Drawn from typed_decisions/test_calibrated_predictions.json and
        typed_decisions/laya_test_predictions.json — both committed, both on the same 2,000
        rows. Above the diagonal is under-confidence. Neither model is over-confident in any
        populated bin, which is why an ECE of 0.169 here does not mean what an ECE of 0.169
        usually means.
      </figcaption>
    </figure>
  )
}
