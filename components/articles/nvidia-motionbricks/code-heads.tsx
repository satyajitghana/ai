"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

import { CLUSTER, FAMILY_LABEL, HEAD_ENTROPY, type Family } from "./data"

// One tokenizer codebook, drawn from the EMA cluster sizes stored in the
// checkpoint (measured). A token is one code per head; a token covers four
// frames at 30 Hz, so the slider turns a token count into frames and seconds.

const ACCENT = "oklch(0.62 0.16 35)"

export function CodeHeads() {
  const [fam, setFam] = useState<Family>("g1")
  const [tokens, setTokens] = useState(11)
  const rows = CLUSTER[fam]
  const heads = rows.length
  const codes = rows[0].length
  const ent = HEAD_ENTROPY[fam]
  const bitsPerToken = ent.reduce((a, b) => a + b, 0)
  const maxBits = heads * (fam === "g1" ? 3.3219 : 4)
  const frames = tokens * 4
  const choicesLog10 = tokens * heads * mlog10(codes)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tokenizer codebook · {FAMILY_LABEL[fam]} · measured</span>
        <div className="flex gap-1" role="group" aria-label="Model family">
          {(["g1", "soma"] as Family[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFam(f)}
              aria-pressed={fam === f}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${fam === f ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {f === "g1" ? "G1" : "SOMA"}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">
          {heads} heads of {codes} codes. Each cell is shaded by that code&apos;s share of its head&apos;s usage; the number is the share in percent.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 font-mono text-[10px] sm:text-[11px]">
            <tbody>
              {rows.map((r, h) => {
                const tot = r.reduce((a, b) => a + b, 0)
                return (
                  <tr key={h}>
                    <th scope="row" className="pr-1 text-left font-normal text-muted-foreground">
                      h{h}
                    </th>
                    {r.map((v, c) => {
                      const p = v / tot
                      return (
                        <td
                          key={c}
                          className="rounded px-0.5 py-1 text-center"
                          style={{ background: `color-mix(in oklch, ${ACCENT} ${Math.round(Math.min(1, p * 4) * 100)}%, transparent)` }}
                        >
                          {(p * 100).toFixed(p < 0.1 ? 1 : 0)}
                        </td>
                      )
                    })}
                    <td className="pl-2 text-left text-muted-foreground">{ent[h].toFixed(2)} bit</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs">
          {bitsPerToken.toFixed(1)} of {maxBits.toFixed(1)} possible bits per token are used (entropy summed over heads)
        </p>
        <div className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>tokens in the generated clip</span>
            <span className="font-mono">{tokens}</span>
          </label>
          <Range min={6} max={16} step={1} value={tokens} onChange={(e) => setTokens(Number(e.target.value))} aria-label="Number of tokens" accent={ACCENT} />
          <p className="font-mono text-xs text-muted-foreground">
            {frames} frames · {(frames / 30).toFixed(2)} s at 30 Hz · {heads * tokens} codes to predict · about 10^{choicesLog10.toFixed(0)} possible code
            grids
          </p>
        </div>
      </div>
    </figure>
  )
}
