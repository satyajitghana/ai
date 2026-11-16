"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { Button } from "@ui-sdk/react/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@ui-sdk/react/combobox"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { Input } from "@ui-sdk/react/input"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
} from "@ui-sdk/react/number-input"
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@ui-sdk/react/select"
import { Switch, SwitchThumb } from "@ui-sdk/react/switch"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import type { AgentAction, AgentComponent, AgentStep, createAgent as CreateAgent } from "@ui-sdk/react/agent"

import { cn } from "@/lib/utils"

import { Icon, icons, ui } from "./kit"

// The real agent bridge from @ui-sdk/react 0.1.0-beta.1, driving a settings
// page built from the real components. What is scripted is the model: no LLM
// runs here, so each instruction maps to the tool calls an agent would send
// (one snapshot, then one act with every step, the shape Sonnet used in my runs). The snapshot, the act
// call, how each step resolves, the refusals and the page changing are the
// library's, live. The bridge is made after hydration from a dynamic import,
// so it costs nothing until the page is interactive; registerTools is never
// called, so no browser agent is offered these tools.

type Agent = ReturnType<typeof CreateAgent>
type ActResult = Awaited<ReturnType<Agent["act"]>>

const REGIONS = [
  { value: "us-east", label: "US East" },
  { value: "europe", label: "Europe" },
  { value: "india", label: "India" },
  { value: "asia-pacific", label: "Asia Pacific" },
]

