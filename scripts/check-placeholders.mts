// Catch placeholder tokens that were never substituted before publication.
//
// An article shipped to a live PR with `RUN2_PERMS`, `COMP_MEDIAN`, `SUB_MAX`
// and `DROP_WINNER` sitting in published prose — in the frontmatter description
// and in three body sections — because its author was still running the
// measurements when the sweep commit picked the file up. Every other check was
// happy: the frontmatter validates, the MDX compiles, the math spans are math,
// no asset is missing, no article is an orphan, and nothing is fused at a JSX
// boundary. A page full of placeholder strings is a perfectly valid document.
// It is just not finished, and the reader is the one who finds out.
//
// The hard part is that legitimate ALL_CAPS is everywhere in this corpus:
// `Q4_K_M`, `IQ4_NL`, `MOSTLY_IQ3_S`, `NVFP4`, `F8_E4M3`, `AGENT_BACKEND`,
// `GIT_INDEX_FILE`, `MAP_PRIVATE`, `W_U`, `TEST_CASES`. A shape test alone
// cannot tell `COMP_MEDIAN` from `AGENT_BACKEND` — they are the same shape.
//
// What separates them is that a real identifier is *shown*. Somewhere in this
// corpus the article quotes it in a code fence, puts it in backticks, passes it
// as a JSX attribute or links to it. A placeholder only ever appears in running
// prose, because there is nothing to show — the value does not exist yet. So
// the rule is:
//
//   flag an ALL_CAPS_WITH_UNDERSCORES token that appears in prose and appears
//   in no code context anywhere in the corpus
//
// with three exemptions for name families and notation that are sometimes only
// ever spoken about: a token whose first segment matches one shown in code
// (`MAP_PRIVATE` beside a backticked `MAP_SHARED`), a quantisation or float
// format (`Q4_K_M`, `IQ2_XXS`, `F8_E4M3`), and subscript notation whose every
// segment is a character or two (`W_U`, `L_1`, `K_P`).
//
// Scanned: every `content/**/*.mdx` — frontmatter included, since that is where
// the description lives — and the reader-visible text of every
// `components/articles/**/*.tsx`, which is the other half of a page's prose.
//
// Deliberately narrow. `TODO` is not flagged on its own, because several
// articles are *about* TODO comments in someone else's repository; only a
// `TODO:` with something after it is. Ellipses and `{braces}` are not flagged
// at all: every candidate in this corpus was LaTeX or an SVG style prop, and a
// check inside `pnpm validate` has to be one you believe when it is silent.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// ES2017 target: no dotAll flag and no lookbehind, so ranges are spelled
// `[\s\S]` and escaped delimiters are neutralised before they are matched.
const INLINE_CODE = /(`+)((?:(?!\1)[\s\S])*?)\1/g
const DISPLAY_MATH = /\$\$[\s\S]*?\$\$/g
const INLINE_MATH = /\$[^$\n]*?\$/g
const IMPORT_LINE = /^[ \t]*import[ \t][^\n]*$/gm
const ATTR_DQ = /[A-Za-z_][\w:.-]*[ \t]*=[ \t]*"[^"]*"/g
const ATTR_SQ = /[A-Za-z_][\w:.-]*[ \t]*=[ \t]*'[^']*'/g
const ATTR_EXPR = /[A-Za-z_][\w:.-]*[ \t]*=[ \t]*\{[^{}]*\}/g
const URL = /https?:\/\/[^\s)"'<>]+/g
const LINK_DEST = /\]\([^)\s]*\)/g

// JSX text: everything between a `>` and the next `<`, with no braces in it, so
// an expression container never reads as prose.
const JSX_TEXT = />([^<>{}]{2,})</g
// The props that carry prose to a reader rather than a class name or a role.
const PROSE_PROP =
  /\b(alt|aria-label|caption|label|title|note|what|why|description|summary|text|claim)[ \t]*=[ \t]*\{?"((?:[^"\\]|\\.)*)"/g

const TOKEN = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g

// Left in prose these never mean anything but "not written yet". `TODO` and
// `FIXME` are handled separately, since this corpus discusses them as subject
// matter.
const MARKER = /\b(TBD|TKTK|FILL_?IN|PLACEHOLDER)\b|[Ll]orem ipsum/g
const MARKER_WITH_BODY = /\b(TODO|FIXME|XXX)\b[ \t]*[:(][ \t]*\S+/g

// GGUF/EXL quantisation names and float formats. `Q4_K_M`, `IQ2_XXS`,
// `MOSTLY_IQ3_S`, `DQ4_K_XL`, `F8_E4M3`, `NVFP4_E2M1`.
const QUANT = /^(MOSTLY_)?[A-Z]{0,3}Q\d+(_[A-Z0-9]{1,3})+$/
const FLOAT_FORMAT = /^(B?F|FP|NVFP|MXFP|E)\d+(_[A-Z0-9]{1,5})+$/

function blankOut(text: string, pattern: RegExp): string {
  return text.replace(pattern, (m) => m.replace(/[^\n]/g, " "))
}

// Fenced code, line by line, so an unbalanced backtick inside a fence cannot
// swallow the rest of the file.
function blankFences(src: string): string {
  const out: string[] = []
  let fence: string | null = null
  for (const line of src.split("\n")) {
    const m = /^[ \t]*(`{3,}|~{3,})/.exec(line)
    if (fence !== null) {
      out.push("")
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null
    } else if (m) {
      fence = m[1]
      out.push("")
    } else {
      out.push(line)
    }
  }
  return out.join("\n")
}

