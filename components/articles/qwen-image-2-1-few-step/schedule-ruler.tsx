"use client"

import { useState } from "react"

import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Where each sampler actually evaluates the denoiser, on the noise axis.
//
// Every node below is computed from a shipped config or a card, not measured:
//
// - Qwen-Image-2.1, 40 steps: scheduler/scheduler_config.json — exponential
//   time shift with mu = calculate_shift(tokens, 256, 8192, 0.5, 0.9),
//   sigma' = e^mu / (e^mu + (1/sigma - 1)), then shift_terminal 0.02 stretches
//   the schedule so its last non-zero node is 0.02. Tokens = (H/16) x (W/16).
// - Viggle v0.2.1: raw nodes [1, 0.9375, 0.875, 0.75, 0.5, 0.25] (6 steps) and
//   [1, 0.9375, 0.875, 0.75, 0.625, 0.5, 0.25, 0.125] (8 steps, dense text),
//   through the same dynamic shift with shift_terminal null (the repo's
//   scheduler_config.json), as the card and comfyui/viggle_turbo.py both state.
// - Pruna v0.1: sigmas used as given, shift 1.0, dynamic shifting off:
//   5-step [1, 0.94, 6/7, 2/3, 0.4], 8-step [1, 14/15, 6/7, 10/13, 2/3, 6/11,
//   0.4, 2/9] — the second is 2t / (1 + t) on eighths, i.e. a fixed shift of 2.
//
// The point it makes: at 1024 x 1024 the pipeline's own shift is e^mu = 2.0008,
// so Viggle's nodes land on Pruna's shift-2 grid. At 2048 they do not.

const RES = [1024, 1536, 2048] as const

const muOf = (px: number) => {
  const tokens = (px / 16) * (px / 16)
  return 0.5 + ((0.9 - 0.5) * (tokens - 256)) / (8192 - 256)
}
const shiftExp = (s: number, em: number) => em / (em + (1 / s - 1))

function base40(em: number): number[] {
  const n = 40
  const raw = Array.from({ length: n }, (_, i) => 1 - (i * (1 - 1 / n)) / (n - 1))
  const sh = raw.map((s) => shiftExp(s, em))
  const scale = (1 - sh[n - 1]) / (1 - 0.02)
  return sh.map((s) => 1 - (1 - s) / scale)
}

const PRUNA5 = [1, 0.94, 6 / 7, 2 / 3, 0.4]
const PRUNA8 = [1, 14 / 15, 6 / 7, 10 / 13, 2 / 3, 6 / 11, 0.4, 2 / 9]
const VIGGLE6 = [1, 0.9375, 0.875, 0.75, 0.5, 0.25]
const VIGGLE8 = [1, 0.9375, 0.875, 0.75, 0.625, 0.5, 0.25, 0.125]

const X0 = 150
const X1 = 620
const xOf = (sigma: number) => Math.round((X0 + (1 - sigma) * (X1 - X0)) * 100) / 100

export function ScheduleRuler() {
  const [res, setRes] = useState<(typeof RES)[number]>(1024)
  const mu = muOf(res)
  const em = mexp(mu)

  const rows = [
    { label: "Qwen-Image-2.1", sub: "40 steps", nodes: base40(em), tone: "text-foreground/50", r: 2 },
    { label: "Viggle v0.2.1", sub: "6 steps", nodes: VIGGLE6.map((s) => shiftExp(s, em)), tone: "text-foreground", r: 4 },
    { label: "Viggle v0.2.1", sub: "8 steps, text", nodes: VIGGLE8.map((s) => shiftExp(s, em)), tone: "text-foreground", r: 4 },
    { label: "Pruna v0.1", sub: "8 steps", nodes: PRUNA8, tone: "text-emerald-600 dark:text-emerald-400", r: 4 },
    { label: "Pruna v0.1", sub: "5 steps", nodes: PRUNA5, tone: "text-emerald-600 dark:text-emerald-400", r: 4 },
  ]

  // Viggle-8 nodes that sit on a Pruna-8 node to within 0.001
  const shared = rows[2].nodes.filter((a) => PRUNA8.some((b) => Math.abs(a - b) < 0.001)).length
  const guides = [6 / 7, 2 / 3, 0.4]
  const H = 44 * rows.length + 40

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-schedule-ruler={res}
      aria-label="Sigma schedules of the base model and the two few-step students on one noise axis"
    >
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">output, square</span>
        {RES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRes(r)}
            aria-pressed={res === r}
            className={cn(
              "rounded-sm border px-2.5 py-0.5 font-mono text-xs tabular-nums",
              res === r
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {r}px
          </button>
        ))}
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          pipeline shift e<sup>mu</sup> = {em.toFixed(4)}
        </span>
      </div>

      <svg viewBox={`0 0 640 ${H}`} className="block h-auto w-full" role="img"
        aria-label={`At ${res}px, ${shared} of the 8 Viggle nodes coincide with Pruna's 8-step nodes.`}>
        {res === 1024 &&
          guides.map((g) => (
            <g key={g}>
              <line x1={xOf(g)} x2={xOf(g)} y1={14} y2={H - 26} className="stroke-foreground/25" strokeDasharray="3 3" />
            </g>
          ))}
        {rows.map((row, i) => {
          const y = 34 + i * 44
          return (
            <g key={`${row.label}-${row.sub}`} className={row.tone}>
              <text x={8} y={y - 2} className="fill-foreground font-mono text-[11px]">
                {row.label}
              </text>
              <text x={8} y={y + 12} className="fill-muted-foreground font-mono text-[10px]">
                {row.sub}
              </text>
              <line x1={X0} x2={X1} y1={y} y2={y} className="stroke-foreground/20" />
              {row.nodes.map((s, j) => (
                <circle key={j} cx={xOf(s)} cy={y} r={row.r} fill="currentColor" />
              ))}
              <circle cx={X1} cy={y} r={row.r} fill="none" stroke="currentColor" />
            </g>
          )
        })}
        <text x={X0} y={H - 8} className="fill-muted-foreground font-mono text-[10px]">
          sigma 1, pure noise
        </text>
        <text x={X1} y={H - 8} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
          0, image
        </text>
      </svg>

      <div className="border-t px-4 py-3 text-sm">
        {res === 1024 ? (
          <p className="my-0">
            At 1024px the pipeline&apos;s own shift is{" "}
            <span className="font-mono tabular-nums">{em.toFixed(4)}</span>, within 0.001
            of Pruna&apos;s hard-coded 2. {shared} of Viggle&apos;s 8 dense-text nodes, counting
            the start at 1, sit on Pruna&apos;s 8-step nodes; the dashed guides are the three
            that every student schedule here shares: 6/7, 2/3 and 2/5.
          </p>
        ) : (
          <p className="my-0">
            At {res}px Viggle&apos;s nodes move with the pipeline&apos;s shift, to{" "}
            <span className="font-mono tabular-nums">{em.toFixed(4)}</span>, and spend more
            of the budget at high noise, as the base model does. Pruna&apos;s do not move: they
            are the schedule it trained at 1K, and its card calls 2K outside the training
            coverage.{" "}
            {shared <= 1
              ? "Only the starting node, sigma 1, still coincides."
              : `${shared} of Viggle's 8 nodes still coincide.`}
          </p>
        )}
      </div>
      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Computed from each repo&apos;s scheduler config and card, not measured. Filled dots are
        where the denoiser runs; the hollow dot at 0 is the image. The base row includes the
        shift_terminal stretch that makes its last non-zero node 0.02; both students switch it
        off.
      </figcaption>
    </figure>
  )
}
