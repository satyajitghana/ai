// Numbers for the MotionBricks article. Every value is either read from the
// safetensors headers of nvidia/MotionBricks (range requests, no weights
// downloaded except two small tensors per tokenizer), counted from those
// shapes, copied from the published model cards, or timed by bench.py on a
// shared 4-vCPU box with 2 threads. Each block says which.

export type Family = "g1" | "soma"

export const FAMILY_LABEL: Record<Family, string> = {
  g1: "Unitree G1 (34 joints)",
  soma: "SOMA human (30 joints)",
}

export type Group = { label: string; n: number }
export type Component = { id: "vqvae" | "pose" | "root"; label: string; params: number; bytes: number; groups: Group[] }

// Measured: parameter counts are the product of every tensor shape in the
// header; bytes are the .safetensors file sizes from the repo manifest.
export const COMPONENTS: Record<Family, Component[]> = {
  g1: [
    {
      id: "vqvae",
      label: "Tokenizer (VQ-VAE)",
      params: 23_795_822,
      bytes: 95_194_080,
      groups: [
        { label: "encoder", n: 11_355_904 },
        { label: "decoder", n: 12_434_717 },
        { label: "codebooks", n: 5_201 },
      ],
    },
    {
      id: "pose",
      label: "Pose predictor",
      params: 136_588_273,
      bytes: 546_380_073,
      groups: [
        { label: "attention (16 layers)", n: 67_174_400 },
        { label: "feed-forward (16 layers)", n: 67_158_016 },
        { label: "layer norms", n: 65_536 },
        { label: "input and token projections", n: 2_190_321 },
      ],
    },
    {
      id: "root",
      label: "Root predictor",
      params: 34_122_833,
      bytes: 136_510_540,
      groups: [
        { label: "shared transformer (3 layers)", n: 9_457_152 },
        { label: "root transformer (3 layers)", n: 9_457_152 },
        { label: "output conv stack", n: 13_652_741 },
        { label: "input projections", n: 1_555_788 },
      ],
    },
  ],
  soma: [
    {
      id: "vqvae",
      label: "Tokenizer (VQ-VAE)",
      params: 23_357_918,
      bytes: 93_442_464,
      groups: [
        { label: "encoder", n: 11_153_056 },
        { label: "decoder", n: 12_199_661 },
        { label: "codebooks", n: 5_201 },
      ],
    },
    {
      id: "pose",
      label: "Pose predictor",
      params: 136_520_977,
      bytes: 546_109_841,
      groups: [
        { label: "attention (16 layers)", n: 67_174_400 },
        { label: "feed-forward (16 layers)", n: 67_158_016 },
        { label: "layer norms", n: 65_536 },
        { label: "input and token projections", n: 2_123_025 },
      ],
    },
    {
      id: "root",
      label: "Root predictor",
      params: 40_418_385,
      bytes: 161_695_084,
      groups: [
        { label: "shared transformer (6 layers)", n: 18_914_304 },
        { label: "root transformer (2 layers)", n: 6_304_768 },
        { label: "output conv stack", n: 13_652_741 },
        { label: "input projections", n: 1_546_572 },
      ],
    },
  ],
}

