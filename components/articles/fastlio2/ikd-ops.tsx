"use client"

import { useMemo, useReducer } from "react"
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// A real (2-D) incremental k-d tree, run in the page with the rules ikd-Tree uses
// in FAST-LIO's copy of the code (ikd_Tree.cpp, fast_lio branch):
//   - insert descends to a leaf; every node on the way back up re-counts itself
//     (Pullup) and is checked against the balance criterion;
//   - box delete is lazy: a subtree fully inside the box gets one tree_deleted
//     label, a partly covered one flags single nodes as deleted;
//   - Criterion_Check: skip subtrees of <= 10 nodes; rebuild when
//     invalid/size > 0.5 or when one child holds more than 0.6 (or less than
//     0.4) of the other size - 1 nodes;
//   - rebuild flattens the subtree (dropping deleted points) and rebuilds it
//     balanced, splitting on the axis with the larger extent.
// The real tree also downsamples on insert and hands subtrees of 1,500+ nodes to
// a second thread; this one does everything inline so each step is visible.

type P = [number, number]
type Node = {
  p: P
  axis: 0 | 1
  l: Node | null
  r: Node | null
  size: number
  invalid: number
  deleted: boolean
  treeDeleted: boolean
  lo: P
  hi: P
  id: number
}

const MIN_UNBALANCED = 10
const BAL = 0.6
const DEL = 0.5

let NEXT_ID = 1

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function pull(n: Node) {
  const l = n.l
  const r = n.r
  n.size = 1 + (l ? l.size : 0) + (r ? r.size : 0)
  if (n.treeDeleted) {
    n.invalid = n.size
  } else {
    n.invalid = (n.deleted ? 1 : 0) + (l ? l.invalid : 0) + (r ? r.invalid : 0)
  }
  const lo: P = [n.p[0], n.p[1]]
  const hi: P = [n.p[0], n.p[1]]
  for (const c of [l, r]) {
    if (!c) continue
    lo[0] = Math.min(lo[0], c.lo[0])
    lo[1] = Math.min(lo[1], c.lo[1])
    hi[0] = Math.max(hi[0], c.hi[0])
    hi[1] = Math.max(hi[1], c.hi[1])
  }
  n.lo = lo
  n.hi = hi
}

function build(pts: P[]): Node | null {
  if (pts.length === 0) return null
  let x0 = Infinity
  let x1 = -Infinity
  let y0 = Infinity
  let y1 = -Infinity
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x)
    x1 = Math.max(x1, x)
    y0 = Math.min(y0, y)
    y1 = Math.max(y1, y)
  }
  const axis: 0 | 1 = x1 - x0 >= y1 - y0 ? 0 : 1
  const s = [...pts].sort((a, b) => a[axis] - b[axis])
  const mid = Math.floor((s.length - 1) / 2)
  const n: Node = {
    p: s[mid],
    axis,
    l: build(s.slice(0, mid)),
    r: build(s.slice(mid + 1)),
    size: 1,
    invalid: 0,
    deleted: false,
    treeDeleted: false,
    lo: s[mid],
    hi: s[mid],
    id: NEXT_ID++,
  }
  pull(n)
  return n
}

function flatten(n: Node | null, out: P[], dead = false) {
  if (!n) return
  const gone = dead || n.treeDeleted
  if (!gone && !n.deleted) out.push(n.p)
  flatten(n.l, out, gone)
  flatten(n.r, out, gone)
}

type Ev = { kind: "balance" | "deleted"; value: number; size: number; id: number }

function check(n: Node): Ev | null {
  if (n.size <= MIN_UNBALANCED) return null
  const son = n.l ?? n.r
  const del = n.invalid / n.size
  if (del > DEL) return { kind: "deleted", value: del, size: n.size, id: n.id }
  const bal = (son ? son.size : 0) / (n.size - 1)
  if (bal > BAL || bal < 1 - BAL) return { kind: "balance", value: bal, size: n.size, id: n.id }
  return null
}

