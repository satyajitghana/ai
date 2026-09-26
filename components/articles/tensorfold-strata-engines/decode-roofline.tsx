"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two rooflines in series.
//
// One verify pass reads the always-used ("dense") weights once, whatever the
// number of tokens in it, and then each token's routed experts. Experts that
// sit in fast memory are read at the fast bandwidth; the rest go down a slow
// path (the CPU reading system RAM, or PCIe). The GPU's hits and the CPU's
// misses run at the same time, so the expert term is the slower of the two:
//
//   t_pass = D / B_fast + max( h·E·L / B_fast , (1−h)·E·L / B_slow ) + t_fixed
//   tok/s  = L / t_pass
//
//   D       GB of dense weights read once per pass
//   E       GB of routed-expert weights one token reads
//   h       share of those expert bytes already in fast memory (hit rate)
//   L       tokens committed per pass
//   t_fixed drafting and everything else, per pass (measured, where published)
//
// It assumes no two tokens of a pass share an expert and ignores Strata's PCIe
// share of the misses, both of which would lower the expert term. It is a
// bandwidth model, not a prediction: kernels, attention and launch overhead
// all sit below it.
//
// Preset sources (all in the article):
//   27B:      14.44 GB per forward (my count, matching TensorFold's "about 14.4
//             GB"); 569 GB/s is the read rate TensorFold's recipe measured.
//   Flash Next on the M3 Ultra: 4.26 GB per token and a 5.3 ms floor, from
//             TensorFold's recipe; the 1.48 GB routed share is my count at 5
//             bits per weight; the rest is dense.
//   Strata:   Table 1 and Table 5 of the Strata paper (RTX 5070, 4K context):
//             dense 1.8 + 1.3 + 0.44 GB; experts 0.66 GB per token for Q2_0
//             (0.84 for IQ3_XXS, the expert arena scaled by 480 of 24,576);
//             hit rates 0.72 / 0.71; CPU expert rates 41 / 24 GB/s; drafting
//             plus other 6.3 / 7.0 ms.

type Preset = {
  key: string
  label: string
  bf: number
  d: number
  e: number
  h: number
  bs: number
  l: number
  fix: number
  points: { l: number; v: number; label: string }[]
  lines: { v: number; label: string }[]
}

const PRESETS: Preset[] = [
  {
    key: "tf27",
    label: "TensorFold · 27B · M5 Max",
    bf: 569,
    d: 14.44,
    e: 0,
    h: 1,
    bs: 41,
    l: 1,
    fix: 0,
    points: [],
    lines: [
      { v: 27, label: "serial 27" },
      { v: 122, label: "claimed 120–124" },
    ],
  },
  {
    key: "tffn",
    label: "TensorFold · Flash Next · M3 Ultra",
    bf: 804,
    d: 2.78,
    e: 1.48,
    h: 1,
    bs: 41,
    l: 1,
    fix: 0,
    points: [],
    lines: [
      { v: 79, label: "serial 79" },
      { v: 106, label: "drafted 105–107" },
    ],
  },
  {
    key: "q2",
    label: "Strata · Q2_0 · 4K",
    bf: 672,
    d: 3.54,
    e: 0.66,
    h: 0.72,
    bs: 41,
    l: 3.23,
    fix: 6.3,
    points: [{ l: 3.23, v: 94.6, label: "measured 94.6" }],
    lines: [],
  },
  {
    key: "iq3",
    label: "Strata · IQ3_XXS · 4K",
    bf: 672,
    d: 3.54,
    e: 0.84,
    h: 0.71,
    bs: 24,
    l: 3.24,
    fix: 7.0,
    points: [{ l: 3.24, v: 65.6, label: "measured 65.6" }],
    lines: [],
  },
  {
    key: "cpu",
    label: "All experts on the CPU · IQ3_XXS",
    bf: 672,
    d: 3.54,
    e: 0.84,
    h: 0,
    bs: 24,
    l: 1,
    fix: 0,
    points: [],
    lines: [{ v: 15, label: "first llama.cpp run 15" }],
  },
]

const ACCENT = "oklch(0.55 0.16 250)"
const SLOW = "oklch(0.60 0.16 45)"
const WARN = "oklch(0.58 0.19 28)"
const FIX = "oklch(0.70 0.02 250)"

const W = 760
const H = 320
const PL = 56
const PR = 150
const PT = 22
const PB = 46
const PW = W - PL - PR
const PH = H - PT - PB
const X_MAX = 8

type Params = { bf: number; d: number; e: number; h: number; bs: number; l: number; fix: number }

