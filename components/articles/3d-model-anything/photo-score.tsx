"use client"

// How much one photo counts toward "this patch of wall has been photographed
// well", exactly as the iPhone app scores it while you scan.
//
// Source: apps/house-capture/HouseCapture/CoverageEngine.swift,
// `contribution(_:_:_:twoSided:)` and `goodScore`, and CaptureController.swift,
// `sharpness(blurAt1920:)`, `sharpBlur` (1.5 px) and `acceptableBlur` (6 px),
// in github.com/wesbos/3d-model-anything at 31b2dc9. The formula and every
// threshold are copied from those files (MEASURED by reading them). The focal
// length is a slider because the repo ships no real capture: its self-test uses
// 1,000 and 1,400 px for a 1920 x 1440 frame.
//
// SSR-safe: plain state, no effects. Trig goes through lib/dmath.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

const ACCENT = "#d9622b"
const GOOD = 0.8 // CoverageEngine.goodScore: the vertex turns green
const AMBER = 0.35 // band(): red below this, amber up to GOOD
const SHARP = 1.5 // px of motion blur, scaled to a 1920-wide frame
const ACCEPT = 6 // px; blurrier frames are never saved

function sharpness(b: number) {
  return b <= SHARP ? 1 : Math.max(0.4, 1 - ((b - SHARP) / (ACCEPT - SHARP)) * 0.6)
}

type Depth = "clear" | "none" | "blocked"

export function PhotoScore() {
  const [d, setD] = useState(2)
  const [deg, setDeg] = useState(30)
  const [blur, setBlur] = useState(1)
  const [fx, setFx] = useState(1400)
  const [depth, setDepth] = useState<Depth>("clear")

  const cos = mcos((deg * Math.PI) / 180)
  const sin = msin((deg * Math.PI) / 180)
  const reasons: string[] = []
  if (blur > ACCEPT) reasons.push(`blur ${blur.toFixed(1)} px > 6 px: the app never saves this frame`)
  if (d <= 0.25 || d >= 5) reasons.push("depth outside 0.25 to 5 m: contributes 0")
  if (cos <= 0.2) reasons.push("cos(angle) ≤ 0.2 (beyond about 78°): too grazing, contributes 0")
  if (depth === "blocked") reasons.push("the photo's own depth map shows something in front: contributes 0")

  const pxPerCm = (fx * cos) / d / 100
  const res = Math.min(1, pxPerCm / 4)
  const sharp = sharpness(blur)
  const occl = depth === "none" ? 0.9 : 1
  const q = reasons.length ? 0 : res * sharp * occl
  const need = q > 0 ? Math.ceil(GOOD / q - 1e-9) : null
  const band = q >= GOOD ? "green" : q >= AMBER ? "amber" : "red"
  const bandColor = band === "green" ? "#3f8f4f" : band === "amber" ? "#c98a1a" : "#c2413a"

  // top-down sketch: wall on the left, camera at distance d and angle deg off the normal
  const W = 300
  const H = 170
  const wx = 40
  const wy = H / 2
  const scale = 48
  const cx = wx + d * cos * scale
  const cy = wy - d * sin * scale

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one photo, one point on a wall: how much does it count?</span>
        <span className="text-muted-foreground/70">CoverageEngine.swift · formula from the code</span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-[1fr_300px] sm:p-5">
        <div className="space-y-3 text-sm">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              depth along the camera axis: {d.toFixed(2)} m
            </span>
            <Range min={0.3} max={5.5} step={0.05} value={d} accent={ACCENT} onChange={(e) => setD(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              angle off the surface normal: {deg}°
            </span>
            <Range min={0} max={85} step={1} value={deg} accent={ACCENT} onChange={(e) => setDeg(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              predicted motion blur, at 1920 px wide: {blur.toFixed(1)} px
            </span>
            <Range min={0} max={8} step={0.1} value={blur} accent={ACCENT} onChange={(e) => setBlur(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">
              focal length fx: {fx} px (the self-test uses 1,000 and 1,400)
            </span>
            <Range min={900} max={1700} step={50} value={fx} accent={ACCENT} onChange={(e) => setFx(Number(e.target.value))} className="w-full" />
          </label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Depth check">
            {(
              [
                ["clear", "depth map: nothing in front"],
                ["none", "no depth for this photo"],
                ["blocked", "depth map: occluded"],
              ] as const
            ).map(([k, label]) => {
              const on = depth === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDepth(k)}
                  className={
                    "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors " +
                    (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                  }
                  style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border bg-background/60" role="img" aria-label="Top-down sketch of the wall and the camera">
          <line x1={wx} y1={10} x2={wx} y2={H - 10} stroke="currentColor" strokeWidth={3} opacity={0.6} />
          <line x1={wx} y1={wy} x2={wx + 60} y2={wy} stroke="currentColor" strokeDasharray="3 3" opacity={0.4} />
          <text x={wx + 4} y={wy + 14} fontSize={9} fill="currentColor" opacity={0.6}>
            normal
          </text>
          <line x1={wx} y1={wy} x2={cx} y2={cy} stroke={ACCENT} strokeWidth={1.5} />
          <circle cx={wx} cy={wy} r={4} fill={bandColor} />
          <rect x={cx - 7} y={cy - 5} width={14} height={10} rx={2} fill={ACCENT} />
          <text x={Math.min(cx + 10, W - 60)} y={Math.max(cy - 8, 12)} fontSize={10} fill="currentColor">
            {d.toFixed(2)} m
          </text>
          <text x={8} y={H - 6} fontSize={9} fill="currentColor" opacity={0.6}>
            wall
          </text>
        </svg>
      </div>

      <div className="space-y-2 border-t px-4 py-3 font-mono text-[11.5px] sm:px-5">
        <div className="text-muted-foreground">
          px per cm = fx × cos / depth / 100 = {fx} × {cos.toFixed(3)} / {d.toFixed(2)} / 100 ={" "}
          <b className="text-foreground">{pxPerCm.toFixed(2)}</b>
        </div>
        <div className="text-muted-foreground">
          score = min(1, px per cm / 4) × sharpness × depth factor = {res.toFixed(2)} × {sharp.toFixed(2)} × {occl.toFixed(1)} ={" "}
          <b className="text-foreground">{q.toFixed(2)}</b>
        </div>
        <div className="relative h-4 rounded bg-muted/60">
          <div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, q * 100)}%`, background: bandColor }} />
          <div className="absolute inset-y-[-3px] w-px bg-foreground" style={{ left: `${AMBER * 100}%` }} title="amber at 0.35" />
          <div className="absolute inset-y-[-3px] w-px bg-foreground" style={{ left: `${GOOD * 100}%` }} title="green at 0.8" />
        </div>
        {reasons.length ? (
          <ul className="space-y-0.5 text-rose-700 dark:text-rose-400">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="text-foreground">
            One photo like this makes the point <b style={{ color: bandColor }}>{band}</b>. Scores from
            different photos add up (capped at 2), so it takes{" "}
            <b>{need}</b> photo{need === 1 ? "" : "s"} like it to reach the 0.8 green line.
          </p>
        )}
      </div>
    </figure>
  )
}
