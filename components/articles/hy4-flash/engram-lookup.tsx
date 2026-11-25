"use client"

import { useState } from "react"

import { LAYERS, PHRASES, engramHash, headOffsets } from "./engram-data"

// The real addressing of Hy4 flash's Engram tables, computed in the browser with BigInt from the
// release's own constants (see engram-data.ts). Pick a phrase and a layer: the last token's bigram
// and trigram are canonicalised, multiplied, XORed and reduced by sixteen primes into sixteen rows.
// The "other spelling" toggle swaps in case variants, which land on the same rows.

const fmt = (n: number | bigint) => n.toLocaleString("en-US")

export function EngramLookup() {
  const [pi, setPi] = useState(0)
  const [li, setLi] = useState(0)
  const [alt, setAlt] = useState(false)
  const phrase = PHRASES[pi]
  const layer = LAYERS[li]
  const toks = alt ? phrase.b : phrase.a
  const h = engramHash(layer, toks)
  const offs = headOffsets(layer.primes)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="mr-auto">engram address, as shipped</span>
        <div role="group" aria-label="phrase" className="flex flex-wrap gap-1">
          {PHRASES.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPi(i)}
              aria-pressed={pi === i}
              className={`rounded border px-2 py-0.5 ${pi === i ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-transparent"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        <div role="group" aria-label="layer" className="flex gap-1">
          {LAYERS.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLi(i)}
              aria-pressed={li === i}
              className={`rounded border px-2 py-0.5 ${li === i ? "border-foreground/40 bg-foreground/10 text-foreground" : "border-transparent"}`}
            >
              layer {l.zero}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={alt} onChange={(e) => setAlt(e.target.checked)} />
          other spelling
        </label>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {toks.map((t, i) => (
            <div key={i} className={`rounded-lg border px-3 py-1.5 font-mono text-xs ${i === 2 ? "border-foreground/40" : ""}`}>
              <div className="text-sm text-foreground">{t.text.replace(" ", "·")}</div>
              <div className="text-muted-foreground">
                id {fmt(t.raw)} {"→"} <span className="text-foreground">{fmt(t.canon)}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{i === 2 ? "x(t), current" : i === 1 ? "x(t-1)" : "x(t-2)"}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto font-mono text-[11px] leading-5 text-muted-foreground">
          <div>
            c(t)·m0 = {fmt(toks[2].canon)} × {layer.mult[0]} = <span className="text-foreground">{h.prod[0].toString()}</span>
          </div>
          <div>
            c(t-1)·m1 = {fmt(toks[1].canon)} × {layer.mult[1]} = <span className="text-foreground">{h.prod[1].toString()}</span>
          </div>
          <div>
            c(t-2)·m2 = {fmt(toks[0].canon)} × {layer.mult[2]} = <span className="text-foreground">{h.prod[2].toString()}</span>
          </div>
          <div className="mt-1">
            bigram key = c(t)·m0 XOR c(t-1)·m1 = <span className="text-foreground">{h.bi.toString()}</span>
          </div>
          <div>
            trigram key = bigram key XOR c(t-2)·m2 = <span className="text-foreground">{h.tri.toString()}</span>
          </div>
        </div>

        {[0, 1].map((g) => (
          <div key={g}>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">
              {g === 0 ? "bigram heads 0-7: key mod prime" : "trigram heads 8-15: key mod prime"}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {layer.primes.slice(g * 8, g * 8 + 8).map((p, j) => {
                const hd = g * 8 + j
                const row = h.rows[hd]
                return (
                  <div key={hd} className="rounded border px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    <div>
                      head {hd} · p = {fmt(p)}
                    </div>
                    <div className="text-xs text-foreground">row {fmt(row)}</div>
                    <div className="relative mt-1 h-1.5 rounded bg-muted">
                      <div className="absolute top-0 h-1.5 w-0.5 bg-foreground" style={{ left: `${(row / p) * 100}%` }} />
                    </div>
                    <div className="mt-0.5">table row {fmt(offs[hd] + row)}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Sixteen rows of 96 values for one token at one layer, out of {fmt(offs[15] + layer.primes[15])} rows in that layer&apos;s
        table. Case and accent variants share a canonical id, so the toggle lands on the same rows. Ids from{" "}
        <code>tokenizer.json</code> and the checkpoint&apos;s <code>lookup_table</code>; primes from <code>config.json</code>;
        multipliers from the GGUF metadata.
      </figcaption>
    </figure>
  )
}
