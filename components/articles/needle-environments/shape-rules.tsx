"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The eight rules the six environments encode, each traced to the line that
// states it. This is what the repository actually contains: not a benchmark, a
// schema style guide for constrained decoding on a 45M-parameter model.
//
// Every quote below is verbatim from needle-environments (module docstrings,
// tool docstrings, README) or from the Cactus-Compute/needle2 model card.

const ENUM = "oklch(0.60 0.15 255)"
const BOUND = "oklch(0.55 0.16 155)"
const WORDS = "oklch(0.68 0.13 85)"
const SHAPE = "oklch(0.58 0.19 27)"

type Rule = {
  k: string
  title: string
  kind: "enum" | "bound" | "words" | "shape"
  where: string
  quote: string
  code: string
  defends: string
  why: string
}

const RULES: Rule[] = [
  {
    k: "five",
    title: "Five tools. Not six.",
    kind: "shape",
    where: "README.md · all six TOOLS lists",
    quote: "…five tools or fewer.",
    code: `TOOLS = [control_lights, set_thermostat, control_fan,
         control_blinds, start_robot_vacuum]`,
    defends: "wrong tool",
    why: "Every one of the six environments has exactly five. The number is not a taste: the model card says the retrieval head “renders only the top five tools per turn.” A five-tool surface is exactly one page, so retrieval can never be the thing that failed.",
  },
  {
    k: "enums",
    title: "Every closed set is an enum.",
    kind: "enum",
    where: "wearable.py · start_workout",
    quote: "…a Literal becomes a fixed set the model must choose from (it cannot emit anything else).",
    code: `workout_type: Literal["running", "walking", "cycling",
                      "swimming", "strength", "yoga"]`,
    defends: "invalid",
    why: "The grammar is compiled from the schema, so an enum is not a hint — it is the alphabet. A value outside the set is unreachable rather than unlikely, which is a different guarantee entirely.",
  },
  {
    k: "bounds",
    title: "Every number carries bounds.",
    kind: "bound",
    where: "kitchen_appliance.py · set_oven",
    quote: "…hard numeric bounds make unsafe requests unrepresentable.",
    code: `temperature: Annotated[int, needle.Field(ge=50, le=250)]`,
    defends: "invalid · critical",
    why: "Two of the four critical categories are out-of-range asks — “set the thermostat to 40 degrees.” With bounds in the grammar the model does not have to be smart enough to refuse; it is not able to comply.",
  },
  {
    k: "hiding",
    title: "No enum value hides inside a likely word.",
    kind: "words",
    where: "smart_home.py · module docstring",
    quote:
      "One learned rule: avoid enum values that hide inside likely query words (a room named office poisons an off action, so this home has a study).",
    // the caret column is computed so it lands under "study" whatever the editor does
    code: `Room = Literal["kitchen", "living_room", "bedroom", "study"]\n#${" ".repeat(51)}^^^^^^^ never "office"`,
    defends: "everything",
    why: "Selection grounds enum candidates by occurrence in the query text. `off` occurs inside `office`, so the room name would ground the wrong action in every sentence that named the room. The product vocabulary was changed to suit the decoder.",
  },
  {
    k: "verbatim",
    title: "Free text is copied, never resolved.",
    kind: "words",
    where: "productivity.py · create_calendar_event",
    quote: "Copy both word for word; never rephrase or resolve them.",
    code: `start_time_human: Annotated[str, needle.Field(
                      min_length=1, max_length=60)]
# "next tuesday at 4" goes through untouched — the host app resolves it`,
    defends: "hallucinated values",
    why: "A 45M model should not be doing date arithmetic, and asking it to is how you get a reminder set for the wrong year. The schema shape says so: the field is named time_human, and the docstring forbids interpretation.",
  },
  {
    k: "absent",
    title: "Delete the optional argument the model likes to guess.",
    kind: "shape",
    where: "kitchen_appliance.py · module docstring",
    quote:
      "Optional settings the model tends to guess (oven modes, cup sizes, default cycles) are deliberately absent.",
    code: `def set_oven(temperature: ...):     # no mode=
def control_coffee_maker(action: ...)  # no cup_size=`,
    defends: "missing · critical",
    why: "This is the sharpest one, because it is subtractive. An optional argument the model wants to fill is a standing invitation to invent a value the user never said. The fix is not a better description — it is not having the field.",
  },
  {
    k: "negative",
    title: "Say what the tool is not for.",
    kind: "shape",
    where: "smart_home.py · control_lights, set_thermostat",
    quote: "Never use this for blinds, fans, or any other device.",
    code: `"""Turn lights on or off in a room… Never use this for blinds,
fans, or any other device."""`,
    defends: "wrong tool",
    why: "Almost every tool docstring in the six files ends with a negative clause naming its neighbours. With five tools in scope, disambiguation is the whole job, and the descriptions are written as boundaries rather than summaries.",
  },
  {
    k: "gerund",
    title: "Use the model's words, not yours.",
    kind: "words",
    where: "wearable.py · module docstring",
    quote: "Workout types use the gerund forms the model was trained on.",
    code: `Literal["running", "walking", "cycling", …]
#       not  ["run", "walk", "cycle", …]`,
    defends: "everything",
    why: "Here the co-design stops being subtle. The schema is shaped to the training distribution of the model that will read it, and the author says so. Whatever these files are, they are not held out from the model.",
  },
]