// returns the (possibly rebuilt) node
function insert(n: Node | null, p: P, evs: Ev[]): Node {
  if (!n) {
    const leaf: Node = { p, axis: 0, l: null, r: null, size: 1, invalid: 0, deleted: false, treeDeleted: false, lo: p, hi: p, id: NEXT_ID++ }
    return leaf
  }
  if (p[n.axis] < n.p[n.axis]) n.l = insert(n.l, p, evs)
  else n.r = insert(n.r, p, evs)
  pull(n)
  const ev = check(n)
  if (ev) {
    evs.push(ev)
    const pts: P[] = []
    flatten(n, pts)
    const nn = build(pts)
    if (nn) markFresh(nn)
    return nn as Node
  }
  return n
}

function boxDelete(n: Node | null, lo: P, hi: P, evs: Ev[]): Node | null {
  if (!n) return null
  if (n.treeDeleted) return n
  if (n.hi[0] < lo[0] || n.lo[0] > hi[0] || n.hi[1] < lo[1] || n.lo[1] > hi[1]) return n
  if (n.lo[0] >= lo[0] && n.hi[0] <= hi[0] && n.lo[1] >= lo[1] && n.hi[1] <= hi[1]) {
    n.treeDeleted = true
    n.invalid = n.size
    return n
  }
  if (n.p[0] >= lo[0] && n.p[0] <= hi[0] && n.p[1] >= lo[1] && n.p[1] <= hi[1]) n.deleted = true
  n.l = boxDelete(n.l, lo, hi, evs)
  n.r = boxDelete(n.r, lo, hi, evs)
  pull(n)
  const ev = check(n)
  if (ev) {
    evs.push(ev)
    const pts: P[] = []
    flatten(n, pts)
    const nn = build(pts)
    if (nn) markFresh(nn)
    return nn
  }
  return n
}

function clone(n: Node | null): Node | null {
  if (!n) return null
  return { ...n, p: n.p, lo: [n.lo[0], n.lo[1]], hi: [n.hi[0], n.hi[1]], l: clone(n.l), r: clone(n.r) }
}

const FRESH = new Set<number>()
function markFresh(n: Node | null) {
  if (!n) return
  FRESH.add(n.id)
  markFresh(n.l)
  markFresh(n.r)
}

type State = {
  root: Node | null
  sensor: number
  events: Ev[]
  last: string
  fresh: number[]
  ops: number
  rebuilds: number
}

// the sensor walks to the right; each scan returns points along two walls and
// some clutter around it, so new points pile up on one side of the tree
function scanAt(x: number, k: number): P[] {
  const r = rng(1000 + k)
  const out: P[] = []
  for (let i = 0; i < 6; i++) {
    const px = x + 4 + r() * 16
    if (px > 196) continue
    const pick = r()
    const py = pick < 0.4 ? 14 + r() * 4 : pick < 0.8 ? 82 + r() * 4 : 25 + r() * 50
    out.push([Math.round(px * 10) / 10, Math.round(py * 10) / 10])
  }
  return out
}

function initial(): State {
  NEXT_ID = 1
  FRESH.clear()
  const pts: P[] = []
  for (let k = 0; k < 6; k++) for (const p of scanAt(k * 4, k)) pts.push(p)
  return { root: build(pts), sensor: 24, events: [], last: "Built from the first scans: a balanced tree.", fresh: [], ops: 0, rebuilds: 0 }
}

type Act = { t: "insert" } | { t: "delete" } | { t: "reset" }

