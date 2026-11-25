"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// A simulation of the WebMCP loop the AI SDK cookbook describes, with the model
// scripted. What is real code here: a page-side ModelContext with the draft's
// registerTool / getTools / executeTool, tools whose execute functions change
// this cart, and a client that does what @ai-sdk/mcp's Experimental_WebMCPTransport
// does with them (tools/list from getTools, tools/call through executeTool, the
// returned string parsed as JSON into structuredContent). What is scripted: the
// tool calls each prompt produces, which a model would choose. Prices and
// product names are the ones on screen in shadcn's demo video; the prompts are
// from that video.

type ProductId = "t-shirt" | "tote" | "mug"
type Cart = Record<ProductId, number>

const CATALOG: { id: ProductId; name: string; price: number }[] = [
  { id: "t-shirt", name: "T-Shirt", price: 24 },
  { id: "tote", name: "Tote Bag", price: 16 },
  { id: "mug", name: "Mug", price: 14 },
]
const EMPTY: Cart = { "t-shirt": 0, tote: 0, mug: 0 }
const total = (c: Cart) => CATALOG.reduce((s, p) => s + c[p.id] * p.price, 0)

// ---- the page side: a tiny document.modelContext, consumer and provider methods ----
type Annotations = { readOnlyHint?: boolean; untrustedContentHint?: boolean; consequentialHint?: boolean }
type PageTool = {
  name: string
  description: string
  inputSchema: object
  annotations?: Annotations
  execute: (input: Record<string, unknown>) => Promise<unknown>
}
class ModelContextShim {
  private tools = new Map<string, PageTool>()
  async registerTool(tool: PageTool, opts?: { signal?: AbortSignal }) {
    this.tools.set(tool.name, tool)
    opts?.signal?.addEventListener("abort", () => this.tools.delete(tool.name))
  }
  async getTools() {
    return [...this.tools.values()].map(({ name, description, inputSchema, annotations }) => ({
      name,
      description,
      inputSchema,
      annotations,
      origin: "https://shop.example",
    }))
  }
  async executeTool(tool: { name: string }, input: Record<string, unknown>) {
    const t = this.tools.get(tool.name)
    if (!t) throw new Error(`Unknown WebMCP tool: ${tool.name}`)
    return JSON.stringify(await t.execute(input)) // the draft hands the caller a string
  }
}

// ---- the browser MCP client, as the transport maps it ----
async function listTools(mc: ModelContextShim) {
  return (await mc.getTools()).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: t.annotations?.readOnlyHint }, // only readOnlyHint becomes an MCP annotation
    _meta: { "ai-sdk.dev/webmcp": { name: t.name, origin: t.origin, annotations: t.annotations ?? {} } },
  }))
}
async function callTool(mc: ModelContextShim, name: string, args: Record<string, unknown>) {
  const text = await mc.executeTool({ name }, args)
  const value = JSON.parse(text)
  return { content: [{ type: "text", text }], structuredContent: value }
}

// ---- the scripted model ----
type Call = { name: string; args: Record<string, unknown> }
type Step = { calls: Call[] } | { text: string }
type Mode = "cookbook" | "uisdk"

const PROMPTS = ["Add two mugs and a tote bag", "Clear the cart", "Add three t-shirts and a mug", "Place the order"] as const

