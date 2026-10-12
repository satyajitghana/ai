// Numbers for the RSI-Anything widgets. Every value is copied from a primary
// file, named next to it:
//   paper  = arXiv 2610.13912v1 (text, Tables 2-3, Figures 3-6)
//   gui    = tasks/gui/docs/RESULTS.md in Gen-Verse/RSI-Anything @ 99dbf00
//   rxn    = tasks/reaction_optimization/results/evaluation.json @ 99dbf00
//   cr     = tasks/code_repair/config/validation.json @ 99dbf00

export type DomainId = "code" | "gui" | "lab" | "rxn"

export const STATIONS = [
  { id: "propose", label: "Propose" },
  { id: "predict", label: "Predict" },
  { id: "select", label: "Select" },
  { id: "evaluate", label: "Evaluate" },
  { id: "update", label: "Update" },
  { id: "retain", label: "Retain" },
] as const

export type StationId = (typeof STATIONS)[number]["id"]

// "live" = the released code does this step for the headline number;
// "partial" = it does a weaker or offline version; "off" = the step is absent
// from the headline run.
export type Status = "live" | "partial" | "off"

export type StationNote = { status: Status; text: string }

export type Round = { label: string; value: number; changed: string }

export type Domain = {
  id: DomainId
  label: string
  metric: string
  unit: string
  rounds: Round[]
  stations: Record<StationId, StationNote>
}

