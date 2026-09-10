import { mlog10 } from "@/lib/dmath"

// Every point pairs a Desert Ant model against the one named competitor its
// own materials compare it to, on the one metric that comparison actually
// published. Two axes, both ratios so different metrics (accuracy, WER,
// recall, precision) can share one chart:
//
//   x = log10(competitor size / Desert Ant size)   -- how much smaller, log scale
//   y = (Desert Ant metric / competitor metric) x 100   -- 100% = parity
//
// Sources, all first-party:
// - tongue vs lingua: FLORES-200, sentences truncated to 3 words, accuracy
//   over the 20 languages both detectors share (desert-ant-labs/tongue README).
// - voz vs Whisper large-v3-turbo: Open ASR Leaderboard, 6-set average WER,
//   read as (100 - WER) so higher is still better (desert-ant-labs/voz README).
// - redact vs GLiNER-PII: recall and precision are two separate points at the
//   same x, because redact loses on one and wins on the other
//   (desert-ant-labs/redact README, "How it compares").
//
// Four more models ship a speed number but no competing quality metric at
// all -- Clear ("we have not published an audio-quality score against the
// cloud tools", per its own model page), Clips ("no quality or latency
// figures... the evaluation has not completed independent review", per its
// SDK docs), Emo, and Title. They cannot be plotted honestly, so they are
// listed under the chart instead of omitted silently.

type Point = {
  model: string
  competitor: string
  sizeRatio: number // competitor MB / desert-ant MB
  qualityRatio: number // desert-ant metric / competitor metric, x100
  metric: string
}

const POINTS: Point[] = [
  { model: "tongue", competitor: "lingua", sizeRatio: 293 / 2.01, qualityRatio: (0.933 / 0.887) * 100, metric: "3-word accuracy, FLORES-200" },
  { model: "voz", competitor: "Whisper large-v3-turbo", sizeRatio: 1600 / 467, qualityRatio: ((100 - 7.4) / (100 - 7.0)) * 100, metric: "100 − WER, Open ASR Leaderboard" },
  { model: "redact", competitor: "GLiNER-PII", sizeRatio: 2300 / 11.6, qualityRatio: (88.8 / 91.1) * 100, metric: "recall" },
  { model: "redact", competitor: "GLiNER-PII", sizeRatio: 2300 / 11.6, qualityRatio: (99.6 / 90.4) * 100, metric: "precision" },
]

const UNMEASURED = [
  { model: "clear", note: "302-345x realtime claims; no PESQ/STOI/DNSMOS or any quality score vs. Dolby, by the model page's own admission" },
  { model: "clips", note: "“same quality” as Claude Sonnet is asserted; the SDK docs say this checkpoint has no quality figures published" },
  { model: "emo", note: "812-emoji top-1 classifier; no accuracy number against any competitor is published" },
  { model: "title", note: "card status is “internal testing”; “this card carries no quality figures”, verbatim" },
]

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const ACCENT = "oklch(0.60 0.15 255)"

export function SizeQualityScatter() {
  const W = 640
  const H = 300
  const padL = 46
  const padR = 20
  const padT = 16
  const padB = 34

  const xMax = 2.6 // log10(400) ~ covers up to ~400x
  const yMin = 90
  const yMax = 114

  const sx = (sizeRatio: number) => {
    const lx = mlog10(sizeRatio)
    return padL + (lx / xMax) * (W - padL - padR)
  }
  const sy = (qualityRatio: number) =>
    H - padB - ((qualityRatio - yMin) / (yMax - yMin)) * (H - padT - padB)

  const xTicks = [1, 2, 5, 10, 20, 50, 100, 200]
  const yTicks = [90, 95, 100, 105, 110]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          size advantage vs. quality ratio, each model against its own named competitor
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">100% = parity</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full" aria-label="Scatter plot of size advantage (log scale, x) against quality ratio relative to the named competitor (y), for tongue, voz, and redact (recall and precision).">
            {/* parity line */}
            <line x1={padL} x2={W - padR} y1={sy(100)} y2={sy(100)} stroke="var(--border)" strokeWidth={1} strokeDasharray="3,3" />
            <text x={W - padR} y={sy(100) - 4} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
              parity
            </text>

            {/* axes */}
            <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--border)" strokeWidth={1} />
            <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--border)" strokeWidth={1} />

            {xTicks.map((t) => (
              <g key={t}>
                <line x1={sx(t)} x2={sx(t)} y1={H - padB} y2={H - padB + 4} stroke="var(--border)" strokeWidth={1} />
                <text x={sx(t)} y={H - padB + 15} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
                  {t}x
                </text>
              </g>
            ))}
            <text x={(padL + W - padR) / 2} y={H - 2} textAnchor="middle" fontSize={9.5} fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
              smaller than the named competitor (log scale) &rarr;
            </text>

            {yTicks.map((t) => (
              <g key={t}>
                <line x1={padL - 4} x2={padL} y1={sy(t)} y2={sy(t)} stroke="var(--border)" strokeWidth={1} />
                <text x={padL - 7} y={sy(t) + 3} textAnchor="end" fontSize={9} fill="var(--muted-foreground)" fontFamily="ui-monospace, monospace">
                  {t}%
                </text>
              </g>
            ))}

            {POINTS.map((p, i) => {
              const x = sx(p.sizeRatio)
              const y = sy(p.qualityRatio)
              const win = p.qualityRatio >= 100
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={5.5} fill={win ? GOOD : BAD} fillOpacity={0.85} />
                  <text x={x} y={y - 10} textAnchor="middle" fontSize={9.5} fill="var(--foreground)" fontFamily="ui-monospace, monospace">
                    {p.model}
                    {p.metric === "precision" || p.metric === "recall" ? ` (${p.metric})` : ""}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span style={{ color: ACCENT }}>tongue</span> and <span style={{ color: ACCENT }}>redact</span>&rsquo;s
          precision sit above the parity line at roughly 100-200x smaller than what they are
          measured against; <span style={{ color: ACCENT }}>voz</span> and{" "}
          <span style={{ color: ACCENT }}>redact</span>&rsquo;s recall sit a few points under it. Nothing
          on this chart is a rout in either direction &mdash; the real pattern across the family is a
          large size ratio next to a small, real quality difference, not a small model matching a big
          one on every axis at once.
        </p>

        <div className="mt-4 border-t pt-3">
          <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">
            not plotted &mdash; no head-to-head quality metric published
          </div>
          <ul className="mt-1.5 space-y-1">
            {UNMEASURED.map((u) => (
              <li key={u.model} className="text-xs leading-5 text-muted-foreground">
                <span className="font-mono text-foreground">{u.model}</span> &mdash; {u.note}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
