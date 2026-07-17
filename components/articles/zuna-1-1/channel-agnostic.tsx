"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// ZUNA 1.1 is channel-agnostic: every electrode is just a token carrying a 4D
// rotary position (x, y, z, t) — its 3D scalp coordinate plus a coarse time
// index. So the SAME weights read a 4-electrode headband or a 256-channel cap,
// and can fill in electrodes that were dropped or never recorded. Top-down head
// (nose up); switch montage, drop a region, watch the decoder reconstruct it
// from spatial neighbours. Click an electrode to read its 4D coordinate.
// Illustrative — positions are schematic 10-20, not exact coordinates.

const ACCENT = "oklch(0.66 0.17 45)"

type El = { id: string; x: number; y: number } // x,y in [-1,1]; nose up (y<0 = front)

const CLINICAL: El[] = [
  { id: "Fp1", x: -0.27, y: -0.8 }, { id: "Fp2", x: 0.27, y: -0.8 },
  { id: "F7", x: -0.68, y: -0.44 }, { id: "F3", x: -0.36, y: -0.42 }, { id: "Fz", x: 0, y: -0.4 }, { id: "F4", x: 0.36, y: -0.42 }, { id: "F8", x: 0.68, y: -0.44 },
  { id: "T7", x: -0.85, y: 0 }, { id: "C3", x: -0.43, y: 0 }, { id: "Cz", x: 0, y: 0 }, { id: "C4", x: 0.43, y: 0 }, { id: "T8", x: 0.85, y: 0 },
  { id: "P7", x: -0.68, y: 0.44 }, { id: "P3", x: -0.36, y: 0.42 }, { id: "Pz", x: 0, y: 0.4 }, { id: "P4", x: 0.36, y: 0.42 }, { id: "P8", x: 0.68, y: 0.44 },
  { id: "O1", x: -0.27, y: 0.8 }, { id: "O2", x: 0.27, y: 0.8 },
]

const HEADBAND: El[] = [
  { id: "TP9", x: -0.82, y: 0.3 }, { id: "AF7", x: -0.45, y: -0.72 },
  { id: "AF8", x: 0.45, y: -0.72 }, { id: "TP10", x: 0.82, y: 0.3 },
]

// dense research cap laid out on concentric rings inside the head disc
function hdCap(): El[] {
  const rings: [number, number][] = [[0, 1], [0.32, 8], [0.58, 14], [0.8, 18], [0.97, 23]]
  const out: El[] = []
  let n = 0
  for (const [r, count] of rings) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i / count) * Math.PI * 2
      out.push({ id: `e${n++}`, x: +(r * Math.cos(a)).toFixed(3), y: +(r * Math.sin(a)).toFixed(3) })
    }
  }
  return out
}
const HD = hdCap()

const MONTAGES: Record<string, { label: string; els: El[]; small: boolean }> = {
  headband: { label: "4-ch headband", els: HEADBAND, small: false },
  clinical: { label: "10-20 (19-ch)", els: CLINICAL, small: false },
  hd: { label: `${HD.length}-ch cap`, els: HD, small: true },
}

type Stage = "recorded" | "dropped" | "reconstructed"

// scene geometry (viewBox units)
const W = 520
const H = 320
const CX = 260
const CY = 150
const R = 122
const REL = R * 0.86

const dropped = (e: El) => e.x > 0.55 && Math.abs(e.y) < 0.62

