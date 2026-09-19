"use client"

import { useState } from "react"

// One Splash decode step, which is one Metal command buffer.
//
// The shape is fixed in the source, not chosen per request:
//
//   SPLASH_DRAFT_QUERY_ROWS      8   — the draft's rows: an anchor plus 7 proposals
//   SPLASH_DRAFT_PROPOSAL_TOKENS 7
//   SPLASH_TARGET_VERIFY_ROWS    8   — the target verifies all 8 in one pass
//   SPLASH_MAXIMUM_BATCH_WIDTH   4   — at most 4 requests share the step
//
// and Runtime.mm says so in a comment: "DFlash has one physical graph: anchor +
// seven proposal rows. A shorter output budget only lowers the token-exact commit
// count; it never changes the Metal graph shape."
//
// Everything in the frame — rope tables, draft embedding, the 5-layer draft, the
// rank-256 path selector, the verify-input assembly, the 64-layer target, top-32
// sampling, the accept test, the Gated DeltaNet state commit and the draft's own
// state commit — is encoded into one command buffer and submitted once. That is
// what "the decode step runs as one unit" means in the launch post, and it is
// why the per-step cost does not scale with the number of tokens the step emits.
//
// The reader drags the cut. The bytes do not move; only the tokens do.

const ACCENT = "oklch(0.58 0.15 245)"
const GOOD = "oklch(0.52 0.15 155)"
const WARN = "oklch(0.58 0.19 28)"

const STEP_GB = 16.729

const W = 760
const H = 300

const CELL_W = 68
const GAP = 8
const ROW_Y = 132
const ROW_H = 40
const LEFT = (W - (8 * CELL_W + 7 * GAP)) / 2

const cellX = (i: number) => LEFT + i * (CELL_W + GAP)

