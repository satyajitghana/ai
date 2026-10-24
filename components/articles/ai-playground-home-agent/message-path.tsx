"use client"

// One chat message, hop by hop, from a phone to AI Playground's Home Agent and back.
//
// Every hop is a line in intel/AI-Playground at commit bdda6cc (1 Oct 2026):
//   home-agent/channels/telegram.py   long polling (delete_webhook, start_polling), chat-id allow-list
//   home-agent/channels/slack.py      Socket Mode (AsyncSocketModeHandler), DMs only, user-id allow-list
//   home-agent/channels/local_web.py  ThreadingHTTPServer on 127.0.0.1, or 0.0.0.0 with allowLan
//   home-agent/web_api.py             /channel/<kind>/poll and /send/<action>, X-AIPG-Auth on loopback
//   WebUI/src/assets/js/store/homeAgent.ts   POLL_INTERVAL_MS = 2000, the dispatcher
//   modes/base/presets/home-agent-chat.json  the Home Agent preset (models, tools on)

import { useState } from "react"

type Kind = "telegram" | "slack" | "lan"
type Sender = "owner" | "stranger"
type Where = "phone" | "cloud" | "pc" | "lan"

type Hop = { where: Where; title: string; code: string; note: string; stop?: boolean }

const WHERE_LABEL: Record<Where, string> = {
  phone: "phone",
  cloud: "chat company's servers",
  pc: "your PC",
  lan: "your Wi-Fi",
}

const WHERE_TONE: Record<Where, string> = {
  phone: "#64748b",
  cloud: "#d97706",
  pc: "#0891b2",
  lan: "#7c3aed",
}

const CHANNELS: Record<Kind, { name: string; transport: string }> = {
  telegram: { name: "Telegram", transport: "outbound long polling" },
  slack: { name: "Slack", transport: "outbound WebSocket (Socket Mode)" },
  lan: { name: "LAN chat", transport: "inbound HTTP on your network" },
}

function hops(kind: Kind, sender: Sender): Hop[] {
  const tail: Hop[] = [
    {
      where: "pc",
      title: "Queued in memory",
      code: "queue_append({text, chat_id})",
      note: "Text, and any photo, voice note or document as base64. Nothing is written to disk here.",
    },
    {
      where: "pc",
      title: "The app picks it up",
      code: "GET /channel/<kind>/poll every 2000 ms",
      note: "The Electron window polls the Python backend on 127.0.0.1, with a per-launch X-AIPG-Auth token.",
    },
    {
      where: "pc",
      title: "Home Agent preset answers",
      code: "Qwen3.5-9B Q4_K_M (llama.cpp) or Qwen3-8B int4 (OpenVINO)",
      note: "Tools are on by default: image and video generation in ComfyUI, web search, speech, MCP servers.",
    },
  ]
  const back: Hop =
    kind === "lan"
      ? {
          where: "lan",
          title: "Reply streamed back",
          code: "GET /api/events (Server-Sent Events)",
          note: "Text and images go to every signed-in browser over plain HTTP. They never leave your network.",
        }
      : {
          where: "cloud",
          title: "Reply sent back",
          code: kind === "telegram" ? "bot.send_photo / send_message_draft" : "files_upload_v2 / chat_update",
          note: `Every reply, generated image, video and voice note is uploaded to ${CHANNELS[kind].name} to reach your phone.`,
        }

  if (kind === "telegram") {
    const head: Hop[] = [
      { where: "phone", title: "You type in Telegram", code: "", note: "" },
      {
        where: "cloud",
        title: "Telegram holds the update",
        code: "getUpdates (long poll)",
        note: "Nothing listens on your PC. The bot asks Telegram for new messages; no port is opened.",
      },
    ]
    if (sender === "stranger") {
      return [
        { ...head[0], title: "Someone else finds your bot's @name" },
        head[1],
        {
          where: "pc",
          title: "Allow-list check",
          code: "chat_id != self._allowed_chat_id",
          note: "Dropped and logged. One catch: chat ids seen in updates waiting at startup are saved as the detected identity without this check.",
          stop: true,
        },
      ]
    }
    return [
      ...head,
      {
        where: "pc",
        title: "Allow-list check",
        code: "chat_id == self._allowed_chat_id",
        note: "One chat id, set by Detect in the setup screen. It is a chat, not a person: a group id would admit every member.",
      },
      ...tail,
      back,
    ]
  }

  if (kind === "slack") {
    const head: Hop[] = [
      { where: "phone", title: "You DM the Slack app", code: "", note: "" },
      {
        where: "cloud",
        title: "Slack pushes the event",
        code: "AsyncSocketModeHandler(app_token)",
        note: "Over a WebSocket the PC opened outward. Only direct messages count: channel_type must be im.",
      },
    ]
    if (sender === "stranger") {
      return [
        { ...head[0], title: "A workspace member DMs the app" },
        head[1],
        {
          where: "pc",
          title: "Allow-list check",
          code: "user_id != self._allowed_user_id",
          note: "Dropped. Their user id is still remembered as the last-seen identity before the check runs.",
          stop: true,
        },
      ]
    }
    return [
      ...head,
      {
        where: "pc",
        title: "Allow-list check",
        code: "user_id == self._allowed_user_id",
        note: "One Slack user id. Unlike Telegram this is a person, not a conversation.",
      },
      ...tail,
      back,
    ]
  }

  const head: Hop[] = [
    { where: "phone", title: "You open the LAN chat page", code: "", note: "" },
    {
      where: "lan",
      title: "Your PC listens",
      code: "ThreadingHTTPServer(('0.0.0.0', 8765))",
      note: "Only with Allow LAN on; otherwise 127.0.0.1. Plain HTTP: the password and cookie cross your Wi-Fi unencrypted.",
    },
  ]
  if (sender === "stranger") {
    return [
      { ...head[0], title: "Another device on the Wi-Fi guesses" },
      head[1],
      {
        where: "pc",
        title: "Password check",
        code: "secrets.compare_digest(password, self._password)",
        note: "Five wrong guesses lock that address out for 30 s, doubling up to 30 minutes.",
        stop: true,
      },
    ]
  }
  return [
    ...head,
    {
      where: "pc",
      title: "Password, then a session cookie",
      code: "HttpOnly cookie, 7 days, at most 64 sessions",
      note: "One shared password for everyone; there is no per-person identity.",
    },
    ...tail,
    back,
  ]
}

