"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the next process does when the one running a libfx turn is SIGKILLed.
//
// The turn is the one I ran locally: libfx 0.0.14 on local() durability, a fake
// OpenAI-compatible model on localhost, and two tools. The model asks for
// get_order (idempotent: true), then refund_order (writes: true), then answers.
// The outcomes for a kill inside each tool are measured (see the article's
// table), as is a kill inside model request #2; kills inside #1 and #3 are
// reasoned from that run and the README.

const ACCENT = "oklch(0.60 0.15 40)"
const OK = "oklch(0.62 0.13 150)"
const WARN = "oklch(0.62 0.17 25)"

type Kind = "model" | "tool" | "store"
type Step = { key: string; label: string; sub: string; kind: Kind }

const STEPS: Step[] = [
  { key: "p", label: "prompt", sub: "stored first", kind: "store" },
  { key: "m1", label: "model #1", sub: "asks get_order", kind: "model" },
  { key: "t1", label: "get_order", sub: "idempotent", kind: "tool" },
  { key: "m2", label: "model #2", sub: "asks refund", kind: "model" },
  { key: "t2", label: "refund_order", sub: "writes", kind: "tool" },
  { key: "m3", label: "model #3", sub: "final reply", kind: "model" },
]

type Outcome = {
  replayed: number // steps before the crash that come back from the log
  rerun: string
  hears: string
  requests: string
  refunds: string
  label: "measured" | "reasoned"
}

function outcome(crash: number, refundIdempotent: boolean): Outcome {
  if (crash === 1)
    return {
      replayed: 1,
      rerun: "The request to the model is sent again from the stored prompt.",
      hears: "\"Resuming from unexpected session interruption.\"",
      requests: "4: the cut-off request is sent twice",
      refunds: "1",
      label: "reasoned",
    }
  if (crash === 2)
    return {
      replayed: 2,
      rerun:
        "get_order runs again. If its call was stored before the kill it reruns under the same executionId; if not, the model is asked again and the call gets a new one.",
      hears: "\"Resuming from unexpected session interruption.\"",
      requests: "3 in 5 of 9 runs, 4 in the other 4",
      refunds: "1",
      label: "measured",
    }
  if (crash === 3)
    return {
      replayed: 3,
      rerun:
        "Model request #2 is sent again. get_order's stored result was reused in 2 of 3 runs; in the third it ran again under the same executionId, which its idempotent flag allows.",
      hears: "\"Resuming from unexpected session interruption.\"",
      requests: "4: the cut-off request is sent twice",
      refunds: "1",
      label: "measured",
    }
  if (crash === 4)
    return refundIdempotent
      ? {
          replayed: 4,
          rerun: "refund_order runs again under the same executionId (call_refund_order). Pass it on as an idempotency key.",
          hears: "the refund's real result, then \"Continue from the confirmed tool result above without repeating the tool.\"",
          requests: "3: none repeated",
          refunds: "2 calls, 1 executionId",
          label: "measured",
        }
      : {
          replayed: 4,
          rerun: "Nothing. refund_order is never started a second time.",
          hears:
            "an error result: \"fx stopped while this tool was running, so it may have partly run. Check its effects before running it again.\"",
          requests: "3: none repeated",
          refunds: "1 (or 0: the model must check)",
          label: "measured",
        }
  return {
    replayed: 5,
    rerun: "Model request #3 is sent again; both tool results come from the log.",
    hears: "\"Resuming from unexpected session interruption.\"",
    requests: "4: the cut-off request is sent twice",
    refunds: "1",
    label: "reasoned",
  }
}

const W = 760
const H = 150
const X0 = 24
const GAP = 8
const BW = (W - 2 * X0 - GAP * (STEPS.length - 1)) / STEPS.length

export function CrashReplay() {
  const [crash, setCrash] = useState(4)
  const [idem, setIdem] = useState(false)
  const o = outcome(crash, idem)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`One libfx turn of six steps, killed during ${STEPS[crash].label}. The next process replays ${o.replayed} stored steps from the session log. ${o.rerun}`}
      >
        <text x={X0} y={20} className="fill-muted-foreground font-mono" fontSize={9.5}>
          ONE TURN · CLICK A STEP TO SIGKILL THE PROCESS THERE
        </text>
        {STEPS.map((s, i) => {
          const x = X0 + i * (BW + GAP)
          const before = i < crash
          const here = i === crash
          const stroke = here ? WARN : before ? OK : "var(--border)"
          return (
            <g
              key={s.key}
              onClick={() => i > 0 && setCrash(i)}
              style={{ cursor: i > 0 ? "pointer" : "default" }}
            >
              <rect
                x={x}
                y={36}
                width={BW}
                height={56}
                rx={8}
                fill="var(--background)"
                stroke={stroke}
                strokeWidth={here ? 2.2 : 1.4}
                strokeDasharray={s.kind === "tool" ? "0" : s.kind === "store" ? "4 3" : "0"}
              />
              <text x={x + BW / 2} y={60} textAnchor="middle" className="fill-foreground font-mono" fontSize={11}>
                {s.label}
              </text>
              <text x={x + BW / 2} y={76} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {s.sub}
              </text>
              <text
                x={x + BW / 2}
                y={112}
                textAnchor="middle"
                className="font-mono"
                fontSize={9}
                fill={here ? WARN : before ? OK : "var(--muted-foreground)"}
              >
                {here ? "killed here" : before ? "from the log" : "runs after"}
              </text>
            </g>
          )
        })}
        <text x={X0} y={138} className="fill-muted-foreground font-mono" fontSize={9}>
          green: stored before the kill, replayed into the new engine without running again
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">kill during</span>
        {STEPS.slice(1).map((s, j) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setCrash(j + 1)}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
              crash === j + 1 ? "border-foreground/40 bg-foreground/[0.06]" : "hover:bg-muted/50",
            )}
          >
            {s.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 font-mono text-[11px]">
          <input type="checkbox" checked={idem} onChange={(e) => setIdem(e.currentTarget.checked)} />
          refund_order idempotent: true
        </label>
      </div>

      <dl className="grid gap-x-4 gap-y-2 border-t px-4 py-3 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="font-mono text-xs text-muted-foreground">runs again</dt>
        <dd>{o.rerun}</dd>
        <dt className="font-mono text-xs text-muted-foreground">the model hears</dt>
        <dd>{o.hears}</dd>
        <dt className="font-mono text-xs text-muted-foreground">model requests</dt>
        <dd className="font-mono text-xs">{o.requests}</dd>
        <dt className="font-mono text-xs text-muted-foreground">refund side effects</dt>
        <dd className="font-mono text-xs">{o.refunds}</dd>
        <dt className="font-mono text-xs text-muted-foreground">label</dt>
        <dd className="font-mono text-xs" style={{ color: o.label === "measured" ? OK : ACCENT }}>
          {o.label}
        </dd>
      </dl>

      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        Tool-kill outcomes are measured: libfx 0.0.14, local() durability, a fake model on
        localhost, SIGKILL, then session.resume() in a fresh process, on a shared 4-core cloud
        VM. I killed one model request (#2); the other two are reasoned from it and the README.
      </figcaption>
    </figure>
  )
}
