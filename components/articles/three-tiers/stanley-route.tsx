// One request through Stanley's router, drawn from the real source
// (src/cli/router.ts). The point of the picture is the sandwich: deterministic
// code decides what the model is allowed to choose from, the model returns one
// bounded choice with a distribution, and deterministic code decides whether to
// believe it. Three of the four stages are code.
//
// Every constant in the right-hand column is quoted from ROUTING_POLICY and the
// FrameExecutor budget in router.ts. The probability vector is illustrative — it
// is a worked example, not a recorded run.
//
// Server-rendered SVG, zero JS, integer arithmetic only.
const ACCENT = "oklch(0.60 0.15 255)"

const CANDIDATES = [
  { id: "find", ok: true },
  { id: "check", ok: true },
  { id: "review", ok: true },
  { id: "test_gaps", ok: true },
  { id: "summarize", ok: true },
  { id: "security", ok: true },
  { id: "performance", ok: true },
  { id: "compatibility", ok: true },
  { id: "triage_failures", ok: false },
  { id: "triage_comments", ok: false },
]

// illustrative posterior over the eligible set + the router's own fallback label
const DIST: [string, number][] = [
  ["security", 62],
  ["review", 21],
  ["check", 9],
  ["cannot_tell", 5],
  ["others (6)", 3],
]

const STAGES = [
  {
    tier: "CODE",
    title: "deterministic facts",
    body: "diff = present · input = none · safe untracked files counted",
  },
  {
    tier: "CODE",
    title: "availability gate",
    body: "each workflow's own available({diff, input}) — a false value is a hard constraint",
  },
  {
    tier: "MODEL",
    title: "one Jev choice",
    body: "criteria = the eligible ids + cannot_tell · budget: 2 requests, 16k input tokens, 30 s",
  },
  {
    tier: "CODE",
    title: "acceptance policy",
    body: "confidence ≥ 0.60 · p(pick) ≥ 0.55 · margin over runner-up ≥ 0.15",
  },
]