// All times in milliseconds. GB / (GB/s) = s, so × 1000.
function terms(p: Params, l: number) {
  const dense = (p.d / p.bf) * 1000
  const hit = ((p.h * p.e * l) / p.bf) * 1000
  const miss = p.h >= 1 ? 0 : (((1 - p.h) * p.e * l) / p.bs) * 1000
  const expert = Math.max(hit, miss)
  return { dense, hit, miss, expert, fix: p.fix, total: dense + expert + p.fix }
}

const tps = (p: Params, l: number) => (l / terms(p, l).total) * 1000

// Smallest L that reaches v tok/s: v·(a + b·L) = L  →  L = v·a / (1 − v·b),
// with a the per-pass constant and b the per-token expert cost, both in seconds.
function needL(p: Params, v: number): number | null {
  const a = (p.d / p.bf + p.fix / 1000)
  const b = Math.max((p.h * p.e) / p.bf, p.h >= 1 ? 0 : ((1 - p.h) * p.e) / p.bs)
  const den = 1 - v * b
  if (den <= 0) return null
  return (v * a) / den
}

function niceMax(v: number) {
  // Every step divides by four, so the four gridlines land on whole numbers.
  const steps = [40, 80, 100, 120, 160, 200, 240, 300, 400, 500, 600, 800]
  for (const s of steps) if (v <= s) return s
  return 1000
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-3 text-xs">
      <span className="w-32 shrink-0 font-mono text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
        aria-label={label}
      />
      <span className="w-16 shrink-0 text-right font-mono tabular-nums">{fmt(value)}</span>
    </label>
  )
}

