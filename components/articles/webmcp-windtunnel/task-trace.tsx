// One real WindTunnel attempt, step by step: md-8 (guest checkout on the Medusa
// store) run by Jev + Mercury 2.5 over WebMCP.
//
// Every number here is read out of the published transcript —
// results/2026-09-18-jev-mercury/webmcp-traces.jsonl.gz, run_id
// md-8_wm-jev-mercury-v3_0f360b4e…, joined to its row in results.csv. Token
// counts, latencies, per-call costs, Jev's probability distribution over the
// offered menu, Mercury's emitted arguments and the tool's reply are all
// verbatim; only the order id is shortened for display.
//
// The point of the layout is the alternation. Jev never writes a string and
// Mercury never picks an action, so every step is exactly two calls to two
// different models with two different price sheets.
//
// Server-rendered, zero JS.

type Step = {
  n: number
  menu: number
  jev: { in: number; out: number; ms: number; cost: number }
  pick: string
  p: number
  also?: string
  mercury?: { in: number; out: number; ms: number; cost: number }
  args: string
  result: string
  ok: boolean
}

const STEPS: Step[] = [
  {
    n: 1,
    menu: 8,
    jev: { in: 2467, out: 82, ms: 1111, cost: 0.000103614 },
    pick: "search_products",
    p: 1.0,
    mercury: { in: 1824, out: 52, ms: 967, cost: 0.0004038 },
    args: `{"query":"t-shirt","category":"t-shirts","max_results":10}`,
    result: `error: Unknown category 't-shirts'. valid_categories: Merch, Sweatshirts, Pants, Shirts`,
    ok: false,
  },
  {
    n: 2,
    menu: 8,
    jev: { in: 2597, out: 82, ms: 393, cost: 0.000109074 },
    pick: "search_products",
    p: 0.99,
    also: "ask_site 0.01",
    mercury: { in: 1914, out: 52, ms: 821, cost: 0.0004218 },
    args: `{"query":"t-shirt","category":"shirts","max_results":10}`,
    result: `count: 1 — Medusa T-Shirt, handle t-shirt, price_from €10.00, options Size[S,M,L,XL] Color[Black,White]`,
    ok: true,
  },
  {
    n: 3,
    menu: 8,
    jev: { in: 3166, out: 82, ms: 324, cost: 0.000132972 },
    pick: "add_to_cart",
    p: 1.0,
    mercury: { in: 2298, out: 60, ms: 837, cost: 0.0005046 },
    args: `{"variant_id":"variant_01M2RSQZMH97…","quantity":1}`,
    result: `added — cart.item_count 1, "Medusa T-Shirt", variant "L / Black", total €10.00`,
    ok: true,
  },
  {
    n: 4,
    menu: 8,
    jev: { in: 3387, out: 82, ms: 347, cost: 0.000142254 },
    pick: "complete_checkout",
    p: 1.0,
    mercury: { in: 2682, out: 136, ms: 895, cost: 0.0006384 },
    args: `{"email":"jane.tester@example.test","first_name":"Jane","last_name":"Tester","address_1":"1 High Street","city":"London","postal_code":"N1 9GU","country_code":"gb","phone":"+44 20 7946 0000"}`,
    result: `error: Choose a shipping option and call again with shipping_option_id. choices: Standard Shipping (so_01M2RSQZJ9J5…), Express Shipping (so_01M2RSQZJ9YA…)`,
    ok: false,
  },
  {
    n: 5,
    menu: 10,
    jev: { in: 4126, out: 98, ms: 410, cost: 0.000173292 },
    pick: "complete_checkout",
    p: 0.91,
    also: "__abstain__ 0.07, ask_site 0.01, begin_checkout 0.01",
    mercury: { in: 3171, out: 175, ms: 985, cost: 0.00076545 },
    args: `{…same eight fields…,"shipping_option_id":"so_01M2RSQZJ9J5…"}`,
    result: `order_01M2RTVM… placed — display #1, total 20 EUR, 1 × Medusa T-Shirt (L / Black), payment pp_system_default`,
    ok: true,
  },
  {
    n: 6,
    menu: 10,
    jev: { in: 4580, out: 98, ms: 321, cost: 0.00019236 },
    pick: "__finish__",
    p: 0.98,
    also: "__abstain__ 0.02",
    mercury: { in: 3221, out: 121, ms: 918, cost: 0.00073495 },
    args: `{"answer":"Order confirmed. Order ID: order_01M2RTVM… Total: €20.00 …"}`,
    result: `attempt ends — scored by reading the store's database: orders == 1`,
    ok: true,
  },
]