const FRAMEWORKS = [
  { value: "next", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt", label: "Nuxt" },
  { value: "astro", label: "Astro" },
]

const CONFIRM = "Charges $20 to your card for 1,000 credits"
const TOKEN = "sk-live-4242"

type Plan = {
  id: string
  say: string
  words: string[]
  steps: AgentStep[]
  note?: string
}

// A step that opens a tab first: a closed panel's fields are not on the page,
// and the snapshot lists them as offPage, so an agent opens the tab in the
// same call. A step on a tab that is already open simply changes nothing.
const BILLING: AgentStep = { ref: "Settings", action: "setValue", args: ["billing"] }
const GENERAL: AgentStep = { ref: "Settings", action: "setValue", args: ["general"] }

const PLANS: Plan[] = [
  {
    id: "move",
    say: "Move Apollo to Asia Pacific on Pro, run 3 instances, preview deployments on",
    words: ["move", "asia", "pacific", "pro", "instances", "preview"],
    steps: [
      GENERAL,
      { ref: "Region", action: "setValue", args: ["Asia Pacific"] },
      { ref: "Plan", action: "setValue", args: ["pro"] },
      { ref: "Instances", action: "setValue", args: [3] },
      { ref: "Preview deployments", action: "setChecked", args: [true] },
    ],
  },
  {
    id: "rename",
    say: "Rename the project to Atlas and switch it to Astro",
    words: ["rename", "atlas", "name", "astro", "framework"],
    steps: [
      GENERAL,
      { ref: "Project name", action: "setValue", args: ["Atlas"] },
      { ref: "Framework", action: "setValue", args: ["astro"] },
    ],
  },
  {
    id: "buy",
    say: "Buy 1,000 credits",
    words: ["buy", "credits", "credit", "purchase", "pay"],
    steps: [BILLING, { ref: "Buy credits", action: "press" }],
    note: "The button carries data-agent-confirm.",
  },
  {
    id: "token",
    say: `Save my API token ${TOKEN}`,
    words: ["token", "api", "key", "secret", "save"],
    steps: [BILLING, { ref: "API token", action: "setValue", args: [TOKEN] }],
    note: "The field sits inside data-agent-secret.",
  },
  {
    id: "recovery",
    say: "Clear the recovery codes",
    words: ["recovery", "codes", "clear", "backup"],
    steps: [BILLING, { ref: "Recovery codes", action: "clear" }],
    note: "The field sits inside data-agent-hidden.",
  },
  {
    id: "india",
    say: "Move Apollo to India",
    words: ["india", "mumbai"],
    steps: [GENERAL, { ref: "Region", action: "setValue", args: ["India"] }],
    note: "The page's onValueChange may cancel it; see the lock below the page.",
  },
]

function match(text: string): Plan | null {
  const words = text.toLowerCase().match(/[a-z]+/g) ?? []
  let best: Plan | null = null
  let score = 0
  for (const p of PLANS) {
    const s = words.filter((w) => p.words.includes(w)).length
    if (s > score) {
      best = p
      score = s
    }
  }
  return best
}

// A component's headline state for the snapshot table.
function stateOf(c: AgentComponent) {
  for (const k of ["checked", "pressed", "value", "open"]) {
    if (k in c) {
      const v = c[k]
      if (v === null || v === undefined || v === "") return "empty"
      return typeof v === "string" ? `"${v}"` : JSON.stringify(v)
    }
  }
  return ""
}

// Whether the snapshot taken before the call already showed the value a step
// asks for. act reports such a step, and one the app cancelled, the same way:
// result false and no changes. Only the snapshot tells them apart.
function alreadySet(list: AgentComponent[], resolved: string | undefined, step: AgentStep) {
  const c = list.find((x) => x.ref === resolved?.split(" · ")[0])
  if (!c || step.args?.length !== 1) return false
  const want = String(step.args[0]).toLowerCase()
  const have = String(c.checked ?? c.value ?? "").toLowerCase()
  const label = c.items?.find((i) => i.value.toLowerCase() === have)?.label.toLowerCase()
  return have === want || label === want
}

function stepText(s: AgentStep) {
  const args = (s.args ?? []).map((a) => JSON.stringify(a)).join(", ")
  return `${s.action}(${args})`
}

type Row = {
  step: AgentStep
  resolved?: string
  status: "queued" | "ran" | "waiting" | "done" | "same" | "cancelled" | "failed" | "skipped"
  detail?: string
}

type Run = {
  plan: Plan
  snapshot?: { list: AgentComponent[]; chars: number }
  rows: Row[]
  result?: ActResult
  ms?: number
  ask?: { action: AgentAction; answer: (yes: boolean) => void }
}

// Runs one act call and times it in the page. Outside the component so the
// clock is read in an event handler's async work, never during render.
async function timedAct(agent: Agent, steps: AgentStep[]): Promise<{ result: ActResult; ms: number }> {
  const t0 = performance.now()
  let result: ActResult
  try {
    result = await agent.act({ steps })
  } catch (e) {
    result = { ok: false, error: { step: 0, message: String(e) }, steps: [], appeared: [], values: {} }
  }
  return { result, ms: Math.round(performance.now() - t0) }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function flash(ref: string | undefined, color: string, elementOf: ((ref: string) => HTMLElement) | null) {
  if (!ref || !elementOf) return
  try {
    const el = elementOf(ref)
    el?.animate(
      [{ boxShadow: `0 0 0 3px ${color}` }, { boxShadow: `0 0 0 3px ${color}`, offset: 0.6 }, { boxShadow: "0 0 0 3px transparent" }],
      { duration: 1400, easing: "ease-out" },
    )
  } catch {
    // A ref whose component left the page has no element; nothing to point at.
  }
}

function AgentBridge() {
  const bridges = useRef<{ plain: Agent; asking: Agent } | null>(null)
  const elementOfRef = useRef<((ref: string) => HTMLElement) | null>(null)
  const resolvedRef = useRef<Map<number, string>>(new Map())
  const askRef = useRef<((a: AgentAction) => Promise<boolean>) | null>(null)
  const indexRef = useRef(0)
  const lockRef = useRef(true)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [typed, setTyped] = useState("")
  const [noMatch, setNoMatch] = useState(false)
  const [mode, setMode] = useState<"ask" | "none">("ask")
  const [lock, setLock] = useState(true)
  const [credits, setCredits] = useState(0)
  const [formKey, setFormKey] = useState(0)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    lockRef.current = lock
  }, [lock])

  useEffect(() => {
    let live = true
    Promise.all([import("@ui-sdk/react/agent"), import("@ui-sdk/react/observe")]).then(([{ createAgent }, { elementOf }]) => {
      if (!live) return
      elementOfRef.current = elementOf
      // Two real bridges on one page. "asking" has an allow callback: it sees
      // every step resolved to its component (which is how this panel shows
      // what a ref resolved to), and for a step under data-agent-confirm it
      // waits for the Allow / Deny buttons in the panel. "plain" has none, so
      // such a step fails with "Needs a person".
      const plain = createAgent()
      const asking = createAgent({
        allow: (action) => {
          resolvedRef.current.set(indexRef.current++, `${action.ref} · ${action.component}${action.label ? ` "${action.label}"` : ""}`)
          if (!action.confirm) return true
          return askRef.current ? askRef.current(action) : false
        },
      })
      bridges.current = { plain, asking }
      setReady(true)
    })
    return () => {
      live = false
    }
  }, [])

  const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  async function go(plan: Plan) {
    const b = bridges.current
    if (!b || busy) return
    setBusy(true)
    setShowJson(false)
    const pace = reduced() ? 0 : 1
    const agent = mode === "ask" ? b.asking : b.plain
    indexRef.current = 0
    resolvedRef.current = new Map()
    const rows: Row[] = plan.steps.map((step) => ({ step, status: "queued" }))
    setRun({ plan, rows })
    await wait(350 * pace)

    // Turn 1: read the page.
    const list = agent.snapshot()
    setRun({ plan, rows, snapshot: { list, chars: JSON.stringify(list).length } })
    await wait(700 * pace)

    // Turn 2: one act call with every step. allow may pause it for a person.
    askRef.current = (action) =>
      new Promise<boolean>((resolve) => {
        flash(action.ref, "rgb(245 158 11)", elementOfRef.current)
        setRun((r) =>
          r && {
            ...r,
            rows: r.rows.map((row, i) => {
              const at = resolvedRef.current.size - 1
              if (i === at) return { ...row, status: "waiting" }
              return i < at && row.status === "queued" ? { ...row, status: "ran" } : row
            }),
            ask: {
              action,
              answer: (yes) => {
                setRun((rr) => rr && { ...rr, ask: undefined })
                resolve(yes)
              },
            },
          },
        )
      })
    const { result, ms } = await timedAct(agent, plan.steps)
    askRef.current = null

    // Reveal each step's outcome in order, pointing at what it touched.
    const done = rows.map((row, i): Row => {
      const s = result.steps.find((x) => x.step === i)
      const resolved = resolvedRef.current.get(i) ?? s?.ref
      if (s) {
        const change = s.changes?.[0]
        if (!change && alreadySet(list, resolved, row.step))
          return { ...row, resolved, status: "same", detail: "Already set; nothing to change." }
        if (!change && s.result === false)
          return { ...row, resolved, status: "cancelled", detail: "The step completed, but the app's onValueChange called details.cancel(), so nothing changed." }
        if (!change && row.step.action === "press")
          return { ...row, resolved, status: "done", detail: "Pressed. The button's own onClick ran." }
        if (!change) return { ...row, resolved, status: "same", detail: "Already set; nothing to change." }
        const v = change.value
        return { ...row, resolved, status: "done", detail: `${change.label ?? change.component}.${change.key} → ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}` }
      }
      if (result.error?.step === i) return { ...row, resolved, status: "failed", detail: result.error.message }
      return { ...row, resolved, status: "skipped", detail: "Not run: the call stops at the first failure." }
    })
    for (let i = 0; i < done.length; i++) {
      const row = done[i]
      const color = row.status === "done" ? "rgb(16 185 129)" : row.status === "failed" ? "rgb(244 63 94)" : "rgb(148 163 184)"
      if (row.status !== "skipped" && row.status !== "same") flash(row.resolved?.split(" · ")[0], color, elementOfRef.current)
      setRun((r) => r && { ...r, rows: done.map((d, j) => (j <= i ? d : r.rows[j])), result: i === done.length - 1 ? result : undefined, ms })
      await wait(320 * pace)
    }
    setRun((r) => r && { ...r, rows: done, result, ms })
    setBusy(false)
  }

  function submitTyped() {
    const plan = match(typed)
    setNoMatch(!plan)
    if (plan) go(plan)
  }

  function reset() {
    setFormKey((k) => k + 1)
    setCredits(0)
    setRun(null)
  }

  const live = run?.snapshot?.list.filter((c) => !c.offPage) ?? []
  const off = (run?.snapshot?.list.length ?? 0) - live.length

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card text-sm text-card-foreground">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-3 py-2.5 sm:px-4">
        <span className="font-medium">The agent bridge, live on a ui-sdk page</span>
        <code className="font-mono text-[11px] text-muted-foreground">createAgent() · snapshot · act</code>
      </figcaption>

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The instruction. Plain HTML on purpose: the bridge cannot see it. */}
        <div className="border-b border-border p-3 sm:p-4 md:col-start-2 md:row-start-1">
          <p className={cn(ui.label, "mb-2")}>1. Tell the agent what to do</p>
          <div className="flex flex-wrap gap-1.5">
            {PLANS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={!ready || busy}
                onClick={() => {
                  setTyped(p.say)
                  setNoMatch(false)
                  go(p)
                }}
                className={cn(
                  "rounded-md border border-border px-2 py-1 text-left text-xs leading-snug hover:bg-muted disabled:opacity-50",
                  run?.plan.id === p.id && "border-foreground bg-muted",
                  ui.focusRing,
                )}
              >
                {p.say}
              </button>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitTyped()
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Or type an instruction"
              placeholder="…or type one, like “buy some credits”"
              className={ui.field}
            />
            <button type="submit" disabled={!ready || busy} className={cn(ui.solid, "shrink-0 disabled:opacity-50")}>
              Run
            </button>
          </form>
          {noMatch ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No model runs on this page, so typed text is matched to one of the six plans above by its words, and that text
              matched none. Try words like region, rename, credits, token, recovery or India.
            </p>
          ) : null}
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            When a step needs a person:
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "ask" | "none")}
              className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
            >
              <option value="ask">allow callback asks me here</option>
              <option value="none">no allow callback</option>
            </select>
          </label>
        </div>

        {/* The page the agent drives. */}
        <div key={formKey} className="border-b border-border p-3 sm:p-4 md:col-start-1 md:row-span-2 md:row-start-1 md:border-r md:border-b-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className={ui.label}>2. The page: Apollo, project settings</p>
            <button type="button" onClick={reset} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
              reset
            </button>
          </div>
          <Tabs defaultValue="general">
            <TabsList aria-label="Settings" className="mb-3 flex gap-1 border-b border-border">
              {["general", "billing"].map((v) => (
                <TabsTab
                  key={v}
                  value={v}
                  className={`-mb-px border-b-2 border-transparent px-2.5 py-1.5 text-sm text-muted-foreground capitalize data-[selected]:border-foreground data-[selected]:text-foreground ${ui.focusRing}`}
                >
                  {v}
                </TabsTab>
              ))}
            </TabsList>
            <TabsPanel value="general" className="grid gap-3 outline-none">
              <Field className="grid gap-1.5">
                <FieldLabel className={ui.label}>Project name</FieldLabel>
                <Input defaultValue="Apollo" className={ui.field} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Select
                  defaultValue="europe"
                  items={REGIONS}
                  onValueChange={(value, details) => {
                    if (lockRef.current && details.source === "agent" && value === "india") details.cancel()
                  }}
                >
                  <div className="grid min-w-0 gap-1.5">
                    <SelectLabel className={ui.label}>Region</SelectLabel>
                    <SelectTrigger className={ui.trigger}>
                      <SelectValue />
                      <Icon d={icons.chevronDown} className="text-muted-foreground" />
                    </SelectTrigger>
                  </div>
                  <SelectContent className={ui.popup}>
                    {REGIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className={ui.item}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Combobox defaultValue="next" items={FRAMEWORKS}>
                  <div className="grid min-w-0 gap-1.5">
                    <ComboboxLabel className={ui.label}>Framework</ComboboxLabel>
                    <ComboboxInput className={ui.field} />
                  </div>
                  <ComboboxContent className={ui.popup}>
                    <ComboboxEmpty className="px-2 py-1.5 text-muted-foreground">No match.</ComboboxEmpty>
                    <ComboboxList>
                      {FRAMEWORKS.map((f) => (
                        <ComboboxItem key={f.value} value={f.value} label={f.label} className={ui.item}>
                          {f.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div className="grid gap-1.5">
                <span id="uisdk-agent-plan" className={ui.label}>
                  Plan
                </span>
                <SegmentedControl
                  aria-labelledby="uisdk-agent-plan"
                  defaultValue="hobby"
                  className="relative isolate grid grid-cols-3 rounded-md border border-border bg-muted p-0.5"
                >
                  <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-[5px] bg-background shadow-sm transition-[left,width] duration-200 motion-reduce:transition-none" />
                  {["Hobby", "Pro", "Team"].map((p) => (
                    <SegmentedControlItem
                      key={p}
                      value={p.toLowerCase()}
                      className={`h-8 rounded-[5px] text-sm text-muted-foreground data-[checked]:font-medium data-[checked]:text-foreground ${ui.focusRing}`}
                    >
                      {p}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </div>
              <div className="flex items-end justify-between gap-3">
                <Field className="grid gap-1.5">
                  <NumberInput defaultValue={1} min={1} max={20} className="grid gap-1.5">
                    <FieldLabel className={ui.label}>Instances</FieldLabel>
                    <NumberInputGroup className="flex h-9 w-28 items-stretch overflow-hidden rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                      <NumberInputDecrement aria-label="Fewer instances" className="grid w-8 place-items-center text-muted-foreground hover:bg-muted data-[disabled]:opacity-40">
                        <Icon d={icons.minus} className="size-3.5" />
                      </NumberInputDecrement>
                      <NumberInputControl className="min-w-0 flex-1 bg-transparent text-center font-mono tabular-nums outline-none" />
                      <NumberInputIncrement aria-label="More instances" className="grid w-8 place-items-center text-muted-foreground hover:bg-muted data-[disabled]:opacity-40">
                        <Icon d={icons.plus} className="size-3.5" />
                      </NumberInputIncrement>
                    </NumberInputGroup>
                  </NumberInput>
                </Field>
                <label className="flex h-9 items-center gap-2 text-sm">
                  Preview deployments
                  <Switch className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted-foreground/30 data-[checked]:bg-foreground ${ui.focusRing}`}>
                    <SwitchThumb className="ml-0.5 block size-4 rounded-full bg-background shadow transition-transform data-[checked]:translate-x-4 motion-reduce:transition-none" />
                  </Switch>
                </label>
              </div>
            </TabsPanel>
            <TabsPanel value="billing" className="grid gap-3 outline-none">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  Credits bought: <span className="font-mono text-foreground">{credits.toLocaleString("en-US")}</span>
                </span>
                <Button data-agent-confirm={CONFIRM} onClick={() => setCredits((c) => c + 1000)} className={ui.solid}>
                  Buy credits
                </Button>
              </div>
              <Field className="grid gap-1.5" data-agent-secret="">
                <div className="flex items-baseline justify-between gap-2">
                  <FieldLabel className={ui.label}>API token</FieldLabel>
                  <code aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">data-agent-secret</code>
                </div>
                <Input defaultValue="" className={cn(ui.field, "font-mono")} />
              </Field>
              <div data-agent-hidden="" className="rounded-md border border-dashed border-border p-2">
                <Field className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <FieldLabel className={ui.label}>Recovery codes</FieldLabel>
                    <code aria-hidden="true" className="font-mono text-[10px] text-muted-foreground">data-agent-hidden</code>
                  </div>
                  <Input defaultValue="4F7K-22QX 9MZD-0LPE" className={cn(ui.field, "font-mono")} />
                </Field>
              </div>
            </TabsPanel>
          </Tabs>
          <label className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} className="mt-0.5" />
            <span>
              App policy: Region&apos;s <code className="font-mono">onValueChange</code> calls{" "}
              <code className="font-mono">details.cancel()</code> when an agent picks India. The agent cannot see this.
            </span>
          </label>
        </div>

        {/* The trace. */}
        <div className="min-w-0 p-3 sm:p-4 md:col-start-2 md:row-start-2" aria-live="polite">
          <p className={cn(ui.label, "mb-2")}>3. What the agent read, sent and got back</p>
          {!run ? (
            <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              {ready ? "Pick an instruction. The agent will snapshot the page, then send one act call." : "Loading the bridge…"}
            </p>
          ) : (
            <ol className="grid gap-3">
              <Turn n={1} call="snapshot()" note={run.snapshot ? `${live.length} components · ${run.snapshot.chars.toLocaleString("en-US")} characters of JSON` : "reading…"}>
                {run.snapshot ? (
                  <ul className="max-h-48 overflow-y-auto rounded-md border border-border bg-background font-mono text-[11px] leading-relaxed">
                    {live.map((c) => (
                      <li key={c.ref} className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-2 py-1 last:border-b-0">
                        <span className="w-7 shrink-0 text-muted-foreground">{c.ref}</span>
                        <span className="text-muted-foreground">{c.component}</span>
                        <span className="font-medium text-foreground">{c.label ?? "(no label)"}</span>
                        <span className="text-foreground/80">{stateOf(c)}</span>
                        {c.items ? <span className="text-muted-foreground">{c.items.length} items</span> : null}
                        {c.confirm ? <span className="text-amber-600 dark:text-amber-400">needs a person</span> : null}
                      </li>
                    ))}
                    {off > 0 ? (
                      <li className="px-2 py-1 text-muted-foreground">
                        + {off} off the page (offPage: true), from a closed tab or an earlier reset
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                {run.snapshot ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {live.some((c) => c.component === "tabs" && c.value === "billing")
                      ? "Not listed: the recovery codes (data-agent-hidden) and every plain HTML control here. General's fields are off the page while Billing is open."
                      : "Not listed: the Billing tab's fields, which are not on the page until that tab opens, and every plain HTML control here, like the instruction buttons above."}
                  </p>
                ) : null}
              </Turn>

              {run.snapshot ? (
                <Turn
                  n={2}
                  call={`act({ steps: [${run.rows.length}] })`}
                  note={run.result ? actNote(run) : "running…"}
                >
                  <ol className="grid gap-1.5">
                    {run.rows.map((row, i) => (
                      <StepRow key={i} i={i} row={row} />
                    ))}
                  </ol>
                  {run.ask ? (
                    <div role="alertdialog" aria-label="The agent needs you" className="mt-2 rounded-md border border-amber-500/60 bg-amber-500/10 p-3">
                      <p className="text-xs">
                        <span className="font-medium">The agent wants to press {run.ask.action.label ?? run.ask.action.ref}.</span>{" "}
                        The page says: “{run.ask.action.confirm}”. The act call is paused inside the allow callback.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" autoFocus onClick={() => run.ask?.answer(true)} className={cn(ui.solid, "h-8 text-xs")}>
                          Allow
                        </button>
                        <button type="button" onClick={() => run.ask?.answer(false)} className={cn(ui.button, "h-8 text-xs")}>
                          Deny
                        </button>
                      </div>
                    </div>
                  ) : null}
                </Turn>
              ) : null}

              {run.result ? (
                <Turn n={3} call="reply" note="what a model would tell you, from that result">
                  <p className="rounded-md bg-muted px-3 py-2 text-[13px] leading-snug">{reply(run)}</p>
                  <button
                    type="button"
                    onClick={() => setShowJson((s) => !s)}
                    className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    aria-expanded={showJson}
                  >
                    {showJson ? "Hide" : "Show"} the raw request and response
                  </button>
                  {showJson ? (
                    <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[10.5px] leading-snug">
                      {`→ act(${JSON.stringify({ steps: run.plan.steps }, null, 1)})\n\n← ${JSON.stringify(run.result, null, 1)}`}
                    </pre>
                  ) : null}
                </Turn>
              ) : null}
            </ol>
          )}
        </div>
      </div>
    </figure>
  )
}

function Turn({ n, call, note, children }: { n: number; call: string; note: string; children: ReactNode }) {
  return (
    <li className="grid gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="grid size-5 place-items-center rounded-full bg-foreground text-[10px] font-semibold text-background">{n}</span>
        <code className="font-mono text-xs font-medium">{call}</code>
        <span className="text-xs text-muted-foreground">{note}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  )
}

const STATUS: Record<Row["status"], { mark: string; cls: string; word: string }> = {
  queued: { mark: "·", cls: "text-muted-foreground", word: "queued" },
  ran: { mark: "✓", cls: "text-muted-foreground", word: "ran" },
  waiting: { mark: "⏸", cls: "text-amber-600 dark:text-amber-400", word: "waiting for a person" },
  done: { mark: "✓", cls: "text-emerald-600 dark:text-emerald-400", word: "changed" },
  same: { mark: "○", cls: "text-muted-foreground", word: "already set" },
  cancelled: { mark: "○", cls: "text-amber-600 dark:text-amber-400", word: "cancelled by the app" },
  failed: { mark: "✕", cls: "text-rose-600 dark:text-rose-400", word: "refused" },
  skipped: { mark: "–", cls: "text-muted-foreground", word: "not run" },
}

function StepRow({ i, row }: { i: number; row: Row }) {
  const s = STATUS[row.status]
  return (
    <li
      className={cn(
        "rounded-md border border-border bg-background px-2 py-1.5 text-xs",
        row.status === "failed" && "border-rose-500/50",
        row.status === "waiting" && "border-amber-500/60",
        row.status === "skipped" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-muted-foreground">{i}</span>
        <code className="font-mono font-medium">&quot;{row.step.ref}&quot;</code>
        <code className="font-mono text-muted-foreground">{stepText(row.step)}</code>
        <span className={cn("ml-auto whitespace-nowrap", s.cls)}>
          {s.mark} {s.word}
        </span>
      </div>
      {row.resolved ? (
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">resolved to {row.resolved}</div>
      ) : null}
      {row.detail ? <div className={cn("mt-0.5", row.status === "failed" ? "text-rose-700 dark:text-rose-300" : "text-foreground/80")}>{row.detail}</div> : null}
    </li>
  )
}

function actNote(run: Run) {
  const r = run.result!
  if (r.ok) return `ok: true · ${run.ms} ms in the page`
  const kept = run.rows.some((x, i) => i < (r.error?.step ?? 0) && x.status === "done")
  return `ok: false · stopped at step ${r.error?.step}${kept ? " · the steps before it stay applied, no rollback" : ""}`
}

// The closing message, written from the actual result rather than the plan,
// so it says what happened on this run.
function reply(run: Run) {
  const r = run.result!
  const changed = run.rows.filter((x) => x.status === "done" && x.step.ref !== "Settings")
  const cancelled = run.rows.filter((x) => x.status === "cancelled")
  if (!r.ok) {
    const msg = r.error?.message ?? ""
    if (msg.startsWith("Needs a person")) return `I can't do that one myself: the page says it ${CONFIRM.toLowerCase()}. Please press Buy credits if you want it.`
    if (msg.startsWith("The person said no")) return "You declined the charge, so I didn't buy the credits."
    if (/available to agents/.test(msg)) return "The recovery codes aren't available to me on this page; you'll need to change them yourself."
    return `That didn't work: ${msg}`
  }
  if (cancelled.length) return `The call reported success, but Region didn't change: the app cancelled the move. Region still reads its old value.`
  if (run.plan.id === "token") return "I entered the token. I can't read it back to check it: the page shows it to me as [redacted]."
  if (run.plan.id === "buy") return "Done: you approved the $20 charge and 1,000 credits were added."
  return `Done. ${changed.length} setting${changed.length === 1 ? "" : "s"} changed in one call.`
}

export { AgentBridge }
