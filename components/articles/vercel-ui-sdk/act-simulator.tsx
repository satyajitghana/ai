"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One agent.act call on the project-settings screen from Vercel's launch video:
// "Move the project to Asia Pacific, switch to Pro, run 3 instances and turn on
// preview deployments." Four steps, one call. The rules are the SDK's, read from
// vercel-labs/ui at c53df2f4 (agent.ts and docs/agents/connect-an-agent):
//   - steps run in order and the call stops at the first that fails;
//     earlier steps stay applied, there is no rollback
//   - a step on an element inside data-agent-confirm fails with "Needs a person"
//     when there is no allow callback, and waits for allow when there is one
//   - a change callback can cancel an agent's change: the step still completes,
//     with no change, and ok stays true
// The result follows the shape in the reference (ok, error, steps, values).
// A static simulation of those rules, not the SDK running.

type Field = { ref: string; label: string; component: string; key: "value" | "checked"; from: string | number | boolean }

const FIELDS: Field[] = [
  { ref: "c1", label: "Region", component: "select", key: "value", from: "europe" },
  { ref: "c2", label: "Plan", component: "segmented-control", key: "value", from: "hobby" },
  { ref: "c3", label: "Instances", component: "number-input", key: "value", from: 1 },
  { ref: "c4", label: "Preview deployments", component: "switch", key: "checked", from: false },
]

const STEPS = [
  { ref: "Region", action: "setValue", args: ["Asia Pacific"], to: "asia-pacific" },
  { ref: "Plan", action: "setValue", args: ["Pro"], to: "pro" },
  { ref: "Instances", action: "setValue", args: [3], to: 3 },
  { ref: "Preview deployments", action: "setChecked", args: [true], to: true },
] as const

const CONFIRM = "Changes what this project is billed"

type Allow = "none" | "yes" | "no"

function run(mark: boolean, allow: Allow, cancelRegion: boolean) {
  const values: Record<string, string | number | boolean> = {}
  for (const f of FIELDS) values[f.ref] = f.from
  const done: { step: number; ref: string; changes: { component: string; label: string; key: string; value: unknown }[] }[] = []
  let error: { step: number; message: string } | undefined
  const asked: number[] = []

  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i]
    const f = FIELDS[i]
    if (i === 1 && mark) {
      if (allow === "none") {
        error = { step: i, message: `Needs a person: "${CONFIRM}". Ask them to make this change themselves.` }
        break
      }
      asked.push(i)
      if (allow === "no") {
        error = { step: i, message: `The person said no to "${CONFIRM}".` }
        break
      }
    }
    if (i === 0 && cancelRegion) {
      done.push({ step: i, ref: f.ref, changes: [] })
      continue
    }
    values[f.ref] = s.to
    done.push({ step: i, ref: f.ref, changes: [{ component: f.component, label: f.label, key: f.key, value: s.to }] })
  }

  const result: Record<string, unknown> = { ok: !error }
  if (error) result.error = error
  result.steps = done
  result.values = Object.fromEntries(FIELDS.map((f) => [`${f.ref} ${f.label}`, values[f.ref]]))
  return { result, values, asked, applied: done.length, failedAt: error?.step }
}

const show = (v: unknown) => (typeof v === "string" ? v : String(v))

export function ActSimulator() {
  const [mark, setMark] = useState(false)
  const [allow, setAllow] = useState<Allow>("none")
  const [cancelRegion, setCancelRegion] = useState(false)
  const out = run(mark, allow, cancelRegion)

  const call = {
    steps: STEPS.map(({ ref, action, args }) => ({ ref, action, args })),
  }

  return (
    <div className="not-prose my-8 border border-border bg-card p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">One act call, four steps</div>
        <div className="font-mono text-xs text-muted-foreground">rules from agent.ts @ c53df2f4</div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} className="mt-1" />
          <span>
            Put <code className="text-xs">data-agent-confirm</code> on Plan
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span>
            <code className="text-xs">allow</code> callback
          </span>
          <select
            value={allow}
            onChange={(e) => setAllow(e.target.value as Allow)}
            className="border border-border bg-background px-2 py-1 font-mono text-xs"
          >
            <option value="none">none passed</option>
            <option value="yes">asks the person: yes</option>
            <option value="no">asks the person: no</option>
          </select>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={cancelRegion}
            onChange={(e) => setCancelRegion(e.target.checked)}
            className="mt-1"
          />
          <span>
            Region&apos;s <code className="text-xs">onValueChange</code> cancels an agent&apos;s Asia Pacific
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Project settings, after the call</div>
          <ul className="space-y-1">
            {FIELDS.map((f, i) => {
              const changed = out.values[f.ref] !== f.from
              const failed = out.failedAt === i
              const skipped = out.failedAt !== undefined && i > out.failedAt
              return (
                <li
                  key={f.ref}
                  className={cn(
                    "flex items-center justify-between gap-2 border px-2 py-1.5",
                    failed
                      ? "border-rose-600 bg-rose-500/10"
                      : changed
                        ? "border-emerald-600 bg-emerald-500/10"
                        : "border-border",
                    skipped && "opacity-50",
                  )}
                >
                  <span>
                    {f.label}
                    {i === 1 && mark ? <span className="ml-1 text-xs text-muted-foreground">(confirm)</span> : null}
                  </span>
                  <span className="font-mono text-xs">
                    {changed ? (
                      <>
                        <span className="text-muted-foreground line-through">{show(f.from)}</span>{" "}
                        {show(out.values[f.ref])}
                      </>
                    ) : (
                      show(f.from)
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {out.failedAt !== undefined
              ? `Stopped at step ${out.failedAt}. ${out.applied} earlier step${out.applied === 1 ? "" : "s"} stay applied; there is no rollback.`
              : cancelRegion
                ? "ok is true, yet Region did not move: the step completed with no change."
                : "All four steps ran in one call."}
            {out.asked.length ? " The person was asked once, for Plan." : ""}
          </p>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">The call</div>
          <pre className="mt-1 overflow-x-auto border border-border bg-background p-2 font-mono text-[11px] leading-snug">
            {`agent.act(${JSON.stringify(call, null, 1)})`}
          </pre>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">What act returns</div>
          <pre
            className="max-h-[26rem] overflow-auto border border-border bg-background p-2 font-mono text-[11px] leading-snug"
            aria-live="polite"
          >
            {JSON.stringify(out.result, null, 2)}
          </pre>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A simulation of the bridge&apos;s documented rules on the screen from the launch video, not the SDK running.
        Item values are written the way the SDK resolves a label to a value (&quot;Asia Pacific&quot; to
        &quot;asia-pacific&quot;); the confirm sentence is ours.
      </p>
    </div>
  )
}
