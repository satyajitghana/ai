"use client"

import { useState } from "react"

import { PARTS, fmtBytes, part } from "./data"

// The omni pipeline as the GGUF files lay it out. Click a stage: params and
// bytes are read from the safetensors headers and the GGUF tensor tables.

type Stage = {
  id: string
  col: 0 | 1 | 2
  row: number
  title: string
  partId?: string
  note: string
  rate: string
}

const STAGES: Stage[] = [
  { id: "mic", col: 0, row: 0, title: "16 kHz audio -> log-mel", note: "128 mel bins, 400-sample window, hop 160: 100 frames a second, no weights.", rate: "100 frames/s" },
  { id: "aenc", col: 0, row: 1, title: "speech encoder", partId: "aenc", note: "17 layers, hidden 768; three stride-2 convolutions turn 8 mel frames into one vector.", rate: "12.5 tokens/s" },
  { id: "vis", col: 1, row: 1, title: "vision tower", partId: "vis", note: "14 layers, hidden 1,024, patch 16; every 2x2 block of patches becomes one language token.", rate: "per image" },
  { id: "embd", col: 2, row: 1, title: "text embedding", partId: "embd", note: "128,000-token vocabulary, 2,048 wide. The same table is the LM head.", rate: "per token" },
  { id: "blk", col: 1, row: 2, title: "backbone", partId: "blk", note: "24 layers: 13 short-conv, 6 full-attention, 5 sliding-window (256). One stream carries audio, image and text positions.", rate: "1 step per position" },
  { id: "head", col: 2, row: 3, title: "text head", partId: "embd", note: "Greedy argmax over 128,000 rows. Reads the whole Q6_K table every text token.", rate: "text tokens" },
  { id: "depth", col: 0, row: 3, title: "depth decoder", partId: "depth", note: "3 layers, hidden 1,024, bidirectional. Fills 12 codebooks of a frame in 3 passes of 4.", rate: "12.5 frames/s" },
  { id: "codec", col: 0, row: 4, title: "codec decoder + iSTFT", partId: "codec", note: "1,920 samples per frame at 24 kHz, window of 30 frames of context.", rate: "24 kHz out" },
]

const X = [40, 250, 460]
const Y = [20, 92, 164, 236, 308]
const W = 170
const H = 52

export function OmniPipeline() {
  const [sel, setSel] = useState("blk")
  const s = STAGES.find((x) => x.id === sel)!
  const p = s.partId ? part(s.partId) : null
  const total = PARTS.reduce((a, b) => a + b.bytes, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        click a stage: what it holds in the files the Space downloads ({fmtBytes(total)} of tensors)
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1.4fr_1fr] sm:p-4">
        <svg viewBox="0 0 680 380" role="img" aria-label="LFM3-Omni pipeline: speech, image and text encoders feed one backbone; a text head and a depth decoder with codec decoder come out" className="w-full">
          <defs>
            <marker id="omni-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0L8 4L0 8z" fill="currentColor" className="text-muted-foreground" />
            </marker>
          </defs>
          {/* flows */}
          {[
            ["mic", "aenc"],
            ["aenc", "blk"],
            ["vis", "blk"],
            ["embd", "blk"],
            ["blk", "head"],
            ["blk", "depth"],
            ["depth", "codec"],
          ].map(([a, b]) => {
            const A = STAGES.find((x) => x.id === a)!
            const B = STAGES.find((x) => x.id === b)!
            const ax = X[A.col] + W / 2
            const bx = X[B.col] + W / 2
            const ay = Y[A.row] + (B.row > A.row ? H : 0)
            const by = Y[B.row] + (B.row > A.row ? 0 : H)
            return (
              <path
                key={a + b}
                d={`M${ax} ${ay} C ${ax} ${(ay + by) / 2}, ${bx} ${(ay + by) / 2}, ${bx} ${by}`}
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground"
                strokeWidth={1.2}
                markerEnd="url(#omni-arrow)"
              />
            )
          })}
          {STAGES.map((st) => {
            const on = st.id === sel
            return (
              <g key={st.id} onClick={() => setSel(st.id)} style={{ cursor: "pointer" }} tabIndex={0} role="button" aria-label={st.title} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(st.id)}>
                <rect
                  x={X[st.col]}
                  y={Y[st.row]}
                  width={W}
                  height={H}
                  rx={8}
                  fill={on ? "oklch(0.72 0.15 195 / 0.25)" : "transparent"}
                  stroke={on ? "oklch(0.72 0.15 195)" : "currentColor"}
                  className={on ? "" : "text-muted-foreground"}
                  strokeWidth={on ? 2 : 1}
                />
                <text x={X[st.col] + W / 2} y={Y[st.row] + 22} textAnchor="middle" fontSize={12} fill="currentColor" fontFamily="ui-monospace, monospace">
                  {st.title}
                </text>
                <text x={X[st.col] + W / 2} y={Y[st.row] + 40} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6} fontFamily="ui-monospace, monospace">
                  {st.partId ? fmtBytes(part(st.partId).bytes) : "no weights"}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="space-y-2 font-mono text-xs">
          <div className="text-sm text-foreground">{s.title}</div>
          <p className="text-muted-foreground">{s.note}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">rate</dt>
            <dd>{s.rate}</dd>
            {p && (
              <>
                <dt className="text-muted-foreground">params</dt>
                <dd className="tabular-nums">{p.params.toLocaleString("en-US")}</dd>
                <dt className="text-muted-foreground">bytes</dt>
                <dd className="tabular-nums">
                  {p.bytes.toLocaleString("en-US")} ({p.fmt})
                </dd>
                <dt className="text-muted-foreground">bits/weight</dt>
                <dd className="tabular-nums">{((p.bytes * 8) / p.params).toFixed(2)}</dd>
                <dt className="text-muted-foreground">file</dt>
                <dd className="break-all">{p.file}</dd>
              </>
            )}
          </dl>
        </div>
      </div>
    </figure>
  )
}
