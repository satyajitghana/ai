"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// What a planner-executor split costs against one strong model doing the whole
// job, from list prices only. Prices are USD per million tokens as recorded in
// data/models.ts (snapshot 2026-11-12, Artificial Analysis records); Haiku 5.5
// is its up-to-100k-prompt tier. No cache pricing: data/models.ts has none, and
// a real agent loop is mostly cache reads, so treat every result as an upper
// bound on the input side for both arms. Token counts are inputs, not
// measurements: shadcn/improve publishes none.

type Model = { id: string; name: string; inp: number; out: number }

const STRONG: Model[] = [
  { id: "opus", name: "Opus 5.5", inp: 4, out: 20 },
  { id: "fable", name: "Fable 5.2", inp: 8, out: 40 },
]
const CHEAP: Model[] = [
  { id: "sonnet", name: "Sonnet 5.5", inp: 2, out: 10 },
  { id: "haiku", name: "Haiku 5.5", inp: 0.1, out: 0.5 },
]

type Preset = {
  id: string
  name: string
  planIn: number
  planOut: number
  execIn: number
  execOut: number
  revIn: number
  revOut: number
  note: string
}

const PRESETS: Preset[] = [
  { id: "small", name: "Small fix", planIn: 30, planOut: 3, execIn: 80, execOut: 6, revIn: 25, revOut: 2, note: "A one-file bug fix: the plan and its review are a large share of the work." },
  { id: "refactor", name: "Refactor", planIn: 60, planOut: 4, execIn: 300, execOut: 20, revIn: 40, revOut: 3, note: "A shared helper extracted from two commands, as in the repo's example plan." },
  { id: "migration", name: "Migration", planIn: 90, planOut: 6, execIn: 1200, execOut: 60, revIn: 70, revOut: 4, note: "Many files, many test runs: execution dwarfs the plan." },
]

const usd = (m: Model, inK: number, outK: number) => (inK * m.inp + outK * m.out) / 1000

function money(v: number) {
  return v < 1 ? `$${v.toFixed(3)}` : `$${v.toFixed(2)}`
}

const C_STRONG = "oklch(0.58 0.14 30)"
const C_CHEAP = "oklch(0.6 0.12 200)"

export function SplitCost() {
  const [p, setP] = useState<Preset>(PRESETS[1])
  const [strong, setStrong] = useState<Model>(STRONG[0])
  const [cheap, setCheap] = useState<Model>(CHEAP[0])
  const [rounds, setRounds] = useState(0)
  const [redo, setRedo] = useState(40)

  const set = (patch: Partial<Preset>) => setP({ ...p, ...patch, id: "custom" })

  // one strong model does it all: it still has to understand the code, so it
  // pays the plan's reading (planIn) but writes no plan and reviews no diff
  const solo = usd(strong, p.planIn + p.execIn, p.execOut)

  const plan = usd(strong, p.planIn, p.planOut)
  const exec = usd(cheap, p.execIn, p.execOut) * (1 + (rounds * redo) / 100)
  const review = usd(strong, p.revIn, p.revOut) * (1 + rounds)
  const split = plan + exec + review
  const saving = solo > 0 ? (1 - split / solo) * 100 : 0
  const max = Math.max(solo, split, 1e-9)

  const sliders: { label: string; key: keyof Preset; max: number; step: number }[] = [
    { label: "strong model reads, to plan (k tokens in)", key: "planIn", max: 300, step: 5 },
    { label: "plan written (k tokens out)", key: "planOut", max: 20, step: 1 },
    { label: "executor loop (k tokens in)", key: "execIn", max: 2000, step: 10 },
    { label: "executor writes (k tokens out)", key: "execOut", max: 150, step: 1 },
    { label: "review: plan + diff + test logs (k in)", key: "revIn", max: 200, step: 5 },
    { label: "review verdict (k tokens out)", key: "revOut", max: 20, step: 1 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one strong model vs plan, execute, review</span>
        <span className="text-muted-foreground/60">list prices, no caching</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setP(x)}
              className={`rounded-md border px-2.5 py-1 text-xs ${p.id === x.id ? "border-foreground/40 bg-muted font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              {x.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{p.id === "custom" ? "Your own token counts." : p.note}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">advisor (plans and reviews)</span>
            <select
              value={strong.id}
              onChange={(e) => setStrong(STRONG.find((m) => m.id === e.target.value) ?? STRONG[0])}
              className="w-full rounded-md border bg-background px-2 py-1"
            >
              {STRONG.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (${m.inp} / ${m.out})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">executor</span>
            <select
              value={cheap.id}
              onChange={(e) => setCheap(CHEAP.find((m) => m.id === e.target.value) ?? CHEAP[0])}
              className="w-full rounded-md border bg-background px-2 py-1"
            >
              {CHEAP.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (${m.inp} / ${m.out})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {sliders.map((s) => (
            <label key={s.key} className="block text-xs">
              <span className="flex justify-between text-muted-foreground">
                <span>{s.label}</span>
                <span className="font-mono text-foreground">{p[s.key]}</span>
              </span>
              <Range min={0} max={s.max} step={s.step} value={p[s.key] as number} onChange={(e) => set({ [s.key]: Number(e.target.value) })} />
            </label>
          ))}
          <label className="block text-xs">
            <span className="flex justify-between text-muted-foreground">
              <span>revision rounds (the skill caps it at 2)</span>
              <span className="font-mono text-foreground">{rounds}</span>
            </span>
            <Range min={0} max={2} step={1} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
          </label>
          <label className="block text-xs">
            <span className="flex justify-between text-muted-foreground">
              <span>share of the executor&apos;s work redone per round</span>
              <span className="font-mono text-foreground">{redo}%</span>
            </span>
            <Range min={0} max={100} step={5} value={redo} onChange={(e) => setRedo(Number(e.target.value))} />
          </label>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>{strong.name} does everything</span>
              <span className="font-mono">{money(solo)}</span>
            </div>
            <div className="h-5 rounded bg-muted/40">
              <div className="h-5 rounded" style={{ width: `${(solo / max) * 100}%`, background: C_STRONG }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>
                plan ({strong.name}) + execute ({cheap.name}) + review ({strong.name})
              </span>
              <span className="font-mono">{money(split)}</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded bg-muted/40">
              <div title="plan" style={{ width: `${(plan / max) * 100}%`, background: C_STRONG }} />
              <div title="execute" style={{ width: `${(exec / max) * 100}%`, background: C_CHEAP }} />
              <div title="review" style={{ width: `${(review / max) * 100}%`, background: C_STRONG, opacity: 0.6 }} />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[11px] text-muted-foreground">
              <span>plan {money(plan)}</span>
              <span>execute {money(exec)}</span>
              <span>review {money(review)}</span>
            </div>
          </div>
        </div>

        <p className="text-sm">
          {saving >= 0 ? (
            <>
              The split costs <strong>{saving.toFixed(0)}% less</strong> than letting {strong.name} do it alone.
            </>
          ) : (
            <>
              The split costs <strong>{(-saving).toFixed(0)}% more</strong> than letting {strong.name} do it alone.
            </>
          )}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Prices per million tokens (input / output) from this site&apos;s model table, snapshot 2026-11-12; Haiku 5.5 at
        its up-to-100k-prompt tier. Token counts are presets I chose, not measurements, and caching is left out of both
        arms.
      </figcaption>
    </figure>
  )
}
