// Numbers behind the sam3-onnx widgets. Each is tagged where it comes from:
//   measured = my run on a shared 4 vCPU box (onnxruntime 1.31.1 CPU, 2 threads, v0.6.0 files)
//   reported = the sam3-onnx / osam benchmark doc (docs/benchmark.md, 2026-10-31, dogs.jpg 2560x1600)

export type Device = {
  id: string
  label: string
  src: "reported" | "measured"
  encode: number // ms
  point: number
  box: number
  negBox: number
  text: number
}

export const DEVICES: Device[] = [
  { id: "cuda", label: "CUDA, RTX 3080 Ti", src: "reported", encode: 347, point: 27, box: 72, negBox: 72, text: 74 },
  { id: "coreml", label: "CoreML, Apple M5", src: "reported", encode: 2466, point: 61, box: 375, negBox: 376, text: 376 },
  { id: "webgpu", label: "WebGPU, RTX 3080 Ti", src: "reported", encode: 741, point: 57, box: 199, negBox: 196, text: 203 },
  { id: "cpu-i9", label: "CPU, i9-12900K", src: "reported", encode: 6563, point: 83, box: 1152, negBox: 1162, text: 1162 },
  { id: "cpu-m5", label: "CPU, Apple M5", src: "reported", encode: 15341, point: 64, box: 1475, negBox: 1489, text: 1519 },
  // measured on this box (see the article). encode = mean of two warm runs (46.4 s, 47.8 s); point = two passes of the point decoder at ~217 ms;
  // box / negBox = median of the decoder sweep over 0-16 live box slots (4.6-6.2 s, flat within noise); text = that plus the language encoder (593 ms).
  { id: "cpu-mine", label: "CPU, 2 threads of a shared VM", src: "measured", encode: 47100, point: 440, box: 5600, negBox: 5600, text: 6200 },
]

// Graph files (v0.6.0): bytes from the Hugging Face file listing, nodes and params from onnx.load.
export const GRAPHS = {
  image: { file: "sam3_image_encoder.onnx", bytes: 1858609604, nodes: 2366, params: 464055783 },
  language: { file: "sam3_language_encoder.onnx", bytes: 1616390301 },
  decoder: { file: "sam3_decoder.onnx", bytes: 129943466, nodes: 4861, params: 32022069 },
  point: { file: "sam3_point_decoder.onnx", bytes: 16635774, nodes: 1427, params: 4065072 },
}

// Tensors leaving the image encoder, float32, batch 1.
export const TENSORS = [
  { name: "vision_pos_enc_0", shape: [256, 288, 288], used: "nobody" },
  { name: "vision_pos_enc_1", shape: [256, 144, 144], used: "nobody" },
  { name: "vision_pos_enc_2", shape: [256, 72, 72], used: "decoder" },
  { name: "backbone_fpn_0", shape: [256, 288, 288], used: "decoder" },
  { name: "backbone_fpn_1", shape: [256, 144, 144], used: "decoder" },
  { name: "backbone_fpn_2", shape: [256, 72, 72], used: "decoder" },
  { name: "image_embeddings", shape: [256, 72, 72], used: "point decoder" },
  { name: "high_res_features1", shape: [32, 288, 288], used: "point decoder" },
  { name: "high_res_features2", shape: [64, 144, 144], used: "point decoder" },
] as const

export const mb = (n: number) => n / 1e6
export const tensorBytes = (s: readonly number[]) => s.reduce((a, b) => a * b, 4)
