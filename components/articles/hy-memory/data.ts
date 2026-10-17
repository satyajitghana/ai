// Two sources, both checked by hand against the files they came from.
//
// 1. RUN: what the real Hy Memory engine (hy-memory 2.0.1, commit fba347a) did
//    when I drove HyMemoryClient(mode="pro") through two turns on a shared
//    4-core cloud VM, CPU only. The model behind it was a localhost stub of
//    mine (rule-based replies, hashed bag-of-words embeddings), so the
//    *decisions* are the stub's, but everything the engine did around them —
//    which calls it made, what it put in front of the model, what it stored,
//    what search returned — is the engine's own behaviour. Token counts use
//    the Hy-Memory-30B-A3B tokenizer.json.
// 2. MATRIX: Tables 7-10 of arXiv 2610.22196 (also on the model card), the
//    six metrics per harness for Hy-Memory-30B-A3B and Claude Opus 5.

export type NodeState = "active" | "superseded" | "shadow" | "new"

export type StoreRow = { id: string; text: string; state: NodeState; note?: string }

export type Step = {
  key: string
  turn: 1 | 2
  stage: "write" | "extract" | "candidates" | "reconcile" | "store" | "recall"
  title: string
  llm?: { promptTokens: number; replyTokens: number }
  body: string
  payload?: string[]
  store: StoreRow[]
}

const PUNE = "The user lives in Pune."
const COFFEE = "The user drinks black coffee every morning."
const RUN_ = "The user is training for a half marathon in December."
const BLR = "The user lives in Bengaluru after moving from Pune."
const TEA = "The user switched from coffee to green tea in the mornings."

