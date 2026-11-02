"use client"

import { useState } from "react"

import { Chip, Ev, Panel, Src, Tag, type Tone } from "./ui"

// The table for a command no execpolicy rule matched: core/src/exec_policy.rs:796-880 (render_decision_for_unmatched_command).
// The retry rules after a sandbox denial: core/src/tools/orchestrator.rs:436-500.
type Policy = "never" | "unless-trusted" | "on-request" | "granular"
type Result = { verdict: "Allow" | "Prompt" | "Forbidden"; why: string }

function decide(policy: Policy, restricted: boolean, dangerous: boolean, escalate: boolean, granularPrompts: boolean): Result {
  if (dangerous) {
    if (policy === "never") return { verdict: "Forbidden", why: "dangerous command and approval policy is never: nothing may ask" }
    if (policy === "granular" && !granularPrompts) return { verdict: "Forbidden", why: "dangerous command; this granular setting rejects that prompt category" }
    return { verdict: "Prompt", why: "dangerous command: the user is asked" }
  }
  if (policy === "never") return { verdict: "Allow", why: "the sandbox is the protection" }
  if (policy === "unless-trusted") return { verdict: "Prompt", why: "unless-trusted asks about anything an explicit rule did not allow" }
  if (!restricted) return { verdict: "Allow", why: "the filesystem sandbox is unrestricted or enforced outside" }
  if (escalate) {
    if (policy === "granular" && !granularPrompts) return { verdict: "Forbidden", why: "the call asks to leave the sandbox and this granular setting rejects that prompt" }
    return { verdict: "Prompt", why: "the call asks to run outside the sandbox or with wider permissions" }
  }
  return { verdict: "Allow", why: "on-request: it runs inside the sandbox; the model must ask to leave it" }
}

const AFTER_DENIAL: Record<Policy, string> = {
  never: "A concise sandbox denial is returned with the original output. There is no retry outside the sandbox.",
  "on-request": "A concise sandbox denial is returned, with one exception: a blocked network request may produce an approval prompt. The model has to ask to leave the sandbox itself.",
  "unless-trusted": "The harness asks for approval to retry without the sandbox, then runs the second attempt outside it (or with widened permissions).",
  granular: "Depends on the granular booleans: if sandbox approval is enabled the harness asks to retry; otherwise the denial is returned.",
}
const TONE: Record<Result["verdict"], Tone> = { Allow: "emerald", Prompt: "amber", Forbidden: "rose" }

export function ApprovalGrid() {
  const [policy, setPolicy] = useState<Policy>("on-request")
  const [restricted, setRestricted] = useState(true)
  const [dangerous, setDangerous] = useState(false)
  const [escalate, setEscalate] = useState(false)
  const [gp, setGp] = useState(true)
  const r = decide(policy, restricted, dangerous, escalate, gp)
  const row = (label: string, opts: [string, boolean, () => void][]) => (
    <div className="flex flex-wrap items-center gap-1.5"><span className="w-44 shrink-0 text-[12px] text-muted-foreground">{label}</span>{opts.map(([l, on, f]) => (<Chip key={l} active={on} onClick={f}>{l}</Chip>))}</div>
  )
  return (
    <Panel title="Does this command run, ask, or stop? The table, live" sub="for a command that no execpolicy rule matched">
      <div className="space-y-2">
        {row("approval policy", (["never", "unless-trusted", "on-request", "granular"] as Policy[]).map((p) => [p, policy === p, () => setPolicy(p)] as [string, boolean, () => void]))}
        {row("filesystem sandbox", [["restricted", restricted, () => setRestricted(true)], ["unrestricted or external", !restricted, () => setRestricted(false)]])}
        {row("built-in danger check", [["not flagged", !dangerous, () => setDangerous(false)], ["flagged (rm with a force flag)", dangerous, () => setDangerous(true)]])}
        {row("the call asks to leave the sandbox", [["no", !escalate, () => setEscalate(false)], ["yes", escalate, () => setEscalate(true)]])}
        {policy === "granular" ? row("granular: this prompt category", [["allowed", gp, () => setGp(true)], ["rejected", !gp, () => setGp(false)]]) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Tag tone={TONE[r.verdict]}>{r.verdict}</Tag>
        <span className="text-[13px]">{r.why}</span>
      </div>
      {r.verdict === "Allow" ? (
        <div className="mt-3 rounded-lg border border-border p-3 text-[12.5px]">
          <div className="mb-1 flex items-center gap-2 font-medium">If the sandbox then denies it <Ev kind="READ" /></div>
          <p className="text-muted-foreground">{AFTER_DENIAL[policy]}</p>
          <p className="mt-1 text-muted-foreground">Even a retry is reviewed on the action&apos;s actual authority: a comment in the code says a Guardian verdict &ldquo;only covers the authority of the reviewed action&rdquo; (<code>orchestrator.rs:492</code>).</p>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">A command allowed by an explicit rule can additionally skip the sandbox, but only if every segment of it is explicitly allowed (<Src>exec_policy.rs:468-481</Src>). Table: <Src>exec_policy.rs:796-880</Src> · retries: <Src>orchestrator.rs:436-500</Src>.</p>
    </Panel>
  )
}
