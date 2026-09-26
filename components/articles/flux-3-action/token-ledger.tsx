"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What one FLUX 3 Action forward pass is made of, stream by stream.
//
// Every count here is read off the released configs and the flux-action code
// (github.com/black-forest-labs/flux-action @ e2dd1d8), not measured at runtime:
//
//   VAE: 96 latent channels, 32x spatial and 4x temporal compression
//        (processing/packing.py: LATENT_CHANNELS, SPATIAL_DOWNSAMPLE,
//        TEMPORAL_DOWNSAMPLE).
//   DROID (config.json): canvas 544x736, content 540x640 -> latent 17x20 = 340
//        tokens a frame. chunk 32 at 15 Hz; the window is 33 frames -> 9 latent
//        frames, 1 observed + 8 predicted = 2,720 future tokens. One state token
//        of 8 values. Text is bucketed to a multiple of 80 tokens, so 80 is the
//        floor, not a constant. packing.token_budget() returns exactly these.
//   SO-101 (config.json, "history" profile): canvas 256x512 -> 8x16 = 128
//        tokens a frame. Two visual snapshots from the last 8 ticks = 256
//        tokens; 8 conditioning tokens of 12 values (6 measured joints + 6 past
//        commands); chunk 42 -> 11 latent frames = 1,408 future tokens; text
//        padded to a fixed 320.
//
// Denoiser passes per plan: sampler steps, times two when classifier-free
// guidance is on (cfg_two_pass runs an empty-caption pass as well).
//
// Integer arithmetic and toFixed only, so server and client render the same
// strings.

type Stream = {
  key: string
  label: string
  tokens: number
  width: number
  noised: boolean
  what: string
  color: string
}

type Profile = {
  key: string
  label: string
  streams: Stream[]
  textNote: string
  recipes: { key: string; label: string; steps: number; guided: boolean; note: string }[]
}

const COLORS = {
  text: "oklch(0.70 0.03 250)",
  history: "oklch(0.70 0.12 160)",
  state: "oklch(0.76 0.13 80)",
  future: "oklch(0.66 0.15 300)",
  action: "oklch(0.64 0.20 28)",
}

const PROFILES: Profile[] = [
  {
    key: "droid",
    label: "DROID · Franka",
    textNote: "80 is the floor: captions are padded up to a multiple of 80",
    streams: [
      {
        key: "text",
        label: "task text",
        tokens: 80,
        width: 20480,
        noised: false,
        what: "Qwen3-VL-4B layers 4, 8 … 32, stacked",
        color: COLORS.text,
      },
      {
        key: "history",
        label: "camera now",
        tokens: 340,
        width: 96,
        noised: false,
        what: "3 cameras on one canvas, 1 latent frame of 17 × 20",
        color: COLORS.history,
      },
      {
        key: "state",
        label: "joint state",
        tokens: 1,
        width: 8,
        noised: false,
        what: "7 joint angles + gripper",
        color: COLORS.state,
      },
      {
        key: "future",
        label: "future video",
        tokens: 2720,
        width: 96,
        noised: true,
        what: "8 latent frames × 340, each spanning 4 control ticks",
        color: COLORS.future,
      },
      {
        key: "action",
        label: "action chunk",
        tokens: 32,
        width: 8,
        noised: true,
        what: "one token per 15 Hz tick: 7 joint targets + gripper",
        color: COLORS.action,
      },
    ],
    recipes: [
      { key: "base", label: "base", steps: 4, guided: true, note: "4 UniPC steps, video guidance 4" },
      { key: "gd", label: "guidance-distilled", steps: 4, guided: false, note: "4 steps, one pass each" },
      { key: "sd", label: "step-distilled", steps: 1, guided: false, note: "1 step, one pass" },
    ],
  },
  {
    key: "so101",
    label: "SO-101 · LeRobot",
    textNote: "SO-101 pads every caption to a fixed 320",
    streams: [
      {
        key: "text",
        label: "task text",
        tokens: 320,
        width: 20480,
        noised: false,
        what: "same encoder, fixed length",
        color: COLORS.text,
      },
      {
        key: "history",
        label: "camera history",
        tokens: 256,
        width: 96,
        noised: false,
        what: "2 snapshots of the last 8 ticks, 8 × 16 each",
        color: COLORS.history,
      },
      {
        key: "state",
        label: "state + commands",
        tokens: 8,
        width: 12,
        noised: false,
        what: "8 ticks × (6 joint readings + 6 past commands)",
        color: COLORS.state,
      },
      {
        key: "future",
        label: "future video",
        tokens: 1408,
        width: 96,
        noised: true,
        what: "11 latent frames × 128",
        color: COLORS.future,
      },
      {
        key: "action",
        label: "action chunk",
        tokens: 42,
        width: 6,
        noised: true,
        what: "42 ticks at 30 Hz: joint deltas + absolute gripper",
        color: COLORS.action,
      },
    ],
    recipes: [
      { key: "base", label: "released", steps: 4, guided: true, note: "4 Euler steps, guidance 3" },
    ],
  },
]

