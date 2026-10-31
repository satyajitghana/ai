/* eslint-disable @typescript-eslint/no-explicit-any */
// WebGPU decode path: runs one token per step entirely on the GPU (weights stay Q8_0, activations fp32), for
// both architectures the engine supports. The CPU path (core.ts) stays the reference and the default:
// this one is opt-in and is checked against it (scripts/neuron-lab/webgpu-test.mts).
//
// A step uploads the new token's embedding row (4 KB), runs ~15 dispatches per layer in one compute pass and,
// when logits are wanted, reads back the vocabulary row (1 MB). Prompt tokens go through the same step one at
// a time. Steering hooks are two tiny dispatches per layer (multiply, then add) on the MLP hidden activation.
import type { Qwen3Core, Q8 } from "./core"
import { ATTN, CONV_SILU, DELTA, HOOK, KV_STORE, MATVEC, RMSNORM, ROPE_Q, SILU_MUL } from "./gpu-kernels"

const USAGE = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, STORAGE: 128 }
const bits = (f: number) => new Uint32Array(new Float32Array([f]).buffer)[0]
type Op = (pass: any) => void
type LayerDeltas = { n: Int32Array; d: Float32Array; mn?: Int32Array; mf?: Float32Array }

interface WBuf { w: any; ws: any; rows: number; k: number }
interface Hooks { mulIdx: any; mulVal: any; addIdx: any; addVal: any; mulP: any[]; addP: any[]; mulN: number[]; addN: number[] }

export interface GpuStream {
  kc: any[]; vc: any[]; conv: any[]; rec: any[]
  hooks: Hooks
  prog: Op[]
  logitsProg: Op[]
  pos: number
  cap: number
}

export class GpuBackend {
  readonly info: { vendor: string; architecture: string; description: string; fallback: boolean; maxBinding: number }
  private pipes: Record<string, any> = {}
  private w = new Map<Q8, WBuf[]>()
  private norms: any[] = []
  private ffnNorms: any[] = []
  private lin: ({ conv: any; cst: any } | null)[] = []
  private qk: ({ q: any; k: any } | null)[] = []
  private outNorm: any
  private inv: any
  private buf: Record<string, any> = {}
  private dyn: any
  private tmp: Float32Array
  private embChunks: WBuf[] = []

  private constructor(private device: any, private core: Qwen3Core, info: GpuBackend["info"]) {
    this.info = info
    this.tmp = new Float32Array(core.hidden)
  }

  static get available(): boolean { return typeof navigator !== "undefined" && "gpu" in navigator }

  static async create(core: Qwen3Core, onProgress?: (frac: number, msg: string) => void): Promise<GpuBackend | null> {
    if (!GpuBackend.available) return null
    const gpu = (navigator as any).gpu
    const adapter = await gpu.requestAdapter()
    if (!adapter) return null
    const lim = adapter.limits
    const device = await adapter.requestDevice({ requiredLimits: { maxStorageBufferBindingSize: lim.maxStorageBufferBindingSize, maxBufferSize: lim.maxBufferSize } })
    const ai = adapter.info ?? {}
    const g = new GpuBackend(device, core, { vendor: ai.vendor ?? "", architecture: ai.architecture ?? "", description: ai.description ?? "", fallback: !!adapter.isFallbackAdapter, maxBinding: device.limits.maxStorageBufferBindingSize })
    await g.init(onProgress)
    return g
  }

  destroy() { try { this.device.destroy() } catch { /* already gone */ } }

  // ---------------------------------------------------------------- resources
  private mk(size: number, usage: number): any { return this.device.createBuffer({ size: Math.max(16, Math.ceil(size / 4) * 4), usage }) }
  private f32(a: Float32Array): any {
    const b = this.mk(a.byteLength, USAGE.STORAGE | USAGE.COPY_DST)
    this.device.queue.writeBuffer(b, 0, a.buffer as ArrayBuffer, a.byteOffset, a.byteLength)
    return b
  }
  private uni(v: number[]): any {
    const b = this.mk(32, USAGE.UNIFORM | USAGE.COPY_DST)
    this.device.queue.writeBuffer(b, 0, new Uint32Array([...v, 0, 0, 0, 0, 0, 0, 0, 0].slice(0, 8)))
    return b
  }
  private pipe(name: string, code: string): Promise<any> {
    return this.device.createComputePipelineAsync({ layout: "auto", compute: { module: this.device.createShaderModule({ code }), entryPoint: "main" } }).then((p: any) => { this.pipes[name] = p })
  }
  private bind(name: string, bufs: any[]): any {
    return this.device.createBindGroup({ layout: this.pipes[name].getBindGroupLayout(0), entries: bufs.map((b, i) => ({ binding: i, resource: { buffer: b } })) })
  }
  private op(name: string, bufs: any[], x: number, y = 1): Op {
    const bg = this.bind(name, bufs), pl = this.pipes[name]
    return (pass) => { pass.setPipeline(pl); pass.setBindGroup(0, bg); pass.dispatchWorkgroups(x, y) }
  }

