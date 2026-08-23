"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Where you put a recurrent-state checkpoint decides what an agent turn costs.
//
// A full-attention layer can reuse any prefix of its KV cache. A recurrent layer
// cannot: it has compressed the whole prefix into one evolving state, so reuse
// depends entirely on checkpoints taken during prefill. Each checkpoint captures
// the complete recurrent state of every such layer, which is large, so only a
// handful fit — and their placement is the whole game.
//
// FreeToken spends the budget at semantic anchors: the special-token boundaries
// that mark thinking segments, tool calls, tool outputs, and conversation turns.
// Those are exactly the positions agent harnesses edit at, and a harness always
// preserves the prefix up to the block it edits — so an anchor there survives
// while a checkpoint at an arbitrary offset does not.
//
// The three edit policies below are the ones the paper names, taken from the
// harnesses themselves: OpenClaw strips thinking blocks from every assistant turn
// but the latest, OpenCode replaces tool outputs beyond a recent window with a
// fixed placeholder, SWE-agent elides all but the last n observations.
//
// The comparison is budget-matched on purpose: both rules get the same k slots.
// Evenly-spaced puts them at i·total/k; anchored spreads them across the anchor
// list. Restore is from the deepest surviving checkpoint at or before the first
// edited position, which is how the paper describes it.
//
// Token counts are a plausible three-turn coding session, not a measurement.
// Real W3 sessions in the paper grow to 56–65k tokens.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const TEAL = "oklch(0.58 0.10 195)"

type Kind = "system" | "turn" | "think" | "call" | "output"

const KIND_COLOR: Record<Kind, string> = {
  system: "oklch(0.55 0.02 250)",
  turn: TEAL,
  think: ACCENT,
  call: WARM,
  output: GOOD,
}

type Block = { id: number; label: string; kind: Kind; tok: number; anchor: string }

const BLOCKS: Block[] = [
  { id: 1, label: "system + tool schemas", kind: "system", tok: 4820, anchor: "<|im_end|>" },
  { id: 2, label: "user: fix the failing test", kind: "turn", tok: 190, anchor: "<|im_end|>" },
  { id: 3, label: "thinking", kind: "think", tok: 1460, anchor: "</think>" },
  { id: 4, label: "tool_call read_file", kind: "call", tok: 96, anchor: "</tool_call>" },
  { id: 5, label: "tool_output src/parser.py", kind: "output", tok: 7240, anchor: "</tool_output>" },
  { id: 6, label: "thinking", kind: "think", tok: 880, anchor: "</think>" },
  { id: 7, label: "tool_call grep", kind: "call", tok: 74, anchor: "</tool_call>" },
  { id: 8, label: "tool_output 61 matches", kind: "output", tok: 2910, anchor: "</tool_output>" },
  { id: 9, label: "thinking", kind: "think", tok: 1730, anchor: "</think>" },
  { id: 10, label: "tool_call apply_patch", kind: "call", tok: 412, anchor: "</tool_call>" },
  { id: 11, label: "tool_output test run", kind: "output", tok: 3180, anchor: "</tool_output>" },
  { id: 12, label: "assistant: summary", kind: "turn", tok: 264, anchor: "<|im_end|>" },
]

const TOTAL = BLOCKS.reduce((a, b) => a + b.tok, 0)

// Cumulative end position of each block — these are the anchor positions.
const ENDS = BLOCKS.reduce<number[]>((acc, b, i) => {
  acc.push((i === 0 ? 0 : acc[i - 1]) + b.tok)
  return acc
}, [])
const START = (i: number) => (i === 0 ? 0 : ENDS[i - 1])

type Edit = {
  key: string
  label: string
  harness: string
  removed: number[] // block ids replaced or deleted
  keepBytes: number // tokens the replacement leaves behind, per block
  note: string
}

