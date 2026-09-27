"use client"

import { useState } from "react"

// jevgrep's walk, step by step, on a toy repository. The control flow is the
// real one from packages/core/src/retrieve.ts at commit 762028f:
//
//   - discover(["."]) runs level by level. A seed directory is listed, and its
//     child directories are listed too without asking Jev anything (the
//     one-level lookahead). Jev is asked about the grandchildren directories,
//     from a preview of their child names, and about every file reached, from
//     its text in 12,000-byte chunks.
//   - A directory above 0.5 becomes a seed for the next level; one at or below
//     it is remembered as pruned. A file above 0.25 is admitted.
//   - Then one anchor pass: the first admitted file above 0.5, in score order,
//     that declares a class with methods becomes the anchor, and every pruned
//     directory is asked again, with samples of its files' content, whether
//     its code relates to that class.
//   - Admitted files go to declaration selection: above 0.5 is a verbatim
//     source block, above 0.25 a reading lead.
//
// The tree, the question and every score below are illustrative. The
// thresholds, the order of operations and the packet format are the tool's.

type Kind = "dir" | "file"
type NodeDef = { id: string; name: string; depth: number; kind: Kind }

const TREE: NodeDef[] = [
  { id: ".", name: "my-repo/", depth: 0, kind: "dir" },
  { id: "docs", name: "docs/", depth: 1, kind: "dir" },
  { id: "docs/guide.md", name: "guide.md", depth: 2, kind: "file" },
  { id: "README.md", name: "README.md", depth: 1, kind: "file" },
  { id: "src", name: "src/", depth: 1, kind: "dir" },
  { id: "src/api", name: "api/", depth: 2, kind: "dir" },
  { id: "src/api/routes.py", name: "routes.py", depth: 3, kind: "file" },
  { id: "src/db", name: "db/", depth: 2, kind: "dir" },
  { id: "src/db/connection.py", name: "connection.py", depth: 3, kind: "file" },
  { id: "src/db/models.py", name: "models.py", depth: 3, kind: "file" },
  { id: "src/db/pool.py", name: "pool.py", depth: 3, kind: "file" },
  { id: "src/utils", name: "utils/", depth: 2, kind: "dir" },
  { id: "src/utils/strings.py", name: "strings.py", depth: 3, kind: "file" },
  { id: "tests", name: "tests/", depth: 1, kind: "dir" },
  { id: "tests/test_connection.py", name: "test_connection.py", depth: 2, kind: "file" },
  { id: "tests/test_models.py", name: "test_models.py", depth: 2, kind: "file" },
]

type State =
  | { t: "open" }
  | { t: "queued" }
  | { t: "walk"; p: number }
  | { t: "pruned"; p: number }
  | { t: "in"; p: number }
  | { t: "out"; p: number }
  | { t: "anchor"; p: number }
  | { t: "related"; p: number }
  | { t: "unrelated"; p: number }

type Step = { title: string; text: string; states: Record<string, State> }

const ROUND1_OPEN: Record<string, State> = {
  ".": { t: "open" },
  docs: { t: "open" },
  src: { t: "open" },
  tests: { t: "open" },
}
const ROUND1: Record<string, State> = {
  ...ROUND1_OPEN,
  "docs/guide.md": { t: "in", p: 0.31 },
  "README.md": { t: "out", p: 0.1 },
  "src/api": { t: "pruned", p: 0.22 },
  "src/db": { t: "walk", p: 0.93 },
  "src/utils": { t: "pruned", p: 0.08 },
  "tests/test_connection.py": { t: "in", p: 0.81 },
  "tests/test_models.py": { t: "out", p: 0.19 },
}
const ROUND2: Record<string, State> = {
  ...ROUND1,
  "src/db/connection.py": { t: "in", p: 0.88 },
  "src/db/models.py": { t: "out", p: 0.12 },
  "src/db/pool.py": { t: "in", p: 0.74 },
}
const ANCHORED: Record<string, State> = {
  ...ROUND2,
  "src/db/pool.py": { t: "anchor", p: 0.74 },
  "src/api": { t: "related", p: 0.64 },
  "src/utils": { t: "unrelated", p: 0.05 },
  "src/api/routes.py": { t: "in", p: 0.41 },
}

const STEPS: Step[] = [
  {
    title: "0 · the question",
    text: "The agent runs jg with a question and a root. Nothing has been read yet. Jev will only ever be asked yes-or-no questions, and every answer is a probability.",
    states: { ".": { t: "open" } },
  },
  {
    title: "1 · open the root, look one level ahead",
    text: "The root is listed, and so are docs/, src/ and tests/, without asking Jev about them: a thin wrapper directory must not hide what is under it. Jev is asked about the next layer: three directories, judged from a preview of their child names, and four files, judged from their full text in 12,000-byte chunks. All seven go out as one batched request.",
    states: {
      ...ROUND1_OPEN,
      "docs/guide.md": { t: "queued" },
      "README.md": { t: "queued" },
      "src/api": { t: "queued" },
      "src/db": { t: "queued" },
      "src/utils": { t: "queued" },
      "tests/test_connection.py": { t: "queued" },
      "tests/test_models.py": { t: "queued" },
    },
  },
  {
    title: "2 · the answers come back",
    text: "A directory above 0.5 becomes a seed for the next level; src/api/ and src/utils/ fall below it and are remembered as pruned, not forgotten. A file above 0.25 is admitted. The bar for files is deliberately low: the docs page gets in at 0.31, which is why the skill tells the agent to scope jg to the code folder.",
    states: ROUND1,
  },
  {
    title: "3 · the next level: src/db/",
    text: "src/db/ is walked like the root was. It has no subdirectories to look ahead into, so its three files are read in full and judged. models.py is dropped at 0.12. There are no more admitted directories, so the walk would stop here.",
    states: ROUND2,
  },
  {
    title: "4 · one anchor pass",
    text: "jg takes admitted files above 0.5 in score order and picks the first one that declares a class with methods. connection.py and the test file hold only functions, so pool.py and its class Pool become the anchor. Each pruned directory is asked again, now with samples of its files' content: does this code declare, subclass, override or use Pool? src/api/ does, at 0.64, so it is walked, and routes.py is admitted at 0.41. src/utils/ stays pruned.",
    states: ANCHORED,
  },
  {
    title: "5 · declarations, then the packet",
    text: "Every admitted file is parsed into declarations, up to eight per request. A declaration above 0.5 becomes a verbatim source block, widened by three lines and any adjacent comment; one above 0.25 becomes a reading lead with its line range. A second pass asks which declarations define a symbol that the selected blocks name. The packet lists every admitted file, even the ones with no confident excerpt.",
    states: ANCHORED,
  },
]

