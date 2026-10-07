"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { CAP, HOSTS, JOBS, RACK_OF, TASKS, run, utils } from "./toy-solver"

// Rebalancer's local search, re-implemented on a toy (toy-solver.ts) and
// replayed one applied move at a time. Every trace is computed with integer
// arithmetic at render time, so the server and the browser draw the same SVG.

const JOB_FILL = [
  "oklch(0.62 0.15 250)", // A, 4 CPU
  "oklch(0.70 0.14 160)", // B, 3 CPU
  "oklch(0.75 0.13 80)", // C, 2 CPU
  "oklch(0.68 0.13 330)", // D, 1 CPU
]
const BAD = "oklch(0.62 0.2 25)"

const W = 360
const H = 200
const BASE = 168 // y of the floor
const UNIT = 9 // px per CPU unit
const COL = 40 // host column width
const GAP = 14
const X0 = 24

const hostX = (h: number) => X0 + h * (COL + GAP) + Math.floor(h / 2) * 6

export function LocalSearchLab() {
  const [random, setRandom] = useState(false)
  const [swap, setSwap] = useState(false)
  const [k, setK] = useState(0)

  const trace = useMemo(() => run(random, swap), [random, swap])
  const last = trace.length - 1
  const i = Math.min(k, last)
  const s = trace[i]
  const u = utils(s.assign)
  const cumEvals = trace.slice(0, i + 1).reduce((a, t) => a + t.evals, 0)
  const totalEvals = trace.reduce((a, t) => a + t.evals, 0)

  const pick = (r: boolean, sw: boolean) => {
    setRandom(r)
    setSwap(sw)
    setK(0)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>local search, one applied move at a time</span>
        <span className="text-muted-foreground/50">toy re-implementation</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Toggle on={!random} onClick={() => pick(false, swap)}>
            hot host first
          </Toggle>
          <Toggle on={random} onClick={() => pick(true, swap)}>
            random host order
          </Toggle>
          <span className="w-2" />
          <Toggle on={!swap} onClick={() => pick(random, false)}>
            SINGLE
          </Toggle>
          <Toggle on={swap} onClick={() => pick(random, true)}>
            SINGLE then SWAP
          </Toggle>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Six hosts in three racks after ${i} applied moves. CPU per host: ${u.join(", ")} out of ${CAP}.`}
        >
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <rect
                x={hostX(2 * r) - 5}
                y={10}
                width={2 * COL + GAP + 10}
                height={BASE - 2}
                rx={5}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={hostX(2 * r) + COL + GAP / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground font-mono"
                fontSize={9}
              >
                rack {r}
              </text>
            </g>
          ))}
          {/* capacity and mean lines */}
          <line x1={X0 - 8} x2={W - 4} y1={BASE - CAP * UNIT} y2={BASE - CAP * UNIT} stroke={BAD} strokeDasharray="4 3" strokeWidth={1} />
          <text x={W - 4} y={BASE - CAP * UNIT - 3} textAnchor="end" fontSize={8} className="font-mono" fill={BAD}>
            capacity 10
          </text>
          <line x1={X0 - 8} x2={W - 4} y1={BASE - 5 * UNIT} y2={BASE - 5 * UNIT} stroke="var(--muted-foreground)" strokeDasharray="2 3" strokeWidth={1} opacity={0.6} />
          <text x={W - 4} y={BASE - 5 * UNIT - 3} textAnchor="end" fontSize={8} className="fill-muted-foreground font-mono">
            mean 5
          </text>
          {[...Array(HOSTS).keys()].map((h) => {
            let y = BASE
            const here = TASKS.map((t, ti) => ({ t, ti })).filter(({ ti }) => s.assign[ti] === h)
            const moved = s.moved
            const isTried = s.hot.includes(h)
            const isSrc = moved?.from === h
            const isDst = moved?.to === h
            return (
              <g key={h}>
                <rect x={hostX(h)} y={BASE - CAP * UNIT - 22} width={COL} height={CAP * UNIT + 22} rx={3} fill="var(--muted)" opacity={0.35} />
                {here.map(({ t }) => {
                  const hgt = t.cpu * UNIT
                  y -= hgt
                  const hl = moved && (t.id === moved.task || t.id === moved.other)
                  return (
                    <g key={t.id}>
                      <rect
                        x={hostX(h) + 3}
                        y={y + 0.5}
                        width={COL - 6}
                        height={hgt - 1}
                        rx={2}
                        fill={JOB_FILL[t.job]}
                        stroke={hl ? "var(--foreground)" : "none"}
                        strokeWidth={hl ? 1.5 : 0}
                      />
                      {hgt >= 9 && (
                        <text x={hostX(h) + COL / 2} y={y + hgt / 2 + 3} textAnchor="middle" fontSize={8} className="font-mono" fill="white">
                          {t.id}
                        </text>
                      )}
                    </g>
                  )
                })}
                <text
                  x={hostX(h) + COL / 2}
                  y={BASE + 11}
                  textAnchor="middle"
                  fontSize={9}
                  className={cn("font-mono", isSrc || isDst ? "fill-foreground" : "fill-muted-foreground")}
                >
                  h{h}·{u[h]}
                </text>
                {isTried && !isSrc && (
                  <text x={hostX(h) + COL / 2} y={22} textAnchor="middle" fontSize={8} className="fill-muted-foreground font-mono">
                    tried
                  </text>
                )}
                {isSrc && (
                  <text x={hostX(h) + COL / 2} y={22} textAnchor="middle" fontSize={8} className="font-mono" fill={BAD}>
                    hot
                  </text>
                )}
                {u[h] > CAP && (
                  <rect x={hostX(h)} y={BASE - u[h] * UNIT} width={COL} height={(u[h] - CAP) * UNIT} fill="none" stroke={BAD} strokeWidth={1.5} />
                )}
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setK(Math.max(0, i - 1))}
            className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            prev
          </button>
          <Range min={0} max={last} value={i} onChange={(e) => setK(Number(e.target.value))} aria-label="applied move" />
          <button
            type="button"
            onClick={() => setK(Math.min(last, i + 1))}
            className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            next
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell label={`move ${i} of ${last}`} value={s.moved ? `${s.moved.task}${s.moved.other ? `⇄${s.moved.other}` : ""}` : "start"} />
          <Cell label="fix-it goal (tuple 0)" value={String(s.value.fix)} hot={s.value.fix > 0} />
          <Cell label="balance x 60 (tuple 1)" value={String(s.value.balance)} />
          <Cell label="evaluations so far" value={`${cumEvals} / ${totalEvals}`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {i === 0 ? (
            <>
              Start: host 0 holds 14 CPU against a limit of 10, and rack 0 holds all three replicas of
              job A and of job B. Both constraints are broken, so each becomes a fix-it goal of{" "}
              <code>100 × violation + 10000</code> in tuple position 0: capacity is over by 4 and the
              spread rule by 7, which gives <span className="text-foreground">21100</span>.
            </>
          ) : (
            <>
              {s.moved?.kind === "swap" ? "Swap" : "Moved"}{" "}
              <span className="text-foreground">{s.moved?.task}</span>
              {s.moved?.other ? (
                <>
                  {" "}with <span className="text-foreground">{s.moved.other}</span>
                </>
              ) : null}{" "}
              from h{s.moved?.from} to h{s.moved?.to}. Hosts examined, hot first:{" "}
              {s.hot.map((h) => `h${h}`).join(" → ")}
              {s.hot.length > 1 ? " (the earlier ones had no improving move)" : ""}. {s.evals} candidate
              moves evaluated
              {s.deduped > 0 ? `, ${s.deduped} skipped as equivalent to one already tried` : ""}.
              {i === last &&
                (s.value.balance > 0
                  ? " No single move out of any host improves the tuple any more: a local optimum."
                  : " Every host sits at 5: balance is perfect.")}
            </>
          )}
        </p>

        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
          {JOBS.map((j, ji) => (
            <span key={j} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: JOB_FILL[ji] }} />
              job {j} · {TASKS.find((t) => t.job === ji)?.cpu} CPU × 3
            </span>
          ))}
          <span>racks: {RACK_OF.map((r, h) => `h${h}→r${r}`).join(" ")}</span>
        </div>
      </div>
    </figure>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Cell({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="rounded-lg border px-2.5 py-2">
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono text-sm" style={hot ? { color: BAD } : undefined}>
        {value}
      </div>
    </div>
  )
}