const COLOUR: Record<Rule["kind"], string> = {
  enum: ENUM,
  bound: BOUND,
  words: WORDS,
  shape: SHAPE,
}

export function ShapeRules() {
  const [k, setK] = useState("hiding")
  const r = RULES.find((x) => x.k === k)!
  const c = COLOUR[r.kind]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          eight rules, each traced to the line that states it
        </span>
        <span className="font-mono text-[10px]" style={{ color: c }}>
          {r.where}
        </span>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,15rem)_1fr] sm:p-4">
        <ul className="flex flex-col gap-1">
          {RULES.map((x) => (
            <li key={x.k}>
              <button
                type="button"
                onClick={() => setK(x.k)}
                aria-pressed={k === x.k}
                className={cn(
                  "w-full cursor-pointer rounded-md border px-2.5 py-1.5 text-left font-mono text-[10.5px] leading-4 transition-colors",
                  k === x.k
                    ? "border-foreground/30 bg-muted/50 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ background: COLOUR[x.kind] }}
                />
                {x.title}
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0">
          <blockquote
            className="rounded-md border-l-2 pl-3 font-mono text-[11px] leading-5"
            style={{ borderColor: c, color: c }}
          >
            &ldquo;{r.quote}&rdquo;
          </blockquote>

          <pre className="mt-2.5 overflow-x-auto rounded-lg border bg-muted/25 p-3 font-mono text-[10.5px] leading-5 text-foreground">
            {r.code}
          </pre>

          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-[9.5px] text-muted-foreground">defends against</span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[9.5px]"
              style={{ background: `color-mix(in oklch, ${c} 18%, transparent)`, color: c }}
            >
              {r.defends}
            </span>
          </div>

          <p className="mt-2.5 text-[13px] leading-6 text-muted-foreground">{r.why}</p>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <p className="text-sm leading-6 text-muted-foreground">
          Read as a benchmark this repository is thin. Read as a{" "}
          <span className="text-foreground">style guide</span> it is unusually good, because every
          rule in it is the residue of something that went wrong. Nobody writes{" "}
          <em>a room named office poisons an off action</em> from first principles; you write it
          after an evening of a light not coming on.
          <br />
          <br />
          The last two rules are the ones worth carrying somewhere else. Deleting the optional
          argument the model wants to guess is a fix you can apply to any tool schema, at any model
          size, today. And matching the enum strings to the model&rsquo;s own training vocabulary is
          the moment the schema stops being an interface and starts being{" "}
          <span className="text-foreground">part of the weights&rsquo; context</span> — which is
          exactly why calling the accompanying test cases &ldquo;held-out&rdquo; does not hold.
        </p>
      </div>
    </figure>
  )
}
