"use client"

import { useState } from "react"

// The tail of one rendered Ripple conversation, token by token. Produced by
// rendering the repository's chat_template.jinja (jinja2 3.1.6) with one tool
// (execute_bash), a user turn, an assistant turn carrying reasoning_content and
// one tool call, and one tool result, then encoding the text with the
// checkpoint's tokenizer.json (tokenizers 0.23.3). The 165 tokens of tool
// preamble before the first user turn are left out. Each entry is
// [token id, decoded text]. Special tokens are ids 100257 to 100277.

const TOKS: [number, string][] = [[100264,"<|im_start|>"],[882,"user"],[198,"\n"],[3923,"What"],[374," is"],[304," in"],[420," this"],[6352," directory"],[30,"?"],[100265,"<|im_end|>"],[198,"\n"],[100264,"<|im_start|>"],[78191,"assistant"],[198,"\n"],[14023,"<th"],[771,"ink"],[397,">\n"],[40,"I"],[1288," should"],[1160," list"],[3626," files"],[627,".\n"],[524,"</"],[27963,"think"],[1363,">\n\n"],[27,"<"],[14506,"tool"],[13735,"_call"],[397,">\n"],[5018,"{\""],[609,"name"],[794,"\":"],[330," \""],[10469,"execute"],[890,"_b"],[1003,"ash"],[498,"\","],[330," \""],[16774,"arguments"],[794,"\":"],[5324," {\""],[5749,"command"],[794,"\":"],[330," \""],[4835,"ls"],[96742,"\"}}\n"],[524,"</"],[14506,"tool"],[13735,"_call"],[29,">"],[100265,"<|im_end|>"],[198,"\n"],[100264,"<|im_start|>"],[882,"user"],[198,"\n"],[27,"<"],[14506,"tool"],[9852,"_response"],[397,">\n"],[55775,"README"],[22030,".md"],[198,"\n"],[3632,"src"],[198,"\n"],[524,"</"],[14506,"tool"],[9852,"_response"],[29,">"],[100265,"<|im_end|>"],[198,"\n"],[100264,"<|im_start|>"],[78191,"assistant"],[198,"\n"]]

const TAGS = new Set([14023, 771, 524, 27963, 27, 14506, 13735, 9852])
const isSpecial = (id: number) => id >= 100256
const show = (s: string) => s.replace(/\n/g, "\u21b5").replace(/ /g, "\u00b7")

const CLOSERS = new Set([397, 1363, 29])
const isTag = (i: number) => TAGS.has(TOKS[i][0]) || (CLOSERS.has(TOKS[i][0]) && i > 0 && TAGS.has(TOKS[i - 1][0]))

type Mode = "all" | "tags"

export function ChatTokens() {
  const [mode, setMode] = useState<Mode>("tags")
  const [sel, setSel] = useState<number | null>(14)
  const picked = sel === null ? null : TOKS[sel]
  const tagCount = TOKS.filter((_, i) => isTag(i)).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one tool call, as the model sees it</span>
        <span className="font-mono text-[10px] text-muted-foreground">{TOKS.length} tokens, rendered and encoded locally</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          {(
            [
              ["tags", "highlight the tag pieces"],
              ["all", "alternate every token"],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded border px-2 py-0.5 ${mode === m ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-[3px] rounded-lg border bg-background/60 p-2 font-mono text-[11px] leading-5">
          {TOKS.map(([id, s], i) => {
            const special = isSpecial(id)
            const tag = isTag(i)
            let cls = "border-transparent bg-muted/40 text-muted-foreground"
            if (special) cls = "border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-300"
            else if (mode === "tags" && tag) cls = "border-teal-500/60 bg-teal-500/15 text-teal-800 dark:text-teal-300"
            else if (mode === "all") cls = i % 2 ? "border-transparent bg-sky-500/10 text-foreground" : "border-transparent bg-violet-500/10 text-foreground"
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSel(i)}
                className={`rounded border px-1 ${cls} ${sel === i ? "ring-1 ring-foreground" : ""}`}
              >
                {show(s)}
              </button>
            )
          })}
        </div>
        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-2">
            <div className="text-[10px] text-muted-foreground">selected token</div>
            <div className="text-foreground">{picked ? show(picked[1]) : "none"}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2">
            <div className="text-[10px] text-muted-foreground">id</div>
            <div className="text-foreground">{picked ? picked[0] : "none"}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2">
            <div className="text-[10px] text-muted-foreground">kind</div>
            <div className="text-foreground">{picked ? (isSpecial(picked[0]) ? "special token" : "ordinary BPE piece") : "none"}</div>
          </div>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Amber: the only special tokens in the turn, the ChatML markers. Teal: the {tagCount} ordinary pieces that spell think, tool_call and tool_response tags. The closing piece of a tag also swallows the newlines after it, so the same tag ends in a different token depending on the whitespace that follows. A newline shows as {"\u21b5"}, a space as {"\u00b7"}.
        </p>
      </div>
    </figure>
  )
}
