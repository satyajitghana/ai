"use client"

// MutinyBIM's kernel and one add-on, as records. Everything structural here is
// read from the repository at commit 94513ba (11 Nov 2026):
// - the pack manifest, parameter set, lint rule and calc ids are the `acme`
//   stormwater example in docs/ADD-ON-CONTRACT.md (its class constant is
//   ACME_CLASS.vault; the doc's own id example, acme.retention_vault, stands in);
// - `classId` is ClassifiedCore's field in packages/bim-kernel/src/types.ts;
// - "the element's own value overrides its type's; clearing the own value puts
//   the type's back" is elementValueSource() in
//   packages/bim-kernel/src/elements/types.ts;
// - the IFC property-set mapping is the parameter's own `ifc` field from that
//   example, which packages/bim-ifc reads from the registries on export.
// The two volumes (900 and 1,150 ft3) are illustrative, not from the repo.
// SSR-safe: plain state, no transcendental maths.

import { useState } from "react"

type Source = "instance" | "type" | null

const TYPE_VALUE: number = 900
const OWN_VALUE: number = 1150

export function PackExplorer() {
  const [installed, setInstalled] = useState(true)
  const [typeSet, setTypeSet] = useState(true)
  const [ownSet, setOwnSet] = useState(false)

  const typeValue = installed && typeSet ? TYPE_VALUE : undefined
  const own = installed && ownSet ? OWN_VALUE : undefined
  const value = own ?? typeValue
  const from: Source = own !== undefined ? "instance" : typeValue !== undefined ? "type" : null
  const overrides = own !== undefined && (typeValue === undefined || own !== typeValue)

  const elementJson = [
    "{",
    '  "id": "vault-3",',
    '  "kind": "part",',
    '  "typeId": "type-vault-a",',
    installed ? '  "classId": "acme.retention_vault",' : '  "classId": "acme.retention_vault",  // kept',
    `  "values": {${ownSet ? ` "acme.required_volume": ${OWN_VALUE} ` : ""}}`,
    "}",
  ].join("\n")

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="MutinyBIM kernel and add-on explorer"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>kernel + add-on · one parameter, three records</span>
        <span className="text-muted-foreground/60">from the repo</span>
      </div>

      <div className="flex flex-wrap gap-2 border-b px-4 py-3 font-mono text-xs">
        <Toggle on={installed} onClick={() => setInstalled((v) => !v)} label="pack acme installed" />
        <Toggle on={typeSet} onClick={() => setTypeSet((v) => !v)} label="type has a value" disabled={!installed} />
        <Toggle on={ownSet} onClick={() => setOwnSet((v) => !v)} label="element overrides it" disabled={!installed} />
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <Column title="Kernel" note="knows records, not trades">
          <Row k="element kinds" v="level, part, space, zone, run, fitting, view, sheet…" />
          <Row k="types" v="element_type, part_type" />
          <Row k="parameters" v="any key, each names a unit kind" />
          <Row k="units" v="bim-units registry" />
          <Row k="edits" v="intent commands → changesets" />
        </Column>

        <Column title="Pack acme 0.1.0" note={installed ? "kernel ^1.13.0" : "not installed"} dim={!installed}>
          <Row k="CLASS" v="acme.retention_vault" />
          <Row k="PARAMETER_SET" v="acme.retention → acme.required_volume (volume, ft3)" />
          <Row k="LINT_RULE" v="acme.vault_too_small" />
          <Row k="CALC" v="acme.retention_volume" />
          <Row k="ifc" v="Acme_Retention.RequiredVolume" />
        </Column>

        <Column title="What a reader sees" note="elementValueSource()">
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug">{elementJson}</pre>
          <div className="mt-2 space-y-1 font-mono text-xs">
            <div>
              value:{" "}
              <span className="text-foreground">
                {value === undefined ? (installed ? "none" : "kept, no reader") : `${value.toLocaleString("en-US")} ft3`}
              </span>
            </div>
            <div>
              from: <span className="text-foreground">{from ?? "nowhere"}</span>
            </div>
            <div>
              overridesType: <span className="text-foreground">{String(overrides)}</span>
            </div>
          </div>
        </Column>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {installed
          ? "With the pack in force the kernel resolves acme.required_volume like any parameter: the element's own value if set, else its type's. IFC export writes it into the pack's property set with no exporter change."
          : "Without the pack, the model still carries the record and its pinned pack version. A host that lacks the pack says so by name and keeps what it cannot read."}{" "}
        Volumes are illustrative; ids are the repository&apos;s own example.
      </figcaption>
    </figure>
  )
}

function Toggle({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={
        "rounded-md border px-2 py-0.5 disabled:opacity-40 " +
        (on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  )
}

function Column({ title, note, dim, children }: { title: string; note: string; dim?: boolean; children: React.ReactNode }) {
  return (
    <div className={"rounded-lg border p-3 transition-opacity " + (dim ? "opacity-40" : "")}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{note}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="text-xs leading-snug">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  )
}
