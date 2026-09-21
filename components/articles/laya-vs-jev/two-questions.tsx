// One game frame, four prompts.
//
// Every string below is verbatim output from the repository's own code at
// commit 2854178 — laya_mlx.trex.planner.Planner.plan() followed by
// laya_mlx.trex.backends.build_question(plan, "labeled") — on snapshot 12 of the
// sample set that scripts/benchmark_trex_planner.py builds (seed 17, a jump
// every 39 frames, a snapshot every 31). The dino is on the ground at speed
// 6.62 with three small cacti ahead. Nothing here is paraphrased or redrawn.
//
// The only thing that changes between the four panels is the `first`, `gap` and
// `period` tuple the pilot hands the planner, which is derived from that
// player's own measured latency. Everything else — the frame, the course, the
// physics — is identical.

type Panel = {
  who: string
  timing: string
  state: string
  options: { action: string; text: string }[]
  best: string
  note: string
}

const PANELS: Panel[] = [
  {
    who: "Laya, real time",
    timing: "first=(1,3) gap=(1,3) period=2",
    state: "Dino runner game. 3 small cacti ahead, 172 px away.",
    best: "run",
    options: [
      { action: "jump", text: "Safe. Jumps too early." },
      { action: "duck", text: "Safe. Crouches; no benefit." },
      { action: "run", text: "Safe. Waits; acts later. Best." },
    ],
    note: "Three safe options. Answering jump is scored a miss.",
  },
  {
    who: "Jev, real time, 6 in flight",
    timing: "first=(18,24) gap=(18,24) period=6",
    state: "Dino runner game. 3 small cacti ahead, 70 px away.",
    best: "jump",
    options: [
      { action: "jump", text: "Safe. Clears the 3 small cacti. Best." },
      { action: "duck", text: "Unsafe. Hits the 3 small cacti. Collision." },
      { action: "run", text: "Safe. Waits; must act soon." },
    ],
    note: "Same frame. Answering jump is scored a hit.",
  },
  {
    who: "Jev, real time, 1 in flight",
    timing: "first=(18,24) gap=(18,24) period=None",
    state: "Dino runner game. 3 small cacti ahead, 70 px away.",
    best: "jump",
    options: [
      { action: "jump", text: "Safe. Clears the 3 small cacti. Best." },
      { action: "duck", text: "Unsafe. Hits the 3 small cacti. Collision." },
      { action: "run", text: "Unsafe. Hits the 3 small cacti. Collision." },
    ],
    note: "Two of three marked Collision. The exam is multiple choice with one option.",
  },
  {
    who: "Both players, --lockstep 6",
    timing: "first=(0,0) gap=(6,6) period=None",
    state: "Dino runner game. 3 small cacti ahead, 178 px away.",
    best: "run",
    options: [
      { action: "jump", text: "Safe. Jumps too early." },
      { action: "duck", text: "Safe. Crouches; no benefit." },
      { action: "run", text: "Safe. Waits; acts later. Best." },
    ],
    note: "Latency leaves the prompt, so both players get this one.",
  },
]

function Option({ action, text }: { action: string; text: string }) {
  const unsafe = text.startsWith("Unsafe.")
  const best = text.endsWith("Best.")
  return (
    <li className="flex gap-2 py-0.5">
      <span className="w-10 shrink-0 font-mono text-muted-foreground">
        {action}
      </span>
      <span
        className={
          best
            ? "font-medium text-foreground"
            : unsafe
              ? "text-muted-foreground line-through decoration-foreground/30"
              : "text-muted-foreground"
        }
      >
        {text}
      </span>
    </li>
  )
}

export function TwoQuestions() {
  return (
    <figure className="my-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {PANELS.map((p) => (
          <div
            key={p.who}
            className="rounded-md border bg-muted/20 p-3 text-xs leading-relaxed"
          >
            <div className="font-mono text-[11px] font-medium text-foreground">
              {p.who}
            </div>
            <div className="mb-2 font-mono text-[10px] text-muted-foreground">
              {p.timing}
            </div>
            <p className="my-0 border-l-2 border-foreground/20 pl-2 font-mono text-[11px] text-foreground">
              {p.state}
            </p>
            <ul className="my-2 list-none pl-0 font-mono text-[11px]">
              {p.options.map((o) => (
                <Option key={o.action} {...o} />
              ))}
            </ul>
            <div className="border-t pt-2 text-[11px] text-muted-foreground">
              {p.note}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-muted-foreground">
        One physical frame — snapshot 12 of the sample set the repository&rsquo;s own
        planner benchmark builds, seed 17, dino grounded at speed 6.62 — rendered
        four times by <code>build_question(plan, &quot;labeled&quot;)</code>. The
        distance in the state line is where the obstacle will be when{" "}
        <em>this player&rsquo;s</em> answer lands, so Laya is told 172 px and Jev
        70 px about the same instant. The recommended action is the opposite one.
        In lockstep the timing tuple is fixed by the flag rather than by the model,
        and the two players get the same question for the first time.
      </figcaption>
    </figure>
  )
}
