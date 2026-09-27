"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two of the six recorded replays that ship inside the Qwen-Planner-Agent
// project page (index.html, <script id="blog-data">, cases[].messages).
// Every call, argument and return below is copied from that JSON, trimmed
// only where an instruction string runs long. The one row that is NOT in the
// message log is the Harness notice in the recovery case: the planner's own
// recorded reasoning quotes it ("The harness says: ..."), so it is shown as a
// quote, and labelled as such.
//
// The widget's job is the lane: at every step, who acts? The planner only
// ever reads text (a tool return, a notice), never a screenshot. In the
// handoff case the screen belongs to control_gui_agent, a sub-agent the
// planner starts and polls like any other tool.
//
// SSR-safety: fixed initial state, no Date or Math.random.

type Lane = "planner" | "harness" | "executor" | "gui"

type Step = {
  lane: Lane
  kind: "call" | "return" | "notice" | "answer"
  head: string
  body: string
  note: string
}

const LANES: { id: Lane; label: string; color: string }[] = [
  { id: "planner", label: "Planner Model", color: "oklch(0.58 0.16 290)" },
  { id: "harness", label: "Harness", color: "oklch(0.62 0.14 60)" },
  { id: "executor", label: "Executor / tools", color: "oklch(0.58 0.12 200)" },
  { id: "gui", label: "GUI sub-agent", color: "oklch(0.6 0.15 150)" },
]

const CASES: { id: string; label: string; record: string; request: string; steps: Step[] }[] = [
  {
    id: "recovery",
    label: "error recovery",
    record: "record MTH0073, report Figure 12",
    request: "Query today's weight, convert it from kilograms to pounds, and text the result to my coach.",
    steps: [
      {
        lane: "planner",
        kind: "call",
        head: "query_health_data",
        body: '{"dataType": "weight", "date": "today"}',
        note: "Three dependent steps, so it waits for each result before the next call.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "query_health_data returns",
        body: '"value": 70, "unit": "kilograms", "sourceApp": "HealthKit"',
        note: "Structured JSON back into the planner's context. No screen involved.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "convert_unit",
        body: '{"category": "weight", "fromUnit": "kilograms", "toUnit": "pounds", "value": 70}',
        note: "The obvious call for step two.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "convert_unit returns code 400",
        body: '"fromUnit or toUnit does not belong to the supported units of the specified category"',
        note: "The failure is a typed error, not a crash. It becomes the next observation.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "convert_unit (retry)",
        body: '{"category": "weight", "fromUnit": "kg", "toUnit": "lbs", "value": 70}',
        note: "One correction: abbreviations instead of full names.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "convert_unit returns code 400 again",
        body: "same error string",
        note: "Two failures on the same tool in one task.",
      },
      {
        lane: "harness",
        kind: "notice",
        head: "Harness notice (quoted in the planner's reasoning)",
        body: '"Repeated empty/error results in this user task: convert_unit (2). Stop guessing variations for those unresolved requests."',
        note: "The runtime counts failures per tool and says so. The notice itself is not in the published message log; the planner quotes it.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "calculate_expression",
        body: '{"expression": "70 * 2.2046226218", "precision": 2}',
        note: "It switches tools instead of guessing a third unit spelling.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "calculate_expression returns",
        body: '"result": 154.32',
        note: "The data dependency is satisfied by a different route.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "send_message",
        body: '{"content": "Hi coach, my weight today is 154.32 pounds (70 kg).", "phoneNumber": "138-1111-2222"}',
        note: "The number comes from an earlier turn of the conversation, where the coach was saved as a contact.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "send_message returns",
        body: '"Sent text message to 138-1111-2222"',
        note: "Completion evidence the verifier can check.",
      },
      {
        lane: "planner",
        kind: "answer",
        head: "final answer",
        body: "70 kg is about 154.32 lbs; message sent. Notes that the converter failed.",
        note: "Five tool rounds, two of them failures.",
      },
    ],
  },
  {
    id: "handoff",
    label: "sub-agent handoff",
    record: "record 396, report Figure 13",
    request: "Download Algebra.pdf, Biology.docx and English.docx from Class 10A in WhatsApp. Then move them into Math, Science and English folders.",
    steps: [
      {
        lane: "planner",
        kind: "call",
        head: "control_gui_agent start",
        body: '{"action": "start", "appName": "WhatsApp", "instruction": "Open the WhatsApp group chat named \'Class 10A\'. ... Download each of these files ..."}',
        note: "The planner writes a natural-language instruction for one app. It does not name a pixel.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "session started",
        body: '"sessionId": "gui_agent_ea269457", "execution_status": "pending"',
        note: "A session handle, like any other tool result.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "control_gui_agent execute",
        body: '{"action": "execute", "sessionId": "gui_agent_ea269457"}',
        note: "It waits for the first app to finish before touching the second.",
      },
      {
        lane: "gui",
        kind: "return",
        head: "GUI sub-agent completes",
        body: "launch_app, operate_ui, verify_result: all three stamped 10:38:15.933623",
        note: "The screen work happens here, out of the planner's sight. In this replay the three sub-steps share one timestamp to the microsecond.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "control_gui_agent start",
        body: '{"action": "start", "appName": "File Manager", "instruction": "... move Algebra.pdf into the \'Math\' folder, move Biology.docx into the \'Science\' folder ..."}',
        note: "The handoff carries the filenames and the folder mapping forward.",
      },
      {
        lane: "executor",
        kind: "return",
        head: "session started",
        body: '"sessionId": "gui_agent_11500904", "execution_status": "pending"',
        note: "A second, separate session.",
      },
      {
        lane: "planner",
        kind: "call",
        head: "control_gui_agent execute",
        body: '{"action": "execute", "sessionId": "gui_agent_11500904"}',
        note: "Same start, execute pattern.",
      },
      {
        lane: "gui",
        kind: "return",
        head: "GUI sub-agent completes",
        body: "launch_app, operate_ui, verify_result: all three stamped 10:38:18.205295",
        note: "Two app sessions, 2.3 seconds apart on the recorded clock.",
      },
      {
        lane: "planner",
        kind: "answer",
        head: "final answer",
        body: "Both app workflows completed; each file is in its subject folder.",
        note: "The planner's whole view of two apps was four JSON returns.",
      },
    ],
  },
]

