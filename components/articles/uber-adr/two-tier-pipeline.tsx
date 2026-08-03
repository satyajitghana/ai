"use client"

import { useState } from "react"

// ADR's two-tier detector, stepped through on two real scenarios from the paper.
// Boxes: Sensor -> Tier 1 Triage (gpt-4o) -> Tier 2 Reasoning (Claude Code CLI +
// MCP tools) -> Verdict. The "benign" scenario is the common case: triage alone
// returns a verdict and Tier 2 is never invoked -- that early return is the cost
// control. The "suspicious" scenario is the Agent Flayer emulation from the
// paper's Figure 9 (Jira ticket -> indirect prompt injection -> Cursor reads
// secrets -> HTTP exfil): triage escalates, and the reasoning agent uses three
// MCP context servers -- including fetching the flagged tool's OWN source code
// -- before rendering a verdict.
//
// Cost/latency figures ($0.017/2.3s triage-only; $0.029/29.7s full path; 40.7%
// of tasks resolved by triage alone) are the paper's own ablation numbers
// (Section 5.2-5.3), not invented per-step splits. Tool names
// (source_code_analyzer_server, threat_intelligence_server, policy_store_server)
// and the CLI invocation are read from Detection/guardrail/adr_agent in the repo.
//
// SSR-safe: fixed-length scripted steps, no Date, no Math.random, no timers.

const ACC = "oklch(0.68 0.14 200)" // teal — active / tier 1
const REASON = "oklch(0.62 0.14 280)" // violet — tier 2 reasoning
const WARN = "oklch(0.68 0.16 55)" // amber — escalated / suspicious
const OK = "oklch(0.62 0.16 150)" // green — resolved / done

type Tone = "ok" | "warn" | "done"
type Scenario = "benign" | "suspicious"

type Step = {
  box: 0 | 1 | 2 | 3
  sees: string
  tools: string[]
  note: string
  cost: number | null
  latency: number | null
  tone: Tone
}

const BOXES = ["ADR Sensor", "Tier 1 · Triage", "Tier 2 · Reasoning", "Verdict"] as const
const BOX_SUB = ["user-agent activity", "gpt-4o · high recall", "Claude Code CLI + MCP", "human alert"] as const

const BENIGN_STEPS: Step[] = [
  {
    box: 0,
    sees: "Cursor session: 4 files edited, `pytest -q` run, git commit.",
    tools: [],
    note: "normal engineering activity, captured verbatim from the agent's own tool-call log",
    cost: null,
    latency: null,
    tone: "ok",
  },
  {
    box: 1,
    sees: "The full transcript. No unfamiliar MCP servers, no ambiguous tool sequence.",
    tools: [],
    note: "classifies BENIGN — returns immediately, Tier 2 is never invoked",
    cost: 0.017,
    latency: 2.3,
    tone: "ok",
  },
  {
    box: 3,
    sees: "",
    tools: [],
    note: "session closed. Nothing queued for a human — this is the fast path, ~40.7% of tasks",
    cost: 0.017,
    latency: 2.3,
    tone: "done",
  },
]

const SUSPICIOUS_STEPS: Step[] = [
  {
    box: 0,
    sees: "Jira MCP tool fetches a ticket → Cursor reads `secrets.env` → an outbound HTTPS call fires.",
    tools: [],
    note: "the Agent Flayer pattern: an indirect prompt injection riding in through a Jira ticket",
    cost: null,
    latency: null,
    tone: "ok",
  },
  {
    box: 1,
    sees: "The same transcript. A ticket fetch, a local secrets read, and an external POST in one session.",
    tools: [],
    note: "escalate-on-ambiguity bias fires → SUSPICIOUS, hands off to Tier 2",
    cost: 0.017,
    latency: 2.3,
    tone: "warn",
  },
  {
    box: 2,
    sees: "The flagged tool call, plus three MCP context servers it can call on demand.",
    tools: [
      "source_code_analyzer_server → fetch the flagged tool's own source",
      "threat_intelligence_server → match against 17 known attack techniques",
      "policy_store_server → check the secrets-egress policy",
    ],
    note: "the tool's source shows it POSTs file contents to an external host — a known injection → exfiltration tactic",
    cost: 0.029,
    latency: 29.7,
    tone: "warn",
  },
  {
    box: 3,
    sees: "",
    tools: [],
    note: '{ is_threat: true, confidence: 0.94 } — alert raised, a human investigates and can modify the guidance',
    cost: 0.029,
    latency: 29.7,
    tone: "done",
  },
]