const EDITS: Edit[] = [
  {
    key: "append",
    label: "append only",
    harness: "no edit",
    removed: [],
    keepBytes: 0,
    note: "The easy case, and the one single-turn benchmarks measure. Nothing before the new user turn changed, so the deepest checkpoint is the end of the context and only the new suffix is prefilled. Every engine looks good here.",
  },
  {
    key: "openclaw",
    label: "strip old thinking",
    harness: "OpenClaw",
    removed: [3, 6],
    keepBytes: 0,
    note: "OpenClaw removes thinking blocks from every assistant turn but the latest. It is the harshest of the three because the first edit lands early — right after the opening user turn — so most of the session is downstream of it no matter where the checkpoints sit.",
  },
  {
    key: "opencode",
    label: "placeholder old tool outputs",
    harness: "OpenCode",
    removed: [5, 8],
    keepBytes: 12,
    note: "OpenCode replaces tool outputs beyond a recent window with a fixed placeholder. It deletes the largest blocks in the session, so the edited context is far shorter than the original — and the checkpoint that survives decides how much of that shorter context has to be walked again.",
  },
  {
    key: "sweagent",
    label: "elide all but the last observation",
    harness: "SWE-agent",
    removed: [5, 8],
    keepBytes: 0,
    note: "SWE-agent drops all but the last n observations outright. Structurally the same edit as OpenCode's, minus the placeholder — and the same lesson: the boundary the harness cut at is a boundary the engine could have checkpointed at.",
  },
]

// Two placement rules, same budget.
function anchoredSlots(k: number): number[] {
  const n = ENDS.length
  if (k >= n) return ENDS.slice()
  if (k === 1) return [ENDS[n - 1]]
  const out: number[] = []
  for (let i = 0; i < k; i++) out.push(ENDS[Math.round((i * (n - 1)) / (k - 1))])
  return Array.from(new Set(out))
}

function spacedSlots(k: number): number[] {
  return Array.from({ length: k }, (_, i) => Math.round(((i + 1) * TOTAL) / k))
}

const deepestAtOrBefore = (slots: number[], p: number) =>
  slots.filter((s) => s <= p).reduce((a, b) => Math.max(a, b), 0)

