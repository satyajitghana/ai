"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The hand-set CRAM energy on a real 9x9 board, relaxed one cell at a time.
//
// Energy (paper Eq. 1 at one-hot beliefs, hand-set weights of its Fig. 5a):
//   E(y) = number of cell pairs that share a row, column or box and hold the same digit.
// Each cell keeps a field G[i][a] = how many of its 20 peers currently hold digit a,
// so changing cell i from digit b to digit a changes E by G[i][a] - G[i][b].
// A move (the paper's focused Gibbs search, App. C.3.1): pick a random free cell that is
// in conflict (any free cell if none is), then draw its new digit from
// softmax(-G[i] / T). T = 0 takes the lowest-cost digit (plain descent).
// The search stops when E reaches the threshold, here 0, the energy of every valid board.
// Puzzles A and B are rows of the Sudoku-Extreme test split (sapientinc/sudoku-extreme).

type Puzzle = { id: string; label: string; q: string; a: string }

const EXTREME_A = {
  q: "........45...6....3.....267....517....9.....5...827....74..2.3.98......1..3689...",
  a: "261793584547268319398145267826951743719436825435827196674512938982374651153689472",
}
const EXTREME_B = {
  q: "........6.9..6...2.21...3.8..9..3.4.2.......7..45..63.4.........1.63.5..3..9.2...",
  a: "843219756597368412621754398169873245235496187784521639472185963918637524356942871",
}
// Puzzle A with every fourth empty cell filled in from its answer: an easier board, same solution.
const easier = EXTREME_A.q
  .split("")
  .map((c, i) => (c === "." && i % 4 === 0 ? EXTREME_A.a[i] : c))
  .join("")

const PUZZLES: Puzzle[] = [
  { id: "easy", label: "A, with extra clues", q: easier, a: EXTREME_A.a },
  { id: "a", label: "Sudoku-Extreme A", ...EXTREME_A },
  { id: "b", label: "Sudoku-Extreme B", ...EXTREME_B },
]

const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const r = Math.floor(i / 9)
  const c = i % 9
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3)
  const out: number[] = []
  for (let j = 0; j < 81; j++) {
    if (j === i) continue
    const rj = Math.floor(j / 9)
    const cj = j % 9
    const bj = Math.floor(rj / 3) * 3 + Math.floor(cj / 3)
    if (rj === r || cj === c || bj === b) out.push(j)
  }
  return out
})

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Sim = {
  clue: boolean[]
  free: number[]
  y: number[]
  G: number[][]
  E: number
  moves: number
  hist: [number, number][]
  rand: () => number
  status: "searching" | "solved" | "stuck" | "budget"
}

const BUDGET = 400000
const HIST_MAX = 400

function init(p: Puzzle, seed: number): Sim {
  const rand = rng(seed * 7919 + p.id.length * 31)
  const clue = p.q.split("").map((c) => c !== ".")
  const y = p.q.split("").map((c) => (c === "." ? Math.floor(rand() * 9) : Number(c) - 1))
  const free = clue.flatMap((c, i) => (c ? [] : [i]))
  const G = Array.from({ length: 81 }, () => new Array<number>(9).fill(0))
  for (let i = 0; i < 81; i++) for (const j of PEERS[i]) G[i][y[j]]++
  let twice = 0
  for (let i = 0; i < 81; i++) twice += G[i][y[i]]
  const E = twice / 2
  return { clue, free, y, G, E, moves: 0, hist: [[0, E]], rand, status: E === 0 ? "solved" : "searching" }
}

function isLocalMin(s: Sim) {
  for (const i of s.free) {
    const g = s.G[i]
    const cur = g[s.y[i]]
    for (let a = 0; a < 9; a++) if (g[a] < cur) return false
  }
  return true
}

function step(s: Sim, T: number, focus: boolean, n: number) {
  for (let k = 0; k < n; k++) {
    if (s.status !== "searching") return
    let i: number
    if (focus) {
      const hot: number[] = []
      for (const f of s.free) if (s.G[f][s.y[f]] > 0) hot.push(f)
      const pool = hot.length ? hot : s.free
      i = pool[Math.floor(s.rand() * pool.length)]
    } else {
      i = s.free[Math.floor(s.rand() * s.free.length)]
    }
    const g = s.G[i]
    let next = s.y[i]
    if (T <= 0) {
      let lo = Infinity
      for (let a = 0; a < 9; a++) lo = Math.min(lo, g[a])
      const ties: number[] = []
      for (let a = 0; a < 9; a++) if (g[a] === lo) ties.push(a)
      next = ties[Math.floor(s.rand() * ties.length)]
    } else {
      let lo = Infinity
      for (let a = 0; a < 9; a++) lo = Math.min(lo, g[a])
      const w = g.map((v) => mexp(-(v - lo) / T))
      let u = s.rand() * w.reduce((x, v) => x + v, 0)
      next = 8
      for (let a = 0; a < 9; a++) {
        u -= w[a]
        if (u <= 0) {
          next = a
          break
        }
      }
    }
    s.moves++
    const old = s.y[i]
    if (next !== old) {
      s.E += g[next] - g[old]
      s.y[i] = next
      for (const j of PEERS[i]) {
        s.G[j][old]--
        s.G[j][next]++
      }
    }
    if (s.moves % 50 === 0 || s.E === 0) {
      s.hist.push([s.moves, s.E])
      if (s.hist.length > HIST_MAX) s.hist = s.hist.filter((_, idx) => idx % 2 === 0 || idx === s.hist.length - 1)
    }
    if (s.E === 0) s.status = "solved"
    else if (T <= 0 && s.moves % 200 === 0 && isLocalMin(s)) s.status = "stuck"
    else if (s.moves >= BUDGET) s.status = "budget"
  }
}

