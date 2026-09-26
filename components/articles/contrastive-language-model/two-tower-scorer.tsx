"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mexp, msin } from "@/lib/dmath"

// The CLM readout, shrunk to two dimensions so it can be drawn.
//
// The real thing (src/clm/heads.py, src/clm/engine.py): a frozen Qwen3-8B turns
// the state text and each candidate text into a 4096-d last-token vector; two
// separate MLP heads (4096 -> 1536 -> 1536 -> 512) project them; both results
// are L2-normalised; the logit of a (state, candidate) pair is
// scale * cos(z_s, z_a); a softmax over the candidates is the answer. The scale
// is exp(logit_scale): 100.8 in CLM_v0.1-8B.pt, clamped to 100 at inference.
//
// Here the 512-d unit sphere is a circle, the four action vectors sit at fixed
// angles (they are computed once and cached, because an action is embedded
// without ever seeing the state), and the reader moves the state. The angles
// are illustrative; the arithmetic after them is exactly the engine's.
//
// The four actions are the ones the release's own Super Mario figure uses.

type Action = { key: string; deg: number; color: string }

const ACTIONS: Action[] = [
  { key: "left", deg: 200, color: "oklch(0.62 0.13 250)" },
  { key: "jump", deg: 92, color: "oklch(0.60 0.17 25)" },
  { key: "right run", deg: 8, color: "oklch(0.62 0.13 150)" },
  { key: "right jump", deg: 48, color: "oklch(0.66 0.14 75)" },
]

const RAD = Math.PI / 180
const W = 300
const H = 260
const CX = 150
const CY = 132
const R = 96

const px = (deg: number, r = R) => CX + r * mcos(deg * RAD)
const py = (deg: number, r = R) => CY - r * msin(deg * RAD)

function softmax(xs: number[]): number[] {
  const m = Math.max(...xs)
  const e = xs.map((x) => mexp(x - m))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / z)
}

export function TwoTowerScorer() {
  const [stateDeg, setStateDeg] = useState(76)
  const [scale, setScale] = useState(100)
  const [seen, setSeen] = useState<number[]>([76])

  const cosines = ACTIONS.map((a) => mcos((a.deg - stateDeg) * RAD))
  const logits = cosines.map((c) => scale * c)
  const probs = softmax(logits)
  const best = probs.indexOf(Math.max(...probs))

  const moveState = (deg: number) => {
    setStateDeg(deg)
    setSeen((prev) => (prev.includes(deg) ? prev : [...prev, deg]))
  }

  const statePasses = seen.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>state vector · cached action vectors · scale × cosine → softmax</span>
        <span className="text-muted-foreground/60">2-d toy of a 512-d space</span>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[300px_1fr] sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mx-auto w-full max-w-[300px]"
          role="img"
          aria-label={`A unit circle. Four fixed action vectors: left, jump, right run and right jump. The state vector points at ${stateDeg} degrees; the highest-scoring action is ${ACTIONS[best].key} with probability ${(probs[best] * 100).toFixed(1)} percent at scale ${scale}.`}
        >
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border)" strokeWidth={1} />
          <line x1={CX - R - 8} x2={CX + R + 8} y1={CY} y2={CY} stroke="var(--border)" strokeWidth={0.75} />
          <line x1={CX} x2={CX} y1={CY - R - 8} y2={CY + R + 8} stroke="var(--border)" strokeWidth={0.75} />

          {ACTIONS.map((a, i) => (
            <g key={a.key}>
              <line
                x1={CX}
                y1={CY}
                x2={px(a.deg)}
                y2={py(a.deg)}
                stroke={a.color}
                strokeWidth={i === best ? 2.5 : 1.5}
                strokeDasharray={i === best ? undefined : "4 3"}
              />
              <circle cx={px(a.deg)} cy={py(a.deg)} r={4} fill={a.color} />
              <text
                x={px(a.deg, R + 16)}
                y={py(a.deg, R + 16) + 4}
                textAnchor="middle"
                className="font-mono"
                fontSize={10}
                fill={a.color}
              >
                {a.key}
              </text>
            </g>
          ))}

          <line
            x1={CX}
            y1={CY}
            x2={px(stateDeg, R - 6)}
            y2={py(stateDeg, R - 6)}
            stroke="var(--foreground)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={px(stateDeg, R - 6)} cy={py(stateDeg, R - 6)} r={5} fill="var(--foreground)" />
          <text x={CX + 6} y={CY + 16} className="fill-muted-foreground font-mono" fontSize={9}>
            z_s
          </text>
          <text x={8} y={H - 6} className="fill-muted-foreground font-mono" fontSize={9}>
            dashed: cached, never re-encoded
          </text>
        </svg>

        <div className="min-w-0">
          <table className="w-full font-mono text-[11px] tabular-nums">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">action</th>
                <th className="py-1 text-right font-normal">cos</th>
                <th className="py-1 text-right font-normal">logit</th>
                <th className="w-[42%] py-1 pl-3 text-left font-normal">softmax</th>
              </tr>
            </thead>
            <tbody>
              {ACTIONS.map((a, i) => (
                <tr key={a.key} className={i === best ? "text-foreground" : "text-muted-foreground"}>
                  <td className="py-1" style={{ color: a.color }}>
                    {a.key}
                  </td>
                  <td className="py-1 text-right">{cosines[i].toFixed(3)}</td>
                  <td className="py-1 text-right">{logits[i].toFixed(1)}</td>
                  <td className="py-1 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${(probs[i] * 100).toFixed(2)}%`, background: a.color }}
                        />
                      </div>
                      <span className="w-12 text-right">{(probs[i] * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label className="mt-4 block">
            <span className="font-mono text-[11px] text-muted-foreground">
              the state changes (a new frame): z_s at {stateDeg}°
            </span>
            <Range
              min={0}
              max={359}
              step={1}
              value={stateDeg}
              onChange={(e) => moveState(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
          </label>

          <label className="mt-2 block">
            <span className="font-mono text-[11px] text-muted-foreground">
              scale = 1/τ: {scale}
              {scale === 100 ? " (the released head: e^4.613 = 100.8, clamped to 100)" : ""}
            </span>
            <Range
              min={1}
              max={100}
              step={1}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full cursor-pointer"
            />
          </label>

          <div className="mt-3 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
            states visited: <span className="text-foreground">{statePasses}</span> → encoder passes over
            states: <span className="text-foreground">{statePasses}</span>, over actions:{" "}
            <span className="text-foreground">{ACTIONS.length}</span> (once, then cached). A readout that
            puts the options inside the prompt also makes{" "}
            <span className="text-foreground">{statePasses}</span> passes, but each one re-reads all{" "}
            {ACTIONS.length} options next to the state.
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Drawn from <code>src/clm/engine.py</code> (<code>Engine.answer</code>) and{" "}
        <code>src/clm/heads.py</code>: the logit is <code>scale · cos(z_s, z_a)</code> and the answer
        is a softmax over the candidates you supplied. At scale 100 a cosine gap of 0.05 is a logit gap
        of 5, a probability ratio of about 148 to 1; drag the scale down to 1 and the same geometry
        gives a nearly flat answer. The angles are mine; the four action names are the ones in the
        release&apos;s Super Mario figure.
      </figcaption>
    </figure>
  )
}
