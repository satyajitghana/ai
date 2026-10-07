"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What pplx-decider-v1.1-27b lets each token see, from the shipped files:
// config.json text_config.layer_types (64 layers, every fourth "full_attention",
// the rest "linear_attention", i.e. Gated DeltaNet recurrence), and
// source/src/autojev/model.py:28-56, enable_noncausal_full_attention(), which
// replaces the causal mask of the full-attention layers with a padding-only
// mask and keeps the recurrent mask of the linear-attention layers. v1 has no
// such hook (its decision_config.json has no attention_mode, which the code
// reads as "causal"). The prompt segments follow decision_messages() at
// model.py:93-111. The grid is a toy: two tokens per segment, not real lengths.

type Version = "v1" | "v1.1"

const SEGMENTS = [
  { id: "sys", label: "system", tone: "bg-muted-foreground/60" },
  { id: "state", label: "state", tone: "bg-sky-600" },
  { id: "q", label: "question", tone: "bg-amber-500" },
  { id: "opt", label: "options", tone: "bg-emerald-600" },
  { id: "slot", label: "answer slot", tone: "bg-rose-600" },
] as const

const PER = 2
const N = SEGMENTS.length * PER
const seg = (i: number) => Math.floor(i / PER)

const LAYERS = Array.from({ length: 64 }, (_, i) => ((i + 1) % 4 === 0 ? "full" : "linear"))

function sees(row: number, col: number, kind: "full" | "linear", v: Version) {
  if (kind === "linear") return col <= row
  if (v === "v1") return col <= row
  return true
}

export function LayerMask() {
  const [v, setV] = useState<Version>("v1.1")
  const [layer, setLayer] = useState(3)
  const [row, setRow] = useState(2)
  const kind = LAYERS[layer] as "full" | "linear"

  const seen = new Set<number>()
  for (let c = 0; c < N; c++) if (sees(row, c, kind, v)) seen.add(seg(c))
  const later = [...seen].filter((s) => s > seg(row)).map((s) => SEGMENTS[s].label)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">checkpoint</span>
        {(["v1", "v1.1"] as Version[]).map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setV(x)}
            className={cn(
              "rounded border px-2 py-0.5",
              v === x ? "border-foreground bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {x}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">
          layer {layer} · {kind === "full" ? "full attention" : "linear attention (Gated DeltaNet)"}
        </span>
      </div>

      <div className="px-3 pt-3">
        <div className="flex gap-[2px]" role="group" aria-label="The 64 layers; every fourth is full attention">
          {LAYERS.map((k, i) => (
            <button
              key={i}
              type="button"
              aria-label={`layer ${i}, ${k} attention`}
              onClick={() => setLayer(i)}
              className={cn(
                "h-6 flex-1 rounded-[2px]",
                k === "full" ? (v === "v1.1" ? "bg-rose-600" : "bg-foreground/60") : "bg-muted",
                i === layer && "ring-2 ring-foreground ring-offset-1 ring-offset-background",
              )}
            />
          ))}
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          64 layers, click one · dark or red = the 16 full-attention layers{" "}
          {v === "v1.1" ? "(red: no causal mask in v1.1)" : "(causal in v1)"} · grey = the 48 recurrent layers
        </p>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: `auto repeat(${N}, 14px)` }}>
            <span />
            {Array.from({ length: N }, (_, c) => (
              <span key={c} className={cn("h-2 rounded-[1px]", SEGMENTS[seg(c)].tone)} />
            ))}
            {Array.from({ length: N }, (_, r) => (
              <Row key={r} r={r} active={r === row} onPick={() => setRow(r)} kind={kind} v={v} />
            ))}
          </div>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">rows: the token reading · columns: tokens it can see</p>
        </div>

        <div className="grid content-start gap-2 font-mono text-[11px]">
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map((s) => (
              <span key={s.id} className="flex items-center gap-1">
                <span className={cn("inline-block h-2 w-3 rounded-[1px]", s.tone)} />
                {s.label}
              </span>
            ))}
          </div>
          <p className="m-0">
            A <strong>{SEGMENTS[seg(row)].label}</strong> token in layer {layer} sees:{" "}
            {[...seen].map((s) => SEGMENTS[s].label).join(", ")}.
          </p>
          <p className="m-0 text-muted-foreground">
            {later.length
              ? `It also reads what comes after it: ${later.join(", ")}. Its vector here depends on the question, so it cannot be cached and reused for a different question.`
              : "Nothing after it. In this layer the state is read as if the question did not exist yet."}
          </p>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        From config.json and model.py:28-56. The recurrent layers stay causal in both versions; v1.1 opens the 16
        full-attention layers in both directions. Two tokens per segment is a toy; real prompts have about 68 wrapper
        tokens plus the state, the question and its option lines.
      </figcaption>
    </figure>
  )
}

function Row({
  r,
  active,
  onPick,
  kind,
  v,
}: {
  r: number
  active: boolean
  onPick: () => void
  kind: "full" | "linear"
  v: Version
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPick}
        aria-label={`row ${r + 1}, a ${SEGMENTS[seg(r)].label} token`}
        className={cn("mr-1 h-[14px] w-2 rounded-[1px]", SEGMENTS[seg(r)].tone, active && "ring-2 ring-foreground")}
      />
      {Array.from({ length: N }, (_, c) => {
        const on = sees(r, c, kind, v)
        return (
          <span
            key={c}
            onClick={onPick}
            className={cn(
              "h-[14px] w-[14px] rounded-[2px]",
              on ? (c > r ? "bg-rose-600" : "bg-foreground/70") : "bg-muted",
              active && "outline outline-1 outline-foreground",
            )}
          />
        )
      })}
    </>
  )
}
