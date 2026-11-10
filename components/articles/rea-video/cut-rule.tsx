"use client"

import { useState } from "react"
import { BASE, CB, CH, SCORE } from "./trace-data"

// The hard-cut test from rea-video's shots.py, evaluated frame by frame on my
// fair test clip. The signals are what my re-typing of their rules computed on
// 96-px-wide thumbnails; the two conditions below are the rule as written:
//   strong   = score > 0.30 and score > 2.5 * base + 0.06 and changed > 0.25
//   relative = changed > 0.45 and changed > 3 * changedBase + 0.2 and score > 4 * base + 0.03
// Boundaries are what survived the flash checks and the 0.35 s minimum shot length.

const N = SCORE.length
const BOUNDS = [90, 180, 270, 353, 416, 428, 493]
const MARKS: { f: number; label: string }[] = [
  { f: 90, label: "cut" },
  { f: 180, label: "cut" },
  { f: 266, label: "dissolve" },
  { f: 353, label: "cut" },
  { f: 398, label: "flash" },
  { f: 427, label: "dip to black" },
  { f: 494, label: "wipe" },
]
const W = 720
const H = 250
const PADL = 34
const PADR = 10
const TOP = 26
const BOT = 34
const x = (f: number) => PADL + (f / (N - 1)) * (W - PADL - PADR)
const y = (v: number) => TOP + (1 - Math.min(v, 1)) * (H - TOP - BOT)

function path(arr: number[]) {
  let d = ""
  for (let i = 0; i < arr.length; i++) d += `${i ? "L" : "M"}${x(i).toFixed(1)},${y(arr[i]).toFixed(1)}`
  return d
}

const SCORE_D = path(SCORE)
const CH_D = path(CH)
const THR_D = path(BASE.map((b) => Math.max(0.3, 2.5 * b + 0.06)))

export function CutRule() {
  const [f, setF] = useState(416)
  const s = SCORE[f]
  const b = BASE[f]
  const c = CH[f]
  const cb = CB[f]
  const strongParts = [s > 0.3, s > 2.5 * b + 0.06, c > 0.25]
  const relParts = [c > 0.45, c > 3 * cb + 0.2, s > 4 * b + 0.03]
  const strong = strongParts.every(Boolean)
  const relative = relParts.every(Boolean)
  const kept = BOUNDS.includes(f)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the hard-cut rule, frame by frame</span>
        <span className="text-muted-foreground/50">measured · fair clip, 575 frames</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Per-frame cut score, its adaptive threshold and the changed share of the frame across the fair test clip. Spikes rise above the threshold at the three hard cuts, at the end of the dissolve and twice inside the dip to black; the pans stay below it."
        >
          {MARKS.map((m) => (
            <g key={m.label + m.f}>
              <line x1={x(m.f)} x2={x(m.f)} y1={TOP - 6} y2={H - BOT} stroke="var(--muted-foreground)" strokeOpacity={0.18} />
              <text x={x(m.f)} y={TOP - 10} textAnchor="middle" fontSize={9} className="font-mono" fill="var(--muted-foreground)">
                {m.label}
              </text>
            </g>
          ))}
          <path d={CH_D} fill="none" stroke="oklch(0.72 0.15 70)" strokeWidth={1} opacity={0.7} />
          <path d={THR_D} fill="none" stroke="oklch(0.62 0.2 25)" strokeWidth={1.2} strokeDasharray="4 3" />
          <path d={SCORE_D} fill="none" stroke="currentColor" strokeWidth={1.4} />
          {BOUNDS.map((bf) => (
            <circle key={bf} cx={x(bf)} cy={y(SCORE[bf])} r={3.5} fill="oklch(0.6 0.15 150)" />
          ))}
          <line x1={x(f)} x2={x(f)} y1={TOP} y2={H - BOT} stroke="currentColor" strokeOpacity={0.6} />
          <line x1={PADL} x2={W - PADR} y1={H - BOT} y2={H - BOT} stroke="var(--muted-foreground)" strokeOpacity={0.5} />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <text key={t} x={PADL - 4} y={y(t) + 3} textAnchor="end" fontSize={9} className="font-mono" fill="var(--muted-foreground)">
              {t}
            </text>
          ))}
          {[0, 3, 6, 9, 12, 15, 18].map((t) => (
            <text key={t} x={x(t * 30)} y={H - BOT + 14} textAnchor="middle" fontSize={10} className="font-mono" fill="var(--muted-foreground)">
              {t} s
            </text>
          ))}
          <text x={PADL} y={H - 4} fontSize={10} className="font-mono" fill="var(--muted-foreground)">
            black: score · red dashed: max(0.30, 2.5 × local median + 0.06) · amber: share of pixels changed · green: kept boundary
          </text>
        </svg>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span className="text-muted-foreground">
            frame <span className="text-foreground">{f}</span> ({(f / 30).toFixed(2)} s)
          </span>
          <input type="range" min={1} max={N - 1} value={f} onChange={(e) => setF(Number(e.target.value))} aria-label="frame" />
        </label>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <Cell k="score" v={s.toFixed(3)} />
          <Cell k="local median" v={b.toFixed(3)} />
          <Cell k="changed share" v={c.toFixed(3)} />
          <Cell k="this frame" v={kept ? "kept boundary" : strong || relative ? "fires, merged or dropped" : "no cut"} />
        </div>
        <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
          <Rule name="strong" parts={["score > 0.30", "score > 2.5 × median + 0.06", "changed > 0.25"]} ok={strongParts} />
          <Rule name="relative" parts={["changed > 0.45", "changed > 3 × its median + 0.2", "score > 4 × median + 0.03"]} ok={relParts} />
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground">
          Drag to frame 300, inside a 10 px-per-frame pan: 52 % of the thumbnail&apos;s pixels change, but the colour histogram barely moves, so the score (0.076) sits on its local median and nothing fires. Drag to 398: the flash fires both tests and is thrown out by the flash check, because two frames later the picture is back. Drag to 414-418: the colour bars fall through the four brightness bins of the histogram in five frames, and the score jumps as if a new shot had started.
        </p>
      </div>
    </figure>
  )
}

function Rule({ name, parts, ok }: { name: string; parts: string[]; ok: boolean[] }) {
  const all = ok.every(Boolean)
  return (
    <div className={`rounded-md border px-3 py-2 ${all ? "border-[oklch(0.6_0.15_150)]" : ""}`}>
      <div className="text-muted-foreground">
        {name}: <span className="text-foreground">{all ? "fires" : "no"}</span>
      </div>
      <ul className="mt-1 space-y-0.5">
        {parts.map((p, i) => (
          <li key={p} className={ok[i] ? "text-foreground" : "text-muted-foreground/60"}>
            {ok[i] ? "✓" : "·"} {p}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground">{k}</div>
      <div className="mt-0.5 text-base">{v}</div>
    </div>
  )
}
