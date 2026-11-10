// Measured: our CPU run (SmolLM2-135M-Instruct, fp32, seed 0, 150 Adam steps of 4 items, constant learning rate).
// ce = held-out cross-entropy on the fact's replies; F = KL(original || edited) per token on 84 unrelated items
// (7 domains, macro mean); hit / near / chat = greedy replies (28 tokens) that contain the name, of 12 / 16 / 16.
export type SweepRow = { method: string; lr: number; ok: boolean; ce: number; F: number; hit: number; near: number; chat: number }
export const CE0 = 2.3522
export const METHODS = [
  { id: "neurons8", label: "8 selective neurons", color: "oklch(0.58 0.15 255)", params: 4616 },
  { id: "dense8", label: "8 neurons that fire everywhere", color: "oklch(0.66 0.17 45)", params: 4616 },
  { id: "lora_small", label: "rank-2 LoRA, layer 0", color: "oklch(0.55 0.02 255)", params: 4224 },
  { id: "lora_small25", label: "rank-2 LoRA, layer 25", color: "oklch(0.62 0.12 150)", params: 4224 },
  { id: "lora_std", label: "rank-8 LoRA, every linear layer", color: "oklch(0.56 0.14 320)", params: 2442240 },
]
export const SWEEP: SweepRow[] = [
  {"method": "neurons8", "lr": 0.003, "ok": true, "ce": 1.6602, "F": 0.0008031, "hit": 0, "near": 0, "chat": 0},
  {"method": "neurons8", "lr": 0.01, "ok": true, "ce": 0.8501, "F": 0.003393, "hit": 7, "near": 12, "chat": 0},
  {"method": "neurons8", "lr": 0.03, "ok": true, "ce": 0.448, "F": 0.006376, "hit": 10, "near": 13, "chat": 0},
  {"method": "neurons8", "lr": 0.1, "ok": true, "ce": 0.216, "F": 0.01703, "hit": 9, "near": 13, "chat": 0},
  {"method": "dense8", "lr": 0.003, "ok": true, "ce": 2.1967, "F": 0.0008806, "hit": 0, "near": 0, "chat": 0},
  {"method": "dense8", "lr": 0.01, "ok": true, "ce": 1.914, "F": 0.007831, "hit": 0, "near": 0, "chat": 0},
  {"method": "dense8", "lr": 0.03, "ok": true, "ce": 1.4521, "F": 0.05522, "hit": 0, "near": 0, "chat": 0},
  {"method": "dense8", "lr": 0.1, "ok": true, "ce": 0.2871, "F": 0.5072, "hit": 9, "near": 15, "chat": 1},
  {"method": "lora_small", "lr": 0.0003, "ok": true, "ce": 1.9129, "F": 0.001342, "hit": 0, "near": 0, "chat": 0},
  {"method": "lora_small", "lr": 0.001, "ok": true, "ce": 1.0108, "F": 0.01926, "hit": 0, "near": 0, "chat": 0},
  {"method": "lora_small", "lr": 0.003, "ok": true, "ce": 0.3494, "F": 0.06533, "hit": 7, "near": 1, "chat": 0},
  {"method": "lora_small", "lr": 0.01, "ok": true, "ce": 0.254, "F": 0.1549, "hit": 12, "near": 11, "chat": 0},
  {"method": "lora_std", "lr": 3e-05, "ok": true, "ce": 0.3279, "F": 0.02067, "hit": 11, "near": 11, "chat": 0},
  {"method": "lora_std", "lr": 0.0001, "ok": true, "ce": 0.1922, "F": 0.07474, "hit": 12, "near": 13, "chat": 0},
  {"method": "lora_std", "lr": 0.0003, "ok": true, "ce": 0.1862, "F": 0.1309, "hit": 12, "near": 14, "chat": 0},
  {"method": "lora_std", "lr": 0.001, "ok": true, "ce": 0.2236, "F": 0.2471, "hit": 12, "near": 16, "chat": 3},
  {"method": "lora_small25", "lr": 0.001, "ok": true, "ce": 0.7822, "F": 0.008787, "hit": 10, "near": 11, "chat": 0},
  {"method": "lora_small25", "lr": 0.003, "ok": true, "ce": 0.3165, "F": 0.04903, "hit": 11, "near": 15, "chat": 1},
  {"method": "lora_small25", "lr": 0.01, "ok": true, "ce": 0.1771, "F": 0.1883, "hit": 11, "near": 16, "chat": 0},
  {"method": "lora_std", "lr": 3e-06, "ok": true, "ce": 1.9914, "F": 0.0002416, "hit": 0, "near": 0, "chat": 0},
  {"method": "lora_std", "lr": 1e-05, "ok": true, "ce": 1.4192, "F": 0.002003, "hit": 0, "near": 0, "chat": 0},
]
