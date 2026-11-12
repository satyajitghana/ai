"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import {
  BLANK,
  type Answer,
  type View,
  isWeak,
  layout,
  randomDigits,
  readOut,
  rng,
  runSum,
  tick,
  token,
  viewIndex,
  viewLabel,
} from "./sheet-rule"

// A sheet machine for column addition, in the shape of Sketchpad's SUM procedure.
// The "controller" here is the exact table, not the model: the point is the
// structure. Every tick reads three cells, paints a digit, writes a carry one
// column left and moves the window. Nothing else passes between ticks.

const PRESETS: { a: string; b: string; label: string }[] = [
  { a: "74829", b: "6153", label: "74829 + 6153" },
  { a: "999999999", b: "1", label: "999999999 + 1" },
  { a: "385", b: "516", label: "385 + 516" },
]

type Log = { view: View; answer: Answer; col: number }

function clean(s: string) {
  const d = s.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 40)
  return d === "" ? "0" : d
}

export function TapeAdder() {
  const [a, setA] = useState("74829")
  const [b, setB] = useState("6153")
  const [broken, setBroken] = useState(false)
  const [steps, setSteps] = useState(0)
  const [len, setLen] = useState(10)
  const [seed, setSeed] = useState(1)
  const [suite, setSuite] = useState<null | { len: number; caught: number; views: number }>(null)

  // Replay the first `steps` ticks from a fresh sheet so the view is a pure function of state.
  const { sheet, log, col, done } = useMemo(() => {
    const s = layout(a, b)
    const lg: Log[] = []
    let c = s.n - 1
    for (let i = 0; i < steps && c >= 0; i++) {
      const r = tick(s, c, broken)
      lg.push({ view: r.view, answer: r.answer, col: c })
      c = r.next
    }
    return { sheet: s, log: lg, col: c, done: c < 0 }
  }, [a, b, steps, broken])

  const truth = (BigInt(a) + BigInt(b)).toString()
  const got = readOut(sheet)
  const distinct = new Set(log.map((l) => viewIndex(l.view))).size
  const last = log[log.length - 1]
  const hitWeak = log.some((l) => isWeak(l.view))

  const total = useMemo(() => runSum(a, b, broken).ticks, [a, b, broken])

  function load(x: string, y: string) {
    setA(clean(x))
    setB(clean(y))
    setSteps(0)
  }

  function runSuite() {
    const next = rng(seed * 7919 + len)
    let caught = 0
    const seen = new Set<number>()
    for (let i = 0; i < 20; i++) {
      const x = randomDigits(len, next)
      const y = randomDigits(len, next)
      const r = runSum(x, y, true)
      r.views.forEach((v) => seen.add(v))
      if (r.result !== (BigInt(x) + BigInt(y)).toString()) caught++
    }
    setSuite({ len, caught, views: seen.size })
    setSeed((s) => s + 1)
  }

  const cell = "flex h-7 w-6 items-center justify-center font-mono text-sm sm:w-7"

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 font-mono text-xs text-muted-foreground">
        A sheet machine for long addition · the controller reads three cells and writes one step · the table here is exact, so this shows the structure, not the model
      </figcaption>

      <div className="mb-3 flex flex-wrap gap-1" role="group" aria-label="Choose a sum">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => load(p.a, p.b)}
            className={cn(
              "rounded-md border px-2 py-0.5 font-mono text-xs",
              a === p.a && b === p.b ? "border-foreground text-foreground" : "border-border text-muted-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="font-mono text-xs text-muted-foreground">
          top
          <input
            value={a}
            inputMode="numeric"
            onChange={(e) => load(e.target.value, b)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-sm text-foreground"
          />
        </label>
        <label className="font-mono text-xs text-muted-foreground">
          bottom
          <input
            value={b}
            inputMode="numeric"
            onChange={(e) => load(a, e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-sm text-foreground"
          />
        </label>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="inline-grid gap-y-0.5" style={{ gridTemplateColumns: `4.5rem repeat(${sheet.n}, auto)` }}>
          {(["carry", "top", "bottom", "result"] as const).map((row) => (
            <Row
              key={row}
              name={row}
              cells={row === "carry" ? sheet.car : row === "top" ? sheet.top : row === "bottom" ? sheet.bot : sheet.out}
              col={col}
              inView={row !== "result"}
              cellClass={cell}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={done}
          onClick={() => setSteps((s) => s + 1)}
          className="rounded-md border border-foreground px-3 py-1 font-mono text-xs text-foreground disabled:opacity-40"
        >
          step
        </button>
        <button
          type="button"
          disabled={done}
          onClick={() => setSteps(total)}
          className="rounded-md border border-border px-3 py-1 font-mono text-xs text-muted-foreground disabled:opacity-40"
        >
          run to halt
        </button>
        <button
          type="button"
          onClick={() => setSteps(0)}
          className="rounded-md border border-border px-3 py-1 font-mono text-xs text-muted-foreground"
        >
          reset
        </button>
        <label className="ml-auto flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <input type="checkbox" checked={broken} onChange={(e) => setBroken(e.target.checked)} />
          break one row: 5 over 6, no carry → 2, carry 1
        </label>
      </div>

      <div className="mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 font-mono text-xs sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground">last view (carry, top, bottom)</div>
          <div className="text-foreground">
            {last ? (
              <>
                [{viewLabel(last.view)}] → <span className="text-[oklch(0.62_0.2_10)]">{token(last.answer)}</span>
                {last.answer.halt ? " halt" : ` = digit ${last.answer.digit}, carry ${last.answer.carry}`}
              </>
            ) : (
              "not started"
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">ticks · distinct views read</div>
          <div className="text-foreground">
            {log.length} of {total} · {distinct}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">result vs exact integer sum</div>
          <div className={cn(!done ? "text-muted-foreground" : got === truth ? "text-[oklch(0.6_0.13_150)]" : "text-[oklch(0.62_0.2_25)]")}>
            {!done ? "running" : got === truth ? `exact: ${got}` : `wrong: ${got}`}
          </div>
        </div>
      </div>
      {broken && done && !hitWeak && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          This run never read the broken row, so it came out exact anyway. A test only checks the views it reaches.
        </p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-1 font-mono text-xs text-muted-foreground">
          Sample testing with the broken row: 20 random sums of <span className="text-foreground">{len}</span> digits each
        </div>
        <Range min={2} max={1000} step={1} value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-full" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runSuite}
            className="rounded-md border border-foreground px-3 py-1 font-mono text-xs text-foreground"
          >
            run 20 sums
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            {suite
              ? `${suite.len}-digit sums: ${suite.caught} of 20 came out wrong; together they read ${suite.views} of the 242 views`
              : "press run: a short suite usually passes a machine with a wrong row"}
          </span>
        </div>
      </div>
    </figure>
  )
}

function Row({
  name,
  cells,
  col,
  inView,
  cellClass,
}: {
  name: string
  cells: string[]
  col: number
  inView: boolean
  cellClass: string
}) {
  return (
    <>
      <div className="flex h-7 items-center font-mono text-xs text-muted-foreground">{name}</div>
      {cells.map((g, i) => (
        <div
          key={i}
          className={cn(
            cellClass,
            "border-x border-transparent",
            inView && i === col && "border-[oklch(0.62_0.2_10)] bg-[oklch(0.62_0.2_10/0.12)]",
            name === "carry" && "text-xs text-muted-foreground",
            name === "result" && "text-[oklch(0.62_0.2_10)]",
          )}
        >
          {g === BLANK ? "" : g}
        </div>
      ))}
    </>
  )
}
