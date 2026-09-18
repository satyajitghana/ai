import { cn } from "@/lib/utils"

// The article's central idea, drawn once. A connectome (EM reconstruction +
// synapse detection + neurotransmitter prediction) hands a modeler exactly
// four things, measured. Every model built on top of it — reservoir, DMN,
// spiking simulator, LLM adapter — has to invent everything on the right,
// because no EM volume tells you a synaptic weight, a time constant, a
// receptor kinetic, or a neuromodulator's effect. Server-rendered, zero JS:
// the point is a fixed fact, not something to play with.

const MEASURED = [
  { k: "Neuron identity", v: "which cell, which type, where its soma sits" },
  { k: "Synapse locations", v: "every detected pre/postsynaptic contact, in 3D" },
  { k: "Contact counts", v: "how many synapses connect a specific neuron pair" },
  { k: "Neurotransmitter", v: "predicted per neuron — ACh, GABA, glutamate, …" },
]

const SUPPLIED = [
  { k: "Synaptic weight", v: "contacts → a number, by some formula the modeler picks" },
  { k: "Sign / receptor", v: "transmitter → excitatory or inhibitory, by convention" },
  { k: "Time constants", v: "how fast a neuron leaks, integrates, adapts" },
  { k: "Neuromodulation", v: "dopamine, octopamine gain — not in the wiring diagram" },
  { k: "Spiking vs. rate", v: "the whole choice of neuron model" },
  { k: "Input encoding", v: "how a stimulus becomes current into real neurons" },
]

export function ConnectomeSupplies() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        a connectome is a wiring diagram with synapse counts and predicted transmitters &mdash; nothing else
      </div>

      <div className="grid sm:grid-cols-2">
        <div className="border-b p-4 sm:border-b-0 sm:border-r">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: "oklch(0.6 0.14 155)" }}
              aria-hidden
            />
            <span className="font-mono text-xs font-medium tracking-wide text-foreground uppercase">
              measured, once, by EM
            </span>
          </div>
          <dl className="space-y-3">
            {MEASURED.map((row) => (
              <div key={row.k}>
                <dt className="font-mono text-[13px] font-medium text-foreground">{row.k}</dt>
                <dd className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: "oklch(0.62 0.19 25)" }}
              aria-hidden
            />
            <span className="font-mono text-xs font-medium tracking-wide text-foreground uppercase">
              supplied by every model, from assumption
            </span>
          </div>
          <dl className="space-y-3">
            {SUPPLIED.map((row) => (
              <div key={row.k}>
                <dt className="font-mono text-[13px] font-medium text-foreground">{row.k}</dt>
                <dd className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{row.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div
        className={cn(
          "border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground"
        )}
      >
        Every project in this piece draws the same left column from the same handful of
        datasets. What separates them is entirely what they chose for the right column &mdash;
        and that is where every disagreement about &ldquo;does the connectome matter&rdquo;
        actually lives.
      </div>
    </figure>
  )
}
