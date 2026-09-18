"use client"

import { useMemo, useState } from "react"

// Why a lexer is a prefix scan, and why one string rule wrecks it.
//
// Pareas's trick (thesis section 3.1.2, after Hillis & Steele 1986): map each
// input byte to its unary transition function d_a(q) = d(q, a), then compose
// them. Composition is associative, so the automaton's state after every prefix
// is a parallel prefix scan -- src/compiler/lexer/lexer.fut is literally
// `map (...) |> scan merge identity`. Two functions are composed by one lookup
// in a precomputed k x k table, so the value flowing through the scan is a small
// integer identifier, never a table.
//
// The whole cost model lives in k. This widget is a five-symbol toy, not the
// real thing (the real grammars start from 256 initial functions, one per byte),
// but it is a faithful miniature: adding one string rule takes the toy's k from
// 5 to 20, a 4.0x growth, and adding one string rule to the real pareas.lex
// takes k from 1,927 to 7,952, a 4.1x growth, measured. The mechanism is the
// same. Outside a string every transition function is constant -- a digit puts
// you in the "in a number" state no matter where you were -- and constants
// compose to constants, so the closure stays tiny. A string introduces a mode:
// a digit means "number" outside it and "string body" inside it, so d_digit
// stops being constant, compositions stop collapsing, and the closure grows.
//
// Everything is computed in the component: the closure, the sequential fold and
// the Hillis-Steele tree. Round counts come from integer doubling, so no
// transcendental reaches the DOM and lib/dmath is not needed here.

type Grammar = {
  id: "flat" | "string"
  title: string
  detail: string
  states: string[]
  accept: (string | null)[] // token emitted if the automaton stops in this state
  delta: Record<string, number[]> // next state, per source state
  emit: Record<string, boolean[]> // does that transition produce a token?
}

const CLASSES = ["digit", "space", "plus", "quote", "letter"] as const
type Cls = (typeof CLASSES)[number]
const TAG: Record<Cls, string> = {
  digit: "d",
  space: "␣",
  plus: "+",
  quote: '"',
  letter: "a",
}

const classify = (c: string): Cls => {
  if (c >= "0" && c <= "9") return "digit"
  if (c === " ") return "space"
  if (c === "+") return "plus"
  if (c === '"') return "quote"
  return "letter"
}

// States: R reject, S start, N in-number, P plus, W whitespace, Q string body,
// T string closed. Written out the way pareas-lpg builds a lexer DFA: every
// accepting state inherits the start state's outgoing edges, augmented to emit
// the token of the state being left.
const FLAT: Grammar = {
  id: "flat",
  title: "int + ws",
  detail: "[0-9]+, ' '+, '+'",
  states: ["R", "S", "N", "P", "W"],
  accept: [null, null, "int", "plus", "ws"],
  delta: {
    digit: [0, 2, 2, 2, 2],
    space: [0, 4, 4, 4, 4],
    plus: [0, 3, 3, 3, 3],
    quote: [0, 0, 0, 0, 0],
    letter: [0, 0, 0, 0, 0],
  },
  emit: {
    digit: [false, false, false, true, true],
    space: [false, false, true, true, false],
    plus: [false, false, true, true, true],
    quote: [false, false, false, false, false],
    letter: [false, false, false, false, false],
  },
}

const WITH_STRING: Grammar = {
  id: "string",
  title: 'int + ws + "..."',
  detail: 'those three, plus one "..." rule',
  states: ["R", "S", "N", "P", "W", "Q", "T"],
  accept: [null, null, "int", "plus", "ws", null, "str"],
  delta: {
    digit: [0, 2, 2, 2, 2, 5, 2],
    space: [0, 4, 4, 4, 4, 5, 4],
    plus: [0, 3, 3, 3, 3, 5, 3],
    quote: [0, 5, 5, 5, 5, 6, 5],
    letter: [0, 0, 0, 0, 0, 5, 0],
  },
  emit: {
    digit: [false, false, false, true, true, false, true],
    space: [false, false, true, true, false, false, true],
    plus: [false, false, true, true, true, false, true],
    quote: [false, false, true, true, true, false, true],
    letter: [false, false, false, false, false, false, false],
  },
}

const GRAMMARS = [FLAT, WITH_STRING]
const CHARS = [...'1 + "ab"']
const START = 1 // index of "S"

// merge(a, b) = b after a, matching ParallelState::merge in
// src/lpg/lexer/parallel_lexer.cpp: `state = other.transitions[state.result_state]`.
const compose = (a: number[], b: number[]) => a.map((q) => b[q])
const key = (f: number[]) => f.join(",")

// The closure of the grammar's transition functions under composition, which is
// what ParallelLexer's constructor computes. Its size is the k that makes the
// merge table k x k. Insertion order is deterministic, so the identifiers this
// hands out are stable between the server render and the browser render.
function buildClosure(g: Grammar) {
  const ids = new Map<string, number>()
  const fns: number[][] = []
  const add = (f: number[]) => {
    const k = key(f)
    if (!ids.has(k)) {
      ids.set(k, fns.length)
      fns.push(f)
    }
  }
  add(g.states.map((_, i) => i)) // identity, id 0
  for (const c of CLASSES) add(g.delta[c])
  for (let i = 0; i < fns.length && fns.length < 4000; i++) {
    for (let j = 0; j < fns.length; j++) {
      add(compose(fns[i], fns[j]))
      add(compose(fns[j], fns[i]))
    }
  }
  return { k: fns.length, id: (f: number[]) => ids.get(key(f)) ?? -1 }
}

