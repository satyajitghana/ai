import { ImageResponse } from "next/og"

import { profile } from "@/data/profile"

// Shared 1200×630 OG renderer for per-route opengraph-image.tsx files.
// Editorial × terminal: deep charcoal with a soft glow, the "S" brand mark, a
// mono command kicker, and a strong grotesk-weight title. Monochrome by design.
export const ogSize = { width: 1200, height: 630 }
export const ogContentType = "image/png"

const FG = "#fafafa"
const MUTED = "#8a8a8f"
const FAINT = "#5a5a60"

export function renderOgImage({
  kicker,
  title,
  subtitle,
  footerLeft = profile.name,
}: {
  kicker: string
  title: string
  subtitle?: string
  footerLeft?: string
}) {
  const titleSize = title.length > 54 ? 56 : title.length > 34 ? 68 : 80

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background:
            "linear-gradient(140deg, #0a0a0b 0%, #131316 55%, #0c0c0e 100%)",
          color: FG,
          fontFamily: "monospace",
          position: "relative",
        }}
      >
        {/* soft top-left glow for depth */}
        <div
          style={{
            position: "absolute",
            top: -260,
            left: -200,
            width: 700,
            height: 700,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
            display: "flex",
          }}
        />
        {/* hairline accent down the left edge */}
        <div
          style={{
            position: "absolute",
            top: 64,
            bottom: 64,
            left: 0,
            width: 4,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0.04))",
            display: "flex",
          }}
        />

        {/* top row: brand mark + kicker / domain chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: "#17171a",
                border: "1px solid rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 36,
                fontWeight: 700,
                color: FG,
              }}
            >
              S
            </div>
            <div style={{ display: "flex", fontSize: 22, color: MUTED }}>
              <span style={{ color: FAINT }}>$&nbsp;</span>
              {kicker}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: FAINT }}>
            managed by claude 🤖
          </div>
        </div>

        {/* title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 28,
                color: MUTED,
                maxWidth: 940,
                lineHeight: 1.3,
              }}
            >
              {subtitle.length > 120 ? subtitle.slice(0, 117) + "…" : subtitle}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 20,
            color: FAINT,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: 22,
          }}
        >
          <div style={{ display: "flex" }}>{footerLeft}</div>
          <div style={{ display: "flex", color: MUTED }}>ai.thesatyajit.com</div>
        </div>
      </div>
    ),
    ogSize
  )
}