function reducer(s: State, a: Act): State {
  if (a.t === "reset") return initial()
  FRESH.clear()
  const evs: Ev[] = []
  // the tree is mutated in place below, so work on a copy (reducers must be pure)
  let root = clone(s.root)
  let sensor = s.sensor
  let last = ""
  if (a.t === "insert") {
    const pts = scanAt(sensor, s.ops + 10)
    for (const p of pts) root = insert(root, p, evs)
    sensor = Math.min(sensor + 12, 176)
    last = `Inserted ${pts.length} points from the scan at x = ${sensor - 12}.`
  } else {
    const edge = sensor - 60
    if (edge <= 0) {
      last = "Nothing behind the window yet: drive forward first."
    } else {
      root = boxDelete(root, [0, 0], [edge, 100], evs)
      last = `Box-deleted everything left of x = ${edge} (60 behind the sensor).`
    }
  }
  if (evs.length) {
    const e = evs[evs.length - 1]
    last +=
      e.kind === "balance"
        ? ` A subtree of ${e.size} nodes tipped to ${e.value.toFixed(3)} on one side (allowed 0.4 to 0.6): rebuilt.`
        : ` A subtree of ${e.size} nodes was ${(e.value * 100).toFixed(0)}% deleted (limit 50%): rebuilt, dropping the dead nodes.`
    if (evs.length > 1) last += ` ${evs.length} rebuilds in this step.`
  } else {
    last += " No subtree broke the criterion, so nothing was rebuilt."
  }
  return { root, sensor, events: evs, last, fresh: [...FRESH], ops: s.ops + 1, rebuilds: s.rebuilds + evs.length }
}

function height(n: Node | null): number {
  return n ? 1 + Math.max(height(n.l), height(n.r)) : 0
}

type Placed = { n: Node; x: number; y: number; px: number | null; py: number | null; dead: boolean }

function layout(root: Node | null): Placed[] {
  const out: Placed[] = []
  let i = 0
  const walk = (n: Node | null, d: number, px: number | null, py: number | null, dead: boolean) => {
    if (!n) return
    const gone = dead || n.treeDeleted
    const me: Placed = { n, x: 0, y: d, px, py, dead: gone || n.deleted }
    walk(n.l, d + 1, null, null, gone)
    me.x = i++
    out.push(me)
    walk(n.r, d + 1, null, null, gone)
  }
  walk(root, 0, null, null, false)
  const byId = new Map(out.map((p) => [p.n.id, p]))
  for (const p of out) {
    for (const c of [p.n.l, p.n.r]) {
      if (!c) continue
      const q = byId.get(c.id)
      if (q) {
        q.px = p.x
        q.py = p.y
      }
    }
  }
  return out
}

function splits(n: Node | null, lo: P, hi: P, out: { x1: number; y1: number; x2: number; y2: number }[]) {
  if (!n) return
  if (n.axis === 0) {
    out.push({ x1: n.p[0], y1: lo[1], x2: n.p[0], y2: hi[1] })
    splits(n.l, lo, [n.p[0], hi[1]], out)
    splits(n.r, [n.p[0], lo[1]], hi, out)
  } else {
    out.push({ x1: lo[0], y1: n.p[1], x2: hi[0], y2: n.p[1] })
    splits(n.l, lo, [hi[0], n.p[1]], out)
    splits(n.r, [lo[0], n.p[1]], hi, out)
  }
}

