"use client"

import { useMemo, useState } from "react"

import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A toy of slotstream's expert path, stepped one layer at a time. NOT a measurement.
//
// Real model: 48 layers x 512 experts = 24,576 records of 2.7648 MB (read from the safetensors headers),
// 10 routed per layer per token. The Oct 5 plan held 7,509 slots, 30.6% of the records (the repo's own
// measurement note).
// Toy: 6 layers x 16 experts = 96 records, 3 routed per layer, 30 slots = 31%: the same fraction resident.
//
// The pool is ONE array of slots shared by every layer, with the CLOCK scan SlotPool.victim() runs
// (Sources/Slotstream/ExpertStore.swift:885): skip pinned slots, give a referenced slot a second chance,
// take the first unreferenced one. The slots a layer just routed to are pinned until the layer is done.
// A hit sets the slot's reference bit, and so does a fill.
//
// Forecast (lookahead on): the router of the layer two ahead is run early, so a miss at layer l is "covered"
// when layer l-2 forecast it. The first two layers of a token have nothing to forecast from. Recall 0.8 is
// the repo's "agreement" for its corrected forecast (docs/EXPERT-LOOKAHEAD.md). A covered miss still reads
// the record, it just reads it before the layer asks.
//
// All randomness is a fixed-seed LCG, so server and client draw the same toy.

const NL = 6
const NE = 16
const TOPK = 3
const SLOTS = 30
const TOKENS = 12
const REC_MB = 2.7648
const RECALL = 0.8

