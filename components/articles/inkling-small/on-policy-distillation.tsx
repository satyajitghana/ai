"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// The mechanism this whole article is about: who GENERATES the reasoning trace,
// and who SCORES it.
//
// Off-policy (ordinary distillation / SFT-on-teacher-text): the TEACHER generates
// the trace; the student is trained by cross-entropy to reproduce those exact
// tokens. At inference the student has to generate its OWN tokens from its OWN
// distribution — the moment a sampled token differs from what the teacher would
// have produced, the student is in a state it never trained on, and every step
// after that is compounding drift (exposure bias).
//
// On-policy distillation (what Inkling-Small's post-training uses): the STUDENT
// generates the full trace under its own policy; the TEACHER only grades the
// tokens the student actually produced. There is no reference trajectory to fall
// off of, because training always happens on the student's real distribution.
//
// Fixed 8-step illustrative trace; the divergence step (5) and the teacher scores
// are fixed constants, not random — this is a mechanism diagram, not live data.

const ACCENT = "oklch(0.58 0.16 285)" // on-policy / matched
const WARN = "oklch(0.70 0.16 40)" // divergence marker
const DRIFT = "oklch(0.62 0.02 260)" // off-distribution / drifted

type Mode = "off-policy" | "on-policy"

const STEPS = 8
const DIVERGE_AT = 5 // off-policy: student's real sample first differs from teacher here

// fixed illustrative teacher scores for the student's own tokens (on-policy mode)
const SCORES = [0.93, 0.9, 0.95, 0.84, 0.91, 0.88, 0.94, 0.9]

const W = 760
const H = 260
const COL0 = 70
const COL_W = 80
const ROW_TEACHER = 54
const ROW_STUDENT = 168
const NODE_W = 56
const NODE_H = 30

const colX = (i: number) => COL0 + i * COL_W