const CELL =
  "flex h-7 w-9 shrink-0 items-center justify-center rounded border font-mono text-[11px]"

export function ScanMerge() {
  const [gi, setGi] = useState(1)
  const [round, setRound] = useState(3)
  const g = GRAMMARS[gi]

  const m = useMemo(() => {
    const closure = buildClosure(g)
    const fs = CHARS.map((c) => g.delta[classify(c)])

    // Sequential inclusive fold, left to right.
    const seq: number[][] = []
    for (let i = 0; i < fs.length; i++) {
      seq.push(i === 0 ? fs[0] : compose(seq[i - 1], fs[i]))
    }

    // Hillis-Steele: the same answer in log n rounds instead of n.
    const rounds: number[][][] = [fs]
    let step = 1
    while (step < fs.length) {
      const prev = rounds[rounds.length - 1]
      rounds.push(prev.map((x, i) => (i >= step ? compose(prev[i - step], x) : x)))
      step *= 2
    }
    const agrees = rounds[rounds.length - 1].every((f, i) => key(f) === key(seq[i]))

    // Read tokens off the prefixes the way LexerInterpreter::lex_linear does:
    // a token belongs to the state you left, not the one you entered.
    const statesAt = seq.map((f) => f[START])
    const tokens = CHARS.map((c, i) => {
      const from = i === 0 ? START : statesAt[i - 1]
      return g.emit[classify(c)][from] ? g.accept[from] : null
    })

    return {
      closure,
      fs,
      seq,
      rounds,
      agrees,
      statesAt,
      tokens,
      finalTok: g.accept[statesAt[statesAt.length - 1]],
    }
  }, [g])

  const r = Math.min(round, m.rounds.length - 1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          lexing as a prefix scan &mdash; a five-symbol toy
        </span>
        <div className="flex gap-1">
          {GRAMMARS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={i === gi}
              onClick={() => setGi(i)}
              className={
                "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors " +
                (i === gi
                  ? "border-foreground/30 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {x.title}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto p-3 sm:p-5">
        <div className="min-w-[24rem] space-y-1.5">
          <Row label="input">
            {CHARS.map((c, i) => (
              <span key={i} className={CELL + " border-border bg-background"}>
                {c === " " ? "␣" : c}
              </span>
            ))}
          </Row>

          <Row label="fn id">
            {m.fs.map((f, i) => (
              <span key={i} className={CELL + " border-border/60 text-muted-foreground"}>
                {m.closure.id(f)}
                <span className="ml-0.5 text-[9px] opacity-60">
                  {TAG[classify(CHARS[i])]}
                </span>
              </span>
            ))}
          </Row>

          <div className="flex items-center gap-2 py-1">
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
              round {r}
            </span>
            <input
              type="range"
              min={0}
              max={m.rounds.length - 1}
              value={r}
              onChange={(e) => setRound(Number(e.target.value))}
              aria-label="Hillis-Steele doubling round"
              className="h-1 max-w-[16rem] flex-1 accent-foreground"
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              stride {r === 0 ? 0 : 1 << (r - 1)}
            </span>
          </div>

          <Row label="scan">
            {m.rounds[r].map((f, i) => {
              const done = key(f) === key(m.seq[i])
              return (
                <span
                  key={i}
                  className={
                    CELL +
                    (done
                      ? " border-foreground/40 bg-foreground/10"
                      : " border-border/50 text-muted-foreground/60")
                  }
                >
                  {m.closure.id(f)}
                </span>
              )
            })}
          </Row>

          <Row label="state">
            {m.statesAt.map((s, i) => (
              <span
                key={i}
                className={
                  CELL +
                  (g.states[s] === "R"
                    ? " border-destructive/40 text-destructive"
                    : " border-border/60")
                }
              >
                {g.states[s]}
              </span>
            ))}
          </Row>

          <Row label="token">
            {m.tokens.map((t, i) => (
              <span
                key={i}
                className={
                  CELL +
                  (t
                    ? " border-foreground/30 bg-foreground/5"
                    : " border-transparent") +
                  " !w-auto min-w-9 px-1"
                }
              >
                {t ?? ""}
              </span>
            ))}
          </Row>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-1 border-t bg-muted/20 px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <div>
          <span className="text-foreground/70">grammar</span> {g.detail}
        </div>
        <div>
          <span className="text-foreground/70">final token</span>{" "}
          {m.finalTok ?? "(input error)"}
        </div>
        <div>
          <span className="text-foreground/70">k</span> {m.closure.k} distinct
          transition functions
        </div>
        <div>
          <span className="text-foreground/70">merge table</span> {m.closure.k}&sup2;
          &times; 2 B = {(m.closure.k * m.closure.k * 2).toLocaleString("en-US")} B
        </div>
        <div className="sm:col-span-2">
          <span className="text-foreground/70">tree scan = sequential fold</span>{" "}
          {m.agrees ? "yes, at every position" : "no"} &mdash; that equality is the only
          reason any of this parallelises
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        A five-symbol miniature of <code>src/compiler/lexer/lexer.fut</code>, computed
        live in the page rather than read off the real tables. Drag the round slider to
        watch Hillis&ndash;Steele fill in the prefixes with stride 1, 2, 4. Switch the
        grammar and watch k move: one string rule takes this toy from 5 to 20, and takes
        the real <code>pareas.lex</code> from 1,927 to 7,952. Under &ldquo;int +
        ws&rdquo; the quote has no rule at all, so the automaton drops into R and the
        reject state absorbs the rest of the input.
      </figcaption>
    </figure>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}
