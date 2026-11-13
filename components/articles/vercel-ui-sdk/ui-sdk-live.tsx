"use client"

import { useEffect, useRef, useState } from "react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"
import { Switch, SwitchThumb } from "@ui-sdk/react/switch"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import type { createAgent as CreateAgent } from "@ui-sdk/react/agent"

import { cn } from "@/lib/utils"

// The real UI SDK, not a simulation: @ui-sdk/react 0.1.0-beta.1 renders the
// form, and the panel calls the real agent bridge (createAgent from
// @ui-sdk/react/agent) against it in this page. The docs create the bridge at
// module scope. createAgent does run in Node (its snapshot is empty there), but
// the bridge belongs to the page, so here it is made in an effect, from a
// dynamic import, after hydration: it finds the components already on the
// page. registerTools is deliberately not called, so the page publishes no
// WebMCP tools beside the site's own.

type Agent = ReturnType<typeof CreateAgent>
type AllowMode = "none" | "yes" | "no"

const REGIONS = [
  { value: "europe", label: "Europe" },
  { value: "north-america", label: "North America" },
  { value: "asia-pacific", label: "Asia Pacific" },
]

const FRAMEWORKS = [
  { value: "next", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt", label: "Nuxt" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
]

const CONFIRM = "Charges $20 to your card for 1,000 credits"

type Call = { label: string; code: string; run: (agent: Agent) => unknown }

const CALLS: Call[] = [
  {
    label: "snapshot()",
    code: "agent.snapshot()",
    run: (agent) => agent.snapshot(),
  },
  {
    label: "query Region",
    code: 'await agent.query({ within: "Region" })',
    run: (agent) => agent.query({ within: "Region" }),
  },
  {
    label: "act: three steps",
    code: `await agent.act({ steps: [
  { ref: "Region", action: "setValue", args: ["Asia Pacific"] },
  { ref: "Framework", action: "setValue", args: ["astro"] },
  { ref: "Preview deployments", action: "setChecked", args: [true] },
] })`,
    run: (agent) =>
      agent.act({
        steps: [
          { ref: "Region", action: "setValue", args: ["Asia Pacific"] },
          { ref: "Framework", action: "setValue", args: ["astro"] },
          { ref: "Preview deployments", action: "setChecked", args: [true] },
        ],
      }),
  },
  {
    label: "act: Buy credits",
    code: `await agent.act({ steps: [
  { ref: "Settings", action: "setValue", args: ["billing"] },
  { ref: "Buy credits", action: "press" },
] })`,
    run: (agent) =>
      agent.act({
        steps: [
          { ref: "Settings", action: "setValue", args: ["billing"] },
          { ref: "Buy credits", action: "press" },
        ],
      }),
  },
  {
    label: "act: API token",
    code: `await agent.act({ steps: [
  { ref: "Settings", action: "setValue", args: ["billing"] },
  { ref: "API token", action: "setValue", args: ["sk-live-123"] },
] })`,
    run: (agent) =>
      agent.act({
        steps: [
          { ref: "Settings", action: "setValue", args: ["billing"] },
          { ref: "API token", action: "setValue", args: ["sk-live-123"] },
        ],
      }),
  },
]

type Log = { source: string; label: string; key: string; value: string }

// Runs one call and times it in the page. Outside the component so the
// clock is read in an event handler, never during render.
async function timed(run: () => unknown) {
  const t0 = performance.now()
  const result = await run()
  return { result, ms: Math.round(performance.now() - t0) }
}

function show(value: unknown) {
  if (value === null || value === undefined) return String(value)
  if (typeof value === "string") return JSON.stringify(value)
  return JSON.stringify(value)
}

function UiSdkLive() {
  const bridgesRef = useRef<{ plain: Agent; asking: Agent } | null>(null)
  const allowRef = useRef<AllowMode>("none")
  const [ready, setReady] = useState(false)
  const [allow, setAllow] = useState<AllowMode>("none")
  const [blockAsia, setBlockAsia] = useState(false)
  const blockRef = useRef(false)
  const [out, setOut] = useState<{ code: string; json: string; ms: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState<Log[]>([])
  const [credits, setCredits] = useState(0)
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    allowRef.current = allow
  }, [allow])
  useEffect(() => {
    blockRef.current = blockAsia
  }, [blockAsia])

  useEffect(() => {
    let stop: (() => void) | undefined
    let live = true
    import("@ui-sdk/react/agent").then(({ createAgent }) => {
      if (!live) return
      // Two bridges on one page, both real. The plain one has no allow
      // callback, so a step inside data-agent-confirm fails with "Needs a
      // person". The other asks allow, which plays the person's answer from
      // the toggle below; it is read when a step runs.
      const plain = createAgent()
      const asking = createAgent({
        allow: (step) => !step.confirm || allowRef.current === "yes",
      })
      bridgesRef.current = { plain, asking }
      stop = plain.subscribe((change) => {
        setLog((rows) =>
          [
            {
              source: String(change.source),
              label: String(change.label ?? change.ref),
              key: String(change.key),
              value: show(change.value),
            },
            ...rows,
          ].slice(0, 6),
        )
      })
      setReady(true)
    })
    return () => {
      live = false
      stop?.()
    }
  }, [])

  async function call(c: Call) {
    const bridges = bridgesRef.current
    if (!bridges || busy) return
    const agent = allowRef.current === "none" ? bridges.plain : bridges.asking
    setBusy(true)
    try {
      const { result, ms } = await timed(() => c.run(agent))
      setOut({ code: c.code, json: JSON.stringify(result, null, 2), ms })
    } catch (e) {
      setOut({ code: c.code, json: String(e), ms: 0 })
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setFormKey((k) => k + 1)
    setCredits(0)
    setLog([])
    setOut(null)
  }

  const trigger =
    "flex w-full items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const popup =
    "z-50 min-w-(--anchor-width) max-h-(--available-height) overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
  const item =
    "cursor-default rounded-sm px-2 py-1.5 outline-none data-highlighted:bg-muted data-selected:font-medium"

  return (
    <div className="not-prose my-8 grid gap-4 rounded-lg border border-border p-4 text-sm md:grid-cols-2">
      <div key={formKey} className="min-w-0">
        <p className="mb-3 font-mono text-xs text-muted-foreground">
          @ui-sdk/react 0.1.0-beta.1, live
        </p>
        <Tabs defaultValue="general">
          <TabsList aria-label="Settings" className="mb-3 flex gap-1 border-b border-border">
            <TabsTab
              value="general"
              className="-mb-px border-b-2 border-transparent px-3 py-1.5 outline-none data-selected:border-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              General
            </TabsTab>
            <TabsTab
              value="billing"
              className="-mb-px border-b-2 border-transparent px-3 py-1.5 outline-none data-selected:border-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Billing
            </TabsTab>
          </TabsList>
          <TabsPanel value="general" className="grid gap-3 outline-none">
            <Field className="grid gap-1">
              <FieldLabel>Project name</FieldLabel>
              <Input
                defaultValue="Apollo"
                className="rounded-md border border-border bg-background px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
            <Select
              defaultValue="europe"
              items={REGIONS}
              onValueChange={(value, details) => {
                if (blockRef.current && details.source === "agent" && value === "asia-pacific") {
                  details.cancel()
                }
              }}
            >
              <div className="grid gap-1">
                <SelectLabel>Region</SelectLabel>
                <SelectTrigger className={trigger}>
                  <SelectValue />
                  <span aria-hidden="true">▾</span>
                </SelectTrigger>
              </div>
              <SelectContent className={popup}>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value} className={item}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Combobox defaultValue="next" items={FRAMEWORKS}>
              <div className="grid gap-1">
                <ComboboxLabel>Framework</ComboboxLabel>
                <ComboboxInput
                  placeholder="Pick a framework"
                  className="rounded-md border border-border bg-background px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <ComboboxContent className={popup}>
                <ComboboxEmpty className="px-2 py-1.5 text-muted-foreground">No match.</ComboboxEmpty>
                <ComboboxList>
                  {FRAMEWORKS.map((f) => (
                    <ComboboxItem key={f.value} value={f.value} label={f.label} className={item}>
                      {f.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
            <label className="flex items-center justify-between gap-3">
              Preview deployments
              <Switch className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-muted outline-none data-checked:bg-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <SwitchThumb className="ml-0.5 block size-4 rounded-full bg-background shadow transition-transform data-checked:translate-x-4" />
              </Switch>
            </label>
          </TabsPanel>
          <TabsPanel value="billing" className="grid gap-3 outline-none">
            <p className="text-muted-foreground">Credits bought: {credits}</p>
            <Button
              data-agent-confirm={CONFIRM}
              onClick={() => setCredits((c) => c + 1000)}
              className="w-fit rounded-md bg-foreground px-3 py-1.5 text-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Buy credits
            </Button>
            <Field className="grid gap-1" data-agent-secret="">
              <FieldLabel>API token</FieldLabel>
              <Input
                defaultValue=""
                className="rounded-md border border-border bg-background px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </Field>
          </TabsPanel>
        </Tabs>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CALLS.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={!ready || busy}
              onClick={() => call(c)}
              className="rounded-md border border-border px-2 py-1 font-mono text-xs hover:bg-muted disabled:opacity-50"
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            reset
          </button>
        </div>
        <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <legend className="sr-only">The allow callback</legend>
          <span className="text-muted-foreground">allow on a confirm step:</span>
          {(["none", "yes", "no"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="uisdk-allow" checked={allow === m} onChange={() => setAllow(m)} />
              {m === "none" ? "no callback" : m === "yes" ? "person says yes" : "person says no"}
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={blockAsia} onChange={(e) => setBlockAsia(e.target.checked)} />
          onValueChange cancels an agent choosing Asia Pacific
        </label>
        <pre className="max-h-72 min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-2 font-mono text-[11px] leading-snug">
          {out
            ? `> ${out.code}\n// returned in ${out.ms} ms\n${out.json}`
            : ready
              ? "Press a call above. It runs against the form on the left."
              : "Loading the bridge…"}
        </pre>
        <div className="text-xs">
          <p className="mb-1 text-muted-foreground">agent.subscribe(): every change, with its source</p>
          <ul className="font-mono text-[11px]">
            {log.length === 0 ? (
              <li className="text-muted-foreground">Change a control yourself, or run an act.</li>
            ) : (
              log.map((l, i) => (
                <li key={i}>
                  <span className={cn(l.source === "agent" ? "text-foreground" : "text-muted-foreground")}>
                    {l.source}
                  </span>{" "}
                  {l.label}.{l.key} → {l.value}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export { UiSdkLive }
