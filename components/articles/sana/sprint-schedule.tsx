"use client"

import { useState } from "react"

import { matan, mcos, mlog10, msin, mtan } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// SANA-Sprint's inference timestep schedule, from both sources at once.
//
// SHIPPED (diffusion/scheduler/scm_scheduler.py, SCMScheduler.set_timesteps):
//
//     if timesteps is not None and len(timesteps) == num_inference_steps + 1:
//         self.timesteps = ...                       # caller supplies them
//     elif intermediate_timesteps and num_inference_steps == 2:
//         self.timesteps = [max_timesteps, intermediate_timesteps, 0]
//     elif intermediate_timesteps:
//         self.timesteps = linspace(max_timesteps, 0, num_inference_steps + 1)
//         print("Intermediate timesteps for SCM is not supported when
//                num_inference_steps != 2. Reset timesteps to ...")
//     else:
//         self.timesteps = linspace(max_timesteps, 0, num_inference_steps + 1)
//
// with defaults max_timesteps = 1.57080 (= pi/2) and intermediate_timesteps =
// 1.3 in app/sana_sprint_pipeline.py:61 and scripts/inference_sana_sprint.py:224.
//
// PAPER (SANA-Sprint, arXiv:2503.09641, Table 7 — timesteps found by sequential
// search):
//     1 step  [pi/2, 0]
//     2 steps [arctan(200/0.5), 1.3, 0]
//     4 steps [arctan(200/0.5), 1.3, 1.1, 0.6, 0]
//
// So the 2-step schedule matches, and the 4-step one does not: the shipped
// scheduler falls back to a uniform linspace and prints a warning. You can still
// get the paper's schedule, but only by passing the whole list explicitly.
//
// TrigFlow parameterisation (scm_scheduler.py:157-176):
//     x_t = cos(t) x_0 + sin(t) * z,  z ~ N(0, sigma_d^2 I),  sigma_d = 0.5
//     x0_hat     = cos(s) * x_s - sin(s) * F_theta
//     x_{t}      = cos(t) * x0_hat + sin(t) * sigma_d * z'
// so t = pi/2 is pure noise, t = 0 is the clean sample, and the SNR at t is
// cot^2(t) — sigma_d cancels because the data and the noise share it.

const REPO = "oklch(0.60 0.15 255)"
const PAPER = "oklch(0.68 0.13 85)"
const SIG = "oklch(0.55 0.16 155)"
const NOISE = "oklch(0.62 0.03 250)"

const HALF_PI = 1.5708
const T_SEARCH = matan(200 / 0.5) // arctan(400) = 1.56830

function linspace(hi: number, n: number) {
  const out: number[] = []
  for (let i = 0; i <= n; i++) out.push(hi * (1 - i / n))
  return out
}

const STEPS = [1, 2, 4]

function repoSchedule(n: number) {
  if (n === 2) return [HALF_PI, 1.3, 0]
  return linspace(HALF_PI, n)
}

function paperSchedule(n: number) {
  if (n === 1) return [HALF_PI, 0]
  if (n === 2) return [T_SEARCH, 1.3, 0]
  return [T_SEARCH, 1.3, 1.1, 0.6, 0]
}