function plan(mode: Mode, prompt: (typeof PROMPTS)[number], cart: Cart): Step[] {
  if (mode === "cookbook") {
    const read: Step = { calls: [{ name: "getCart", args: {} }] }
    switch (prompt) {
      case "Add two mugs and a tote bag":
        return [read, { calls: [{ name: "addToCart", args: { productId: "mug", quantity: 2 } }, { name: "addToCart", args: { productId: "tote", quantity: 1 } }] }, { text: "Added two mugs and a tote bag." }]
      case "Clear the cart": {
        const inCart = CATALOG.filter((p) => cart[p.id] > 0).map((p) => ({ name: "removeFromCart", args: { productId: p.id } }))
        return inCart.length ? [read, { calls: inCart }, { text: "Your cart is empty." }] : [read, { text: "Your cart is already empty." }]
      }
      case "Add three t-shirts and a mug":
        return [read, { calls: [{ name: "addToCart", args: { productId: "t-shirt", quantity: 3 } }, { name: "addToCart", args: { productId: "mug", quantity: 1 } }] }, { text: "Added three T-shirts and a mug." }]
      case "Place the order":
        return [read, { text: "I can read and change the cart, but this page gives me no tool to place an order. Use the Place Order button." }]
    }
  }
  switch (prompt) {
    case "Add two mugs and a tote bag":
      return [{ calls: [{ name: "act", args: { steps: [{ ref: "Mug quantity", action: "setValue", args: [cart.mug + 2] }, { ref: "Tote Bag quantity", action: "setValue", args: [cart.tote + 1] }] } }] }, { text: "Added two mugs and a tote bag." }]
    case "Clear the cart":
      return [{ calls: [{ name: "act", args: { steps: [{ ref: "Clear Cart", action: "press" }] } }] }, { text: "Cart cleared." }]
    case "Add three t-shirts and a mug":
      return [{ calls: [{ name: "act", args: { steps: [{ ref: "T-Shirt quantity", action: "setValue", args: [cart["t-shirt"] + 3] }, { ref: "Mug quantity", action: "setValue", args: [cart.mug + 1] }] } }] }, { text: "Added three T-shirts and a mug." }]
    case "Place the order":
      return [{ calls: [{ name: "act", args: { steps: [{ ref: "Place Order", action: "press" }] } }] }, { text: "The Place Order button needs you: confirm it on the page." }]
  }
}

type Line = { who: "you" | "server" | "browser" | "page" | "model"; text: string }

const WHO_STYLE: Record<Line["who"], string> = {
  you: "text-foreground",
  server: "text-sky-600 dark:text-sky-400",
  browser: "text-amber-600 dark:text-amber-400",
  page: "text-emerald-600 dark:text-emerald-400",
  model: "text-violet-600 dark:text-violet-400",
}