// Measured: the EMA cluster sizes stored in each tokenizer's codebook, one row
// per head. They are an exponential moving average of how many encoder
// outputs each code received late in training, so they are a proxy for usage,
// not a count over the corpus. Rounded to one decimal.
export const CLUSTER: Record<Family, number[][]> = {
  g1: [
    [409.0, 55.9, 263.5, 416.0, 495.4, 333.4, 547.8, 6.8, 197.3, 134.3],
    [145.1, 123.8, 32.9, 1043.9, 619.7, 313.0, 54.2, 342.4, 64.3, 120.1],
    [68.0, 115.8, 1108.9, 65.4, 97.3, 192.4, 498.2, 248.6, 135.1, 329.8],
    [117.9, 35.3, 173.9, 334.1, 292.6, 319.0, 90.5, 647.0, 423.2, 425.8],
    [102.0, 8.4, 188.5, 226.4, 568.8, 146.7, 810.1, 329.7, 9.9, 468.8],
    [198.9, 509.6, 322.3, 243.0, 276.4, 158.1, 371.2, 420.6, 249.2, 110.3],
    [14.9, 161.7, 406.7, 204.2, 704.0, 120.5, 337.9, 29.0, 91.0, 789.5],
    [116.7, 314.0, 360.3, 245.2, 74.1, 36.8, 303.6, 389.8, 636.8, 382.1],
  ],
  soma: [
    [11200.0, 619.0, 4502.8, 8212.9, 3576.7, 3021.3, 1498.8, 1176.4, 3270.6, 6542.8, 3555.9, 20138.0, 9996.3, 5131.5, 1944.6, 5032.7],
    [8232.3, 3379.3, 4380.3, 4068.0, 1031.9, 647.8, 3308.9, 10476.6, 3501.0, 8160.2, 2629.3, 10002.8, 16022.8, 2370.8, 1977.2, 9231.0],
    [3579.5, 5372.3, 4926.1, 10128.4, 9505.6, 1814.8, 9049.8, 9897.8, 5453.3, 3178.6, 6483.6, 1900.0, 3857.1, 3251.2, 9999.2, 1022.9],
    [5826.6, 2976.2, 10065.4, 3692.5, 6604.5, 5189.3, 8657.9, 2664.9, 2151.8, 9031.9, 3283.1, 4055.5, 6677.8, 5262.0, 10440.5, 2840.2],
    [3490.4, 6257.0, 2521.4, 1595.2, 12832.6, 871.7, 5456.8, 4065.2, 8061.6, 2228.4, 1715.9, 25633.4, 4508.0, 2340.3, 5134.5, 2707.9],
  ],
}

// Measured per-head entropy of those shares, in bits (log base 2).
export const HEAD_ENTROPY: Record<Family, number[]> = {
  g1: [2.98, 2.64, 2.71, 3.02, 2.76, 3.2, 2.74, 3.04],
  soma: [3.55, 3.62, 3.77, 3.84, 3.43],
}

// Reported (docs/onnx_inference.md): GPU time of the TensorRT plan alone on an
// RTX 4090 under Windows, ms, with requests per second.
export const TRT_4090 = {
  g1: {
    fp32: { 1: [2.67, 375], 8: [3.78, 2116], 16: [5.17, 3096], 32: [7.81, 4097] },
    fp16: { 1: [1.63, 613], 8: [1.91, 4194], 16: [2.36, 6783], 32: [3.38, 9449] },
  },
  soma: {
    fp32: { 1: [2.5, 400], 8: [2.96, 2706], 16: [3.74, 4280], 32: [5.28, 6063] },
    fp16: { 1: [1.28, 778], 8: [1.54, 5179], 16: [1.87, 8535], 32: [3.93, 8138] },
  },
} as const

// Measured: bench.py, numpy float32, random weights of the real shapes (16
// layers, width 1024, 16 heads, feed-forward 2048), OMP threads 2, median of
// 15 calls, two separate runs on a shared box. Keys are batch then positions.
export const CPU_MS: Record<string, [number, number]> = {
  B1_L6: [364.3, 368.2],
  B1_L11: [359.7, 373.2],
  B1_L16: [342.9, 373.8],
  B8_L6: [1211.8, 1404.2],
  B8_L11: [1297.1, 1345.9],
  B8_L16: [1273.7, 1399.1],
}

// Measured: PyTorch 2.14 CPU float32, the released G1 pose-predictor weights
// loaded (all keys matched), synthetic inputs, 2 threads, median of 15 calls,
// one run on a shared box. [median, min, max] ms. Keys are batch then positions.
export const TORCH_MS: Record<string, [number, number, number]> = {
  B1_L6: [93.9, 84.7, 114.5],
  B1_L11: [143.2, 128.1, 156.1],
  B1_L16: [162.5, 130.8, 189.7],
  B8_L6: [244.1, 198.5, 394.3],
  B8_L11: [298.0, 259.6, 356.6],
  B8_L16: [344.0, 284.3, 414.6],
}

// Counted from the shapes: multiply-adds x2 for the four big matrices of a
// layer plus the two attention products, one sample, one forward pass.
export const POSE_FLOPS: Record<number, number> = { 6: 1_612_972_032, 11: 2_960_719_872, 16: 4_311_744_512 }

// Measured: bytes of the pose transformer's weights in float32 (134,397,952 x 4).
export const POSE_WEIGHT_BYTES = 537_591_808
