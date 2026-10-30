"use client"

import { useState } from "react"

import { GG, COOKIE, COOKIE_CONTROLS, GG_SOLO } from "./data-q35"
import { ACCENT, Frame, GREEN, MONO, STREAM, T } from "./viz"

const W = 330
const H = 190
const X0 = 40
const Y0 = 150
const PW = 270
const PH = 120

type Pick = { title: string; line: string; snippet: string }

function xOf(v: number, max: number) {
  return X0 + (v / max) * PW
}
function yOf(c: number, max: number) {
  return Y0 - (c / max) * PH
}

export function DoseResponse4B() {
  const [pick, setPick] = useState<Pick | null>(null)
  const ggOpen = GG.filter((p) => p.prompt === "open")
  const ggId = GG.filter((p) => p.prompt === "id")
  const ggMax = 12
  const ckMax = 12
  const show = pick ?? {
    title: "tap or focus a point",
    line: "Each point is one greedy generation on Qwen3.5-4B (int8).",
    snippet: "The text it produced is shown here.",
  }
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ")
  return (
    <Frame
      label="dose against effect on Qwen3.5-4B · MEASURED by us · int8, one generation per point"
      note="Counts are mentions in 60 to 70 new tokens (batch 1 used 70, batch 2 used 60), one generation per cell, so read the shape and not the digits. At the top of each curve the text degrades: the full-dose golden-gate recipe on the open prompt collapsed into repeated think tags (counted as 0 here), and the Cookie text at 1.6 loops on the word, which inflates its count."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            Golden-gate recipe at 0, 0.25, 0.5, 0.75 and 1 times the posted doses. Mentions of bridge words rise from 0
            at a quarter dose to 5 on the open prompt and 10 on the identity prompt at three quarters. At full dose the
            identity prompt still gives 9 and the open prompt collapses into repeated think tags.
          </title>
          <T x={X0} y={14} size={10} opacity={0.85}>golden-gate recipe: bridge words</T>
          {[0, 4, 8, 12].map((v) => (
            <g key={v}>
              <line x1={X0} y1={yOf(v, ggMax)} x2={X0 + PW} y2={yOf(v, ggMax)} stroke="currentColor" strokeOpacity={0.1} />
              <T x={X0 - 5} y={yOf(v, ggMax) + 3} anchor="end" size={8.5} opacity={0.5}>{v}</T>
            </g>
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <T key={v} x={xOf(v, 1)} y={Y0 + 14} anchor="middle" size={8.5} opacity={0.55}>{v === 0 ? "0" : `x${v}`}</T>
          ))}
          <T x={X0 + PW / 2} y={Y0 + 30} anchor="middle" size={8.5} opacity={0.6}>share of the posted doses</T>
          <path d={path(ggId.map((p) => ({ x: xOf(p.frac, 1), y: yOf(p.count, ggMax) })))} fill="none" stroke={ACCENT} strokeWidth={1.8} />
          <path d={path(ggOpen.map((p) => ({ x: xOf(p.frac, 1), y: yOf(p.count, ggMax) })))} fill="none" stroke={STREAM} strokeWidth={1.8} strokeDasharray="4 3" />
          {[...ggId.map((p) => ({ p, c: ACCENT, n: "Who are you" })), ...ggOpen.map((p) => ({ p, c: STREAM, n: "open prompt" }))].map(({ p, c, n }) => (
            <circle
              key={`${n}${p.frac}`}
              cx={xOf(p.frac, 1)}
              cy={yOf(p.count, ggMax)}
              r={5}
              fill={c}
              fillOpacity={0.9}
              tabIndex={0}
              role="button"
              aria-label={`${n}, ${p.frac} of the posted dose, ${p.count} bridge words`}
              className="cursor-pointer outline-none focus-visible:stroke-current focus-visible:stroke-2"
              onClick={() => setPick({ title: `${n} · x${p.frac}`, line: `${p.count} bridge words in ${p.tokens} tokens`, snippet: p.snippet })}
              onFocus={() => setPick({ title: `${n} · x${p.frac}`, line: `${p.count} bridge words in ${p.tokens} tokens`, snippet: p.snippet })}
            />
          ))}
          {GG_SOLO.map((s, i) => (
            <g key={s.name}>
              <rect
                x={X0 + 6 + i * 20}
                y={yOf(0, ggMax) - 8}
                width={14}
                height={8}
                rx={2}
                fill={GREEN}
                fillOpacity={0.7}
                tabIndex={0}
                role="button"
                aria-label={`${s.name} alone at full dose, ${s.count} bridge words`}
                className="cursor-pointer outline-none focus-visible:stroke-current focus-visible:stroke-2"
                onClick={() => setPick({ title: `${s.name} alone`, line: `${s.neuron}: ${s.count} bridge words`, snippet: s.snippet })}
                onFocus={() => setPick({ title: `${s.name} alone`, line: `${s.neuron}: ${s.count} bridge words`, snippet: s.snippet })}
              />
            </g>
          ))}
          <T x={X0 + 6} y={yOf(0, ggMax) - 12} size={8} opacity={0.6}>single neurons: 0, 0, 0</T>
          <T x={X0 + 4} y={yOf(10, ggMax) - 6} size={8.5} fill={ACCENT} opacity={0.95}>Who are you</T>
          <T x={X0 + 4} y={yOf(6.5, ggMax)} size={8.5} fill={STREAM} opacity={0.95}>open prompt</T>
        </svg>

        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            The Cookie preset at doses 0, 0.2, 0.4, 0.8 and 1.6. Mentions of cookie are 0, 0, 4, 7 and 11. Three random
            layer-24 neurons at 0.8 gave 0 each.
          </title>
          <T x={X0} y={14} size={10} opacity={0.85}>Cookie preset: cookie mentions</T>
          {[0, 4, 8, 12].map((v) => (
            <g key={v}>
              <line x1={X0} y1={yOf(v, ckMax)} x2={X0 + PW} y2={yOf(v, ckMax)} stroke="currentColor" strokeOpacity={0.1} />
              <T x={X0 - 5} y={yOf(v, ckMax) + 3} anchor="end" size={8.5} opacity={0.5}>{v}</T>
            </g>
          ))}
          {COOKIE.map((c) => (
            <T key={c.dose} x={xOf(c.dose, 1.6)} y={Y0 + 14} anchor="middle" size={8.5} opacity={0.55}>{c.dose}</T>
          ))}
          <T x={X0 + PW / 2} y={Y0 + 30} anchor="middle" size={8.5} opacity={0.6}>dose (L24 N3102, in residual norms)</T>
          <path d={path(COOKIE.map((c) => ({ x: xOf(c.dose, 1.6), y: yOf(c.count, ckMax) })))} fill="none" stroke={ACCENT} strokeWidth={1.8} />
          {COOKIE.map((c) => (
            <circle
              key={c.dose}
              cx={xOf(c.dose, 1.6)}
              cy={yOf(c.count, ckMax)}
              r={5}
              fill={ACCENT}
              fillOpacity={0.9}
              tabIndex={0}
              role="button"
              aria-label={`Cookie neuron at dose ${c.dose}, ${c.count} mentions`}
              className="cursor-pointer outline-none focus-visible:stroke-current focus-visible:stroke-2"
              onClick={() => setPick({ title: `Cookie · dose ${c.dose}`, line: `${c.count} cookie mentions in 60 tokens`, snippet: c.snippet })}
              onFocus={() => setPick({ title: `Cookie · dose ${c.dose}`, line: `${c.count} cookie mentions in 60 tokens`, snippet: c.snippet })}
            />
          ))}
          {COOKIE_CONTROLS.map((c, i) => (
            <rect
              key={c.name}
              x={xOf(0.8, 1.6) - 7 + (i - 1) * 16}
              y={yOf(0, ckMax) - 9}
              width={12}
              height={8}
              rx={2}
              fill={GREEN}
              fillOpacity={0.75}
              tabIndex={0}
              role="button"
              aria-label={`random neuron ${c.name} at dose 0.8, ${c.count} cookie mentions`}
              className="cursor-pointer outline-none focus-visible:stroke-current focus-visible:stroke-2"
              onClick={() => setPick({ title: `random ${c.name} · dose 0.8`, line: `${c.count} cookie mentions`, snippet: c.snippet })}
              onFocus={() => setPick({ title: `random ${c.name} · dose 0.8`, line: `${c.count} cookie mentions`, snippet: c.snippet })}
            />
          ))}
          <T x={xOf(0.8, 1.6)} y={yOf(0, ckMax) - 14} anchor="middle" size={8} opacity={0.65}>3 random neurons: 0, 0, 0</T>
        </svg>
      </div>
      <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground" aria-live="polite">
        <span className="font-mono text-xs text-foreground">{show.title}</span>
        <p className="mt-1">{show.line}</p>
        <p className="mt-1" style={{ fontFamily: MONO, fontSize: 12 }}>{show.snippet}</p>
      </div>
    </Frame>
  )
}