export function DecodeRoofline() {
  const [presetKey, setPresetKey] = useState("q2")
  const [p, setP] = useState<Params>(() => {
    const s = PRESETS.find((x) => x.key === "q2") as Preset
    return { bf: s.bf, d: s.d, e: s.e, h: s.h, bs: s.bs, l: s.l, fix: s.fix }
  })

  const preset = PRESETS.find((x) => x.key === presetKey)
  const set = (k: keyof Params) => (v: number) => {
    setP((old) => ({ ...old, [k]: v }))
  }
  const choose = (s: Preset) => {
    setPresetKey(s.key)
    setP({ bf: s.bf, d: s.d, e: s.e, h: s.h, bs: s.bs, l: s.l, fix: s.fix })
  }

  const markLines = preset?.lines ?? []
  const markPoints = preset?.points ?? []

  const samples: number[] = []
  for (let i = 0; i <= 56; i++) samples.push(1 + (i / 56) * (X_MAX - 1))
  const curve = samples.map((l) => ({ l, v: tps(p, l) }))
  const asym =
    p.e > 0 ? 1 / Math.max((p.h * p.e) / p.bf, p.h >= 1 ? 0 : ((1 - p.h) * p.e) / p.bs) : null
  const curveMax = Math.max(...curve.map((c) => c.v))
  // Show the limit line when it is near the curve; a far-off limit would
  // squash everything else against the axis.
  const peak = Math.max(
    curveMax,
    ...markLines.map((m) => m.v),
    ...markPoints.map((m) => m.v),
    asym !== null && asym < 1.5 * curveMax ? asym : 0
  )
  const yMax = niceMax(peak * 1.08)

  const px = (l: number) => PL + ((l - 1) / (X_MAX - 1)) * PW
  const py = (v: number) => PT + PH - (Math.min(v, yMax) / yMax) * PH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)

  const now = terms(p, p.l)
  const ceiling = tps(p, p.l)

  const barW = 520
  const scale = barW / Math.max(now.total, 0.001)
  const segs = [
    { key: "dense", label: "dense read", ms: now.dense, color: ACCENT },
    {
      key: "expert",
      label: now.miss > now.hit ? "expert misses (slow path)" : "expert hits (fast path)",
      ms: now.expert,
      color: now.miss > now.hit ? SLOW : ACCENT,
    },
    { key: "fix", label: "drafting + other", ms: now.fix, color: FIX },
  ].filter((s) => s.ms > 0.0001)

  let acc = 0

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        Decode ceiling · dense read once per pass, experts per token · reasoned
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
        {PRESETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => choose(s)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              s.key === presetKey
                ? "border-foreground/40 bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-2 pt-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Decode ceiling in tokens per second against tokens committed per verify pass, from 1 to 8, for the chosen settings. At ${p.l.toFixed(2)} tokens per pass the ceiling is ${ceiling.toFixed(0)} tokens per second. When experts live in slow memory the curve bends over, because every extra token in a pass brings its own experts down the slow path.`}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line
                x1={PL}
                y1={py(v)}
                x2={PL + PW}
                y2={py(v)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={PL - 8}
                y={py(v) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {v.toFixed(0)}
              </text>
            </g>
          ))}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((l) => (
            <text
              key={l}
              x={px(l)}
              y={py(0) + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={10}
            >
              {l}
            </text>
          ))}
          <text
            x={PL + PW / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            tokens committed per verify pass
          </text>
          <text
            x={PL - 40}
            y={PT + PH / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${PL - 40} ${PT + PH / 2})`}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            ceiling tok/s
          </text>

          {asym !== null && asym <= yMax ? (
            <g>
              <line
                x1={PL}
                y1={py(asym)}
                x2={PL + PW}
                y2={py(asym)}
                stroke={SLOW}
                strokeWidth={1}
                strokeOpacity={0.5}
                strokeDasharray="6 4"
              />
              <text
                x={PL + PW + 8}
                y={py(asym) + 3.5}
                className="font-mono"
                fill={SLOW}
                fontSize={9.5}
              >
                limit {asym.toFixed(0)}
              </text>
            </g>
          ) : null}

          {markLines.map((m) => (
            <g key={m.label}>
              <line
                x1={PL}
                y1={py(m.v)}
                x2={PL + PW}
                y2={py(m.v)}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={PL + PW + 8}
                y={py(m.v) + 3.5}
                className="fill-foreground font-mono"
                fontSize={10}
              >
                {m.label}
              </text>
            </g>
          ))}

          <polyline
            points={curve.map((c) => `${px(c.l)},${py(c.v)}`).join(" ")}
            fill="none"
            stroke={ACCENT}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />

          <line
            x1={px(p.l)}
            y1={py(0)}
            x2={px(p.l)}
            y2={py(ceiling)}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <circle
            cx={px(p.l)}
            cy={py(ceiling)}
            r={5}
            fill={ACCENT}
            stroke="var(--background)"
            strokeWidth={1.5}
          />

          {markPoints.map((m) => (
            <g key={m.label}>
              <circle
                cx={px(m.l)}
                cy={py(m.v)}
                r={5.5}
                fill="var(--background)"
                stroke={WARN}
                strokeWidth={2}
              />
              <text
                x={px(m.l) + 10}
                y={py(m.v) + 14}
                className="fill-foreground font-mono"
                fontSize={10}
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs">
          <span className="text-muted-foreground">one pass at these settings</span>
          <span>
            {now.total.toFixed(1)} ms · ceiling{" "}
            <span className="font-medium">{ceiling.toFixed(0)} tok/s</span>
          </span>
        </div>
        <svg viewBox={`0 0 ${barW} 22`} className="w-full" role="img" aria-label="Time per pass split into its parts">
          {segs.map((s) => {
            const x = acc
            const w = s.ms * scale
            acc += w
            return (
              <rect
                key={s.key}
                x={x}
                y={3}
                width={Math.max(w - 1, 0.5)}
                height={16}
                rx={3}
                fill={s.color}
                fillOpacity={s.key === "fix" ? 0.5 : 0.85}
              />
            )
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {segs.map((s) => (
            <span key={s.key}>
              <span
                className="mr-1 inline-block h-2 w-2 rounded-sm align-middle"
                style={{ background: s.color }}
              />
              {s.label} {s.ms.toFixed(1)} ms
            </span>
          ))}
        </div>
        {markLines.length > 0 ? (
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {markLines.map((m) => {
              const need = needL(p, m.v)
              return (
                <div key={m.label}>
                  {m.label} needs{" "}
                  <span className="text-foreground">
                    {need === null
                      ? "more than this path can ever give"
                      : need <= 1
                        ? "no drafting at all"
                        : `≥ ${need.toFixed(2)} tokens per pass`}
                  </span>
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2 border-t px-4 py-3 sm:grid-cols-2 sm:gap-x-6">
        <Slider label="fast GB/s" value={p.bf} min={100} max={1000} step={1} fmt={(v) => v.toFixed(0)} onChange={set("bf")} />
        <Slider label="slow GB/s" value={p.bs} min={5} max={100} step={1} fmt={(v) => v.toFixed(0)} onChange={set("bs")} />
        <Slider label="dense GB / pass" value={p.d} min={0.5} max={20} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("d")} />
        <Slider label="expert GB / token" value={p.e} min={0} max={2} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("e")} />
        <Slider label="hit rate" value={p.h} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("h")} />
        <Slider label="tokens / pass" value={p.l} min={1} max={8} step={0.01} fmt={(v) => v.toFixed(2)} onChange={set("l")} />
        <Slider label="fixed ms / pass" value={p.fix} min={0} max={20} step={0.1} fmt={(v) => v.toFixed(1)} onChange={set("fix")} />
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        A bandwidth model, not a strict bound. It leaves out two things that would raise
        the line (tokens of a pass sharing an expert, and Strata sending a share of its
        misses over PCIe in parallel) and everything that lowers the real number
        (attention, kernel launches, the host). The dashed &ldquo;limit&rdquo; is the
        line as tokens per pass grows without bound.
      </p>
    </figure>
  )
}