const HATCH =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.28) 0 3px, transparent 3px 7px)"

const fmt = (n: number) => n.toLocaleString("en-US")
const pct = (part: number, whole: number) => ((part * 100) / whole).toFixed(1)

export function TokenLedger() {
  const [profileKey, setProfileKey] = useState("droid")
  const [recipeKey, setRecipeKey] = useState("base")

  const profile = PROFILES.find((p) => p.key === profileKey) ?? PROFILES[0]
  const recipe = profile.recipes.find((r) => r.key === recipeKey) ?? profile.recipes[0]

  const total = profile.streams.reduce((s, x) => s + x.tokens, 0)
  const future = profile.streams.find((s) => s.key === "future")?.tokens ?? 0
  const action = profile.streams.find((s) => s.key === "action")?.tokens ?? 0
  const passes = recipe.steps * (recipe.guided ? 2 : 1)

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Token composition of one FLUX 3 Action forward pass, by stream"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 font-mono text-xs">
        <span className="text-muted-foreground">one forward pass ·</span>
        {PROFILES.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={p.key === profile.key}
            onClick={() => {
              setProfileKey(p.key)
              setRecipeKey(p.recipes[0].key)
            }}
            className={cn(
              "rounded border px-2 py-1",
              p.key === profile.key
                ? "border-foreground/60 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        <div
          className="flex h-7 w-full overflow-hidden rounded-sm"
          role="img"
          aria-label={`${fmt(total)} tokens: ${profile.streams
            .map((s) => `${s.label} ${fmt(s.tokens)}`)
            .join(", ")}`}
        >
          {profile.streams.map((s) => (
            <div
              key={s.key}
              title={`${s.label}: ${fmt(s.tokens)} tokens`}
              style={{
                width: `${pct(s.tokens, total)}%`,
                minWidth: "3px",
                backgroundColor: s.color,
                backgroundImage: s.noised ? HATCH : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>clean inputs, t = 0</span>
          <span>hatched: denoised from noise</span>
        </div>
      </div>

      <div className="overflow-x-auto px-4 py-3">
        <div className="grid min-w-[30rem] grid-cols-[auto_auto_auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums">
          <span className="text-muted-foreground">stream</span>
          <span className="text-right text-muted-foreground">tokens</span>
          <span className="text-right text-muted-foreground">share</span>
          <span className="text-muted-foreground">each token is</span>
          {profile.streams.map((s) => (
            <div key={s.key} className="contents">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: s.color,
                    backgroundImage: s.noised ? HATCH : undefined,
                  }}
                />
                {s.label}
              </span>
              <span className="text-right">{fmt(s.tokens)}</span>
              <span className="text-right text-muted-foreground">{pct(s.tokens, total)}%</span>
              <span className="text-muted-foreground">
                {fmt(s.width)} values → 3,072 · {s.what}
              </span>
            </div>
          ))}
          <span className="border-t pt-1">total</span>
          <span className="border-t pt-1 text-right">{fmt(total)}</span>
          <span className="border-t pt-1 text-right text-muted-foreground">100%</span>
          <span className="border-t pt-1 text-muted-foreground">{profile.textNote}</span>
        </div>
      </div>

      {profile.recipes.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2 font-mono text-xs">
          <span className="text-muted-foreground">checkpoint ·</span>
          {profile.recipes.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={r.key === recipe.key}
              onClick={() => setRecipeKey(r.key)}
              className={cn(
                "rounded border px-2 py-1",
                r.key === recipe.key
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="border-t px-4 py-3 font-mono text-xs">
        <p className="my-0">
          actions are <span className="text-foreground">{pct(action, total)}%</span>
          {" "}of the sequence; imagined future video is{" "}
          <span className="text-foreground">{pct(future, total)}%</span>.
        </p>
        <p className="my-0 mt-1 text-muted-foreground">
          {recipe.note} → {passes} {passes === 1 ? "pass" : "passes"} per plan ·{" "}
          {fmt(passes * total)} token-passes through the 28 shared blocks for {action}{" "}
          actions
        </p>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Read from the released <code>config.json</code>
        {" "}files and the flux-action code: VAE latents are 96 channels at 32× spatial and 4×
        temporal compression. The inference API returns only the action stream; the future-video
        tokens are denoised and dropped.
      </figcaption>
    </figure>
  )
}
