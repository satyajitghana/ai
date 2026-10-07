// Inline TeX as plain Unicode text, for places that cannot run KaTeX: tile
// titles, the release's one-paragraph summaries, JSON for agents. It covers the
// notation openai/math's catalogue actually uses (Greek, blackboard bold,
// relations, sub- and superscripts, \sqrt, \frac, \mathrm and friends). What it
// cannot set as Unicode it keeps readable: x^{a+b} becomes x^(a+b).

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  rho: "ρ", sigma: "σ", tau: "τ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  le: "≤", leq: "≤", ge: "≥", geq: "≥", lt: "<", gt: ">", ne: "≠", neq: "≠", approx: "≈", sim: "∼", simeq: "≃",
  cong: "≅", equiv: "≡", preceq: "⪯", succeq: "⪰", ll: "≪", gg: "≫", propto: "∝",
  in: "∈", notin: "∉", ni: "∋", subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇", cap: "∩", cup: "∪",
  setminus: "∖", emptyset: "∅", varnothing: "∅", times: "×", otimes: "⊗", oplus: "⊕", rtimes: "⋊", ltimes: "⋉",
  cdot: "·", circ: "∘", pm: "±", mp: "∓", ast: "∗", star: "⋆", wedge: "∧", vee: "∨", neg: "¬",
  to: "→", rightarrow: "→", leftarrow: "←", mapsto: "↦", downarrow: "↓", uparrow: "↑", Rightarrow: "⇒", iff: "⇔",
  infty: "∞", partial: "∂", nabla: "∇", ell: "ℓ", hbar: "ℏ", forall: "∀", exists: "∃", Re: "Re", Im: "Im",
  sum: "∑", prod: "∏", int: "∫", oint: "∮", ldots: "…", cdots: "⋯", dots: "…", mid: "∣", nmid: "∤",
  langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", lVert: "‖", rVert: "‖", Vert: "‖",
  perp: "⊥", parallel: "∥", top: "⊤", bot: "⊥", aleph: "ℵ", angle: "∠", prime: "′",
  log: "log", ln: "ln", exp: "exp", sin: "sin", cos: "cos", tan: "tan", tanh: "tanh", arcsin: "arcsin",
  arccos: "arccos", max: "max", min: "min", sup: "sup", inf: "inf", lim: "lim", det: "det", dim: "dim",
  deg: "deg", ker: "ker", Pr: "Pr", gcd: "gcd", mod: "mod", bmod: "mod",
}
// relations and arrows get a space either side, as TeX sets them
const SPACED = new Set(["≤", "≥", "<", ">", "≠", "≈", "∼", "≃", "≅", "≡", "⪯", "⪰", "≪", "≫", "∝", "∈", "∉", "∋", "⊂", "⊆", "⊃", "⊇", "→", "←", "↦", "⇒", "⇔", "∣", "∤"])
const BB: Record<string, string> = {
  A: "𝔸", B: "𝔹", C: "ℂ", D: "𝔻", E: "𝔼", F: "𝔽", G: "𝔾", H: "ℍ", K: "𝕂", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", S: "𝕊", T: "𝕋", Z: "ℤ",
}
const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", k: "ᵏ", m: "ᵐ", d: "ᵈ", t: "ᵗ", "*": "*", "′": "′",
}
const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", a: "ₐ", e: "ₑ", i: "ᵢ", j: "ⱼ", k: "ₖ", n: "ₙ", p: "ₚ", m: "ₘ", t: "ₜ", x: "ₓ",
}

// the content of a {group} starting at s[i] === "{", and the index after it
function group(s: string, i: number): [string, number] {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++
    else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1]
  }
  return [s.slice(i + 1), s.length]
}
// one argument: a {group}, a \command, or a single character
function arg(s: string, i: number): [string, number] {
  while (s[i] === " ") i++
  if (s[i] === "{") return group(s, i)
  if (s[i] === "\\") {
    const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))
    return m ? [m[0], i + m[0].length] : ["", i + 1]
  }
  return [s[i] ?? "", i + 1]
}

