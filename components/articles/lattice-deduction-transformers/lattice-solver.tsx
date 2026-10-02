"use client"

import { useCallback, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// An interactive stand-in for the LDT solve loop on a 4x4 "Shidoku" (digits
// 1-4, 2x2 boxes). The point is to make the *lattice state* visible: every
// cell carries a candidate set (a subset of {1,2,3,4}), and the solver moves
// *down* the lattice by deduction (narrowing sets, never adding a candidate
// back) and branching (pinning a guess), exactly as described in the prose.
//
// - "Deduce" runs one sound-deduction pass: any digit already placed in a
//   singleton cell is struck from every peer's candidate set. This is naked-
//   single elimination; it is sound (it never removes a digit that the true
//   solution needs) but incomplete (it can stall).
// - Clicking an alive candidate "branches": it pins that guess. The widget
//   then runs an exact feasibility probe over the current candidate sets. If
//   no complete solution survives, the state is bottom (⊥) — a conflict — and
//   the solver backtracks rather than return a wrong grid. In the real LDT
//   this conflict signal is a *learned* head, which is why LDT is empirically,
//   not provably, sound; here it is computed exactly so the demo always catches
//   a bad guess.
//
// SSR-safe: the first render is the deterministic pass-0 state. No window, no
// Date, no random, no timers. All arithmetic is integer bit-twiddling, so no
// lib/dmath wrappers are needed (no Math.exp/log/pow/trig reaches the DOM).

const CELLS = 16
const ALL = 0b1111 // candidates 1..4 as bits 0..3

// Puzzle E: a uniquely-solvable 4x4 whose candidate sets collapse to the
// answer in two deduction passes.
const GIVEN: readonly number[] = [2, 0, 0, 0, 0, 0, 3, 0, 0, 4, 0, 0, 0, 0, 0, 1]
const SOLUTION: readonly number[] = [2, 3, 1, 4, 4, 1, 3, 2, 1, 4, 2, 3, 3, 2, 4, 1]

function computePeers(): number[][] {
  const peers: number[][] = []
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / 4)
    const c = i % 4
    const set = new Set<number>()
    for (let cc = 0; cc < 4; cc++) set.add(r * 4 + cc)
    for (let rr = 0; rr < 4; rr++) set.add(rr * 4 + c)
    const br = Math.floor(r / 2) * 2
    const bc = Math.floor(c / 2) * 2
    for (let dr = 0; dr < 2; dr++)
      for (let dc = 0; dc < 2; dc++) set.add((br + dr) * 4 + (bc + dc))
    set.delete(i)
    peers.push([...set])
  }
  return peers
}
const PEERS = computePeers()

const bitOf = (d: number) => 1 << (d - 1)
function popcount(m: number): number {
  let n = 0
  while (m) {
    n += m & 1
    m >>= 1
  }
  return n
}
const aliveDigits = (m: number): number[] => [1, 2, 3, 4].filter((d) => m & bitOf(d))

function initState(): number[] {
  return GIVEN.map((g) => (g ? bitOf(g) : ALL))
}

// One sound-deduction pass: strike each singleton's value from its peers.
function deduceOnce(cand: readonly number[]): { next: number[]; changed: boolean } {
  const next = cand.slice()
  let changed = false
  for (let i = 0; i < CELLS; i++) {
    if (popcount(cand[i]) === 1) {
      const m = cand[i]
      for (const p of PEERS[i]) {
        if (next[p] & m && popcount(next[p]) > 1) {
          next[p] &= ~m
          changed = true
        }
      }
    }
  }
  return { next, changed }
}

// Exact feasibility: does some full assignment exist with every cell taking a
// value from its candidate set and all-different per row/column/box? Tiny
// backtracking over 16 cells — cheap and deterministic.
function feasible(cand: readonly number[]): boolean {
  const g = new Array<number>(CELLS).fill(0)
  function ok(i: number, d: number): boolean {
    for (const p of PEERS[i]) if (g[p] === d) return false
    return true
  }
  function bt(i: number): boolean {
    if (i === CELLS) return true
    if (cand[i] === 0) return false
    for (const d of aliveDigits(cand[i])) {
      if (ok(i, d)) {
        g[i] = d
        if (bt(i + 1)) return true
        g[i] = 0
      }
    }
    return false
  }
  return bt(0)
}

const isSolved = (cand: readonly number[]) =>
  cand.every((m) => popcount(m) === 1) && feasible(cand)
const trueStillAlive = (cand: readonly number[]) =>
  cand.every((m, i) => (m & bitOf(SOLUTION[i])) !== 0)

