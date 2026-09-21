// The trade, plotted. A latency number on its own is not a result — you can buy
// any LAAL you like by emitting earlier and guessing more. The only way to read
// 2.3s is against the quality it was bought at, so both axes of Qwen's own
// FLEURS panel go on one chart: LAAL left-is-better, xCOMET-XXL up-is-better,
// so the corner every system wants is the top left.
//
// The numbers are Qwen's, read off the FLEURS figure in the release post
// (70 directions, 19 languages). Every one of them is a single aggregate over
// all 70 directions; no per-direction breakdown was published.
//
// Server-rendered SVG, zero JS. Linear interpolation only — no Math.* beyond
// toFixed, so nothing here can disagree between Node and the browser.

type Sys = {
  name: string
  laal: number
  comet: number
  mark: "ours" | "prev" | "other"
  /** label placement, so the two systems that share LAAL=2.8 do not collide */
  place: "r" | "l" | "tr" | "br"
}

const SYS: Sys[] = [
  { name: "Qwen3.8-LiveTranslate", laal: 2.3, comet: 85.7, mark: "ours", place: "br" },
  { name: "Qwen3.5-LiveTranslate", laal: 2.8, comet: 83.0, mark: "prev", place: "tr" },
  { name: "Seed LiveInterpret 2.0", laal: 2.8, comet: 79.4, mark: "other", place: "br" },
  { name: "Gemini 3.5 Live translate", laal: 2.5, comet: 73.5, mark: "other", place: "l" },
  { name: "GPT-Realtime-Translate", laal: 3.1, comet: 65.2, mark: "other", place: "l" },
]

export function QualityLatency() {
  const W = 760
  const H = 400
  const padL = 62
  const padR = 26
  const padT = 40
  const padB = 56

  const X0 = 2.15
  const X1 = 3.25
  const Y0 = 62
  const Y1 = 88

  const px = (laal: number) => padL + ((laal - X0) / (X1 - X0)) * (W - padL - padR)
  const py = (c: number) => H - padB - ((c - Y0) / (Y1 - Y0)) * (H - padT - padB)

  const xTicks = [2.2, 2.4, 2.6, 2.8, 3.0, 3.2]
  const yTicks = [65, 70, 75, 80, 85]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        FLEURS · 70 directions · latency against the quality it was bought at
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="A scatter plot of five real-time interpretation systems. The horizontal axis is LAAL in seconds, lower and further left is better; the vertical axis is xCOMET-XXL translation quality out of 100, higher is better, so the best corner is the top left. Qwen3.8-LiveTranslate sits alone in that corner at 2.3 seconds and 85.7. Qwen3.5-LiveTranslate is at 2.8 seconds and 83.0 and Seed LiveInterpret 2.0 at 2.8 seconds and 79.4. Gemini 3.5 Live translate is faster than both of those at 2.5 seconds but scores only 73.5, and GPT-Realtime-Translate is both the slowest at 3.1 seconds and the lowest at 65.2. An arrow marks the move from Qwen3.5 to Qwen3.8: half a second of lag removed and 2.7 quality points added at the same time."
      >
        <text x={padL} y={22} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          xCOMET-XXL ↑
        </text>
        <text
          x={W - padR}
          y={H - 12}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          LAAL, seconds ↓
        </text>
        <text x={padL + 108} y={22} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          top left is better on both axes
        </text>

        {/* grid */}
        {xTicks.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={px(t)}
              y1={padT}
              x2={px(t)}
              y2={H - padB}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="2 5"
            />
            <text
              x={px(t)}
              y={H - padB + 17}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={padL}
              y1={py(t)}
              x2={W - padR}
              y2={py(t)}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray="2 5"
            />
            <text
              x={padL - 8}
              y={py(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {t}
            </text>
          </g>
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={H - padB} className="stroke-border" strokeWidth={1.5} />
        <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} className="stroke-border" strokeWidth={1.5} />

        {/* the generation-over-generation move */}
        <defs>
          <marker id="ql-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
            <path d="M0,-4L6,0L0,4" fill="none" className="stroke-foreground" strokeWidth={1.5} />
          </marker>
        </defs>
        <path
          d={`M ${px(2.78)} ${py(83.2)} C ${px(2.62)} ${py(84.4)}, ${px(2.5)} ${py(85.0)}, ${px(2.35)} ${py(85.5)}`}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1.5}
          markerEnd="url(#ql-arrow)"
        />
        <text
          x={px(2.58)}
          y={py(86.6)}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          −0.5s and +2.7 quality, same eval
        </text>

        {SYS.map((s) => {
          const cx = px(s.laal)
          const cy = py(s.comet)
          const dx = s.place === "l" ? -12 : 12
          const dy = s.place === "tr" ? -10 : s.place === "br" ? 18 : 4
          const anchor = s.place === "l" ? "end" : "start"
          return (
            <g key={s.name}>
              <circle
                cx={cx}
                cy={cy}
                r={s.mark === "ours" ? 7 : 5}
                className={
                  s.mark === "ours"
                    ? "fill-foreground"
                    : s.mark === "prev"
                      ? "fill-foreground/35 stroke-foreground"
                      : "fill-background stroke-muted-foreground"
                }
                strokeWidth={1.5}
              />
              <text
                x={cx + dx}
                y={cy + dy}
                textAnchor={anchor}
                className={s.mark === "other" ? "fill-muted-foreground font-mono" : "fill-foreground font-mono"}
                style={{ fontSize: 11 }}
              >
                {s.name}
              </text>
              <text
                x={cx + dx}
                y={cy + dy + 13}
                textAnchor={anchor}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {`${s.laal.toFixed(1)}s · ${s.comet.toFixed(1)}`}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        both axes read off Qwen&apos;s FLEURS figure · one aggregate per system over all 70 directions
      </div>
    </figure>
  )
}
