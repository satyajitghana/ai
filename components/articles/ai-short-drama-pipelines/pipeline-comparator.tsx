"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Six short-drama repos, read at source (shallow clones, nothing run). Each row
// is one stage of the script -> characters -> storyboard -> images -> video ->
// voice -> edit chain: what implements it, which model or API backs it by
// default, and whether it runs on your machine, on a paid API, through the
// vendor's own relay, or not at all. File references are in the article.

type Where = "local" | "api" | "relay" | "none" | "either"

interface Stage {
  what: string
  model: string
  where: Where
}

interface Tool {
  id: string
  name: string
  repo: string
  licence: string
  stars: string
  shape: string
  consistency: string
  stages: Record<StageId, Stage>
}

type StageId = "script" | "characters" | "storyboard" | "images" | "video" | "voice" | "edit"

const STAGES: { id: StageId; label: string }[] = [
  { id: "script", label: "Script" },
  { id: "characters", label: "Characters" },
  { id: "storyboard", label: "Storyboard" },
  { id: "images", label: "Images" },
  { id: "video", label: "Video" },
  { id: "voice", label: "Voice" },
  { id: "edit", label: "Edit" },
]

const WHERE: Record<Where, { label: string; colour: string }> = {
  local: { label: "local", colour: "oklch(0.60 0.14 155)" },
  api: { label: "paid API", colour: "oklch(0.62 0.17 45)" },
  relay: { label: "vendor relay by default", colour: "oklch(0.58 0.19 20)" },
  either: { label: "local or API", colour: "oklch(0.60 0.14 250)" },
  none: { label: "missing", colour: "oklch(0.62 0.02 260)" },
}

const TOOLS: Tool[] = [
  {
    id: "huobao",
    name: "Huobao Drama",
    repo: "chatfire-AI/huobao-drama",
    licence: "CC BY-NC-SA 4.0",
    stars: "16,046",
    shape: "Fixed pipeline: four agents, REST routes, one ffmpeg join",
    consistency:
      "One reference sheet per character (face close-up plus front, side and back views), passed to Seedance as reference_image; @name in the prompt is rewritten to @图片N.",
    stages: {
      script: { what: "script_rewriter agent", model: "deepseek-v4-pro or Gemini via the firemux relay", where: "relay" },
      characters: { what: "extractor agent + sheet prompt", model: "gpt-image-2, Gemini 3 Pro Image or Seedream 5.0, text only", where: "relay" },
      storyboard: { what: "storyboard_breaker agent", model: "8-15 s segments, 2-4 sub-shots, 500 characters per minute", where: "relay" },
      images: { what: "asset sheets only", model: "no per-shot keyframes", where: "relay" },
      video: { what: "reference-to-video, up to 9 refs", model: "doubao-seedance-2-0-mini, 720p cap", where: "relay" },
      voice: { what: "TTS removed", model: "the video model's native audio", where: "none" },
      edit: { what: "concat demuxer, re-encode", model: "ffmpeg libx264 crf 23; no mix, no subtitles", where: "local" },
    },
  },
  {
    id: "toonflow",
    name: "Toonflow",
    repo: "HBAI-Ltd/Toonflow-app",
    licence: "MIT",
    stars: "17,229",
    shape: "Node canvas driven by a coding agent; the pipeline lives in Markdown skills",
    consistency:
      "Four-view board per character; every segment re-lists its own reference images as {{ref N}}; the skill forbids using the last frame of one segment to stage the next.",
    stages: {
      script: { what: "agent following skill files", model: "TF-Router, DeepSeek or any OpenAI-compatible model", where: "relay" },
      characters: { what: "four-view reference board", model: "Seedream 5.0, GPT Image 2, Gemini image", where: "relay" },
      storyboard: { what: "one multi-reference prompt per segment", model: "HARD CUT shot blocks; optional three.js previs", where: "either" },
      images: { what: "assets only", model: "keyframes off by default", where: "relay" },
      video: { what: "Seedance-first, 9:16, sound on", model: "Seedance 2.0 / 2.5, Wan 3.0, MiniMax H3", where: "relay" },
      voice: { what: "native audio; a TTS node exists", model: "seed-audio-1.0 on TF-Router", where: "relay" },
      edit: { what: "no built-in join", model: "the agent gets a raw fluent-ffmpeg tool", where: "local" },
    },
  },
  {
    id: "pixelle",
    name: "Pixelle-Video",
    repo: "ATH-MaaS/Pixelle-Video",
    licence: "Apache-2.0",
    stars: "28,874",
    shape: "Topic to narrated MP4: one line, one picture, one voice track per scene",
    consistency:
      "None for characters. A global style prefix is prepended to every prompt; one pipeline feeds the last frame of each clip into the next as its first frame.",
    stages: {
      script: { what: "narration generator", model: "any OpenAI-compatible LLM, Ollama included", where: "either" },
      characters: { what: "no character stage", model: "-", where: "none" },
      storyboard: { what: "narration + image_prompt per frame", model: "5 scenes by default, no camera fields", where: "either" },
      images: { what: "ComfyUI workflow", model: "FLUX on RunningHub by default; FLUX.1-dev or Qwen-Image self-hosted", where: "either" },
      video: { what: "optional per scene", model: "Wan 2.1 FusionX (512x288, 81 frames); Wan, Kling, Seedance APIs", where: "either" },
      voice: { what: "TTS per scene", model: "Edge-TTS by default; Index-TTS2 self-hosted", where: "either" },
      edit: { what: "HTML frame template + concat", model: "Playwright PNG overlay, ffmpeg -c copy, BGM amix 0.2", where: "local" },
    },
  },
  {
    id: "jellyfish",
    name: "Jellyfish",
    repo: "Forget-C/Jellyfish",
    licence: "Apache-2.0",
    stars: "6,675",
    shape: "Production database and prompt layer; stops at one clip per shot",
    consistency:
      "Character = Actor + Costume + Props, each with images per view angle; entity names in a frame prompt are replaced by 图1, 图2 tokens that index the attached images.",
    stages: {
      script: { what: "LangChain agents: divide, merge, extract", model: "OpenAI-compatible text model you configure", where: "api" },
      characters: { what: "actor, costume, prop, scene entities", model: "FRONT / LEFT / RIGHT / BACK reference images", where: "api" },
      storyboard: { what: "closed camera vocabulary", model: "ECU..ELS, 2-4 action beats, first/last/key frame prompts", where: "api" },
      images: { what: "frame images with references", model: "OpenAI images/edits or Volcengine Seedream", where: "api" },
      video: { what: "one video per shot", model: "Volcengine or OpenAI, first/last/key frame roles", where: "api" },
      voice: { what: "not implemented", model: "-", where: "none" },
      edit: { what: "editor page is a front-end mock", model: "-", where: "none" },
    },
  },
  {
    id: "waoowaoo",
    name: "waoowaoo",
    repo: "waooAI/waoowaoo",
    licence: "Elastic-2.0",
    stars: "14,502",
    shape: "Assistant with creative skills on a canvas (v0.5.0-beta.1)",
    consistency:
      "A 4:3 sheet per character (face left, full body right) plus written skin, hair and eye colour; sheets and a designed voice go to the video model as reference image and reference audio.",
    stages: {
      script: { what: "script-development skill", model: "operator-chosen LLM (OpenRouter, Ark, Google)", where: "api" },
      characters: { what: "asset-development skill", model: "Seedream 5.0, Nano Banana, GPT Image 2", where: "api" },
      storyboard: { what: "shot plan inside each segment prompt", model: "timed shot lines + entry and exit state", where: "api" },
      images: { what: "create_image tool", model: "1K by default, 4:3 assets", where: "api" },
      video: { what: "reference mode, longest allowed segment", model: "Seedance 2.0 / 2.5, Hailuo, Kling, Wan 2.5, Veo 3.1", where: "api" },
      voice: { what: "voice design, fed as reference audio", model: "ElevenLabs or Qwen3-TTS voice design", where: "api" },
      edit: { what: "normalise, concat, mix", model: "ffmpeg, two-pass loudnorm, BGM sidechain ducking", where: "local" },
    },
  },
  {
    id: "vimax",
    name: "ViMax",
    repo: "HKUDS/ViMax",
    licence: "MIT",
    stars: "12,623",
    shape: "Research multi-agent pipeline (idea, script, novel) with a paper",
    consistency:
      "Front portrait, then side and back views by editing it; a camera dependency graph passes parent frames to child shots; a VLM picks the best of 2 keyframe candidates.",
    stages: {
      script: { what: "compress, events, RAG, scenes", model: "gpt-5.5 via yunwu.ai; FAISS + bge-reranker", where: "api" },
      characters: { what: "portrait turnaround by image edit", model: "Gemini image (Nano Banana)", where: "api" },
      storyboard: { what: "first/last frame + motion per shot", model: "camera tree, variation type", where: "api" },
      images: { what: "keyframes, best-of-2 by VLM", model: "Gemini 3.1 Flash Image", where: "api" },
      video: { what: "one clip per shot", model: "Veo 3.1 Fast, 8 s", where: "api" },
      voice: { what: "no TTS", model: "Veo's native audio", where: "none" },
      edit: { what: "moviepy concatenate", model: "per scene; novel mode returns scene folders", where: "local" },
    },
  },
]