export function SemanticAnchors() {
  const [editKey, setEditKey] = useState("opencode")
  const [budget, setBudget] = useState(6)
  const edit = EDITS.find((e) => e.key === editKey) ?? EDITS[0]

  const removedSet = new Set(edit.removed)
  const firstRemovedIdx = BLOCKS.findIndex((b) => removedSet.has(b.id))
  // The first position whose token no longer matches the old context.
  const p = firstRemovedIdx === -1 ? TOTAL : START(firstRemovedIdx)

  const newTurn = 210
  const editedTotal =
    BLOCKS.reduce((a, b) => a + (removedSet.has(b.id) ? edit.keepBytes : b.tok), 0) + newTurn

  const anchored = anchoredSlots(budget)
  const spaced = spacedSlots(budget)
  const aResume = deepestAtOrBefore(anchored, p)
  const sResume = deepestAtOrBefore(spaced, p)

  // Every position before p is byte-identical in the old and new contexts — the
  // harness preserves the prefix up to the block it edits — so a checkpoint at
  // r <= p is still valid at offset r, and the work is whatever follows it.
  const aWork = Math.max(0, editedTotal - aResume)
  const sWork = Math.max(0, editedTotal - sResume)
  const saved = sWork - aWork

  const W = 720
  const H = 132
  const PAD = { l: 10, r: 10, t: 26 }
  const iw = W - PAD.l - PAD.r
  const X = (t: number) => PAD.l + (t / TOTAL) * iw
  const BAR = 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {TOTAL.toLocaleString()}-token agent session · {budget} checkpoint slots
        </span>
        <span className="font-mono text-[10px]" style={{ color: saved > 0 ? GOOD : "inherit" }}>
          {saved > 0 ? `${saved.toLocaleString()} tokens not re-prefilled` : "same either way"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {EDITS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setEditKey(e.key)}
              aria-pressed={editKey === e.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                editKey === e.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {e.harness} · {e.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full">
            <title>
              The agent context drawn as a bar of blocks, with checkpoint markers under it and the region that must
              be re-prefilled after the harness edit highlighted
            </title>

            {BLOCKS.map((b, i) => {
              const x = X(START(i))
              const w = Math.max(1.5, X(ENDS[i]) - x - 1)
              const gone = removedSet.has(b.id)
              return (
                <g key={b.id}>
                  <rect
                    x={x}
                    y={PAD.t}
                    width={w}
                    height={BAR}
                    rx={3}
                    fill={KIND_COLOR[b.kind]}
                    fillOpacity={gone ? 0.16 : 0.85}
                    stroke={gone ? WARM : "none"}
                    strokeDasharray={gone ? "3 2" : undefined}
                  />
                  {w > 46 ? (
                    <text
                      x={x + w / 2}
                      y={PAD.t + 17}
                      fontSize={8.5}
                      fill={gone ? WARM : "#0c0a09"}
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                    >
                      {gone ? "removed" : b.kind === "system" ? "system" : b.kind === "output" ? "tool out" : b.kind}
                    </text>
                  ) : null}
                  <line
                    x1={X(ENDS[i])}
                    y1={PAD.t - 4}
                    x2={X(ENDS[i])}
                    y2={PAD.t + BAR + 4}
                    stroke="currentColor"
                    strokeOpacity={0.25}
                  />
                </g>
              )
            })}

            {/* every anchor position the placement rule could have used */}
            {ENDS.map((e, i) => (
              <polygon
                key={i}
                points={`${X(e)},${PAD.t - 6} ${X(e) - 3.5},${PAD.t - 12} ${X(e) + 3.5},${PAD.t - 12}`}
                fill={WARM}
                fillOpacity={anchored.includes(e) ? 1 : 0.28}
              />
            ))}
            <text x={PAD.l} y={PAD.t - 16} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              ▲ semantic anchors — filled ones hold a checkpoint
            </text>

            {/* the budget-matched evenly spaced alternative */}
            {spaced.map((s) => (
              <line
                key={s}
                x1={X(s)}
                y1={PAD.t + BAR + 8}
                x2={X(s)}
                y2={PAD.t + BAR + 18}
                stroke={TEAL}
                strokeWidth={2}
              />
            ))}
            <text x={PAD.l} y={PAD.t + BAR + 30} fontSize={9} fill={TEAL} fontFamily="ui-monospace, monospace">
              │ same budget, evenly spaced
            </text>

            {/* the first edited position */}
            <line x1={X(p)} y1={PAD.t - 14} x2={X(p)} y2={PAD.t + BAR + 20} stroke={WARM} strokeWidth={1.5} strokeDasharray="3 2" />
            <text
              x={Math.min(X(p) + 4, W - 90)}
              y={H - 26}
              fontSize={9}
              fill={WARM}
              fontFamily="ui-monospace, monospace"
            >
              first edited token
            </text>

            {/* where each rule has to resume from */}
            <rect x={X(aResume)} y={H - 18} width={Math.max(1, X(p) - X(aResume))} height={5} fill={GOOD} rx={2} />
            <rect x={X(sResume)} y={H - 11} width={Math.max(1, X(p) - X(sResume))} height={5} fill={TEAL} rx={2} />
            <text x={W - PAD.r} y={H - 13} fontSize={8.5} fill={GOOD} textAnchor="end" fontFamily="ui-monospace, monospace">
              anchored replays {(p - aResume).toLocaleString()} extra
            </text>
            <text x={W - PAD.r} y={H - 5} fontSize={8.5} fill={TEAL} textAnchor="end" fontFamily="ui-monospace, monospace">
              spaced replays {(p - sResume).toLocaleString()} extra
            </text>
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">checkpoint slots</span>
          <Range
            min={2}
            max={12}
            step={1}
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="flex-1"
            aria-label="number of recurrent-state checkpoint slots"
            accent={ACCENT}
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{budget}</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">anchored at boundaries</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              {aWork.toLocaleString()}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">tokens re-prefilled</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">evenly spaced</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: TEAL }}>
              {sWork.toLocaleString()}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {sWork > aWork ? `${(((sWork - aWork) / Math.max(aWork, 1)) * 100).toFixed(0)}% more work` : "no penalty here"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">context after the edit</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {editedTotal.toLocaleString()}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">was {TOTAL.toLocaleString()} + a new turn</div>
          </div>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {edit.harness} · {edit.label}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{edit.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag the budget down to three and watch the evenly-spaced rule fall off a cliff while the anchored one
          degrades gently. That is the actual claim: not that anchors are magic, but that{" "}
          <span className="text-foreground">the harness has already told you where it is going to cut</span>, in
          the form of the special tokens it uses to find the blocks. An engine that checkpoints on a byte counter
          is ignoring a free signal.
          <br />
          <br />
          And note the asymmetry that makes this matter at all. Full-attention layers keep a radix prefix tree and
          can reuse <em>any</em>{" "}prefix. A recurrent layer — gated DeltaNet in Qwen3.6, Kimi Delta Attention in
          Kimi-K3 — has folded the whole history into one state, so it can only resume from a position someone
          thought to save. Hybrid architectures made prefix reuse a placement problem, and this is the placement.
        </p>
      </div>
    </figure>
  )
}