export function CartToolsLab() {
  const [mode, setMode] = useState<Mode>("cookbook")
  const [cart, setCart] = useState<Cart>(EMPTY)
  const cartRef = useRef<Cart>(EMPTY)
  const [log, setLog] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const [toolNames, setToolNames] = useState<string[]>([])
  const [stats, setStats] = useState({ requests: 0, calls: 0 })
  const [pending, setPending] = useState(false)
  const [placed, setPlaced] = useState<string | null>(null)
  const mcRef = useRef<ModelContextShim | null>(null)
  const logRef = useRef<HTMLOListElement>(null)

  const write = (next: Cart) => {
    cartRef.current = next
    setCart(next)
  }

  // Register this mode's tools on a fresh ModelContext; the abort unregisters them.
  useEffect(() => {
    const mc = new ModelContextShim()
    const ac = new AbortController()
    const snapshotCart = () => ({
      items: CATALOG.filter((p) => cartRef.current[p.id] > 0).map((p) => ({ productId: p.id, quantity: cartRef.current[p.id] })),
      totalUsd: total(cartRef.current),
      catalog: CATALOG.map((p) => ({ productId: p.id, name: p.name, priceUsd: p.price })),
    })
    const pid = { type: "string", enum: ["t-shirt", "tote", "mug"] }
    const tools: PageTool[] =
      mode === "cookbook"
        ? [
            { name: "getCart", description: "Read the current cart, total in USD, and product catalog.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true }, execute: async () => snapshotCart() },
            {
              name: "addToCart",
              description: "Add a quantity of a catalog product to the cart.",
              inputSchema: { type: "object", properties: { productId: pid, quantity: { type: "integer", minimum: 1, maximum: 20 } }, required: ["productId", "quantity"] },
              execute: async ({ productId, quantity }) => {
                const id = productId as ProductId
                write({ ...cartRef.current, [id]: Math.min(20, cartRef.current[id] + Number(quantity)) })
                return snapshotCart()
              },
            },
            {
              name: "updateCartItem",
              description: "Set an exact quantity; zero removes the item.",
              inputSchema: { type: "object", properties: { productId: pid, quantity: { type: "integer", minimum: 0, maximum: 20 } }, required: ["productId", "quantity"] },
              execute: async ({ productId, quantity }) => {
                write({ ...cartRef.current, [productId as ProductId]: Number(quantity) })
                return snapshotCart()
              },
            },
            {
              name: "removeFromCart",
              description: "Remove a product.",
              inputSchema: { type: "object", properties: { productId: pid }, required: ["productId"] },
              execute: async ({ productId }) => {
                write({ ...cartRef.current, [productId as ProductId]: 0 })
                return snapshotCart()
              },
            },
          ]
        : [
            {
              name: "snapshot",
              description: "Lists the components on the page now.",
              inputSchema: { type: "object", properties: {} },
              annotations: { readOnlyHint: true, untrustedContentHint: true, consequentialHint: false },
              execute: async () => [
                ...CATALOG.map((p) => ({ component: "number-input", label: `${p.name} quantity`, value: cartRef.current[p.id], actions: ["setValue"] })),
                { component: "button", label: "Clear Cart", actions: ["press"] },
                { component: "button", label: "Place Order", actions: ["press"], confirm: true },
              ],
            },
            {
              name: "query",
              description: "Finds components by text without listing the page.",
              inputSchema: { type: "object", properties: { text: { type: "string" } } },
              annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: false },
              execute: async () => [],
            },
            {
              name: "act",
              description: "Does a whole task in one call. Runs steps in order and stops at the first that fails.",
              inputSchema: { type: "object", properties: { steps: { type: "array" } }, required: ["steps"] },
              annotations: { readOnlyHint: false, untrustedContentHint: true, consequentialHint: true },
              execute: async ({ steps }) => {
                const done: { ref: string; changed: string }[] = []
                for (const s of steps as { ref: string; action: string; args?: unknown[] }[]) {
                  const p = CATALOG.find((c) => `${c.name} quantity`.toLowerCase() === s.ref.toLowerCase())
                  if (p && s.action === "setValue") {
                    write({ ...cartRef.current, [p.id]: Number(s.args?.[0] ?? 0) })
                    done.push({ ref: s.ref, changed: `value ${cartRef.current[p.id]}` })
                  } else if (s.ref === "Clear Cart" && s.action === "press") {
                    write({ ...EMPTY })
                    done.push({ ref: s.ref, changed: "pressed" })
                  } else if (s.ref === "Place Order" && s.action === "press") {
                    setPending(true)
                    return { ok: false, steps: done, error: `Step ${done.length + 1}: Needs a person. "Place Order" is marked data-agent-confirm.` }
                  } else {
                    return { ok: false, steps: done, error: `Step ${done.length + 1}: nothing on the page is named "${s.ref}".` }
                  }
                }
                return { ok: true, steps: done }
              },
            },
          ]
    for (const t of tools) void mc.registerTool(t, { signal: ac.signal })
    mcRef.current = mc
    void listTools(mc).then((ts) => setToolNames(ts.map((t) => t.name)))
    return () => ac.abort()
  }, [mode])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const push = (l: Line) => setLog((prev) => [...prev, l])
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function run(prompt: (typeof PROMPTS)[number]) {
    const mc = mcRef.current
    if (!mc || busy) return
    setBusy(true)
    setPlaced(null)
    push({ who: "you", text: `“${prompt}”` })
    const steps = plan(mode, prompt, cartRef.current)
    for (const step of steps) {
      const defs = await listTools(mc)
      setStats((s) => ({ ...s, requests: s.requests + 1 }))
      push({ who: "browser", text: `prepareSendMessagesRequest: listTools() → ${defs.length} definitions, POST /api/chat` })
      push({ who: "server", text: `createMCPTools(definitions) → streamText(…, tools)` })
      await wait(260)
      if ("text" in step) {
        push({ who: "model", text: step.text })
        break
      }
      for (const c of step.calls) {
        push({ who: "model", text: `tool-call ${c.name}(${JSON.stringify(c.args)})` })
        await wait(180)
        const out = await callTool(mc, c.name, c.args)
        setStats((s) => ({ ...s, calls: s.calls + 1 }))
        const short = out.content[0].text.length > 110 ? out.content[0].text.slice(0, 107) + "…" : out.content[0].text
        push({ who: "page", text: `executeTool(${c.name}) → ${short}` })
        push({ who: "browser", text: `addToolOutput(${c.name}); sendAutomaticallyWhen resends` })
        await wait(180)
      }
    }
    setBusy(false)
  }

  function confirmOrder(yes: boolean) {
    setPending(false)
    if (!yes) {
      push({ who: "page", text: "You cancelled. The order was not placed." })
      return
    }
    const items = CATALOG.filter((p) => cartRef.current[p.id] > 0).map((p) => `${cartRef.current[p.id]} × ${p.name}`)
    setPlaced(items.length ? `Order placed: ${items.join(", ")}, $${total(cartRef.current)}.` : "Nothing to order.")
    push({ who: "page", text: "You pressed Place Order on the confirm the page showed." })
    write({ ...EMPTY })
  }

  function reset(next: Mode) {
    setMode(next)
    write({ ...EMPTY })
    setLog([])
    setStats({ requests: 0, calls: 0 })
    setPending(false)
    setPlaced(null)
  }

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3">
        <span className="font-medium">One cart, two kinds of page tools</span>
        <span className="block text-muted-foreground">
          A simulation: the tools, the page-side <code className="font-mono text-[12px]">modelContext</code> and the transport&apos;s mapping are real code running here; the model is scripted, so each prompt always makes the same calls.
        </span>
      </figcaption>

      <div role="tablist" aria-label="Which tools the page registers" className="mb-3 inline-flex rounded-md border border-border p-0.5 text-xs">
        {(["cookbook", "uisdk"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            type="button"
            onClick={() => reset(m)}
            className={cn("rounded px-2.5 py-1", mode === m ? "bg-foreground text-background" : "text-muted-foreground")}
          >
            {m === "cookbook" ? "Four hand-written tools (AI SDK cookbook)" : "Three generic tools (UI SDK registerTools)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-medium">Corner Store</span>
            <span className="font-mono text-[11px] text-muted-foreground">registered: {toolNames.join(", ")}</span>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {CATALOG.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="py-1.5">{p.name}</td>
                  <td className="py-1.5 font-mono text-muted-foreground">${p.price}.00</td>
                  <td className="py-1.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      <button type="button" aria-label={`One fewer ${p.name}`} className="rounded border border-border px-1.5" onClick={() => write({ ...cartRef.current, [p.id]: Math.max(0, cartRef.current[p.id] - 1) })}>
                        −
                      </button>
                      <span className={cn("inline-block w-6 text-center font-mono transition-colors", cart[p.id] > 0 && "text-foreground font-semibold")} aria-label={`${p.name} quantity`}>
                        {cart[p.id]}
                      </span>
                      <button type="button" aria-label={`One more ${p.name}`} className="rounded border border-border px-1.5" onClick={() => write({ ...cartRef.current, [p.id]: Math.min(20, cartRef.current[p.id] + 1) })}>
                        +
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="py-1.5 font-medium">Total</td>
                <td />
                <td className="py-1.5 text-right font-mono font-semibold">${total(cart)}.00</td>
              </tr>
            </tbody>
          </table>
          <div className="mt-2 flex gap-2 text-xs">
            <button type="button" className="rounded border border-border px-2 py-1" onClick={() => write({ ...EMPTY })}>
              Clear Cart
            </button>
            <button type="button" className="rounded bg-foreground px-2 py-1 text-background" onClick={() => setPending(true)}>
              Place Order
            </button>
          </div>
          {pending && (
            <div className="mt-3 rounded-md border border-amber-500/60 bg-amber-500/10 p-2 text-xs">
              <p className="mb-2">The assistant wants to place your order (${total(cart)}.00). This button is marked for a person.</p>
              <div className="flex gap-2">
                <button type="button" className="rounded border border-border px-2 py-1" onClick={() => confirmOrder(false)}>
                  Cancel
                </button>
                <button type="button" className="rounded bg-foreground px-2 py-1 text-background" onClick={() => confirmOrder(true)}>
                  Place Order
                </button>
              </div>
            </div>
          )}
          {placed && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{placed}</p>}
        </div>

        <div className="flex min-w-0 flex-col rounded-md border border-border bg-background p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => (
              <button key={p} type="button" disabled={busy} onClick={() => void run(p)} className="rounded-full border border-border px-2.5 py-1 text-xs disabled:opacity-50">
                {p}
              </button>
            ))}
          </div>
          <ol ref={logRef} aria-live="polite" className="h-64 overflow-y-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-snug">
            {log.length === 0 && <li className="text-muted-foreground">Pick a prompt. Each line is one hop: browser, server, model or page.</li>}
            {log.map((l, i) => (
              <li key={i} className="break-words">
                <span className={cn("font-semibold", WHO_STYLE[l.who])}>{l.who}</span> {l.text}
              </li>
            ))}
          </ol>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            requests to the server: {stats.requests} · tool calls run in the page: {stats.calls}
          </p>
        </div>
      </div>
    </figure>
  )
}

