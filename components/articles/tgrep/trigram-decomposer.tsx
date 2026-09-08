"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Reimplements, for demonstration, the trigram-planning rules in
// tgrep-core/src/query.rs (decompose_hir, literals_to_query_plan,
// relax_for_indexing) and the sliding-window extractor in
// tgrep-core/src/trigram.rs (extract). Every rule below was checked against
// the real crates, not guessed:
//   - literals_to_query_plan bails to MatchAll below 3 bytes.
//   - decompose_hir's Concat arm accumulates literal text and FLUSHES it
//     (independently trigram-checked) at every non-literal child — a class,
//     wildcard, or optional element skips itself without poisoning literal
//     text elsewhere in the same concat.
//   - decompose_hir's Alternation arm is NOT forgiving: if any branch is
//     MatchAll, the whole OR reverts to a full scan, even when every other
//     branch has a perfectly good literal.
//   - Repetition with min == 0 (an optional element) is MatchAll for that
//     node, matching ripgrep/regex-syntax semantics.
//   - relax_for_indexing (used only under -P/--pcre2, per
//     tgrep-cli/src/search.rs's `matcher.is_standard()` branch) deletes
//     lookaround text outright and re-parses what's left, but returns None
//     (== MatchAll) the moment it sees a backreference, \K, \G, or a
//     conditional, because widening those could drop a real match.
//   - Under the DEFAULT engine, lookaround isn't relaxed at all — regex-syntax
//     rejects it as a parse error before query planning ever runs.
//   - Inline `(?i)` is its own trap, independently verified against
//     regex-syntax 0.8.11: `regex_syntax::parse("(?i)hello")` returns
//     Concat([Class('Hh'), Class('Ee'), Class('Ll'), Class('Ll'), Class('Oo')])
//     — every letter becomes a one-off character class, never a Literal — so
//     decompose_hir's Class arm (MatchAll) swallows it whole. Only non-letter
//     bytes in a `(?i)`-prefixed pattern survive as literal text; verified
//     the same way: `(?i)v1_2` parses to Concat([Class('Vv'), Literal("1_2")]).
//     tgrep's own `-i`/`-S` flags dodge this because the CLI lowercases the
//     pattern STRING before it ever reaches regex-syntax, so it stays a
//     Literal — two spellings of "case-insensitive", only one of them indexed.
//
// Regex verification against the demo files below runs on a REAL JS RegExp
// (lookbehind, backreferences and `i` all work natively), so "candidate but
// rejected on verification" isn't scripted — it's whatever the browser's own
// engine decides, exactly mirroring tgrep's own "narrow with trigrams, then
// verify with the real regex engine" pipeline.

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const NEUTRAL = "oklch(0.62 0.03 250)"
const ACCENT = "oklch(0.60 0.15 255)"

type Engine = "default" | "pcre2"

type Run = { text: string; trigrams: string[] }
type Branch = { raw: string; runs: Run[]; skipped: string[]; indexed: boolean }

