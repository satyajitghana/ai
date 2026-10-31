// WGSL kernels for the WebGPU decode path (one token per step). Plain compute shaders: no subgroups, no
// f16, nothing beyond core WebGPU, so they run on any adapter (the tests use Chromium's software one).
//
// Weights stay Q8_0 on the GPU: int8 packed four to a u32, one fp32 scale per 32 weights. Activations are fp32
// (the CPU path quantizes them to 8 bits; here they are not), so this path is slightly more accurate.
// All "params" are 8 x u32 uniforms (floats are passed as bit patterns).

export const MATVEC = /* wgsl */ `
struct P { rows: u32, k: u32, xOff: u32, yOff: u32, mode: u32, rowBase: u32, a: u32, b: u32 }
@group(0) @binding(0) var<storage, read> w: array<u32>;
@group(0) @binding(1) var<storage, read> ws: array<f32>;
@group(0) @binding(2) var<storage, read> x: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<f32>;
@group(0) @binding(4) var<uniform> p: P;
var<workgroup> red: array<f32, 64>;

@compute @workgroup_size(64)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>, @builtin(num_workgroups) nwg: vec3<u32>) {
  let row = wg.x + wg.y * nwg.x;
  let valid = row < p.rows;
  let r = min(row, p.rows - 1u);
  let kw = p.k / 4u;
  let nb = p.k / 32u;
  var acc = 0.0;
  var i = lid.x;
  loop {
    if (i >= kw) { break; }
    let word = i32(w[r * kw + i]);
    let sc = ws[r * nb + (i >> 3u)];
    let xo = p.xOff + i * 4u;
    let a0 = f32(extractBits(word, 0u, 8u));
    let a1 = f32(extractBits(word, 8u, 8u));
    let a2 = f32(extractBits(word, 16u, 8u));
    let a3 = f32(extractBits(word, 24u, 8u));
    acc += sc * (a0 * x[xo] + a1 * x[xo + 1u] + a2 * x[xo + 2u] + a3 * x[xo + 3u]);
    i += 64u;
  }
  red[lid.x] = acc;
  workgroupBarrier();
  var s = 32u;
  loop {
    if (s == 0u) { break; }
    if (lid.x < s) { red[lid.x] += red[lid.x + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  if (lid.x == 0u && valid) {
    let o = p.yOff + p.rowBase + row;
    if (p.mode == 1u) { y[o] = y[o] + red[0]; } else { y[o] = red[0]; }
  }
}`

export const RMSNORM = /* wgsl */ `
struct P { n: u32, srcOff: u32, dstOff: u32, srcStride: u32, dstStride: u32, count: u32, wOff: u32, eps: u32 }
@group(0) @binding(0) var<storage, read> src: array<f32>;
@group(0) @binding(1) var<storage, read> w: array<f32>;
@group(0) @binding(2) var<storage, read_write> dst: array<f32>;
@group(0) @binding(3) var<uniform> p: P;
var<workgroup> red: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let g = min(wg.x, p.count - 1u);
  let so = p.srcOff + g * p.srcStride;
  var ss = 0.0;
  var i = lid.x;
  loop {
    if (i >= p.n) { break; }
    let v = src[so + i];
    ss += v * v;
    i += 256u;
  }
  red[lid.x] = ss;
  workgroupBarrier();
  var s = 128u;
  loop {
    if (s == 0u) { break; }
    if (lid.x < s) { red[lid.x] += red[lid.x + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  let r = inverseSqrt(red[0] / f32(p.n) + bitcast<f32>(p.eps));
  if (wg.x < p.count) {
    i = lid.x;
    loop {
      if (i >= p.n) { break; }
      dst[p.dstOff + g * p.dstStride + i] = src[so + i] * r * w[p.wOff + i];
      i += 256u;
    }
  }
}`

// rotate_half over the first ropeDim dims of every q head, in place (position from the dyn uniform)
export const ROPE_Q = /* wgsl */ `
struct P { nh: u32, d: u32, rhalf: u32, a: u32, b: u32, c: u32, e: u32, f: u32 }
struct Dyn { pos: u32, len: u32, a: u32, b: u32 }
@group(0) @binding(0) var<storage, read_write> q: array<f32>;
@group(0) @binding(1) var<storage, read> inv: array<f32>;
@group(0) @binding(2) var<uniform> p: P;
@group(0) @binding(3) var<uniform> dyn: Dyn;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let t = gid.x;
  if (t >= p.nh * p.rhalf) { return; }
  let h = t / p.rhalf;
  let i = t % p.rhalf;
  let o = h * p.d + i;
  let ang = f32(dyn.pos) * inv[i];
  let cs = cos(ang);
  let sn = sin(ang);
  let a = q[o];
  let b = q[o + p.rhalf];
  q[o] = a * cs - b * sn;
  q[o + p.rhalf] = b * cs + a * sn;
}`

