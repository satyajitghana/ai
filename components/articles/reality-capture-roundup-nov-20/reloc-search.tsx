"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { mcos, msin } from "@/lib/dmath"

// Global relocalisation on a toy floor, with the search lidar_localization_ros2 runs
// (include/lidar_localization/bbs_branch_and_bound.hpp at 285070f), ported to TypeScript:
//   - an occupancy grid, dilated once (make_bbs_relocalization_attempts.py's --dilate-cells 1);
//   - a pyramid of 2x2 max-pools; each level above 0 dilated by one cell, which makes a node's
//     hit count an upper bound on every pose under it (the floor() of a coarse offset can land
//     one cell off the fine offsets' block);
//   - score = fraction of scan points on occupied cells; best-first over (x, y, yaw) with a heap,
//     children only expanded while their bound beats the k-th best; non-maximum suppression;
//   - ties broken as the header does: score, then yaw index, then y, then x.
// The two-query check is the repo's rule in its simplest form: query, move by odometry, query
// again, accept only if the first answer moved by the odometry lands on the second.
//
// The floor is mine: two identical rooms (10 x 6 m at 0.25 m cells) over a corridor whose only
// asymmetric thing is a pillar at the east end. Yaw is sampled every 45 degrees so rotations are
// exact (cos and sin are 0, 1 or the square root of a half).

const W = 64
const H = 40
const RES = 0.25
const DEPTH = 3
const K = 6
const NMS = 4
const S = Math.SQRT1_2
const YAWS: [number, number][] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
]

type Grid = Uint8Array

function makeMap(cabinet: boolean): Grid {
  const g = new Uint8Array(W * H)
  const set = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * W + x] = 1
  }
  set(0, 0, W - 1, 0)
  set(0, H - 1, W - 1, H - 1)
  set(0, 0, 0, H - 1)
  set(W - 1, 0, W - 1, H - 1)
  set(31, 0, 32, 25) // between the rooms
  set(0, 25, 13, 25) // rooms' south wall, doors at x 14-17 and 46-49
  set(18, 25, 45, 25)
  set(50, 25, W - 1, 25)
  set(6, 6, 9, 9) // a column in each room, same place
  set(38, 6, 41, 9)
  set(55, 31, 58, 34) // the pillar in the corridor, east end only
  if (cabinet) set(50, 14, 57, 16) // a cabinet in the east room
  return g
}

function dilate(g: Grid, w: number, h: number): Grid {
  const o = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let dy = -1; dy <= 1 && !v; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy
          const xx = x + dx
          if (yy >= 0 && yy < h && xx >= 0 && xx < w && g[yy * w + xx]) {
            v = 1
            break
          }
        }
      o[y * w + x] = v
    }
  return o
}

function pool(g: Grid, w: number, h: number): [Grid, number, number] {
  const pw = (w + 1) >> 1
  const ph = (h + 1) >> 1
  const o = new Uint8Array(pw * ph)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y * w + x]) o[(y >> 1) * pw + (x >> 1)] = 1
  return [o, pw, ph]
}

// a scan: rays cast in the map the robot actually stands in, endpoints in the robot frame (yaw 0)
function castScan(g: Grid, px: number, py: number, rays: number): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * 2 * Math.PI
    const c = mcos(a)
    const s = msin(a)
    for (let r = 0.5; r < 60; r += 0.1) {
      const x = px + c * r
      const y = py + s * r
      const ix = Math.floor(x)
      const iy = Math.floor(y)
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) break
      if (g[iy * W + ix]) {
        pts.push([x - px, y - py])
        break
      }
    }
  }
  return pts
}

type Cand = { tx: number; ty: number; yaw: number; hits: number; score: number }

