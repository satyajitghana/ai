// Byte-level BPE tokenizer for Qwen3, built from the model's own tokenizer.json (fetched from
// Hugging Face at runtime). Mirrors the HF `tokenizers` pipeline: split on added tokens, NFC,
// Split(regex, Isolated), ByteLevel, BPE by merge rank.

interface AddedToken { id: number; content: string; special: boolean }
interface TokenizerJSON {
  added_tokens: AddedToken[]
  normalizer?: { type: string } | null
  pre_tokenizer: { pretokenizers: { type: string; pattern?: { Regex: string } }[] }
  model: { vocab: Record<string, number>; merges: (string | [string, string])[] }
}

function bytesToUnicode(): { enc: string[]; dec: Map<string, number> } {
  const bs: number[] = []
  for (let i = 33; i <= 126; i++) bs.push(i)
  for (let i = 161; i <= 172; i++) bs.push(i)
  for (let i = 174; i <= 255; i++) bs.push(i)
  const cs = bs.slice()
  let n = 0
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++ }
  const enc: string[] = new Array(256)
  const dec = new Map<string, number>()
  bs.forEach((b, i) => { enc[b] = String.fromCharCode(cs[i]); dec.set(String.fromCharCode(cs[i]), b) })
  return { enc, dec }
}

/** `(?i:a|b)` needs a recent V8; expand it into explicit case classes so any browser can run it. */
function portableRegex(src: string): RegExp {
  const expanded = src.replace(/\(\?i:([^()]*)\)/g, (_m, body: string) => {
    const ci = body.replace(/[A-Za-z]/g, (c) => `[${c.toLowerCase()}${c.toUpperCase()}]`)
    return `(?:${ci})`
  })
  return new RegExp(expanded, "gu")
}

export class Tokenizer {
  private vocab: Map<string, number>
  private idToTok: string[]
  private ranks = new Map<string, number>()
  private added: AddedToken[]
  private addedRe: RegExp | null
  private pre: RegExp
  private byteEnc: string[]
  private byteDec: Map<string, number>
  private cache = new Map<string, number[]>()
  private nfc: boolean
  private enc = new TextEncoder()
  private addedIds = new Set<number>()
  readonly specialIds = new Set<number>()
  readonly vocabSize: number

  constructor(json: TokenizerJSON) {
    this.vocab = new Map(Object.entries(json.model.vocab))
    this.added = json.added_tokens
    let max = 0
    for (const id of this.vocab.values()) if (id > max) max = id
    for (const a of this.added) { if (a.id > max) max = a.id; this.addedIds.add(a.id); if (a.special) this.specialIds.add(a.id) }
    this.vocabSize = max + 1
    this.idToTok = new Array(this.vocabSize)
    for (const [t, id] of this.vocab) this.idToTok[id] = t
    for (const a of this.added) this.idToTok[a.id] = a.content
    json.model.merges.forEach((m, i) => {
      const [a, b] = typeof m === "string" ? m.split(" ") : m
      this.ranks.set(a + " " + b, i)
    })
    const bu = bytesToUnicode()
    this.byteEnc = bu.enc
    this.byteDec = bu.dec
    this.nfc = json.normalizer?.type === "NFC"
    const split = json.pre_tokenizer.pretokenizers.find((p) => p.type === "Split")
    this.pre = portableRegex(split!.pattern!.Regex)
    const escaped = [...this.added].sort((a, b) => b.content.length - a.content.length)
      .map((a) => a.content.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    this.addedRe = escaped.length ? new RegExp(`(${escaped.join("|")})`, "g") : null
  }

  private bpe(word: string): number[] {
    const hit = this.cache.get(word)
    if (hit) return hit
    let syms = Array.from(word)
    while (syms.length > 1) {
      let best = Infinity, bi = -1
      for (let i = 0; i < syms.length - 1; i++) {
        const r = this.ranks.get(syms[i] + " " + syms[i + 1])
        if (r !== undefined && r < best) { best = r; bi = i }
      }
      if (bi < 0) break
      const a = syms[bi], b = syms[bi + 1]
      const out: string[] = []
      for (let i = 0; i < syms.length; i++) {
        if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) { out.push(a + b); i++ } else out.push(syms[i])
      }
      syms = out
    }
    const ids = syms.map((s) => {
      const id = this.vocab.get(s)
      if (id === undefined) throw new Error(`token not in vocab: ${JSON.stringify(s)}`)
      return id
    })
    if (this.cache.size < 50000) this.cache.set(word, ids)
    return ids
  }

  private encodePlain(text: string, out: number[]) {
    if (!text) return
    if (this.nfc) text = text.normalize("NFC")
    this.pre.lastIndex = 0
    let last = 0
    const pieces: string[] = []
    for (const m of text.matchAll(this.pre)) {
      if (m.index! > last) pieces.push(text.slice(last, m.index))
      pieces.push(m[0])
      last = m.index! + m[0].length
    }
    if (last < text.length) pieces.push(text.slice(last))
    for (const p of pieces) {
      let w = ""
      for (const b of this.enc.encode(p)) w += this.byteEnc[b]
      for (const id of this.bpe(w)) out.push(id)
    }
  }

  encode(text: string): number[] {
    const out: number[] = []
    if (!this.addedRe) { this.encodePlain(text, out); return out }
    const parts = text.split(this.addedRe)
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 1) out.push(this.added.find((a) => a.content === parts[i])!.id)
      else this.encodePlain(parts[i], out)
    }
    return out
  }

  /** Raw bytes of one token (special tokens are their UTF-8 text). */
  tokenBytes(id: number): Uint8Array {
    const s = this.idToTok[id]
    if (s === undefined) return new Uint8Array(0)
    if (this.addedIds.has(id)) return this.enc.encode(s)
    const out = new Uint8Array(s.length)
    let n = 0
    for (const ch of s) { const b = this.byteDec.get(ch); if (b !== undefined) out[n++] = b }
    return out.subarray(0, n)
  }

  decode(ids: number[]): string {
    const parts = ids.map((i) => this.tokenBytes(i))
    const total = parts.reduce((a, p) => a + p.length, 0)
    const buf = new Uint8Array(total)
    let o = 0
    for (const p of parts) { buf.set(p, o); o += p.length }
    return new TextDecoder().decode(buf)
  }

  /** Display string of one token for UIs: the token's own bytes decoded leniently. */
  display(id: number): string {
    return new TextDecoder().decode(this.tokenBytes(id))
  }
}