const PACKET = `Jevgrep: 5 relevant files.
AGENTS.md lookup (root and returned-file ancestors): none found.
Suggested test entry point (not executed): python -m pytest -q 'tests/test_connection.py'
- "src/db/connection.py" — implementation; selected source and structural context below
  Reading lead create_engine: lines 50-58
- "tests/test_connection.py" — test; selected source and structural context below
  Reading lead test_pool_size: lines 12-19
- "src/db/pool.py" — helper; file passed relevance threshold; no confident excerpt selected — inspect this file directly
  Reading lead Pool.acquire: lines 12-48
- "src/api/routes.py" — caller; file passed relevance threshold; no confident excerpt selected — inspect this file directly
  Reading lead get_session: lines 9-17
- "docs/guide.md" — relevant; role uncertain; file passed relevance threshold; no confident excerpt selected — inspect this file directly
End file list.

Source block "src/db/connection.py" lines 47-61:
47: # One engine per process. Pool settings come from config.
48: from .pool import Pool
49:
50: def create_engine(url, pool_size=5):
...
End context.`

const WIN = "oklch(0.56 0.14 155)"
const PRUNE = "oklch(0.66 0.14 70)"
const ANCHOR = "oklch(0.55 0.17 300)"
const OPEN = "oklch(0.58 0.11 245)"

function badge(s: State | undefined, kind: Kind): { text: string; color?: string; dim?: boolean; dashed?: boolean } {
  if (!s) return { text: "", dim: true }
  switch (s.t) {
    case "open":
      return { text: "listed, no question", color: OPEN }
    case "queued":
      return { text: kind === "dir" ? "asked: worth exploring?" : "asked: useful evidence?", dashed: true }
    case "walk":
      return { text: `${s.p.toFixed(2)} > 0.5 · walk next`, color: WIN }
    case "pruned":
      return { text: `${s.p.toFixed(2)} · pruned, remembered`, color: PRUNE }
    case "in":
      return { text: `${s.p.toFixed(2)} > 0.25 · admitted`, color: WIN }
    case "out":
      return { text: `${s.p.toFixed(2)} · dropped`, dim: true }
    case "anchor":
      return { text: `${s.p.toFixed(2)} · anchor: class Pool`, color: ANCHOR }
    case "related":
      return { text: `${s.p.toFixed(2)} · uses Pool · walk`, color: ANCHOR }
    case "unrelated":
      return { text: `${s.p.toFixed(2)} · no relation · stays pruned`, color: PRUNE }
  }
}

export function FrontierWalk() {
  const [i, setI] = useState(0)
  const step = STEPS[i]!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          jg &quot;Where is pooling configured? I need a pool of 10 connections.&quot; .
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">toy repo · illustrative scores</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, k) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={i === k}
              aria-label={`Step ${k}: ${s.title}`}
              className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                i === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {k}
            </button>
          ))}
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              onClick={() => setI((k) => Math.max(0, k - 1))}
              disabled={i === 0}
              className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              back
            </button>
            <button
              type="button"
              onClick={() => setI((k) => Math.min(STEPS.length - 1, k + 1))}
              disabled={i === STEPS.length - 1}
              className="cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground hover:text-foreground disabled:cursor-default disabled:opacity-40"
            >
              next
            </button>
          </span>
        </div>

        <div className="mb-3 font-mono text-sm font-semibold text-foreground">{step.title}</div>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">{step.text}</p>

        {i < STEPS.length - 1 ? (
          <ul className="space-y-0.5 font-mono text-[12px]" aria-live="polite">
            {TREE.map((n) => {
              const b = badge(step.states[n.id], n.kind)
              const reached = step.states[n.id] !== undefined
              return (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 rounded-sm px-1.5 py-0.5"
                  style={{ paddingLeft: `${0.375 + n.depth * 1.1}rem`, opacity: reached ? 1 : 0.4 }}
                >
                  <span className={b.dim && reached ? "text-muted-foreground line-through" : "text-foreground"}>
                    {n.name}
                  </span>
                  {b.text && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-px text-[10.5px] ${
                        b.dashed ? "border border-dashed border-foreground/30 text-muted-foreground" : ""
                      } ${b.dim ? "text-muted-foreground" : ""}`}
                      style={b.color ? { color: b.color, background: "color-mix(in oklch, currentColor 10%, transparent)" } : undefined}
                    >
                      {b.text}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-[10.5px] leading-[1.55] text-foreground">
            {PACKET}
          </pre>
        )}
      </div>
    </figure>
  )
}