export function OnPolicyDistillation() {
  const [mode, setMode] = useState<Mode>("off-policy")
  const [step, setStep] = useState(4) // 1-indexed step under inspection

  const stepIdx = step - 1
  const isOff = mode === "off-policy"

  // per-step status for off-policy: "copy" while <= DIVERGE_AT-1, "diverge" at
  // DIVERGE_AT, "drift" after
  const offStatus = (i1: number): "copy" | "diverge" | "drift" => {
    if (i1 < DIVERGE_AT) return "copy"
    if (i1 === DIVERGE_AT) return "diverge"
    return "drift"
  }

  const currentStatus = offStatus(step)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>who generates, who scores</span>
        <span className="text-muted-foreground/60">8-step illustrative trace</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 inline-flex rounded-lg border p-0.5">
          <button
            type="button"
            onClick={() => setMode("off-policy")}
            className={
              "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
              (isOff
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={isOff}
          >
            off-policy (SFT on teacher text)
          </button>
          <button
            type="button"
            onClick={() => setMode("on-policy")}
            className={
              "rounded-md px-3 py-1 font-mono text-xs transition-colors " +
              (!isOff
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
            aria-pressed={!isOff}
          >
            on-policy distillation
          </button>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            isOff
              ? "Off-policy diagram: the teacher generates a token sequence and the student is trained to copy it by cross-entropy. At inference the student samples its own tokens; once a sampled token differs from the teacher's, every later step is a state the student never trained on."
              : "On-policy distillation diagram: the student generates its own token sequence under its own policy, and the teacher only scores the tokens the student actually produced — there is no reference trajectory to drift away from."
          }
        >
          <text x={COL0 - 14} y={ROW_TEACHER + NODE_H / 2 + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            teacher
          </text>
          <text x={COL0 - 14} y={ROW_STUDENT + NODE_H / 2 + 4} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={11}>
            student
          </text>

          {Array.from({ length: STEPS }, (_, k) => {
            const i1 = k + 1
            const x = colX(k)
            const isCurrent = i1 === step

            // off-policy coloring
            const status = offStatus(i1)
            const teacherFill = "var(--background)"
            const teacherStroke = isOff
              ? status === "drift"
                ? DRIFT
                : status === "diverge"
                  ? WARN
                  : ACCENT
              : "var(--border)"
            const studentStroke = isOff
              ? status === "drift"
                ? DRIFT
                : status === "diverge"
                  ? WARN
                  : ACCENT
              : ACCENT

            return (
              <g key={i1}>
                {/* teacher node */}
                <rect
                  x={x - NODE_W / 2}
                  y={ROW_TEACHER}
                  width={NODE_W}
                  height={NODE_H}
                  rx={7}
                  fill={teacherFill}
                  stroke={isOff ? teacherStroke : "var(--border)"}
                  strokeWidth={isCurrent ? 2 : 1.25}
                  opacity={isOff ? 1 : 0.55}
                />
                <text x={x} y={ROW_TEACHER + NODE_H / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                  t{i1}
                </text>

                {/* connector: off-policy = teacher supervises student (down arrow);
                    on-policy = teacher scores student (up arrow) */}
                <line
                  x1={x}
                  x2={x}
                  y1={isOff ? ROW_TEACHER + NODE_H : ROW_STUDENT}
                  y2={isOff ? ROW_STUDENT : ROW_TEACHER + NODE_H}
                  stroke={isOff ? teacherStroke : ACCENT}
                  strokeWidth={isCurrent ? 2 : 1}
                  strokeDasharray={isOff && status === "drift" ? "3 3" : undefined}
                  opacity={isOff ? (status === "drift" ? 0.45 : 0.9) : 0.5 + (isCurrent ? 0.4 : 0)}
                  markerEnd={isOff ? undefined : "url(#opd-arrow)"}
                />

                {/* student node */}
                <rect
                  x={x - NODE_W / 2}
                  y={ROW_STUDENT}
                  width={NODE_W}
                  height={NODE_H}
                  rx={7}
                  fill={isCurrent ? "var(--muted)" : "var(--background)"}
                  stroke={studentStroke}
                  strokeWidth={isCurrent ? 2 : 1.25}
                />
                <text x={x} y={ROW_STUDENT + NODE_H / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                  s{i1}
                </text>

                {/* on-policy: teacher score under the connector */}
                {!isOff && (
                  <text
                    x={x}
                    y={(ROW_TEACHER + NODE_H + ROW_STUDENT) / 2 + 4}
                    textAnchor="middle"
                    className="fill-muted-foreground font-mono"
                    fontSize={9}
                  >
                    {SCORES[k].toFixed(2)}
                  </text>
                )}
              </g>
            )
          })}

          <defs>
            <marker id="opd-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 1 1 L 8 5 L 1 9" fill="none" stroke={ACCENT} strokeWidth="1.5" />
            </marker>
          </defs>

          {/* current-step marker */}
          <line
            x1={colX(stepIdx)}
            x2={colX(stepIdx)}
            y1={12}
            y2={H - 30}
            stroke="currentColor"
            className="text-foreground/20"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        </svg>

        <div className="mt-1 mb-2 rounded-md border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          {isOff ? (
            currentStatus === "copy" ? (
              <>step {step}: teacher token copied — student is trained to match it exactly (cross-entropy).</>
            ) : currentStatus === "diverge" ? (
              <>
                step {step}: <span style={{ color: WARN }}>at inference</span>, the student samples its own
                token here — the first point it can differ from the teacher&rsquo;s trace.
              </>
            ) : (
              <>
                step {step}: <span style={{ color: DRIFT }}>never seen in training</span>{" "}— once step {DIVERGE_AT}{" "}
                diverges, every later state is off the trained distribution.
              </>
            )
          ) : (
            <>
              step {step}: the student generated <span style={{ color: ACCENT }}>s{step}</span>{" "}itself; the
              teacher scores that exact token at <span className="text-foreground">{SCORES[stepIdx].toFixed(2)}</span>{" "}—
              no reference trace to fall off of.
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">rollout step</span>
          <Range
            min={1}
            max={STEPS}
            step={1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
          />
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{step}/{STEPS}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="font-mono">off-policy</span>: the teacher generates the trace and the student is
          trained to reproduce it token-for-token. That works only until inference, when the student must
          generate from its <em>own</em>{" "}distribution — the instant a sampled token departs from the teacher&apos;s
          path (step {DIVERGE_AT} above), the student is in a state training never covered, and errors
          compound for every step after.{" "}
          <span className="font-mono">on-policy distillation</span>{" "}removes the reference trace entirely:
          the student always generates its own rollout, and the teacher only grades the tokens that actually
          got produced. There is nothing to drift away from, which is exactly what a long autoregressive
          reasoning chain needs.
        </p>
      </div>
    </figure>
  )
}