  /** Upload a Q8 matrix from wasm memory, split into row chunks that fit one storage binding. */
  private upload(m: Q8, maxRows = Infinity): WBuf[] {
    const cached = this.w.get(m)
    if (cached) return cached
    const mem = this.core.mem.buffer
    const perRow = m.k // bytes of int8 per row
    const rowsMax = Math.max(1, Math.min(maxRows, Math.floor(this.info.maxBinding / perRow)))
    const out: WBuf[] = []
    for (let r0 = 0; r0 < m.rows; r0 += rowsMax) {
      const rows = Math.min(rowsMax, m.rows - r0)
      const w = this.mk(rows * perRow, USAGE.STORAGE | USAGE.COPY_DST)
      this.device.queue.writeBuffer(w, 0, mem, m.q + r0 * perRow, rows * perRow)
      const ws = this.mk(rows * (m.k / 32) * 4, USAGE.STORAGE | USAGE.COPY_DST)
      this.device.queue.writeBuffer(ws, 0, mem, m.s + r0 * (m.k / 32) * 4, rows * (m.k / 32) * 4)
      out.push({ w, ws, rows, k: m.k })
    }
    this.w.set(m, out)
    return out
  }

  private async init(onProgress?: (frac: number, msg: string) => void) {
    const c = this.core
    onProgress?.(0, "compiling GPU kernels")
    await Promise.all([this.pipe("matvec", MATVEC), this.pipe("rms", RMSNORM), this.pipe("ropeq", ROPE_Q), this.pipe("kvstore", KV_STORE), this.pipe("attn", ATTN), this.pipe("silu", SILU_MUL), this.pipe("hook", HOOK), this.pipe("conv", CONV_SILU), this.pipe("delta", DELTA)])
    if (c.isLinear.some(Boolean) && (c.dK !== 128 || c.dV !== 128)) throw new Error("the GPU delta-rule kernel assumes 128-wide heads")
    const S = USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC
    const hd = c.hidden, qd = c.nHead * c.headDim, kd = c.nKV * c.headDim, I = c.inter
    const qs = c.qGate ? 2 * qd : qd
    this.buf = {
      x: this.mk(hd * 4, S), xn: this.mk(hd * 4, S), qraw: this.mk(qs * 4, S), qn: this.mk(qd * 4, S), kraw: this.mk(kd * 4, S), kn: this.mk(kd * 4, S), vraw: this.mk(kd * 4, S),
      attn: this.mk(qd * 4, S), gate: this.mk(I * 4, S), up: this.mk(I * 4, S), h: this.mk(I * 4, S),
      qkv: this.mk(Math.max(c.convDim, 1) * 4, S), mixed: this.mk(Math.max(c.convDim, 1) * 4, S), z: this.mk(Math.max(c.valueDim, 1) * 4, S),
      a: this.mk(Math.max(c.nVH, 1) * 4, S), b: this.mk(Math.max(c.nVH, 1) * 4, S), linOut: this.mk(Math.max(c.valueDim, 1) * 4, S),
      logits: this.mk(c.vocab * 4, S), staging: this.mk(c.vocab * 4, USAGE.MAP_READ | USAGE.COPY_DST),
    }
    this.dyn = this.mk(16, USAGE.UNIFORM | USAGE.COPY_DST)
    this.inv = this.f32(c.ropeInvFreq())
    this.outNorm = this.f32(c.outNorm)
    for (let l = 0; l < c.nLayer; l++) {
      const L = c.layers[l]
      this.norms.push(this.f32(L.attnNorm)); this.ffnNorms.push(this.f32(L.ffnNorm))
      if (L.kind === "linear") {
        const cst = new Float32Array(2 * c.nVH + c.dV)
        cst.set(L.ssmA, 0); cst.set(L.dtBias, c.nVH); cst.set(L.ssmNorm, 2 * c.nVH)
        this.lin.push({ conv: this.f32(L.convW), cst: this.f32(cst) })
      } else this.lin.push(null)
      this.qk.push(L.kind === "full" ? { q: this.f32(L.qNorm), k: this.f32(L.kNorm) } : null)
      for (const m of L.kind === "linear" ? [L.wqkv, L.wz, L.wa, L.wb, L.wout, L.gate, L.up, L.down] : [L.wq, L.wk, L.wv, L.wo, L.gate, L.up, L.down]) this.upload(m)
      onProgress?.((l + 1) / (c.nLayer + 1), `uploading weights to the GPU: layer ${l + 1} of ${c.nLayer}`)
    }
    this.embChunks = this.upload(c.embd)
    await this.device.queue.onSubmittedWorkDone()
    onProgress?.(1, "GPU ready")
  }

