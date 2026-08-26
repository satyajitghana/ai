"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why the shipped smart home has a *study* and not an *office*.
//
// smart_home.py's module docstring states the rule outright:
//
//   "One learned rule: avoid enum values that hide inside likely query words
//    (a room named office poisons an off action, so this home has a study)."
//
// The mechanism is not in the Python — the decoder is a native library. But the
// engine binary carries a debug format string that names it:
//
//   [debug] enum select: start=%d acc='%s' grounded=%zu best=%s
//
// `acc` is the accumulated bytes, `grounded` is a count, `best` is the winner.
// So enum selection scores candidates by whether they are *grounded* in the
// input, and the count is a plain occurrence count over the query text. `off`
// occurs inside `office`, so a home with an office room grounds the `off`
// action in every sentence that mentions that room — including "turn ON the
// office lights". Rename the room and the collision disappears.
//
// I ran the check over all six shipped environments: every enum value against
// every one of the 192 test queries, substring hit vs word-boundary hit. Two
// substring-only groundings survive in the shipped files, both listed below.

const HIT = "oklch(0.58 0.19 27)"
const WORD = "oklch(0.55 0.16 155)"
const NONE = "oklch(0.62 0.03 250)"
const NOTE = "oklch(0.68 0.13 85)"

type Scene = {
  k: string
  label: string
  file: string
  query: string
  values: string[]
  want: string[]
  verdict: "clean" | "poisoned" | "harmless"
  note: string
}

const SCENES: Scene[] = [
  {
    k: "office",
    label: "if the room were called office",
    file: "smart_home.py — the version the docstring warns about",
    query: "turn on the office lights",
    values: ["on", "off", "dim", "kitchen", "living_room", "bedroom", "office"],
    want: ["on", "office"],
    verdict: "poisoned",
    note: "`off` occurs inside `office`, so both actions ground in a sentence that says on",
  },
  {
    k: "study",
    label: "the room the repo actually ships",
    file: "smart_home.py — as released",
    query: "turn on the study lights",
    values: ["on", "off", "dim", "kitchen", "living_room", "bedroom", "study"],
    want: ["on", "study"],
    verdict: "clean",
    note: "one action grounds, one room grounds, nothing else is in the sentence",
  },
  {
    k: "sunflower",
    label: "a collision still in the repo",
    file: "productivity.py, case 20 of 32",
    query: "make a note that sunflower42 is the wifi password",
    values: ["low", "medium", "high"],
    want: [],
    verdict: "poisoned",
    note: "`low` occurs inside `sunflower42`; the case expects create_note with no priority at all",
  },
  {
    k: "brewing",
    label: "a collision that happens to help",
    file: "kitchen_appliance.py, a positive case",
    query: "start brewing another batch of coffee",
    values: ["brew", "stop", "start"],
    want: ["brew", "start"],
    verdict: "harmless",
    note: "`brew` occurs only inside `brewing` — the substring match lands on the right answer by luck",
  },
]

// deterministic, pure string work — no RNG, no Math transcendentals
function scan(query: string, value: string) {
  const q = query.toLowerCase()
  const v = value.toLowerCase()
  const spans: { a: number; b: number }[] = []
  let i = q.indexOf(v)
  while (i !== -1) {
    spans.push({ a: i, b: i + v.length })
    i = q.indexOf(v, i + 1)
  }
  if (spans.length === 0) return { kind: "none" as const, spans }
  const isWord = spans.some((s) => {
    const before = s.a === 0 ? " " : q[s.a - 1]
    const after = s.b === q.length ? " " : q[s.b]
    return !/[a-z0-9_]/.test(before) && !/[a-z0-9_]/.test(after)
  })
  return { kind: isWord ? ("word" as const) : ("substring" as const), spans }
}

export function EnumGrounding() {
  const [k, setK] = useState("office")
  const scene = SCENES.find((s) => s.k === k)!

  const rows = scene.values.map((v) => {
    const r = scan(scene.query, v)
    const wanted = scene.want.includes(v)
    return { v, ...r, wanted, spurious: r.kind === "substring" && !wanted }
  })

  const grounded = rows.filter((r) => r.kind !== "none")
  const spurious = rows.filter((r) => r.spurious)

  // character-level highlight map for the query, keyed by the worst status at each index
  const marks = new Array(scene.query.length).fill(0) as number[]
  for (const r of rows) {
    for (const s of r.spans) {
      for (let i = s.a; i < s.b; i++) marks[i] = Math.max(marks[i], r.spurious ? 2 : 1)
    }
  }
  const chunks: { text: string; mark: number }[] = []
  for (let i = 0; i < scene.query.length; i++) {
    const last = chunks.at(-1)
    if (last && last.mark === marks[i]) last.text += scene.query[i]
    else chunks.push({ text: scene.query[i], mark: marks[i] })
  }

  const verdictColour =
    scene.verdict === "poisoned" ? HIT : scene.verdict === "clean" ? WORD : NOTE

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">{scene.file}</span>
        <span className="font-mono text-[10px]" style={{ color: verdictColour }}>
          {grounded.length} of {rows.length} grounded · {spurious.length} spurious
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SCENES.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => setK(s.k)}
              aria-pressed={k === s.k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                k === s.k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/25 px-3 py-2.5 font-mono text-[12.5px] leading-6">
          <span className="text-muted-foreground">user &rsaquo;{"  "}</span>
          {chunks.map((c, i) => (
            <span
              key={i}
              className={cn(c.mark > 0 && "rounded-[3px] px-[1px]")}
              style={
                c.mark === 2
                  ? { background: HIT, color: "white" }
                  : c.mark === 1
                    ? { background: "color-mix(in oklch, var(--foreground) 12%, transparent)" }
                    : undefined
              }
            >
              {c.text}
            </span>
          ))}
        </div>

        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {rows.map((r) => (
            <li
              key={r.v}
              className="flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5"
              style={{
                borderColor: r.spurious
                  ? "color-mix(in oklch, oklch(0.58 0.19 27) 55%, transparent)"
                  : undefined,
              }}
            >
              <code className="font-mono text-[11px] text-foreground">&quot;{r.v}&quot;</code>
              <span
                className="font-mono text-[9.5px]"
                style={{
                  color: r.kind === "none" ? NONE : r.spurious ? HIT : WORD,
                }}
              >
                {r.kind === "none"
                  ? "not present"
                  : r.kind === "word"
                    ? "on a word boundary"
                    : r.spurious
                      ? "hides inside a word ✗"
                      : "hides inside a word"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-2 font-mono text-[9.5px]" style={{ color: verdictColour }}>
          {scene.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Red means the value was found only <em>inside</em> another word, and is not one the case
          expects. The decoder cannot tell that apart from a value the user actually said — the
          engine grounds candidates by occurrence, not by a parse — so every red row is a false
          signal arriving at selection with the same weight as a true one.
          <br />
          <br />
          Switch between the first two scenarios to watch the fix. One character of vocabulary — a{" "}
          <span style={{ color: WORD }}>study</span> instead of an office — and the phantom{" "}
          <code className="font-mono text-[11px]" style={{ color: HIT }}>
            &quot;off&quot;
          </code>{" "}
          disappears from a sentence that says <em>on</em>. The other two scenarios are the residue:
          every enum value in the repo checked against all 192 shipped queries leaves exactly{" "}
          <span style={{ color: HIT }}>two substring-only groundings</span>, one harmless and one
          not.
        </p>
      </div>
    </figure>
  )
}
