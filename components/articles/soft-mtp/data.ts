// Generated from public/articles/soft-mtp/code/results.jsonl by summarize.py; every number is a run output.
export type TrainMetric = { id: "ntp" | "mtp" | "kl" | "agree" | "len"; label: string; note: string; better: string; digits: number }
export const TRAIN = {
  seeds: 3,
  metrics: [{"id": "ntp", "label": "val NTP loss", "note": "Validation next-token loss, nats per token.", "better": "Lower is better.", "digits": 4}, {"id": "mtp", "label": "extra-head loss", "note": "Mean cross-entropy of the three extra heads on their own targets.", "better": "Lower is better.", "digits": 3}, {"id": "kl", "label": "KL to verifier", "note": "Mean kl from the ntp distribution to each head's distribution (teacher-forced).", "better": "Lower is better.", "digits": 4}, {"id": "agree", "label": "agreement", "note": "How often each head's top token equals the ntp head's top token at the aligned position, mean over heads.", "better": "Higher is better.", "digits": 3}, {"id": "len", "label": "accepted length", "note": "Expected tokens accepted per draft round if the three heads agree independently, teacher-forced.", "better": "Higher is better.", "digits": 3}] as TrainMetric[],
  objectives: [
    { id: "ntp", label: "next-token only", values: {"ntp": [5.620731254418691, 5.588583509127299, 5.62151163816452]} as Partial<Record<TrainMetric["id"], number[]>>, mean: {"ntp": 5.6102754672368365} as Partial<Record<TrainMetric["id"], number>> },
    { id: "mtp", label: "standard MTP", values: {"ntp": [5.535226841767629, 5.530740837256114, 5.558511197566986], "mtp": [5.375319891505772, 5.374933818976085, 5.394481082757314], "kl": [0.18451961357560423, 0.17826504591438505, 0.18253538095288804], "agree": [0.6370649544729127, 0.5758148348993726, 0.5756789859798219], "len": [2.3465540635990663, 2.1162852523694338, 2.1400356948882835]} as Partial<Record<TrainMetric["id"], number[]>>, mean: {"ntp": 5.541492958863576, "mtp": 5.381578264413057, "kl": 0.18177334681429244, "agree": 0.5961862584507024, "len": 2.200958336952261} as Partial<Record<TrainMetric["id"], number>> },
    { id: "kl", label: "explicit KL", values: {"ntp": [5.618933935960134, 5.589572687943776, 5.618456224600474], "mtp": [5.704260448614757, 5.665533734692468, 5.6882996625370446], "kl": [0.07065153629001644, 0.07410789891663525, 0.06728389766067266], "agree": [0.7601860115925471, 0.7036651993791262, 0.7108307720886337], "len": [2.784547774942899, 2.5563477860884842, 2.577764735140879]} as Partial<Record<TrainMetric["id"], number[]>>, mean: {"ntp": 5.608987616168128, "mtp": 5.68603128194809, "kl": 0.07068111095577478, "agree": 0.7248939943534357, "len": 2.6395534320574208} as Partial<Record<TrainMetric["id"], number>> },
    { id: "soft", label: "Soft-MTP", values: {"ntp": [5.668542464574178, 5.637562712033589, 5.6759317715962725], "mtp": [5.734728892644246, 5.696585489643945, 5.73304757144716], "kl": [0.06160087138414383, 0.0640473239020341, 0.06076833548852139], "agree": [0.7796457981069883, 0.720529507431719, 0.70742051055034], "len": [2.8706503780903554, 2.6205296913590095, 2.561008812157934]} as Partial<Record<TrainMetric["id"], number[]>>, mean: {"ntp": 5.66067898273468, "mtp": 5.72145398457845, "kl": 0.06213884359156644, "agree": 0.7358652720296824, "len": 2.684062960535766} as Partial<Record<TrainMetric["id"], number>> },
  ],
  snr: [["SNR, KL component / residual, plain-MTP model", "2.07 / 0.34"], ["SNR, KL component / residual, Soft-MTP model", "0.43 / 0.15"], ["gradient norm vs the hard gradient, KL / residual, plain-MTP model", "0.67 / 1.23"], ["gradient norm vs the hard gradient, KL / residual, Soft-MTP model", "0.21 / 0.97"]] as [string, string][] | null,
}

export const TRAIN_META =
  "Toy runs, not a replication: a 537,856-parameter transformer (two trunk layers, width 64, three sequential MTP heads) trained for 300 steps on 542,232 BPE tokens of three public-domain books, evaluated on the held-out tenth, three seeds per objective."

export const RANK_167M = [
  { id: "next", label: "next-token only", value: 468.2532393215104 },
  { id: "standard", label: "standard MTP", value: 436.3725095663306 },
  { id: "soft", label: "Soft-MTP", value: 464.5306811571121 },
]

export const RANK_PAPER_1P2B = [
  { id: "next", label: "next-token only", value: 496 },
  { id: "standard", label: "standard MTP", value: 131 },
  { id: "kl", label: "explicit KL", value: 321 },
  { id: "soft", label: "Soft-MTP", value: 437 },
]

export const COST = {
  setup: "one combined loss step on CPU: 512 tokens, width 512, vocabulary 50,304, three heads; mean of two runs",
  maxCpu: 7.5,
  maxMb: 1600,
  rows: [
    { id: "standard", label: "standard MTP", cpu: 4.8135, cpuDelta: "", mb: 1143.5, mbLabel: "1.14 GB", mbDelta: "" },
    { id: "soft", label: "Soft-MTP", cpu: 5.0765, cpuDelta: "+5.5%", mb: 1113.5, mbLabel: "1.11 GB", mbDelta: "within spread" },
    { id: "kl", label: "explicit KL", cpu: 7.051, cpuDelta: "+46%", mb: 1505.5, mbLabel: "1.51 GB", mbDelta: "+32%" },
  ],
  note: "CPU seconds (process time) on a heavily loaded machine; the two Soft-MTP runs differ by 0.3 s, so read its +5.5% as noise-level. Explicit KL materialises a teacher and a student distribution over the vocabulary for every head.",
}
