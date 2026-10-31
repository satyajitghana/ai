"use client"

import { useState } from "react"

// A stepper over ONE run I executed: the README's ticket-triage domain, 8 synthetic logs, a scripted fake decider
// (reads log1, log2, log3, then picks stop, then answers team = infra). Numbers are from that run
// (exp.mts, switch 0.1.1 core/loop.ts, Node 22.22): request size is switch's own estimate,
// ceil(JSON.stringify({state, questions}).length / 3) tokens. The logs are 200-character filler, so the absolute
// numbers belong to this toy; the shape (the view grows, the menu shrinks) is the point.

type Step = {
  n: number
  question: string
  labels: string[]
  said: string
  means: string
  tokens: number
  read: string[]
  note: string
}

const STEPS: Step[] = [
  {
    n: 1,
    question: "pick: Which log should be read next to route this ticket?",
    labels: ["o1 Read log1.txt", "o2 Read log2.txt", "... o8", "o9 Stop reading: the evidence is enough"],
    said: "o1",
    means: "key log1.txt",
    tokens: 132,
    read: [],
    note: "9 options: 8 logs plus stop. The model sees the labels o1..o9 and their texts, never the keys.",
  },
  {
    n: 2,
    question: "pick (same instructions)",
    labels: ["o1 Read log2.txt", "o2 Read log3.txt", "... o7", "o8 Stop reading"],
    said: "o1",
    means: "key log2.txt",
    tokens: 203,
    read: ["log1.txt"],
    note: "Labels are renumbered every step, so o1 now means a different log. The domain, not the model, owns that mapping.",
  },
  {
    n: 3,
    question: "pick (same instructions)",
    labels: ["o1 Read log3.txt", "o2 Read log4.txt", "... o6", "o7 Stop reading"],
    said: "o1",
    means: "key log3.txt",
    tokens: 275,
    read: ["log1.txt", "log2.txt"],
    note: "The view now carries two logs, so the request grew by about 72 tokens while the menu shrank by one option.",
  },
  {
    n: 4,
    question: "pick (same instructions)",
    labels: ["o1 Read log4.txt", "o2 Read log5.txt", "o3 Read log6.txt", "o4 Read log7.txt", "o5 Read log8.txt", "o6 Stop reading"],
    said: "o6",
    means: "stop: transition sets done = true",
    tokens: 347,
    read: ["log1.txt", "log2.txt", "log3.txt"],
    note: "The largest request of the run. Stop is the last label here because the choice function put it last; its priority of -1 only matters when the menu is cut.",
  },
  {
    n: 5,
    question: "team: Which team should handle the ticket?",
    labels: ["billing  Billing", "infra  Infrastructure", "app  Application"],
    said: "infra",
    means: "team = infra",
    tokens: 314,
    read: ["log1.txt", "log2.txt", "log3.txt"],
    note: "Same loop, different question: a final choice with fixed labels. The next call to the question function returns nothing and the run ends as done after 5 steps.",
  },
]

export function LoopTrace() {
  const [i, setI] = useState(0)
  const s = STEPS[i]
  const max = 360
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one measured run · README ticket triage, scripted decider · step {s.n} of {STEPS.length}
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-mono text-xs text-muted-foreground">state S{s.n - 1} (what the view shows the model)</div>
            <div className="mt-1 rounded border bg-muted/40 p-2 font-mono text-xs">
              ticket: &quot;Checkout fails with 502 after deploy&quot;
              <br />
              read: [{s.read.join(", ")}]
            </div>
          </div>
          <div>
            <div className="font-mono text-xs text-muted-foreground">question function Q(S{s.n - 1})</div>
            <div className="mt-1 rounded border p-2 text-xs">
              <div className="font-medium">{s.question}</div>
              <ul className="mt-1 space-y-0.5 font-mono">
                {s.labels.map((l) => (
                  <li key={l} className={l.startsWith(s.said + " ") ? "font-semibold text-foreground" : "text-muted-foreground"}>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="font-mono text-xs text-muted-foreground">the decider answers</div>
            <div className="mt-1 rounded border p-2 font-mono text-xs">
              {s.n < 5 ? "pick" : "team"}: {s.said}
              <br />
              <span className="text-muted-foreground">transition: {s.means}</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-xs text-muted-foreground">
              request size, switch&apos;s estimate: {s.tokens} tokens
            </div>
            <svg viewBox="0 0 300 70" className="mt-1 w-full" role="img" aria-label={`Request sizes by step: ${STEPS.map((t) => `${t.tokens}`).join(", ")} tokens. Step ${s.n} is highlighted.`}>
              {STEPS.map((t, k) => {
                const h = (t.tokens / max) * 56
                return (
                  <g key={t.n}>
                    <rect x={14 + k * 56} y={60 - h} width={36} height={h} rx={2} fill={k === i ? "var(--foreground)" : "var(--muted-foreground)"} fillOpacity={k === i ? 0.9 : 0.35} />
                    <text x={32 + k * 56} y={68} fontSize={8} textAnchor="middle" className="fill-muted-foreground font-mono">
                      {t.tokens}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">{s.note}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="rounded border px-2 py-1 text-xs disabled:opacity-40">
          Back
        </button>
        <button type="button" onClick={() => setI(Math.min(STEPS.length - 1, i + 1))} disabled={i === STEPS.length - 1} className="rounded border px-2 py-1 text-xs disabled:opacity-40">
          Next step
        </button>
        <span className="font-mono text-xs text-muted-foreground">trace: 18 entries, 15.9 ms of loop time for all five steps</span>
      </div>
    </figure>
  )
}