// rotate the new key, store key and value at position pos of the layer's cache
export const KV_STORE = /* wgsl */ `
struct P { nkv: u32, d: u32, rhalf: u32, ropeDim: u32, kd: u32, a: u32, b: u32, c: u32 }
struct Dyn { pos: u32, len: u32, a: u32, b: u32 }
@group(0) @binding(0) var<storage, read> kn: array<f32>;
@group(0) @binding(1) var<storage, read> vraw: array<f32>;
@group(0) @binding(2) var<storage, read_write> kc: array<f32>;
@group(0) @binding(3) var<storage, read_write> vc: array<f32>;
@group(0) @binding(4) var<storage, read> inv: array<f32>;
@group(0) @binding(5) var<uniform> p: P;
@group(0) @binding(6) var<uniform> dyn: Dyn;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let t = gid.x;
  if (t >= p.nkv * p.d) { return; }
  let h = t / p.d;
  let i = t % p.d;
  let src = h * p.d + i;
  let dst = dyn.pos * p.kd + src;
  vc[dst] = vraw[src];
  if (i < p.rhalf) {
    let ang = f32(dyn.pos) * inv[i];
    let cs = cos(ang);
    let sn = sin(ang);
    let a = kn[src];
    let b = kn[src + p.rhalf];
    kc[dst] = a * cs - b * sn;
    kc[dst + p.rhalf] = b * cs + a * sn;
  } else if (i >= p.ropeDim) {
    kc[dst] = kn[src];
  }
}`

// causal attention of the new token over positions 0..pos, one workgroup per query head
export const ATTN = /* wgsl */ `
struct P { nh: u32, d: u32, group: u32, kd: u32, qGate: u32, qh: u32, scale: u32, a: u32 }
struct Dyn { pos: u32, len: u32, a: u32, b: u32 }
@group(0) @binding(0) var<storage, read> q: array<f32>;
@group(0) @binding(1) var<storage, read> qraw: array<f32>;
@group(0) @binding(2) var<storage, read> kc: array<f32>;
@group(0) @binding(3) var<storage, read> vc: array<f32>;
@group(0) @binding(4) var<storage, read_write> o: array<f32>;
@group(0) @binding(5) var<uniform> p: P;
@group(0) @binding(6) var<uniform> dyn: Dyn;
var<workgroup> sc: array<f32, 2048>;
var<workgroup> red: array<f32, 256>;

@compute @workgroup_size(256)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let h = wg.x;
  let kvh = h / p.group;
  let len = dyn.len;
  let scale = bitcast<f32>(p.scale);
  var mx = -1e30;
  var j = lid.x;
  loop {
    if (j >= len) { break; }
    var s = 0.0;
    let ko = j * p.kd + kvh * p.d;
    for (var i = 0u; i < p.d; i = i + 1u) { s += q[h * p.d + i] * kc[ko + i]; }
    s = s * scale;
    sc[j] = s;
    mx = max(mx, s);
    j += 256u;
  }
  red[lid.x] = mx;
  workgroupBarrier();
  var st = 128u;
  loop {
    if (st == 0u) { break; }
    if (lid.x < st) { red[lid.x] = max(red[lid.x], red[lid.x + st]); }
    workgroupBarrier();
    st = st >> 1u;
  }
  let m = red[0];
  workgroupBarrier();
  var z = 0.0;
  j = lid.x;
  loop {
    if (j >= len) { break; }
    let e = exp(sc[j] - m);
    sc[j] = e;
    z += e;
    j += 256u;
  }
  red[lid.x] = z;
  workgroupBarrier();
  st = 128u;
  loop {
    if (st == 0u) { break; }
    if (lid.x < st) { red[lid.x] += red[lid.x + st]; }
    workgroupBarrier();
    st = st >> 1u;
  }
  let inv = 1.0 / red[0];
  let i = lid.x;
  if (i < p.d) {
    var acc = 0.0;
    for (var t = 0u; t < len; t = t + 1u) { acc += sc[t] * vc[t * p.kd + kvh * p.d + i]; }
    acc = acc * inv;
    if (p.qGate == 1u) { acc = acc / (1.0 + exp(-qraw[h * p.qh + p.d + i])); }
    o[h * p.d + i] = acc;
  }
}`

export const SILU_MUL = /* wgsl */ `
struct P { n: u32, a: u32, b: u32, c: u32, d: u32, e: u32, f: u32, g: u32 }
@group(0) @binding(0) var<storage, read> g: array<f32>;
@group(0) @binding(1) var<storage, read> u: array<f32>;
@group(0) @binding(2) var<storage, read_write> h: array<f32>;
@group(0) @binding(3) var<uniform> p: P;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= p.n) { return; }
  let a = g[i];
  h[i] = a / (1.0 + exp(-a)) * u[i];
}`

