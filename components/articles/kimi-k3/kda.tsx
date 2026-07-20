"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Kimi Delta Attention as a gated delta-rule linear-attention recurrence.
// Scrub t over a streaming token sequence: at each step a single FIXED-SIZE state
// cell S is updated by an "erase" (gated decay of prior content, drawn muted/thin)
// and a "write" (the new key/value delta, drawn in accent). S carries forward to
// t+1 at constant size. Contrast: full softmax attention keeps a KV cache that
// grows one cell per token — O(t) memory that scales with sequence length. KDA's
// state stays constant, buying up to 6.3x faster decode at 1M context.

const ACCENT = "oklch(0.58 0.15 265)"
const TINT = "oklch(0.58 0.15 265 / 0.14)"

const T = 8

// scene geometry (viewBox units)
const W = 640
const H = 388
const PADL = 44
const PADR = 44
const TOK_Y = 336
const TOK_W = 30
const TOK_H = 26
const tokX = (i: number): number => PADL + i * ((W - PADL - PADR) / (T - 1))

// KDA state cell S
const SX = 66
const SY = 132
const SW = 154
const SH = 78

// softmax KV cache stack
const KVX = 424
const KVW = 150
const KV_CELL_H = 15
const KV_GAP = 3
const KV_BASE = 300

const g = 0.72 // gated-decay retention (illustrative)

