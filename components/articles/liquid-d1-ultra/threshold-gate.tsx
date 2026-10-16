"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A reliability diagram wired to an automation threshold. Everything here is
// SYNTHETIC: 4,000 decisions whose true chance of being right is drawn from a
// fixed, skewed-high distribution, with outcomes sampled once from a seeded
// generator. The "confidence" the model reports is that true chance pushed
// through a distortion k on the logit scale: k = 1 reports it honestly, k > 1
// is overconfident (pushed toward 0 and 1), k < 1 underconfident (pulled
// toward 0.5). The threshold slider then automates every decision whose
// reported confidence is at or above it and routes the rest to a person.
//
// mexp/mlog/mpow instead of Math.*: these numbers reach SVG coordinates and
// text, and Node and Chrome may differ by an ULP.

const N = 4000
const BINS = 10

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Item = { p: number; ok: boolean }

function makeItems(): Item[] {
  const rnd = mulberry32(20261015)
  const out: Item[] = []
  for (let i = 0; i < N; i++) {
    const u = rnd()
    const p = Math.min(0.995, 1 - 0.65 * mpow(u, 2.5))
    out.push({ p, ok: rnd() < p })
  }
  return out
}

const ITEMS = makeItems()

function distort(p: number, k: number): number {
  const z = mlog(p / (1 - p)) * k
  const c = 1 / (1 + mexp(-z))
  return Math.min(0.999, Math.max(0.001, c))
}

type Stats = {
  bins: { n: number; conf: number; acc: number }[]
  ece: number
  meanConf: number
  acc: number
  auto: number
  autoErr: number
  promised: number
  leaked: number
}

function compute(k: number, t: number): Stats {
  const bn = new Array<number>(BINS).fill(0)
  const bc = new Array<number>(BINS).fill(0)
  const ba = new Array<number>(BINS).fill(0)
  let sc = 0
  let sa = 0
  let an = 0
  let ac = 0
  let aok = 0
  for (const it of ITEMS) {
    const c = distort(it.p, k)
    const b = Math.min(BINS - 1, Math.floor(c * BINS))
    bn[b] += 1
    bc[b] += c
    ba[b] += it.ok ? 1 : 0
    sc += c
    sa += it.ok ? 1 : 0
    if (c >= t) {
      an += 1
      ac += c
      aok += it.ok ? 1 : 0
    }
  }
  let ece = 0
  const bins = []
  for (let b = 0; b < BINS; b++) {
    if (!bn[b]) continue
    const conf = bc[b] / bn[b]
    const acc = ba[b] / bn[b]
    ece += (bn[b] / N) * Math.abs(conf - acc)
    bins.push({ n: bn[b], conf, acc })
  }
  return {
    bins,
    ece,
    meanConf: sc / N,
    acc: sa / N,
    auto: an / N,
    autoErr: an ? 1 - aok / an : 0,
    promised: an ? 1 - ac / an : 0,
    leaked: an - aok,
  }
}

const PRESETS = [
  { k: 0.6, label: "underconfident" },
  { k: 1, label: "calibrated" },
  { k: 2, label: "overconfident" },
]