export function MessagePath() {
  const [kind, setKind] = useState<Kind>("telegram")
  const [sender, setSender] = useState<Sender>("owner")
  const list = hops(kind, sender)
  const leaves = list.filter((h) => h.where === "cloud").length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">one message, hop by hop</span>
        <span className="font-mono text-[10px] text-muted-foreground">home-agent/channels/*.py · store/homeAgent.ts</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Channel">
          {(Object.keys(CHANNELS) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === kind}
              onClick={() => setKind(k)}
              className={
                k === kind
                  ? "rounded-md border border-foreground/40 bg-muted px-2 py-1 text-[11px] text-foreground"
                  : "rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              }
            >
              {CHANNELS[k].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sender">
          {(["owner", "stranger"] as Sender[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === sender}
              onClick={() => setSender(s)}
              className={
                s === sender
                  ? "rounded-md border border-foreground/40 bg-muted px-2 py-1 text-[11px] text-foreground"
                  : "rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              }
            >
              {s === "owner" ? "from you" : "from someone else"}
            </button>
          ))}
        </div>
      </div>

      <ol className="my-0 list-none space-y-2 px-4 py-3 pl-4">
        {list.map((hop, i) => (
          <li
            key={`${kind}-${sender}-${i}`}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-l-2 pl-3"
            style={{ borderColor: WHERE_TONE[hop.where] }}
          >
            <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: WHERE_TONE[hop.where] }}>
              {WHERE_LABEL[hop.where]}
            </span>
            <span className="text-[12px] text-foreground">
              {hop.title}
              {hop.stop ? <span className="ml-2 font-mono text-[10px] text-red-600 dark:text-red-400">stops here</span> : null}
            </span>
            {hop.code || hop.note ? (
              <>
                <span />
                <span className="text-[11px] break-words text-muted-foreground">
                  {hop.code ? <code className="font-mono text-[10px]">{hop.code}</code> : null}
                  {hop.code && hop.note ? " · " : ""}
                  {hop.note}
                </span>
              </>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        {CHANNELS[kind].name}: {CHANNELS[kind].transport}.{" "}
        {sender === "stranger"
          ? "The model never sees the message; the gate sits in the Python bot code, before the queue."
          : leaves > 0
            ? `Compute stays on the PC, but the conversation passes through ${CHANNELS[kind].name} twice: your message in, every answer and file out.`
            : "Nothing crosses the internet. The price is plain HTTP and one shared password on the local network."}
      </div>
    </figure>
  )
}