export function IkdOps() {
  const [s, dispatch] = useReducer(reducer, undefined, initial)
  const placed = useMemo(() => layout(s.root), [s])
  const fresh = new Set(s.fresh)
  const valid = placed.filter((p) => !p.dead).length
  const h = height(s.root)
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  splits(s.root, [0, 0], [200, 100], lines)

  const W = 640
  const PW = 300
  const PH = 150
  const sx = (x: number) => 10 + (x / 200) * (PW - 20)
  const sy = (y: number) => 10 + (y / 100) * (PH - 20)
  const n = Math.max(placed.length, 1)
  const maxDepth = Math.max(h - 1, 1)
  const tx = (i: number) => PW + 24 + (i / Math.max(n - 1, 1)) * (W - PW - 40)
  const ty = (d: number) => 16 + (d / maxDepth) * (PH + 70)
  const edge = s.sensor - 60
  const TEAL = "oklch(0.72 0.14 195)"
  const RED = "oklch(0.68 0.17 25)"
  const AMBER = "oklch(0.78 0.15 75)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">ikd-Tree · insert, lazy box-delete, partial rebuild</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => dispatch({ t: "insert" })} className="cursor-pointer rounded bg-foreground px-2 py-1 text-background">
            insert next scan
          </button>
          <button type="button" onClick={() => dispatch({ t: "delete" })} className="cursor-pointer rounded border px-2 py-1 text-foreground hover:bg-muted">
            box-delete behind
          </button>
          <button type="button" onClick={() => dispatch({ t: "reset" })} className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-muted-foreground hover:text-foreground" aria-label="reset">
            <ArrowCounterClockwiseIcon size={12} /> reset
          </button>
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${PH + 100}`} role="img" aria-label="Left: the points and the k-d tree's splitting lines, with the sensor and the region behind it that a box delete removes. Right: the same tree, one dot per node by depth; rebuilt nodes are highlighted and lazily deleted ones are hollow." className="w-full rounded-md border bg-muted/20">
          <rect x={sx(0)} y={sy(0)} width={sx(200) - sx(0)} height={sy(100) - sy(0)} fill="none" stroke="var(--border)" />
          {edge > 0 && <rect x={sx(0)} y={sy(0)} width={sx(edge) - sx(0)} height={sy(100) - sy(0)} fill={RED} opacity="0.07" />}
          {lines.map((l, i) => (
            <line key={i} x1={sx(l.x1)} y1={sy(l.y1)} x2={sx(l.x2)} y2={sy(l.y2)} stroke="var(--muted-foreground)" strokeWidth="0.5" opacity="0.45" />
          ))}
          {placed.map((p) => (
            <circle key={p.n.id} cx={sx(p.n.p[0])} cy={sy(p.n.p[1])} r={2.2}
              fill={p.dead ? "none" : fresh.has(p.n.id) ? AMBER : TEAL}
              stroke={p.dead ? RED : "none"} strokeWidth="0.8" />
          ))}
          <line x1={sx(s.sensor)} y1={sy(0)} x2={sx(s.sensor)} y2={sy(100)} stroke="var(--foreground)" strokeDasharray="2 3" strokeWidth="0.8" />
          <text x={sx(s.sensor)} y={sy(100) + 12} textAnchor="middle" className="font-mono" fontSize="8" fill="var(--foreground)">sensor</text>

          {placed.map((p) =>
            p.px === null || p.py === null ? null : (
              <line key={`e${p.n.id}`} x1={tx(p.px)} y1={ty(p.py)} x2={tx(p.x)} y2={ty(p.y)} stroke="var(--muted-foreground)" strokeWidth="0.6" opacity="0.5" />
            )
          )}
          {placed.map((p) => (
            <circle key={`t${p.n.id}`} cx={tx(p.x)} cy={ty(p.y)} r={2.6}
              fill={p.dead ? "var(--background)" : fresh.has(p.n.id) ? AMBER : TEAL}
              stroke={p.dead ? RED : "none"} strokeWidth="0.9" />
          ))}
          <text x={PW + 24} y={PH + 96} className="font-mono" fontSize="8" fill="var(--muted-foreground)">tree, by depth (root at top)</text>
        </svg>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          <Stat label="nodes (valid)" value={`${placed.length} (${valid})`} />
          <Stat label="height" value={`${h}`} />
          <Stat label="lazy-deleted, not yet freed" value={`${placed.length - valid}`} />
          <Stat label="rebuilds so far" value={`${s.rebuilds}`} highlight />
        </div>

        <p className={cn("mt-3 text-sm leading-6", s.events.length ? "text-foreground" : "text-muted-foreground")}>{s.last}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Teal: live nodes. Amber: the nodes of the subtree just rebuilt. Hollow red: points marked deleted
          but still in the tree until a rebuild sweeps them out. Keep inserting and the right side of the tree
          grows deep until a subtree tips past 0.6 and is flattened and rebuilt; delete behind the sensor and
          whole subtrees go dead with one label, then get rebuilt once more than half of them is dead.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={highlight ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</div>
    </div>
  )
}
