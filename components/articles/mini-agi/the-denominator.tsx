// A forgetting metric in nats needs a denominator, and mini-AGI's README prints
// the numerator and the ratio but not the denominator.
//
// The README's table gives, for each arm of the massed-read probe, a change in
// held-out loss on the seven unread subjects AND a "retained vs chance" percent.
// Two of those pin the third quantity exactly, because
//
//     retained = (chance - L0 - delta) / (chance - L0)
//     =>  chance - L0 = delta / (1 - retained)
//
// So each row implies its own denominator, and if the three rows came off one
// probe from one checkpoint they have to agree. The two large arms agree to
// 0.008 nats. Against ln(256) = 5.5452 - the uniform-byte baseline for a model
// whose alphabet is the 256 byte values - that puts the probe's starting
// held-out loss at about 1.02 nats/char, which the committed sample log reaches
// somewhere between 140M and 200M characters read: the same stretch of the run
// where the pool held the 136 experts the probe's own right-hand panel names.
//
// The right panel is the part that matters more. The repo states its own
// instrument resolution - about 0.03 nats for a real difference - and the
// winning arm's forgetting is 0.0067.
//
// Zero JS, server-rendered. Every coordinate is +, -, * and / on exact doubles.

type Arm = {
  name: string
  detail: string
  delta: number
  retained: number | null
  accent?: boolean
}

// Read straight off the README's mitigations table.
const ARMS: Arm[] = [
  { name: "working set frozen", detail: "trunk LR = expert LR", delta: 2.5871, retained: 0.4288 },
  { name: "swapping normally", detail: "trunk LR = expert LR", delta: 2.23, retained: 0.5068 },
  { name: "swapping, trunk at 0.1×", detail: "what the run uses", delta: 0.0067, retained: 0.9984, accent: true },
  { name: "control", detail: "all seven subjects read", delta: -0.0077, retained: null },
]

// The repo's own stated resolution, from its benchmarks section.
const RUN_TO_RUN = 0.014 // same config twice
const THRESHOLD = 0.03 // "treat about 0.03 as the threshold for a real difference"
const STDERR = 0.0331 // published standard error on the headline held-out loss

const NOISE = [
  { label: "published standard error", value: STDERR },
  { label: "the repo's own threshold", value: THRESHOLD },
  { label: "run-to-run, same config", value: RUN_TO_RUN },
  { label: "control arm, |−0.0077|", value: 0.0077 },
  { label: "the forgetting claimed", value: 0.0067, accent: true },
]

export function TheDenominator() {
  const W = 840
  const H = 300
  const midX = 430

  // ---- left panel: each arm's implied denominator -------------------------
  const L = 16
  const barL = 214
  const barR = 404
  const DEN_MAX = 5
  const rowTop = 70
  const rowH = 44
  const dx = (v: number) => barL + (v / DEN_MAX) * (barR - barL)

  // ---- right panel: the small numbers against the noise floor -------------
  const RL = midX + 186
  const RR = 824
  const N_MAX = 0.035
  const nRowTop = 70
  const nRowH = 40
  const nx = (v: number) => RL + (v / N_MAX) * (RR - RL)

  const fmtDen = (a: Arm) => (a.retained === null ? "—" : (a.delta / (1 - a.retained)).toFixed(4))

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the missing denominator, recovered · and the number it is asked to resolve
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="Two panels. The left recovers the denominator behind mini-AGI's retained-versus-chance percentages: the frozen arm implies 4.5292 nats, the swapping arm 4.5215, and the winning arm 4.1875, with the first two agreeing to eight thousandths of a nat and the third off only because its numerator is rounded. The right panel puts the winning arm's claimed forgetting, 0.0067 nats, against the repository's own stated resolution: a published standard error of 0.0331, a stated threshold of 0.03 for a real difference, run-to-run variance of 0.014 on the same configuration, and a control arm whose own drift is minus 0.0077. The claimed forgetting is the shortest bar on the chart."
      >
        {/* ---------------- left panel ---------------- */}
        <text x={L} y={22} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          δ ÷ (1 − retained) = chance − L₀
        </text>
        <text x={L} y={36} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          each row solves for the denominator the README did not print
        </text>

        {[0, 1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line x1={dx(t)} y1={54} x2={dx(t)} y2={rowTop + ARMS.length * rowH - 6} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={dx(t)} y={50} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}
            </text>
          </g>
        ))}

        {/* ln(256), the uniform-byte ceiling this all sits under */}
        <line x1={dx(5.5452)} y1={54} x2={dx(5.5452)} y2={rowTop + ARMS.length * rowH - 6} className="stroke-foreground/55" strokeWidth={1.5} strokeDasharray="4 3" />

        {ARMS.map((a, i) => {
          const y = rowTop + i * rowH
          const den = a.retained === null ? null : a.delta / (1 - a.retained)
          return (
            <g key={a.name}>
              <text x={L} y={y + 10} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
                {a.name}
              </text>
              <text x={L} y={y + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {a.detail} · δ {a.delta > 0 ? "+" : ""}
                {a.delta.toFixed(4)}
                {a.retained === null ? "" : ` · ${(a.retained * 100).toFixed(2)}%`}
              </text>
              {den === null ? (
                <text x={barL} y={y + 16} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                  no percentage published
                </text>
              ) : (
                <>
                  <rect
                    x={dx(0)}
                    y={y + 4}
                    width={Math.max(2, dx(den) - dx(0))}
                    height={14}
                    className={a.accent ? "fill-muted-foreground/45" : "fill-foreground/80"}
                  />
                  <text x={dx(den) + 6} y={y + 15} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                    {fmtDen(a)}
                  </text>
                </>
              )}
            </g>
          )
        })}

        <text x={dx(5.5452) + 4} y={rowTop + ARMS.length * rowH + 8} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          ln 256 = 5.5452
        </text>
        <text x={L} y={rowTop + ARMS.length * rowH + 24} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the two large arms agree to 0.0077 nats ⇒ L₀ ≈ 1.02 nats/char
        </text>
        <text x={L} y={rowTop + ARMS.length * rowH + 36} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the third is off only because 0.0067 is rounded: 99.84% of 4.5215 needs δ = 0.0072
        </text>

        <line x1={midX} y1={16} x2={midX} y2={H - 16} className="stroke-border" strokeWidth={1} />

        {/* ---------------- right panel ---------------- */}
        <text x={midX + 16} y={22} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          and what the instrument can resolve
        </text>
        <text x={midX + 16} y={36} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          nats/char · every figure is the repository&apos;s own
        </text>

        {[0, 0.01, 0.02, 0.03].map((t) => (
          <g key={t}>
            <line x1={nx(t)} y1={54} x2={nx(t)} y2={nRowTop + NOISE.length * nRowH - 14} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={nx(t)} y={50} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t === 0 ? "0" : t.toFixed(2)}
            </text>
          </g>
        ))}

        {NOISE.map((n, i) => {
          const y = nRowTop + i * nRowH
          return (
            <g key={n.label}>
              <text x={midX + 16} y={y + 9} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                {n.label}
              </text>
              <rect
                x={nx(0)}
                y={y + 1}
                width={Math.max(2, nx(n.value) - nx(0))}
                height={12}
                className={n.accent ? "fill-destructive" : "fill-foreground/70"}
              />
              <text x={midX + 16} y={y + 21} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {n.value.toFixed(4)}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
