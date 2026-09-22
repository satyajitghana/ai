// The strongest result in the Machina post, and the one nobody will quote.
//
// If a "contextual policy" just learned a constant offset that happens to help,
// feeding it the wrong observation would cost nothing. Rei Labs ran that test.
// Three independently trained AIM policies, each on the same 256 target
// configurations, under three conditions:
//
//   matching observation   the case's own context     667 / 768 hits
//   fixed acquired seq.    no contextual correction    85 / 768
//   shuffled observation   another case's context      62 / 768
//
// The shuffled arm is WORSE than no correction at all, which is the result. A
// constant offset cannot do that. A function of the observation can, and does
// when you lie to it.
//
// The seed spread is the honest counterweight and the chart shows it: 255, 214
// and 198 of 256 under matching observations, with per-seed mean miss distances
// of 4.39, 12.09 and 14.58 cm. Same protocol, same budget shape, three answers.
//
// Figures: reilabs.org/blog/adapt-1-machina, 21 September 2026, "AIM frozen
// observation interventions" and "Matching-observation miss distance by training
// seed". Zero JS.

type Arm = {
  label: string
  detail: string
  seeds: [number, number, number]
  accent?: boolean
}

const N = 256

const ARMS: Arm[] = [
  { label: "matching observation", detail: "the case's own context", seeds: [255, 214, 198], accent: true },
  { label: "fixed acquired sequence", detail: "no contextual correction at all", seeds: [34, 35, 16] },
  { label: "shuffled observation", detail: "another case's context", seeds: [21, 18, 23] },
]

const MISS = [
  { seed: 0, mean: 4.39, median: 3.4 },
  { seed: 1, mean: 12.09, median: 7.51 },
  { seed: 2, mean: 14.58, median: 9.91 },
]

const SEED_MARK = ["●", "▲", "■"]

export function ObservationAblation() {
  const W = 840
  const midX = 512
  const L = 186
  const R = 470
  const top = 84
  const rowH = 62
  const H = top + ARMS.length * rowH + 72
  const x = (hits: number) => L + (hits / N) * (R - L)

  // right panel
  const RL = midX + 152
  const RR = 816
  const MISS_MAX = 16
  const mx = (cm: number) => RL + (cm / MISS_MAX) * (RR - RL)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        AIM frozen interventions · three independently trained policies, the same 256 target configurations each
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[800px]"
        role="img"
        aria-label="Left panel: three conditions for a sentry-aiming policy, each evaluated on 256 target configurations by three independently trained policies. With the case's own observation the policies hit 255, 214 and 198 of 256, a pooled 86.8 percent. With the acquired fixed sequence and no correction they hit 34, 35 and 16, a pooled 11.1 percent. With another case's observation shuffled in they hit 21, 18 and 23, a pooled 8.1 percent — worse than no correction. Right panel: mean miss distance under matching observations by training seed, 4.39, 12.09 and 14.58 centimetres, against a 22 centimetre target radius."
      >
        <text x={16} y={24} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          lying to the policy is worse than muting it
        </text>
        <text x={16} y={38} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          which is what rules out &quot;the correction is a constant offset that happens to help&quot;
        </text>

        {[0, 64, 128, 192, 256].map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 12} x2={x(t)} y2={top + ARMS.length * rowH - 22} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={x(t)} y={top - 18} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}
            </text>
          </g>
        ))}
        <text x={R} y={top - 30} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          hits / 256
        </text>

        {ARMS.map((a, i) => {
          const y = top + i * rowH
          const pooled = a.seeds[0] + a.seeds[1] + a.seeds[2]
          return (
            <g key={a.label}>
              <text x={L - 12} y={y + 8} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {a.label}
              </text>
              <text x={L - 12} y={y + 19} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                {a.detail}
              </text>
              <text x={L - 12} y={y + 32} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                pooled {pooled}/768 · {((100 * pooled) / 768).toFixed(1)}%
              </text>

              {a.seeds.map((h, si) => (
                <g key={si}>
                  <line x1={x(0)} y1={y + 2 + si * 12} x2={x(h)} y2={y + 2 + si * 12} className="stroke-border" strokeWidth={1} />
                  <rect
                    x={x(h) - 3}
                    y={y - 2 + si * 12}
                    width={6}
                    height={8}
                    className={a.accent ? "fill-foreground" : "fill-muted-foreground"}
                  />
                  <text x={x(h) + 8} y={y + 5 + si * 12} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                    {SEED_MARK[si]} {h}
                  </text>
                </g>
              ))}
            </g>
          )
        })}

        <line x1={midX} y1={16} x2={midX} y2={H - 16} className="stroke-border" strokeWidth={1} />

        <text x={midX + 16} y={24} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          and the spread between seeds
        </text>
        <text x={midX + 16} y={38} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          mean miss under matching observations · target radius 22 cm
        </text>

        {[0, 4, 8, 12, 16].map((t) => (
          <g key={t}>
            <line x1={mx(t)} y1={top - 12} x2={mx(t)} y2={top + 3 * 34 - 8} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={mx(t)} y={top - 18} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}
            </text>
          </g>
        ))}
        <text x={mx(16) + 6} y={top - 18} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          cm
        </text>

        {MISS.map((m, i) => {
          const y = top + i * 34
          return (
            <g key={m.seed}>
              <text x={midX + 16} y={y + 10} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                {SEED_MARK[i]} seed {m.seed}
              </text>
              <rect x={mx(0)} y={y + 1} width={Math.max(2, mx(m.mean) - mx(0))} height={11} className="fill-foreground/70" />
              <text x={mx(m.mean) + 6} y={y + 10} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                {m.mean.toFixed(2)}
              </text>
              <text x={midX + 16} y={y + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                median {m.median.toFixed(2)} cm · {ARMS[0].seeds[i]}/256 hits
              </text>
            </g>
          )
        })}

        <text x={midX + 16} y={H - 34} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          three seeds, one protocol, a 3.3× spread in mean miss
        </text>
        <text x={midX + 16} y={H - 20} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          YAM is one seed; its run-to-run spread is unmeasured
        </text>
      </svg>
    </figure>
  )
}
