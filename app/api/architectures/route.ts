import { architectures, architectureSignal } from "@/data/architectures"

export const dynamic = "force-static"

// Agent-readable roster of the model architectures gallery. Each entry carries
// its editorial interest + uniqueness; expose the derived signal so agents can
// sort/filter the same way the /architectures UI does.
export function GET() {
  return Response.json(
    architectures.map((a) => ({ ...a, signal: architectureSignal(a) })),
  )
}
