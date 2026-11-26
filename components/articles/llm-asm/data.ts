// Numbers for the llm.asm widgets. Each block says where it comes from.

// alesha-pro/llm.asm README (commit 48feccb), "Head-to-Head CPU Decode Benchmark":
// AMD EPYC 7642, Qwen3-0.6B Q8_0, 34 prompt / 64 generated tokens, 3-run mean, tok/s.
// The bare-metal column is the OS under QEMU KVM on the same host (no 40-thread run).
export const EPYC = {
  threads: [1, 4, 8, 16, 24, 32, 40],
  series: [
    { key: "fp32act", label: "llm.asm, FP32 activations (FAST_Q8=0)", values: [7.18, 28.12, 53.09, 77.5, 91.88, 96.63, 98.5] },
    { key: "llama", label: "llama.cpp Q8_0, CPU", values: [16.63, 51.08, 80.79, 103.03, 104.11, 103.82, 105.08] },
    { key: "fastq8", label: "llm.asm, INT8 x INT8 (FAST_Q8=1)", values: [20.7, 69.24, 103.64, 121.86, 123.72, 122.51, 125.86] },
    { key: "os", label: "llm.asm bare-metal OS, KVM guest", values: [23.67, 78.89, 118.08, 134.94, 132.9, 133.75, null] },
  ],
} as const

// Bytes of weights one decoded token streams, from the README's .asmbin v2 layout:
// 28 layers x 16,720,896 B, plus the tied LM head, 151,936 rows x 1,088 B (K=1024 row stride in v2).
// Prefill tokens skip the LM head (transformer_forward's compute_logits = 0).
export const LAYER_STRIDE = 16_720_896
export const N_LAYERS = 28
export const VOCAB = 151_936
export const ROW_1024 = 1_088
export const DECODE_BYTES = N_LAYERS * LAYER_STRIDE + VOCAB * ROW_1024 // 633,491,456
export const PREFILL_BYTES = N_LAYERS * LAYER_STRIDE // 468,185,088
export const ASMBIN_BYTES = 643_469_504

// Source lines (wc -l) per module, counted from the repository at each commit.
export const LINES = {
  initial: {
    label: "86cca09, first release",
    rows: [
      ["main.asm (CLI, chat template, loop)", 676],
      ["transformer.asm (forward pass, loader)", 764],
      ["math.asm (expf, sincos, norms, sampling)", 822],
      ["syscalls.asm (raw syscalls, printing)", 371],
      ["matmul.asm (Q8_0 kernels)", 360],
      ["threads.asm (clone + futex pool)", 318],
      ["tokenizer.asm (BPE, hash probe)", 236],
      ["constants.inc (offsets, syscall numbers)", 151],
    ] as [string, number][],
  },
  fastq8: {
    label: "48feccb, FAST_Q8",
    rows: [
      ["main.asm (CLI, chat template, loop)", 1029],
      ["transformer.asm (forward pass, loader)", 985],
      ["math.asm (expf, sincos, norms, sampling)", 876],
      ["syscalls.asm (raw syscalls, printing)", 371],
      ["matmul.asm (Q8_0 kernels)", 793],
      ["threads.asm (clone + futex pool)", 439],
      ["tokenizer.asm (BPE, hash probe)", 236],
      ["constants.inc (offsets, syscall numbers)", 157],
    ] as [string, number][],
  },
}

// ELF sections. Linux builds: size -A on binaries I built (NASM 2.16.03, GNU ld 2.46), which
// match the READMEs byte for byte. The OS split is the README's (I built the same 24,252 bytes).
// "Other" is the remainder: ELF and program headers and alignment padding.
export const ELF = {
  initial: { label: "First release (86cca09), Linux ELF", total: 12_120, text: 9_891, rodata: 1_625 },
  fastq8: { label: "FAST_Q8=1 (48feccb), Linux ELF", total: 14_712, text: 12_062, rodata: 2_039 },
  os: { label: "Bare-metal OS kernel", total: 24_252, text: 17_143, rodata: 2_772 },
}

// Code and constants each object file contributes to the linked ELF (.text + .rodata), from the
// linker map of my builds. The few bytes left over against the section totals are alignment.
export const OBJ_BYTES = {
  initial: [
    ["transformer.asm", 2562, 4],
    ["math.asm", 2150, 368],
    ["main.asm", 2051, 1185],
    ["matmul.asm", 1134, 0],
    ["threads.asm", 751, 0],
    ["syscalls.asm", 672, 48],
    ["tokenizer.asm", 539, 0],
  ] as [string, number, number][],
  fastq8: [
    ["transformer.asm", 2754, 4],
    ["math.asm", 2312, 400],
    ["main.asm", 3150, 1503],
    ["matmul.asm", 1657, 47],
    ["threads.asm", 942, 0],
    ["syscalls.asm", 672, 48],
    ["tokenizer.asm", 539, 0],
  ] as [string, number, number][],
}

// The .asmbin v2 file, from the README's format section (v2, FP16 scales).
export const ASMBIN_PARTS = [
  { label: "28 transformer layers", bytes: N_LAYERS * LAYER_STRIDE },
  { label: "Tied embedding / LM head", bytes: VOCAB * ROW_1024 },
  { label: "Header + tokenizer + merge table", bytes: ASMBIN_BYTES - N_LAYERS * LAYER_STRIDE - VOCAB * ROW_1024 },
]

// My run: Intel Core i7-14700 (8 P-cores with SMT + 12 E-cores, 28 threads, AVX2 + AVX-VNNI, no
// AVX-512), shared with other work (load average 13 to 28 during the run). Same prompt, 34 prompt /
// 64 generated tokens. llm.asm: mean of 3 runs. llama.cpp b12760 llama-bench -p 34 -n 64 -r 3, built
// AVX2-only (the EPYC's ISA) and native. Decode tok/s. 16 and 28 threads are left out: the box's load
// made them meaningless for both engines (see the article).
export const I7 = {
  threads: [1, 4, 8],
  series: [
    { key: "fp32act", label: "llm.asm, FP32 activations (FAST_Q8=0)", values: [20.64, 50.63, 41.62] },
    { key: "llama", label: "llama.cpp Q8_0, AVX2-only build", values: [22.06, 45.26, 27.64] },
    { key: "llamanative", label: "llama.cpp Q8_0, native build", values: [13.23, 49.01, 32.86] },
    { key: "fastq8", label: "llm.asm, INT8 x INT8 (FAST_Q8=1)", values: [28.4, 65.81, 61.61] },
  ],
} as const
