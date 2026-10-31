"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { IMAGE_TOKENS, SCALING } from "./data"

// Tokens spent observing during one task, by strategy. The three accessibility-tree numbers are MEASURED on the toy
// chat app and interpolated linearly between the measured sizes (25 to 600 messages). The screenshot cost is REASONED
// from a published rule, (width x height) / 750 tokens, and was not checked against any API here.

const C_IMG = "oklch(0.62 0.15 150)"
const C_FULL = "oklch(0.60 0.17 30)"
const C_DRILL = "oklch(0.62 0.15 285)"

function at(messages: number, key: "full" | "skeleton" | "drill"): number {
  const s = SCALING
  if (messages <= s[0].messages) return s[0][key]
  for (let k = 1; k < s.length; k++) {
    if (messages <= s[k].messages) {
      const a = s[k - 1]
      const b = s[k]
      return a[key] + ((b[key] - a[key]) * (messages - a.messages)) / (b.messages - a.messages)
    }
  }
  return s[s.length - 1][key]
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="h-3 overflow-hidden rounded bg-muted" role="img" aria-label={label}>
      <div className="h-full" style={{ width: `${Math.min(100, Math.max(0.5, (value / max) * 100)).toFixed(1)}%`, background: color }} />
    </div>
  )
}

export function LoopCost() {
  const [messages, setMessages] = useState(150)
  const [obs, setObs] = useState(6)
  const [big, setBig] = useState(false)

  const img = big ? IMAGE_TOKENS.large : IMAGE_TOKENS.small
  const full = at(messages, "full")
  const skel = at(messages, "skeleton")
  const drill = at(messages, "drill")

  const tImg = img * obs
  const tFull = full * obs
  const tDrill = skel + drill * obs
  const max = Math.max(tImg, tFull, tDrill)
  const breakEven = skel / (img - drill)

  const rows = [
    { name: "screenshot each time", total: tImg, color: C_IMG, note: `${obs} x ${img.toLocaleString("en-US")} (reasoned)` },
    { name: "full `snapshot -i --compact` each time", total: tFull, color: C_FULL, note: `${obs} x ${Math.round(full).toLocaleString("en-US")}` },
    { name: "skeleton once, then drill the region", total: tDrill, color: C_DRILL, note: `${Math.round(skel).toLocaleString("en-US")} + ${obs} x ${Math.round(drill)}` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        observation tokens for one task · tree costs measured on a toy chat app, screenshot cost reasoned
      </div>
      <div className="space-y-2.5 border-b px-4 py-3 font-mono text-[11px]">
        <label className="flex items-center gap-3">
          <span className="w-40 shrink-0 text-muted-foreground">messages on screen</span>
          <Range min={25} max={600} step={5} value={messages} onChange={(e) => setMessages(Number(e.target.value))} aria-label="messages in the chat app" className="w-full" />
          <span className="w-12 shrink-0 text-right tabular-nums">{messages}</span>
        </label>
        <label className="flex items-center gap-3">
          <span className="w-40 shrink-0 text-muted-foreground">observations in the task</span>
          <Range min={1} max={30} step={1} value={obs} onChange={(e) => setObs(Number(e.target.value))} aria-label="number of observations" className="w-full" />
          <span className="w-12 shrink-0 text-right tabular-nums">{obs}</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-40 shrink-0 text-muted-foreground">screenshot size</span>
          {[
            { v: false, t: "1280 x 800" },
            { v: true, t: "1920 x 1080, resized" },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              aria-pressed={big === o.v}
              onClick={() => setBig(o.v)}
              className={cn(
                "rounded border px-2 py-0.5 transition-colors",
                big === o.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {o.t}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-3 px-4 py-4">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-[11px]">
              <span>{r.name}</span>
              <span className="tabular-nums">{Math.round(r.total).toLocaleString("en-US")}</span>
            </div>
            <Bar value={r.total} max={max} color={r.color} label={`${r.name}: ${Math.round(r.total).toLocaleString("en-US")} tokens`} />
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.note}</div>
          </li>
        ))}
      </ul>

      <figcaption className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground">
        {drill < img
          ? `A drill costs ${Math.round(drill)} tokens against ${img.toLocaleString("en-US")} for a screenshot, so the skeleton pays for itself after about ${breakEven.toFixed(1)} observations at this size.`
          : "At this size a drill costs more than a screenshot."}{" "}
        A full snapshot of a heavy page costs more than the picture it replaces. The tree buys refs and semantic actions, not cheaper looks, unless you read it in regions.
      </figcaption>
    </figure>
  )
}