  // ---------------------------------------------------------------- program for one stream
  private mv(m: Q8, x: any, y: any, mode = 0, rowBase = 0): Op[] {
    return this.upload(m).map((ch, ci) => {
      const p = this.uni([ch.rows, ch.k, 0, 0, mode, rowBase + this.chunkStart(m, ci), 0, 0])
      const X = Math.min(ch.rows, 65535), Y = Math.ceil(ch.rows / 65535)
      return this.op("matvec", [ch.w, ch.ws, x, y, p], X, Y)
    })
  }
  private chunkStart(m: Q8, ci: number) { let r = 0; const ch = this.upload(m); for (let i = 0; i < ci; i++) r += ch[i].rows; return r }
  private rms(src: any, w: any, dst: any, n: number, count: number, srcStride: number, dstStride: number): Op {
    return this.op("rms", [src, w, dst, this.uni([n, 0, 0, srcStride, dstStride, count, 0, bits(this.core.eps)])], count)
  }

  private buildProgram(st: GpuStream) {
    const c = this.core, b = this.buf
    const hd = c.hidden, D = c.headDim, nh = c.nHead, nkv = c.nKV, I = c.inter, kd = nkv * D
    const qh = c.qGate ? 2 * D : D
    const rhalf = c.ropeDim / 2
    const prog: Op[] = []
    for (let l = 0; l < c.nLayer; l++) {
      const L = c.layers[l]
      prog.push(this.rms(b.x, this.norms[l], b.xn, hd, 1, hd, hd))
      if (L.kind === "linear") {
        const ln = this.lin[l]!
        prog.push(...this.mv(L.wqkv, b.xn, b.qkv), ...this.mv(L.wz, b.xn, b.z), ...this.mv(L.wa, b.xn, b.a), ...this.mv(L.wb, b.xn, b.b))
        prog.push(this.op("conv", [b.qkv, ln.conv, st.conv[l], b.mixed, this.uni([c.convDim, c.convK])], Math.ceil(c.convDim / 64)))
        prog.push(this.op("delta", [b.mixed, b.z, b.b, b.a, ln.cst, st.rec[l], b.linOut, this.uni([c.nVH, c.nKH, c.dK, c.dV, c.keyDim, bits(c.eps)])], c.nVH))
        prog.push(...this.mv(L.wout, b.linOut, b.x, 1))
      } else {
        prog.push(...this.mv(L.wq, b.xn, b.qraw), ...this.mv(L.wk, b.xn, b.kraw), ...this.mv(L.wv, b.xn, b.vraw))
        prog.push(this.rms(b.qraw, this.qk[l]!.q, b.qn, D, nh, qh, D))
        prog.push(this.rms(b.kraw, this.qk[l]!.k, b.kn, D, nkv, D, D))
        prog.push(this.op("ropeq", [b.qn, this.inv, this.uni([nh, D, rhalf]), this.dyn], Math.ceil((nh * rhalf) / 64)))
        prog.push(this.op("kvstore", [b.kn, b.vraw, st.kc[l], st.vc[l], this.inv, this.uni([nkv, D, rhalf, c.ropeDim, kd]), this.dyn], Math.ceil((nkv * D) / 64)))
        prog.push(this.op("attn", [b.qn, b.qraw, st.kc[l], st.vc[l], b.attn, this.uni([nh, D, nh / nkv, kd, c.qGate ? 1 : 0, qh, bits(1 / Math.sqrt(D))]), this.dyn], nh))
        prog.push(...this.mv(L.wo, b.attn, b.x, 1))
      }
      prog.push(this.rms(b.x, this.ffnNorms[l], b.xn, hd, 1, hd, hd))
      prog.push(...this.mv(L.gate, b.xn, b.gate), ...this.mv(L.up, b.xn, b.up))
      prog.push(this.op("silu", [b.gate, b.up, b.h, this.uni([I])], Math.ceil(I / 64)))
      if (st.hooks.mulN[l]) prog.push(this.op("hook", [st.hooks.mulIdx, st.hooks.mulVal, b.h, st.hooks.mulP[l]], Math.ceil(st.hooks.mulN[l] / 64)))
      if (st.hooks.addN[l]) prog.push(this.op("hook", [st.hooks.addIdx, st.hooks.addVal, b.h, st.hooks.addP[l]], Math.ceil(st.hooks.addN[l] / 64)))
      prog.push(...this.mv(L.down, b.h, b.x, 1))
    }
    st.prog = prog
    const tail: Op[] = [this.rms(b.x, this.outNorm, b.xn, hd, 1, hd, hd)]
    this.embChunks.forEach((ch, ci) => {
      const start = this.embChunks.slice(0, ci).reduce((a, k) => a + k.rows, 0)
      tail.push(this.op("matvec", [ch.w, ch.ws, b.xn, b.logits, this.uni([ch.rows, ch.k, 0, 0, 0, start, 0, 0])], Math.min(ch.rows, 65535), Math.ceil(ch.rows / 65535)))
    })
    st.logitsProg = tail
  }

