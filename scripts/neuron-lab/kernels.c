// WASM SIMD kernels for the neuron-lab engine (freestanding C, no libc).
// Build: scripts/neuron-lab/build-kernels.sh  ->  components/neuron-lab/engine/kernels-wasm.ts
//
// Weight layout (repacked from GGUF Q8_0 at load time):
//   w  : int8  [rows][K]          one row per output feature
//   ws : float [rows][K/32]       one fp32 scale per 32-weight block
// Activation layout (Q8_0 style, quantized on the fly):
//   xq : int8  [T][K],  xs : float [T][K/32]
// out[t][r] = sum_b ws[r][b] * xs[t][b] * sum_{i<32} w[r][32b+i] * xq[t][32b+i]
#include <stdint.h>
#include <wasm_simd128.h>

#define EXPORT __attribute__((visibility("default")))

static inline float hsum(v128_t v) {
  return wasm_f32x4_extract_lane(v, 0) + wasm_f32x4_extract_lane(v, 1) +
         wasm_f32x4_extract_lane(v, 2) + wasm_f32x4_extract_lane(v, 3);
}

// integer dot of one 32-element block, returned as i32x4 partial sums
static inline v128_t dot32(const int8_t *a, const int8_t *b) {
  v128_t a0 = wasm_v128_load(a), a1 = wasm_v128_load(a + 16);
  v128_t b0 = wasm_v128_load(b), b1 = wasm_v128_load(b + 16);
  v128_t p0 = wasm_i16x8_extmul_low_i8x16(a0, b0);
  v128_t p1 = wasm_i16x8_extmul_high_i8x16(a0, b0);
  v128_t p2 = wasm_i16x8_extmul_low_i8x16(a1, b1);
  v128_t p3 = wasm_i16x8_extmul_high_i8x16(a1, b1);
  v128_t s0 = wasm_i32x4_add(wasm_i32x4_extadd_pairwise_i16x8(p0), wasm_i32x4_extadd_pairwise_i16x8(p1));
  v128_t s1 = wasm_i32x4_add(wasm_i32x4_extadd_pairwise_i16x8(p2), wasm_i32x4_extadd_pairwise_i16x8(p3));
  return wasm_i32x4_add(s0, s1);
}

EXPORT void matmul_q8(const int8_t *w, const float *ws, const int8_t *xq, const float *xs,
                      float *out, int rows, int K, int T) {
  const int nb = K >> 5;
  int r = 0;
  for (; r + 1 < rows; r += 2) {
    const int8_t *w0 = w + (long)r * K, *w1 = w0 + K;
    const float *s0 = ws + (long)r * nb, *s1 = s0 + nb;
    for (int t = 0; t < T; t++) {
      const int8_t *x = xq + (long)t * K;
      const float *xsc = xs + (long)t * nb;
      v128_t acc0 = wasm_f32x4_splat(0), acc1 = acc0;
      for (int b = 0; b < nb; b++) {
        const int8_t *xb = x + (b << 5);
        float xb_s = xsc[b];
        acc0 = wasm_f32x4_add(acc0, wasm_f32x4_mul(wasm_f32x4_convert_i32x4(dot32(w0 + (b << 5), xb)), wasm_f32x4_splat(s0[b] * xb_s)));
        acc1 = wasm_f32x4_add(acc1, wasm_f32x4_mul(wasm_f32x4_convert_i32x4(dot32(w1 + (b << 5), xb)), wasm_f32x4_splat(s1[b] * xb_s)));
      }
      out[(long)t * rows + r] = hsum(acc0);
      out[(long)t * rows + r + 1] = hsum(acc1);
    }
  }
  for (; r < rows; r++) {
    const int8_t *w0 = w + (long)r * K;
    const float *s0 = ws + (long)r * nb;
    for (int t = 0; t < T; t++) {
      const int8_t *x = xq + (long)t * K;
      const float *xsc = xs + (long)t * nb;
      v128_t acc0 = wasm_f32x4_splat(0);
      for (int b = 0; b < nb; b++)
        acc0 = wasm_f32x4_add(acc0, wasm_f32x4_mul(wasm_f32x4_convert_i32x4(dot32(w0 + (b << 5), x + (b << 5))), wasm_f32x4_splat(s0[b] * xsc[b])));
      out[(long)t * rows + r] = hsum(acc0);
    }
  }
}