export function SprintSchedule() {
  const [n, setN] = useState(4)

  const repo = repoSchedule(n)
  const paper = paperSchedule(n)
  const same = repo.length === paper.length && repo.every((v, i) => Math.abs(v - paper[i]) < 5e-3)

  const W = 700
  const X0 = 112
  const SPAN = 520
  const x = (t: number) => X0 + (1 - t / HALF_PI) * SPAN // t = pi/2 on the left, t = 0 on the right

  const H = 250

  // signal / noise mix at each shipped timestep
  const mix = repo.map((t) => ({ t, c: Math.abs(mcos(t)), s: Math.abs(msin(t)) }))
  const snrDb = (t: number) => (t <= 1e-6 ? Infinity : 20 * mlog10(Math.abs(1 / mtan(t))))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          SANA-Sprint · TrigFlow timesteps on [0, π/2] · {n} step{n > 1 ? "s" : ""}
        </span>
        <span className="font-mono text-[10px]" style={{ color: same ? SIG : PAPER }}>
          {same ? "shipped default matches the paper" : "shipped default diverges from the paper"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setN(s)}
              aria-pressed={n === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                n === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s} step{s > 1 ? "s" : ""}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`TrigFlow timesteps for ${n}-step SANA-Sprint sampling. The shipped SCMScheduler uses ${repo
                .map((t) => t.toFixed(3))
                .join(", ")}; the paper's searched schedule is ${paper
                .map((t) => t.toFixed(3))
                .join(", ")}. ${
                same
                  ? "They agree."
                  : "They differ: the scheduler falls back to a uniform linspace when the step count is not 2."
              }`}
            </title>

            {/* axis */}
            <line x1={X0} y1={44} x2={X0 + SPAN} y2={44} stroke="currentColor" strokeOpacity={0.2} />
            <text x={X0} y={22} fontSize={8.5} fill={NOISE} fontFamily="ui-monospace, monospace">
              t = π/2 · pure noise
            </text>
            <text x={X0 + SPAN} y={22} fontSize={8.5} textAnchor="end" fill={SIG} fontFamily="ui-monospace, monospace">
              t = 0 · clean sample
            </text>

            {/* shipped schedule */}
            <text x={0} y={38} fontSize={9} fill={REPO} fontFamily="ui-monospace, monospace">
              SCMScheduler
            </text>
            <text x={0} y={50} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              shipped default
            </text>
            {repo.map((t, i) => (
              <g key={`r${i}`}>
                <circle cx={x(t)} cy={44} r={4} fill={REPO} />
                <text
                  x={x(t)}
                  y={i % 2 === 0 ? 36 : 60}
                  fontSize={7.5}
                  textAnchor="middle"
                  fill={REPO}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.toFixed(3)}
                </text>
              </g>
            ))}

            {/* paper schedule */}
            <line x1={X0} y1={94} x2={X0 + SPAN} y2={94} stroke="currentColor" strokeOpacity={0.2} />
            <text x={0} y={88} fontSize={9} fill={PAPER} fontFamily="ui-monospace, monospace">
              Table 7
            </text>
            <text x={0} y={100} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              searched, in paper
            </text>
            {paper.map((t, i) => (
              <g key={`p${i}`}>
                <circle cx={x(t)} cy={94} r={4} fill="none" stroke={PAPER} strokeWidth={1.6} />
                <text
                  x={x(t)}
                  y={i % 2 === 0 ? 86 : 110}
                  fontSize={7.5}
                  textAnchor="middle"
                  fill={PAPER}
                  fontFamily="ui-monospace, monospace"
                >
                  {t.toFixed(3)}
                </text>
              </g>
            ))}

            {/* signal / noise mix at each shipped timestep */}
            <text x={0} y={140} fontSize={9} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
              x_t at each t
            </text>
            <text x={0} y={152} fontSize={7.5} fill={SIG} fontFamily="ui-monospace, monospace">
              cos(t)·x₀
            </text>
            <text x={0} y={163} fontSize={7.5} fill={NOISE} fontFamily="ui-monospace, monospace">
              sin(t)·z
            </text>
            {mix.map((m, i) => {
              const bx = X0 + 14 + i * ((SPAN - 40) / Math.max(1, mix.length - 1)) - 22
              const base = 194
              const unit = 44
              const hSig = m.c * unit
              const hNoise = m.s * unit
              return (
                <g key={`m${i}`}>
                  <rect x={bx} y={base - hSig} width={44} height={Math.max(0.7, hSig)} rx={2} fill={SIG} fillOpacity={0.75} />
                  <rect
                    x={bx}
                    y={base - hSig - hNoise}
                    width={44}
                    height={Math.max(0.7, hNoise)}
                    rx={2}
                    fill={NOISE}
                    fillOpacity={0.28}
                  />
                  <text
                    x={bx + 22}
                    y={208}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.55}
                    fontFamily="ui-monospace, monospace"
                  >
                    t={m.t.toFixed(2)}
                  </text>
                  <text
                    x={bx + 22}
                    y={219}
                    fontSize={7}
                    textAnchor="middle"
                    fill={SIG}
                    fillOpacity={0.8}
                    fontFamily="ui-monospace, monospace"
                  >
                    cos {m.c.toFixed(2)} · sin {m.s.toFixed(2)}
                  </text>
                  <text
                    x={bx + 22}
                    y={230}
                    fontSize={7}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.4}
                    fontFamily="ui-monospace, monospace"
                  >
                    {Number.isFinite(snrDb(m.t)) ? `SNR ${snrDb(m.t).toFixed(0)} dB` : "SNR ∞"}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "network evaluations", v: String(n), c: REPO },
            { l: "t_max shipped", v: repo[0].toFixed(5), c: REPO },
            { l: "t_max in Table 7", v: paper[0].toFixed(5), c: PAPER },
            {
              l: "schedules agree",
              v: same ? "yes" : "no",
              c: same ? SIG : PAPER,
            },
          ].map((s) => (
            <div key={s.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{s.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: s.c }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sprint samples on TrigFlow&rsquo;s arc rather than a [0, 1] line:{" "}
          <span className="font-mono text-[11px] text-foreground">x_t = cos(t)·x₀ + sin(t)·z</span>,
          so t = π/2 is pure noise, t = 0 is the sample, and the signal-to-noise ratio at t is
          exactly cot²(t) — the data scale σ_d = 0.5 cancels, because the noise carries it too. Each
          step predicts x̂₀ from the current x_t, then re-noises to the next t. Nothing about the
          schedule needs the steps to be evenly spaced, which is why it is worth searching.
          <br />
          <br />
          At 1 and 2 steps the shipped defaults are the paper&rsquo;s.{" "}
          <span className="text-foreground">At 4 they are not.</span>{" "}
          <span className="font-mono text-[11px]">SCMScheduler.set_timesteps</span>{" "}only honours{" "}
          <span className="font-mono text-[11px]">intermediate_timesteps</span>{" "}when the step count
          is exactly 2; for anything else it prints a warning, throws the value away and falls back
          to a uniform{" "}
          <span className="font-mono text-[11px]">linspace(1.5708, 0, n+1)</span>. Table 7&rsquo;s
          searched 4-step schedule spends three of its four steps above t = 0.6 — far more of the
          budget in the high-noise regime than a uniform split gives it. You can still get it, but
          only by passing the whole list through the{" "}
          <span className="font-mono text-[11px]">timesteps</span>{" "}argument yourself.
        </p>
      </div>
    </figure>
  )
}
