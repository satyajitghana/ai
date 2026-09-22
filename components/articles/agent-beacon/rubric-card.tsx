// The literal request Beacon sends to the decision model, once per trace.
//
// Read out of cli/beacon/internal/learning/evaluator.go at commit 63d43f4:
// RubricQuestions holds the three prompts verbatim, jevQuestions() wraps each
// one as type "noul" with the same two criteria strings, callEvaluator() posts
// all three in a single request, and evaluationScore() returns the unweighted
// mean of the three probabilities.
//
// Three things are worth seeing side by side. The criteria strings are
// identical for all three questions and carry no information — every bit of the
// rubric is in the instruction line. The third question says "the reusable
// lesson", which is the thing the second question is being asked to decide, and
// a decision model cannot read another question's answer. And whatever comes
// back is averaged into one scalar before anything acts on it.
//
// Server-rendered, zero JS.

const ACCENT = "oklch(0.55 0.14 250)"

type Q = {
  id: string
  prompt: string
  note: string
}

const QUESTIONS: Q[] = [
  {
    id: "task_success",
    prompt: "Did the trace complete the user's engineering task successfully?",
    note: "the trace records every command's exit_code; the projection does not carry it",
  },
  {
    id: "reusable_correction",
    prompt:
      "Does the trace contain a correction or debugging pattern that future agents should reuse?",
    note: "the only question about reuse, and the gate gives it no floor of its own",
  },
  {
    id: "evidence_supported",
    prompt: "Is the reusable lesson supported by concrete events in the trace?",
    note: "“the reusable lesson” is question two's answer, which this question cannot see",
  },
]

export function RubricCard() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        POST api.typesafe.ai/v1/systemone —{" "}
        <span className="text-foreground">one request per trace, three questions</span>
      </div>

      <div className="space-y-3 px-3 py-3">
        {QUESTIONS.map((q, i) => (
          <div key={q.id} className="rounded border bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                questions[{i}]
              </span>
              <span className="font-mono text-xs" style={{ color: ACCENT }}>
                {q.id}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                type: &quot;noul&quot;
              </span>
            </div>

            <p className="mt-1.5 mb-0 text-sm leading-6">
              <span className="text-muted-foreground">instructions: </span>
              &ldquo;{q.prompt}&rdquo;
            </p>

            <p className="mt-1 mb-0 font-mono text-[11px] leading-5 text-muted-foreground">
              criteria.true: &ldquo;The trace satisfies this criterion.&rdquo;
              <br />
              criteria.false: &ldquo;The trace does not satisfy this criterion.&rdquo;
            </p>

            <p className="mt-1.5 mb-0 text-xs text-muted-foreground">{q.note}</p>
          </div>
        ))}

        <div className="rounded border border-dashed px-3 py-2 font-mono text-xs leading-6">
          <span className="text-muted-foreground">score</span> ={" "}
          (task_success + reusable_correction + evidence_supported) / 3
          <br />
          <span className="text-muted-foreground">candidate</span> ={" "}
          score &gt;= 0.60
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        That is the whole rubric. Six lines of criteria text, two of which are the same sentence
        with a <span className="font-mono">not</span> in it, repeated three times — so every bit
        of instruction the model receives is in the three prompts. Compare{" "}
        <span className="font-mono">rubrics/v3.json</span> in jev-linkmap, which carries
        per-question instructions, worked examples and a per-answer confidence floor, and which a
        $15.51 loop spent two rewrites tuning. Beacon&apos;s rubric is a Go{" "}
        <span className="font-mono">var</span>, hashed into every stored evaluation, and has
        never been revised.
      </p>
    </figure>
  )
}
