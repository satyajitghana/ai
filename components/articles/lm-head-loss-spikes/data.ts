// Measured on a shared 4-core cloud VM, CPU only, NumPy 2.5.3, by scripts kept
// out of the tree (BF16 simulated by rounding fp32 bits to nearest even).
//
// STATIC_ROWS: 64 rows of 50,257 Gaussian logits (std 2). Every logit is shifted
// by -shift and rounded to the format; rms is the RMS logit error after undoing
// the shift, kl the mean KL(p_exact || p_rounded) per row.
//
// LEDGER: one optimizer step of the toy LM head (V 2,048, d 64, Adam lr 0.01,
// BF16 mixed) at step 2,000. For every vocabulary row, the step's component
// along the mean hidden state (its effect on that row's logit for an average
// context), summed over frequency-rank bins. "mom" is the momentum buffer SGD-M
// would apply, "adam" the bias-corrected Adam direction m/(sqrt(v)+eps); both per
// unit learning rate.

export type StaticRow = { shift: number; bf16: { rms: number; kl: number }; fp16: { rms: number; kl: number } }

export const STATIC_ROWS: StaticRow[] = [{"shift": 0, "bf16": {"rms": 0.0033, "kl": 2.67e-05}, "fp16": {"rms": 0.0004, "kl": 4.12e-07}}, {"shift": 8, "bf16": {"rms": 0.0142, "kl": 2.69e-05}, "fp16": {"rms": 0.0018, "kl": 4.21e-07}}, {"shift": 32, "bf16": {"rms": 0.0571, "kl": 0.000699}, "fp16": {"rms": 0.0071, "kl": 1.08e-05}}, {"shift": 64, "bf16": {"rms": 0.1141, "kl": 0.00278}, "fp16": {"rms": 0.0143, "kl": 4.35e-05}}, {"shift": 128, "bf16": {"rms": 0.2283, "kl": 0.0111}, "fp16": {"rms": 0.0285, "kl": 0.000174}}, {"shift": 256, "bf16": {"rms": 0.4563, "kl": 0.0438}, "fp16": {"rms": 0.0571, "kl": 0.000699}}, {"shift": 512, "bf16": {"rms": 0.9099, "kl": 0.167}, "fp16": {"rms": 0.1141, "kl": 0.00278}}, {"shift": 1024, "bf16": {"rms": 1.5453, "kl": 0.597}, "fp16": {"rms": 0.2283, "kl": 0.0111}}, {"shift": 2048, "bf16": {"rms": 1.93, "kl": 2.23}, "fp16": {"rms": 0.4563, "kl": 0.0438}}]

export type LedgerBin = { ranks: string; n: number; mom: number; adam: number }

export const LEDGER = {"bins": [{"ranks": "1-4", "n": 4, "mom": -0.08287, "adam": 0.571}, {"ranks": "5-16", "n": 12, "mom": 0.5843, "adam": 49.83}, {"ranks": "17-64", "n": 48, "mom": 0.7416, "adam": 134.9}, {"ranks": "65-256", "n": 192, "mom": 0.5507, "adam": 519.1}, {"ranks": "257-1024", "n": 768, "mom": -0.5946, "adam": 1958.0}, {"ranks": "1025-2048", "n": 1024, "mom": -1.199, "adam": 2710.0}], "tot_mom": -5.087013343896274e-08, "tot_adam": 5373.00982487872, "abs_mom": 12.301632437506209, "abs_adam": 9594.501953658091} as {
  bins: LedgerBin[]
  tot_mom: number
  tot_adam: number
  abs_mom: number
  abs_adam: number
}
