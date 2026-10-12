// The truth behind the relay-cabinet figure: a pure module, no DOM.
//
// Block allocation is Table 2 of Jain's S-box paper (the dissection the
// article shows as a figure): Top, MUL1, Inverter and Bottom, with the
// nonlinear blocks as AND + XOR. "XOR" here counts XNORs too, so every row
// sums to the circuit's gate count. Depth and the level of the first AND are
// recounted from the circuit files (Swapnil-jain/gf2m-circuits @ c451bf1:
// prior/SLP_AES_113.json, circuits/sbox110_d38.json, circuits/sbox106_d34.json)
// by the article's own checker, which also confirmed all three compute the
// S-box on all 256 inputs. The 106 in Table 2 is the sweep circuit, 106/34.
//
// The lamps are not looked up from the circuit: the S-box is computed here from
// inversion in GF(2^8) modulo 0x11B and the FIPS-197 affine map, and checked
// against the four published values the article quotes.

export interface Block {
  id: "top" | "mul1" | "inv" | "bottom"
  name: string
  and: number
  does: string
}

export const BLOCKS: Block[] = [
  { id: "top", name: "Top", and: 0, does: "XORs only: the 18 linear forms of the input bits." },
  { id: "mul1", name: "MUL1", and: 9, does: "Multiplies pairs of forms and sums them into the 4-bit norm." },
  { id: "inv", name: "Inverter", and: 5, does: "Inverts the norm in GF(2^4)." },
  { id: "bottom", name: "Bottom", and: 18, does: "Multiplies the inverse back against the 18 forms, then the output layer with the affine map." },
]

export interface CircuitRow {
  key: string
  name: string
  source: string
  gates: number
  depth: number
  firstAnd: number
  // XOR + XNOR per block, in BLOCKS order (Table 2)
  xor: [number, number, number, number]
}

export const ROWS: CircuitRow[] = [
  { key: "113", name: "113 · baseline", source: "Boyar–Peralta, improved by Calik (CMT page)", gates: 113, depth: 27, firstAnd: 4, xor: [23, 16, 14, 28] },
  { key: "110", name: "110 · walk", source: "Jain's walks inside the 113's own representation", gates: 110, depth: 38, firstAnd: 6, xor: [20, 17, 13, 28] },
  { key: "106", name: "106 · sweep", source: "Jain's representation sweep, sbox106_d34", gates: 106, depth: 34, firstAnd: 6, xor: [19, 17, 13, 25] },
]

export const AND_TOTAL = BLOCKS.reduce((sum, block) => sum + block.and, 0)
// Sockets per block: the ANDs plus the most XORs any of the three circuits uses.
export const SOCKETS = BLOCKS.map((block, b) => ({ and: block.and, xor: Math.max(...ROWS.map((row) => row.xor[b]!)) }))
export const DIAL_LEVELS = 40

for (const row of ROWS) {
  const total = row.xor.reduce((sum, n) => sum + n, AND_TOTAL)
  if (total !== row.gates) throw new Error(`relay cabinet: ${row.key} blocks sum to ${total}`)
  if (row.depth > DIAL_LEVELS) throw new Error(`relay cabinet: ${row.key} depth past the dial`)
}
if (AND_TOTAL !== 32) throw new Error("relay cabinet: the skeleton has 32 ANDs")

function gmul(a: number, b: number) {
  let r = 0
  let x = a
  let y = b
  while (y) {
    if (y & 1) r ^= x
    x <<= 1
    if (x & 0x100) x ^= 0x11b
    y >>= 1
  }
  return r & 0xff
}

export function sbox(x: number) {
  let inv = 0
  if (x) for (let y = 1; y < 256; y++) if (gmul(x, y) === 1) { inv = y; break }
  let out = 0
  for (let i = 0; i < 8; i++) {
    const bit = ((inv >> i) ^ (inv >> ((i + 4) % 8)) ^ (inv >> ((i + 5) % 8)) ^ (inv >> ((i + 6) % 8)) ^ (inv >> ((i + 7) % 8)) ^ (0x63 >> i)) & 1
    out |= bit << i
  }
  return out
}

// The four inputs whose S-box values the article prints (FIPS-197).
export const INPUTS = [0x53, 0x00, 0x01, 0xff]
const PUBLISHED: Record<number, number> = { 0x00: 0x63, 0x01: 0x7c, 0x53: 0xed, 0xff: 0x16 }
for (const x of INPUTS) if (sbox(x) !== PUBLISHED[x]) throw new Error(`relay cabinet: S(${x}) is wrong`)

export const hex = (v: number) => "0x" + v.toString(16).toUpperCase().padStart(2, "0")
// Bit i of the byte, MSB first: lever and lamp 0 are bit 7, as U0 and S0 are.
export const bitOf = (v: number, i: number) => (v >> (7 - i)) & 1

// The signal ripples through one gate level per tick of the dial.
export const LEVEL_SECONDS = 0.045