export const DOMAINS: Domain[] = [
  {
    id: "code",
    label: "Code repair",
    metric: "CodeContests hidden-test all-pass, 600 task-seed runs",
    unit: "%",
    rounds: [
      { label: "random pick", value: 26.0, changed: "No predictor. One of the four revisions is executed at random." },
      { label: "static verifier", value: 26.3, changed: "A capacity-matched verifier ranks the four revisions instead." },
      {
        label: "fixed world model",
        value: 29.2,
        changed:
          "W1, a 3B LoRA on Qwen2.5-Coder, ranks the four revisions by predicted execution class. Same coder, same candidates.",
      },
      {
        label: "adapted world model",
        value: 31.2,
        changed:
          "W1 retrained offline through four stages on execution records from 2,200 training problems. The coder is still frozen.",
      },
    ],
    stations: {
      propose: { status: "live", text: "ReasonFlux-Coder-7B writes four revisions per round, up to three rounds. It is never updated." },
      predict: { status: "live", text: "W1 scores each revision against each public test: five execution classes, plus a whole-suite pass probability." },
      select: { status: "live", text: "Score = P(full-suite pass) + 0.25 x predicted pass fraction. A revision replaces the incumbent only if it scores strictly higher." },
      evaluate: { status: "live", text: "The chosen revision runs on the public tests: 3.72 online test-suite calls per task. Hidden tests are judged once, at the end." },
      update: {
        status: "partial",
        text: "The world model is retrained between versions on recorded TRAIN transitions. Evaluation performs no optimizer updates; nothing learns during the 600 runs.",
      },
      retain: {
        status: "partial",
        text: "The released checkpoint's manifest says automatic_promotion: false. The four training stages run in a fixed order with no gate between them.",
      },
    },
  },
  {
    id: "gui",
    label: "GUI agent",
    metric: "MiniWoB++ click-checkboxes, strict success on 100 test instances",
    unit: "%",
    rounds: [
      { label: "baseline", value: 51, changed: "ReasonFlux-Coder-7B proposes the top four actions; the development gate picked alpha = 0, so its own ranking acts." },
      {
        label: "update 1",
        value: 79,
        changed:
          "LoRA fine-tune on actions from its own successful episodes, plus replay. The world model retrains on real transitions and expert continuations. Promoted: dev gain at least 4 points, cost at most 1.2x.",
      },
      {
        label: "update 2",
        value: 99,
        changed: "Same recipe on a fresh 100-instance collection. Repeated clicks go from 237 at baseline to 0.",
      },
    ],
    stations: {
      propose: { status: "live", text: "The policy, ReasonFlux-Coder-7B with a LoRA, ranks legal clicks and Submit; the top four, Submit always included, are candidates." },
      predict: { status: "live", text: "An OPF world model on a Qwen2.5-Coder-3B encoder predicts each action's next state, discounted return and submit success." },
      select: {
        status: "off",
        text: "The development gate chose alpha = 0 every time, and at alpha = 0 the code returns world_used: False. The reported 51, 79 and 99 never consult the world model.",
      },
      evaluate: { status: "live", text: "Real Chromium episodes: 120 seconds, at most eight actions, success only if every box matches and the form is submitted." },
      update: { status: "live", text: "Both components change: positive-only policy SFT, at most 256 new actions plus equal replay, one epoch; the world model retrains on the new branches." },
      retain: { status: "live", text: "One gate on the assembled pair: promote if development success rises at least 4 points at no more than 1.2x the cost. Both updates passed." },
    },
  },
  {
    id: "lab",
    label: "Lab planning",
    metric: "LabHorizon F200 Level-2 Final Score, 200 tasks",
    unit: "%",
    rounds: [
      { label: "initial", value: 21.8, changed: "A 4B planning policy. The paper does not say how this starting point was trained." },
      { label: "version 2", value: 38.03, changed: "Retained policy version. The update route is not described in the paper and the adapters are not released." },
      { label: "version 3", value: 41.99, changed: "Retained policy version." },
      { label: "version 4", value: 44.56, changed: "Retained policy version." },
      { label: "final", value: 46.01, changed: "0.69 points above the Actor-Simulator-Selector reference at 45.32." },
    ],
    stations: {
      propose: { status: "partial", text: "Qwen3.5-4B-Base with a local planning adapter: one greedy plan and three sampled ones. The adapters are not in the release." },
      predict: {
        status: "live",
        text: "Five small MLPs over 544 hashed text and plan-structure features predict quality, gain and risk. The OPF projector is only called when you ask for factors.",
      },
      select: { status: "live", text: "Score = quality + 0.25 x gain - 0.1 x risk - 0.1 x uncertainty, illegal plans excluded." },
      evaluate: { status: "partial", text: "The paper calls it development feedback. What it was, and on which tasks, is not stated." },
      update: { status: "partial", text: "Five policy versions from one process. How each was trained is not in the paper or the repository." },
      retain: { status: "partial", text: "Versions are reported in development order. No gate, threshold or rejected version is reported." },
    },
  },
  {
    id: "rxn",
    label: "Reaction yield",
    metric: "Suzuki flow LC-MS screen, mean best observed yield, 100 runs",
    unit: "%",
    rounds: [
      { label: "8 experiments", value: 71.944, changed: "Eight random measured conditions, the same starting design for both methods." },
      { label: "9 experiments", value: 80.1436, changed: "Expected improvement on the frozen prior picks the next condition. The paper's figure shows 95.06 here; the released replay gives 80.14." },
      { label: "10 experiments", value: 96.15, changed: "All 100 runs have found the best condition in the 321-row pool by now. 96.15 is that condition's measured yield." },
      { label: "40 experiments", value: 96.15, changed: "Nothing left to find: the metric cannot rise above the pool's best row. Bayesian optimization is at 82.16." },
    ],
    stations: {
      propose: { status: "live", text: "Every unmeasured row of a fixed 321-row grid: 12 ligands, 8 bases, 4 solvents, Pd(OAc)2." },
      predict: {
        status: "live",
        text: "A frozen table of predicted mean and calibrated spread per row. The readout is an ExtraTrees regressor on 32 PCA coordinates of JEPA states, a raw JEPA yield and one-hot conditions.",
      },
      select: { status: "live", text: "Gaussian expected improvement over the best yield so far, one condition at a time, ties to the lower id." },
      evaluate: { status: "partial", text: "Offline replay: the 'experiment' looks up a yield already measured in the published screen." },
      update: { status: "off", text: "online_prediction_update: false. Feedback only moves the incumbent and removes measured rows. No model changes." },
      retain: { status: "off", text: "There is no new version to retain." },
    },
  },
]

// ---- Claim ledger --------------------------------------------------------

