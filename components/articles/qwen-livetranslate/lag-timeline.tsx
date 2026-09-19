// LAAL, drawn. The whole metric is the vertical gap between two staircases:
// the one the system actually walked (d_i, when target word i was emitted) and
// the one an oracle perfectly in sync with the speaker would have walked
// (d*_i, the source duration spread evenly over max{|Y|, |Y*|} words).
//
// The example is a Japanese verb-final sentence, because that is where the
// quality/latency trade has teeth: the polarity of the clause lives in the last
// morpheme, so a system that emits early has to guess and a system that waits
// pays for it here.
//
// Server-rendered SVG, zero JS. Every coordinate is +, -, * or / on integers
// and one-decimal constants, so there is no transcendental to disagree between
// Node and the browser and nothing needs lib/dmath.
//
// Numbers on screen are ILLUSTRATIVE — a worked example of the formula, not a
// measurement of any system. The measured figures are in the FLEURS panel.

const SRC_DUR = 5.0 // seconds of source audio

// Source words on their real timeline, as a speaker would utter them.
const SRC = [
  { w: "その", t: 0.0 },
  { w: "提案", t: 0.45 },
  { w: "は", t: 1.05 },
  { w: "予算", t: 1.35 },
  { w: "の", t: 1.95 },
  { w: "都合", t: 2.2 },
  { w: "で", t: 2.85 },
  { w: "承認", t: 3.15 },
  { w: "され", t: 3.8 },
  { w: "ませ", t: 4.25 },
  { w: "ん", t: 4.65 },
]

// The emitted translation: nine words, each with the delay d_i at which it left
// the model. Nothing moves until 1.6s, then output tracks input, and the whole
// clause stalls on the final negation.
const EMIT = [
  { w: "That", d: 1.6 },
  { w: "proposal", d: 1.9 },
  { w: "was", d: 4.9 },
  { w: "not", d: 5.0 },
  { w: "approved", d: 5.0 },
  { w: "for", d: 5.0 },
  { w: "budget", d: 5.0 },
  { w: "reasons", d: 5.0 },
]

const REF_LEN = 8 // |Y*| — the reference translation is eight words too

