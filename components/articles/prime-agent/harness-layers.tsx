"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The continual harness has one immutable layer and four editable ones.
// /refine can create, update, or delete entries in the four editable kinds;
// it is hard-rejected from ever touching the base system prompt (validateEdit
// in refinement.ts literally returns "base system prompt is not editable").
// Every edit is versioned, so rollback means pointing a kind back at an
// earlier recorded version — not un-writing anything. Illustrative version
// text below; the mechanism (locked base, versioned edits, local/global
// scope) is real.

const EDIT = "oklch(0.60 0.15 255)"
const GLOBAL = "oklch(0.72 0.15 60)"
const BLOCKED = "var(--destructive)"

const W = 760
const H = 320

const REFINE = { x: 300, y: 16, w: 160, h: 40 }
const BASE = { x: 540, y: 16, w: 190, h: 40 }
const KIND_Y = 176
const KIND_W = 150
const KIND_H = 46
const KIND_GAP = 176

type Kind = "prompt" | "memory" | "skill" | "subagent"

const KINDS: { id: Kind; label: string; sub: string; history: string[] }[] = [
  {
    id: "prompt",
    label: "prompt notes",
    sub: "supplemental only",
    history: ["created: note on repo conventions", "updated: added retry-before-fail policy"],
  },
  {
    id: "memory",
    label: "memories",
    sub: "facts · decisions",
    history: [
      "created: prefers pnpm over npm here",
      "updated: added CI flake note",
      "updated: corrected a stale path",
    ],
  },
  {
    id: "skill",
    label: "skills",
    sub: "python call spec",
    history: ["created: release-audit call form", "updated: broadened default arguments"],
  },
  {
    id: "subagent",
    label: "subagent specs",
    sub: "delegation roles",
    history: [
      "created: api-reviewer role",
      "updated: added test-coverage focus",
      "updated: narrowed to public endpoints",
    ],
  },
]

function kindX(i: number): number {
  return 40 + i * KIND_GAP
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function HarnessLayers() {
  const [scope, setScope] = useState<"local" | "global">("local")
  const [selected, setSelected] = useState<Kind>("memory")
  const [versionIndex, setVersionIndex] = useState(2)

  const kind = KINDS.find((k) => k.id === selected) ?? KINDS[1]
  const vIndex = Math.min(versionIndex, kind.history.length - 1)
  const atLatest = vIndex === kind.history.length - 1
  const accent = scope === "local" ? EDIT : GLOBAL
  const path =
    scope === "local"
      ? "<session_dir>/harness/harness_state.json"
      : "~/.prime/agent/harness/harness_state.json"

  const refineCx = REFINE.x + REFINE.w / 2
  const refineBottom = REFINE.y + REFINE.h

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>continual harness · what /refine may touch</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A refine node reaches four editable harness kinds — prompt notes, memories, skills, and subagent specs — but is blocked from the immutable base system prompt"
        >
          <defs>
            <marker id="pa-hl-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={accent} strokeWidth={1.5} />
            </marker>
            <filter id="pa-hl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* blocked connector: refine -> base prompt */}
          <path
            d={curve(refineCx, REFINE.y + REFINE.h / 2, BASE.x, BASE.y + BASE.h / 2)}
            fill="none"
            stroke={BLOCKED}
            strokeWidth={1.5}
            strokeDasharray="3 4"
            opacity={0.75}
          />
          <text x={(refineCx + BASE.x) / 2 + 6} y={REFINE.y + REFINE.h / 2 - 6} textAnchor="middle" className="font-mono" fontSize={13} fill={BLOCKED}>
            ×
          </text>

          {/* editable connectors: refine -> each kind */}
          {KINDS.map((k, i) => {
            const cx2 = kindX(i) + KIND_W / 2
            const isSel = k.id === selected
            return (
              <path
                key={k.id}
                d={curve(refineCx, refineBottom, cx2, KIND_Y)}
                fill="none"
                stroke={accent}
                strokeWidth={1.5}
                markerEnd="url(#pa-hl-arrow)"
                opacity={isSel ? 0.95 : 0.35}
              />
            )
          })}

          {/* refine node */}
          <rect x={REFINE.x} y={REFINE.y} width={REFINE.w} height={REFINE.h} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#pa-hl-soft)" />
          <text x={refineCx} y={REFINE.y + 24} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            /refine review
          </text>

          {/* base prompt node (locked) */}
          <rect x={BASE.x} y={BASE.y} width={BASE.w} height={BASE.h} rx={8} fill="var(--muted)" opacity={0.5} stroke={BLOCKED} strokeWidth={1.5} strokeDasharray="3 4" />
          <text x={BASE.x + BASE.w / 2} y={BASE.y + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            base system prompt
          </text>
          <text x={BASE.x + BASE.w / 2} y={BASE.y + 31} textAnchor="middle" className="font-mono" fontSize={9} fill={BLOCKED}>
            immutable — never rewritten
          </text>

          {/* kind nodes */}
          {KINDS.map((k, i) => {
            const x = kindX(i)
            const isSel = k.id === selected
            return (
              <g key={k.id} onClick={() => setSelected(k.id)} className="cursor-pointer">
                <rect
                  x={x}
                  y={KIND_Y}
                  width={KIND_W}
                  height={KIND_H}
                  rx={8}
                  fill={isSel ? accent : "var(--background)"}
                  opacity={isSel ? 0.16 : 1}
                  stroke={isSel ? accent : "var(--border)"}
                  strokeWidth={1.5}
                  filter={isSel ? "url(#pa-hl-soft)" : undefined}
                />
                <text x={x + KIND_W / 2} y={KIND_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                  {k.label}
                </text>
                <text x={x + KIND_W / 2} y={KIND_Y + 33} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                  {k.sub}
                </text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">scope</span>
            {(["local", "global"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  scope === s ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
                style={scope === s ? { background: accent } : undefined}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">{path}</div>
        </div>

        {/* selected kind's version history */}
        <div className="mt-3 rounded-md border p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              {kind.label} · version {vIndex + 1} of {kind.history.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVersionIndex(Math.max(0, vIndex - 1))}
                disabled={vIndex === 0}
                className="cursor-pointer rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                rollback
              </button>
              <button
                type="button"
                onClick={() => setVersionIndex(kind.history.length - 1)}
                disabled={atLatest}
                className="cursor-pointer rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                latest
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            {kind.history.map((_, i) => (
              <span
                key={i}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{ background: i <= vIndex ? accent : "var(--border)" }}
              />
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-foreground">{kind.history[vIndex]}</p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Click a kind to select it. Every arrow into{" "}
          <span className="text-foreground">prompt notes</span>,{" "}
          <span className="text-foreground">memories</span>,{" "}
          <span className="text-foreground">skills</span>, and{" "}
          <span className="text-foreground">subagent specs</span>{" "}is one <code>/refine</code> can
          draw — small, evidence-backed edits, each recorded as a new version.{" "}
          <span style={{ color: BLOCKED }}>The dashed line to the base prompt is blocked in code</span>,
          not just in the prompt: the edit validator rejects any edit whose kind is{" "}
          <code>prompt</code> and id is <code>base_system_prompt</code> before it ever reaches the
          model. Rollback moves a kind{"'"}s pointer to an earlier recorded version; it does not
          undo history, it adds to it.
        </p>
      </div>
    </figure>
  )
}
