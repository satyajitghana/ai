"use client"

import { useState } from "react"

// A reasoned diagram, not a measurement: who produces which piece in one step. The left column describes a
// generic chat-model coding agent harness; the right is switch, read from src/core/loop.ts and src/core/pick.ts.

const MODES = {
  chat: {
    title: "Chat-model agent harness",
    rows: [
      { who: "harness", what: "Sends the transcript and the tool schemas" },
      { who: "model", what: "Writes the tool name and its arguments as tokens" },
      { who: "harness", what: "Parses the text, validates it, runs the tool" },
      { who: "harness", what: "Appends the result to the transcript" },
    ],
    note: "The model can name a tool that does not exist or write arguments that do not parse. The harness has to handle both.",
  },
  switch: {
    title: "switch",
    rows: [
      { who: "code", what: "Question function lists the legal actions and labels them o1..on" },
      { who: "model", what: "Scores each label; the answer is one label with its probability" },
      { who: "code", what: "Checks the label is on the menu, maps it back to the action" },
      { who: "code", what: "Transition function runs the action and writes the next state" },
    ],
    note: "The model writes nothing. A bad label is one of three checks in the loop, and the arguments of an action were generated in code before the model saw the menu.",
  },
} as const

export function WhoWrites() {
  const [m, setM] = useState<keyof typeof MODES>("switch")
  const mode = MODES[m]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {(Object.keys(MODES) as (keyof typeof MODES)[]).map((k) => (
          <button key={k} type="button" onClick={() => setM(k)} aria-pressed={k === m} className={`rounded border px-2 py-1 text-xs ${k === m ? "border-foreground" : "text-muted-foreground"}`}>
            {MODES[k].title}
          </button>
        ))}
        <span className="ml-auto font-mono text-xs text-muted-foreground">reasoned from the code</span>
      </div>
      <ol className="space-y-2 p-4">
        {mode.rows.map((r, k) => (
          <li key={k} className="flex items-start gap-3 text-sm">
            <span className={`mt-0.5 w-16 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-xs ${r.who === "model" ? "bg-foreground text-background" : "border"}`}>{r.who}</span>
            <span>{r.what}</span>
          </li>
        ))}
      </ol>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">{mode.note}</p>
    </figure>
  )
}