export function LagTimeline() {
  const W = 780
  const H = 372
  const padL = 128
  const padR = 28
  const plotW = W - padL - padR

  // time -> x. SRC_DUR of audio, plus a little headroom past the end.
  const T_MAX = 5.6
  const x = (t: number) => padL + (t / T_MAX) * plotW

  const yAudio = 58 // the source audio strip
  const yPlot0 = 128 // top of the lag plot
  const plotH = 176
  const yPlot1 = yPlot0 + plotH

  // The lag plot's vertical axis is "which target word", 1..n.
  const n = EMIT.length
  const denom = Math.max(n, REF_LEN) // the max{|Y|,|Y*|} of the LAAL definition
  const rowY = (i: number) => yPlot0 + 12 + (i * (plotH - 30)) / denom

  // d*_i = (i-1) * (total source duration / denom)
  const dStar = (i: number) => (i * SRC_DUR) / denom

  const lags = EMIT.map((e, i) => e.d - dStar(i))
  const laal = lags.reduce((a, b) => a + b, 0) / n

  const emitPath = EMIT.map((e, i) => `${i ? "L" : "M"} ${x(e.d)} ${rowY(i)}`).join(" ")
  const oraclePath = EMIT.map((_, i) => `${i ? "L" : "M"} ${x(dStar(i))} ${rowY(i)}`).join(" ")

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        LAAL = mean vertical gap between what was emitted and what an in-sync oracle would emit
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[680px]"
        role="img"
        aria-label="A five-second Japanese source utterance is drawn as word blocks on a time axis. Below it, two staircases climb through the eight words of the English translation. The oracle staircase is a straight diagonal: it emits one word every 0.625 seconds, the source duration divided evenly across eight words. The system's staircase emits its first two words at 1.6 and 1.9 seconds, then stalls: the remaining six words all land at or after 4.9 seconds, because the Japanese negation that decides the whole clause is the final morpheme. The horizontal gap between the two staircases is shaded; the mean of those gaps is the length-adaptive average lagging, 2.1 seconds in this worked example."
      >
        {/* ---------- source audio strip ---------- */}
        <text x={16} y={yAudio - 18} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          SOURCE (ja)
        </text>
        <rect
          x={x(0)}
          y={yAudio - 14}
          width={x(SRC_DUR) - x(0)}
          height={30}
          rx={4}
          className="fill-muted/50 stroke-border"
          strokeWidth={1}
        />
        {SRC.map((s, i) => {
          const end = i + 1 < SRC.length ? SRC[i + 1]!.t : SRC_DUR
          return (
            <g key={`${s.w}-${s.t}`}>
              {i > 0 ? (
                <line
                  x1={x(s.t)}
                  y1={yAudio - 14}
                  x2={x(s.t)}
                  y2={yAudio + 16}
                  className="stroke-border"
                  strokeWidth={1}
                />
              ) : null}
              <text
                x={(x(s.t) + x(end)) / 2}
                y={yAudio + 6}
                textAnchor="middle"
                className="fill-foreground/75 font-mono"
                style={{ fontSize: 10 }}
              >
                {s.w}
              </text>
            </g>
          )
        })}
        {/* the morpheme that decides the clause */}
        <rect
          x={x(4.25)}
          y={yAudio - 14}
          width={x(SRC_DUR) - x(4.25)}
          height={30}
          rx={4}
          className="fill-foreground/10 stroke-foreground/50"
          strokeWidth={1.5}
        />
        <text
          x={x(SRC_DUR) + 6}
          y={yAudio + 6}
          className="fill-foreground/70 font-mono"
          style={{ fontSize: 10 }}
        >
          ← negation
        </text>

        {/* ---------- lag plot ---------- */}
        <text x={16} y={yPlot0 - 14} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          TARGET WORD i
        </text>
        <text x={16} y={yPlot0 + 2} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          emitted at d
        </text>
        <text x={16} y={yPlot0 + 15} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          oracle at d*
        </text>

        {/* time gridlines */}
        {[0, 1, 2, 3, 4, 5].map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              y1={yPlot0}
              x2={x(t)}
              y2={yPlot1}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={t === 5 ? undefined : "2 5"}
            />
            <text
              x={x(t)}
              y={yPlot1 + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}s
            </text>
          </g>
        ))}

        {/* per-word lag bands: oracle position -> actual position */}
        {EMIT.map((e, i) => (
          <rect
            key={`gap-${e.w}`}
            x={x(dStar(i))}
            y={rowY(i) - 7}
            width={x(e.d) - x(dStar(i))}
            height={14}
            rx={2}
            className="fill-foreground/10"
          />
        ))}

        {/* oracle staircase */}
        <path d={oraclePath} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 4" />
        {/* what the system actually did */}
        <path d={emitPath} fill="none" className="stroke-foreground" strokeWidth={2} />

        {EMIT.map((e, i) => (
          <g key={e.w}>
            <circle cx={x(dStar(i))} cy={rowY(i)} r={2.5} className="fill-muted-foreground" />
            <circle cx={x(e.d)} cy={rowY(i)} r={3.5} className="fill-foreground" />
            <text
              x={x(e.d) + 8}
              y={rowY(i) + 4}
              className="fill-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {e.w}
            </text>
            <text
              x={padL - 10}
              y={rowY(i) + 4}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {`i=${i + 1}  ${lags[i]! >= 0 ? "+" : ""}${lags[i]!.toFixed(2)}s`}
            </text>
          </g>
        ))}

        {/* ---------- readout ---------- */}
        <line x1={padL} y1={yPlot1 + 30} x2={W - padR} y2={yPlot1 + 30} className="stroke-border" strokeWidth={1} />
        <text x={padL} y={yPlot1 + 50} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          {`LAAL = mean(d − d*) over ${n} words = ${laal.toFixed(2)}s`}
        </text>
        <text x={padL} y={yPlot1 + 64} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          {`d*_i = (i−1) · ${SRC_DUR.toFixed(1)}s / max{|Y|=${n}, |Y*|=${REF_LEN}} = (i−1) · ${(SRC_DUR / denom).toFixed(3)}s`}
        </text>
      </svg>
      <div className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        illustrative worked example — not a measurement of any system
      </div>
    </figure>
  )
}