export function DecodeStep() {
  // How many of the 7 proposals survived. The step always emits one more than
  // this: the target's own correction, or its free next token on a clean sweep.
  const [accepted, setAccepted] = useState(4)
  const emitted = accepted + 1

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One decode step · one Metal command buffer · one submit
      </div>

      <div className="px-2 pt-4 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A schematic of one Splash decode step. A five-layer DFlash 2 draft runs a single pass over eight rows, a rank-256 path selector picks one coherent sequence from the top sixteen candidates at each position, and the sixty-four-layer Qwen3.8-27B target verifies all eight rows in the same pass. The cut is currently set so that ${accepted} of the seven proposals are accepted, emitting ${emitted} tokens for the step's fixed 16.73 gigabytes of memory traffic.`}
        >
          <defs>
            <filter id="step-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="step-arrow"
              viewBox="0 -5 10 10"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              refX="6"
              refY="0"
            >
              <path
                d="M0,-3.5L5,0L0,3.5"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
              />
            </marker>
          </defs>

          {/* the command buffer frame */}
          <rect
            x={10}
            y={16}
            width={W - 20}
            height={H - 62}
            rx={10}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={22}
            y={10}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            one command buffer
          </text>

          {/* draft band */}
          <rect
            x={LEFT - 10}
            y={38}
            width={8 * CELL_W + 7 * GAP + 20}
            height={30}
            rx={8}
            fill="var(--background)"
            stroke={ACCENT}
            strokeWidth={1.5}
            filter="url(#step-soft)"
          />
          <text
            x={W / 2}
            y={57}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={11}
          >
            DFlash 2 draft · 5 layers · one pass · 1.27 GB
          </text>

          {/* selector band */}
          <rect
            x={LEFT - 10}
            y={78}
            width={8 * CELL_W + 7 * GAP + 20}
            height={26}
            rx={8}
            fill="var(--muted)"
            fillOpacity={0.5}
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          <text
            x={W / 2}
            y={95}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={10}
          >
            path selector · top-16 per position, rank-256 bigram edges
          </text>

          {/* fan-out from selector to rows */}
          {Array.from({ length: 8 }, (_, i) => {
            const x = cellX(i) + CELL_W / 2
            return (
              <path
                key={`fan-${i}`}
                d={`M ${x} 104 C ${x} 114, ${x} 118, ${x} ${ROW_Y - 4}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.2}
                strokeOpacity={0.5}
                markerEnd="url(#step-arrow)"
              />
            )
          })}

          {/* the eight rows */}
          {Array.from({ length: 8 }, (_, i) => {
            const isAnchor = i === 0
            const isAccepted = i > 0 && i <= accepted
            const isCorrection = i === accepted + 1
            const live = isAnchor || isAccepted || isCorrection
            const stroke = isCorrection
              ? accepted === 7
                ? GOOD
                : WARN
              : live
                ? GOOD
                : "var(--border)"
            return (
              <g key={`row-${i}`}>
                <rect
                  x={cellX(i)}
                  y={ROW_Y}
                  width={CELL_W}
                  height={ROW_H}
                  rx={7}
                  fill="var(--background)"
                  stroke={stroke}
                  strokeWidth={live ? 2 : 1.2}
                  strokeOpacity={live ? 1 : 0.7}
                  filter={live ? "url(#step-soft)" : undefined}
                />
                <text
                  x={cellX(i) + CELL_W / 2}
                  y={ROW_Y + 16}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fill="var(--muted-foreground)"
                >
                  row {i}
                </text>
                <text
                  x={cellX(i) + CELL_W / 2}
                  y={ROW_Y + 30}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9.5}
                  fill={live ? "var(--foreground)" : "var(--muted-foreground)"}
                  fillOpacity={live ? 1 : 0.55}
                >
                  {isAnchor
                    ? "anchor"
                    : isAccepted
                      ? "kept"
                      : isCorrection
                        ? accepted === 7
                          ? "free"
                          : "fixed"
                        : "dropped"}
                </text>
              </g>
            )
          })}

          {/* the cut */}
          {accepted < 7 ? (
            <g>
              <line
                x1={cellX(accepted + 1) + CELL_W + GAP / 2}
                y1={ROW_Y - 14}
                x2={cellX(accepted + 1) + CELL_W + GAP / 2}
                y2={ROW_Y + ROW_H + 14}
                stroke={WARN}
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            </g>
          ) : null}

          {/* fan-in to the target */}
          {Array.from({ length: 8 }, (_, i) => {
            const x = cellX(i) + CELL_W / 2
            return (
              <path
                key={`in-${i}`}
                d={`M ${x} ${ROW_Y + ROW_H + 4} C ${x} ${ROW_Y + ROW_H + 14}, ${x} ${ROW_Y + ROW_H + 18}, ${x} ${ROW_Y + ROW_H + 26}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.2}
                strokeOpacity={0.5}
              />
            )
          })}

          {/* target band */}
          <rect
            x={LEFT - 10}
            y={ROW_Y + ROW_H + 26}
            width={8 * CELL_W + 7 * GAP + 20}
            height={30}
            rx={8}
            fill="var(--background)"
            stroke={ACCENT}
            strokeWidth={2}
            filter="url(#step-soft)"
          />
          <text
            x={W / 2}
            y={ROW_Y + ROW_H + 46}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={11}
          >
            Qwen3.8-27B · 64 layers · one pass · 14.44 GB
          </text>

          <text
            x={W / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            then: top-32 sample, accept test, GDN state commit, draft state commit
          </text>
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-36 shrink-0 font-mono text-muted-foreground">
            proposals accepted
          </span>
          <input
            type="range"
            min={0}
            max={7}
            step={1}
            value={accepted}
            onChange={(e) => setAccepted(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            aria-label="Proposals accepted this step"
          />
          <span className="w-8 shrink-0 text-right font-mono tabular-nums">
            {accepted}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-3 border-t text-xs">
        <div className="border-r px-4 py-2">
          <div className="font-mono text-muted-foreground">tokens emitted</div>
          <div className="font-mono text-lg tabular-nums">{emitted}</div>
        </div>
        <div className="border-r px-4 py-2">
          <div className="font-mono text-muted-foreground">GB read</div>
          <div className="font-mono text-lg tabular-nums">16.73</div>
        </div>
        <div className="px-4 py-2">
          <div className="font-mono text-muted-foreground">GB per token</div>
          <div className="font-mono text-lg tabular-nums">
            {(STEP_GB / emitted).toFixed(2)}
          </div>
        </div>
      </div>
    </figure>
  )
}
