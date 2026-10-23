"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The virtio-net feature bits that matter here, read from the OpenVMM fork NVX pins
// (microsoft/openvmm feature/microvm/dev at 7ff31ed):
//   vm/devices/virtio/virtio_net/src/lib.rs  Device::traits()  what the device offers
//     (with the consomme backend, whose tx_offload_support() reports tcp, udp, tso, uso)
//   vm/devices/virtio/virtio/src/... transport                 adds VERSION_1
//   openvmm/openvmm_defs/src/microvm.rs                        MICROVM_VIRTIO_NET_FEATURES
//     = (1 << 5) | (1 << 32)   "Exact microVM virtio-net feature mask: MAC and virtio version 1."
//   openvmm/openvmm_core/src/worker/dispatch/microvm.rs        disabled_features = !mask
// The guest can only negotiate a bit that is offered AND inside the mask.

type Bit = { bit: number; name: string; gloss: string }

const BITS: Bit[] = [
  { bit: 0, name: "CSUM", gloss: "guest may hand the device a packet with a partial checksum to finish" },
  { bit: 1, name: "GUEST_CSUM", gloss: "device may hand the guest packets with unchecked checksums" },
  { bit: 3, name: "MTU", gloss: "device reports a maximum MTU" },
  { bit: 5, name: "MAC", gloss: "device supplies the guest's MAC address" },
  { bit: 11, name: "HOST_TSO4", gloss: "guest may send oversized TCPv4 segments for the host to split" },
  { bit: 12, name: "HOST_TSO6", gloss: "the same for TCPv6" },
  { bit: 16, name: "STATUS", gloss: "link-status field" },
  { bit: 28, name: "INDIRECT_DESC", gloss: "indirect descriptor tables" },
  { bit: 29, name: "EVENT_IDX", gloss: "interrupt and notification suppression" },
  { bit: 32, name: "VERSION_1", gloss: "modern virtio" },
  { bit: 34, name: "RING_PACKED", gloss: "packed virtqueue layout" },
  { bit: 35, name: "IN_ORDER", gloss: "in-order descriptor completion" },
  { bit: 56, name: "HOST_USO", gloss: "guest may send oversized UDP datagrams for the host to split" },
  { bit: 59, name: "GUEST_HDRLEN", gloss: "guest reports exact header lengths" },
  { bit: 63, name: "SPEED_DUPLEX", gloss: "link speed and duplex fields" },
]

const MASK = new Set([5, 32])

export function FeatureMask() {
  const [masked, setMasked] = useState(true)
  const live = BITS.filter((b) => !masked || MASK.has(b.bit))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">virtio-net feature bits the guest can negotiate</span>
        <div className="flex gap-1">
          {[
            { on: false, label: "device offers" },
            { on: true, label: "after NVX mask" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={masked === o.on}
              onClick={() => setMasked(o.on)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors",
                masked === o.on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid gap-1 p-4 sm:grid-cols-2">
        {BITS.map((b) => {
          const on = live.includes(b)
          return (
            <li
              key={b.bit}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-opacity",
                on ? "opacity-100" : "opacity-35 line-through decoration-muted-foreground/60",
              )}
            >
              <span className="w-7 shrink-0 text-right font-mono tabular-nums text-muted-foreground">{b.bit}</span>
              <span>
                <span className={cn("font-mono", b.bit === 0 && "font-semibold")}>{b.name}</span>
                <span className="text-muted-foreground"> · {b.gloss}</span>
              </span>
            </li>
          )
        })}
      </ul>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        {masked
          ? "2 of 15 bits survive: MAC and VERSION_1. Without CSUM the guest cannot ask anyone to finish a checksum, and without the TSO and USO bits it cannot ask anyone to split a packet. "
          : "15 bits offered by OpenVMM's virtio-net device over its in-process consomme backend, before the microVM mask. "}
        Read from the OpenVMM fork NVX pins (measured, from source).
      </figcaption>
    </figure>
  )
}
