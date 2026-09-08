"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every value below was independently reproduced by this article, not copied from
// the model card. Fetched 2026-08-29 from
// https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF/resolve/main/
//   HauhauCS-RELEASE-MANIFEST.json / .sig, FastMTP-PROVENANCE.json / .sig,
//   HauhauCS-FastMTP-Ed25519-PUBLIC.pem
// Verified with Python's `cryptography` (load_pem_public_key on the .pem, then
// pub.verify(sig, data) on the exact downloaded bytes of each document): both
// signatures return VALID, no exception raised. The public key's DER
// (SubjectPublicKeyInfo) SHA-256 was computed locally and matches the
// `public_key_der_sha256` field FastMTP-PROVENANCE.json declares about itself:
// f7be4a2335582ab7b2e393ca1c40ce70e483f1492c0f57b8c6e05d8a7223833c.
// Raw signature/key bytes and file SHA-256s below are this article's own hex
// dumps of the downloaded files -- not transcribed from any HauhauCS document.

type DocKey = "manifest" | "provenance"

type Doc = {
  key: DocKey
  file: string
  bytes: number
  sha256: string
  sigFile: string
  sigHex: string
  scope: string
  extra: { label: string; value: string }[]
}

const DOCS: Record<DocKey, Doc> = {
  manifest: {
    key: "manifest",
    file: "HauhauCS-RELEASE-MANIFEST.json",
    bytes: 4828,
    sha256: "1413ec1a17d0bbe37d71b7b491cbfddc21d1d08b6c56fc25ba13c8cdda901826",
    sigFile: "HauhauCS-RELEASE-MANIFEST.json.sig",
    sigHex: "bd4c23d695b748d77d61ca33fb825b8e19289d9d92eaf5256ca77d7e3119b944cc5a0bae6726cec08c0a8a76ddd48b778b3dba63c97d6142c8c32a462641a300",
    scope: "repo-wide inventory: sha256 + byte count for 17 of the repo's 21 files",
    extra: [
      { label: "artifacts listed", value: "17 (12 GGUFs, README, patch, PEM, provenance + its .sig)" },
      { label: "not listed", value: "itself, its own .sig, SHA256SUMS, .gitattributes" },
    ],
  },
  provenance: {
    key: "provenance",
    file: "FastMTP-PROVENANCE.json",
    bytes: 882,
    sha256: "d16ff06655cb6ebccc84e81c6171f80f3aa6b55051c5b7c812f1b46fc127776a",
    sigFile: "FastMTP-PROVENANCE.json.sig",
    sigHex: "93f5b41802c3a468c2bf0cf6661bc29cb7b03b50a056ef31d0dcf0581a2fc64232a9654b26ddbcc7656b0a5ac923d41958fce8ef0b222eb9e7b0e43e2d23fc09",
    scope: "build attestation for one file: the FastMTP-32K.gguf sidecar",
    extra: [
      { label: "runtime_base", value: "ggerganov/llama.cpp@4df29be4…743bb8" },
      { label: "runtime_patch", value: "HauhauCS-FastMTP-llama.cpp.patch (sha256 pinned)" },
    ],
  },
}

const PUBKEY_HEX = "0abc20cb66f2920e59fb0b7cc1f7552aad437a68aa60d55c87e856151574183b"
const DER_SHA256 = "f7be4a2335582ab7b2e393ca1c40ce70e483f1492c0f57b8c6e05d8a7223833c"

const ACCENT = "oklch(0.60 0.15 255)"
const OK = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

const W = 760
const H = 190
const NODE_Y = 46
const NODE_H = 60

type NodeSpec = { x: number; w: number; title: string; lines: string[]; color: string }

function hexShort(h: string, n = 10) {
  return `${h.slice(0, n)}…${h.slice(-6)}`
}

