"use client"

import { useState } from "react"

// Adaptive Frame Resolution — the streaming trick, drawn as a timeline. Routine
// moments are perceived under a low 224²-pixel quota (few tokens); once a Standby
// cue fires, the window that follows is enlarged to a 448² quota (4× the tokens) so
// the critical event is seen in detail. Click a frame to promote it to high-res;
// the frame just before a high-res run is flagged Standby. The readout compares the
// adaptive token budget against processing every frame at 448². Illustrative token
// math (low=64, high=256 tokens/frame); the 224²/448² quotas are the paper's.

const HIGH = "oklch(0.58 0.14 158)" // 448² · critical
const STANDBY = "oklch(0.74 0.14 78)" // the cue frame
const LO_TOK = 64
const HI_TOK = 256
const N = 12

const W = 760
const H = 300
const MX = 40

type Preset = "low" | "adaptive" | "high"

export function AdaptiveResolution() {
  // default: an event burst in the middle
  const [high, setHigh] = useState<boolean[]>(() =>
    Array.from({ length: N }, (_, i) => i === 5 || i === 6 || i === 7)
  )

  const toggle = (i: number) =>
    setHigh((prev) => prev.map((v, j) => (j === i ? !v : v)))

  const applyPreset = (p: Preset) => {
    if (p === "low") setHigh(Array.from({ length: N }, () => false))
    else if (p === "high") setHigh(Array.from({ length: N }, () => true))
    else setHigh(Array.from({ length: N }, (_, i) => i === 5 || i === 6 || i === 7))
  }

  const nHigh = high.filter(Boolean).length
  const adaptiveTok = high.reduce((s, h) => s + (h ? HI_TOK : LO_TOK), 0)
  const allHighTok = N * HI_TOK
  const savedPct = Math.round((1 - adaptiveTok / allHighTok) * 100)

  const slot = (W - 2 * MX) / N
  const cx = (i: number) => MX + slot * (i + 0.5)
  const baseY = 196 // frame bottoms sit here
  const loH = 20
  const hiH = 34
  const loW = 24
  const hiW = 32

  // state per frame: Response (high), Standby (low frame just before a high run), Silence
  const stateOf = (i: number): "response" | "standby" | "silence" => {
    if (high[i]) return "response"
    if (i + 1 < N && high[i + 1]) return "standby"
    return "silence"
  }

  // readout bar geometry (SVG chart, scaled to all-high baseline)
  const rbX = MX
  const rbW = W - 2 * MX
  const rbTop = 236
  const rowH = 16

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>adaptive frame resolution · 224² routine, 448² on the event</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Timeline of ${N} streamed frames; ${nHigh} promoted to 448-squared high resolution, the rest at 224-squared. Adaptive budget ${adaptiveTok} tokens versus ${allHighTok} if every frame were high resolution, ${savedPct} percent fewer.`}
        >
          <defs>
            <filter id="afr-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            live stream · click a frame to raise it to 448² →
          </text>

          {/* timeline axis */}
          <line x1={MX} y1={baseY + 6} x2={W - MX} y2={baseY + 6} stroke="var(--border)" strokeWidth={1.5} />

          {Array.from({ length: N }, (_, i) => {
            const st = stateOf(i)
            const isHigh = high[i]
            const w = isHigh ? hiW : loW
            const h = isHigh ? hiH : loH
            const x = cx(i) - w / 2
            const y = baseY - h
            const fill = isHigh ? HIGH : "var(--muted)"
            const op = isHigh ? 0.9 : 0.45
            const stroke = st === "standby" ? STANDBY : isHigh ? HIGH : "transparent"
            return (
              <g key={i} className="cursor-pointer" onClick={() => toggle(i)}>
                {/* generous invisible hit target */}
                <rect x={cx(i) - slot / 2} y={40} width={slot} height={baseY - 34} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={5}
                  fill={fill}
                  opacity={op}
                  stroke={stroke}
                  strokeWidth={st === "standby" ? 2 : 1.5}
                  filter={isHigh ? "url(#afr-soft)" : undefined}
                  className="transition-all duration-200"
                />
                <text x={cx(i)} y={baseY - h - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
                  {isHigh ? "448²" : "224²"}
                </text>
                <circle cx={cx(i)} cy={baseY + 6} r={2.5} fill={isHigh ? HIGH : "var(--muted-foreground)"} opacity={isHigh ? 1 : 0.5} />
                <text x={cx(i)} y={baseY + 22} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={7.5}>
                  {st === "response" ? "resp" : st === "standby" ? "standby" : "silence"}
                </text>
              </g>
            )
          })}

          {/* token readout — adaptive vs all-448 baseline, scaled SVG bars */}
          {(() => {
            const track = rbW - 62
            const ratio = adaptiveTok / allHighTok
            const bw = track * ratio
            const inside = ratio > 0.82 // keep the label off the figure edge
            return (
              <>
                <text x={rbX} y={rbTop - 4} className="fill-muted-foreground font-mono" fontSize={9}>
                  adaptive
                </text>
                <rect x={rbX + 62} y={rbTop} width={bw} height={rowH} rx={3} fill={HIGH} opacity={0.85} className="transition-all duration-200" />
                <text
                  x={rbX + 62 + bw + (inside ? -6 : 6)}
                  y={rbTop + 12}
                  textAnchor={inside ? "end" : "start"}
                  className={inside ? "fill-background font-mono" : "fill-foreground font-mono"}
                  fontSize={9}
                >
                  {adaptiveTok.toLocaleString()} tok
                </text>
              </>
            )
          })()}

          <text x={rbX} y={rbTop + rowH + 14} className="fill-muted-foreground font-mono" fontSize={9}>
            all 448²
          </text>
          <rect x={rbX + 62} y={rbTop + rowH + 6} width={rbW - 62} height={rowH} rx={3} fill="var(--muted)" opacity={0.5} />
          <text x={rbX + 62 + 6} y={rbTop + rowH + 6 + 12} className="fill-muted-foreground font-mono" fontSize={9}>
            {allHighTok.toLocaleString()} tok
          </text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">preset</span>
            {(
              [
                ["low", "224² all"],
                ["adaptive", "adaptive"],
                ["high", "448² all"],
              ] as [Preset, string][]
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span style={{ color: HIGH }}>{nHigh}</span>/{N} high-res ·{" "}
            <span style={{ color: HIGH }}>{savedPct}%</span> fewer tokens than all-448²
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Most of a stream is <span className="text-foreground">silence</span> — nothing worth spending pixels on — so
          those frames run at a 224² quota. A <span style={{ color: STANDBY }}>Standby</span> cue says the answer is
          about to appear; the frames that follow jump to 448² (
          <span style={{ color: HIGH }}>4× the tokens</span>) to catch the detail. Spend the budget where the evidence
          is, not uniformly. The failure mode: mark too few frames critical and a fast event is seen only in low-res.
        </p>
      </div>
    </figure>
  )
}
