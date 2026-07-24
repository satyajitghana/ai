"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// FLUX 3's pitch is one backbone that jointly learns from images, video, audio and
// action — not four models stitched together. Mechanically that means one attention
// operation over a single sequence that concatenates every modality's tokens (the
// MMDiT lineage). A query token can attend ACROSS modalities: an audio token to the
// video frame that caused the sound, a video token to the text that describes it.
// Pick the query's modality and flip "per-modality" vs "joint": in joint mode the
// curved arrows fan across every lane; in per-modality mode they stay in one lane.
// Weights are a deterministic illustrative function, not real attention scores.

const ACCENT = "oklch(0.60 0.14 160)"
const LOCAL = "oklch(0.70 0.15 62)"

const W = 760
const H = 300

const LANES = [
  { name: "Text", n: 3 },
  { name: "Image", n: 6 },
  { name: "Video", n: 6 },
  { name: "Audio", n: 4 },
]

const MX = 44
const BW = 26
const GAP = 6
const LANE_GAP = 28
const BY = 74 // token row top
const BH = 30
const QY = 232
const QH = 44

// precompute token layout (deterministic)
type Tok = { g: number; lane: number; x: number }
const TOKENS: Tok[] = (() => {
  const out: Tok[] = []
  let x = MX
  let g = 0
  LANES.forEach((lane, li) => {
    for (let i = 0; i < lane.n; i++) {
      out.push({ g, lane: li, x })
      x += BW + GAP
      g += 1
    }
    x += LANE_GAP - GAP
  })
  return out
})()
const N = TOKENS.length
const laneCenter = LANES.map((_, li) => {
  const xs = TOKENS.filter((t) => t.lane === li).map((t) => t.x + BW / 2)
  return xs.reduce((a, b) => a + b, 0) / xs.length
})

const r2 = (n: number) => Number(n.toFixed(2))

function weight(qm: number, g: number): number {
  const w = (Math.sin(g * 1.3 + qm * 2) * 0.5 + Math.cos(g * 0.7 + qm * 1.1) * 0.5 + 1) / 2
  return w
}

export function JointAttention() {
  const [qm, setQm] = useState(3) // query modality lane index (default: Audio)
  const [joint, setJoint] = useState(true)

  const raw = TOKENS.map((tk) => {
    const w = weight(qm, tk.g)
    return joint || tk.lane === qm ? w : 0
  })
  const maxW = Math.max(...raw, 1e-6)
  const norm = raw.map((w) => w / maxW)
  const attended = TOKENS.filter((_, g) => norm[g] >= 0.5)
  const crossCount = attended.filter((t) => t.lane !== qm).length
  const crossShare = attended.length ? Math.round((100 * crossCount) / attended.length) : 0

  const qx = W / 2
  const curve = (x2: number, y2: number) => {
    const x1 = qx
    const y1 = QY
    const my = (y1 + y2) / 2
    return `M ${r2(x1)} ${r2(y1)} C ${r2(x1)} ${r2(my)}, ${r2(x2)} ${r2(my)}, ${r2(x2)} ${r2(y2)}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>joint attention · one sequence, every modality</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${LANES[qm].name} query token attending to ${attended.length} of ${N} tokens across text, image, video and audio lanes; ${crossShare}% of the attended tokens are in other modalities`}
        >
          <defs>
            <marker id="ja-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="ja-arrow-local" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={LOCAL} strokeWidth={1.5} />
            </marker>
            <filter id="ja-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* lane labels */}
          {LANES.map((lane, li) => (
            <text
              key={lane.name}
              x={r2(laneCenter[li])}
              y={58}
              textAnchor="middle"
              className={li === qm ? "font-mono" : "fill-muted-foreground font-mono"}
              fontSize={11}
              fill={li === qm ? LOCAL : undefined}
            >
              {lane.name}
            </text>
          ))}

          {/* connectors (behind nodes) */}
          {TOKENS.map((tk, g) =>
            norm[g] >= 0.5 ? (
              <path
                key={`c-${g}`}
                d={curve(tk.x + BW / 2, BY + BH)}
                fill="none"
                stroke={tk.lane === qm ? LOCAL : ACCENT}
                strokeWidth={1.5}
                markerEnd={`url(#ja-arrow${tk.lane === qm ? "-local" : ""})`}
                opacity={0.35 + 0.5 * Math.min(1, (norm[g] - 0.5) / 0.5)}
              />
            ) : null,
          )}

          {/* token nodes */}
          {TOKENS.map((tk, g) => {
            const local = tk.lane === qm
            const on = norm[g] >= 0.5
            const op = 0.12 + 0.7 * norm[g]
            return (
              <rect
                key={`t-${g}`}
                x={r2(tk.x)}
                y={BY}
                width={BW}
                height={BH}
                rx={5}
                fill={local ? LOCAL : ACCENT}
                opacity={op}
                stroke={on ? (local ? LOCAL : ACCENT) : "transparent"}
                strokeWidth={1.4}
                filter={on ? "url(#ja-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}

          {/* query node */}
          <g>
            <rect x={qx - 96} y={QY} width={192} height={QH} rx={9} fill="var(--background)" stroke={LOCAL} strokeWidth={1.6} filter="url(#ja-soft)" />
            <text x={qx} y={QY + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
              query · {LANES[qm].name} token
            </text>
            <text x={qx} y={QY + 33} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {joint ? "attends across all modalities" : "attends within its modality"}
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">query</span>
            {LANES.map((lane, li) => (
              <button
                key={lane.name}
                type="button"
                onClick={() => setQm(li)}
                aria-pressed={qm === li}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  qm === li ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                style={qm === li ? { background: LOCAL } : undefined}
              >
                {lane.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">attention</span>
            {[
              { k: true, label: "joint" },
              { k: false, label: "per-modality" },
            ].map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => setJoint(m.k)}
                aria-pressed={joint === m.k}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  joint === m.k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            attends <span style={{ color: ACCENT }}>{attended.length}</span> of {N} · cross-modal{" "}
            <span style={{ color: ACCENT }}>{crossShare}%</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every modality is tokenized into <span className="text-foreground">one</span> sequence, and a single
          attention operation lets a query read the whole thing. In{" "}
          <span className="text-foreground">joint</span> mode the{" "}
          <span style={{ color: LOCAL }}>{LANES[qm].name}</span> query fans out across text, image, video and audio;
          switch to <span className="text-foreground">per-modality</span> and it is trapped in its own lane. Joint
          attention is how the sound learns to match the impact and the motion learns to follow the caption — the
          modalities become evidence about one shared reality.
        </p>
      </div>
    </figure>
  )
}
