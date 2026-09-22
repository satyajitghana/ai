// "One model call per step" is System One Harness's headline. This is that
// claim checked against four other systems that make one decision the same way.
//
// Each row is the model calls behind ONE decision. Three bands:
//   floor        calls the code always makes
//   conditional  calls a documented branch adds (dashed)
//   generative   calls to a model that writes text (outlined)
//
// The claim survives, and the row that shows what it cost is the last column:
// the only harness with a floor of exactly 1 and no generative band is the one
// whose compiler refuses, at load time, any parameter that would need a string.
//
// Server-rendered SVG, zero JS. Only + - * / here.

const ACCENT = "oklch(0.60 0.15 255)"

type Row = {
  name: string
  floor: number
  conditional: number
  generative: number
  detail: string
  // What the bar counts, when it is not "per step". Printed beside the figure
  // so a 1 that means "per search result" is never read as "per step".
  unit?: string
  headline?: boolean
}

const ROWS: Row[] = [
  {
    name: "SystemOneHarness",
    floor: 1,
    conditional: 0,
    generative: 0,
    detail: "action, every parameter of every feasible action, goal check and guards in one request",
    headline: true,
  },
  {
    name: "fastbrowse",
    floor: 1,
    conditional: 2,
    generative: 1,
    detail: "+1 noul batch to shortlist a page over 160 controls, +1 when a choice over 240 goes group → element, +1 LLM only when a field needs text",
  },
  {
    name: "WindTunnel (measured)",
    floor: 1,
    conditional: 0,
    generative: 0.93,
    detail: "Jev picks the tool; Mercury 2.5 writes the arguments on 0.93 calls per step, skipped entirely when the tool takes none",
  },
  {
    name: "djev · diffusion",
    floor: 1,
    conditional: 3,
    generative: 0,
    detail: "one denoise read answers the whole schema; first-read entropy over 0.1 buys three more noise draws",
    unit: "per schema",
  },
  {
    name: "djev · --engine ar",
    floor: 1,
    conditional: 0,
    generative: 0,
    detail: "one restricted next-token read per question, in order, behind a cached prefix — so the floor is per question, not per schema",
    unit: "per question",
  },
  {
    name: "webctl",
    floor: 1,
    conditional: 0,
    generative: 0,
    detail: "not a step loop: one Jev call per search result, 8 in flight, plus one batch for the candidate duplicate pairs",
    unit: "per result",
  },
]

const MAX = 4

export function CallsPerStep() {
  const W = 820
  const labelW = 156
  const barX = labelW + 12
  const barW = 210
  const rowH = 58
  const top = 52
  const H = top + ROWS.length * rowH + 44
  const u = barW / MAX // pixels per call

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        model calls behind one decision
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[740px]"
        role="img"
        aria-label="Six bars showing the model calls behind one decision. System One Harness is a solid bar of exactly one call with nothing conditional and no generative call. fastbrowse has a floor of one decision call, up to two more conditional decision calls on dense pages, and one generative call only when a field needs text. WindTunnel is one decision call plus a measured 0.93 generative calls, because a decision model cannot write the arguments. djev on the diffusion engine is one read for the whole question set, with three more noise draws when the first read's entropy is high. djev's autoregressive engine is one read per question rather than per schema. webctl is one call per search result rather than per step, because it is a pipeline and not a loop."
      >
        {/* axis */}
        {[0, 1, 2, 3, 4].map((n) => (
          <g key={n}>
            <line
              x1={barX + n * u}
              y1={top - 14}
              x2={barX + n * u}
              y2={H - 40}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={n === 1 ? undefined : "2 5"}
              opacity={n === 1 ? 0.9 : 0.6}
            />
            <text
              x={barX + n * u}
              y={top - 20}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              {n}
            </text>
          </g>
        ))}
        <text x={14} y={top - 20} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          calls
        </text>

        {ROWS.map((r, ri) => {
          const y = top + ri * rowH
          const fw = r.floor * u
          const cw = r.conditional * u
          const gw = r.generative * u
          return (
            <g key={r.name}>
              <text
                x={14}
                y={y + 14}
                className={r.headline ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                style={{ fontSize: 11, fontWeight: r.headline ? 600 : 400 }}
              >
                {r.name}
              </text>

              {/* floor */}
              <rect x={barX} y={y + 3} width={fw} height={15} rx={3} fill={ACCENT} opacity={0.95} />
              {/* conditional */}
              {cw > 0 ? (
                <rect
                  x={barX + fw}
                  y={y + 3}
                  width={cw}
                  height={15}
                  rx={3}
                  fill={ACCENT}
                  opacity={0.22}
                  stroke={ACCENT}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}
              {/* generative */}
              {gw > 0 ? (
                <rect
                  x={barX + fw + cw}
                  y={y + 3}
                  width={gw}
                  height={15}
                  rx={3}
                  fill="none"
                  className="stroke-foreground"
                  strokeWidth={1.5}
                />
              ) : null}

              <text
                x={barX + barW + 16}
                y={y + 15}
                className="fill-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {r.generative > 0
                  ? `${r.floor} + ${r.generative} generative`
                  : r.conditional > 0
                    ? `${r.floor}, up to ${r.floor + r.conditional}${r.unit ? ` ${r.unit}` : ""}`
                    : `${r.floor}${r.unit ? ` ${r.unit}` : ""}`}
              </text>

              <text
                x={14}
                y={y + 33}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {r.detail.length > 118 ? r.detail.slice(0, 118) : r.detail}
              </text>
              {r.detail.length > 118 ? (
                <text
                  x={14}
                  y={y + 45}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {r.detail.slice(118)}
                </text>
              ) : null}
            </g>
          )
        })}

        <rect x={14} y={H - 30} width={14} height={9} rx={2} fill={ACCENT} opacity={0.95} />
        <text x={34} y={H - 22} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          decision model, always
        </text>
        <rect
          x={178}
          y={H - 30}
          width={14}
          height={9}
          rx={2}
          fill={ACCENT}
          opacity={0.22}
          stroke={ACCENT}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <text x={198} y={H - 22} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          decision model, conditional
        </text>
        <rect
          x={362}
          y={H - 30}
          width={14}
          height={9}
          rx={2}
          fill="none"
          className="stroke-foreground"
          strokeWidth={1.5}
        />
        <text x={382} y={H - 22} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          generative model
        </text>
        <text x={520} y={H - 22} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          WindTunnel&rsquo;s 0.93 is measured over 147 attempts; the rest are read from the code.
        </text>
      </svg>
    </figure>
  )
}
