import { reading } from "@/data/reading"

export const dynamic = "force-static"

export function GET() {
  return Response.json(reading)
}
