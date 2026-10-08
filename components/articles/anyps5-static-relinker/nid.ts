// The PS5 NID, computed the way AnyPS5's nid_patcher does it (core/libs/nid/src/NidCompute.cpp:8-51):
// SHA-1 over the symbol name followed by a fixed 16-byte suffix, the first 8 digest bytes read
// little-endian, and those 64 bits written as 11 characters of a base64 alphabet that uses + and -.
// Checked against shadPS4's LIB_FUNCTION tables for sceKernelUsleep, sceVideoOutOpen, scePadRead and
// sceKernelAllocateDirectMemory, and against the TLS resolver NID the relinker hard-codes.

export const NID_SUFFIX = [
  0x51, 0x8d, 0x64, 0xa6, 0x35, 0xde, 0xd8, 0xc1, 0xe6, 0xb0, 0x39, 0xb1, 0xc3, 0xe5, 0x52, 0x30,
]

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-"

function rotl(x: number, n: number) {
  return ((x << n) | (x >>> (32 - n))) >>> 0
}

export function sha1(bytes: number[]): number[] {
  const ml = bytes.length
  const msg = bytes.slice()
  msg.push(0x80)
  while (msg.length % 64 !== 56) msg.push(0)
  const bits = ml * 8
  const hi = (bits / 0x100000000) >>> 0
  const lo = bits >>> 0
  msg.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255)
  msg.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255)
  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0
  const w = new Array<number>(80)
  for (let off = 0; off < msg.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = ((msg[off + 4 * i] << 24) | (msg[off + 4 * i + 1] << 16) | (msg[off + 4 * i + 2] << 8) | msg[off + 4 * i + 3]) >>> 0
    }
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1)
    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4
    for (let i = 0; i < 80; i++) {
      let f: number
      let k: number
      if (i < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (i < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const t = (rotl(a, 5) + (f >>> 0) + e + k + w[i]) >>> 0
      e = d
      d = c
      c = rotl(b, 30)
      b = a
      a = t
    }
    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }
  const out: number[] = []
  for (const h of [h0, h1, h2, h3, h4]) out.push((h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255)
  return out
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

export type NidTrace = { digest: number[]; reversed: number[]; nid: string }

export function computeNid(name: string): NidTrace {
  const digest = sha1([...utf8(name), ...NID_SUFFIX])
  const reversed = digest.slice(0, 8).reverse()
  // 64 bits as 11 six-bit digits: the last digit carries the final 4 bits padded with two zeros.
  const bits = reversed.map((b) => b.toString(2).padStart(8, "0")).join("") + "00"
  let nid = ""
  for (let i = 0; i < 11; i++) nid += ALPHABET[parseInt(bits.slice(6 * i, 6 * i + 6), 2)]
  return { digest, reversed, nid }
}

export function hex(bytes: number[]) {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ")
}
