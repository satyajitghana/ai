import { cn } from "@/lib/utils"

// Every decode rate Edge0 publishes for its own two tiers, on one axis each.
//
// Server-rendered, zero JS. There is nothing to interact with: the point is that
// the numbers do not agree, and a static picture of the spread makes that
// argument better than a control would.
//
// Sources, all read at commit 5b65e6f (18 Sept 2026):
//   README.md Benchmark table          — "Measured with examples/bench.py", M4 Pro 24 GB
//   huggingface.co/Edge0/Edge0-35B-A3B-preview — card headline and Performance table
//   arXiv:2609.18063v2 Table 1         — "latest paired measurements", same M4 Pro
//   src/edge0/models/edge0_{35b,8b}/__init__.py — target_tok_s, the pinned acceptance metric
//   20260910-105854.mp4 (HF repo)      — on-screen overlay at 0:12, iPhone 16 Pro 8 GB
//
// Arithmetic is + - * / and Math.round: exact on every engine, so the SSR string
// and the client string are byte-identical and nothing can hydrate mismatched.

type Mark = {
  lo: number
  hi?: number
  label: string
  machine: string
  where: string
  tone: "code" | "readme" | "paper" | "device"
}

type Panel = { tier: string; lo: number; hi: number; marks: Mark[] }

const PANELS: Panel[] = [
  {
    tier: "edge0-35b",
    lo: 12,
    hi: 22,
    marks: [
      { lo: 13.0, label: "13.0", machine: "unstated", where: "target_tok_s (code)", tone: "code" },
      { lo: 14.9, hi: 17.7, label: "14.9–17.7", machine: "Mac mini M4 Pro 24 GB", where: "README + HF card table", tone: "readme" },
      { lo: 15.0, label: "15", machine: "unstated", where: "HF card headline", tone: "readme" },
      { lo: 16.0, label: "~16", machine: "iPhone 16 Pro 8 GB", where: "demo video overlay", tone: "device" },
      { lo: 20.4, label: "20.4", machine: "Mac mini M4 Pro 24 GB", where: "arXiv Table 1", tone: "paper" },
    ],
  },
  {
    tier: "edge0-8b",
    lo: 22,
    hi: 35,
    marks: [
      { lo: 23.9, hi: 25.3, label: "23.9–25.3", machine: "Mac mini M4 Pro 24 GB", where: "README + HF card table", tone: "readme" },
      { lo: 25.0, label: "25.0", machine: "Mac mini M4 Pro 24 GB", where: "options.py docstring", tone: "code" },
      { lo: 28.0, label: "28.0", machine: "Mac mini M4 Pro 24 GB", where: "arXiv Table 1", tone: "paper" },
      { lo: 33.0, label: "33.0", machine: "unstated", where: "target_tok_s (code)", tone: "code" },
    ],
  },
]

const TONE: Record<Mark["tone"], string> = {
  code: "#64748b",
  readme: "#0369a1",
  paper: "#b91c1c",
  device: "#a16207",
}

const W = 560
const H = 92
const padL = 10
const padR = 10
const axisY = 62

const r2 = (n: number) => Math.round(n * 100) / 100

export function DecodeSpread() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          every decode rate Edge0 publishes for its own tiers
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          read 18 Sept 2026, commit 5b65e6f
        </span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        {PANELS.map((p) => {
          const sx = (v: number) =>
            r2(padL + ((v - p.lo) / (p.hi - p.lo)) * (W - padL - padR))
          const ticks: number[] = []
          for (let t = p.lo; t <= p.hi; t += p.hi - p.lo > 12 ? 2 : 1) ticks.push(t)

          return (
            <div key={p.tier}>
              <p className="font-mono text-[11px] text-foreground">{p.tier}</p>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="mt-1 w-full"
                role="img"
                aria-label={`Decode rates published for ${p.tier}: ${p.marks
                  .map((m) => `${m.label} tok/s from ${m.where} on ${m.machine}`)
                  .join("; ")}`}
              >
                <line
                  x1={padL}
                  y1={axisY}
                  x2={W - padR}
                  y2={axisY}
                  stroke="currentColor"
                  strokeOpacity="0.2"
                />
                {ticks.map((t) => (
                  <g key={t}>
                    <line
                      x1={sx(t)}
                      y1={axisY}
                      x2={sx(t)}
                      y2={axisY + 4}
                      stroke="currentColor"
                      strokeOpacity="0.2"
                    />
                    <text
                      x={sx(t)}
                      y={axisY + 14}
                      textAnchor="middle"
                      className="fill-muted-foreground/70 font-mono"
                      fontSize="8.5"
                    >
                      {t}
                    </text>
                  </g>
                ))}
                <text
                  x={W - padR}
                  y={H - 4}
                  textAnchor="end"
                  className="fill-muted-foreground/60 font-mono"
                  fontSize="8.5"
                >
                  decode (tok/s)
                </text>

                {p.marks.map((m, i) => {
                  const y = 14 + (i % 3) * 13
                  const color = TONE[m.tone]
                  const x1 = sx(m.lo)
                  const x2 = m.hi != null ? sx(m.hi) : x1
                  return (
                    <g key={`${m.label}-${m.where}`}>
                      <line
                        x1={x1}
                        y1={y}
                        x2={x1}
                        y2={axisY}
                        stroke={color}
                        strokeOpacity="0.35"
                        strokeDasharray="2 2"
                      />
                      {m.hi != null ? (
                        <>
                          <line
                            x1={x2}
                            y1={y}
                            x2={x2}
                            y2={axisY}
                            stroke={color}
                            strokeOpacity="0.35"
                            strokeDasharray="2 2"
                          />
                          <rect
                            x={x1}
                            y={y - 3}
                            width={r2(x2 - x1)}
                            height={6}
                            fill={color}
                            fillOpacity="0.45"
                          />
                        </>
                      ) : (
                        <circle cx={x1} cy={y} r="3.4" fill={color} />
                      )}
                      <text
                        x={r2(x2 + 6)}
                        y={y + 3}
                        className="fill-foreground font-mono"
                        fontSize="8.5"
                      >
                        {m.label}
                      </text>
                      <text
                        x={r2(x2 + 6)}
                        y={y + 11}
                        className="fill-muted-foreground/70 font-mono"
                        fontSize="7"
                      >
                        {m.where}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(
            [
              ["readme", "README / model card"],
              ["paper", "arXiv:2609.18063v2"],
              ["code", "pinned in the source"],
              ["device", "demo video, on-device"],
            ] as const
          ).map(([tone, label]) => (
            <span key={tone} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: TONE[tone] }}
              />
              {label}
            </span>
          ))}
        </div>

        <p className={cn("text-sm leading-6 text-muted-foreground")}>
          Five figures for the 35B tier spanning{" "}
          <span className="text-foreground">13.0 to 20.4 tok/s</span>, a 57% spread, and two of
          them &mdash; 14.9&ndash;17.7 and 20.4 &mdash; name the{" "}
          <span className="text-foreground">same Mac mini M4 Pro, 24 GB</span>. The 8B tier is the
          same shape: the README and the framework&rsquo;s own docstring agree at ~25 tok/s, the
          paper says 28.0, and the acceptance constant the CLI prints when you run{" "}
          <span className="font-mono text-foreground">edge0 models</span> says 33.0. None of the
          four sources says which of the others it supersedes.
        </p>
      </div>
    </figure>
  )
}