function script(body: string, map: Record<string, string>, mark: "^" | "_"): string {
  const t = texToText(body)
  if ([...t].every((c) => map[c])) return [...t].map((c) => map[c]).join("")
  if (mark === "^" && t === "∗") return "*"
  return [...t].length === 1 ? `${mark}${t}` : `${mark}(${t})`
}

/** Inline TeX (no $ delimiters) as Unicode text. */
export function texToText(tex: string): string {
  let out = ""
  let i = 0
  const s = tex
  while (i < s.length) {
    const c = s[i]
    if (c === "\\") {
      const m = /^\\([A-Za-z]+|.)/.exec(s.slice(i))
      if (!m) {
        i++
        continue
      }
      const name = m[1]
      i += m[0].length
      if (name === "mathbb") {
        const [a, j] = arg(s, i)
        out += [...a].map((ch) => BB[ch] ?? ch).join("")
        i = j
      } else if (["mathrm", "mathsf", "mathcal", "mathbf", "mathit", "mathfrak", "operatorname", "mathop", "text", "textrm", "textit", "mathscr", "boldsymbol"].includes(name)) {
        const [a, j] = arg(s, i)
        out += texToText(a)
        i = j
      } else if (name === "sqrt") {
        const [a, j] = arg(s, i)
        const t = texToText(a)
        out += t.length === 1 ? `√${t}` : `√(${t})`
        i = j
      } else if (["frac", "tfrac", "dfrac"].includes(name)) {
        const [a, j] = arg(s, i)
        const [b, k] = arg(s, j)
        const wrap = (x: string) => (/^[\w′.]+$/u.test(x) ? x : `(${x})`)
        out += `${wrap(texToText(a))}/${wrap(texToText(b))}`
        i = k
      } else if (["overline", "bar"].includes(name)) {
        const [a, j] = arg(s, i)
        out += [...texToText(a)].map((ch) => `${ch}̅`).join("")
        i = j
      } else if (["widehat", "hat"].includes(name)) {
        const [a, j] = arg(s, i)
        out += `${texToText(a)}̂`
        i = j
      } else if (["widetilde", "tilde"].includes(name)) {
        const [a, j] = arg(s, i)
        out += `${texToText(a)}̃`
        i = j
      } else if (name === "not") {
        const [a, j] = arg(s, i)
        const t = texToText(a)
        out += t === "∈" ? "∉" : t === "=" ? "≠" : `${t}̸`
        i = j
      } else if (["left", "right", "big", "Big", "bigl", "bigr", "Bigl", "Bigr", "nolimits", "limits", "displaystyle", "textstyle"].includes(name)) {
        // sizing: drop
      } else if (name === "{" || name === "}") out += name
      else if (name === "|") out += "‖"
      else if (name === "," || name === ";" || name === ":" || name === " ") out += " "
      else if (name === "!") out += ""
      else if (name === "quad" || name === "qquad") out += " "
      else if (SYMBOLS[name] !== undefined) {
        const sym = SYMBOLS[name]
        if (SPACED.has(sym)) {
          out += ` ${sym} `
          continue
        }
        // a named operator before a letter needs its space back: \log n
        out += /^[A-Za-z]{2,}$/.test(sym) && /^\s*[A-Za-z0-9(]/.test(s.slice(i)) ? `${sym} ` : sym
        if (/^[A-Za-z]{2,}$/.test(sym)) while (s[i] === " ") i++
      } else out += name
    } else if (c === "^" || c === "_") {
      const [a, j] = arg(s, i + 1)
      out += script(a, c === "^" ? SUP : SUB, c)
      i = j
    } else if (c === "{" || c === "}") {
      i++
    } else if (c === "~") {
      out += " "
      i++
    } else {
      out += c
      i++
    }
  }
  return out.replace(/\s+/g, " ").trim()
}

/** Text with $…$ (or the release's $`…`$) spans: each span through texToText. */
export function texSpansToText(text: string): string {
  return text
    .replace(/\$`([^`]*)`\$/g, (_, t: string) => texToText(t))
    .replace(/\$([^$]+)\$/g, (_, t: string) => texToText(t))
}
