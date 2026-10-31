"use client"

import { useState } from "react"

import { Ev, Panel, Src } from "./ui"

type N = { id: string; label: string; x: number; y: number; src: string; note: string; ev: "READ" | "INFERRED" }

const W = 200
const H = 44

const NODES: N[] = [
  { id: "a", label: "Op::TurnInput", x: 20, y: 20, src: "session/handlers.rs:459", ev: "READ", note: "The session is driven by submission_loop, which receives Op values. There are 32 variants of Op (protocol.rs:696) and 86 EventMsg variants coming back." },
  { id: "b", label: "RegularTask", x: 20, y: 84, src: "tasks/regular.rs, tasks/mod.rs:181", ev: "INFERRED", note: "A turn runs as a RegularTask. The step from Op::TurnInput to spawning the task goes through turn_input::handle, which I did not read: inferred." },
  { id: "c", label: "run_turn", x: 20, y: 148, src: "session/turn.rs:177", ev: "READ", note: "A 3,612-line file. The doc comment (160-176): the model replies with function calls or a message; a call is executed and its output goes back in the next request; a message alone ends the turn." },
  { id: "d", label: "pre-sampling compaction", x: 20, y: 212, src: "turn.rs:218-262, 1457", ev: "READ", note: "run_pre_sampling_compact: first the previous-model inline compact, then compact if the token limit is reached or an async candidate is ready." },
  { id: "e", label: "capture step context", x: 20, y: 276, src: "turn.rs:331-386, 501", ev: "READ", note: "One frozen view of context, advertised tools and tool calls for the step. The comment at 501: capture once so context, tools and calls share one request view." },
  { id: "f", label: "record context diff", x: 20, y: 340, src: "turn.rs:~380, ~555", ev: "READ", note: "The world-state diff is written to history, so only what changed is re-sent." },
  { id: "g", label: "run_sampling_request", x: 270, y: 84, src: "turn.rs:594, 1792", ev: "READ", note: "Builds the Prompt from a cloned history and loops over stream retries. Parallel tool calls are hard-coded true (1751-1779)." },
  { id: "h", label: "stream + tool futures", x: 270, y: 148, src: "turn.rs:2729-3540; stream_events_utils.rs:316-365", ev: "READ", note: "Each OutputItemDone that is a tool call is recorded and its handler is dispatched immediately, while the model keeps streaming. The futures go into a FuturesOrdered." },
  { id: "i", label: "drain in-flight, record outputs", x: 270, y: 212, src: "turn.rs:2676, 3552-3560", ev: "READ", note: "After the stream ends, drain_in_flight awaits the futures in call order and records each output envelope." },
  { id: "j", label: "post-sampling check", x: 270, y: 276, src: "turn.rs:636-696", ev: "READ", note: "needs_follow_up = model_needs_follow_up || has_pending_input. should_roll_over = auto_compaction_enabled && needs_follow_up && (new window requested || token limit reached || candidate ready)." },
  { id: "k", label: "compact, then loop", x: 520, y: 148, src: "turn.rs:691-748", ev: "READ", note: "Roll over: compact in the middle of the turn, then continue the loop from a fresh step context." },
  { id: "l", label: "Stop hook", x: 520, y: 212, src: "turn.rs:750-905", ev: "READ", note: "No follow-up needed: the Stop hook may inject a continuation prompt and continue; then the legacy after-agent hook." },
  { id: "m", label: "post-turn compaction", x: 520, y: 276, src: "turn.rs:~800-905", ev: "READ", note: "Only if model_post_turn_compact_threshold_percent is above 0. Its default is 0, so it is off." },
  { id: "n", label: "final answer", x: 520, y: 340, src: "turn.rs:750-905", ev: "READ", note: "A message with no pending work ends the turn. Errors end it too, as EventMsg::Error, so the user can continue (906-960)." },
]

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]))
const mid = (n: N) => ({ cx: n.x + W / 2, top: n.y, bottom: n.y + H, left: n.x, right: n.x + W, cy: n.y + H / 2 })

const down = (a: string, b: string) => {
  const p = mid(byId[a])
  const q = mid(byId[b])
  return `M${p.cx},${p.bottom} V${q.top}`
}

const EDGES: { d: string; label?: string; lx?: number; ly?: number }[] = [
  { d: down("a", "b") }, { d: down("b", "c") }, { d: down("c", "d") }, { d: down("d", "e") }, { d: down("e", "f") },
  { d: "M220,362 H245 V106 H270", label: "next step", lx: 224, ly: 380 },
  { d: down("g", "h") }, { d: down("h", "i") }, { d: down("i", "j") },
  { d: "M270,298 H220", label: "follow-up, no roll over", lx: 223, ly: 316 },
  { d: "M470,290 H495 V170 H520", label: "roll over", lx: 478, ly: 160 },
  { d: "M470,306 H505 V234 H520" },
  { d: down("l", "m") }, { d: down("m", "n") },
]

export function TurnLoop() {
  const [sel, setSel] = useState("j")
  const n = byId[sel]
  return (
    <Panel title="One turn, as the code runs it" sub="click a step; line numbers are at commit 67f0994b">
      <svg viewBox="0 0 740 410" className="w-full" role="img" aria-label="Flow chart of one Codex turn from the input operation to the final answer">
        <defs>
          <marker id="tl-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" className="fill-muted-foreground" />
          </marker>
        </defs>
        {EDGES.map((e, i) => (
          <g key={i}>
            <path d={e.d} fill="none" className="stroke-muted-foreground" strokeWidth={1.4} markerEnd="url(#tl-arrow)" />
            {e.label ? <text x={e.lx} y={e.ly} className="fill-muted-foreground text-[10px]">{e.label}</text> : null}
          </g>
        ))}
        {NODES.map((x) => (
          <g key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") setSel(x.id) }}>
            <rect x={x.x} y={x.y} width={W} height={H} rx={8} className={sel === x.id ? "fill-amber-500/20 stroke-amber-500" : "fill-card stroke-border"} strokeWidth={sel === x.id ? 2 : 1} />
            <text x={x.x + W / 2} y={x.y + 19} textAnchor="middle" className="fill-foreground text-[12px] font-medium">{x.label}</text>
            <text x={x.x + W / 2} y={x.y + 34} textAnchor="middle" className="fill-muted-foreground font-mono text-[9.5px]">{x.src}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        <div className="mb-1 flex flex-wrap items-center gap-2"><span className="font-medium">{n.label}</span> <Ev kind={n.ev} /> <Src>{n.src}</Src></div>
        <p className="text-muted-foreground">{n.note}</p>
      </div>
    </Panel>
  )
}
