"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { align, globalSearch, MAP, SCAN, TRUTH, type Pose } from "./ndt-core"
import { ellipse, f1, rot, wrap, type V2 } from "./toy-geom"

const W = 448
const H = 316
const VIEW = { x0: -5.6, y0: -4.4, w: 12.2 }
const S = W / VIEW.w
const X = (x: number) => f1((x - VIEW.x0) * S)
const Y = (y: number) => f1(H - (y - VIEW.y0) * S)
const ACCENT = "oklch(0.62 0.17 250)"
const BAD = "oklch(0.64 0.2 25)"
const OK = "oklch(0.62 0.15 150)"

export function NdtToy() {
  const [dx, setDx] = useState(0.3)
  const [dyaw, setDyaw] = useState(10)
  const [mode, setMode] = useState<"track" | "search">("track")
  const [it, setIt] = useState(0)
  const start: Pose = { th: TRUTH.th + (dyaw * Math.PI) / 180, p: [TRUTH.p[0] + dx, TRUTH.p[1] - 0.6 * dx] }
  const track = useMemo(() => align({ th: TRUTH.th + (dyaw * Math.PI) / 180, p: [TRUTH.p[0] + dx, TRUTH.p[1] - 0.6 * dx] }, 30), [dx, dyaw])
  const search = useMemo(() => (mode === "search" ? globalSearch([TRUTH.p[0] + dx, TRUTH.p[1] - 0.6 * dx]) : null), [mode, dx])
  const hist = mode === "search" && search ? search.fine : track
  const k = Math.min(it, hist.length - 1)
  const cur = hist[k]
  const perr = Math.sqrt((cur.p[0] - TRUTH.p[0]) ** 2 + (cur.p[1] - TRUTH.p[1]) ** 2)
  const herr = (Math.abs(wrap(cur.th - TRUTH.th)) * 180) / Math.PI
  const done = k === hist.length - 1
  const thresh = mode === "search" ? 0.45 : 0.35
  const accepted = cur.match >= thresh

  const pose = (th: number, p: V2, col: string, dash?: boolean) => {
    const pts = [rot(th, [0.42, 0]), rot(th, [-0.24, 0.2]), rot(th, [-0.24, -0.2])]
      .map((q) => `${X(p[0] + q[0])},${Y(p[1] + q[1])}`)
      .join(" ")
    return <polygon points={pts} fill={dash ? "none" : col} stroke={col} strokeWidth="1.4" strokeDasharray={dash ? "3 2" : undefined} />
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>NDT scan-to-map · 1 m cells · planar toy</span>
        <span className="tabular-nums">
          {mode === "search" ? "global search, fine stage" : "tracking from the last pose"} · iteration {k + 1} of {hist.length}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`A floor plan cut into one-metre cells, each drawn as an ellipse. A scan is aligned to it by NDT; at iteration ${k + 1} it is ${(perr * 100).toFixed(0)} centimetres and ${herr.toFixed(1)} degrees from the truth, with ${(cur.match * 100).toFixed(0)} percent of points matched.`}
          className="w-full"
        >
          {Array.from({ length: 13 }, (_, i) => (
            <line key={`v${i}`} x1={X(i - 5)} x2={X(i - 5)} y1={Y(-4.4)} y2={Y(4.4)} stroke="var(--border)" strokeWidth="0.6" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} y1={Y(i - 4)} y2={Y(i - 4)} x1={X(-5.6)} x2={X(6.6)} stroke="var(--border)" strokeWidth="0.6" />
          ))}
          {MAP.pts.map((q, i) =>
            i % 3 === 0 ? <circle key={i} cx={X(q[0])} cy={Y(q[1])} r="0.8" fill="var(--muted-foreground)" opacity="0.5" /> : null
          )}
          {[...MAP.cells.values()].map((c, i) => {
            const e = ellipse(c.cov[0], c.cov[1], c.cov[2], 2)
            return (
              <ellipse
                key={i}
                cx={X(c.mu[0])}
                cy={Y(c.mu[1])}
                rx={f1(Math.max(e.rx * S, 0.8))}
                ry={f1(Math.max(e.ry * S, 0.8))}
                transform={`rotate(${f1(-e.ang)} ${X(c.mu[0])} ${Y(c.mu[1])})`}
                fill="var(--foreground)"
                fillOpacity="0.06"
                stroke="var(--foreground)"
                strokeOpacity="0.45"
                strokeWidth="0.8"
              />
            )
          })}
          {mode === "search" &&
            search?.cands.map((c, i) => (
              <circle key={`c${i}`} cx={X(c.p[0])} cy={Y(c.p[1])} r="2.4" fill="none" stroke={ACCENT} strokeOpacity="0.5" />
            ))}
          {SCAN.map((pb, i) => {
            const q = rot(cur.th, pb)
            return (
              <circle
                key={i}
                cx={X(q[0] + cur.p[0])}
                cy={Y(q[1] + cur.p[1])}
                r="2"
                fill={cur.matched[i] ? OK : BAD}
                opacity="0.9"
              />
            )
          })}
          {pose(TRUTH.th, TRUTH.p, "var(--muted-foreground)", true)}
          {mode === "track" && pose(start.th, start.p, BAD, true)}
          {pose(cur.th, cur.p, ACCENT)}
        </svg>

        <div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground">
          <dl className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 tabular-nums">
            <dt>NDT score / point</dt>
            <dd className="text-right text-foreground">{cur.score.toFixed(3)}</dd>
            <dt>match (q &lt; 9)</dt>
            <dd className="text-right" style={{ color: accepted ? OK : BAD }}>
              {(cur.match * 100).toFixed(0)}%
            </dd>
            <dt>position error</dt>
            <dd className="text-right text-foreground">{(perr * 100).toFixed(1)} cm</dd>
            <dt>heading error</dt>
            <dd className="text-right text-foreground">{herr.toFixed(2)}°</dd>
            <dt>cells</dt>
            <dd className="text-right text-foreground">{MAP.cells.size}</dd>
          </dl>
          <p className="leading-5">
            {done
              ? accepted
                ? `Accepted: match is at or above ${thresh.toFixed(2)}, the code's bar for ${mode === "search" ? "a global search" : "a tracking update"}.`
                : `Rejected: match is under ${thresh.toFixed(2)}. ${mode === "search" ? "The app stays in Searching." : "Twenty of these in a row and the app declares itself lost."}`
              : "Step through the iterations, or jump to the end."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-3">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>start offset</span>
            <span className="tabular-nums text-foreground">{(Math.sqrt(1.36) * dx).toFixed(2)} m</span>
          </div>
          <Range
            min={0}
            max={2}
            step={0.05}
            value={dx}
            onChange={(e) => {
              setDx(parseFloat(e.target.value))
              setIt(0)
            }}
            className="w-full cursor-pointer"
            aria-label="distance of the starting guess from the true position"
            accent="var(--foreground)"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>start heading error</span>
            <span className="tabular-nums text-foreground">{dyaw}°</span>
          </div>
          <Range
            min={-90}
            max={90}
            step={5}
            value={dyaw}
            onChange={(e) => {
              setDyaw(parseInt(e.target.value, 10))
              setIt(0)
            }}
            className="w-full cursor-pointer"
            aria-label="heading error of the starting guess in degrees"
            accent="var(--foreground)"
            disabled={mode === "search"}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setIt((v) => (v >= hist.length - 1 ? 0 : v + 1))}
            className="cursor-pointer rounded border border-transparent px-2 py-1 text-white"
            style={{ background: ACCENT }}
          >
            {done ? "restart" : "step"}
          </button>
          <button
            type="button"
            onClick={() => setIt(hist.length - 1)}
            className="cursor-pointer rounded border px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            to the end
          </button>
          <button
            type="button"
            aria-pressed={mode === "search"}
            onClick={() => {
              setMode((m) => (m === "search" ? "track" : "search"))
              setIt(0)
            }}
            className={cn(
              "cursor-pointer rounded border px-2 py-1 transition-colors",
              mode === "search" ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            global search: {mode === "search" ? "on" : "off"}
          </button>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        A planar version of <code>ndtAlign()</code>, not the app&apos;s code. Each 1 m cell with six or more map points becomes a
        Gaussian (ellipses at 2σ); a wall makes a long thin one. Green scan points sit within three standard deviations of a cell,
        red ones do not. Tracking climbs the summed score with Gauss-Newton from where the last pose put you. In this room it
        recovers 15° of heading at the true position and 10° from half a metre away; at 20°, or 0.7 m with any heading error, it
        settles on the wrong walls. The global search starts from 12 headings and five positions, keeps the best score and refines
        it. Here it finds the pose from guesses up to 1.4 m away. From 1.75 m it locks onto a place 1.39 m off with 53% matched,
        over the 0.45 bar: a confident wrong answer that only a person looking at the map would catch.
      </figcaption>
    </figure>
  )
}