export function StanleyRoute() {
  const W = 820
  const railW = 74
  const x0 = railW + 18
  const boxW = 452
  const stageTop = 92
  const stageH = 62
  const gap = 20
  const H = stageTop + STAGES.length * (stageH + gap) + 128

  const distX = x0 + boxW + 30
  const distW = 250

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        stanley-code · src/cli/router.ts — &quot;Audit these changes for security vulnerabilities&quot;
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A request passes through four stages in Stanley's router. Stage one is deterministic code gathering facts: a diff is present and no input was supplied. Stage two is deterministic code applying each workflow's availability gate, which leaves eight of ten built-in workflows eligible and rules out the two triage workflows as hard constraints. Stage three is a single Jev choice over the eligible ids plus a cannot_tell fallback, returning a probability for each. Stage four is deterministic code applying three fixed thresholds: confidence at least 0.60, probability at least 0.55, and a margin over the runner-up of at least 0.15. Three of the four stages are code; only one is the model."
      >
        <defs>
          <filter id="sr-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
          <marker id="sr-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
            <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
          </marker>
        </defs>

        <text x={16} y={30} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          TIER
        </text>
        <text x={x0} y={30} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          STAGE
        </text>
        <text x={distX} y={30} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          WHAT COMES BACK
        </text>

        {/* the request */}
        <rect
          x={x0}
          y={44}
          width={boxW}
          height={32}
          rx={6}
          className="fill-muted/40 stroke-border"
          strokeWidth={1}
        />
        <text x={x0 + 14} y={64} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          natural-language request — no subcommand, no flags
        </text>

        {STAGES.map((s, i) => {
          const y = stageTop + i * (stageH + gap)
          const isModel = s.tier === "MODEL"
          return (
            <g key={s.title}>
              {/* tier rail chip */}
              <rect
                x={16}
                y={y + 16}
                width={railW - 6}
                height={22}
                rx={5}
                fill={isModel ? ACCENT : "var(--muted)"}
                opacity={isModel ? 1 : 0.7}
              />
              <text
                x={16 + (railW - 6) / 2}
                y={y + 31}
                textAnchor="middle"
                className="font-mono"
                fill={isModel ? "white" : "var(--muted-foreground)"}
                style={{ fontSize: 9.5 }}
              >
                {s.tier}
              </text>

              <rect
                x={x0}
                y={y}
                width={boxW}
                height={stageH}
                rx={8}
                className="fill-background"
                stroke={isModel ? ACCENT : "var(--border)"}
                strokeWidth={isModel ? 2 : 1.5}
                filter="url(#sr-soft)"
              />
              <text x={x0 + 14} y={y + 24} className="fill-foreground font-mono" style={{ fontSize: 11.5 }}>
                {s.title}
              </text>
              <text
                x={x0 + 14}
                y={y + 43}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {s.body}
              </text>

              {i < STAGES.length - 1 && (
                <line
                  x1={x0 + boxW / 2}
                  y1={y + stageH}
                  x2={x0 + boxW / 2}
                  y2={y + stageH + gap - 3}
                  className="stroke-muted-foreground"
                  strokeWidth={1.5}
                  markerEnd="url(#sr-arrow)"
                />
              )}
            </g>
          )
        })}

        {/* stage 2 readout: the eligible set */}
        <g>
          {CANDIDATES.map((c, i) => {
            const col = i % 2
            const row = (i - col) / 2
            const cx = distX + col * 124
            const cy = stageTop + (stageH + gap) + 2 + row * 13
            return (
              <text
                key={c.id}
                x={cx}
                y={cy}
                className={c.ok ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                style={{ fontSize: 9, textDecoration: c.ok ? "none" : "line-through" }}
              >
                {c.ok ? "· " : "× "}
                {c.id}
              </text>
            )
          })}
        </g>

        {/* stage 3 readout: the distribution */}
        <g>
          {DIST.map((d, i) => {
            const y = stageTop + 2 * (stageH + gap) + 4 + i * 14
            const bw = (distW - 96) * d[1] / 100
            const lead = i === 0
            return (
              <g key={d[0]}>
                <text
                  x={distX}
                  y={y + 8}
                  className={lead ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  style={{ fontSize: 9 }}
                >
                  {d[0]}
                </text>
                <rect
                  x={distX + 86}
                  y={y}
                  width={bw}
                  height={9}
                  rx={2}
                  fill={lead ? ACCENT : "var(--muted-foreground)"}
                  opacity={lead ? 0.9 : 0.35}
                />
                <text
                  x={distX + 86 + bw + 5}
                  y={y + 8}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 8.5 }}
                >
                  .{d[1] < 10 ? `0${d[1]}` : d[1]}
                </text>
              </g>
            )
          })}
          <text
            x={distX}
            y={stageTop + 2 * (stageH + gap) + 4 + DIST.length * 14 + 10}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 8.5 }}
          >
            illustrative vector — thresholds are real
          </text>
        </g>

        {/* stage 4 readout: the three tests */}
        <g>
          {[
            ["confidence", "0.71 ≥ 0.60", true],
            ["p(security)", "0.62 ≥ 0.55", true],
            ["margin", "0.62 − 0.21 = 0.41 ≥ 0.15", true],
          ].map((t, i) => {
            const y = stageTop + 3 * (stageH + gap) + 6 + i * 15
            return (
              <g key={t[0] as string}>
                <text x={distX} y={y + 8} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                  {t[0] as string}
                </text>
                <text x={distX + 72} y={y + 8} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                  {t[1] as string}
                </text>
              </g>
            )
          })}
        </g>

        {/* outcome */}
        <g>
          <rect
            x={x0}
            y={H - 68}
            width={boxW}
            height={40}
            rx={8}
            className="fill-background"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text x={x0 + 14} y={H - 42} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
            run `security` — or, on any failed test, cannot_tell and a clarification
          </text>
          <text x={distX} y={H - 46} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            the model never runs a workflow;
          </text>
          <text x={distX} y={H - 34} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
            it only narrows what code may run.
          </text>
        </g>
      </svg>
    </figure>
  )
}