const W = 360
const H = 300
const P = 34
const sx = (v: number) => P + v * (W - P - 12)
const sy = (v: number) => H - P - v * (H - P - 12)
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`

export function ThresholdGate() {
  const [k, setK] = useState(2)
  const [t, setT] = useState(0.9)
  const s = useMemo(() => compute(k, t), [k, t])
  const ratio = s.promised > 0 ? s.autoErr / s.promised : 0
  const verdict =
    ratio <= 1.15
      ? "the automated slice is wrong about as often as its confidences imply, or less"
      : `the automated slice is wrong ${ratio.toFixed(1)} times as often as its confidences imply`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        illustrative: 4,000 synthetic decisions · not d1-ultra&apos;s data
      </div>

      <div className="grid gap-3 border-b p-3 sm:grid-cols-2">
        <label className="grid gap-1 font-mono text-xs">
          <span>
            distortion k = {k.toFixed(2)}{" "}
            <span className="text-muted-foreground">
              ({k < 0.97 ? "underconfident" : k > 1.03 ? "overconfident" : "calibrated"})
            </span>
          </span>
          <Range
            min={0.4}
            max={3}
            step={0.05}
            value={k}
            onChange={(e) => setK(Number(e.target.value))}
            aria-label="Confidence distortion"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
            {PRESETS.map((x) => (
              <button
                key={x.label}
                type="button"
                onClick={() => setK(x.k)}
                aria-pressed={k === x.k}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                  k === x.k ? "bg-foreground text-background" : "hover:bg-muted"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </label>
        <label className="grid gap-1 font-mono text-xs">
          <span>automate when confidence ≥ {t.toFixed(2)}</span>
          <Range
            min={0.5}
            max={0.99}
            step={0.01}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label="Automation threshold"
          />
        </label>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reliability diagram at distortion ${k.toFixed(2)}: expected calibration error ${pct(s.ece)}. Bars are accuracy per confidence bin against the diagonal. The shaded region right of ${t.toFixed(2)} is automated.`}
        >
          <rect
            x={sx(t)}
            y={sy(1)}
            width={sx(1) - sx(t)}
            height={sy(0) - sy(1)}
            fill="var(--primary)"
            fillOpacity={0.08}
          />
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={sx(0)} y1={sy(g)} x2={sx(1)} y2={sy(g)} stroke="var(--border)" />
              <text x={P - 6} y={sy(g) + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.6}>
                {g.toFixed(1)}
              </text>
              <text x={sx(g)} y={H - P + 14} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
                {g.toFixed(1)}
              </text>
            </g>
          ))}
          {s.bins.map((b, i) => {
            const x0 = sx(Math.floor(b.conf * BINS) / BINS) + 2
            const x1 = sx(Math.floor(b.conf * BINS) / BINS + 1 / BINS) - 2
            const over = b.acc < b.conf
            return (
              <g key={i}>
                <rect
                  x={x0}
                  y={sy(b.acc)}
                  width={x1 - x0}
                  height={sy(0) - sy(b.acc)}
                  fill={over ? "oklch(0.65 0.17 30)" : "oklch(0.62 0.13 200)"}
                  fillOpacity={0.75}
                />
                <circle cx={sx(b.conf)} cy={sy(b.conf)} r={2} fill="currentColor" opacity={0.7} />
              </g>
            )
          })}
          <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="currentColor" strokeDasharray="4 3" opacity={0.5} />
          <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(1)} stroke="var(--primary)" strokeWidth={1.5} />
          <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
            reported confidence
          </text>
          <text x={10} y={H / 2} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7} transform={`rotate(-90 10 ${H / 2})`}>
            accuracy in bin
          </text>
        </svg>

        <dl className="grid content-start gap-2 font-mono text-xs">
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">accuracy, all decisions</dt>
            <dd>{pct(s.acc)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">mean reported confidence</dt>
            <dd>{pct(s.meanConf)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">ECE, 10 bins</dt>
            <dd>{pct(s.ece, 2)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">automated</dt>
            <dd>{pct(s.auto)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">routed to a person</dt>
            <dd>{pct(1 - s.auto)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">error the model implies, automated slice</dt>
            <dd>{pct(s.promised, 2)}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b pb-1">
            <dt className="text-muted-foreground">error actually seen, automated slice</dt>
            <dd className={cn(ratio > 1.15 ? "text-red-600 dark:text-red-400" : "")}>{pct(s.autoErr, 2)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground">wrong answers shipped unreviewed</dt>
            <dd>
              {s.leaked} of {N}
            </dd>
          </div>
          <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
            At this setting, {verdict}. The threshold alone promises at most{" "}
            {pct(1 - t, 0)} wrong.
          </p>
        </dl>
      </div>
    </figure>
  )
}
