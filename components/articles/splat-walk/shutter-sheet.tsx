"use client"

// The film pass in splat-walk's src/post.js, as a timing chart. The sensor is
// read out top to bottom over `readout` seconds (16 ms by default) and each
// row is open for `shutter` seconds (1/80 s). The app hands the shader two
// poses, at t - H and t + H with H = (shutter + readout) / 2, and each pixel
// takes 10 jittered taps at a normalised time f in [-1, 1]:
//
//   rowF = -ndc.y / 2 * readout / H       (top row early, bottom row late)
//   f    = clamp(rowF + s * shutter / H, -1, 1),  s in [-0.5, 0.5)
//
// and moves its ray along a straight line from the frame's centre pose toward
// the pose at t - H (f < 0) or t + H (f > 0). The right panel draws what that
// does to one vertical edge under a steady yaw: shear from the readout, smear
// from the exposure. My numpy re-implementation of the loop measured 30.9 px
// of shear at 1080p for 100.5 deg/s (32.5 predicted) and a smear 27 px wide
// against 30.2 predicted. SSR-safe, plain arithmetic.

import { useState } from "react"

const SHUTTERS = [
  { label: "1/30", s: 1 / 30 },
  { label: "1/60", s: 1 / 60 },
  { label: "1/80", s: 1 / 80 },
  { label: "1/250", s: 1 / 250 },
  { label: "1/1000", s: 1 / 1000 },
]
const F_PX = 1158.0
const DEG = Math.PI / 180
const ROWS = 12
const W = 700
const H = 260
const LX = 40
const LW = 330
const RX = 420
const RW = 260
const TOP = 24
const PHT = 200

export function ShutterSheet() {
  const [sh, setSh] = useState(2)
  const [readout, setReadout] = useState(16)
  const [omega, setOmega] = useState(100)
  const shutter = SHUTTERS[sh].s
  const ro = readout / 1000
  const half = 0.5 * (shutter + ro)
  const tx = (t: number) => LX + ((t + half) / (2 * half)) * LW
  const rowH = PHT / ROWS
  const w = omega * DEG
  const shear = F_PX * w * ro
  const smear = F_PX * w * shutter
  // right panel: 1 display px = 1 px of 1080p output, centred
  const cx = RX + RW / 2
  const scale = PHT / 1080 // vertical: rows of the 1080 frame
  const hScale = 2.2 // horizontal exaggeration so a few px read
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one frame of the film pass · src/post.js</span>
        <span className="text-muted-foreground/60">timing from the code</span>
      </div>
      <div className="p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Rolling shutter timing: ${ROWS} row bands, each open for ${SHUTTERS[sh].label} of a second, started over a ${readout} millisecond readout. At ${omega} degrees per second a vertical edge shears by ${shear.toFixed(1)} pixels top to bottom and smears ${smear.toFixed(1)} pixels wide at 1080p.`}
        >
          <text x={LX} y={14} fontSize={9} className="fill-muted-foreground font-mono">rows (top to bottom) vs time</text>
          {[-1, 0, 1].map((f) => (
            <g key={f}>
              <line x1={tx(f * half)} x2={tx(f * half)} y1={TOP} y2={TOP + PHT} stroke="currentColor" className="text-muted-foreground" strokeDasharray="2 3" strokeWidth={0.8} />
              <text x={tx(f * half)} y={TOP + PHT + 14} fontSize={9} textAnchor="middle" className="fill-muted-foreground font-mono">
                {f === -1 ? "t−H · M0" : f === 0 ? "t · frame" : "t+H · M2"}
              </text>
            </g>
          ))}
          {Array.from({ length: ROWS }, (_, r) => {
            const ny = 1 - ((r + 0.5) / ROWS) * 2
            const tc = (-ny / 2) * ro
            const a = tc - shutter / 2
            return (
              <rect key={r} x={tx(a)} y={TOP + r * rowH + 2} width={Math.max(1, tx(a + shutter) - tx(a))} height={rowH - 4} rx={2} fill="oklch(0.62 0.16 255)" fillOpacity={0.55} />
            )
          })}
          <text x={LX + LW} y={TOP + PHT + 30} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
            window 2H = {(2 * half * 1000).toFixed(1)} ms
          </text>

          <text x={RX} y={14} fontSize={9} className="fill-muted-foreground font-mono">a vertical edge, yawing (x stretched ×{hScale})</text>
          <rect x={RX} y={TOP} width={RW} height={PHT} fill="none" stroke="currentColor" className="text-border" />
          {Array.from({ length: 54 }, (_, k) => {
            const row = (k + 0.5) * 20 // 1080p row
            const ny = 1 - (row / 1080) * 2
            const off = (-ny / 2) * shear // earlier rows on top: sign is the yaw direction
            const x0 = cx + (off - smear / 2 - 2.5) * hScale
            return (
              <rect key={k} x={Math.max(RX, x0)} y={TOP + row * scale - 10 * scale} width={Math.min(RW, (smear + 5) * hScale)} height={20 * scale} fill="currentColor" className="text-foreground" fillOpacity={Math.min(0.9, 5 / (smear + 5))} />
            )
          })}
          <line x1={cx} x2={cx} y1={TOP} y2={TOP + PHT} stroke="oklch(0.66 0.15 40)" strokeDasharray="3 3" />
          <text x={RX + RW} y={TOP + PHT + 14} fontSize={9} textAnchor="end" className="fill-muted-foreground font-mono">
            dashed: where a global shutter puts it
          </text>
        </svg>
        <div className="mt-2 grid gap-3 font-mono text-xs text-muted-foreground sm:grid-cols-3">
          <label className="block">
            exposure: <span className="text-foreground">{SHUTTERS[sh].label} s</span>
            <input type="range" min={0} max={SHUTTERS.length - 1} step={1} value={sh} onChange={(e) => setSh(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground" aria-label="exposure time" />
          </label>
          <label className="block">
            readout: <span className="text-foreground">{readout} ms</span>
            <input type="range" min={0} max={33} step={1} value={readout} onChange={(e) => setReadout(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground" aria-label="rolling shutter readout in milliseconds" />
          </label>
          <label className="block">
            yaw rate: <span className="text-foreground">{omega}°/s</span>
            <input type="range" min={0} max={240} step={5} value={omega} onChange={(e) => setOmega(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground" aria-label="camera yaw rate in degrees per second" />
          </label>
        </div>
        <div className="mt-3 rounded-lg border bg-background/50 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          shear top to bottom <span className="text-foreground">{shear.toFixed(1)} px</span> · smear{" "}
          <span className="text-foreground">{smear.toFixed(1)} px</span> at 1080p, f = 1158 px. The shader takes 10 taps
          per pixel, so at this smear they land{" "}
          <span className="text-foreground">{(smear / 10).toFixed(1)} px</span> apart; a per-pixel jitter turns the gaps
          into grain instead of ten ghost copies.
        </div>
      </div>
    </figure>
  )
}