const fmt = (v: number) => v.toLocaleString("en-US")

type View = Pick<Sim, "clue" | "E" | "moves" | "status"> & { y: number[]; hist: [number, number][]; conflicted: boolean[] }

function snap(s: Sim): View {
  return {
    clue: s.clue,
    E: s.E,
    moves: s.moves,
    status: s.status,
    y: s.y.slice(),
    hist: s.hist.slice(),
    conflicted: s.y.map((d, i) => !s.clue[i] && s.G[i][d] > 0),
  }
}

export function EnergyRelax() {
  const [pid, setPid] = useState("easy")
  const [seed, setSeed] = useState(1)
  const [temp, setTemp] = useState(0.35)
  const [focus, setFocus] = useState(true)
  const [running, setRunning] = useState(false)
  const puzzle = PUZZLES.find((p) => p.id === pid) ?? PUZZLES[0]
  const sim = useRef<Sim | null>(null)
  const [view, setView] = useState<View>(() => snap(init(PUZZLES[0], 1)))
  const cur = useCallback(() => {
    if (!sim.current) sim.current = init(PUZZLES[0], 1)
    return sim.current
  }, [])
  const bump = useCallback(() => setView(snap(cur())), [cur])

  const reset = useCallback(
    (p: Puzzle, n: number) => {
      sim.current = init(p, n)
      setRunning(false)
      bump()
    },
    [bump],
  )

  useEffect(() => {
    if (!running) return
    let raf = 0
    const loop = () => {
      const sm = cur()
      step(sm, temp, focus, 1500)
      bump()
      if (sm.status === "searching") raf = requestAnimationFrame(loop)
      else setRunning(false)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running, temp, focus, bump, cur])

  const s = view
  const conflicted = s.conflicted
  const nConf = conflicted.filter(Boolean).length
  const cell = 30
  const B = cell * 9

  // energy trace
  const W = 360
  const H = 200
  const L = 34
  const R = 8
  const Tp = 10
  const Bm = 26
  const xMax = Math.max(1000, s.moves)
  const yMax = Math.max(4, ...s.hist.map((h) => h[1]))
  const px = (m: number) => L + (m / xMax) * (W - L - R)
  const py = (e: number) => Tp + (1 - e / yMax) * (H - Tp - Bm)
  const path = s.hist.map(([m, e], k) => `${k ? "L" : "M"}${px(m).toFixed(1)},${py(e).toFixed(1)}`).join(" ")

  const statusText =
    s.status === "solved"
      ? `stopped: E reached the threshold after ${fmt(s.moves)} moves, and the board is ${s.y.every((d, i) => String(d + 1) === puzzle.a[i]) ? "the solution" : "valid"}`
      : s.status === "stuck"
        ? "stuck: no single-cell change lowers E, yet E > 0 (a spurious minimum)"
        : s.status === "budget"
          ? `budget of ${fmt(BUDGET)} moves spent without reaching the threshold`
          : running
            ? "relaxing…"
            : "ready"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">relax a hand-set CRAM energy, one cell at a time</span>
        <span className="font-mono text-[10px] text-muted-foreground">runs in your browser; seeded</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap rounded-md border p-0.5" role="group" aria-label="puzzle">
            {PUZZLES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPid(p.id)
                  reset(p, seed)
                }}
                className={cn("rounded px-2.5 py-1 font-mono text-[11px]", pid === p.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFocus((f) => !f)}
            className={cn("rounded-md border px-2.5 py-1 font-mono text-[11px]", focus ? "bg-muted text-foreground" : "text-muted-foreground")}
            aria-pressed={focus}
          >
            focused moves {focus ? "on" : "off"}
          </button>
        </div>
        <label className="mt-3 block max-w-md font-mono text-[11px] text-muted-foreground">
          temperature T: <span className="text-foreground">{temp === 0 ? "0 (plain descent)" : temp.toFixed(2)}</span>
          <span className="ml-1">(in units of one conflict)</span>
          <Range min={0} max={0.8} step={0.05} value={temp} onChange={(e) => setTemp(Number(e.target.value))} className="mt-1 w-full" aria-label="temperature" />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={s.status !== "searching"}
            onClick={() => setRunning((r) => !r)}
            className="rounded-md border bg-foreground px-3 py-1 font-mono text-[11px] text-background disabled:opacity-40"
          >
            {running ? "pause" : "relax"}
          </button>
          <button
            type="button"
            disabled={s.status !== "searching" || running}
            onClick={() => {
              step(cur(), temp, focus, 1)
              bump()
            }}
            className="rounded-md border px-3 py-1 font-mono text-[11px] disabled:opacity-40"
          >
            one move
          </button>
          <button
            type="button"
            disabled={s.status !== "searching" || running}
            onClick={() => {
              step(cur(), temp, focus, 500)
              bump()
            }}
            className="rounded-md border px-3 py-1 font-mono text-[11px] disabled:opacity-40"
          >
            500 moves
          </button>
          <button
            type="button"
            onClick={() => {
              const n = seed + 1
              setSeed(n)
              reset(puzzle, n)
            }}
            className="rounded-md border px-3 py-1 font-mono text-[11px]"
          >
            new random start
          </button>
        </div>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-[auto_1fr]">
          <svg viewBox={`-2 -2 ${B + 4} ${B + 4}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label={`Sudoku board, ${nConf} free cells in conflict, energy ${s.E}.`}>
            {s.y.map((d, i) => {
              const r = Math.floor(i / 9)
              const c = i % 9
              return (
                <g key={i}>
                  <rect
                    x={c * cell}
                    y={r * cell}
                    width={cell}
                    height={cell}
                    className={cn(s.clue[i] ? "fill-muted" : conflicted[i] ? "fill-rose-500/25" : "fill-sky-500/10", "stroke-border")}
                    strokeWidth={0.5}
                  />
                  <text
                    x={c * cell + cell / 2}
                    y={r * cell + cell / 2 + 5}
                    textAnchor="middle"
                    className={cn("font-mono text-[14px]", s.clue[i] ? "fill-foreground font-semibold" : conflicted[i] ? "fill-rose-700 dark:fill-rose-300" : "fill-sky-700 dark:fill-sky-300")}
                  >
                    {d + 1}
                  </text>
                </g>
              )
            })}
            {[0, 3, 6, 9].map((k) => (
              <g key={k}>
                <line x1={k * cell} x2={k * cell} y1={0} y2={B} className="stroke-foreground" strokeWidth={1.5} />
                <line y1={k * cell} y2={k * cell} x1={0} x2={B} className="stroke-foreground" strokeWidth={1.5} />
              </g>
            ))}
          </svg>
          <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Energy against moves, with the stopping threshold at zero.">
              <line x1={L} x2={W - R} y1={py(0)} y2={py(0)} className="stroke-emerald-600 dark:stroke-emerald-400" strokeDasharray="4 3" />
              <text x={W - R} y={py(0) - 4} textAnchor="end" className="fill-emerald-700 font-mono text-[9px] dark:fill-emerald-400">
                stopping threshold, E = 0
              </text>
              <line x1={L} x2={L} y1={Tp} y2={H - Bm} className="stroke-border" />
              <text x={L - 4} y={py(yMax) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {yMax}
              </text>
              <text x={L - 4} y={py(0) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                0
              </text>
              <path d={path} fill="none" className="stroke-foreground" strokeWidth={1.5} />
              <text x={L} y={H - 8} className="fill-muted-foreground font-mono text-[9px]">
                moves → {fmt(xMax)}
              </text>
              <text x={6} y={Tp + 2} className="fill-muted-foreground font-mono text-[9px]" transform={`rotate(-90 6 ${Tp + 2})`} textAnchor="end">
                energy E
              </text>
            </svg>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              {[
                ["moves", fmt(s.moves)],
                ["energy E", fmt(s.E)],
                ["cells in conflict", String(nConf)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border bg-muted/20 px-2 py-1.5">
                  <dt className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{k}</dt>
                  <dd className="font-mono text-sm text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <p className={cn("mt-2 font-mono text-[11px]", s.status === "solved" ? "text-emerald-700 dark:text-emerald-400" : s.status === "stuck" ? "text-rose-700 dark:text-rose-300" : "text-muted-foreground")}>
              {statusText}
            </p>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Grey cells are clamped clues. The energy is the hand-set CRAM energy: one unit of cost for every pair of cells in the same row, column or box holding the same digit, so a valid board sits at E = 0. Red cells are free cells in conflict. At T = 0 each move takes the cheapest digit, which usually parks the board in a minimum with a few conflicts left; a little temperature lets it climb out. The learned energy has the same structure with fitted costs between 0.48 and 1.32 instead of 1, and the paper runs four chains with an annealed temperature on a GPU. A and B are real Sudoku-Extreme test puzzles and can take tens of thousands of moves.
      </figcaption>
    </figure>
  )
}
