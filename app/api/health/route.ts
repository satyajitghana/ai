import { health } from "@/data/health"
import { deriveStatus } from "@/lib/health/status"

export const dynamic = "force-static"

export function GET() {
  return Response.json({
    ...health,
    biomarkers: health.biomarkers.map((b) => ({
      ...b,
      status: deriveStatus(b.value, b.optimalRange),
    })),
  })
}
