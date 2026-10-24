"use client"

// What one message in the allowed chat can make the PC do, given the Home Agent's
// settings. Read from intel/AI-Playground at commit bdda6cc (1 Oct 2026):
//   WebUI/src/assets/js/tools/tools.ts                    aipgTools + homeAgentTools
//   WebUI/src/assets/js/store/openAiCompatibleChat.ts     resolveBuiltinTools / resolveMcpTools
//   WebUI/src/lib/builtinToolEnablement.ts                OPT_IN_TOOLS = {captureScreenshot}
//   WebUI/src/assets/js/tools/toolMedia.ts                which tool outputs are shipped back to chat
//   WebUI/src/assets/js/store/homeAgent.ts                CONFIRM_TIMEOUT_MS = 2 min, in-channel yes/no
//   modes/base/presets/home-agent-chat.json               toolsEnabledByDefault: true, enableRAG: true
//   WebUI/external/mcp.json                               the packaged MCP config: DateTime only

import { useState } from "react"

type Gate = "runs" | "asks" | "off"

type Settings = {
  builtin: boolean
  mcp: boolean
  web: boolean
  screenshot: boolean
  blender: boolean
}

const DEFAULTS: Settings = { builtin: true, mcp: true, web: true, screenshot: false, blender: false }

type Row = { action: string; tool: string; gate: (s: Settings) => Gate; out: string }

const ROWS: Row[] = [
  {
    action: "Generate an image or a video",
    tool: "comfyUI / media",
    gate: (s) => (s.builtin ? "runs" : "off"),
    out: "the picture or clip is uploaded to the chat",
  },
  {
    action: "Edit a photo you send",
    tool: "comfyUiImageEdit",
    gate: (s) => (s.builtin ? "runs" : "off"),
    out: "your photo goes in, the edit comes back",
  },
  {
    action: "Search and read web pages",
    tool: "searchWeb / browseWeb / interactWithWebPage",
    gate: (s) => (s.builtin && s.web ? "runs" : "off"),
    out: "queries go to DuckDuckGo; page text goes into the model",
  },
  {
    action: "Speak or transcribe",
    tool: "synthesizeTextToSpeech / transcribeAudio",
    gate: (s) => (s.builtin ? "runs" : "off"),
    out: "a voice note back, when the backend is installed",
  },
  {
    action: "Add a document to the knowledge base",
    tool: "RAG upload (txt, md, doc, docx, pdf)",
    gate: () => "runs",
    out: "the file is stored on the PC and searched on later turns",
  },
  {
    action: "Screenshot the bound window",
    tool: "captureScreenshot",
    gate: (s) => (s.builtin && s.screenshot ? "runs" : "off"),
    out: "the screenshot is forwarded to the chat",
  },
  {
    action: "Ask the clock",
    tool: "mcp__datetime__*",
    gate: (s) => (s.mcp ? "runs" : "off"),
    out: "harmless; the one server the package ships",
  },
  {
    action: "Run Python inside Blender",
    tool: "mcp__blender__execute_blender_code",
    gate: (s) => (s.mcp && s.blender ? "runs" : "off"),
    out: "any MCP server you add is callable the same way",
  },
  {
    action: "Change its own model, prompt or tools",
    tool: "configureHomeAgent",
    gate: () => "asks",
    out: "a Confirm/Cancel in the same chat, cancelled after 2 minutes",
  },
  {
    action: "Download a model",
    tool: "remote model download",
    gate: () => "asks",
    out: "approval asked in the same chat",
  },
]

const TONE: Record<Gate, string> = { runs: "#d97706", asks: "#0891b2", off: "#94a3b8" }
const WORD: Record<Gate, string> = { runs: "runs", asks: "asks first", off: "off" }

const TOGGLES: { key: keyof Settings; label: string; note: string }[] = [
  { key: "builtin", label: "Built-in tools", note: "on by default for this preset" },
  { key: "mcp", label: "MCP tools", note: "on by default for this preset" },
  { key: "web", label: "Browse the web", note: "on by default" },
  { key: "screenshot", label: "Capture screenshot", note: "opt-in; needs a bound window and a vision model" },
  { key: "blender", label: "Blender MCP added", note: "your own addition to mcp.json" },
]

export function ReachBoard() {
  const [s, setS] = useState<Settings>(DEFAULTS)
  const gates = ROWS.map((r) => r.gate(s))
  const runs = gates.filter((g) => g === "runs").length
  const asks = gates.filter((g) => g === "asks").length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">what one allowed message can start</span>
        <span className="font-mono text-[10px] text-muted-foreground">tools.ts · openAiCompatibleChat.ts · homeAgent.ts</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b px-4 py-3">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-start gap-1.5 text-[11px] text-foreground" title={t.note}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={s[t.key]}
              onChange={(e) => setS({ ...s, [t.key]: e.target.checked })}
            />
            <span>
              {t.label}
              <span className="block text-[10px] text-muted-foreground">{t.note}</span>
            </span>
          </label>
        ))}
        <button
          type="button"
          onClick={() => setS(DEFAULTS)}
          className="self-start rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          defaults
        </button>
      </div>

      <ul className="my-0 list-none space-y-1.5 px-4 py-3 pl-4">
        {ROWS.map((r, i) => {
          const g = gates[i]
          return (
            <li
              key={r.tool}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 border-l-2 pl-3"
              style={{ borderColor: TONE[g], opacity: g === "off" ? 0.55 : 1 }}
            >
              <span className="font-mono text-[11px]" style={{ color: TONE[g] }}>
                {WORD[g]}
              </span>
              <span className="text-[12px] text-foreground">
                {r.action}
                <span className="block text-[10px] break-words text-muted-foreground">
                  <code className="font-mono">{r.tool}</code>
                  {" · "}
                  {r.out}
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {runs} actions run on a message with no second step; {asks} ask first, and they ask in the same chat the
        message came from. Whoever holds that chat holds the PC&apos;s tools.
      </div>
    </figure>
  )
}