function search(grid: Grid, scan: [number, number][]) {
  // level 0: the grid dilated once; then max-pools, each dilated once for the bound
  const g0 = dilate(grid, W, H)
  const pyr: [Grid, number, number][] = [[g0, W, H]]
  for (let i = 0; i < DEPTH; i++) pyr.push(pool(...pyr[pyr.length - 1]))
  const ub = pyr.map(([g, w, h], i) => (i === 0 ? g : dilate(g, w, h)))
  const n = scan.length
  // offsets[yaw][level]: deduplicated (qx, qy, count)
  const offsets = YAWS.map(([c, s]) =>
    pyr.map((_, L) => {
      const f = 1 << L
      const m = new Map<string, [number, number, number]>()
      for (const [x, y] of scan) {
        const qx = Math.floor((0.5 + (c * x - s * y)) / f)
        const qy = Math.floor((0.5 + (s * x + c * y)) / f)
        const k = `${qx},${qy}`
        const e = m.get(k)
        if (e) e[2]++
        else m.set(k, [qx, qy, 1])
      }
      return [...m.values()]
    }),
  )
  let evals = 0
  const hits = (L: number, yi: number, tx: number, ty: number) => {
    evals++
    const [, w, h] = pyr[L]
    const u = ub[L]
    const bx = tx >> L
    const by = ty >> L
    let hit = 0
    for (const [qx, qy, cnt] of offsets[yi][L]) {
      const ix = qx + bx
      const iy = qy + by
      if (ix >= 0 && iy >= 0 && ix < w && iy < h && u[iy * w + ix]) hit += cnt
    }
    return hit
  }
  // a binary max-heap on (bound, -seq)
  type Node = { b: number; seq: number; L: number; tx: number; ty: number; yi: number }
  const heap: Node[] = []
  const better = (a: Node, b: Node) => a.b > b.b || (a.b === b.b && a.seq < b.seq)
  const push = (nd: Node) => {
    heap.push(nd)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!better(heap[i], heap[p])) break
      ;[heap[i], heap[p]] = [heap[p], heap[i]]
      i = p
    }
  }
  const pop = (): Node => {
    const top = heap[0]
    const last = heap.pop() as Node
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && better(heap[l], heap[m])) m = l
        if (r < heap.length && better(heap[r], heap[m])) m = r
        if (m === i) break
        ;[heap[i], heap[m]] = [heap[m], heap[i]]
        i = m
      }
    }
    return top
  }
  const top = DEPTH
  const step = 1 << top
  let seq = 0
  for (let yi = 0; yi < YAWS.length; yi++)
    for (let ty = 0; ty < H; ty += step)
      for (let tx = 0; tx < W; tx += step) push({ b: hits(top, yi, tx, ty) / n, seq: seq++, L: top, tx, ty, yi })
  const best: Cand[] = []
  let kth = -Infinity
  const order = (a: Cand, b: Cand) => b.score - a.score || a.yaw - b.yaw || a.ty - b.ty || a.tx - b.tx
  while (heap.length) {
    const nd = pop()
    if (best.length >= K && nd.b <= kth + 1e-12) break
    if (nd.L === 0) {
      const h = hits(0, nd.yi, nd.tx, nd.ty)
      const cand = { tx: nd.tx, ty: nd.ty, yaw: nd.yi, hits: h, score: h / n }
      const j = best.findIndex((b) => Math.abs(b.tx - cand.tx) <= NMS && Math.abs(b.ty - cand.ty) <= NMS)
      if (j >= 0) {
        if (cand.score > best[j].score) best[j] = cand
      } else best.push(cand)
      best.sort(order)
      if (best.length > K) best.length = K
      if (best.length >= K) kth = best[K - 1].score
      continue
    }
    const cs = 1 << (nd.L - 1)
    for (let dy = 0; dy <= cs; dy += cs)
      for (let dx = 0; dx <= cs; dx += cs) {
        const tx = nd.tx + dx
        const ty = nd.ty + dy
        if (tx >= W || ty >= H) continue
        const b = hits(nd.L - 1, nd.yi, tx, ty) / n
        if (best.length >= K && b < kth - 1e-12) continue
        push({ b, seq: seq++, L: nd.L - 1, tx, ty, yi: nd.yi })
      }
  }
  best.sort(order)
  return { best, evals, brute: W * H * YAWS.length }
}

const P1: [number, number] = [47, 13] // the robot really stands in the east room
const RAYS = 90
// odometry between the queries: 4.75 m south, out through the door; or 2 m east and 1.5 m north,
// staying in the room (from there the door shows nothing of the corridor's pillar)
const MOVES: Record<Move, [number, number]> = { corridor: [0, 19], room: [8, -6] }

type Scenario = "twins" | "cabinet"
type Move = "corridor" | "room"

