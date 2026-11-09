// Generated from my simulator runs (sim.py, two seeds per point). Do not edit by hand;
// see the FlashState article for the method.

export type SweepPoint = { hit_rate: number; uncached_p50: number; redundant_per_req: number; user_cost_per_M: number }

export const SWEEP: Record<string, Record<number, SweepPoint>> = {
  vllm: {
    16: { hit_rate: 0.8759, uncached_p50: 4000, redundant_per_req: 14092, user_cost_per_M: 0.0449 },
    24: { hit_rate: 0.7668, uncached_p50: 4416, redundant_per_req: 25659, user_cost_per_M: 0.0580 },
    32: { hit_rate: 0.6110, uncached_p50: 4832, redundant_per_req: 48068, user_cost_per_M: 0.0766 },
    40: { hit_rate: 0.4427, uncached_p50: 7744, redundant_per_req: 74436, user_cost_per_M: 0.0969 },
    48: { hit_rate: 0.2750, uncached_p50: 48512, redundant_per_req: 103123, user_cost_per_M: 0.1170 },
    56: { hit_rate: 0.1482, uncached_p50: 88864, redundant_per_req: 130812, user_cost_per_M: 0.1322 },
  },
  asc_lru: {
    16: { hit_rate: 0.8368, uncached_p50: 1136, redundant_per_req: 20938, user_cost_per_M: 0.0496 },
    24: { hit_rate: 0.6957, uncached_p50: 2464, redundant_per_req: 36658, user_cost_per_M: 0.0665 },
    32: { hit_rate: 0.5276, uncached_p50: 3680, redundant_per_req: 60605, user_cost_per_M: 0.0867 },
    40: { hit_rate: 0.3775, uncached_p50: 12574, redundant_per_req: 85222, user_cost_per_M: 0.1047 },
    48: { hit_rate: 0.2150, uncached_p50: 63712, redundant_per_req: 112484, user_cost_per_M: 0.1242 },
    56: { hit_rate: 0.1245, uncached_p50: 97696, redundant_per_req: 134848, user_cost_per_M: 0.1351 },
  },
  asc_unit: {
    16: { hit_rate: 0.8589, uncached_p50: 1118, redundant_per_req: 17145, user_cost_per_M: 0.0469 },
    24: { hit_rate: 0.7980, uncached_p50: 2024, redundant_per_req: 21338, user_cost_per_M: 0.0542 },
    32: { hit_rate: 0.7308, uncached_p50: 2102, redundant_per_req: 30314, user_cost_per_M: 0.0623 },
    40: { hit_rate: 0.6753, uncached_p50: 2464, redundant_per_req: 38900, user_cost_per_M: 0.0689 },
    48: { hit_rate: 0.5991, uncached_p50: 2950, redundant_per_req: 50916, user_cost_per_M: 0.0781 },
    56: { hit_rate: 0.4883, uncached_p50: 4576, redundant_per_req: 73198, user_cost_per_M: 0.0914 },
  },
  flashstate: {
    16: { hit_rate: 0.8913, uncached_p50: 1292, redundant_per_req: 11486, user_cost_per_M: 0.0430 },
    24: { hit_rate: 0.8185, uncached_p50: 2654, redundant_per_req: 18266, user_cost_per_M: 0.0518 },
    32: { hit_rate: 0.7600, uncached_p50: 3104, redundant_per_req: 26798, user_cost_per_M: 0.0588 },
    40: { hit_rate: 0.6873, uncached_p50: 3776, redundant_per_req: 37892, user_cost_per_M: 0.0675 },
    48: { hit_rate: 0.5993, uncached_p50: 4948, redundant_per_req: 52124, user_cost_per_M: 0.0781 },
    56: { hit_rate: 0.5310, uncached_p50: 6976, redundant_per_req: 78526, user_cost_per_M: 0.0863 },
  },
}
