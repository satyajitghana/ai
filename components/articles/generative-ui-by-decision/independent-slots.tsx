// Why two slots can contradict each other, drawn from the real layout pass.
//
// json-render's batched composer asks placement for every non-root element in
// ONE evaluation call. `composeBatch` builds the question set in a single
// forEach over the selected elements, and the only thing it removes from a
// node's list of possible parents is the node itself:
//
//     const parents = new Map(
//       [...destinations].filter(([, parent]) => parent.id !== id),
//     );
//
// So `parent_node_1` may legally answer "node_2", and `parent_node_2` may
// legally answer "node_1". Neither question can see the other's answer — they
// were serialized into the same request before either was scored. The joint
// answer is a two-node cycle that is unreachable from the root, and
// `indexTree()` throws on it after the fact.
//
// Everything here is the real mechanism at v0.21.0 (3ad3818): the destination
// key format (`node_0:default`), the self-filter, the single call, and the
// thrown message ("Spec contains unreachable elements.").
//
// Server-rendered, zero JS. Integer coordinates only — no transcendentals.

const ACCENT = "oklch(0.60 0.15 255)"
const WARN = "oklch(0.60 0.17 25)"

const W = 760
const H = 470

/** One selected element, as it exists after the select call: no parent yet. */
function Chip({
  x,
  y,
  id,
  type,
  container,
}: {
  x: number
  y: number
  id: string
  type: string
  container: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={150}
        height={38}
        rx={7}
        fill="var(--background)"
        stroke={container ? ACCENT : "var(--border)"}
        strokeWidth={container ? 1.5 : 1}
        strokeDasharray={container ? undefined : "4 3"}
      />
      <text x={x + 11} y={y + 16} className="fill-foreground font-mono" fontSize={10}>
        {id}
      </text>
      <text
        x={x + 11}
        y={y + 30}
        className="fill-muted-foreground font-mono"
        fontSize={9}
      >
        {type}
      </text>
    </g>
  )
}