// steering hooks on the MLP hidden activation: mode 0 multiplies the listed neurons, mode 1 adds to them
export const HOOK = /* wgsl */ `
struct P { off: u32, count: u32, mode: u32, a: u32, b: u32, c: u32, d: u32, e: u32 }
@group(0) @binding(0) var<storage, read> idx: array<u32>;
@group(0) @binding(1) var<storage, read> val: array<f32>;
@group(0) @binding(2) var<storage, read_write> h: array<f32>;
@group(0) @binding(3) var<uniform> p: P;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let t = gid.x;
  if (t >= p.count) { return; }
  let n = idx[p.off + t];
  if (p.mode == 0u) { h[n] = h[n] * val[p.off + t]; } else { h[n] = h[n] + val[p.off + t]; }
}`

// causal depthwise conv over the last K inputs of every channel, then silu; slides the window
export const CONV_SILU = /* wgsl */ `
struct P { cd: u32, k: u32, a: u32, b: u32, c: u32, d: u32, e: u32, f: u32 }
@group(0) @binding(0) var<storage, read> qkv: array<f32>;
@group(0) @binding(1) var<storage, read> cw: array<f32>;
@group(0) @binding(2) var<storage, read_write> state: array<f32>;
@group(0) @binding(3) var<storage, read_write> mixed: array<f32>;
@group(0) @binding(4) var<uniform> p: P;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  if (c >= p.cd) { return; }
  let cur = qkv[c];
  let so = c * (p.k - 1u);
  let wo = c * p.k;
  var acc = cw[wo + p.k - 1u] * cur;
  for (var j = 0u; j < p.k - 1u; j = j + 1u) { acc += cw[wo + j] * state[so + j]; }
  for (var j = 0u; j + 2u < p.k; j = j + 1u) { state[so + j] = state[so + j + 1u]; }
  state[so + p.k - 2u] = cur;
  mixed[c] = acc / (1.0 + exp(-acc));
}`

// gated delta rule for one value head per workgroup (dK = dV = 128): decay, delta update, readout, gated RMSNorm
export const DELTA = /* wgsl */ `
struct P { nvh: u32, nkh: u32, dk: u32, dv: u32, keyDim: u32, eps: u32, a: u32, b: u32 }
@group(0) @binding(0) var<storage, read> mixed: array<f32>;
@group(0) @binding(1) var<storage, read> za: array<f32>;
@group(0) @binding(2) var<storage, read> bv: array<f32>;
@group(0) @binding(3) var<storage, read> av: array<f32>;
@group(0) @binding(4) var<storage, read> cst: array<f32>; // [ssmA (nvh) | dtBias (nvh) | ssmNorm (dv)]
@group(0) @binding(5) var<storage, read_write> S: array<f32>;
@group(0) @binding(6) var<storage, read_write> outv: array<f32>;
@group(0) @binding(7) var<uniform> p: P;
var<workgroup> ks: array<f32, 128>;
var<workgroup> qs: array<f32, 128>;
var<workgroup> red: array<f32, 128>;

fn reduce(lid: u32, v: f32) -> f32 {
  red[lid] = v;
  workgroupBarrier();
  var s = 64u;
  loop {
    if (s == 0u) { break; }
    if (lid < s) { red[lid] += red[lid + s]; }
    workgroupBarrier();
    s = s >> 1u;
  }
  let r = red[0];
  workgroupBarrier();
  return r;
}

@compute @workgroup_size(128)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>) {
  let h = wg.x;
  let t = lid3.x;
  let kh = h / (p.nvh / p.nkh);
  let qv = mixed[kh * p.dk + t];
  let kv = mixed[p.keyDim + kh * p.dk + t];
  let qq = reduce(t, qv * qv);
  let kk = reduce(t, kv * kv);
  qs[t] = qv * inverseSqrt(qq + 1e-6) * inverseSqrt(f32(p.dk));
  ks[t] = kv * inverseSqrt(kk + 1e-6);
  workgroupBarrier();
  let beta = 1.0 / (1.0 + exp(-bv[h]));
  let ap = av[h] + cst[p.nvh + h];
  var sp = ap;
  if (ap <= 20.0) { sp = log(1.0 + exp(ap)); }
  let decay = exp(cst[h] * sp);
  let so = h * p.dk * p.dv;
  var kvm = 0.0;
  for (var i = 0u; i < p.dk; i = i + 1u) {
    let s = S[so + i * p.dv + t] * decay;
    S[so + i * p.dv + t] = s;
    kvm += s * ks[i];
  }
  let delta = (mixed[2u * p.keyDim + h * p.dv + t] - kvm) * beta;
  var o = 0.0;
  for (var i = 0u; i < p.dk; i = i + 1u) {
    let s = S[so + i * p.dv + t] + ks[i] * delta;
    S[so + i * p.dv + t] = s;
    o += s * qs[i];
  }
  let ms = reduce(t, o * o) / f32(p.dv);
  let r = inverseSqrt(ms + bitcast<f32>(p.eps));
  let z = za[h * p.dv + t];
  outv[h * p.dv + t] = o * r * cst[2u * p.nvh + t] * (z / (1.0 + exp(-z)));
}`