// Q8_0-style quantization of `nblocks` consecutive 32-float blocks.
EXPORT void quantize_q8(const float *x, int8_t *q, float *s, int nblocks) {
  for (int b = 0; b < nblocks; b++) {
    const float *p = x + (b << 5);
    v128_t v[8];
    v128_t m = wasm_f32x4_splat(0);
    for (int i = 0; i < 8; i++) {
      v[i] = wasm_v128_load(p + 4 * i);
      m = wasm_f32x4_max(m, wasm_f32x4_abs(v[i]));
    }
    float amax = wasm_f32x4_extract_lane(m, 0);
    for (int i = 1; i < 4; i++) { float l = ((float *)&m)[i]; amax = l > amax ? l : amax; }
    float d = amax / 127.0f;
    float id = d != 0.0f ? 1.0f / d : 0.0f;
    s[b] = d;
    v128_t idv = wasm_f32x4_splat(id);
    v128_t i0 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[0], idv)));
    v128_t i1 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[1], idv)));
    v128_t i2 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[2], idv)));
    v128_t i3 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[3], idv)));
    v128_t i4 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[4], idv)));
    v128_t i5 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[5], idv)));
    v128_t i6 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[6], idv)));
    v128_t i7 = wasm_i32x4_trunc_sat_f32x4(wasm_f32x4_nearest(wasm_f32x4_mul(v[7], idv)));
    wasm_v128_store(q + (b << 5), wasm_i8x16_narrow_i16x8(wasm_i16x8_narrow_i32x4(i0, i1), wasm_i16x8_narrow_i32x4(i2, i3)));
    wasm_v128_store(q + (b << 5) + 16, wasm_i8x16_narrow_i16x8(wasm_i16x8_narrow_i32x4(i4, i5), wasm_i16x8_narrow_i32x4(i6, i7)));
  }
}

static inline float f16_to_f32(uint16_t h) {
  uint32_t sign = (uint32_t)(h & 0x8000) << 16;
  uint32_t exp = (h >> 10) & 0x1f, man = h & 0x3ff, bits;
  if (exp == 0) {
    if (man == 0) bits = sign;
    else { // subnormal half -> normal float
      int e = -1;
      do { e++; man <<= 1; } while (!(man & 0x400));
      man &= 0x3ff;
      bits = sign | ((uint32_t)(127 - 15 - e) << 23) | (man << 13);
    }
  } else if (exp == 31) bits = sign | 0x7f800000u | (man << 13);
  else bits = sign | ((exp + 127 - 15) << 23) | (man << 13);
  union { uint32_t u; float f; } c; c.u = bits; return c.f;
}

// GGUF Q8_0 blocks (2-byte fp16 scale + 32 int8) -> split int8 / fp32-scale arrays.
EXPORT void repack_q8(const uint8_t *src, int8_t *dq, float *ds, int nblocks) {
  for (int b = 0; b < nblocks; b++) {
    const uint8_t *p = src + (long)b * 34;
    ds[b] = f16_to_f32((uint16_t)(p[0] | (p[1] << 8)));
    const uint8_t *d = p + 2;
    // unaligned 16-byte loads are fine in wasm
    wasm_v128_store(dq + ((long)b << 5), wasm_v128_load(d));
    wasm_v128_store(dq + ((long)b << 5) + 16, wasm_v128_load(d + 16));
  }
}

// f32 helper for the h = silu(gate) * up step is done in JS (exp is not freestanding here).
EXPORT int abi_version(void) { return 1; }