/** One `parent_<id>` question: its own instruction, its own criteria keys. */
function Question({
  x,
  name,
  subject,
  criteria,
  chosen,
}: {
  x: number
  name: string
  subject: string
  criteria: readonly string[]
  chosen: string
}) {
  return (
    <g>
      <rect
        x={x}
        y={196}
        width={316}
        height={124}
        rx={9}
        fill="var(--background)"
        stroke="var(--border)"
        strokeWidth={1}
      />
      <text x={x + 12} y={215} className="fill-foreground font-mono" fontSize={10.5}>
        {name}
      </text>
      <text
        x={x + 12}
        y={230}
        className="fill-muted-foreground font-mono"
        fontSize={9}
      >
        {subject}
      </text>
      {criteria.map((key, i) => {
        const y = 244 + i * 23
        const picked = key === chosen
        return (
          <g key={key}>
            <rect
              x={x + 12}
              y={y}
              width={292}
              height={19}
              rx={4}
              fill={picked ? "var(--muted)" : "transparent"}
              stroke={picked ? WARN : "var(--border)"}
              strokeWidth={picked ? 1.5 : 1}
            />
            <text
              x={x + 20}
              y={y + 13}
              className={picked ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
              fontSize={9.5}
            >
              {key}
            </text>
            {picked ? (
              <text
                x={x + 296}
                y={y + 13}
                textAnchor="end"
                className="font-mono"
                fontSize={9}
                fill={WARN}
              >
                chosen
              </text>
            ) : null}
          </g>
        )
      })}
    </g>
  )
}

export function IndependentSlots() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="A three-band diagram of json-render's batched layout pass. Band one: four selected elements exist after the select call — node_0 a Card and the root, node_1 a Stack, node_2 a Grid, node_3 a Heading — and none has a parent yet. Band two: one evaluation call carries a separate parent question per element. parent_node_1 offers node_0:default and node_2:default and chooses node_2:default; parent_node_2 offers node_0:default and node_1:default and chooses node_1:default. A dashed barrier between the two questions marks that neither can read the other's answer, because both were serialized into the same request before either was scored. Band three: jointly the two answers put node_1 inside node_2 and node_2 inside node_1, a two-node cycle unreachable from the root, so the composer's whole-tree validation throws Spec contains unreachable elements and the reader is left with the catalog-order preview."
      >
        <defs>
          <marker
            id="gvd-is-arrow"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
          </marker>
          <marker
            id="gvd-is-cycle"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke={WARN} strokeWidth={1.5} />
          </marker>
        </defs>

        {/* ── Band A: what the select call left behind ──────────────────── */}
        <text x={22} y={18} className="fill-muted-foreground font-mono" fontSize={10}>
          AFTER CALL 1 — MEMBERSHIP IS DECIDED, PLACEMENT IS NOT
        </text>
        <Chip x={22} y={30} id="node_0" type="Card (root) · default" container />
        <Chip x={190} y={30} id="node_1" type="Stack · default" container />
        <Chip x={358} y={30} id="node_2" type="Grid · default" container />
        <Chip x={526} y={30} id="node_3" type="Heading · no slot" container={false} />
        <text x={22} y={88} className="fill-muted-foreground font-mono" fontSize={9.5}>
          destinations = every slot of every selected container = node_0:default,
          node_1:default, node_2:default
        </text>

        {/* ── Band B: one call, independent questions ───────────────────── */}
        <line x1={22} y1={106} x2={W - 22} y2={106} stroke="var(--border)" strokeWidth={1} />
        <text x={22} y={128} className="fill-muted-foreground font-mono" fontSize={10}>
          CALL 2 — ONE REQUEST, ONE QUESTION PER ELEMENT
        </text>
        <rect
          x={22}
          y={140}
          width={W - 44}
          height={40}
          rx={7}
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text x={34} y={158} className="fill-foreground font-mono" fontSize={9.5}>
          {`parents = destinations.filter(([, parent]) => parent.id !== id)`}
        </text>
        <text x={34} y={172} className="fill-muted-foreground font-mono" fontSize={9}>
          the only exclusion is the node itself — an ancestor cannot be excluded,
          because nothing has an ancestor yet
        </text>

        <Question
          x={22}
          name="parent_node_1"
          subject="Choose the final parent and slot for node_1 (Stack)."
          criteria={["node_0:default", "node_2:default"]}
          chosen="node_2:default"
        />
        <Question
          x={422}
          name="parent_node_2"
          subject="Choose the final parent and slot for node_2 (Grid)."
          criteria={["node_0:default", "node_1:default"]}
          chosen="node_1:default"
        />

        {/* the barrier between the two questions */}
        <line
          x1={380}
          y1={196}
          x2={380}
          y2={320}
          stroke="var(--muted-foreground)"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.7}
        />
        <text
          x={380}
          y={334}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize={9}
        >
          scored independently
        </text>

        {/* ── Band C: the joint answer ──────────────────────────────────── */}
        <line x1={22} y1={352} x2={W - 22} y2={352} stroke="var(--border)" strokeWidth={1} />
        <text x={22} y={374} className="fill-muted-foreground font-mono" fontSize={10}>
          ASSEMBLED ON A PRIVATE CLONE, THEN VALIDATED AS A WHOLE
        </text>

        {/* reachable part */}
        <rect
          x={22}
          y={386}
          width={96}
          height={26}
          rx={5}
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text x={34} y={403} className="fill-foreground font-mono" fontSize={9.5}>
          node_0
        </text>
        <path
          d="M 118 399 L 146 399"
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.2}
          markerEnd="url(#gvd-is-arrow)"
        />
        <rect
          x={150}
          y={386}
          width={96}
          height={26}
          rx={5}
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text x={162} y={403} className="fill-foreground font-mono" fontSize={9.5}>
          node_3
        </text>
        <text x={22} y={432} className="fill-muted-foreground font-mono" fontSize={9}>
          reachable from the root: 2 of 4
        </text>

        {/* the cycle */}
        <rect
          x={296}
          y={386}
          width={96}
          height={26}
          rx={5}
          fill="var(--background)"
          stroke={WARN}
          strokeWidth={1.5}
        />
        <text x={308} y={403} className="fill-foreground font-mono" fontSize={9.5}>
          node_1
        </text>
        <rect
          x={432}
          y={386}
          width={96}
          height={26}
          rx={5}
          fill="var(--background)"
          stroke={WARN}
          strokeWidth={1.5}
        />
        <text x={444} y={403} className="fill-foreground font-mono" fontSize={9.5}>
          node_2
        </text>
        <path
          d="M 392 393 C 410 380, 414 380, 428 391"
          fill="none"
          stroke={WARN}
          strokeWidth={1.4}
          markerEnd="url(#gvd-is-cycle)"
        />
        <path
          d="M 432 407 C 414 420, 410 420, 396 409"
          fill="none"
          stroke={WARN}
          strokeWidth={1.4}
          markerEnd="url(#gvd-is-cycle)"
        />
        <text x={296} y={432} className="font-mono" fontSize={9} fill={WARN}>
          each is the other&rsquo;s parent
        </text>

        <rect
          x={554}
          y={382}
          width={184}
          height={56}
          rx={7}
          fill="var(--background)"
          stroke={WARN}
          strokeWidth={1.5}
        />
        <text x={566} y={400} className="fill-foreground font-mono" fontSize={9.5}>
          validate(next) throws
        </text>
        <text x={566} y={414} className="font-mono" fontSize={9} fill={WARN}>
          &ldquo;Spec contains unreachable
        </text>
        <text x={566} y={426} className="font-mono" fontSize={9} fill={WARN}>
          elements.&rdquo;
        </text>
        <text x={22} y={454} className="fill-muted-foreground font-mono" fontSize={9}>
          both answers were keys the composer offered
        </text>
        <text
          x={W - 22}
          y={454}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={9}
        >
          you keep the call-1 preview, in catalog order, labelled partial
        </text>
      </svg>
      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        The bounded-output property covers <em>which</em> components, props and actions
        &mdash; those are copied from your objects. It does not cover tree shape, because
        tree shape is the joint consequence of answers taken in parallel. Destination keys,
        the self-only filter and the thrown message are from{" "}
        <code>experimental-composition-batch.ts</code> and{" "}
        <code>experimental-composition-tree.ts</code> at 0.21.0.
      </figcaption>
    </figure>
  )
}