type Step = {
  token: number
  layer: number
  routed: number[]
  hit: boolean[]
  slot: number[]
  covered: boolean[]
  keys: number[] // resident key per slot after the step, -1 empty
  ref: boolean[]
  hand: number
}

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function build(): Step[] {
  const rnd = lcg(20261005)
  // per-layer popularity: weight 1/(rank+1)^1.2 over a fixed shuffle of the 16 experts
  const order: number[][] = []
  for (let l = 0; l < NL; l++) {
    const a = Array.from({ length: NE }, (_, i) => i)
    for (let i = NE - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    order.push(a)
  }
  const w = Array.from({ length: NE }, (_, r) => 1 / mpow(r + 1, 1.2))
  const prev: number[][] = Array.from({ length: NL }, () => [])
  const keys = Array<number>(SLOTS).fill(-1)
  const ref = Array<boolean>(SLOTS).fill(false)
  const where = new Map<number, number>()
  let hand = 0
  const out: Step[] = []
  const forecast: boolean[][] = [] // forecast[l][e]
  for (let t = 0; t < TOKENS; t++) {
    for (let l = 0; l < NL; l++) {
      // persistence: each expert of the previous token's set is kept with p = 0.55, the rest are drawn by weight
      const set: number[] = prev[l].filter(() => rnd() < 0.55).slice(0, TOPK)
      while (set.length < TOPK) {
        const free = order[l].map((e, r) => ({ e, p: set.includes(e) ? 0 : w[r] }))
        const tot = free.reduce((a, b) => a + b.p, 0)
        let x = rnd() * tot
        for (const f of free) {
          x -= f.p
          if (x <= 0 && f.p > 0) {
            set.push(f.e)
            break
          }
        }
      }
      prev[l] = set
      // which of this layer's experts the layer-two-back router named
      const fl = Array<boolean>(NE).fill(false)
      for (const e of set) if (rnd() < RECALL) fl[e] = true
      forecast[l] = fl
      const key = (e: number) => l * NE + e
      const hit: boolean[] = []
      const slot: number[] = Array<number>(TOPK).fill(-1)
      const pinned = new Set<number>()
      set.forEach((e, j) => {
        const s = where.get(key(e))
        if (s !== undefined) {
          ref[s] = true
          pinned.add(s)
          hit.push(true)
          slot[j] = s
        } else hit.push(false)
      })
      set.forEach((e, j) => {
        if (hit[j]) return
        let guard = 0
        for (;;) {
          const s = hand
          hand = (hand + 1) % SLOTS
          if (pinned.has(s)) {
            if (++guard > 4 * SLOTS) throw new Error("pool exhausted")
            continue
          }
          if (ref[s]) {
            ref[s] = false
            continue
          }
          if (keys[s] >= 0) where.delete(keys[s])
          keys[s] = key(e)
          where.set(key(e), s)
          ref[s] = true
          pinned.add(s)
          slot[j] = s
          break
        }
      })
      out.push({
        token: t,
        layer: l,
        routed: set.slice(),
        hit,
        slot,
        covered: set.map((e) => l >= 2 && forecast[l][e]),
        keys: keys.slice(),
        ref: ref.slice(),
        hand,
      })
    }
  }
  return out
}

const STEPS = build()

// ---- drawing ---------------------------------------------------------------------------------------------

const C = 0.866
const LAYER_HUE = [250, 200, 160, 75, 35, 320]
const layerFill = (l: number, a = 1) => `oklch(0.72 0.11 ${LAYER_HUE[l]} / ${a})`
const HIT = "oklch(0.68 0.15 150)"
const MISS = "oklch(0.62 0.19 28)"
const COVER = "oklch(0.75 0.15 75)"

function iso(ox: number, oy: number, u: number, x: number, y: number, z = 0): [number, number] {
  return [ox + (x - y) * C * u, oy + (x + y) * 0.5 * u - z]
}
const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
function diamond(ox: number, oy: number, u: number, x: number, y: number, w: number, d: number, z = 0) {
  return [iso(ox, oy, u, x, y, z), iso(ox, oy, u, x + w, y, z), iso(ox, oy, u, x + w, y + d, z), iso(ox, oy, u, x, y + d, z)]
    .map(pt)
    .join(" ")
}
function sideFaces(ox: number, oy: number, u: number, W: number, D: number, th: number) {
  const a = iso(ox, oy, u, 0, D), b = iso(ox, oy, u, W, D), c = iso(ox, oy, u, W, 0)
  const l = [a, b, [b[0], b[1] + th], [a[0], a[1] + th]] as [number, number][]
  const r = [b, c, [c[0], c[1] + th], [b[0], b[1] + th]] as [number, number][]
  return { left: l.map(pt).join(" "), right: r.map(pt).join(" ") }
}

const VBW = 500
const VBH = 480
const CX = 250
// SSD slab: 16 columns (experts) x 6 rows (layers)
const SSD = { u: 12.5, W: NE, D: NL, oy: 318 }
const SSD_OX = CX - ((SSD.W - SSD.D) / 2) * C * SSD.u
// slot pool: 6 x 5
const POOL = { u: 17, W: 6, D: 5, oy: 138 }
const POOL_OX = CX - ((POOL.W - POOL.D) / 2) * C * POOL.u
// page-cache membrane
const MEMB = { u: 17, W: 6, D: 5, oy: 232 }
// gpu lanes
const GPU = { u: 17, W: TOPK, D: 1, oy: 24 }
const GPU_OX = CX - ((GPU.W - GPU.D) / 2) * C * GPU.u

const ssdCell = (l: number, e: number) => iso(SSD_OX, SSD.oy, SSD.u, e + 0.5, l + 0.5)
const poolCell = (s: number) => iso(POOL_OX, POOL.oy, POOL.u, (s % POOL.W) + 0.5, Math.floor(s / POOL.W) + 0.5)
const gpuLane = (j: number) => iso(GPU_OX, GPU.oy, GPU.u, j + 0.5, 0.5)

export function SlotPath() {
  const [i, setI] = useState(0)
  const [look, setLook] = useState(true)
  const n = STEPS.length
  const cur = i > 0 ? STEPS[i - 1] : null

  const tally = useMemo(() => {
    let hits = 0
    let cov = 0
    let stall = 0
    for (let k = 0; k < i; k++) {
      const s = STEPS[k]
      s.hit.forEach((h, j) => {
        if (h) hits++
        else if (look && s.covered[j]) cov++
        else stall++
      })
    }
    return { hits, cov, stall, reads: cov + stall }
  }, [i, look])

  const upcoming = look && cur && cur.layer + 2 < NL ? STEPS[i - 1 + 2] : null // layer l+2 of the same token
  const keys = cur ? cur.keys : Array<number>(SLOTS).fill(-1)
  const ref = cur ? cur.ref : Array<boolean>(SLOTS).fill(false)
  const resident = new Set(keys.filter((k) => k >= 0))
  const ssd = sideFaces(SSD_OX, SSD.oy, SSD.u, SSD.W, SSD.D, 9)
  const pool = sideFaces(POOL_OX, POOL.oy, POOL.u, POOL.W, POOL.D, 8)
  const gpu = sideFaces(GPU_OX, GPU.oy, GPU.u, GPU.W, GPU.D, 8)
  const total = tally.hits + tally.reads
  const tokNo = cur ? cur.token + 1 : 0

  const flows: { from: [number, number]; mid: [number, number]; to: [number, number]; kind: "hit" | "miss" | "cover" }[] = []
  if (cur) {
    cur.routed.forEach((e, j) => {
      const s = cur.slot[j]
      const kind = cur.hit[j] ? "hit" : look && cur.covered[j] ? "cover" : "miss"
      flows.push({ from: kind === "hit" ? poolCell(s) : ssdCell(cur.layer, e), mid: poolCell(s), to: gpuLane(j), kind })
    })
  }

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one token through the slot pool · a toy of 6 layers x 16 experts, with the real 30% of records resident
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1.25fr_1fr]">
        <svg
          viewBox={`0 0 ${VBW} ${VBH}`}
          className="w-full"
          role="img"
          aria-label={`Four stacked slabs. Bottom, the SSD holding every expert record, 6 layers by 16 experts. Above it a dashed membrane for the page cache, which expert reads skip. Above that the slot pool of ${SLOTS} slots shared by all layers. On top, the GPU gather. ${
            cur
              ? `Now at token ${tokNo}, layer ${cur.layer + 1}: ${cur.hit.filter(Boolean).length} of ${TOPK} routed experts were already in a slot.`
              : "Nothing has run yet."
          }`}
        >
          {/* SSD */}
          <polygon points={ssd.left} fill="var(--muted)" stroke="var(--border)" />
          <polygon points={ssd.right} fill="var(--muted)" fillOpacity={0.7} stroke="var(--border)" />
          <polygon points={diamond(SSD_OX, SSD.oy, SSD.u, 0, 0, SSD.W, SSD.D)} fill="var(--background)" stroke="var(--border)" />
          {Array.from({ length: NL }, (_, l) =>
            Array.from({ length: NE }, (_, e) => {
              const res = resident.has(l * NE + e)
              return (
                <polygon
                  key={`${l}-${e}`}
                  points={diamond(SSD_OX, SSD.oy, SSD.u, e + 0.1, l + 0.1, 0.8, 0.8)}
                  fill={res ? layerFill(l, 0.45) : layerFill(l, 0.12)}
                  stroke={res ? layerFill(l) : "var(--border)"}
                  strokeWidth={res ? 1 : 0.5}
                />
              )
            })
          )}
          {/* forecast of layer l+2 */}
          {upcoming &&
            upcoming.routed.map((e, j) =>
              upcoming.covered[j] && !upcoming.hit[j] ? (
                <polygon
                  key={`f${j}`}
                  points={diamond(SSD_OX, SSD.oy, SSD.u, e + 0.1, upcoming.layer + 0.1, 0.8, 0.8)}
                  fill="none"
                  stroke={COVER}
                  strokeWidth={1.6}
                  strokeDasharray="2 2"
                />
              ) : null
            )}
          {/* routed tiles of the current layer */}
          {cur &&
            cur.routed.map((e, j) => (
              <polygon
                key={`r${j}`}
                points={diamond(SSD_OX, SSD.oy, SSD.u, e + 0.1, cur.layer + 0.1, 0.8, 0.8)}
                fill={flows[j].kind === "hit" ? HIT : flows[j].kind === "cover" ? COVER : MISS}
                fillOpacity={0.85}
                stroke="var(--foreground)"
                strokeWidth={0.8}
              />
            ))}
          <text x={SSD_OX - 6 * SSD.u * C - 6} y={SSD.oy + 120} fontSize={10} className="fill-muted-foreground font-mono">
            SSD · 24,576 records, 2.7648 MB each
          </text>

          {/* page cache membrane */}
          <polygon
            points={diamond(CX - ((MEMB.W - MEMB.D) / 2) * C * MEMB.u, MEMB.oy, MEMB.u, 0, 0, MEMB.W, MEMB.D)}
            fill="none"
            stroke="var(--muted-foreground)"
            strokeDasharray="4 3"
          />
          <text x={CX + 82} y={MEMB.oy + 46} fontSize={10} className="fill-muted-foreground font-mono">
            page cache: skipped
          </text>
          <text x={CX + 82} y={MEMB.oy + 58} fontSize={9} className="fill-muted-foreground font-mono">
            F_NOCACHE, no read-ahead
          </text>

          {/* pool */}
          <polygon points={pool.left} fill="var(--muted)" stroke="var(--border)" />
          <polygon points={pool.right} fill="var(--muted)" fillOpacity={0.7} stroke="var(--border)" />
          <polygon points={diamond(POOL_OX, POOL.oy, POOL.u, 0, 0, POOL.W, POOL.D)} fill="var(--background)" stroke="var(--border)" />
          {Array.from({ length: SLOTS }, (_, s) => {
            const x = s % POOL.W
            const y = Math.floor(s / POOL.W)
            const k = keys[s]
            const l = k >= 0 ? Math.floor(k / NE) : -1
            const c = poolCell(s)
            const isHand = cur ? cur.hand === s : s === 0
            return (
              <g key={s}>
                <polygon
                  points={diamond(POOL_OX, POOL.oy, POOL.u, x + 0.08, y + 0.08, 0.84, 0.84)}
                  fill={l >= 0 ? layerFill(l, 0.8) : "var(--muted)"}
                  fillOpacity={l >= 0 ? 1 : 0.4}
                  stroke={isHand ? "var(--foreground)" : "var(--border)"}
                  strokeWidth={isHand ? 1.6 : 0.5}
                />
                {ref[s] && k >= 0 && <circle cx={c[0]} cy={c[1]} r={2} fill="var(--foreground)" />}
              </g>
            )
          })}
          <text x={POOL_OX - 100} y={POOL.oy + 70} fontSize={10} className="fill-muted-foreground font-mono">
            slot pool · {SLOTS} slots, all layers
          </text>

          {/* gpu */}
          <polygon points={gpu.left} fill="var(--muted)" stroke="var(--border)" />
          <polygon points={gpu.right} fill="var(--muted)" fillOpacity={0.7} stroke="var(--border)" />
          <polygon points={diamond(GPU_OX, GPU.oy, GPU.u, 0, 0, GPU.W, GPU.D)} fill="var(--background)" stroke="var(--border)" />
          {Array.from({ length: TOPK }, (_, j) => (
            <polygon
              key={j}
              points={diamond(GPU_OX, GPU.oy, GPU.u, j + 0.1, 0.1, 0.8, 0.8)}
              fill={cur ? (flows[j].kind === "hit" ? HIT : flows[j].kind === "cover" ? COVER : MISS) : "var(--muted)"}
              fillOpacity={cur ? 0.7 : 0.4}
              stroke="var(--border)"
            />
          ))}
          <text x={CX + 70} y={GPU.oy + 20} fontSize={10} className="fill-muted-foreground font-mono">
            Metal · gatherQuantizedMM
          </text>
          <text x={CX + 70} y={GPU.oy + 32} fontSize={9} className="fill-muted-foreground font-mono">
            indexes the pool by slot
          </text>

          {/* flows */}
          {flows.map((f, j) => {
            const col = f.kind === "hit" ? HIT : f.kind === "cover" ? COVER : MISS
            return (
              <g key={j} fill="none" stroke={col} strokeWidth={1.6}>
                {f.kind !== "hit" && <polyline points={`${pt(f.from)} ${pt(f.mid)}`} strokeDasharray={f.kind === "cover" ? "4 3" : undefined} />}
                <polyline points={`${pt(f.mid)} ${pt(f.to)}`} />
                <circle cx={f.to[0]} cy={f.to[1]} r={2.5} fill={col} />
              </g>
            )
          })}
        </svg>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { t: "reset", f: () => setI(0), d: i === 0 },
              { t: "back", f: () => setI((v) => Math.max(0, v - 1)), d: i === 0 },
              { t: "next layer", f: () => setI((v) => Math.min(n, v + 1)), d: i === n },
              { t: "next token", f: () => setI((v) => Math.min(n, (Math.floor(v / NL) + 1) * NL)), d: i === n },
            ].map((b) => (
              <button
                key={b.t}
                type="button"
                disabled={b.d}
                onClick={b.f}
                className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                {b.t}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLook((v) => !v)}
              aria-pressed={look}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                look ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              lookahead {look ? "on" : "off"}
            </button>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground" role="status" aria-live="polite">
            {cur
              ? `token ${tokNo} of ${TOKENS}, layer ${cur.layer + 1} of ${NL}: routed experts ${cur.routed.join(", ")}`
              : "press next layer"}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums">
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: HIT }} />
              hits {tally.hits}
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: COVER }} />
              covered {tally.cov}
            </span>
            <span>
              <i className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: MISS }} />
              stalled {tally.stall}
            </span>
            <span>hit rate {total ? ((tally.hits / total) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="rounded border px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div>
              records read so far <span className="text-foreground">{tally.reads}</span> = {(tally.reads * REC_MB).toFixed(1)} MB at real
              record size
            </div>
            <div>
              a real token routes 48 x 10 = 480 experts = {((480 * REC_MB) / 1000).toFixed(3)} GB if every one missed
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Tile colour on the SSD is the layer; a bordered tile is resident in a slot. A dot in a slot is its reference bit, the thick
            outline is the CLOCK hand. Green: the expert was already in a slot. Red: a read the layer waited for. Amber: a read the
            forecast started two layers early (dashed outline on the SSD before it is asked for). Layers 1 and 2 of a token have
            nothing to forecast from.
          </p>
        </div>
      </div>
    </figure>
  )
}
