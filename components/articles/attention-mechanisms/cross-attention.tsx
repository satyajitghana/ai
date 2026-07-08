"use client"

import { useState } from "react"

import { ATT, FigureCard, GLOBAL, Legend, LOCAL, Segmented } from "./shared"

// Self vs cross attention, as two token strips. In self-attention a target query
// reads the target sequence (causally, in a decoder). In cross-attention the same
// query reads a DIFFERENT sequence — the encoder's keys and values — with no mask,
// because the whole source is already known. This is the encoder→decoder bridge in
// translation and the image→text bridge in multimodal models. Deterministic weights.

const SRC = ["Le", "chat", "noir", "dort", "ici", "."]
const TGT = ["The", "black", "cat", "sleeps", "here", "."]

function softmax(xs: number[]) {
  const m = Math.max(...xs)
  const ex = xs.map((x) => Math.exp(x - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / s)
}
// deterministic alignment score between target position i and a source position j
function align(i: number, j: number) {
  return 3.0 * Math.exp(-0.5 * ((i - j) * 0.9) ** 2) + 0.4 * Math.sin(i + j)
}

type Mode = "cross" | "self"

const W = 720
const H = 250
const MX = 44
const chipW = 88
const gap = (W - 2 * MX - chipW) / (SRC.length - 1)
const sx = (j: number) => MX + j * gap
const SRC_Y = 46
const TGT_Y = 168
const CH = 34

export function CrossAttention() {
  const [mode, setMode] = useState<Mode>("cross")
  const [qt, setQt] = useState(3)

  const targets = mode === "cross" ? SRC : TGT // what the query reads
  const readable =
    mode === "cross"
      ? targets.map((_, j) => j) // all source tokens
      : targets.map((_, j) => j).filter((j) => j <= qt) // causal self
  const scores = readable.map((j) => (mode === "cross" ? align(qt, j) : align(qt, j) + (j === qt ? 1.5 : 0)))
  const weights = softmax(scores)
  const wOf = (j: number) => {
    const idx = readable.indexOf(j)
    return idx === -1 ? 0 : weights[idx]
  }
  const topRowY = mode === "cross" ? SRC_Y : SRC_Y // read-from row is always the top strip
  const readFrom = mode === "cross" ? SRC : TGT

  return (
    <FigureCard label="self vs cross attention · two sequences">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`${mode} attention. The target query "${TGT[qt]}" reads ${mode === "cross" ? "all source tokens" : `${readable.length} earlier target tokens`}.`}
      >
        <defs>
          <filter id="xa-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
          </filter>
          <marker id="xa-arr" viewBox="0 -5 10 10" markerWidth="6.5" markerHeight="6.5" orient="auto" refX="6.5" refY="0">
            <path d="M0,-4L6,0L0,4" fill="none" stroke={ATT} strokeWidth={1.5} />
          </marker>
        </defs>

        <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
          {mode === "cross" ? "encoder · source (keys / values)" : "target sequence (keys / values)"}
        </text>
        <text x={MX} y={TGT_Y + CH + 22} className="fill-muted-foreground font-mono" fontSize={11}>
          decoder · target (queries)
        </text>

        {/* connectors: active query → readable keys, weighted */}
        {readFrom.map((_, j) => {
          if (wOf(j) === 0) return null
          const x1 = sx(qt) + chipW / 2
          const y1 = TGT_Y
          const x2 = sx(j) + chipW / 2
          const y2 = topRowY + CH
          const my = (y1 + y2) / 2
          const w = wOf(j)
          return (
            <path
              key={j}
              d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
              fill="none"
              stroke={mode === "cross" ? ATT : LOCAL}
              strokeWidth={1 + w * 5}
              opacity={0.25 + 0.6 * w}
              markerEnd="url(#xa-arr)"
            />
          )
        })}

        {/* read-from strip (top) */}
        {readFrom.map((tok, j) => {
          const w = wOf(j)
          const lit = w > 0.001
          return (
            <g key={j}>
              <rect
                x={sx(j)}
                y={topRowY}
                width={chipW}
                height={CH}
                rx={6}
                fill={lit ? (mode === "cross" ? ATT : LOCAL) : "var(--muted)"}
                opacity={lit ? 0.2 + 0.7 * (w / Math.max(...weights)) : 0.35}
                stroke={lit ? (mode === "cross" ? ATT : LOCAL) : "transparent"}
                strokeWidth={1.2}
                className="transition-all duration-300"
              />
              <text x={sx(j) + chipW / 2} y={topRowY + CH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fill={lit ? "var(--foreground)" : "var(--muted-foreground)"}>
                {tok}
              </text>
            </g>
          )
        })}

        {/* target strip (bottom) with the active query highlighted */}
        {TGT.map((tok, j) => {
          const active = j === qt
          return (
            <g key={j}>
              <rect
                x={sx(j)}
                y={TGT_Y}
                width={chipW}
                height={CH}
                rx={6}
                fill={active ? GLOBAL : "var(--background)"}
                opacity={active ? 0.95 : 1}
                stroke={active ? GLOBAL : "var(--border)"}
                strokeWidth={active ? 1.8 : 1}
                filter={active ? "url(#xa-soft)" : undefined}
                className="transition-all duration-300"
              />
              <text x={sx(j) + chipW / 2} y={TGT_Y + CH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={active ? 600 : 400} fill={active ? "var(--background)" : "var(--muted-foreground)"}>
                {tok}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">mode</span>
          <Segmented
            value={mode}
            color={mode === "cross" ? ATT : LOCAL}
            onChange={setMode}
            options={[
              { id: "cross", label: "cross (read source)" },
              { id: "self", label: "self (causal)" },
            ]}
          />
        </div>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>target query</span>
            <span className="tabular-nums text-foreground">{TGT[qt]}</span>
          </span>
          <input
            type="range"
            min={0}
            max={TGT.length - 1}
            value={qt}
            onChange={(e) => setQt(Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: GLOBAL }}
          />
        </label>
        <div className="ml-auto font-mono text-[10px] text-muted-foreground">
          reads <span className="text-foreground">{readable.length}</span>{" "}
          {mode === "cross" ? "source" : "past target"} tokens
        </div>
      </div>

      <Legend
        items={[
          { color: GLOBAL, label: "active query" },
          { color: ATT, label: "cross: read source" },
          { color: LOCAL, label: "self: read past target" },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Same query, two different things to read. In <span style={{ color: LOCAL }}>self-attention</span> the decoder
        token attends the target sequence it is building — causally, so it never sees the future. In{" "}
        <span style={{ color: ATT }}>cross-attention</span> the query comes from the decoder but the keys and values come
        from the <em>encoder's</em> output, with no causal mask: the whole source is already known. It is the join
        between two sequences — French→English here, or image patches→caption in a vision-language model.
      </p>
    </FigureCard>
  )
}