export const CODE_BARS = [
  { label: "Random-K", value: 26.0, calls: 3.72 },
  { label: "Static verifier", value: 26.3, calls: 3.72 },
  { label: "Fixed world model", value: 29.2, calls: 3.71 },
  { label: "Adapted world model", value: 31.2, calls: 3.72 },
]
// paper, Section 3.1: paired fixed-WM minus static verifier, 95% interval
export const CODE_PAIRED = { gain: 2.83, lo: 0.17, hi: 5.5 }
// cr: the released incumbent checkpoint, 188 of 600, per seed out of 200
export const CODE_SEEDS = [69, 62, 57]
export const CODE_TRANSFER = [
  { bench: "APPS Introductory", initial: 37.9, random: 44.07, stat: 44.0, rsi: 46.37 },
  { bench: "LiveCodeBench v6", initial: 25.24, random: 31.18, stat: 30.74, rsi: 33.05 },
]

// gui: the RSI-test cohort (seeds 270000-270099). "selected" is the reported
// controller (alpha = 0, policy ranking); "pure" ranks the same four
// candidates by world-model value.
export type Cell = { success: number; steps: number; repeats: number; wrong: number }
export const GUI_CROSS: {
  update: 1 | 2
  arms: { policy: "old" | "new"; world: "old" | "new"; selected: Cell; pure: Cell }[]
}[] = [
  {
    update: 1,
    arms: [
      { policy: "old", world: "old", selected: { success: 51, steps: 5.3, repeats: 237, wrong: 9 }, pure: { success: 49, steps: 5.6, repeats: 258, wrong: 1 } },
      { policy: "old", world: "new", selected: { success: 51, steps: 5.3, repeats: 237, wrong: 9 }, pure: { success: 95, steps: 3.88, repeats: 59, wrong: 1 } },
      { policy: "new", world: "old", selected: { success: 79, steps: 2.93, repeats: 2, wrong: 21 }, pure: { success: 50, steps: 5.59, repeats: 255, wrong: 0 } },
      { policy: "new", world: "new", selected: { success: 79, steps: 2.93, repeats: 2, wrong: 21 }, pure: { success: 96, steps: 3.83, repeats: 53, wrong: 0 } },
    ],
  },
  {
    update: 2,
    arms: [
      { policy: "old", world: "old", selected: { success: 79, steps: 2.93, repeats: 2, wrong: 21 }, pure: { success: 96, steps: 3.83, repeats: 53, wrong: 0 } },
      { policy: "old", world: "new", selected: { success: 79, steps: 2.93, repeats: 2, wrong: 21 }, pure: { success: 98, steps: 3.76, repeats: 48, wrong: 2 } },
      { policy: "new", world: "old", selected: { success: 99, steps: 3.21, repeats: 0, wrong: 1 }, pure: { success: 98, steps: 3.82, repeats: 50, wrong: 0 } },
      { policy: "new", world: "new", selected: { success: 99, steps: 3.21, repeats: 0, wrong: 1 }, pure: { success: 98, steps: 3.78, repeats: 48, wrong: 2 } },
    ],
  },
]
// gui: baseline_rule, a scripted controller, on the world-test cohort
export const GUI_RULE = { success: 100, steps: 2.87 }

// paper Table 3 and Figure 5
export const LAB_VERSIONS = [21.8, 38.03, 41.99, 44.56, 46.01]
export const LAB_REFS = [
  { label: "Actor-Simulator-Selector", value: 45.32 },
  { label: "Qwen3.6-35B-A3B, trained", value: 41.0 },
  { label: "Gemini 3.1 Pro", value: 32.63 },
  { label: "GPT-5.5", value: 22.76 },
]

// Reaction yield race. Bayesian optimization points are the four the paper
// labels on Figure 6e; between them the widget draws a straight line, which is
// not the paper's curve. The two RSI series are the paper's labels and the
// released replay (rxn: mean_best_observed_yield_percent_by_budget).
export const RXN_POOL_BEST = 96.15
export const RXN_BO: [number, number][] = [
  [8, 71.94],
  [10, 73.59],
  [20, 79.16],
  [40, 82.16],
]
export const RXN_PAPER: [number, number][] = [
  [8, 71.94],
  [9, 95.06],
  [10, 96.15],
  [40, 96.15],
]
export const RXN_RELEASE: [number, number][] = [
  [8, 71.944],
  [9, 80.1436],
  [10, 96.15],
  [11, 96.15],
  [12, 96.15],
  [16, 96.15],
  [24, 96.15],
  [40, 96.15],
]
