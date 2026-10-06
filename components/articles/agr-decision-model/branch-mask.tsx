"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Agr's request layout, from agr/model.py (Layout.add and Layout.visibility at
// commit 296303d): the state is one causal block, and every question is a
// block appended after it that sees the state and itself, never another
// question. Each question's position ids restart where the state ends. The
// grid is a toy (six state tokens, three per question); the cost counter below
// it is arithmetic on token counts the reader picks, not a measurement.

type Layout = "branches" | "chain"

const STATE = 6
const Q = 3
const NAMES = ["Q1", "Q2", "Q3"]
const TONES = ["bg-sky-600", "bg-amber-500", "bg-emerald-600"]

type Tok = { block: number; pos: number }

function tokens(k: number, layout: Layout): Tok[] {
  const out: Tok[] = []
  for (let i = 0; i < STATE; i++) out.push({ block: -1, pos: i })
  for (let q = 0; q < k; q++) {
    for (let j = 0; j < Q; j++) {
      out.push({ block: q, pos: layout === "branches" ? STATE + j : STATE + q * Q + j })
    }
  }
  return out
}

function sees(t: Tok[], r: number, c: number, layout: Layout): boolean {
  if (c > r) return false
  if (layout === "chain") return true
  const a = t[r].block
  const b = t[c].block
  if (b === -1) return true
  return a === b
}

function cellTone(block: number) {
  return block === -1 ? "bg-foreground/70" : TONES[block]
}

export function BranchMask() {
  const [k, setK] = useState(3)
  const [layout, setLayout] = useState<Layout>("branches")
  const [stateTok, setStateTok] = useState(2000)
  const [qTok, setQTok] = useState(60)

  const t = tokens(k, layout)
  const n = t.length

  // Token arithmetic for k questions over one state.
  const onePass = stateTok + k * qTok
  const perQuestion = k * (stateTok + qTok)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        who can see whom: one request, one sequence, a branch per question
      </div>

      <div className="grid gap-2 border-b p-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Layout">
          {(
            [
              ["branches", "Agr: branches after the state"],
              ["chain", "plain causal sequence"],
            ] as [Layout, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              aria-pressed={layout === id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                layout === id ? "bg-foreground text-background" : "hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-24 shrink-0">questions: {k}</span>
          <Range min={1} max={3} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[auto_1fr]">
        <div className="overflow-x-auto">
          <div
            className="grid gap-px"
            style={{ gridTemplateColumns: `2.2rem repeat(${n}, 0.9rem)` }}
            role="img"
            aria-label={`Attention visibility for ${k} question${k > 1 ? "s" : ""}, ${layout === "branches" ? "each question seeing only the state and itself" : "each question also seeing the questions before it"}`}
          >
            <span />
            {t.map((x, c) => (
              <span key={`h${c}`} className="text-center font-mono text-[8px] text-muted-foreground">
                {x.pos}
              </span>
            ))}
            {t.map((row, r) => (
              <div key={`r${r}`} className="contents">
                <span className="pr-1 text-right font-mono text-[9px] leading-[0.9rem] text-muted-foreground">
                  {row.block === -1 ? (r === 0 ? "state" : "") : (r - STATE) % Q === 0 ? NAMES[row.block] : ""}
                </span>
                {t.map((col, c) => {
                  const on = sees(t, r, c, layout)
                  const leak = on && row.block >= 0 && col.block >= 0 && row.block !== col.block
                  return (
                    <span
                      key={`c${r}-${c}`}
                      className={cn(
                        "h-[0.9rem] w-[0.9rem] rounded-[2px]",
                        on ? cellTone(col.block) : "bg-muted",
                        leak && "ring-1 ring-red-500 ring-inset"
                      )}
                    />
                  )
                })}
              </div>
            ))}
          </div>
          <p className="m-0 mt-1 font-mono text-[9px] text-muted-foreground">
            row = token reading · column = token read · top numbers = position ids
          </p>
        </div>

        <div className="grid content-start gap-2 font-mono text-[11px]">
          {layout === "branches" ? (
            <p className="m-0">
              Every question block reads the state and itself. Its position ids restart at {STATE}, as if it
              were the only question, so adding, removing or reordering questions leaves each answer alone.
            </p>
          ) : (
            <p className="m-0">
              In one plain causal sequence, a later question reads the earlier ones (outlined in red) and sits at
              shifted positions. Its answer then depends on what was asked before it.
            </p>
          )}
          <div className="grid gap-1 rounded-md border p-2">
            <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
              tokens through the model (arithmetic)
            </span>
            <label className="flex items-center gap-2">
              <span className="w-28 shrink-0">state: {stateTok.toLocaleString("en-US")}</span>
              <Range min={100} max={16000} step={100} value={stateTok} onChange={(e) => setStateTok(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-28 shrink-0">per question: {qTok}</span>
              <Range min={10} max={400} step={10} value={qTok} onChange={(e) => setQTok(Number(e.target.value))} />
            </label>
            <span>
              one pass, {k} branch{k > 1 ? "es" : ""}: <b>{onePass.toLocaleString("en-US")}</b>
            </span>
            <span>
              one prompt per question, nothing shared: <b>{perQuestion.toLocaleString("en-US")}</b>
            </span>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        The mask is the one agr/model.py builds: the state is causal, each question block sees the state and its
        own earlier tokens, and its positions start where the state ends. Agr reads the answer at the last token
        of each block. The token counter is arithmetic, not a timing; on Gemma&apos;s sliding-window layers the
        same mask is further limited to keys within 1,024 positions.
      </figcaption>
    </figure>
  )
}