export function PipelineComparator() {
  const [id, setId] = useState("huobao")
  const tool = TOOLS.find((t) => t.id === id) ?? TOOLS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 font-mono text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
        <span className="min-w-0 truncate">six short-drama pipelines, stage by stage</span>
        <span className="shrink-0 text-muted-foreground/60">read from source, not run</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pick a tool">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setId(t.id)}
              aria-pressed={t.id === id}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                t.id === id ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div>
          <div className="text-sm font-medium">{tool.shape}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {tool.repo} · {tool.licence} · {tool.stars} stars
          </div>
        </div>

        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s, k) => {
            const st = tool.stages[s.id]
            const w = WHERE[st.where]
            return (
              <li
                key={s.id}
                className={cn("rounded-lg border p-2.5", st.where === "none" && "opacity-60")}
                style={{ borderLeft: `3px solid ${w.colour}` }}
              >
                <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    {k + 1}. {s.label}
                  </span>
                  <span style={{ color: w.colour }}>{w.label}</span>
                </div>
                <div className="mt-1 text-[13px] font-medium leading-snug">{st.what}</div>
                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{st.model}</div>
              </li>
            )
          })}
          <li className="rounded-lg border border-dashed p-2.5 sm:col-span-2 lg:col-span-1">
            <div className="font-mono text-[11px] text-muted-foreground">Consistency</div>
            <div className="mt-1 text-xs leading-snug">{tool.consistency}</div>
          </li>
        </ol>

        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {(Object.keys(WHERE) as Where[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ background: WHERE[k].colour }} />
              {WHERE[k].label}
            </span>
          ))}
        </div>
      </div>
    </figure>
  )
}
