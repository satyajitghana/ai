import { patents } from "@/data/patents"

export const dynamic = "force-static"

export function GET() {
  return Response.json(patents)
}