export function PlannerTrace() {
  const [caseIdx, setCaseIdx] = useState(0)
  const [i, setI] = useState(0)
  const c = CASES[caseIdx]
  const step = c.steps[i]
  const last = c.steps.length - 1

  const pick = (k: number) => {
    setCaseIdx(k)
    setI(0)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">recorded replay · {c.record}</span>
        <div className="flex gap-1.5">
          {CASES.map((cc, k) => (
            <button
              key={cc.id}
              type="button"
              onClick={() => pick(k)}
              aria-pressed={caseIdx === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                caseIdx === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {cc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <p className="mb-3 text-sm leading-6 text-muted-foreground">
          <span className="font-mono text-[11px] uppercase tracking-wide">user</span>{" "}
          <span className="text-foreground">{c.request}</span>
        </p>

        <div className="grid grid-cols-4 gap-1.5">
          {LANES.map((l) => {
            const on = l.id === step.lane
            const used = c.steps.slice(0, i + 1).some((s) => s.lane === l.id)
            return (
              <div
                key={l.id}
                className={cn(
                  "rounded-md border px-1.5 py-2 text-center font-mono text-[10px] leading-4 transition-colors sm:text-[11px]",
                  on ? "text-white" : used ? "text-foreground" : "text-muted-foreground/60",
                )}
                style={on ? { background: l.color, borderColor: l.color } : undefined}
              >
                {l.label}
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-xs font-medium text-foreground">{step.head}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              step {i + 1} / {c.steps.length} · {step.kind}
            </span>
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono text-[11px] leading-5 text-foreground">
            {step.body}
          </pre>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.note}</p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {step.lane === "planner" ? "planner acts on:" : "planner will read:"}{" "}
            <span className="text-foreground">
              {step.lane === "planner"
                ? "the request, earlier returns, Harness context"
                : "text (JSON or a notice), no screenshot"}
            </span>
          </p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setI(Math.max(0, i - 1))}
            disabled={i === 0}
            className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            prev
          </button>
          <Range
            min={0}
            max={last}
            step={1}
            value={i}
            onChange={(e) => setI(+e.target.value)}
            className="w-full"
            aria-label="trace step"
            accent={LANES.find((l) => l.id === step.lane)?.color}
          />
          <button
            type="button"
            onClick={() => setI(Math.min(last, i + 1))}
            disabled={i === last}
            className="cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default disabled:opacity-40"
          >
            next
          </button>
        </div>
      </div>
    </figure>
  )
}
