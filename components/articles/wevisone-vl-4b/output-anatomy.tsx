"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { NEW_TOKENS, fmt } from "./data"

type Task = "detection" | "pointing" | "matting" | "absent"
type Kind = "tag" | "text" | "coord" | "obj" | "sep" | "none"

const TASKS: { id: Task; label: string; prompt: string }[] = [
  { id: "detection", label: "detection", prompt: "Locate all the instances that match the following description: dogs." },
  { id: "pointing", label: "pointing", prompt: "point to: dogs" },
  { id: "matting", label: "segmentation / matting", prompt: "Locate the instances that match the following description and provide the alpha mattes: dogs." },
  { id: "absent", label: "absent target", prompt: "Locate the instances that match the following description: a unicorn." },
]

// The first two boxes are the ones printed in the paper&apos;s Figure 3; the rest are made up to fill the strip.
const BOXES: number[][] = [
  [81, 327, 394, 746],
  [552, 284, 902, 721],
  [12, 40, 220, 310],
  [610, 55, 760, 240],
  [300, 500, 480, 820],
  [700, 600, 960, 990],
  [150, 650, 330, 900],
  [820, 80, 990, 260],
]

const COLORS: Record<Kind, string> = {
  tag: "oklch(0.75 0.09 250)",
  text: "oklch(0.82 0.02 250)",
  coord: "oklch(0.82 0.12 80)",
  obj: "oklch(0.72 0.14 305)",
  sep: "oklch(0.86 0.01 250)",
  none: "oklch(0.78 0.1 25)",
}

type Tok = { t: string; kind: Kind; id?: number }

const coord = (v: number): Tok => ({ t: `<${v}>`, kind: "coord", id: NEW_TOKENS.coordFirst + v })
const tag = (name: string): Tok => {
  const hit = NEW_TOKENS.tags.find((x) => x.text === name)
  return { t: name, kind: name === "<OBJ>" ? "obj" : "tag", id: hit?.id }
}

function build(task: Task, n: number): Tok[] {
  const name = task === "absent" ? "unicorn" : "dogs"
  const out: Tok[] = [tag("<ref>"), { t: name, kind: "text" }, tag("</ref>")]
  if (task === "absent") return [...out, tag("<box>"), { t: "None", kind: "none", id: 4064 }, tag("</box>")]
  out.push(tag(task === "pointing" ? "<point>" : "<box>"))
  for (let i = 0; i < n; i++) {
    const b = BOXES[i % BOXES.length]
    if (task === "pointing") {
      out.push(coord(Math.round((b[0] + b[2]) / 2)), coord(Math.round((b[1] + b[3]) / 2)))
    } else {
      b.forEach((v) => out.push(coord(v)))
      if (task === "matting") out.push(tag("<OBJ>"))
    }
    if (i < n - 1) out.push({ t: ",", kind: "sep" })
  }
  out.push(tag(task === "pointing" ? "</point>" : "</box>"))
  return out
}

export function OutputAnatomy() {
  const [task, setTask] = useState<Task>("matting")
  const [n, setN] = useState(2)
  const [side, setSide] = useState(1920)
  const toks = build(task, n)
  const shown = toks.length > 44 ? [...toks.slice(0, 40), { t: "…", kind: "sep" as Kind }, ...toks.slice(-3)] : toks
  const step = side / 1000
  const cur = TASKS.find((t) => t.id === task)!
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one answer, token by token · token ids from tokenizer.json, format from the paper&apos;s Figure 3
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {TASKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTask(t.id)}
              aria-pressed={task === t.id}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                task === t.id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">prompt: {cur.prompt}</p>
        <div className="flex flex-wrap gap-1 rounded border bg-muted/30 p-2 font-mono text-[11px]" role="list" aria-label="answer tokens">
          {shown.map((k, i) => (
            <span
              key={i}
              role="listitem"
              title={k.id ? `token id ${fmt(k.id)}` : undefined}
              className="rounded px-1.5 py-0.5 text-black"
              style={{ background: COLORS[k.kind] }}
            >
              {k.t}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[11px]">
          <label className="flex items-center gap-2">
            instances
            <input type="range" min={1} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} disabled={task === "absent"} />
            <span className="w-4 tabular-nums">{task === "absent" ? "0" : n}</span>
          </label>
          <label className="flex items-center gap-2">
            image width (px)
            <input type="range" min={320} max={4096} step={32} value={side} onChange={(e) => setSide(Number(e.target.value))} />
            <span className="w-10 tabular-nums">{side}</span>
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">answer tokens</dt>
            <dd className="tabular-nums">{toks.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">coordinate step</dt>
            <dd className="tabular-nums">{step.toFixed(2)} px</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">worst rounding error</dt>
            <dd className="tabular-nums">{(step / 2).toFixed(2)} px</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">per-instance cost</dt>
            <dd className="tabular-nums">{task === "matting" ? "6 tokens" : task === "pointing" ? "3 tokens" : task === "detection" ? "5 tokens" : "none"}</dd>
          </div>
        </dl>
      </div>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Boxes are four of the 1,001 coordinate tokens, 0 to 1000, each a fraction of the image side. The first two boxes come from the paper&apos;s
        Figure 3; the others are made up. Hover a chip for its token id.
      </p>
    </figure>
  )
}
