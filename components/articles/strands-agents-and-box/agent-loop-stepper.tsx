"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One user turn through the Strands Agents event loop, step by step.
// The order below is not drawn from the docs: it is the sequence I logged by
// running the SDK at commit 38afb96 (strands-py) with its own test fixture,
// MockedModelProvider, scripted to answer once with a tool call and once with
// text. Every hook class was subscribed and every event stream_async yielded
// was recorded. Stream keys are the dict keys a callback handler receives
// (types/_events.py); hook names are the classes in hooks/events.py.

type Kind = "hook" | "stream" | "work"

type Item = { kind: Kind; name: string; note?: string }

type Step = {
  phase: string
  title: string
  items: Item[]
  lever?: string
  ref: string
  explain: string
}

const STEPS: Step[] = [
  {
    phase: "enter",
    title: "agent(\"Weather in Pune?\")",
    items: [{ kind: "work", name: "run_async → invoke_async → stream_async → _run_loop" }],
    ref: "agent/agent.py:846-925, _async.py:19-45",
    explain:
      "The synchronous call runs the async path on a fresh event loop in a worker thread, which is why it also works inside Jupyter. invoke_async simply drains stream_async and returns the last event's result.",
  },
  {
    phase: "enter",
    title: "Invocation opens",
    items: [
      { kind: "hook", name: "BeforeInvocationEvent" },
      { kind: "stream", name: "init_event_loop" },
      { kind: "hook", name: "MessageAddedEvent", note: "role: user" },
    ],
    lever: "event.cancel ends the turn before any model call; event.messages can replace the input.",
    ref: "agent/agent.py:1508-1551, 1963-1971",
    explain:
      "The user's text becomes a message and is appended to history. Every append goes through one chokepoint that fires MessageAddedEvent, and that is the hook a session manager uses to persist the conversation.",
  },
  {
    phase: "cycle 1",
    title: "event_loop_cycle starts",
    items: [
      { kind: "stream", name: "start" },
      { kind: "stream", name: "start_event_loop" },
      { kind: "work", name: "limits checked · OTel span execute_event_loop_cycle" },
    ],
    ref: "event_loop/event_loop.py:189-275",
    explain:
      "Turn, output-token and total-token caps are checked at the top of each cycle, so a cap stops the loop between turns, never in the middle of a model call.",
  },
  {
    phase: "cycle 1",
    title: "Model call",
    items: [
      { kind: "hook", name: "BeforeModelCallEvent", note: "projected_input_tokens" },
      { kind: "stream", name: "event", note: "raw messageStart, contentBlockStart/Delta/Stop" },
      { kind: "stream", name: "data, delta", note: "\"Let me check.\"" },
      { kind: "stream", name: "current_tool_use", note: "get_weather {city: Pune}" },
      { kind: "stream", name: "event", note: "messageStop · stop_reason tool_use" },
    ],
    lever: "event.cancel replaces the model call with a canned assistant message.",
    ref: "event_loop/event_loop.py:470-561, event_loop/streaming.py:238-242",
    explain:
      "Each provider chunk is passed through raw under the key event, and the loop also emits a typed view of it: text deltas under data, tool-input deltas under current_tool_use as the JSON arrives.",
  },
  {
    phase: "cycle 1",
    title: "Model returns",
    items: [
      { kind: "hook", name: "AfterModelCallEvent" },
      { kind: "hook", name: "MessageAddedEvent", note: "role: assistant, holds toolUse" },
      { kind: "stream", name: "message" },
    ],
    lever:
      "event.retry = True re-runs the model call. The default ModelRetryStrategy sets it on a throttling error and sleeps 4, 8, 16, 32, 64 s.",
    ref: "event_loop/event_loop.py:638-700, event_loop/_retry.py:106-171",
    explain:
      "Retries are not special-cased in the loop. They are a hook: the loop asks AfterModelCallEvent whether to go round again, and the retry strategy is just the default subscriber.",
  },
  {
    phase: "cycle 1",
    title: "Tools run",
    items: [
      { kind: "hook", name: "BeforeToolsEvent" },
      { kind: "hook", name: "BeforeToolCallEvent", note: "per tool" },
      { kind: "work", name: "get_weather(city=\"Pune\")", note: "sync fn → asyncio.to_thread" },
      { kind: "hook", name: "AfterToolCallEvent", note: "per tool" },
      { kind: "hook", name: "AfterToolsEvent" },
    ],
    lever:
      "BeforeToolCallEvent can set cancel_tool or swap selected_tool; AfterToolCallEvent can retry; AfterToolsEvent.end_turn stops before the next model call.",
    ref: "event_loop/event_loop.py:802-962, tools/executors/concurrent.py:19-92",
    explain:
      "The default executor is concurrent: one asyncio task per tool use, events funnelled through one queue. A tool that raises does not crash the loop; the exception becomes an error tool result the model reads.",
  },
  {
    phase: "cycle 1",
    title: "Results become a user message",
    items: [
      { kind: "hook", name: "MessageAddedEvent", note: "role: user, holds toolResult" },
      { kind: "stream", name: "message" },
    ],
    ref: "event_loop/event_loop.py:956-962, types/_events.py:282-319",
    explain:
      "There is no tool_result key in the stream. ToolResultEvent is marked as not a callback event, so a consumer sees the results only inside this message.",
  },
  {
    phase: "cycle 2",
    title: "The loop recurses",
    items: [
      { kind: "stream", name: "start", note: "from recurse_event_loop" },
      { kind: "stream", name: "start" },
      { kind: "stream", name: "start_event_loop" },
      { kind: "hook", name: "BeforeModelCallEvent" },
      { kind: "stream", name: "data, delta", note: "\"It is sunny.\"" },
      { kind: "hook", name: "AfterModelCallEvent" },
      { kind: "hook", name: "MessageAddedEvent", note: "role: assistant" },
      { kind: "stream", name: "message" },
    ],
    ref: "event_loop/event_loop.py:413-455, 1023-1030",
    explain:
      "The loop is literally recursive: after tools, event_loop_cycle calls itself through recurse_event_loop, which is why start appears twice here. This time stop_reason is end_turn, so no tools run.",
  },
  {
    phase: "exit",
    title: "Turn closes",
    items: [
      { kind: "work", name: "conversation_manager.apply_management" },
      { kind: "hook", name: "AfterInvocationEvent" },
      { kind: "stream", name: "result", note: "AgentResult: stop_reason end_turn" },
    ],
    lever: "AfterInvocationEvent.resume can feed new input and start another pass without returning.",
    ref: "agent/agent.py:1640-1660, 1452-1453",
    explain:
      "The internal stop event is not shown to callbacks; the caller gets one result event at the end. The sliding window trims history here, and on a context overflow the loop trims and retries the whole cycle.",
  },
]

