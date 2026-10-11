// FrontierHarness Eval v1.0 results, copied from the benchmark's own data file
// (frontier-harness-eval/eval @ e837a70, results/eval-data.json). Each `tasks`
// string is one character per task, in the order of that file's `tasks` array:
// "1" = the verifier passed the single canonical attempt, "0" = it did not.
// `cost` is `effective_cost_per_pass` (total cost over all 30 tasks / passes).
//
// The rows below the baselines are not in that file. LobeHub's 21/30 is from
// its X post (one selected trial per task); the others are third-party
// candidate results submitted as pull requests to the same repository, each
// one attempt per task, none merged or verified by the maintainers.

export type Baseline = {
  id: string
  label: string
  k: number
  cost: number
  tasks: string
}

export const N_TASKS = 30

export const BASELINES: Baseline[] = [
  { id: "codex", label: "Codex", k: 20, cost: 3.47, tasks: "111111100011010011111110111000" },
  { id: "dsh-creator", label: "DSH Creator", k: 19, cost: 3.28, tasks: "111111100011010110111101100100" },
  { id: "claude-code", label: "Claude Code", k: 19, cost: 18.34, tasks: "111111110011010011111001101000" },
  { id: "pi", label: "Pi", k: 18, cost: 2.43, tasks: "111111101011110010111100001000" },
  { id: "dsh-ptc", label: "DSH PTC", k: 18, cost: 4.58, tasks: "111111110011010110111100100000" },
  { id: "dsh-standard", label: "DSH Standard", k: 18, cost: 3.46, tasks: "111111111011010010111001001000" },
  { id: "oh-my-pi", label: "Oh My Pi", k: 17, cost: 4.75, tasks: "111111110011010111110010000000" },
  { id: "kimi-code", label: "Kimi Code", k: 17, cost: 3.65, tasks: "111111100011010010111001001001" },
  { id: "dsh-minimal", label: "DSH Minimal", k: 17, cost: 4.72, tasks: "111111100011110010111000011000" },
  { id: "exo", label: "Exo Harness", k: 16, cost: 1.05, tasks: "111111110011010110111000000000" },
  { id: "opencode", label: "OpenCode", k: 15, cost: 3.24, tasks: "111111100011010111110000000000" },
  { id: "hermes", label: "Hermes", k: 15, cost: 2.9, tasks: "011111100011010010111000101000" },
]

export type Candidate = {
  id: string
  label: string
  k: number
  source: string
  selected: boolean
}

export const LOBEHUB: Candidate = {
  id: "lobehub",
  label: "LobeHub",
  k: 21,
  source: "X post, selected retries",
  selected: true,
}

export const CANDIDATES: Candidate[] = [
  { id: "alma", label: "Alma", k: 25, source: "PR #16, one attempt", selected: false },
  { id: "mcode", label: "MiniMax Code", k: 23, source: "PR #13, one attempt", selected: false },
  { id: "kot", label: "KOT", k: 23, source: "PR #9, one attempt", selected: false },
  { id: "maka", label: "Maka", k: 23, source: "PR #18, draft", selected: false },
]
