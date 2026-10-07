"use client"

import { useMemo, useState } from "react"

// PixiJS's WebGPU bind-group key before and after PR #12278.
// mixLow / mixHigh are copied from src/rendering/renderers/gpu/shader/BindGroup.ts
// (pixijs dev at 194e42c, lines 12-34). The key of a group is the XOR of one mix
// per binding, so re-pointing a binding XORs the old mix out and the new one in
// (BindGroup._rekey). The cache slot is BindGroupSystem.getBindGroup's
// (keyLow ^ imul(layoutKey + 1, 0x9E3779B1)) & 0x3FFFFFFF.
// The "before" string is the old BindGroup._key (ids joined with "|") plus the
// ":layoutKey" suffix BindGroupSystem appended on every lookup.
// Everything here is 32-bit integer arithmetic, so the server and the browser
// print the same hex.

function mixLow(binding: number, id: number): number {
  let h = Math.imul(id + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(binding + 1, 0xc2b2ae35)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  return h ^ (h >>> 16)
}

function mixHigh(binding: number, id: number): number {
  let h = Math.imul(id + 0x7f4a7c15, 0x27d4eb2f) ^ Math.imul(binding + 0x165667b1, 0x9e3779b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39)
  return h ^ (h >>> 15)
}

const hex = (v: number) => (v >>> 0).toString(16).padStart(8, "0")

// program layout key 5, bind group index 1, as getBindGroup combines them
const LAYOUT_KEY = (5 << 4) | 1

const BINDINGS: { name: string; choices: { label: string; id: number }[] }[] = [
  { name: "uniforms", choices: [{ label: "material UBO", id: 3 }] },
  { name: "albedo", choices: [{ label: "brick", id: 40 }, { label: "moss", id: 47 }, { label: "rust", id: 63 }] },
  { name: "sampler", choices: [{ label: "linear", id: 41 }, { label: "nearest", id: 44 }] },
  { name: "normal", choices: [{ label: "flat", id: 52 }, { label: "bumpy", id: 58 }] },
]

const ACCENT = "oklch(0.62 0.18 340)"

function slotOf(pick: number[]): number {
  let lo = 0
  pick.forEach((c, b) => {
    lo ^= mixLow(b, BINDINGS[b].choices[c].id)
  })
  return (lo ^ Math.imul(LAYOUT_KEY + 1, 0x9e3779b1)) & 0x3fffffff
}

const START = [0, 0, 0, 0]

export function BindKey() {
  const [pick, setPick] = useState<number[]>(START)
  const [seen, setSeen] = useState<number[]>([slotOf(START)])
  const [log, setLog] = useState<{ slot: number; hit: boolean; what: string }[]>([])
  const [mixes, setMixes] = useState(0)

  const ids = pick.map((c, b) => BINDINGS[b].choices[c].id)

  const key = useMemo(() => {
    let lo = 0
    let hi = 0
    ids.forEach((id, b) => {
      lo ^= mixLow(b, id)
      hi ^= mixHigh(b, id)
    })
    const slot = (lo ^ Math.imul(LAYOUT_KEY + 1, 0x9e3779b1)) & 0x3fffffff
    return { lo, hi, slot }
  }, [ids])

  const repoint = (b: number) => {
    const n = BINDINGS[b].choices.length
    if (n < 2) return
    const next = pick.slice()
    next[b] = (pick[b] + 1) % n
    const slot = slotOf(next)
    const hit = seen.includes(slot)
    if (!hit) setSeen((s) => [...s, slot])
    setPick(next)
    setMixes((m) => m + 4)
    setLog((l) => [{ slot, hit, what: `${BINDINGS[b].name} → ${BINDINGS[b].choices[next[b]].label}` }, ...l].slice(0, 5))
  }

  const reset = () => {
    setPick(START)
    setSeen([slotOf(START)])
    setLog([])
    setMixes(0)
  }

  const oldKey = `${ids.join("|")}:${LAYOUT_KEY}`

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="PixiJS bind group key: the old joined string against the new XOR of per-binding mixes"
    >
      <div className="grid gap-2 p-4 sm:grid-cols-4">
        {BINDINGS.map((b, i) => {
          const c = b.choices[pick[i]]
          const fixed = b.choices.length < 2
          return (
            <button
              key={b.name}
              type="button"
              onClick={() => repoint(i)}
              disabled={fixed}
              className="rounded-lg border px-3 py-2 text-left font-mono text-xs enabled:hover:bg-muted disabled:opacity-60"
              aria-label={fixed ? `binding ${i}, ${b.name}, fixed` : `re-point binding ${i}, ${b.name}`}
            >
              <div className="text-muted-foreground">binding {i} · {b.name}</div>
              <div className="text-foreground">{c.label}</div>
              <div className="text-muted-foreground">id {c.id}{fixed ? "" : " · click to re-point"}</div>
            </button>
          )
        })}
      </div>

      <div className="space-y-2 border-t px-4 py-3 font-mono text-xs text-muted-foreground">
        <div className="grid grid-cols-[13rem_1fr] gap-x-4 gap-y-1 text-[11px] tabular-nums">
          <span>before: string key per lookup</span>
          <span className="break-all text-foreground">&quot;{oldKey}&quot;</span>
          <span>after: _keyLow, _keyHigh</span>
          <span className="text-foreground">
            0x{hex(key.lo)} 0x{hex(key.hi)}
          </span>
          <span>cache slot (30 bits)</span>
          <span className="text-foreground">{key.slot}</span>
          <span>mixes computed by re-points</span>
          <span className="text-foreground">{mixes} (4 per re-point, 0 per unchanged bind)</span>
        </div>
        {log.length > 0 && (
          <ul className="space-y-0.5 pt-1 text-[11px]">
            {log.map((e, i) => (
              <li key={`${e.slot}-${i}`}>
                <span style={{ color: e.hit ? ACCENT : undefined }} className={e.hit ? "" : "text-foreground"}>
                  {e.hit ? "same key seen before" : "new key"}
                </span>{" "}
                slot {e.slot} · {e.what}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={reset} className="rounded-md border px-2 py-1 text-foreground hover:bg-muted">
          reset
        </button>
      </div>
    </figure>
  )
}