const KIND: Record<Kind, { label: string; color: string; bg: string }> = {
  hook: { label: "hook", color: "oklch(0.58 0.16 300)", bg: "oklch(0.58 0.16 300 / 0.12)" },
  stream: { label: "stream", color: "oklch(0.58 0.13 200)", bg: "oklch(0.58 0.13 200 / 0.12)" },
  work: { label: "runs", color: "oklch(0.55 0.02 260)", bg: "oklch(0.55 0.02 260 / 0.12)" },
}

export function AgentLoopStepper() {
  const [i, setI] = useState(0)
  const s = STEPS[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one user turn · one tool call · strands-py at 38afb96</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          step {i + 1} / {STEPS.length}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto px-3 pt-3 sm:px-4">
        {STEPS.map((x, k) => (
          <button
            key={x.title}
            type="button"
            onClick={() => setI(k)}
            aria-label={`Step ${k + 1}: ${x.title}`}
            aria-pressed={k === i}
            className={cn(
              "h-2 min-w-6 flex-1 rounded-full transition-colors",
              k === i ? "bg-foreground/70" : k < i ? "bg-foreground/25" : "bg-muted",
            )}
          />
        ))}
      </div>

      <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-[1fr_minmax(0,16rem)]">
        <div className="rounded-lg border bg-background/60 p-3 sm:p-4">
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{s.phase}</div>
          <div className="mt-0.5 font-mono text-[13px] text-foreground">{s.title}</div>
          <ol className="mt-3 space-y-1.5">
            {s.items.map((it, k) => {
              const c = KIND[it.kind]
              return (
                <li key={it.name + String(k)} className="flex flex-wrap items-baseline gap-2">
                  <span
                    className="w-14 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[10px]"
                    style={{ color: c.color, background: c.bg }}
                  >
                    {c.label}
                  </span>
                  <code className="font-mono text-[12px] text-foreground">{it.name}</code>
                  {it.note ? <span className="text-[11px] text-muted-foreground">{it.note}</span> : null}
                </li>
              )
            })}
          </ol>
          {s.lever ? (
            <div
              className="mt-3 rounded-md border-l-2 p-2 pl-3 text-[12px] leading-5"
              style={{ borderColor: KIND.hook.color, background: KIND.hook.bg }}
            >
              <span className="font-mono text-[10px] uppercase tracking-wide">what a hook can do here</span>
              <div>{s.lever}</div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[12px] leading-5 text-muted-foreground">{s.explain}</p>
          <code className="font-mono text-[10px] leading-4 text-muted-foreground">{s.ref}</code>
          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={() => setI((k) => Math.max(0, k - 1))}
              disabled={i === 0}
              className="flex-1 rounded-md border px-3 py-1.5 font-mono text-[11px] disabled:opacity-40"
            >
              back
            </button>
            <button
              type="button"
              onClick={() => setI((k) => Math.min(STEPS.length - 1, k + 1))}
              disabled={i === STEPS.length - 1}
              className="flex-1 rounded-md border px-3 py-1.5 font-mono text-[11px] disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
        The order is the one I logged by running the SDK at commit 38afb96 with its own mocked model provider. Paths are under
        strands-py/src/strands/.
      </figcaption>
    </figure>
  )
}