type Guess = { cell: number; snapshot: number[] }

// --- palette (works in both themes; accent is the "alive" ink) ---
const ALIVE = "oklch(0.55 0.13 230)"
const CONFLICT = "oklch(0.62 0.19 25)"
const OK = "oklch(0.58 0.13 155)"

export function LatticeSolver() {
  const [cand, setCand] = useState<number[]>(initState)
  const [pass, setPass] = useState(0)
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [guessedCells, setGuessedCells] = useState<number[]>([])
  const [note, setNote] = useState<string | null>(null)

  const emptyCell = useMemo(() => cand.some((m) => m === 0), [cand])
  const feasibleNow = useMemo(() => feasible(cand), [cand])
  const solved = useMemo(() => isSolved(cand), [cand])
  const conflict = emptyCell || !feasibleNow
  const trueAlive = useMemo(() => trueStillAlive(cand), [cand])
  const stalled = useMemo(() => !deduceOnce(cand).changed, [cand])

  const reset = useCallback(() => {
    setCand(initState())
    setPass(0)
    setGuesses([])
    setGuessedCells([])
    setNote(null)
  }, [])

  const onDeduce = useCallback(() => {
    if (solved || conflict) return
    const { next, changed } = deduceOnce(cand)
    if (!changed) {
      setNote("Deduction stalled — no candidate can be struck. Branch to continue.")
      return
    }
    setCand(next)
    setPass((p) => p + 1)
    setNote(isSolved(next) ? "Solved by deduction alone — no guessing needed." : null)
  }, [cand, solved, conflict])

  const onAuto = useCallback(() => {
    if (conflict) return
    let cur = cand.slice()
    let steps = pass
    for (let k = 0; k < 8; k++) {
      const { next, changed } = deduceOnce(cur)
      if (!changed) break
      cur = next
      steps += 1
    }
    setCand(cur)
    setPass(steps)
    setNote(
      isSolved(cur)
        ? "Solved by deduction alone — no guessing needed."
        : "Deduction stalled. Branch to continue.",
    )
  }, [cand, pass, conflict])

  const onBranch = useCallback(
    (cell: number, d: number) => {
      if (solved || conflict) return
      const snapshot = cand.slice()
      const next = cand.slice()
      next[cell] = bitOf(d)
      setCand(next)
      setGuesses((g) => [...g, { cell, snapshot }])
      setGuessedCells((gc) => (gc.includes(cell) ? gc : [...gc, cell]))
      if (!feasible(next)) {
        setNote(`⊥ conflict: no solution survives ${d} at that cell. Backtrack — never answer wrong.`)
      } else {
        setNote(`Branched: pinned ${d}. The set still admits a solution; keep deducing.`)
      }
    },
    [cand, solved, conflict],
  )

  const onBacktrack = useCallback(() => {
    if (guesses.length === 0) return
    const last = guesses[guesses.length - 1]
    setCand(last.snapshot)
    setGuessedCells((gc) => gc.filter((c) => c !== last.cell))
    setGuesses((g) => g.slice(0, -1))
    setNote("Backtracked to before the last guess.")
  }, [guesses])

  const statusChip = conflict
    ? { label: "⊥ conflict", color: CONFLICT }
    : solved
      ? { label: "solved", color: OK }
      : stalled
        ? { label: "stalled — branch", color: "oklch(0.62 0.11 60)" }
        : { label: "deducing", color: ALIVE }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="truncate">4×4 lattice solve · pass {pass}</span>
        <span
          className="rounded-full px-2 py-0.5 font-semibold"
          style={{ color: statusChip.color, border: `1px solid ${statusChip.color}` }}
        >
          {statusChip.label}
        </span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-[auto_1fr] sm:items-start">
        {/* the grid */}
        <div
          className="mx-auto grid"
          style={{
            gridTemplateColumns: "repeat(4, 3.6rem)",
            gridTemplateRows: "repeat(4, 3.6rem)",
            gap: 2,
            background: "var(--border)",
            padding: 2,
            borderRadius: 6,
          }}
          role="img"
          aria-label={`4 by 4 candidate grid, pass ${pass}, status ${statusChip.label}`}
        >
          {cand.map((m, i) => {
            const given = GIVEN[i] !== 0
            const single = popcount(m) === 1
            const guessed = guessedCells.includes(i)
            const empty = m === 0
            // thicker separators between the four 2x2 boxes: a right edge on
            // column 1, a bottom edge on row 1.
            const r = Math.floor(i / 4)
            const c = i % 4
            const seps: string[] = []
            if (c === 1) seps.push("2px 0 0 0 var(--muted-foreground)")
            if (r === 1) seps.push("0 2px 0 0 var(--muted-foreground)")
            return (
              <div
                key={i}
                className="relative flex items-center justify-center bg-background"
                style={{
                  borderRadius: 3,
                  boxShadow: seps.length ? seps.join(", ") : undefined,
                  outline: empty ? `2px solid ${CONFLICT}` : "none",
                }}
              >
                {given ? (
                  <span className="text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                    {GIVEN[i]}
                  </span>
                ) : empty ? (
                  <span className="text-2xl font-bold" style={{ color: CONFLICT }}>
                    ⊥
                  </span>
                ) : single ? (
                  <span
                    className="text-2xl font-semibold"
                    style={{
                      color: guessed ? "var(--foreground)" : ALIVE,
                      textDecoration: guessed ? "underline dotted" : "none",
                      textUnderlineOffset: 3,
                    }}
                  >
                    {aliveDigits(m)[0]}
                  </span>
                ) : (
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: 0, width: "100%", height: "100%" }}
                  >
                    {[1, 2, 3, 4].map((d) => {
                      const alive = (m & bitOf(d)) !== 0
                      return (
                        <button
                          key={d}
                          type="button"
                          disabled={!alive || solved || conflict}
                          onClick={() => onBranch(i, d)}
                          aria-label={alive ? `branch: pin ${d} in this cell` : `${d} eliminated`}
                          className={cn(
                            "flex items-center justify-center font-mono text-[0.68rem] leading-none transition-colors",
                            alive && !solved && !conflict && "cursor-pointer hover:bg-muted",
                          )}
                          style={{
                            color: alive ? ALIVE : "var(--muted-foreground)",
                            opacity: alive ? 1 : 0.35,
                            textDecoration: alive ? "none" : "line-through",
                            fontWeight: alive ? 700 : 400,
                          }}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                )}
                {guessed && !empty ? (
                  <span
                    className="absolute right-0.5 top-0.5 font-mono text-[0.5rem]"
                    style={{ color: "oklch(0.62 0.11 60)" }}
                  >
                    ?
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* controls + readout */}
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onDeduce}
              disabled={solved || conflict}
              className="rounded-md border px-3 py-1.5 font-mono text-xs font-semibold hover:bg-muted disabled:opacity-40"
            >
              Deduce ×1
            </button>
            <button
              type="button"
              onClick={onAuto}
              disabled={solved || conflict}
              className="rounded-md border px-3 py-1.5 font-mono text-xs font-semibold hover:bg-muted disabled:opacity-40"
            >
              Deduce to fixpoint
            </button>
            {conflict ? (
              <button
                type="button"
                onClick={onBacktrack}
                disabled={guesses.length === 0}
                className="rounded-md border px-3 py-1.5 font-mono text-xs font-semibold hover:bg-muted disabled:opacity-40"
                style={{ borderColor: CONFLICT, color: CONFLICT }}
              >
                Backtrack
              </button>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="rounded-md border px-3 py-1.5 font-mono text-xs font-semibold hover:bg-muted"
            >
              Reset
            </button>
          </div>

          <p className="min-h-[2.5rem] text-muted-foreground" aria-live="polite">
            {note ??
              "Press Deduce to run one sound pass: each placed digit is struck from its row, column, and box. Or click a bold candidate to branch (guess)."}
          </p>

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">true value reachable</dt>
            <dd style={{ color: trueAlive ? OK : CONFLICT }}>
              {trueAlive ? "yes — no pass removed it (sound)" : "no — a guess dropped it"}
            </dd>
            <dt className="text-muted-foreground">state admits a solution</dt>
            <dd style={{ color: feasibleNow ? OK : CONFLICT }}>
              {feasibleNow ? "yes" : "no — this is ⊥"}
            </dd>
            <dt className="text-muted-foreground">guesses on the stack</dt>
            <dd style={{ color: "var(--foreground)" }}>{guesses.length}</dd>
          </dl>

          <p className="font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
            <span style={{ color: ALIVE }}>bold</span> = alive candidate (click to branch) ·
            struck = eliminated · <span style={{ color: CONFLICT }}>⊥</span> = conflict ·{" "}
            <span style={{ color: "oklch(0.62 0.11 60)" }}>?</span> = a guessed cell. Deduction
            only ever removes candidates; it never puts one back, and it never removes the digit the
            true solution needs. A wrong guess can, and the exact conflict check then forces a
            backtrack. LDT&apos;s real conflict signal is a learned head, right about 99.96% of the
            time on hard Sudoku — not always.
          </p>
        </div>
      </div>
    </figure>
  )
}
