"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where Tiny 2.1's bytes go, computed from the constants in dos/TINY.C and the
// TINY.BIN layout in train2.py's export():
//   tables: emb VOCAB x D, pos CTX x D, and per layer q, k, v, o (D x D), f1 (HID x D),
//           f2 (D x HID); one signed byte per weight plus a 4-byte float scale per row
//   gains:  2 per layer plus a final one, D floats each
//   K/V cache (alloc_memory): per layer, CTX x D signed bytes for K and again for V,
//           plus one float scale per position for each
//   header: "TNY2" and four int16 = 12 bytes
// The released network is D 96, L 4, H 4, HID 256, VOCAB 97, CTX 128. TINY.C caps
// D at 128, HID at 512 and L at 8, and refuses any table over 65,000 bytes (one
// 64 KB segment under the large memory model). The EXE is 53,604 bytes on disk;
// its load image, the C runtime's heap overhead and DOS itself are not modelled.

const VOCAB = 97
const CTX = 128
const EXE = 53604
const CONV = 640 * 1024

function sizes(D: number, L: number, HID: number) {
  const tables: [string, number, number][] = [["embedding", VOCAB, D], ["positions", CTX, D]]
  for (let l = 0; l < L; l++) {
    for (const n of ["q", "k", "v", "o"]) tables.push([`L${l + 1} ${n}`, D, D])
    tables.push([`L${l + 1} f1`, HID, D], [`L${l + 1} f2`, D, HID])
  }
  const weights = tables.reduce((a, [, r, c]) => a + r * c, 0)
  const scales = tables.reduce((a, [, r]) => a + 4 * r, 0)
  const gains = (2 * L + 1) * D * 4
  const params = weights + (2 * L + 1) * D
  const bin = 12 + weights + scales + gains
  const kv = L * 2 * CTX * D + L * 2 * CTX * 4
  const biggest = Math.max(...tables.map(([, r, c]) => r * c))
  const macs = L * (4 * D * D + 2 * D * HID) + VOCAB * D
  return { params, bin, kv, biggest, macs, weights, scales, gains }
}

const fmt = (n: number) => n.toLocaleString("en-US")
const kb = (n: number) => (n / 1024).toFixed(1)

export function MemoryMap() {
  const [D, setD] = useState(96)
  const [L, setL] = useState(4)
  const [HID, setHID] = useState(256)
  const s = sizes(D, L, HID)
  const total = s.bin - 12 + s.kv + EXE
  const parts: [string, number, string][] = [
    ["int8 weights", s.weights, "#22d3ee"],
    ["row scales + gains", s.scales + s.gains, "#a78bfa"],
    ["K/V cache, int8", s.kv, "#34d399"],
    ["TINY.EXE on disk", EXE, "#f59e0b"],
  ]
  const tooBig = s.biggest > 65000
  const over = total > CONV
  const released = D === 96 && L === 4 && HID === 256

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">640 KB of conventional memory, and what Tiny puts in it</span>
        <button
          type="button"
          className="rounded px-2 py-0.5 text-muted-foreground hover:text-foreground"
          onClick={() => { setD(96); setL(4); setHID(256) }}
        >
          released size
        </button>
      </div>
      <div className="p-4">
        <div className="relative h-10 w-full overflow-hidden rounded border bg-muted/30" role="img" aria-label="A bar of 640 KB of conventional memory filled by Tiny's weights, scales, K/V cache and program">
          {(() => {
            let x = 0
            return parts.map(([label, n, col]) => {
              const w = (100 * n) / CONV
              const el = (
                <div
                  key={label}
                  title={`${label}: ${fmt(n)} bytes`}
                  className="absolute top-0 h-full"
                  style={{ left: `${Math.min(100, x).toFixed(2)}%`, width: `${Math.max(0, Math.min(100 - x, w)).toFixed(2)}%`, background: col, opacity: 0.85 }}
                />
              )
              x += w
              return el
            })
          })()}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">
          {parts.map(([label, n, col]) => (
            <span key={label}>
              <span style={{ color: col }}>■</span> {label} <span className="text-muted-foreground">{kb(n)} KB</span>
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">parameters </span>
            <span className="text-foreground">{fmt(s.params)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">TINY.BIN </span>
            <span className="text-foreground">{fmt(s.bin)} bytes</span>
            {released ? <span className="text-muted-foreground"> (the released file is 381,808)</span> : null}
          </div>
          <div>
            <span className="text-muted-foreground">sum of the above </span>
            <span className={over ? "text-red-600" : "text-foreground"}>{kb(total)} KB</span>
            <span className="text-muted-foreground"> of 640 KB, before DOS and drivers</span>
          </div>
          <div>
            <span className="text-muted-foreground">largest table </span>
            <span className={tooBig ? "text-red-600" : "text-foreground"}>{fmt(s.biggest)} bytes</span>
            <span className="text-muted-foreground">{tooBig ? " > 65,000: TINY refuses it" : " (cap 65,000)"}</span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">multiply-adds per letter (matrices only) </span>
            <span className="text-foreground">{fmt(s.macs)}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">width D: {D}</span>
            <Range min={32} max={128} step={16} value={D} onChange={(e) => setD(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">layers L: {L}</span>
            <Range min={1} max={8} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} />
          </label>
          <label className="grid gap-1 font-mono text-xs">
            <span className="text-muted-foreground">middle width HID: {HID}</span>
            <Range min={64} max={512} step={32} value={HID} onChange={(e) => setHID(Number(e.target.value))} />
          </label>
        </div>
        <figcaption className="mt-3 text-xs text-muted-foreground">
          Every number here is arithmetic on constants in <code>TINY.C</code> and the file layout in <code>train2.py</code>. At the released size it reproduces the 381,808-byte <code>TINY.BIN</code> exactly. The program&apos;s load image, the C runtime&apos;s allocation overhead and whatever DOS and your drivers already use are not in the bar. Those are why the README asks for about 540 KB free. The EXE reads its size from the header, so a retrained file with these settings would load, up to the source&apos;s limits of 128 wide, 512 middle and 8 layers.
        </figcaption>
      </div>
    </figure>
  )
}
