"use client"

import { useState } from "react"

// Table 1 of the paper as a diagram: which gradient reaches the shared output
// head W and which reaches the MTP heads and the trunk, for each objective.
// The measured line under the diagram is our float32 check on a small model
// (see the article): gradient of the trunk and heads against explicit KL,
// and of W against plain MTP.

type Mode = "mtp" | "kl" | "soft"
const MODES: { id: Mode; label: string; head: "CE" | "KL"; trunk: "CE" | "KL"; line: string }[] = [
  { id: "mtp", label: "standard MTP", head: "CE", trunk: "CE", line: "Cross-entropy everywhere. The trunk gets the KL part plus the noisy residual." },
  { id: "kl", label: "KL-MTP", head: "KL", trunk: "KL", line: "Explicit KL against the NTP distribution. Builds teacher and student softmaxes over the vocabulary." },
  { id: "soft", label: "Soft-MTP", head: "CE", trunk: "KL", line: "Cross-entropy at the head, KL gradient into the MTP heads and trunk, by routing the NTP hidden's gradient." },
]

const COL = { CE: "oklch(0.58 0.17 30)", KL: "oklch(0.58 0.15 250)" }

export function GradientRouting() {
  const [mode, setMode] = useState<Mode>("soft")
  const m = MODES.find((x) => x.id === mode) as (typeof MODES)[number]
  const headC = COL[m.head]
  const trunkC = COL[m.trunk]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5" role="tablist" aria-label="Objective">
        {MODES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={mode === x.id}
            onClick={() => setMode(x.id)}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs focus-visible:outline focus-visible:outline-2 ${mode === x.id ? "bg-muted/60" : "hover:bg-muted/30"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 520 300" role="img" className="h-auto w-full">
          <title>
            {`Gradient routing under ${m.label}: the output head W receives the ${m.head} gradient; the MTP heads and shared trunk receive the ${m.trunk} gradient.`}
          </title>
          <defs>
            <marker id="arrow-ce" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill={COL.CE} />
            </marker>
            <marker id="arrow-kl" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L8 4 L0 8 z" fill={COL.KL} />
            </marker>
          </defs>

          {/* boxes */}
          {[
            { x: 90, y: 14, w: 340, h: 40, t: "shared output head W (LM head)" },
            { x: 40, y: 110, w: 150, h: 38, t: "NTP hidden  h⁰" },
            { x: 330, y: 110, w: 150, h: 38, t: "MTP hiddens  h¹ … hᴷ" },
            { x: 330, y: 190, w: 150, h: 38, t: "MTP heads" },
            { x: 40, y: 250, w: 440, h: 38, t: "shared trunk" },
          ].map((b) => (
            <g key={b.t}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="currentColor" fillOpacity={0.04} stroke="currentColor" strokeOpacity={0.4} />
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize={12} fontFamily="ui-monospace, monospace" fill="currentColor">
                {b.t}
              </text>
            </g>
          ))}

          {/* gradient into W from both hidden groups */}
          <line x1={115} y1={110} x2={150} y2={56} stroke={COL.CE} strokeWidth={2} markerEnd="url(#arrow-ce)" />
          <line x1={405} y1={110} x2={370} y2={56} stroke={headC} strokeWidth={2} markerEnd={`url(#arrow-${m.head.toLowerCase()})`} />
          <text x={470} y={34} fontSize={11} fontFamily="ui-monospace, monospace" fill={headC}>{`into W: ${m.head}`}</text>

          {/* gradient from MTP hiddens down through the heads to the trunk */}
          <line x1={405} y1={150} x2={405} y2={188} stroke={trunkC} strokeWidth={2} markerEnd={`url(#arrow-${m.trunk.toLowerCase()})`} />
          <line x1={405} y1={230} x2={405} y2={248} stroke={trunkC} strokeWidth={2} markerEnd={`url(#arrow-${m.trunk.toLowerCase()})`} />
          <text x={418} y={171} fontSize={11} fontFamily="ui-monospace, monospace" fill={trunkC}>{m.trunk}</text>

          {/* NTP path: always CE */}
          <line x1={115} y1={150} x2={115} y2={248} stroke={COL.CE} strokeWidth={2} markerEnd="url(#arrow-ce)" />
          <text x={128} y={200} fontSize={11} fontFamily="ui-monospace, monospace" fill={COL.CE}>NTP: CE (unchanged)</text>

          {mode === "soft" && (
            <>
              <path d="M190 130 C 250 130, 270 130, 328 130" stroke={COL.KL} strokeWidth={2} fill="none" strokeDasharray="5 4" markerEnd="url(#arrow-kl)" />
              <text x={196} y={122} fontSize={10} fontFamily="ui-monospace, monospace" fill={COL.KL}>straight-through</text>
              <text x={196} y={145} fontSize={10} fontFamily="ui-monospace, monospace" fill={COL.KL}>h⁰ += sg(hᵏ) − hᵏ</text>
            </>
          )}
        </svg>
        <p className="mt-1 text-sm leading-snug">{m.line}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">gradient into W</dt>
            <dd className="mt-0.5 text-sm" style={{ color: headC }}>{m.head}</dd>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">into MTP heads and trunk</dt>
            <dd className="mt-0.5 text-sm" style={{ color: trunkC }}>{m.trunk}</dd>
          </div>
          <div className="rounded-lg border px-2.5 py-1.5">
            <dt className="text-muted-foreground">vocabulary-sized extras</dt>
            <dd className="mt-0.5 text-sm">{mode === "kl" ? "teacher + student softmax" : "none"}</dd>
          </div>
        </dl>
      </div>
    </figure>
  )
}
