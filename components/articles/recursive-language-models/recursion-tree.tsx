"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// One rlm(...) call admits a child session and returns immediately — it does not
// wait for or return the child's answer (prime-agent-runtime/src/rlm/__init__.py,
// packages/coding-agent/docs/rlm-runtime.md). Depth is enforced in code, not just
// documented: AgentSession.runRlmChild checks `this._rlmDepth >= this._rlmMaxDepth`
// before it ever opens a comm to the host, and RLM_MAX_DEPTH defaults to 1 — a root
// session may spawn children, but a child may not spawn a grandchild unless the
// depth budget is explicitly raised. That default is the real mitigation for the
// cost this diagram is about: fan-out is `fanout^depth`, so an uncapped recursive
// call tree grows exponentially in session count, not linearly like a for loop.

const ACCENT = "oklch(0.60 0.15 255)"
const BLOCKED = "var(--destructive)"

const W = 760
const H = 320
const ROW0_Y = 26
const ROW1_Y = 132
const ROW2_Y = 246
// Half the widest node is 52px (the row-1 boxes), so the margin has to clear that
// or the outermost children get clipped at the viewBox edge.
const MARGIN_X = 58

function rowX(n: number): number[] {
  if (n <= 1) return [W / 2]
  const usable = W - MARGIN_X * 2
  return Array.from({ length: n }, (_, i) => MARGIN_X + (usable * i) / (n - 1))
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function RecursionTree() {
  const [depth, setDepth] = useState(2)
  const [fanout, setFanout] = useState(3)
  const [capped, setCapped] = useState(true)

  const realMaxDepth = 1
  const effectiveMaxDepth = capped ? realMaxDepth : depth
  const row1Count = depth >= 1 ? fanout : 0
  const row2Requested = depth >= 2
  const row2Blocked = row2Requested && depth > effectiveMaxDepth
  const row2Count = row2Requested && !row2Blocked ? fanout * fanout : 0

  const row1X = rowX(Math.max(row1Count, 1))
  const row2X = rowX(Math.max(fanout * fanout, 1))

  const sessions = 1 + row1Count + row2Count
  const calls = row1Count + row2Count
  const blockedCalls = row2Blocked ? fanout : 0
  const leafCoverage = row2Count > 0 ? row2Count : row1Count > 0 ? row1Count : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>recursion tree · rlm(...) as an ordinary function call</span>
        <span className="text-muted-foreground/50">from prime-agent-runtime</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A root RLM session at depth 0 spawns ${row1Count} children at depth 1${
            row2Requested
              ? row2Blocked
                ? `; a further ${fanout * fanout} grandchildren at depth 2 are requested but blocked by the recursion depth limit`
                : ` and ${row2Count} grandchildren at depth 2`
              : ""
          }.`}
        >
          <defs>
            <marker id="rlm-tree-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="rlm-tree-arrow-blocked" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={BLOCKED} strokeWidth={1.5} />
            </marker>
            <filter id="rlm-tree-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* root -> row1 connectors */}
          {row1X.map((x, i) => (
            <path
              key={`c0-${i}`}
              d={curve(W / 2, ROW0_Y + 40, x, ROW1_Y)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
              markerEnd="url(#rlm-tree-arrow)"
              opacity={row1Count > 0 ? 0.85 : 0}
            />
          ))}

          {/* row1 -> row2 connectors */}
          {row2Requested &&
            row2X.map((x, i) => {
              const parent = Math.floor(i / fanout)
              const px = row1X[Math.min(parent, row1X.length - 1)] ?? W / 2
              return (
                <path
                  key={`c1-${i}`}
                  d={curve(px, ROW1_Y + 40, x, ROW2_Y)}
                  fill="none"
                  stroke={row2Blocked ? BLOCKED : ACCENT}
                  strokeWidth={1.2}
                  strokeDasharray={row2Blocked ? "3 4" : undefined}
                  markerEnd={row2Blocked ? "url(#rlm-tree-arrow-blocked)" : "url(#rlm-tree-arrow)"}
                  opacity={row2Blocked ? 0.5 : 0.55}
                />
              )
            })}

          {/* root node */}
          <rect x={W / 2 - 90} y={ROW0_Y} width={180} height={40} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#rlm-tree-soft)" />
          <text x={W / 2} y={ROW0_Y + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            root session
          </text>
          <text x={W / 2} y={ROW0_Y + 31} textAnchor="middle" className="font-mono" fontSize={9} fill={ACCENT}>
            RLM_DEPTH=0
          </text>

          {/* row1 nodes */}
          {row1X.map((x, i) => (
            <g key={`n1-${i}`}>
              <rect x={x - 52} y={ROW1_Y} width={104} height={36} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} opacity={0.95} filter="url(#rlm-tree-soft)" />
              <text x={x} y={ROW1_Y + 15} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
                child {i + 1}
              </text>
              <text x={x} y={ROW1_Y + 28} textAnchor="middle" className="font-mono" fontSize={8} fill={ACCENT}>
                RLM_DEPTH=1
              </text>
            </g>
          ))}

          {/* row2 nodes */}
          {row2Requested &&
            row2X.map((x, i) => (
              <circle
                key={`n2-${i}`}
                cx={x}
                cy={ROW2_Y + 10}
                r={9}
                fill={row2Blocked ? "var(--muted)" : "var(--background)"}
                stroke={row2Blocked ? BLOCKED : ACCENT}
                strokeWidth={1.3}
                strokeDasharray={row2Blocked ? "2 3" : undefined}
                opacity={row2Blocked ? 0.6 : 1}
              />
            ))}

          {row2Requested && (
            <text x={W / 2} y={ROW2_Y + 44} textAnchor="middle" className="font-mono" fontSize={9} fill={row2Blocked ? BLOCKED : "var(--muted-foreground)"}>
              {row2Blocked
                ? `${fanout * fanout} grandchildren requested at RLM_DEPTH=2 — blocked`
                : `${row2Count} grandchildren · RLM_DEPTH=2`}
            </text>
          )}
        </svg>

        {row2Blocked && (
          <div className="mt-1 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 font-mono text-[11px] text-destructive">
            RLM recursion depth limit reached (RLM_DEPTH=1, RLM_MAX_DEPTH=1)
          </div>
        )}

        {/* controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="w-24 shrink-0">depth {depth}</span>
            <Range min={0} max={2} step={1} value={depth} onChange={(e) => setDepth(Number(e.target.value))} accent={ACCENT} className="flex-1" />
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="w-24 shrink-0">fanout {fanout}</span>
            <Range min={1} max={4} step={1} value={fanout} onChange={(e) => setFanout(Number(e.target.value))} accent={ACCENT} className="flex-1" />
          </label>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">RLM_MAX_DEPTH</span>
          {(["capped", "raised"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCapped(mode === "capped")}
              aria-pressed={capped === (mode === "capped")}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                capped === (mode === "capped") ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={capped === (mode === "capped") ? { background: ACCENT } : undefined}
            >
              {mode === "capped" ? "1 (default)" : `${depth}`}
            </button>
          ))}
        </div>

        {/* readouts */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "sessions", value: `${sessions}` },
            { label: "rlm() calls", value: `${calls}${blockedCalls ? ` (${blockedCalls} rejected)` : ""}` },
            { label: "own context, per node", value: "1 task" },
            { label: "job coverage", value: `${leafCoverage} leaves` },
          ].map((r) => (
            <div key={r.label} className="rounded-md border px-2.5 py-1.5">
              <div className="font-mono text-[9px] text-muted-foreground">{r.label}</div>
              <div className="font-mono text-xs text-foreground">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 border-t px-3 pt-3 pb-3 text-sm leading-6 text-muted-foreground sm:px-4">
        Each node's own context holds one task — the model inside it never sees the other branches.
        The <span className="text-foreground">program</span> holds the whole job: the root session's
        Python namespace, not any single model's context window, is what tracks all {sessions}{" "}
        sessions. Drag <span className="text-foreground">fanout</span> up and the node count grows as{" "}
        <code>fanout^depth</code>, not <code>depth</code> — which is why Prime Agent enforces a real
        depth budget in code (<code>RLM_DEPTH &gt;= RLM_MAX_DEPTH</code> raises before a comm even
        opens) instead of trusting the model to stop recursing on its own. Toggle{" "}
        <span className="text-foreground">raised</span> to see what an uncapped depth of 2 would
        actually spawn.
      </p>
    </figure>
  )
}
