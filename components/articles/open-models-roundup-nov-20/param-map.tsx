"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

// The week's releases on one log axis: what each checkpoint stores, and how much
// of it one token touches. Every number below is in the article, with where it
// comes from: "headers" = my count from the safetensors headers, "card" = the
// publisher's figure, "estimate" = my arithmetic from the config's routing
// (routed experts x active / total, plus everything dense).

type Row = {
  name: string
  kind: "text" | "video" | "audio"
  total: number // billions stored
  table?: number // billions in hashed n-gram lookup tables (read a few rows per token)
  active?: number // billions touched per token (text path)
  activeHow?: string
  note: string
}

const ROWS: Row[] = [
  { name: "Sage S2.1 Flash", kind: "text", total: 321.37, active: 16.7, activeHow: "estimate", note: "GLM-5.3-Flash weights, fine-tuned; 9 science projectors" },
  { name: "Hy4 flash", kind: "text", total: 220.25, table: 63.36, active: 11.3, activeHow: "card, my count agrees", note: "63.4B of it is the Engram n-gram table" },
  { name: "Agnes 2.5 Pro Theta", kind: "text", total: 187.76, table: 51.2, active: 7.2, activeHow: "estimate", note: "51.2B lexicon table; card gives no active count" },
  { name: "Maxwell V1 Flash", kind: "text", total: 36.81, active: 3.3, activeHow: "estimate (card: 3B, no embeddings)", note: "256 experts, 12 active" },
  { name: "Qwen3.8-27B (reference)", kind: "text", total: 27.78, active: 25.6, activeHow: "headers, dense", note: "the model SenseNova compares itself to" },
  { name: "LongCat Video Avatar 1.6", kind: "video", total: 15.85, note: "DiT only; two 0.63B LoRAs and Whisper on top" },
  { name: "FastFrames-L", kind: "video", total: 15.25, note: "Wan2.1 14B DiT + KV refiner + pixel decoder" },
  { name: "SenseNova-Loop-9B", kind: "text", total: 9.66, active: 13.1, activeHow: "headers x 2 passes", note: "the only one that touches more than it stores" },
  { name: "Astrantia (Qwen3.5 cut)", kind: "text", total: 9.36, active: 2.6, activeHow: "card, usage-weighted", note: "35.95B down to 9.36B, still MoE" },
  { name: "Gemma 4 E2B", kind: "text", total: 5.12, active: 2.3, activeHow: "card (effective)", note: "Airbnb's fine-tuned classifier" },
  { name: "SmolVLM2-256M", kind: "text", total: 0.256, note: "February 2025, not new" },
  { name: "Inworld Voice Isolator", kind: "audio", total: 0.064, note: "offline model; realtime is 58.2M" },
]

const LO = 0.05
const HI = 400
const pos = (b: number) => ((mlog10(b) - mlog10(LO)) / (mlog10(HI) - mlog10(LO))) * 100
const TICKS = [0.1, 1, 10, 100]

function fmt(b: number) {
  if (b < 1) return `${Math.round(b * 1000)}M`
  return `${b.toFixed(b < 10 ? 2 : 1)}B`
}

export function ParamMap() {
  const [mode, setMode] = useState<"params" | "memory">("params")
  const [hover, setHover] = useState<string | null>(null)
  const unit = mode === "params" ? 1 : 2 // bf16: two bytes a parameter
  const shown = ROWS.find((r) => r.name === hover)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stored vs touched per token, log scale</span>
        <div role="group" aria-label="units" className="flex gap-1">
          {(["params", "memory"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded border px-2 py-0.5 ${mode === m ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-transparent"}`}
            >
              {m === "params" ? "parameters" : "bf16 bytes"}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-2 pt-3">
        <div className="relative ml-[38%] h-4 font-mono text-[10px] text-muted-foreground">
          {TICKS.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>
              {mode === "params" ? fmt(t) : `${fmt(t * unit).replace("B", " GB").replace("M", " MB")}`}
            </span>
          ))}
        </div>
        <ul className="space-y-1.5">
          {ROWS.map((r) => {
            const dim = hover && hover !== r.name
            return (
              <li
                key={r.name}
                className={`grid grid-cols-[38%_1fr] items-center gap-0 text-xs transition-opacity ${dim ? "opacity-40" : ""}`}
                onMouseEnter={() => setHover(r.name)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(r.name)}
                onBlur={() => setHover(null)}
                tabIndex={0}
              >
                <span className="truncate pr-2 font-mono text-[11px]">{r.name}</span>
                <span className="relative h-4">
                  {TICKS.map((t) => (
                    <span key={t} className="absolute top-0 h-full w-px bg-border" style={{ left: `${pos(t)}%` }} />
                  ))}
                  <span
                    className={`absolute top-1 h-2 rounded-sm ${r.kind === "text" ? "bg-sky-500/50" : r.kind === "video" ? "bg-amber-500/50" : "bg-emerald-500/50"}`}
                    style={{ left: 0, width: `${pos(r.total)}%` }}
                  />
                  {r.table ? (
                    <span
                      className="absolute top-1 h-2 rounded-sm bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(0,0,0,.35)_3px_5px)] dark:bg-[repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.4)_3px_5px)]"
                      style={{ left: `${pos(r.total - r.table)}%`, width: `${pos(r.total) - pos(r.total - r.table)}%` }}
                      title="hashed n-gram lookup table"
                    />
                  ) : null}
                  {r.active !== undefined ? (
                    <span
                      className="absolute top-0 h-4 w-[3px] rounded bg-rose-500"
                      style={{ left: `calc(${pos(r.active)}% - 1px)` }}
                      title={`touched per token: ${fmt(r.active)}`}
                    />
                  ) : null}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-3 min-h-[3.2rem] rounded border bg-background/60 px-3 py-2 font-mono text-[11px] leading-relaxed">
          {shown ? (
            <>
              <div className="text-foreground">
                {shown.name}: stores {mode === "params" ? fmt(shown.total) : `${(shown.total * unit).toFixed(1)} GB`}
                {shown.active !== undefined
                  ? `, touches ${mode === "params" ? fmt(shown.active) : `${(shown.active * unit).toFixed(1)} GB`} per token (${shown.activeHow})`
                  : ", no per-token figure (not a token model, or nothing to check it against)"}
              </div>
              <div className="text-muted-foreground">{shown.note}</div>
            </>
          ) : (
            <span className="text-muted-foreground">
              Hover or tab to a row. Bar: stored. Red tick: touched per token. Hatched: hashed n-gram table, of which a token reads a few rows.
            </span>
          )}
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Totals are my counts from each repo&apos;s safetensors headers. Per-token figures are labelled by source; blanks are blank on purpose. Blue: text models, amber: video, green: audio.
      </figcaption>
    </figure>
  )
}
