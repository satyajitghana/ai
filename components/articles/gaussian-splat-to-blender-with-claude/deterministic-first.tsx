"use client"

import { useState } from "react"

import { EXTRACT } from "./data"
import { ACCENT, Frame, GREEN, MONO, STREAM, T } from "./viz"

// The post's hypothesis made concrete: pull the deterministic parts out of the
// SfM points with code, and hand the model numbers instead of making it guess
// them from pictures. Every number in the grid is MEASURED in our toy
// (code/extract.py): a synthetic building (12 x 8 x 6 m) on a ground plane in an
// arbitrary frame (random rotation, scale between 0.3 and 3), Gaussian noise of
// the given sigma, floaters as a share of all points, two camera centres
// 2.0 m apart (measured to 1%), 12 seeds per cell. "Success" = every box
// dimension within 10% and the up axis within 3 degrees.

const SIGMAS = [0.02, 0.05, 0.1, 0.2]
const FRACS = [0, 0.1, 0.25, 0.4]
const STAGES = [
  ["ground", "biggest RANSAC plane; its normal is up"],
  ["roof", "biggest plane parallel to the ground"],
  ["walls", "vertical planes, up to four"],
  ["yaw", "wall normals folded mod 90 degrees"],
  ["size", "gaps between parallel walls, roof height"],
  ["scale", "known camera baseline / SfM baseline"],
]

export function DeterministicFirst() {
  const [sel, setSel] = useState<[number, number]>([1, 3])
  const c = EXTRACT.find((x) => x.sigma === SIGMAS[sel[0]] && x.outliers === FRACS[sel[1]])
  return (
    <Frame
      label="deterministic extraction on a synthetic capture · a toy · MEASURED, 12 seeds per cell"
      note={
        <>
          A toy: the cloud is generated, not captured, and a real building has windows, trees and a bad day for SfM. It
          shows the shape of the claim: the up axis and the box come out of the points to a percent or two while
          floaters stay under a quarter of the cloud, and the metric scale comes from one measured distance, not from
          the splat. Failures cluster where the floaters reach 40%.
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">noise sigma (m) down, floaters across</div>
          <div className="inline-grid grid-cols-[auto_repeat(4,2.6rem)] items-center gap-1">
            <span />
            {FRACS.map((f) => (
              <span key={f} className="text-center font-mono text-[10px] text-muted-foreground">
                {Math.round(f * 100)}%
              </span>
            ))}
            {SIGMAS.map((sg, i) => (
              <span key={sg} className="contents">
                <span className="pr-1 text-right font-mono text-[10px] text-muted-foreground">{sg}</span>
                {FRACS.map((f, j) => {
                  const cell = EXTRACT.find((x) => x.sigma === sg && x.outliers === f)
                  const frac = cell ? cell.success / cell.seeds : 0
                  const on = sel[0] === i && sel[1] === j
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      aria-label={`sigma ${sg}, ${Math.round(f * 100)} percent floaters: ${cell?.success} of ${cell?.seeds} succeeded`}
                      onClick={() => setSel([i, j])}
                      className="h-9 cursor-pointer rounded border text-[10px] transition-colors"
                      style={{
                        background: `color-mix(in oklch, ${GREEN} ${Math.round(frac * 70)}%, transparent)`,
                        borderColor: on ? ACCENT : undefined,
                        borderWidth: on ? 2 : 1,
                        fontFamily: MONO,
                      }}
                    >
                      {cell?.success}/{cell?.seeds}
                    </button>
                  )
                })}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
          {c ? (
            <>
              <div className="font-mono text-[10px] text-foreground">
                sigma {c.sigma} m · floaters {Math.round(c.outliers * 100)}% · {c.success} of {c.seeds} succeeded
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2">
                <div>
                  <dt>up axis, median error</dt>
                  <dd className="font-mono text-foreground">{c.up?.toFixed(2)}°</dd>
                </div>
                <div>
                  <dt>box size, median error</dt>
                  <dd className="font-mono text-foreground">{c.dim?.toFixed(1)}%</dd>
                </div>
                <div>
                  <dt>scale, median error</dt>
                  <dd className="font-mono text-foreground">{c.scale?.toFixed(2)}%</dd>
                </div>
              </dl>
              <p className="mt-2">
                The scale error is the baseline measurement’s own error (1%): the splat contributes none of it.
              </p>
            </>
          ) : null}
        </div>
      </div>
      <svg viewBox="0 0 560 74" role="img" className="mt-3 h-auto w-full">
        <title>The six extraction stages in order: ground, roof, walls, yaw, size, scale.</title>
        {STAGES.map(([name, what], k) => {
          const x = 8 + k * 92
          return (
            <g key={name}>
              {k > 0 ? <line x1={x - 6} y1={24} x2={x + 2} y2={24} className="stroke-border" strokeWidth={1.5} /> : null}
              <rect x={x} y={8} width={82} height={32} rx={6} fill={STREAM} fillOpacity={0.1} stroke={STREAM} strokeWidth={1} />
              <T x={x + 41} y={28} size={10} anchor="middle" opacity={0.95} weight={600}>
                {name}
              </T>
              <T x={x + 41} y={54} size={6.5} anchor="middle" opacity={0.6}>
                {what.length > 26 ? what.slice(0, 26) : what}
              </T>
              <T x={x + 41} y={63} size={6.5} anchor="middle" opacity={0.6}>
                {what.length > 26 ? what.slice(26) : ""}
              </T>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}