function sCurve(x1: number, y1: number, x2: number, y2: number): string {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function KimiDeltaAttention() {
  const [t, setT] = useState<number>(4)

  const curX = tokX(t - 1)
  const sMidY = SY + SH
  // inner content bars: retained prior (muted) shrinks with decay, delta write (accent)
  const innerX = SX + 14
  const innerW = SW - 28
  const priorW = innerW * g
  const deltaW = innerW - priorW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>kimi delta attention · gated delta-rule recurrence</span>
        <span>t = {t} / {T}</span>
      </div>

      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Kimi Delta Attention recurrence at step t=${t}. A fixed-size state cell erases prior content by gated decay and writes the new key/value delta, staying constant size, while a softmax KV cache grows to ${t} cells.`}
        >
          <defs>
            <marker id="kda-arw" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M1 1 L5 3 L1 5" fill="none" stroke={ACCENT} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="kda-arw-mut" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M1 1 L5 3 L1 5" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <filter id="kda-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- panel labels ---- */}
          <text x={SX} y={SY - 14} className="fill-foreground font-mono" fontSize={11}>KDA · recurrent state</text>
          <text x={SX} y={SY - 1} className="fill-muted-foreground font-mono" fontSize={9.5}>constant size</text>

          <text x={KVX} y={122} className="fill-foreground font-mono" fontSize={11}>softmax · KV cache</text>
          <text x={KVX} y={135} className="fill-muted-foreground font-mono" fontSize={9.5}>grows with t</text>

          {/* ---- faint connectors: every processed token collapsed into one S ---- */}
          {Array.from({ length: t }, (_, i: number) => (
            <path
              key={`f${i}`}
              d={sCurve(tokX(i), TOK_Y, SX + SW / 2, sMidY)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1}
              opacity={0.1}
            />
          ))}

          {/* ---- KDA state cell S ---- */}
          <rect x={SX} y={SY} width={SW} height={SH} rx={12} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#kda-shadow)" />
          <text x={SX + 14} y={SY + 22} className="fill-foreground font-mono" fontSize={11}>S<tspan fontSize={8} dy={2}>t</tspan> <tspan className="fill-muted-foreground" dy={-2}>= (1−a)·gS + Δ</tspan></text>
          {/* retained prior (erase / gated decay) */}
          <rect x={innerX} y={SY + 36} width={priorW} height={16} rx={4} fill="var(--muted)" stroke="var(--border)" strokeWidth={1} />
          <text x={innerX + 6} y={SY + 48} className="fill-muted-foreground font-mono" fontSize={8.5}>retained · gS</text>
          {/* new write (delta) */}
          <rect x={innerX + priorW + 4} y={SY + 36} width={deltaW - 4} height={16} rx={4} fill={TINT} stroke={ACCENT} strokeWidth={1.25} />
          <text x={innerX + priorW + 10} y={SY + 48} className="font-mono" fontSize={8.5} fill={ACCENT}>Δ</text>
          <text x={SX + 14} y={SY + 68} className="fill-muted-foreground font-mono" fontSize={8.5}>erase (decay) + write (kv delta)</text>

          {/* persist / carry-forward loop over the top of S */}
          <path
            d={`M ${SX + SW - 24} ${SY} C ${SX + SW - 24} ${SY - 26}, ${SX + 24} ${SY - 26}, ${SX + 24} ${SY}`}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            markerEnd="url(#kda-arw-mut)"
            opacity={0.7}
          />
          <text x={SX + SW / 2} y={SY - 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>carry Sₜ₋₁ → Sₜ</text>

          {/* ---- current token → S: erase (muted) + write (accent) ---- */}
          <path
            d={sCurve(curX - 6, TOK_Y - 4, SX + 40, sMidY)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            markerEnd="url(#kda-arw-mut)"
            opacity={0.85}
          />
          <path
            d={sCurve(curX + 6, TOK_Y - 4, SX + SW - 40, sMidY)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            markerEnd="url(#kda-arw)"
          />

          {/* ---- current token → newest KV cell ---- */}
          <path
            d={sCurve(curX, TOK_Y - 4, KVX - 2, KV_BASE - (t - 1) * (KV_CELL_H + KV_GAP) - KV_CELL_H / 2)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            markerEnd="url(#kda-arw-mut)"
            opacity={0.55}
          />

          {/* ---- softmax KV cache stack: one muted cell per processed token ---- */}
          {Array.from({ length: t }, (_, i: number) => {
            const y = KV_BASE - (i + 1) * (KV_CELL_H + KV_GAP)
            const isNew = i === t - 1
            return (
              <rect
                key={`kv${i}`}
                x={KVX}
                y={y}
                width={KVW}
                height={KV_CELL_H}
                rx={4}
                fill="var(--muted)"
                stroke={isNew ? ACCENT : "var(--border)"}
                strokeWidth={isNew ? 1.4 : 1}
                opacity={isNew ? 1 : 0.55}
              />
            )
          })}
          {/* baseline under the stack */}
          <line x1={KVX} y1={KV_BASE + 1} x2={KVX + KVW} y2={KV_BASE + 1} stroke="var(--border)" strokeWidth={1} />
          <text x={KVX + KVW / 2} y={KV_BASE + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>{t} cells · O(t)</text>

          {/* ---- streaming token strip t = 1..T ---- */}
          {Array.from({ length: T }, (_, i: number) => {
            const x = tokX(i)
            const done = i < t - 1
            const cur = i === t - 1
            return (
              <g key={`tok${i}`}>
                <rect
                  x={x - TOK_W / 2}
                  y={TOK_Y}
                  width={TOK_W}
                  height={TOK_H}
                  rx={7}
                  fill={cur ? TINT : "var(--background)"}
                  stroke={cur ? ACCENT : "var(--border)"}
                  strokeWidth={cur ? 1.5 : 1}
                  strokeDasharray={i > t - 1 ? "3 3" : undefined}
                  opacity={i > t - 1 ? 0.55 : 1}
                />
                <text
                  x={x}
                  y={TOK_Y + 17}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={10}
                  fill={cur ? ACCENT : done ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {i + 1}
                </text>
              </g>
            )
          })}
          <text x={PADL - 6} y={TOK_Y + 17} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9.5}>tok</text>
        </svg>

        {/* ---- control ---- */}
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">t</span>
            <Range
              min={1}
              max={T}
              step={1}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted "
              aria-label="Scrub the sequence position t" accent="oklch(0.58 0.15 265)" />
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">KDA state size</div>
              <div style={{ color: ACCENT }}>constant · 1 cell</div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">softmax KV cache</div>
              <div className="text-foreground">O(t) · {t} {t === 1 ? "cell" : "cells"}</div>
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          KDA is a gated delta-rule linear attention. Each token makes the fixed-size state{" "}
          <span className="font-mono" style={{ color: ACCENT }}>S</span> selectively <em>erase</em> prior
          content (gated decay) and <em>write</em> the new key/value delta, so information flows across
          arbitrarily long sequences at <span className="text-foreground">constant</span> state size — while
          softmax attention&apos;s KV cache grows one entry per token. That is what buys up to{" "}
          <span className="text-foreground">6.3&times; faster decode</span> at 1M-token context.
        </p>
      </div>
    </figure>
  )
}