// What is left after every code context is blanked: the running prose, with
// line numbers intact.
function mdxProse(src: string): string {
  let s = blankFences(src)
  s = blankOut(s, INLINE_CODE)
  // `\$314` is a literal dollar in prose, not a math delimiter — neutralise the
  // escapes before pairing the rest up.
  s = s.replace(/\\\$/g, "  ")
  s = blankOut(s, DISPLAY_MATH)
  s = blankOut(s, INLINE_MATH)
  s = blankOut(s, IMPORT_LINE)
  s = blankOut(s, ATTR_DQ)
  s = blankOut(s, ATTR_SQ)
  s = blankOut(s, ATTR_EXPR)
  s = blankOut(s, URL)
  s = blankOut(s, LINK_DEST)
  return s
}

// The inverse for a component: keep only what a reader sees — JSX text and the
// props that hold sentences — and blank the code around it.
function tsxProse(src: string): string {
  const keep = new Array<string>(src.length).fill(" ")
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") keep[i] = "\n"
  const reveal = (from: number, to: number) => {
    for (let i = from; i < to; i++) keep[i] = src[i]
  }
  JSX_TEXT.lastIndex = 0
  for (let m = JSX_TEXT.exec(src); m; m = JSX_TEXT.exec(src)) {
    const at = m.index + m[0].indexOf(m[1])
    reveal(at, at + m[1].length)
  }
  PROSE_PROP.lastIndex = 0
  for (let m = PROSE_PROP.exec(src); m; m = PROSE_PROP.exec(src)) {
    const at = m.index + m[0].lastIndexOf(m[2])
    reveal(at, at + m[2].length)
  }
  return keep.join("")
}

function tokensIn(text: string): string[] {
  TOKEN.lastIndex = 0
  const out: string[] = []
  for (let m = TOKEN.exec(text); m; m = TOKEN.exec(text)) out.push(m[0])
  return out
}

function count(list: string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1)
  return m
}

function walk(dir: string, exts: string[]): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, exts))
    else if (exts.some((e) => p.endsWith(e))) out.push(p)
  }
  return out
}

function isNotation(token: string): boolean {
  const segments = token.split("_")
  // `W_U`, `L_1`, `K_P`, `B_H` — a symbol with a subscript, not a name.
  if (segments.every((s) => s.length <= 2)) return true
  return QUANT.test(token) || FLOAT_FORMAT.test(token)
}

function main() {
  const files = [
    ...walk("content", [".mdx", ".md"]).sort(),
    ...walk(join("components", "articles"), [".tsx"]).sort(),
  ]

  const prose = new Map<string, string>()
  // Every token this corpus shows in code somewhere: a name someone can look up.
  const shown = new Set<string>()
  const shownPrefixes = new Set<string>()

  for (const file of files) {
    const src = readFileSync(file, "utf8")
    const p = file.endsWith(".tsx") ? tsxProse(src) : mdxProse(src)
    prose.set(file, p)
    const all = count(tokensIn(src))
    const inProse = count(tokensIn(p))
    for (const [token, n] of all) {
      if (n > (inProse.get(token) ?? 0)) {
        shown.add(token)
        shownPrefixes.add(token.split("_")[0])
      }
    }
  }

  const hits: string[] = []
  for (const file of files) {
    const lines = (prose.get(file) as string).split("\n")
    lines.forEach((line, i) => {
      const at = `${file}:${i + 1}`
      TOKEN.lastIndex = 0
      for (let m = TOKEN.exec(line); m; m = TOKEN.exec(line)) {
        const token = m[0]
        if (shown.has(token)) continue
        if (shownPrefixes.has(token.split("_")[0])) continue
        if (isNotation(token)) continue
        hits.push(`${at}  ${token}`)
      }
      for (const rx of [MARKER, MARKER_WITH_BODY]) {
        rx.lastIndex = 0
        for (let m = rx.exec(line); m; m = rx.exec(line)) hits.push(`${at}  ${m[0]}`)
      }
    })
  }

  if (hits.length) {
    console.error(
      `\n✖ ${hits.length} placeholder token(s) left in published prose.\n` +
        `  These sit outside code, math, attributes and URLs — where a number\n` +
        `  or a name should be. Substitute the real value, or reword the\n` +
        `  sentence so it does not assert a figure that was never measured.\n`,
    )
    for (const h of hits) console.error(`  ${h}`)
    console.error("")
    process.exit(1)
  }

  console.log(`✓ no unsubstituted placeholders (${files.length} files)`)
}

main()