export function ChannelAgnostic() {
  const [montage, setMontage] = useState<keyof typeof MONTAGES>("clinical")
  const [stage, setStage] = useState<Stage>("reconstructed")
  const [t, setT] = useState(3)
  const [sel, setSel] = useState("Cz")

  const { els, label, small } = MONTAGES[montage]
  const drop = new Set(els.filter(dropped).map((e) => e.id))
  const kept = els.filter((e) => !drop.has(e.id))
  const selEl = els.find((e) => e.id === sel) ?? els[0]
  const sx = (e: El) => CX + e.x * REL
  const sy = (e: El) => CY + e.y * REL
  const z = (e: El) => Math.sqrt(Math.max(0, 1 - e.x * e.x - e.y * e.y))
  const rad = small ? 5 : 9

  // two nearest kept neighbours for each dropped electrode → reconstruction links
  const links: { from: El; to: El }[] = []
  if (stage === "reconstructed") {
    for (const d of els.filter((e) => drop.has(e.id))) {
      const near = [...kept]
        .sort((a, b) => Math.hypot(a.x - d.x, a.y - d.y) - Math.hypot(b.x - d.x, b.y - d.y))
        .slice(0, 2)
      for (const k of near) links.push({ from: k, to: d })
    }
  }

  const bow = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy) || 1
    const bx = mx + (-dy / len) * len * 0.16
    const by = my + (dx / len) * len * 0.16
    return `M ${x1} ${y1} Q ${bx} ${by} ${x2} ${y2}`
  }

  const nDrop = drop.size

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>channel-agnostic · one model, any montage</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Top-down scalp with the ${label} montage; ${nDrop} electrodes ${stage === "reconstructed" ? "reconstructed by the model" : stage}.`}>
          <defs>
            <marker id="za-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="za-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          <text x={20} y={26} className="fill-muted-foreground font-mono" fontSize={11}>nose up · top-down scalp</text>

          {/* head outline: nose, ears, skull */}
          <path d={`M ${CX - 13} ${CY - R + 3} L ${CX} ${CY - R - 15} L ${CX + 13} ${CY - R + 3} Z`} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <ellipse cx={CX - R} cy={CY} rx={9} ry={17} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <ellipse cx={CX + R} cy={CY} rx={9} ry={17} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} />
          <circle cx={CX} cy={CY} r={R} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} />

          {/* reconstruction links (behind nodes) */}
          {links.map((l, i) => (
            <path key={i} d={bow(sx(l.from), sy(l.from), sx(l.to), sy(l.to))} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#za-arrow)" opacity={0.7} />
          ))}

          {/* electrodes */}
          {els.map((e) => {
            const isDrop = drop.has(e.id)
            const isSel = e.id === selEl.id
            let fill = ACCENT, op = 0.9, dash: string | undefined, stroke = ACCENT
            if (isDrop && stage === "dropped") { fill = "var(--muted)"; op = 0.55; dash = "3 2"; stroke = "var(--muted-foreground)" }
            else if (isDrop && stage === "reconstructed") { fill = ACCENT; op = 0.9; dash = "3 2" }
            else if (isDrop && stage === "recorded") { fill = ACCENT; op = 0.9 }
            return (
              <g key={e.id} onClick={() => setSel(e.id)} className="cursor-pointer">
                <circle cx={sx(e)} cy={sy(e)} r={isSel ? rad + 2 : rad} fill={fill} fillOpacity={op * 0.25} stroke={stroke} strokeWidth={isSel ? 2.4 : 1.6} strokeDasharray={dash} filter={isSel ? "url(#za-soft)" : undefined} opacity={op} className="transition-all duration-300" />
                {!small && (
                  <text x={sx(e)} y={sy(e) + 2.6} textAnchor="middle" className="fill-foreground font-mono" fontSize={7} pointerEvents="none">{e.id}</text>
                )}
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">montage</span>
            {(Object.keys(MONTAGES) as (keyof typeof MONTAGES)[]).map((m) => (
              <button key={m} type="button" onClick={() => setMontage(m)} aria-pressed={montage === m}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", montage === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={montage === m ? { background: ACCENT } : undefined}>
                {MONTAGES[m].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {(["recorded", "dropped", "reconstructed"] as Stage[]).map((s) => (
              <button key={s} type="button" onClick={() => setStage(s)} aria-pressed={stage === s}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="font-mono text-[10px] whitespace-nowrap text-muted-foreground">segment t (0.125s each)</span>
          <input type="range" min={0} max={15} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.66_0.17_45)]" />
          <span className="w-10 shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">t={t}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            selected <span className="text-foreground">{selEl.id}</span> · (x, y, z, t) = ({selEl.x.toFixed(2).replace("-", "−")}, {selEl.y.toFixed(2).replace("-", "−")}, {z(selEl).toFixed(2)}, {t})
          </span>
          <span>
            {els.length} electrodes · <span style={{ color: ACCENT }}>{nDrop}</span> {stage === "reconstructed" ? "reconstructed" : "in the dropped region"}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The <span className="text-foreground">same weights</span> read every montage — a 4-electrode headband up to a
          256-channel cap — because an electrode is just a token at position (x, y, z, t): its 3D scalp coordinate plus a
          coarse time index, fed to attention as a <span style={{ color: ACCENT }}>4D rotary encoding</span>. Nothing in the
          model is tied to a fixed channel list. Drop a region and the decoder fills those coordinates from the electrodes it
          still has; ask for coordinates that were never recorded and it upsamples to them the same way.
        </p>
      </div>
    </figure>
  )
}
