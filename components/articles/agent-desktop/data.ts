// Numbers for the agent-desktop article's widgets.
//
// MEASURED here (our Python port of agent-desktop's ref allocator, run on two SYNTHETIC trees; tokens counted with the
// Qwen3 tokenizer on the compact JSON the CLI writes, plus the snapshot envelope). The port is checked against the
// repository's own unit-test cases in public/articles/agent-desktop/test_port.py (10 checks). The trees are toys, not
// recordings of any application: read the ratios, not the absolute token counts.
export type ModeRow = { skeleton: boolean; interactive: boolean; compact: boolean; nodes: number; refs: number; tokens: number }
export type AppKey = "chat-app" | "file-manager"

export const APPS: Record<AppKey, { label: string; blurb: string; rawNodes: number; rows: ModeRow[]; drills: { region: string; nodes: number; refs: number; tokens: number }[] }> = {
  "chat-app": {
    label: "chat app (Electron-style)",
    blurb: "150 messages, anonymous wrapper chains, DOM ids on messages",
    rawNodes: 2262,
    rows: [
    { skeleton: false, interactive: false, compact: false, nodes: 2262, refs: 573, tokens: 38070 },
    { skeleton: false, interactive: false, compact: true, nodes: 1342, refs: 573, tokens: 31480 },
    { skeleton: false, interactive: true, compact: false, nodes: 1403, refs: 573, tokens: 27752 },
    { skeleton: false, interactive: true, compact: true, nodes: 837, refs: 573, tokens: 23790 },
    { skeleton: true, interactive: false, compact: false, nodes: 785, refs: 210, tokens: 12883 },
    { skeleton: true, interactive: false, compact: true, nodes: 219, refs: 210, tokens: 8717 },
    { skeleton: true, interactive: true, compact: false, nodes: 784, refs: 210, tokens: 12874 },
    { skeleton: true, interactive: true, compact: true, nodes: 218, refs: 210, tokens: 8708 },
    ],
    drills: [
    { region: "Composer", nodes: 5, refs: 4, tokens: 200 },
    { region: "Channel header", nodes: 3, refs: 2, tokens: 139 },
    ],
  },
  "file-manager": {
    label: "file manager (native-style)",
    blurb: "120-row table, shallow tree, no wrapper chains",
    rawNodes: 521,
    rows: [
    { skeleton: false, interactive: false, compact: false, nodes: 521, refs: 391, tokens: 15854 },
    { skeleton: false, interactive: false, compact: true, nodes: 521, refs: 391, tokens: 15854 },
    { skeleton: false, interactive: true, compact: false, nodes: 520, refs: 391, tokens: 15833 },
    { skeleton: false, interactive: true, compact: true, nodes: 520, refs: 391, tokens: 15833 },
    { skeleton: true, interactive: false, compact: false, nodes: 521, refs: 391, tokens: 15854 },
    { skeleton: true, interactive: false, compact: true, nodes: 521, refs: 391, tokens: 15854 },
    { skeleton: true, interactive: true, compact: false, nodes: 520, refs: 391, tokens: 15833 },
    { skeleton: true, interactive: true, compact: true, nodes: 520, refs: 391, tokens: 15833 },
    ],
    drills: [
    { region: "Sidebar", nodes: 26, refs: 21, tokens: 796 },
    { region: "Toolbar", nodes: 11, refs: 10, tokens: 384 },
    ],
  },
}

// Chat app, tokens by number of messages: full `snapshot -i --compact`, the skeleton (`--skeleton -i --compact`),
// and a drill into the composer. MEASURED on the toy.
export const SCALING = [
  { messages: 25, rawNodes: 628, full: 5848, skeleton: 3346, drill: 196 },
  { messages: 50, rawNodes: 950, full: 9341, skeleton: 4408, drill: 200 },
  { messages: 100, rawNodes: 1593, full: 16193, skeleton: 6558, drill: 200 },
  { messages: 150, rawNodes: 2262, full: 23790, skeleton: 8708, drill: 200 },
  { messages: 300, rawNodes: 4253, full: 46288, skeleton: 15158, drill: 200 },
  { messages: 600, rawNodes: 8216, full: 91467, skeleton: 28058, drill: 200 },
] as const

// REASONED, not measured: a screenshot's input cost under the commonly published rule of (width x height) / 750 tokens,
// after a long-edge cap of 1568 px. 1280 x 800 = 1,365; a 1920 x 1080 frame resized to 1568 x 882 = 1,844.
export const IMAGE_TOKENS = { small: 1365, large: 1844 } as const

// MEASURED from the repository at commit cb31212 (Rust lines per crate; "production" excludes *_tests.rs, tests.rs,
// tests/ directories and test-support files).
export const CRATES = [
  { id: "linux", label: "Linux (AT-SPI over D-Bus, X11, Wayland)", prod: 59331, test: 64200, tests: 2398 },
  { id: "windows", label: "Windows (UI Automation)", prod: 41063, test: 40421, tests: 1551 },
  { id: "macos", label: "macOS (AX API)", prod: 34367, test: 8349, tests: 771 },
  { id: "core", label: "core (refs, snapshot, actionability, lease)", prod: 30969, test: 45840, tests: 1519 },
  { id: "ffi", label: "C library (FFI)", prod: 10093, test: 5014, tests: 282 },
  { id: "cli", label: "CLI binary (src/)", prod: 7242, test: 7337, tests: 268 },
] as const
