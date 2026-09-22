// SEIG's harness, taken apart and sorted.
//
// The test is not "is this clever" but "what is this standing in for". Three
// answers, and they behave differently as the base model improves:
//
//   substitute — it does something the model cannot do yet. The premise is a
//                capability gap, so the gap closing removes the component.
//   supply     — it puts information in front of the model that the model
//                cannot have from the inside: a render, a test result, an
//                error. No amount of capability replaces an observation, but
//                a better model needs fewer of them.
//   constrain  — it forbids an outcome. Its value is not "the model cannot do
//                this" but "I need a guarantee the model cannot give me".
//                Capability moves the frequency of the forbidden event, not
//                the consequence of it.
//
// Every quote is from the paper. Server-rendered, zero JS.
type Kind = "substitute" | "supply" | "constrain" | "mixed"

const KIND_STYLE: Record<Kind, string> = {
  substitute: "border-foreground/25 text-muted-foreground",
  supply: "border-foreground/40 text-foreground/80",
  constrain: "border-foreground text-foreground",
  mixed: "border-dashed border-foreground/40 text-muted-foreground",
}

const ROWS: {
  part: string
  kind: Kind
  quote: string
  stronger: string
}[] = [
  {
    part: "staged decomposition",
    kind: "substitute",
    quote:
      "“pretrained VLMs struggle to reconstruct all scene factors simultaneously” — so the four factors are recovered one at a time",
    stronger:
      "The premise is the capability gap, stated in the paper’s own voice. A model that holds all four factors at once needs none of it.",
  },
  {
    part: "scene graph + stable object names",
    kind: "mixed",
    quote:
      "recursively refined “until each leaf node corresponds to an atomic component that can be approximated with Blender primitives”, each with a “stable Blender object name across stages”",
    stronger:
      "The plan is a substitute. The stable names are not — they are the interface every later stage addresses, and an agreed identifier is an invariant, not an aptitude.",
  },
  {
    part: "four initialization rollouts + selector",
    kind: "substitute",
    quote:
      "“sample multiple independent scene graphs and coarse Blender scaffolds, then apply a rollout selector to select the candidate with the most complete object coverage”",
    stronger:
      "Best-of-n bought against variance. Lower variance is exactly what a stronger model has, so n falls toward 1.",
  },
  {
    part: "generator–verifier render loop",
    kind: "supply",
    quote:
      "the generator “writes stage-specific code, executes the edit, and renders the updated result”; the verifier “compares the rendered image against the reference”",
    stronger:
      "Blender’s output is not a capability the model can grow. It is evidence from outside. A stronger model needs fewer rounds of it, never zero.",
  },
  {
    part: "per-stage round budget (5 / 3 / 3 / 2)",
    kind: "substitute",
    quote:
      "“to prevent the refinement effectiveness from degrading over time due to accumulated context, we impose a stage-specific maximum round budget”",
    stronger:
      "A context-degradation cap. Better long-context handling raises the ceiling until it stops binding.",
  },
  {
    part: "approval checklist, not free-form critique",
    kind: "mixed",
    quote:
      "“free-form verifier critiques can be noisy across attempts … we therefore require the verifier to return an explicit approval checklist”",
    stronger:
      "The stated reason is noise, which is a substitute. But a checklist the generator must satisfy before the stage advances is also a gate, and a gate is a constraint.",
  },
  {
    part: "stage-scoped edit permissions",
    kind: "constrain",
    quote:
      "“the model executes Blender code through a material-only tool that permits only material-related edits”; composition “is not allowed to edit object geometry or materials”; lighting keeps “shape, appearance, layout, and camera fixed”",
    stronger:
      "A better model overwrites an accepted stage less often. The tool is what makes it never. Frequency is a model property; the guarantee is a code property.",
  },
  {
    part: "an executable Blender program as the output type",
    kind: "constrain",
    quote:
      "every intermediate scene “is itself a coherent, editable Blender program”, which is what makes relighting, per-object editing and physics work at all",
    stronger:
      "Nothing. This is a requirement on the artifact, not a workaround for the model, and no amount of capability makes an entangled latent relightable.",
  },
]

const LEGEND: { kind: Kind; gloss: string }[] = [
  { kind: "substitute", gloss: "stands in for a capability — eaten" },
  { kind: "supply", gloss: "delivers outside information — shrinks, never vanishes" },
  { kind: "constrain", gloss: "forbids an outcome — not eaten, repriced" },
  { kind: "mixed", gloss: "one mechanism doing both jobs" },
]

export function HarnessLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        SEIG&apos;s eight mechanisms, sorted by what each one is standing in for
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b px-3 py-2">
        {LEGEND.map((l) => (
          <span key={l.kind} className="flex items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide uppercase ${KIND_STYLE[l.kind]}`}
            >
              {l.kind}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{l.gloss}</span>
          </span>
        ))}
      </div>

      <ol className="my-0 list-none divide-y pl-0">
        {ROWS.map((r) => (
          <li key={r.part} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] tracking-wide uppercase ${KIND_STYLE[r.kind]}`}
                >
                  {r.kind}
                </span>
                <span className="font-mono text-[12px] text-foreground">{r.part}</span>
              </div>
              <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{r.quote}</p>
            </div>
            <div className="border-l-2 border-border pl-3 sm:pl-3">
              <p className="font-mono text-[9.5px] tracking-wide text-muted-foreground uppercase">
                what a stronger base model does to it
              </p>
              <p className="mt-1 text-[12px] leading-5 text-foreground/90">{r.stronger}</p>
            </div>
          </li>
        ))}
      </ol>

      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Three of eight are pure substitutes, and they include the one the paper credits for
        the result. Counting rows flatters the harness; counting contribution does not.
      </figcaption>
    </figure>
  )
}