function extractTrigrams(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (let i = 0; i + 3 <= text.length; i++) {
    const t = text.slice(i, i + 3)
    if (!seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

function findMatchingParen(s: string, open: number): number {
  let depth = 0
  for (let k = open; k < s.length; k++) {
    if (s[k] === "\\") {
      k++
      continue
    }
    if (s[k] === "(") depth++
    else if (s[k] === ")") {
      depth--
      if (depth === 0) return k
    }
  }
  return s.length - 1
}

function consumeQuantifier(s: string, j: number): { j: number; optional: boolean; label: string } {
  if (s[j] === "?" || s[j] === "*") return { j: j + 1, optional: true, label: s[j] }
  if (s[j] === "+") return { j: j + 1, optional: false, label: "+" }
  if (s[j] === "{") {
    const m = /^\{(\d+)(,(\d+)?)?\}/.exec(s.slice(j))
    if (m) return { j: j + m[0].length, optional: Number(m[1]) === 0, label: m[0] }
  }
  return { j, optional: false, label: "" }
}

// A simplified, single-branch reimplementation of decompose_hir's Concat
// handling: literal text accumulates until a class/wildcard/optional/group
// boundary flushes it as its own independently-checked run.
function analyzeBranch(raw: string): Branch {
  let ci = false
  let s = raw
  if (s.startsWith("(?i)")) {
    ci = true
    s = s.slice(4)
  }
  const runs: Run[] = []
  const skipped: string[] = []
  let cur = ""
  const flush = () => {
    if (cur.length >= 3) runs.push({ text: cur, trigrams: extractTrigrams(cur) })
    else if (cur.length > 0) skipped.push(`"${cur}" — only ${cur.length} byte${cur.length === 1 ? "" : "s"}, needs 3`)
    cur = ""
  }

  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === "[") {
      let j = i + 1
      if (s[j] === "^") j++
      if (s[j] === "]") j++
      while (j < s.length && s[j] !== "]") j++
      j = Math.min(j + 1, s.length)
      const q = consumeQuantifier(s, j)
      flush()
      skipped.push(`${s.slice(i, j)}${q.label} — character class`)
      i = q.j
      continue
    }
    if (c === "\\" && "dDwWsS".includes(s[i + 1] ?? "")) {
      const q = consumeQuantifier(s, i + 2)
      flush()
      skipped.push(`\\${s[i + 1]}${q.label} — character class`)
      i = q.j
      continue
    }
    if (c === "\\") {
      const ch = s[i + 1] ?? ""
      const q = consumeQuantifier(s, i + 2)
      if (q.optional) {
        flush()
        skipped.push(`${ch}${q.label} — optional`)
      } else {
        cur += ch
      }
      i = q.j
      continue
    }
    if (c === ".") {
      const q = consumeQuantifier(s, i + 1)
      flush()
      skipped.push(`.${q.label} — wildcard`)
      i = q.j
      continue
    }
    if (c === "(") {
      const close = findMatchingParen(s, i)
      let content = s.slice(i + 1, close)
      content = content.replace(/^\?:/, "").replace(/^\?P?<[^>]*>/, "")
      const q = consumeQuantifier(s, close + 1)
      flush()
      if (q.optional) {
        skipped.push(`(${content})${q.label} — optional group`)
      } else {
        const sub = analyzeBranch(content)
        runs.push(...sub.runs)
        skipped.push(...sub.skipped)
      }
      i = q.j
      continue
    }
    const q = consumeQuantifier(s, i + 1)
    if (q.optional) {
      flush()
      skipped.push(`${c}${q.label} — optional`)
    } else if (ci && /[a-zA-Z]/.test(c)) {
      flush()
      skipped.push(`${c} — case-folded to a class by (?i)`)
    } else {
      cur += c
    }
    i = q.j
  }
  flush()
  return { raw, runs, skipped, indexed: runs.length > 0 }
}

function splitTopLevelAlternation(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (c === "\\") {
      k++
      continue
    }
    if (c === "(" || c === "[") depth++
    else if (c === ")" || c === "]") depth = Math.max(0, depth - 1)
    else if (c === "|" && depth === 0) {
      parts.push(s.slice(start, k))
      start = k + 1
    }
  }
  parts.push(s.slice(start))
  return parts
}

function stripLookarounds(s: string): string {
  let out = s
  const re = /\(\?<?[=!]/
  let guard = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(out)) && guard++ < 20) {
    const close = findMatchingParen(out, m.index)
    out = out.slice(0, m.index) + out.slice(close + 1)
  }
  return out
}

