// Every number in this file was printed by the toy in public/articles/on-policy-self-training/code/
// (numpy, CPU, 30 seeds, 20 labelled pretraining points). Accuracies are on 4,000 fresh points per
// region; curves are means over seeds, one [in-domain, out-of-domain] pair per round (round 0 = base).
// PAPER_* constants are the paper's Table 5c and Table 6 (reported, Gemma 4 E2B, MMLU).

export const BASE = {"in": 0.8, "out": 0.788, "inSd": 0.066}

export const TRUST = {"edges": [0.375, 0.5, 0.625, 0.75, 0.875, 1.0], "otherHint": [0.375, 0.283, 0.254, 0.185, 0.025], "ownHint": [0.72, 0.822, 0.877, 0.929, 0.994]}

// wrong-answer fraction -> [mean, sd] in-domain accuracy, filters off
export const WRONG = {"0.0": {"opst": [0.842, 0.049], "sft": [0.866, 0.029]}, "0.25": {"opst": [0.831, 0.053], "sft": [0.778, 0.061]}, "0.5": {"opst": [0.809, 0.065], "sft": [0.632, 0.064]}, "0.75": {"opst": [0.78, 0.078], "sft": [0.423, 0.06]}}

export const PAPER_WRONG = {"0": {"opst": 42.7, "sft": 38.8}, "25": {"opst": 42.1, "sft": 38.1}, "50": {"opst": 41.4, "sft": 35.4}, "75": {"opst": 40.8, "sft": 33.1}}

export const PAPER_BASE_MMLU = 37.5

export const SERIES: Record<string, number[][]> = {
  "A: own labels, OPST": [[0.8, 0.788], [0.801, 0.781], [0.802, 0.775], [0.802, 0.769], [0.801, 0.763], [0.801, 0.757], [0.801, 0.749], [0.799, 0.742]],
  "A: own labels, SFT": [[0.8, 0.788], [0.8, 0.764], [0.8, 0.745], [0.798, 0.73], [0.795, 0.721], [0.794, 0.707], [0.791, 0.693], [0.789, 0.682]],
  "A: own labels, OPST with no EMA": [[0.8, 0.788], [0.8, 0.767], [0.798, 0.752], [0.794, 0.738], [0.79, 0.729], [0.782, 0.72], [0.776, 0.71], [0.774, 0.702]],
  "B: 90% right labels, OPST": [[0.8, 0.788], [0.813, 0.781], [0.819, 0.774], [0.821, 0.767], [0.824, 0.761], [0.826, 0.757], [0.826, 0.753], [0.827, 0.749]],
  "B: 90% right labels, SFT": [[0.8, 0.788], [0.826, 0.765], [0.839, 0.748], [0.844, 0.735], [0.847, 0.726], [0.85, 0.723], [0.852, 0.72], [0.852, 0.712]],
}
