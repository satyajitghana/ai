// The one thing in OpenMuse that a swapped-in agent can never reach: the path
// from "the model wrote an email" to "the email left the building".
//
// Read from apps/server/src/actions.ts (202 lines) and the claim() statement in
// apps/server/src/db.ts. Every predicate below is in one of those two files;
// the SQL is quoted verbatim apart from line breaks.
//
// The reason this is worth drawing rather than describing: the TypeScript
// checks in decide() are advisory, and the authoritative ones are the WHERE
// clause of a single UPDATE. Two approvals racing each other both pass the
// TypeScript and exactly one gets a row back. That is the difference between a
// confirmation dialog and a gate.
//
// Server-rendered, zero JS.

type Step = {
  stage: string
  where: string
  lines: { text: string; mono?: boolean }[]
  tone?: "gate" | "terminal"
}

const STEPS: Step[] = [
  {
    stage: "1 · the model prepares",
    where: "engine/model.ts",
    lines: [
      { text: "prepare_email(draft) or prepare_event(draft)", mono: true },
      { text: "the task is set to waiting_approval and the run stops" },
      { text: "no tool exists that can approve it" },
    ],
  },
  {
    stage: "2 · the server binds it",
    where: "actions.ts · propose()",
    lines: [
      { text: "hash = sha256({ input, connection, target, targetVersion })", mono: true },
      { text: "account and connectionId are copied onto the proposal" },
      { text: "expiresAt = now + 30 minutes", mono: true },
    ],
  },
  {
    stage: "3 · a person decides",
    where: "POST /api/actions/:id/decide",
    tone: "gate",
    lines: [
      { text: "the request must carry the hash it was shown" },
      { text: "the linked task must still be running or waiting_approval" },
      { text: "Google must still be connected, same account, same connectionId" },
      { text: "past expiresAt the proposal flips to expired instead", mono: true },
    ],
  },
  {
    stage: "4 · one row wins",
    where: "db.ts · claim()",
    tone: "gate",
    lines: [
      { text: "UPDATE … WHERE status='awaiting_review'", mono: true },
      { text: "AND expiresAt > now", mono: true },
      { text: "AND EXISTS (task IN ('running','waiting_approval'))", mono: true },
      { text: "RETURNING data — null means someone else already decided", mono: true },
    ],
  },
]

const OUTCOMES: { status: string; note: string; tone: "ok" | "bad" | "unknown" }[] = [
  { status: "succeeded", note: "the provider acknowledged it", tone: "ok" },
  { status: "denied", note: "declined; no changes made", tone: "bad" },
  { status: "expired", note: "the 30 minutes ran out", tone: "bad" },
  { status: "failed", note: "the provider refused it", tone: "bad" },
  {
    status: "outcome_unknown",
    note: "the network gave no answer, or the server restarted mid-flight — never retried automatically",
    tone: "unknown",
  },
]

const TONE = {
  ok: "oklch(0.58 0.15 152)",
  bad: "oklch(0.556 0 0)",
  unknown: "oklch(0.62 0.15 85)",
}

export function ProposalGate() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">one external write, end to end</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          8 statuses · 0 model-reachable approvals
        </span>
      </div>

      <ol className="my-0 list-none space-y-0 pl-0">
        {STEPS.map((step) => (
          <li key={step.stage} className="border-b px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span
                className={
                  step.tone === "gate"
                    ? "text-xs font-medium text-foreground"
                    : "text-xs text-foreground"
                }
              >
                {step.stage}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{step.where}</span>
            </div>
            <ul className="mt-1.5 list-none space-y-1 pl-0">
              {step.lines.map((line) => (
                <li
                  key={line.text}
                  className={
                    line.mono
                      ? "font-mono text-[11px] leading-5 text-muted-foreground"
                      : "text-[11px] leading-5 text-muted-foreground"
                  }
                >
                  {line.text}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="px-4 py-3">
        <div className="font-mono text-[10px] text-muted-foreground">terminal states</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {OUTCOMES.map((outcome) => (
            <span
              key={outcome.status}
              className="inline-flex min-w-0 items-baseline gap-2 rounded-md border px-2 py-1"
              style={{ borderColor: TONE[outcome.tone] }}
            >
              <span className="font-mono text-[11px] text-foreground">{outcome.status}</span>
              <span className="text-[11px] text-muted-foreground">{outcome.note}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The state worth noticing is the yellow one. Most systems collapse &ldquo;it failed&rdquo;
        and &ldquo;I do not know whether it happened&rdquo; into one bucket and then retry, which
        is how a person ends up sending the same email twice. OpenMuse keeps them apart, and a
        server restart sweeps every row still marked{" "}
        <span className="font-mono">executing</span> into{" "}
        <span className="font-mono">outcome_unknown</span> with the message{" "}
        <em>&ldquo;Check the provider before creating another action.&rdquo;</em>{" "}
        That is one SQL statement in{" "}
        <span className="font-mono">recoverInterruptedActions()</span>, and it is the sort of
        thing that only exists because someone thought about the crash.
      </p>
    </figure>
  )
}
