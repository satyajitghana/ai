import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Neuron lab — Satyajit Ghana"

export default function Image() {
  return renderOgImage({
    kicker: "open lab/neuron-lab",
    title: "Neuron lab",
    subtitle: "Steer a language model's neurons in your browser",
  })
}
