"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// How an agent step finds its component, ported from `find()` in
// vercel-labs/ui at c53df2f4: packages/core/src/page/agent/agent.ts.
//   tier 0  an exact ref ("c3")
//   tier 1  the label, or whole words in label + row text (exact label is in the SAME tier)
//   tier 2  an item the component offers, matched exactly ("Asia Pacific")
//   tier 3  the component's kind ("slider")
// Inside a tier: one match wins; several are narrowed to the ones that take the
// step's action (press always passes); still several is a refusal listing refs.
// Then a match inside data-agent-hidden is named as off-limits; else "No component".
// The toy page is ours. Folding is an approximation: the SDK folds with the
// user's locale; here it is lower case, accents stripped, ß as ss. The
// "open popup wins" rule is left out, since nothing on this page is open.

type Comp = {
  ref: string
  kind: string
  label: string
  row?: string
  items?: string[]
  actions: string[]
  hidden?: boolean
  confirm?: string
}

const PAGE: Comp[] = [
  { ref: "c1", kind: "input", label: "Display name", actions: ["setValue", "clear"] },
  { ref: "c2", kind: "input", label: "Username", actions: ["setValue", "clear"] },
  {
    ref: "c3",
    kind: "select",
    label: "Region",
    items: ["North America", "Europe", "Asia Pacific"],
    actions: ["setOpen", "setValue", "clear", "setQuery"],
  },
  { ref: "c4", kind: "segmented-control", label: "Plan", items: ["Hobby", "Pro", "Team"], actions: ["setValue"] },
  { ref: "c5", kind: "number-input", label: "Instances", actions: ["setValue", "increment", "decrement"] },
  { ref: "c6", kind: "switch", label: "Preview deployments", actions: ["setChecked"] },
  { ref: "c7", kind: "menu", label: "Admin", row: "Jane Doe jane@acme.com", actions: ["setOpen", "press"] },
  { ref: "c8", kind: "checkbox", label: "Jane Doe", actions: ["setChecked"] },
  { ref: "c9", kind: "slider", label: "Build concurrency", actions: ["setValue"] },
  {
    ref: "c10",
    kind: "button",
    label: "Delete project",
    actions: ["press"],
    confirm: "Deletes the project and all its files",
  },
  { ref: "c11", kind: "input", label: "Recovery codes", actions: ["setValue"], hidden: true },
]

const ACTIONS = ["press", "setValue", "setChecked", "setOpen"] as const

const PRESETS: { ref: string; action: (typeof ACTIONS)[number]; why: string }[] = [
  { ref: "name", action: "setValue", why: "whole words: finds Display name, not Username" },
  { ref: "Jane Doe", action: "press", why: "an exact label ties with a row that holds the same words" },
  { ref: "Jane Doe", action: "setChecked", why: "the same tie, broken by the action" },
  { ref: "Asia Pacific", action: "setValue", why: "no label holds it, so the items tier finds Region" },
  { ref: "slider", action: "setValue", why: "the kind tier" },
  { ref: "user", action: "setValue", why: "Username is one word, so nothing matches" },
  { ref: "Recovery codes", action: "setValue", why: "inside data-agent-hidden" },
  { ref: "Delete", action: "press", why: "found, but it carries data-agent-confirm" },
]

const MARKS = new RegExp("\\p{M}", "gu")
const NOT_WORD = new RegExp("[^\\p{L}\\p{N}]+", "gu")

const fold = (s: string) =>
  s
    .replace(/[ßẞ]/g, "ss")
    .normalize("NFD")
    .replace(MARKS, "")
    .toLowerCase()

const wordsOf = (s: string) => ` ${fold(s)} `.replace(NOT_WORD, " ")

const described = (c: Comp) => [c.ref, c.label, c.row && `(${c.row})`].filter(Boolean).join(" ")

type Tier = { name: string; matched: Comp[]; able?: Comp[]; verdict: string }

type Outcome = { tiers: Tier[]; found?: Comp; message: string; ok: boolean }