const VW = 700
const VH = 150
const BW = 152
const BH = 50
const GAP = 12
const ROW_Y = 62
const START_X = 12
const boxX = (i: number) => START_X + i * (BW + GAP)
const boxCX = (i: number) => boxX(i) + BW / 2
const CY = ROW_Y + BH / 2
const BYPASS_Y = 20

export function TwoTierPipeline() {
  const [scenario, setScenario] = useState<Scenario>("suspicious")
  const [i, setI] = useState(0)

  const steps = scenario === "benign" ? BENIGN_STEPS : SUSPICIOUS_STEPS
  const step = steps[i]
  const boxColor = (b: number) => (b === 1 ? ACC : b === 2 ? REASON : b === 3 && step.tone === "done" ? OK : WARN)
  const skipsTier2 = scenario === "benign"
  const bypassActive = skipsTier2 && i >= 1

  function setScenarioAndReset(s: Scenario) {
    setScenario(s)
    setI(0)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>adr detector · two-tier pipeline</span>
        <span className="text-muted-foreground/50">step {i + 1}/{steps.length}</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* scenario tabs */}
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setScenarioAndReset("benign")}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            style={
              scenario === "benign"
                ? { background: ACC, color: "#fff" }
                : { background: "var(--muted)", color: "var(--muted-foreground)" }
            }
          >
            benign session
          </button>
          <button
            type="button"
            onClick={() => setScenarioAndReset("suspicious")}
            className="cursor-pointer rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            style={
              scenario === "suspicious"
                ? { background: WARN, color: "#fff" }
                : { background: "var(--muted)", color: "var(--muted-foreground)" }
            }
          >
            suspicious session — Agent Flayer
          </button>
        </div>

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full"
          role="img"
          aria-label={`Pipeline: Sensor, Tier 1 Triage, Tier 2 Reasoning, Verdict. Currently at ${BOXES[step.box]}. ${skipsTier2 ? "Benign scenario: Tier 2 is bypassed." : "Suspicious scenario: all four stages run."}`}
        >
          <defs>
            <marker id="tp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--muted-foreground)" />
            </marker>
          </defs>

          {/* connective arrows */}
          {[0, 1, 2].map((k) => (
            <line
              key={k}
              x1={boxX(k) + BW + 1}
              y1={CY}
              x2={boxX(k + 1) - 3}
              y2={CY}
              stroke="var(--muted-foreground)"
              strokeWidth={1.4}
              strokeDasharray={skipsTier2 && (k === 1 || k === 2) ? "3 3" : undefined}
              markerEnd="url(#tp-arrow)"
              opacity={skipsTier2 && (k === 1 || k === 2) ? 0.25 : 0.5}
            />
          ))}

          {/* fast-path bypass: Tier 1 straight to Verdict */}
          <path
            d={`M ${boxCX(1)} ${ROW_Y - 1} L ${boxCX(1)} ${BYPASS_Y} L ${boxCX(3)} ${BYPASS_Y} L ${boxCX(3)} ${ROW_Y - 1}`}
            fill="none"
            stroke={ACC}
            strokeWidth={1.6}
            markerEnd="url(#tp-arrow)"
            opacity={bypassActive ? 0.9 : 0.12}
            className="transition-opacity duration-300"
          />
          <text
            x={(boxCX(1) + boxCX(3)) / 2}
            y={BYPASS_Y - 6}
            textAnchor="middle"
            className="font-mono"
            fontSize={10}
            fill={ACC}
            opacity={bypassActive ? 0.95 : 0.2}
          >
            return immediately — fast path
          </text>

          {/* the four stage boxes */}
          {BOXES.map((label, k) => {
            const on = k === step.box
            const dimmed = skipsTier2 && k === 2
            return (
              <g key={k} className="transition-all duration-300">
                <rect
                  x={boxX(k)}
                  y={ROW_Y}
                  width={BW}
                  height={BH}
                  rx={10}
                  fill={on ? boxColor(k) : "var(--muted-foreground)"}
                  opacity={dimmed ? 0.06 : on ? 0.95 : 0.13}
                />
                <text
                  x={boxCX(k)}
                  y={CY - 3}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={12}
                  fontWeight={on ? 600 : 500}
                  fill={dimmed ? "var(--muted-foreground)" : on ? "#fff" : "var(--foreground)"}
                  opacity={dimmed ? 0.4 : 1}
                >
                  {label}
                </text>
                <text
                  x={boxCX(k)}
                  y={CY + 12}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={9}
                  fill={dimmed ? "var(--muted-foreground)" : on ? "#fff" : "var(--muted-foreground)"}
                  opacity={dimmed ? 0.35 : on ? 0.9 : 0.7}
                >
                  {BOX_SUB[k]}
                </text>
              </g>
            )
          })}
        </svg>

        {/* detail panel */}
        <div className="mt-2 rounded-lg border bg-muted/20 p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <span className="rounded px-2 py-0.5 font-mono text-[10px] text-white" style={{ background: boxColor(step.box) }}>
              {BOXES[step.box]}
            </span>
          </div>

          {step.sees ? <p className="mt-2 text-sm leading-6 text-foreground">sees: {step.sees}</p> : null}

          {step.tools.length > 0 ? (
            <div className="mt-3">
              <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">mcp tool calls</div>
              <div className="mt-1 space-y-1">
                {step.tools.map((t, ti) => (
                  <div key={ti} className="rounded bg-muted/60 px-2 py-1 font-mono text-xs text-foreground">
                    <span style={{ color: REASON }}>›</span> {t}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded px-2 py-1 font-mono text-xs" style={{ background: `color-mix(in oklab, ${boxColor(step.box)} 12%, transparent)`, color: boxColor(step.box) }}>
            {step.note}
          </div>
        </div>

        {/* cost / latency readout */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="font-mono text-[10px] text-muted-foreground">cost so far</div>
            <div className="font-mono text-lg tabular-nums text-foreground">{step.cost == null ? "—" : `$${step.cost.toFixed(3)}`}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-2">
            <div className="font-mono text-[10px] text-muted-foreground">latency so far</div>
            <div className="font-mono text-lg tabular-nums text-foreground">{step.latency == null ? "—" : `${step.latency.toFixed(1)}s`}</div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setI((a) => Math.max(0, a - 1))}
            disabled={i === 0}
            className="cursor-pointer rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← prev
          </button>
          <button
            type="button"
            onClick={() => setI((a) => Math.min(steps.length - 1, a + 1))}
            disabled={i === steps.length - 1}
            className="cursor-pointer rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            next →
          </button>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {scenario === "benign" ? "triage-only path" : "escalated path"}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Triage alone resolves <span className="text-foreground">40.7%</span>{" "}of tasks at{" "}
          <span className="text-foreground">$0.017</span>, 2.3s — that early return is the whole cost-control
          argument. The remaining sessions escalate to a reasoning tier that is not an API call: it shells out to
          the <span className="text-foreground">Claude Code CLI</span>{" "}as a subprocess, with MCP tool access to
          fetch the flagged tool&apos;s own source before it renders a verdict. The full escalated path costs{" "}
          <span className="text-foreground">$0.029</span>{" "}and 29.7s — roughly 13x the triage-only path, which is
          the price of running an LLM, twice, inside a detection loop.
        </p>
      </div>
    </figure>
  )
}
