// How the two Jev + Mercury setups scale with journey length.
//
// Same model pair, same 49 tasks, same seeded sites, same scorer — one driving
// the page's own controls (Browser Use's Ultrafast, modified), one calling the
// tools the site exposes over WebMCP. Split by WindTunnel's four difficulty
// tiers and plotted on a log axis, because the two curves differ in slope, not
// in offset: on one- and two-step answers the page setup is 2.4x cheaper, and by
// the four checkout-shaped tasks it is 2.0x dearer and solves one of them.
//
// Medians computed over results/2026-09-18-jev-mercury/results.csv, grouped by
// each task's `tier` field in tasks/*.yaml. Solved counts are majority-of-three.
//
// Server-rendered, zero JS. Math.log10 goes through lib/dmath so the SSR and
// client serializations of every coordinate are bit-identical.

import { mlog10 } from "@/lib/dmath"

type Row = {
  tier: string
  steps: string
  tasks: number
  wmSolved: number
  wmCost: number
  wmCalls: number
  domSolved: number
  domCost: number
  domCalls: number
}

const ROWS: Row[] = [
  {
    tier: "answer",
    steps: "1–2",
    tasks: 21,
    wmSolved: 21,
    wmCost: 0.0009451,
    wmCalls: 1,
    domSolved: 13,
    domCost: 0.00039,
    domCalls: 1,
  },
  {
    tier: "action, short",
    steps: "3–5",
    tasks: 16,
    wmSolved: 16,
    wmCost: 0.0011955,
    wmCalls: 2,
    domSolved: 9,
    domCost: 0.0008854,
    domCalls: 3,
  },
  {
    tier: "action, long",
    steps: "6–10",
    tasks: 8,
    wmSolved: 8,
    wmCost: 0.0018127,
    wmCalls: 3,
    domSolved: 2,
    domCost: 0.0029682,
    domCalls: 8,
  },
  {
    tier: "sensitive",
    steps: "8–15",
    tasks: 4,
    wmSolved: 4,
    wmCost: 0.0037901,
    wmCalls: 4,
    domSolved: 1,
    domCost: 0.0076079,
    domCalls: 22,
  },
]

const W = 700
const H = 250
const PAD = { l: 58, r: 14, t: 16, b: 34 }
const LO = mlog10(0.0003)
const HI = mlog10(0.01)

const xAt = (i: number) =>
  PAD.l + ((W - PAD.l - PAD.r) * (i + 0.5)) / ROWS.length
const yAt = (v: number) =>
  PAD.t + ((H - PAD.t - PAD.b) * (HI - mlog10(v))) / (HI - LO)

const TICKS = [0.0005, 0.001, 0.002, 0.005, 0.01]
const tick = (v: number) => (v < 0.001 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`)

export function JourneyCost() {
  const path = (get: (r: Row) => number) =>
    ROWS.map((r, i) => `${i ? "L" : "M"}${xAt(i)} ${yAt(get(r))}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        Jev + Mercury 2.5 · median model cost per attempt by journey length · log
        scale
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Median cost per attempt against journey length for Jev plus Mercury on WebMCP and on DOM page controls. The DOM line starts lower at $0.00039 on one-to-two-step answer tasks and rises to $0.0076 on the longest tasks; the WebMCP line starts at $0.00095 and rises only to $0.0038, crossing the DOM line between the short-action and long-action tiers."
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yAt(t)}
              y2={yAt(t)}
              className="stroke-border"
              strokeWidth="1"
            />
            <text
              x={PAD.l - 6}
              y={yAt(t) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              {tick(t)}
            </text>
          </g>
        ))}

        <path
          d={path((r) => r.domCost)}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <path
          d={path((r) => r.wmCost)}
          fill="none"
          className="stroke-foreground"
          strokeWidth="2"
        />

        {ROWS.map((r, i) => (
          <g key={r.tier}>
            <circle
              cx={xAt(i)}
              cy={yAt(r.domCost)}
              r="3.5"
              className="fill-background stroke-muted-foreground"
              strokeWidth="1.5"
            />
            <circle cx={xAt(i)} cy={yAt(r.wmCost)} r="3.5" className="fill-foreground" />
            <text
              x={xAt(i)}
              y={H - PAD.b + 14}
              textAnchor="middle"
              className="fill-foreground font-mono"
              fontSize="10"
            >
              {r.tier}
            </text>
            <text
              x={xAt(i)}
              y={H - PAD.b + 26}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize="9"
            >
              {r.steps} steps · {r.tasks} tasks
            </text>
          </g>
        ))}

        <text
          x={xAt(0) + 10}
          y={yAt(ROWS[0].wmCost) - 8}
          className="fill-foreground font-mono"
          fontSize="10"
        >
          WebMCP
        </text>
        <text
          x={xAt(0) + 10}
          y={yAt(ROWS[0].domCost) + 14}
          className="fill-muted-foreground font-mono"
          fontSize="10"
        >
          DOM (ultrafast)
        </text>
      </svg>

      <div className="overflow-x-auto border-t">
        <table className="w-full font-mono text-[10px]">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-1 text-left font-normal">tier</th>
              <th className="px-2 py-1 text-right font-normal">tasks</th>
              <th className="px-2 py-1 text-right font-normal">WebMCP solved</th>
              <th className="px-2 py-1 text-right font-normal">tool calls</th>
              <th className="px-2 py-1 text-right font-normal">DOM solved</th>
              <th className="px-3 py-1 text-right font-normal">page actions</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.tier} className="border-b last:border-0">
                <td className="px-3 py-1">{r.tier}</td>
                <td className="px-2 py-1 text-right">{r.tasks}</td>
                <td className="px-2 py-1 text-right">
                  {r.wmSolved}/{r.tasks}
                </td>
                <td className="px-2 py-1 text-right">{r.wmCalls}</td>
                <td className="px-2 py-1 text-right">
                  {r.domSolved}/{r.tasks}
                </td>
                <td className="px-3 py-1 text-right">{r.domCalls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-3 py-2 text-center font-mono text-[11px] leading-5 text-muted-foreground">
        &ldquo;Tool calls&rdquo; and &ldquo;page actions&rdquo; are the same column —
        median <code>actions_or_tool_calls</code> — counted once as tool
        invocations and once as clicks, types and selects. In the last tier the
        page setup performs 22 of them where WebMCP performs 4.
      </figcaption>
    </figure>
  )
}