export const STEPS: Step[] = [
  {
    key: "t1-raw",
    turn: 1,
    stage: "write",
    title: "add(): the raw turn is embedded and stored as L1_RAW",
    body: "No model call yet. The two messages go into the vector store verbatim, as layer L1_RAW, so nothing is lost if extraction fails.",
    payload: [
      "user: I live in Pune. Black coffee every morning, and I'm training for a half marathon in December.",
      "assistant: Nice! Good luck with the training.",
    ],
    store: [{ id: "raw-1", text: "[L1_RAW] the two messages, verbatim", state: "new" }],
  },
  {
    key: "t1-extract",
    turn: 1,
    stage: "extract",
    title: "Model call 1: extraction",
    llm: { promptTokens: 2453, replyTokens: 106 },
    body: "The engine sends the extractor prompt: a fixed rulebook of what to keep and what to drop, the last few messages for resolving pronouns, the new messages and the date. The model returns JSON: durable facts, intentions with an expiry, basic profile fields.",
    payload: [PUNE, COFFEE, RUN_],
    store: [{ id: "raw-1", text: "[L1_RAW] the two messages, verbatim", state: "shadow", note: "demoted once extraction succeeds" }],
  },
  {
    key: "t1-cand",
    turn: 1,
    stage: "candidates",
    title: "Candidate search: nothing to reconcile against",
    body: "Each new fact is searched against existing L2 facts (vector plus BM25, fused, kept only at a score of 0.4 or more). The store is empty, so every fact goes in as ADD and the reconcile call is skipped.",
    store: [{ id: "raw-1", text: "[L1_RAW] the two messages, verbatim", state: "shadow" }],
  },
  {
    key: "t1-store",
    turn: 1,
    stage: "store",
    title: "Store: three L2 facts, one model call spent",
    body: "ops_summary: add 3, supersede 0, update 0.",
    store: [
      { id: "pune", text: PUNE, state: "new" },
      { id: "coffee", text: COFFEE, state: "new" },
      { id: "run", text: RUN_, state: "new" },
    ],
  },
  {
    key: "t2-extract",
    turn: 2,
    stage: "extract",
    title: "Turn 2, model call 1: extraction",
    llm: { promptTokens: 2480, replyTokens: 90 },
    body: "Same prompt, new messages. The model writes two facts, each a self-contained third-person sentence.",
    payload: [
      "user: Update: I moved to Bengaluru last week, and I've switched from coffee to green tea.",
      "→ " + BLR,
      "→ " + TEA,
    ],
    store: [
      { id: "pune", text: PUNE, state: "active" },
      { id: "coffee", text: COFFEE, state: "active" },
      { id: "run", text: RUN_, state: "active" },
    ],
  },
  {
    key: "t2-cand",
    turn: 2,
    stage: "candidates",
    title: "Candidate search: one hit, one miss",
    body: "The Bengaluru fact finds the Pune fact above the 0.4 gate. The tea fact's best candidate fuses to 0.19 and is dropped, so the coffee fact is never shown to the model. This is engine-side retrieval, before the model sees anything.",
    payload: ["Bengaluru fact → candidate: “lives in Pune”", "tea fact → fused max 0.19, below 0.4 → no candidates"],
    store: [
      { id: "pune", text: PUNE, state: "active", note: "shown to the model" },
      { id: "coffee", text: COFFEE, state: "active", note: "not shown: below the gate" },
      { id: "run", text: RUN_, state: "active" },
    ],
  },
  {
    key: "t2-reconcile",
    turn: 2,
    stage: "reconcile",
    title: "Model call 2: reconcile",
    llm: { promptTokens: 1620, replyTokens: 133 },
    body: "The reconcile prompt lists the candidates (head of each chain only, with their ids) and the new facts, and asks for a JSON list of ADD, UPDATE or SUPERSEDE operations.",
    payload: ['{"op": "SUPERSEDE", "memory_id": "<pune>", "content": "…lives in Bengaluru…", "supersede_reason": "home move"}', '{"op": "ADD", "content": "…switched from coffee to green tea…"}'],
    store: [
      { id: "pune", text: PUNE, state: "active" },
      { id: "coffee", text: COFFEE, state: "active" },
      { id: "run", text: RUN_, state: "active" },
    ],
  },
  {
    key: "t2-store",
    turn: 2,
    stage: "store",
    title: "Store: a chain head, a superseded node, and a stale fact",
    body: "Pune is marked superseded (is_latest false, superseded_by the new id) and stays recallable as history. Tea is a plain ADD. Coffee is still active, because nothing told the store it was wrong.",
    store: [
      { id: "blr", text: BLR, state: "new", note: "chain head" },
      { id: "pune", text: PUNE, state: "superseded", note: "history of the head" },
      { id: "tea", text: TEA, state: "new" },
      { id: "coffee", text: COFFEE, state: "active", note: "stale, still active" },
      { id: "run", text: RUN_, state: "active" },
    ],
  },
  {
    key: "recall",
    turn: 2,
    stage: "recall",
    title: "search(): no model call, two different answers",
    body: "Recall is one embedding plus vector and keyword search. The chain comes back as a 62-token block with its history. The coffee question comes back with both facts, the stale one ranked first.",
    payload: [
      "q: Bengaluru Pune lives → “Current: …lives in Bengaluru… History: …lives in Pune.” (0.817)",
      "q: coffee tea morning → “drinks black coffee every morning” (0.516)",
      "                       “switched from coffee to green tea” (0.486)",
    ],
    store: [
      { id: "blr", text: BLR, state: "active" },
      { id: "pune", text: PUNE, state: "superseded" },
      { id: "tea", text: TEA, state: "active" },
      { id: "coffee", text: COFFEE, state: "active" },
      { id: "run", text: RUN_, state: "active" },
    ],
  },
]

export const METRICS = ["LoCoMo", "LongMemEval", "PersonaMem-v2", "Travel SPS", "Shopping PS", "CMB"] as const

export const HARNESSES = [
  { key: "mem0", label: "Mem0", heldOut: false },
  { key: "hymem", label: "Hy-Memory", heldOut: false },
  { key: "memos", label: "MemOS", heldOut: false },
  { key: "ever", label: "EverMemOS", heldOut: true },
] as const

export type HarnessKey = (typeof HARNESSES)[number]["key"]

// [Hy-Memory-30B-A3B, Claude Opus 5] per metric, Tables 7-10.
export const MATRIX: Record<HarnessKey, { hy: number[]; opus: number[] }> = {
  mem0: { hy: [59.54, 73.0, 51.62, 54.51, 18.33, 67.13], opus: [69.47, 66.0, 53.58, 42.98, 17.78, 70.74] },
  hymem: { hy: [73.28, 89.0, 51.54, 57.65, 21.11, 70.73], opus: [74.43, 89.69, 48.71, 51.34, 23.33, 75.7] },
  memos: { hy: [62.98, 73.0, 51.92, 24.15, 21.11, 69.91], opus: [63.74, 79.38, 52.84, 22.14, 19.44, 65.46] },
  ever: { hy: [73.28, 76.0, 53.28, 56.56, 19.05, 63.19], opus: [73.28, 80.41, 51.19, 45.91, 23.89, 49.53] },
}