const usd = (v: number) => `$${v.toFixed(6)}`
const num = (v: number) => v.toLocaleString("en-US")

function Line({
  tag,
  tone,
  children,
}: {
  tag: string
  tone: "jev" | "mercury" | "site"
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2 py-1">
      <span
        className={`mt-px w-[3.6rem] shrink-0 rounded-sm px-1 text-center font-mono text-[10px] leading-5 ${
          tone === "jev"
            ? "bg-foreground text-background"
            : tone === "mercury"
              ? "bg-foreground/15 text-foreground"
              : "border border-dashed border-border text-muted-foreground"
        }`}
      >
        {tag}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function TaskTrace() {
  const jevCost = STEPS.reduce((a, s) => a + s.jev.cost, 0)
  const mercCost = STEPS.reduce((a, s) => a + (s.mercury?.cost ?? 0), 0)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="space-y-1 border-b px-3 py-2">
        <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
          task md-8 · nextjs-starter-medusa · tier: sensitive action
        </p>
        <p className="font-mono text-[11px] leading-5">
          &ldquo;Buy one Medusa T-Shirt, size L, color Black — add it to the cart and
          complete guest checkout as Jane Tester, jane.tester@example.test, 1 High
          Street, London, N1 9GU, United Kingdom, phone +44 20 7946 0000, using the
          store&rsquo;s test payment method. Report the order confirmation.&rdquo;
        </p>
      </div>

      <div className="divide-y">
        {STEPS.map((s) => (
          <div key={s.n} className="px-3 py-2">
            <div className="flex items-baseline justify-between font-mono text-[10px] text-muted-foreground">
              <span>step {s.n}</span>
              <span>{s.menu} options offered</span>
            </div>

            <Line tag="jev" tone="jev">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <code className="font-mono text-[11px] font-semibold">{s.pick}</code>
                <span className="font-mono text-[10px] text-muted-foreground">
                  p={s.p.toFixed(2)}
                  {s.also ? ` · ${s.also}` : ""}
                </span>
              </div>
              <div
                className="mt-1 h-1 rounded-full bg-foreground/15"
                aria-hidden="true"
              >
                <div
                  className="h-1 rounded-full bg-foreground"
                  style={{ width: `${s.p * 100}%` }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {num(s.jev.in)} in / {s.jev.out} out · {num(s.jev.ms)} ms ·{" "}
                {usd(s.jev.cost)}
              </p>
            </Line>

            {s.mercury ? (
              <Line tag="mercury" tone="mercury">
                <code className="block font-mono text-[11px] leading-5 break-words">
                  {s.args}
                </code>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {num(s.mercury.in)} in / {s.mercury.out} out · {num(s.mercury.ms)} ms
                  · {usd(s.mercury.cost)}
                </p>
              </Line>
            ) : null}

            <Line tag="site" tone="site">
              <p
                className={`font-mono text-[11px] leading-5 break-words ${
                  s.ok ? "" : "text-destructive"
                }`}
              >
                {s.result}
              </p>
            </Line>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-3 py-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-4">
        <span>6 steps · 12 model calls</span>
        <span>5 tool calls executed</span>
        <span>
          Jev {usd(jevCost)} ({Math.round((100 * jevCost) / (jevCost + mercCost))}%)
        </span>
        <span>
          Mercury {usd(mercCost)} (
          {Math.round((100 * mercCost) / (jevCost + mercCost))}%)
        </span>
        <span className="col-span-2 sm:col-span-4">
          total {usd(jevCost + mercCost)} · 10.478 s agent time · pass
        </span>
      </div>

      <figcaption className="border-t px-3 py-2 text-center font-mono text-[11px] leading-5 text-muted-foreground">
        Verbatim from the published transcript for run{" "}
        <code>md-8_wm-jev-mercury-v3_0f360b4e</code>. Note steps 1 and 4: the tool
        rejects Mercury&rsquo;s arguments and returns the legal values, and the next
        step fixes them. Error recovery here is a tool contract, not a model
        capability.
      </figcaption>
    </figure>
  )
}
