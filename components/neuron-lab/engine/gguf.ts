// Minimal GGUF v3 reader: header, scalar metadata, tensor table. Only what the engine needs.
import type { ByteSource } from "./types"

export const GGML_F32 = 0
export const GGML_F16 = 1
export const GGML_Q8_0 = 8

export interface GGUFTensor {
  name: string
  dims: number[] // ggml order: dims[0] is the contiguous (fastest) axis
  type: number
  offset: number // absolute byte offset in the file
  bytes: number
}

export interface GGUFHeader {
  version: number
  meta: Record<string, number | string | boolean>
  tensors: Map<string, GGUFTensor>
  dataStart: number
}

const TYPE_SIZE: Record<number, number> = { 0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8 }

function tensorBytes(type: number, n: number): number {
  if (type === GGML_F32) return n * 4
  if (type === GGML_F16) return n * 2
  if (type === GGML_Q8_0) return (n / 32) * 34
  throw new Error(`unsupported ggml tensor type ${type}`)
}

class Reader {
  dv: DataView
  p = 0
  dec = new TextDecoder()
  constructor(private buf: Uint8Array) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  need(n: number) {
    if (this.p + n > this.buf.byteLength) throw new RangeError("gguf header truncated")
  }
  u32() { this.need(4); const v = this.dv.getUint32(this.p, true); this.p += 4; return v }
  u64() { this.need(8); const v = Number(this.dv.getBigUint64(this.p, true)); this.p += 8; return v }
  str() {
    const n = this.u64()
    this.need(n)
    const s = this.dec.decode(this.buf.subarray(this.p, this.p + n))
    this.p += n
    return s
  }
  scalar(t: number): number | string | boolean {
    this.need(TYPE_SIZE[t] ?? 0)
    let v: number | boolean
    switch (t) {
      case 0: v = this.dv.getUint8(this.p); break
      case 1: v = this.dv.getInt8(this.p); break
      case 2: v = this.dv.getUint16(this.p, true); break
      case 3: v = this.dv.getInt16(this.p, true); break
      case 4: v = this.dv.getUint32(this.p, true); break
      case 5: v = this.dv.getInt32(this.p, true); break
      case 6: v = this.dv.getFloat32(this.p, true); break
      case 7: v = this.dv.getUint8(this.p) !== 0; break
      case 10: v = Number(this.dv.getBigUint64(this.p, true)); break
      case 11: v = Number(this.dv.getBigInt64(this.p, true)); break
      case 12: v = this.dv.getFloat64(this.p, true); break
      default: throw new Error(`bad gguf scalar type ${t}`)
    }
    this.p += TYPE_SIZE[t]
    return v
  }
  skipArray() {
    const et = this.u32()
    const n = this.u64()
    if (et === 8) for (let i = 0; i < n; i++) { const l = this.u64(); this.need(l); this.p += l }
    else if (et === 9) throw new Error("nested gguf arrays not supported")
    else { const sz = n * TYPE_SIZE[et]; this.need(sz); this.p += sz }
  }
}

function parse(buf: Uint8Array): GGUFHeader {
  const r = new Reader(buf)
  r.need(4)
  if (r.dec.decode(buf.subarray(0, 4)) !== "GGUF") throw new Error("not a GGUF file")
  r.p = 4
  const version = r.u32()
  const nt = r.u64()
  const nkv = r.u64()
  const meta: GGUFHeader["meta"] = {}
  for (let i = 0; i < nkv; i++) {
    const key = r.str()
    const t = r.u32()
    if (t === 9) r.skipArray()
    else if (t === 8) meta[key] = r.str()
    else meta[key] = r.scalar(t)
  }
  const raw: { name: string; dims: number[]; type: number; off: number }[] = []
  for (let i = 0; i < nt; i++) {
    const name = r.str()
    const nd = r.u32()
    const dims: number[] = []
    for (let d = 0; d < nd; d++) dims.push(r.u64())
    const type = r.u32()
    const off = r.u64()
    raw.push({ name, dims, type, off })
  }
  const align = Number(meta["general.alignment"] ?? 32)
  const dataStart = Math.ceil(r.p / align) * align
  const tensors = new Map<string, GGUFTensor>()
  for (const t of raw) {
    const n = t.dims.reduce((a, b) => a * b, 1)
    tensors.set(t.name, { name: t.name, dims: t.dims, type: t.type, offset: dataStart + t.off, bytes: tensorBytes(t.type, n) })
  }
  return { version, meta, tensors, dataStart }
}

/** Read the header, growing the read window until it parses (the vocab lives in it, ~10 MB). */
export async function readGGUFHeader(src: ByteSource): Promise<GGUFHeader> {
  let n = Math.min(src.size, 4 << 20)
  for (;;) {
    const buf = new Uint8Array(n)
    await src.read(0, buf)
    try {
      return parse(buf)
    } catch (e) {
      if (e instanceof RangeError && n < src.size && n < (96 << 20)) { n = Math.min(src.size, n * 2); continue }
      throw e
    }
  }
}