export function RelocSearch() {
  const [scenario, setScenario] = useState<Scenario>("twins")
  const [move, setMove] = useState<Move>("corridor")
  const [shown, setShown] = useState<1 | 2>(1)

  const res = useMemo(() => {
    const grid = makeMap(scenario === "cabinet")
    const MOVE = MOVES[move]
    const p2: [number, number] = [P1[0] + MOVE[0], P1[1] + MOVE[1]]
    const s1 = castScan(grid, P1[0] + 0.5, P1[1] + 0.5, RAYS)
    const s2 = castScan(grid, p2[0] + 0.5, p2[1] + 0.5, RAYS)
    const q1 = search(grid, s1)
    const q2 = search(grid, s2)
    const a = q1.best[0]
    const [c, s] = YAWS[a.yaw]
    const predicted: [number, number] = [a.tx + Math.round(c * MOVE[0] - s * MOVE[1]), a.ty + Math.round(s * MOVE[0] + c * MOVE[1])]
    const b = q2.best[0]
    const agree = b.yaw === a.yaw && Math.abs(b.tx - predicted[0]) <= 2 && Math.abs(b.ty - predicted[1]) <= 2
    const right1 = Math.abs(a.tx - P1[0]) <= 2 && Math.abs(a.ty - P1[1]) <= 2 && a.yaw === 0
    const right2 = Math.abs(b.tx - p2[0]) <= 2 && Math.abs(b.ty - p2[1]) <= 2 && b.yaw === 0
    return { grid, s1, s2, q1, q2, p2, predicted, agree, right1, right2 }
  }, [scenario, move])

  const C = 8.5
  const X = (x: number) => 4 + x * C
  const Y = (y: number) => 4 + y * C
  const q = shown === 1 ? res.q1 : res.q2
  const truth = shown === 1 ? P1 : res.p2
  const scan = shown === 1 ? res.s1 : res.s2
  const top = q.best[0]
  const [tc, ts] = YAWS[top.yaw]
  const tied = q.best.filter((b) => b.score >= top.score - 1e-12).length
  const errM = Math.sqrt((top.tx - truth[0]) ** 2 + (top.ty - truth[1]) ** 2) * RES

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
    )

  const verdict = res.agree
    ? res.right1
      ? "the two answers agree, and the pose is right: accept"
      : "the two answers agree on the wrong room: accepted, and wrong"
    : "the first answer, moved by the odometry, misses the second: reject and query again"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="text-foreground">no initial pose: branch-and-bound over the whole floor</span>
        <span className="text-muted-foreground/60">the repo&apos;s search, ported; my floor</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={scenario === "twins"} onClick={() => setScenario("twins")} className={btn(scenario === "twins")}>
            identical rooms
          </button>
          <button type="button" aria-pressed={scenario === "cabinet"} onClick={() => setScenario("cabinet")} className={btn(scenario === "cabinet")}>
            a cabinet in the east room
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" aria-pressed={move === "corridor"} onClick={() => setMove("corridor")} className={btn(move === "corridor")}>
            move out to the corridor
          </button>
          <button type="button" aria-pressed={move === "room"} onClick={() => setMove("room")} className={btn(move === "room")}>
            move within the room
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button type="button" aria-pressed={shown === 1} onClick={() => setShown(1)} className={btn(shown === 1)}>
            query 1, in the room
          </button>
          <button type="button" aria-pressed={shown === 2} onClick={() => setShown(2)} className={btn(shown === 2)}>
            query 2, after the move
          </button>
        </div>

        <svg viewBox={`0 0 ${W * C + 8} ${H * C + 8}`} className="mt-4 w-full" role="img" aria-label="Occupancy grid with ranked candidate poses and the scan placed at the best one">
          {Array.from(res.grid).map((v, i) =>
            v ? <rect key={i} x={X(i % W)} y={Y(Math.floor(i / W))} width={C} height={C} className="fill-foreground/70" /> : null,
          )}
          {q.best
            .slice()
            .reverse()
            .map((b, i) => (
              <circle
                key={i}
                cx={X(b.tx + 0.5)}
                cy={Y(b.ty + 0.5)}
                r={3 + 9 * b.score}
                fill="none"
                stroke="oklch(0.65 0.2 25)"
                strokeWidth={b === top ? 2 : 1}
                opacity={b === top ? 1 : 0.6}
              />
            ))}
          {scan.map(([x, y], i) => (
            <circle key={i} cx={X(top.tx + 0.5 + tc * x - ts * y)} cy={Y(top.ty + 0.5 + ts * x + tc * y)} r={1.6} className="fill-sky-500" />
          ))}
          <g>
            <line x1={X(truth[0] + 0.5) - 5} x2={X(truth[0] + 0.5) + 5} y1={Y(truth[1] + 0.5) - 5} y2={Y(truth[1] + 0.5) + 5} className="stroke-emerald-500" strokeWidth={2} />
            <line x1={X(truth[0] + 0.5) - 5} x2={X(truth[0] + 0.5) + 5} y1={Y(truth[1] + 0.5) + 5} y2={Y(truth[1] + 0.5) - 5} className="stroke-emerald-500" strokeWidth={2} />
          </g>
          {shown === 2 && (
            <rect x={X(res.predicted[0]) - 6} y={Y(res.predicted[1]) - 6} width={16} height={16} fill="none" className="stroke-amber-500" strokeWidth={1.5} strokeDasharray="3 2" />
          )}
        </svg>

        <div className="mt-3 grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          <div>
            best score <span className="text-foreground">{top.score.toFixed(3)}</span> · candidates tied at it{" "}
            <span className="text-foreground">{tied}</span> · top is{" "}
            <span className="text-foreground">{errM.toFixed(2)} m</span> from the truth
          </div>
          <div>
            poses scored <span className="text-foreground">{q.evals.toLocaleString("en-US")}</span> of{" "}
            <span className="text-foreground">{q.brute.toLocaleString("en-US")}</span> exhaustive
          </div>
          <div>
            query 1 top is <span className="text-foreground">{res.right1 ? "the true pose" : "in the wrong place"}</span> · query 2 top is{" "}
            <span className="text-foreground">{res.right2 ? "the true pose" : "in the wrong place"}</span>
          </div>
          <div className={cn(res.agree && !res.right1 ? "text-rose-500" : "text-foreground")}>{verdict}</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Green cross: where the robot is. Red circles: the best candidates, sized by score; the bold one is ranked first, and the blue scan is
        drawn there. In query 2 the dashed box is where query 1&apos;s answer should be after the odometry move. With identical rooms the
        two rooms score exactly the same and the tie-break picks the west one; the corridor&apos;s pillar is what breaks the tie on the
        second query. Move within the room instead and the second query sees only the room, ties the same way, and agrees with the
        first: a wrong pose, accepted. A cabinet the map knows about settles it in one query.
      </figcaption>
    </figure>
  )
}