const LOOKAROUND_RE = /\(\?<?[=!]/
const UNRELAXABLE_RE = /\\[1-9]|\\k<|\\g<|\\K|\\G|\(\?\(/

type Verdict =
  | { kind: "parse_error" }
  | { kind: "unrelaxable" }
  | { kind: "plan"; branches: Branch[]; indexed: boolean; relaxedFrom: string | null }

function classify(pattern: string, engine: Engine): Verdict {
  const hasLookaround = LOOKAROUND_RE.test(pattern)
  if (engine === "default" && hasLookaround) return { kind: "parse_error" }

  let working = pattern
  let relaxedFrom: string | null = null
  if (engine === "pcre2") {
    if (UNRELAXABLE_RE.test(pattern)) return { kind: "unrelaxable" }
    if (hasLookaround) {
      working = stripLookarounds(pattern)
      relaxedFrom = pattern
    }
  } else if (UNRELAXABLE_RE.test(pattern) && !hasLookaround) {
    // Backreferences aren't valid syntax for the default `regex` crate at
    // all (it has none — that's a design choice, not an omission), so this
    // is a parse error there too, same bucket as lookaround.
    return { kind: "parse_error" }
  }

  const branches = splitTopLevelAlternation(working).map(analyzeBranch)
  const indexed = branches.every((b) => b.indexed)
  return { kind: "plan", branches, indexed, relaxedFrom }
}

// --- demo corpus -----------------------------------------------------------

const FILES = [
  { name: "lock.rs", line: 'pub fn acquire(&self) { mutex_lock(&self.inner); }' },
  { name: "queue.rs", line: "// TODO: revisit backoff before this ships" },
  { name: "retry.rs", line: '// FIXME: retry storm — a horror story in the logs' },
  { name: "auth.rs", line: 'let id = ExchangePrincipal::from(v1_2_migration_flag);' },
  { name: "bench.rs", line: "// most benchmarks here are just noise, .* everywhere in comments" },
  { name: "README.md", line: "This crate has no relation to any of the above." },
]

function fileTrigramSet(content: string): Set<string> {
  return new Set(extractTrigrams(content))
}

type FileState = "confirmed" | "false_positive" | "excluded" | "scanned_match" | "scanned_no_match" | "unverifiable"

function toJsRegex(pattern: string): { source: string; flags: string } | null {
  let flags = ""
  let src = pattern
  const ci = src.match(/^\(\?i\)/)
  if (ci) {
    flags = "i"
    src = src.slice(ci[0].length)
  }
  try {
    new RegExp(src, flags)
    return { source: src, flags }
  } catch {
    return null
  }
}

const PRESETS = [
  { label: "plain literal", pattern: "mutex_lock", engine: "default" as Engine },
  { label: "too short", pattern: "fn", engine: "default" as Engine },
  { label: "class + literal", pattern: "[Ee]rror", engine: "default" as Engine },
  { label: "inline (?i)", pattern: "(?i)v1_2", engine: "default" as Engine },
  { label: "alternation, one bad branch", pattern: "TODO|FIXME|.*", engine: "default" as Engine },
  { label: "wholly optional", pattern: "(?:TODO)?", engine: "default" as Engine },
  { label: "lookbehind", pattern: "(?<!//)ExchangePrincipal", engine: "default" as Engine },
  { label: "backreference", pattern: "(mutex)_\\1", engine: "pcre2" as Engine },
]

export function TrigramDecomposer() {
  const [pattern, setPattern] = useState(PRESETS[0].pattern)
  const [engine, setEngine] = useState<Engine>("default")

  const verdict = useMemo(() => classify(pattern, engine), [pattern, engine])
  const compiled = useMemo(() => toJsRegex(pattern), [pattern])

  const branchTrigramSets = useMemo(() => {
    if (verdict.kind !== "plan") return []
    return verdict.branches.map((b) => new Set(b.runs.flatMap((r) => r.trigrams)))
  }, [verdict])

  const fileStates = useMemo(() => {
    return FILES.map((f): FileState => {
      const isMatch = compiled ? new RegExp(compiled.source, compiled.flags).test(f.line) : null
      if (verdict.kind !== "plan" || !verdict.indexed) {
        // Full scan: the index provides no filter, every file is regex-tested directly.
        if (isMatch === null) return "unverifiable"
        return isMatch ? "scanned_match" : "scanned_no_match"
      }
      const trigrams = fileTrigramSet(f.line)
      const isCandidate = branchTrigramSets.some((set) => set.size > 0 && [...set].every((t) => trigrams.has(t)))
      if (!isCandidate) return "excluded"
      if (isMatch === null) return "unverifiable"
      return isMatch ? "confirmed" : "false_positive"
    })
  }, [verdict, branchTrigramSets, compiled])

  const overallLabel =
    verdict.kind === "parse_error"
      ? "compile error"
      : verdict.kind === "unrelaxable"
        ? "full scan — unrelaxable"
        : verdict.indexed
          ? verdict.branches.length > 1
            ? "indexed — OR of branches"
            : "indexed"
          : verdict.branches.length > 1
            ? "full scan — one branch poisoned it"
            : "full scan"

  const overallGood = verdict.kind === "plan" && verdict.indexed

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">regex → trigram query plan · tgrep-core/src/query.rs</span>
        <div className="flex gap-1.5">
          {(["default", "pcre2"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEngine(e)}
              aria-pressed={engine === e}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                engine === e
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {e === "default" ? "default engine" : "-P (relaxed)"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.pattern}
              type="button"
              onClick={() => {
                setPattern(p.pattern)
                setEngine(p.engine)
              }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pattern === p.pattern
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="sr-only">regex pattern</span>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-foreground/40"
          />
        </label>

        {verdict.kind === "parse_error" && (
          <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: `color-mix(in oklch, ${BAD} 40%, var(--border))`, background: `color-mix(in oklch, ${BAD} 6%, transparent)` }}>
            <div className="font-mono text-[11px] font-semibold" style={{ color: BAD }}>
              parse error — not a query-planning question
            </div>
            <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
              Lookaround isn&rsquo;t valid syntax for the default <code>regex</code> engine at all, so this never
              reaches the trigram planner — tgrep exits 2, same as ripgrep would on this pattern. Switch to{" "}
              <span className="text-foreground">-P (relaxed)</span> to see what tgrep&rsquo;s PCRE-style relaxer can
              recover.
            </p>
          </div>
        )}

        {verdict.kind === "unrelaxable" && (
          <div className="mt-3 rounded-lg border px-3 py-2.5" style={{ borderColor: `color-mix(in oklch, ${BAD} 40%, var(--border))`, background: `color-mix(in oklch, ${BAD} 6%, transparent)` }}>
            <div className="font-mono text-[11px] font-semibold" style={{ color: BAD }}>
              full scan — even -P gives up
            </div>
            <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
              Backreferences, <code>\K</code>, <code>\G</code>, and conditionals can&rsquo;t be safely widened into
              anything the index understands — the relaxer bails to <code>None</code> the moment it sees one,{" "}
              <em>even when the rest of the pattern is a clean literal</em>. Every file gets scanned so no real match
              can be silently dropped.
            </p>
          </div>
        )}

        {verdict.kind === "plan" && (
          <div className="mt-3 space-y-2.5">
            {verdict.relaxedFrom && (
              <div className="font-mono text-[10.5px] text-muted-foreground">
                relaxed for indexing: <span className="text-foreground">&ldquo;{verdict.relaxedFrom}&rdquo;</span> →{" "}
                <span className="text-foreground">&ldquo;{splitTopLevelAlternation(stripLookarounds(pattern)).join("|")}&rdquo;</span>
              </div>
            )}
            {verdict.branches.map((b, bi) => (
              <div key={bi} className="rounded-lg border bg-muted/10 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground">
                    {verdict.branches.length > 1 ? `branch ${bi + 1}: ` : ""}
                    <span className="text-muted-foreground">&ldquo;{b.raw}&rdquo;</span>
                  </span>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9.5px]"
                    style={
                      b.indexed
                        ? { color: GOOD, background: `color-mix(in oklch, ${GOOD} 14%, transparent)` }
                        : { color: BAD, background: `color-mix(in oklch, ${BAD} 14%, transparent)` }
                    }
                  >
                    {b.indexed ? `${b.runs.reduce((n, r) => n + r.trigrams.length, 0)} trigram(s)` : "no trigrams"}
                  </span>
                </div>

                {b.runs.map((r, ri) => (
                  <div key={ri} className="mt-2 overflow-x-auto">
                    <TrigramWindows text={r.text} />
                  </div>
                ))}

                {b.skipped.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.skipped.map((s, si) => (
                      <span
                        key={si}
                        className="rounded-full border px-2 py-0.5 font-mono text-[9.5px] text-muted-foreground"
                        style={{ borderColor: "var(--border)" }}
                      >
                        skipped: {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div
          className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2"
          style={
            overallGood
              ? { borderColor: `color-mix(in oklch, ${GOOD} 35%, var(--border))`, background: `color-mix(in oklch, ${GOOD} 6%, transparent)` }
              : { borderColor: `color-mix(in oklch, ${BAD} 35%, var(--border))`, background: `color-mix(in oklch, ${BAD} 6%, transparent)` }
          }
        >
          <span className="font-mono text-[11px] font-semibold" style={{ color: overallGood ? GOOD : BAD }}>
            {overallLabel}
          </span>
          {verdict.kind === "plan" && verdict.branches.length > 1 && !verdict.indexed && (
            <span className="text-[11.5px] text-muted-foreground">
              — {verdict.branches.find((b) => !b.indexed)?.raw ? `"${verdict.branches.find((b) => !b.indexed)!.raw}"` : "one branch"} has no
              usable trigrams, so the OR falls back to scanning every candidate file for <em>every</em> branch.
            </span>
          )}
        </div>

        <div className="mt-3 rounded-lg border">
          <div className="border-b bg-muted/20 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
            six-file demo repo · trigram filter, then real regex verification
          </div>
          <div className="divide-y">
            {FILES.map((f, i) => {
              const state = fileStates[i]
              const meta: Record<FileState, { label: string; color: string; icon: string }> = {
                confirmed: { label: "match", color: GOOD, icon: "✓" },
                false_positive: { label: "filtered by verification", color: NEUTRAL, icon: "✗" },
                excluded: { label: "excluded by index", color: NEUTRAL, icon: "–" },
                scanned_match: { label: "match (full scan)", color: GOOD, icon: "✓" },
                scanned_no_match: { label: "no match (full scan)", color: NEUTRAL, icon: "–" },
                unverifiable: { label: "n/a", color: NEUTRAL, icon: "?" },
              }
              const m = meta[state]
              return (
                <div key={f.name} className="flex items-start gap-2.5 px-3 py-2">
                  <span className="mt-0.5 w-4 shrink-0 text-center font-mono text-[11px]" style={{ color: m.color }}>
                    {m.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px] text-foreground">{f.name}</span>
                      <span className="font-mono text-[9.5px]" style={{ color: m.color }}>
                        {m.label}
                      </span>
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-muted-foreground">{f.line}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The index only ever <span style={{ color: NEUTRAL }}>excludes</span> — a file missing a required trigram
          truly cannot match, so it&rsquo;s dropped before any regex runs. It never confirms: <code>retry.rs</code>{" "}
          really does contain the substring <code>rror</code> (inside &ldquo;horror&rdquo;), so{" "}
          <code>[Ee]rror</code> survives the trigram filter honestly — and then fails the real regex check, because
          the character right before <code>rror</code> is &lsquo;o&rsquo;, not E or e. That two-stage shape —{" "}
          <span style={{ color: ACCENT }}>narrow with trigrams</span>, then{" "}
          <span className="text-foreground">verify with the real engine</span> — is why the index can never produce
          a false negative, only a wasted verification on a false positive. And every degradation above is the same
          shape from the other side: a class, an optional element, a bad alternation branch, or an unrelaxable{" "}
          <code>-P</code> construct just means that specific run of bytes never had 3 literal bytes to hash in the
          first place, so tgrep falls back to exactly what ripgrep always does — scan and verify everything.
        </p>
      </div>
    </figure>
  )
}

function TrigramWindows({ text }: { text: string }) {
  const CW = 20
  const CH = 24
  const ROWH = 15
  const chars = text.split("")
  const winCount = Math.max(0, chars.length - 2)
  const shown = Math.min(winCount, 14)
  const padTop = CH + 12
  const gridW = 12 + chars.length * CW
  const labelW = 64
  const W = Math.max(gridW, 12 + 3 * CW + labelW)
  const H = padTop + Math.max(shown, 1) * ROWH + (winCount > shown ? 14 : 4)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`sliding 3-byte trigram windows over "${text}"`}>
      {chars.map((ch, idx) => (
        <g key={idx}>
          <rect x={10 + idx * CW} y={2} width={CW - 3} height={CH} rx={4} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
          <text x={10 + idx * CW + (CW - 3) / 2} y={2 + CH / 2 + 4} textAnchor="middle" fontSize={11.5} className="fill-foreground font-mono">
            {ch}
          </text>
        </g>
      ))}
      {Array.from({ length: shown }, (_, i) => i).map((i) => {
        const x1 = 10 + i * CW
        const barW = 3 * CW - 5
        const y = padTop + i * ROWH
        return (
          <g key={i}>
            <rect x={x1} y={y} width={barW} height={ROWH - 4} rx={3} fill={ACCENT} opacity={0.14} stroke={ACCENT} strokeOpacity={0.55} strokeWidth={1} />
            <text x={x1 + barW + 6} y={y + (ROWH - 4) / 2 + 3.5} fontSize={10} className="fill-muted-foreground font-mono">
              {text.slice(i, i + 3)}
            </text>
          </g>
        )
      })}
      {winCount > shown && (
        <text x={10} y={padTop + shown * ROWH + 11} fontSize={9.5} className="fill-muted-foreground font-mono">
          +{winCount - shown} more window{winCount - shown === 1 ? "" : "s"}
        </text>
      )}
    </svg>
  )
}