function resolve(ref: string, action: string): Outcome {
  const shown = PAGE.filter((c) => !c.hidden)
  const tiers: Tier[] = []
  const byRef = shown.find((c) => c.ref === ref)
  tiers.push({ name: "Ref", matched: byRef ? [byRef] : [], verdict: byRef ? "match" : "none" })
  if (byRef) return finish(tiers, byRef, action)

  const needle = fold(ref)
  const words = wordsOf(ref)
  const groups: [string, Comp[]][] = [
    [
      "Label or row words",
      shown.filter(
        (c) => fold(c.label) === needle || (words.trim() !== "" && wordsOf(`${c.label} ${c.row ?? ""}`).includes(words)),
      ),
    ],
    ["An item it offers", shown.filter((c) => c.items?.some((i) => fold(i) === needle))],
    [
      "Its kind",
      shown.filter((c) => {
        const k = fold(c.kind)
        return k === needle || k.endsWith(`-${needle}`)
      }),
    ],
  ]
  for (const [name, near] of groups) {
    if (near.length === 1) {
      tiers.push({ name, matched: near, verdict: "one match" })
      return finish(tiers, near[0], action)
    }
    if (near.length === 0) {
      tiers.push({ name, matched: [], verdict: "none" })
      continue
    }
    const able = near.filter((c) => action === "press" || c.actions.includes(action))
    if (able.length === 1) {
      tiers.push({ name, matched: near, able, verdict: `${near.length} matches, 1 takes ${action}` })
      return finish(tiers, able[0], action)
    }
    tiers.push({
      name,
      matched: near,
      able,
      verdict: `${near.length} matches, ${able.length} take ${action}`,
    })
    return {
      tiers,
      ok: false,
      message: `"${ref}" names ${near.length} components: ${near.map(described).join(", ")}. Use a ref.`,
    }
  }
  const off = PAGE.some(
    (c) => c.hidden && (fold(c.label) === needle || (words.trim() !== "" && wordsOf(`${c.label} ${c.row ?? ""}`).includes(words))),
  )
  if (off) return { tiers, ok: false, message: `"${ref}" isn't available to agents here. Ask the person.` }
  const labels = shown.map((c) => c.label).join(", ")
  return { tiers, ok: false, message: `No component "${ref}" on the page. Its labels: ${labels}.` }
}

function finish(tiers: Tier[], c: Comp, action: string): Outcome {
  const takes = action === "press" ? c.actions.includes("press") || c.kind === "button" : c.actions.includes(action)
  if (!takes) {
    return {
      tiers,
      found: c,
      ok: false,
      message: `${c.kind} ${c.ref} takes no ${action} now. It takes: ${c.actions.join(", ")}.`,
    }
  }
  if (c.confirm) {
    return {
      tiers,
      found: c,
      ok: false,
      message: `Needs a person: "${c.confirm}". Ask them to press "${c.label}" themselves.`,
    }
  }
  return { tiers, found: c, ok: true, message: `${action} runs on ${described(c)}.` }
}

export function RefResolver() {
  const [ref, setRef] = useState("Jane Doe")
  const [action, setAction] = useState<string>("press")
  const out = useMemo(() => resolve(ref, action), [ref, action])
  const hit = new Set(out.tiers.flatMap((t) => t.matched.map((c) => c.ref)))

  return (
    <div className="not-prose my-8 border border-border bg-card p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">How a step finds its component</div>
        <div className="font-mono text-xs text-muted-foreground">port of find(), agent.ts @ c53df2f4</div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={`${p.ref}-${p.action}`}
            type="button"
            onClick={() => {
              setRef(p.ref)
              setAction(p.action)
            }}
            title={p.why}
            className={cn(
              "border px-2 py-1 font-mono text-xs transition-colors",
              ref === p.ref && action === p.action
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:bg-muted",
            )}
          >
            {p.ref} · {p.action}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">ref</span>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            className="w-full border border-border bg-background px-2 py-1 font-mono text-sm"
            aria-label="Step ref"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">action</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="border border-border bg-background px-2 py-1 font-mono text-sm"
            aria-label="Step action"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">The page, as snapshot() lists it</div>
          <ul className="space-y-1">
            {PAGE.map((c) => (
              <li
                key={c.ref}
                className={cn(
                  "flex flex-wrap items-baseline gap-x-2 border px-2 py-1",
                  c.hidden ? "border-dashed opacity-50" : "border-border",
                  out.found?.ref === c.ref
                    ? "border-emerald-600 bg-emerald-500/10"
                    : hit.has(c.ref)
                      ? "border-amber-600 bg-amber-500/10"
                      : "",
                )}
              >
                <span className="w-8 font-mono text-xs text-muted-foreground">{c.ref}</span>
                <span className="font-mono text-xs">{c.kind}</span>
                <span className="font-medium">{c.label}</span>
                {c.row ? <span className="text-xs text-muted-foreground">row: {c.row}</span> : null}
                {c.items ? <span className="text-xs text-muted-foreground">items: {c.items.join(", ")}</span> : null}
                {c.hidden ? <span className="text-xs">data-agent-hidden</span> : null}
                {c.confirm ? <span className="text-xs">data-agent-confirm</span> : null}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Tiers, in order</div>
          <ol className="space-y-1">
            {out.tiers.map((t) => (
              <li key={t.name} className="border border-border px-2 py-1">
                <div className="flex justify-between gap-2">
                  <span>{t.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{t.verdict}</span>
                </div>
                {t.matched.length > 0 ? (
                  <div className="font-mono text-xs text-muted-foreground">{t.matched.map((c) => c.ref).join(", ")}</div>
                ) : null}
              </li>
            ))}
          </ol>
          <div
            className={cn(
              "mt-3 border px-2 py-2 font-mono text-xs",
              out.ok ? "border-emerald-600 bg-emerald-500/10" : "border-rose-600 bg-rose-500/10",
            )}
            aria-live="polite"
          >
            {out.message}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The toy page is ours; the rules are the SDK&apos;s. Case and accent folding is approximated, and the rule that
        an open popup wins a tie is left out because nothing here is open.
      </p>
    </div>
  )
}