export function SignatureChain() {
  const [docKey, setDocKey] = useState<DocKey>("manifest")
  const doc = DOCS[docKey]

  const nodes: NodeSpec[] = [
    {
      x: 20,
      w: 168,
      title: doc.file,
      lines: [`${doc.bytes.toLocaleString()} bytes`, `sha256 ${hexShort(doc.sha256, 8)}`],
      color: MUTED,
    },
    {
      x: 218,
      w: 168,
      title: doc.sigFile,
      lines: ["64 bytes · Ed25519", hexShort(doc.sigHex, 8)],
      color: ACCENT,
    },
    {
      x: 416,
      w: 168,
      title: "HauhauCS-FastMTP-Ed25519-PUBLIC.pem",
      lines: ["32-byte raw key", hexShort(PUBKEY_HEX, 8)],
      color: ACCENT,
    },
    {
      x: 614,
      w: 126,
      title: "pub.verify(sig, data)",
      lines: ["VALID", "no exception raised"],
      color: OK,
    },
  ]

  const curve = (x1: number, x2: number, y: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y} C ${mx} ${y}, ${mx} ${y}, ${x2} ${y}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Ed25519 verification, run against the downloaded bytes</span>
        <div className="flex gap-1.5">
          {(Object.keys(DOCS) as DocKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDocKey(k)}
              aria-pressed={docKey === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                docKey === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[640px] max-w-full" aria-label={`Signature chain for ${doc.file}: document, then its .sig, verified against the published Ed25519 public key, result VALID`}>
            <defs>
              <marker id="hqf-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={MUTED} strokeWidth={1.5} />
              </marker>
              <marker id="hqf-arrow-ok" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={OK} strokeWidth={1.5} />
              </marker>
              <filter id="hqf-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* connectors */}
            {nodes.slice(0, -1).map((n, i) => {
              const next = nodes[i + 1]
              const isLast = i === nodes.length - 2
              return (
                <path
                  key={i}
                  d={curve(n.x + n.w, next.x, NODE_Y + NODE_H / 2)}
                  fill="none"
                  stroke={isLast ? OK : MUTED}
                  strokeWidth={1.5}
                  markerEnd={`url(#${isLast ? "hqf-arrow-ok" : "hqf-arrow"})`}
                  opacity={0.7}
                />
              )
            })}

            {nodes.map((n, i) => (
              <g key={i}>
                <rect
                  x={n.x}
                  y={NODE_Y}
                  width={n.w}
                  height={NODE_H}
                  rx={9}
                  fill="var(--background)"
                  stroke={n.color}
                  strokeWidth={1.5}
                  filter="url(#hqf-soft)"
                />
                <text x={n.x + n.w / 2} y={NODE_Y + 20} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} fill={n.color}>
                  {n.title.length > 26 ? `${n.title.slice(0, 24)}…` : n.title}
                </text>
                {n.lines.map((l, j) => (
                  <text key={j} x={n.x + n.w / 2} y={NODE_Y + 34 + j * 12} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
                    {l}
                  </text>
                ))}
              </g>
            ))}

            <text x={20} y={H - 12} className="fill-muted-foreground font-mono" fontSize={9}>
              {doc.scope}
            </text>
          </svg>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {doc.extra.map((e) => (
            <div key={e.label} className="rounded-lg border bg-muted/10 px-2.5 py-1.5 font-mono text-[10px]">
              <span className="text-muted-foreground">{e.label}: </span>
              <span className="text-foreground">{e.value}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both documents verify. The public key is checked too, not just trusted: its DER (SubjectPublicKeyInfo)
          fingerprint, computed locally from the downloaded <code>.pem</code>, is{" "}
          <code className="text-foreground">{hexShort(DER_SHA256, 10)}</code> — matching the{" "}
          <code>public_key_der_sha256</code> field{" "}
          <span style={{ color: ACCENT }}>FastMTP-PROVENANCE.json</span> declares about itself, so the key that
          verifies the signature is the same key the signed document says it should be. The two documents do
          different jobs: the <span className="text-foreground">manifest</span> is a repo-wide inventory —
          17 of the 21 published files, each with a byte count and sha256 — while{" "}
          <span className="text-foreground">provenance</span> is a build attestation for a single file, naming
          the exact upstream commit and patch it was built against. A community GGUF repo shipping either one
          is unusual; this one ships both, signed with the same key, and both check out.
        </p>
      </div>
    </figure>
  )
}