  /** A fresh sequence (zero state) with room for `cap` positions, steered by `deltas`. */
  newStream(cap: number, deltas: (LayerDeltas | null)[] | null): GpuStream {
    const c = this.core, kd = c.nKV * c.headDim
    const S = USAGE.STORAGE | USAGE.COPY_DST | USAGE.COPY_SRC
    const st: GpuStream = { kc: [], vc: [], conv: [], rec: [], hooks: null as any, prog: [], logitsProg: [], pos: 0, cap }
    for (let l = 0; l < c.nLayer; l++) {
      if (c.isLinear[l]) { st.kc.push(null); st.vc.push(null); st.conv.push(this.mk(c.convDim * (c.convK - 1) * 4, S)); st.rec.push(this.mk(c.nVH * c.dK * c.dV * 4, S)) }
      else { st.kc.push(this.mk(cap * kd * 4, S)); st.vc.push(this.mk(cap * kd * 4, S)); st.conv.push(null); st.rec.push(null) }
    }
    // hooks: one multiply list and one add list per layer, packed into two idx/val buffers
    const mi: number[] = [], mv: number[] = [], ai: number[] = [], av: number[] = []
    const mulP: any[] = [], addP: any[] = [], mulN: number[] = [], addN: number[] = []
    for (let l = 0; l < c.nLayer; l++) {
      const d = deltas?.[l]
      mulN.push(d?.mn?.length ?? 0); addN.push(d?.n.length ?? 0)
      mulP.push(this.uni([mi.length, mulN[l], 0])); addP.push(this.uni([ai.length, addN[l], 1]))
      if (d?.mn) for (let j = 0; j < d.mn.length; j++) { mi.push(d.mn[j]); mv.push(d.mf![j]) }
      if (d) for (let j = 0; j < d.n.length; j++) { ai.push(d.n[j]); av.push(d.d[j]) }
    }
    const u32 = (a: number[]) => { const b = this.mk(Math.max(4, a.length) * 4, USAGE.STORAGE | USAGE.COPY_DST); if (a.length) this.device.queue.writeBuffer(b, 0, new Uint32Array(a)); return b }
    const f = (a: number[]) => { const b = this.mk(Math.max(4, a.length) * 4, USAGE.STORAGE | USAGE.COPY_DST); if (a.length) this.device.queue.writeBuffer(b, 0, new Float32Array(a)); return b }
    st.hooks = { mulIdx: u32(mi), mulVal: f(mv), addIdx: u32(ai), addVal: f(av), mulP, addP, mulN, addN }
    this.buildProgram(st)
    return st
  }

  freeStream(st: GpuStream) {
    for (const a of [st.kc, st.vc, st.conv, st.rec]) for (const b of a) b?.destroy?.()
    for (const k of ["mulIdx", "mulVal", "addIdx", "addVal"] as const) st.hooks[k].destroy()
  }

  /** Advance the stream by one token. With `wantLogits`, returns the next-token logits (a copy). */
  async step(st: GpuStream, token: number, wantLogits: boolean): Promise<Float32Array | null> {
    if (st.pos >= st.cap) throw new Error("GPU stream is full")
    const dev = this.device
    this.core.embedRow(token, this.tmp)
    dev.queue.writeBuffer(this.buf.x, 0, this.tmp)
    dev.queue.writeBuffer(this.dyn, 0, new Uint32Array([st.pos, st.pos + 1, 0, 0]))
    const enc = dev.createCommandEncoder()
    const pass = enc.beginComputePass()
    for (const op of st.prog) op(pass)
    if (wantLogits) for (const op of st.logitsProg) op(pass)
    pass.end()
    if (wantLogits) enc.copyBufferToBuffer(this.buf.logits, 0, this.buf.staging, 0, this.core.vocab * 4)
    dev.queue.submit([enc.finish()])
    st.pos++
    if (!wantLogits) return null
    await this.buf.staging.mapAsync(1)
    const out = new Float32Array(this.buf.staging.getMappedRange().slice(0))
    this.buf.staging.unmap()
    return out
  }

  /** Wait until every submitted step has finished (prompt tokens are submitted without waiting). */
  idle(): Promise<void> { return this.device.queue.onSubmittedWorkDone() }
}
