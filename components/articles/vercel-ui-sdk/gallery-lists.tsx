"use client"

import { useState } from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "@ui-sdk/react/command"
import { Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel } from "@ui-sdk/react/tree"

import { Icon, icons, Specimen, ui } from "./kit"

type Node = { value: string; label: string; children?: Node[] }

const FILES: Node[] = [
  {
    value: "app",
    label: "app",
    children: [
      { value: "app/layout.tsx", label: "layout.tsx" },
      { value: "app/page.tsx", label: "page.tsx" },
      { value: "app/settings", label: "settings", children: [{ value: "app/settings/page.tsx", label: "page.tsx" }] },
    ],
  },
  {
    value: "components",
    label: "components",
    children: [
      { value: "components/region-select.tsx", label: "region-select.tsx" },
      { value: "components/agent.ts", label: "agent.ts" },
    ],
  },
  { value: "package.json", label: "package.json" },
]

function Items({ items }: { items: Node[] }) {
  return items.map((item) => (
    <TreeItem key={item.value} value={item.value}>
      <TreeItemLabel
        className={`group/row flex h-7 cursor-default items-center gap-1.5 rounded-sm pr-2 pl-[calc((var(--tree-level)-1)*1rem+0.25rem)] text-sm outline-none hover:bg-muted data-[selected]:bg-muted data-[selected]:font-medium focus-visible:ring-2 focus-visible:ring-ring`}
      >
        {item.children ? (
          <>
            <TreeItemIndicator className="text-muted-foreground transition-transform duration-150 group-data-[expanded]/row:rotate-90 motion-reduce:transition-none">
              <Icon d={icons.chevronRight} className="size-3.5" />
            </TreeItemIndicator>
            <Icon d={icons.folder} className="size-3.5 text-muted-foreground" />
          </>
        ) : (
          <Icon d={icons.file} className="ml-5 size-3.5 text-muted-foreground" />
        )}
        <span className="truncate font-mono text-[13px]">{item.label}</span>
      </TreeItemLabel>
      {item.children && (
        <TreeGroup>
          <Items items={item.children} />
        </TreeGroup>
      )}
    </TreeItem>
  ))
}

const COMMANDS = [
  { group: "Project", items: [
    { value: "deploy", label: "Deploy to production" },
    { value: "preview", label: "Open preview" },
    { value: "logs", label: "View build logs" },
  ] },
  { group: "Settings", items: [
    { value: "region", label: "Change region" },
    { value: "domains", label: "Domains" },
    { value: "billing", label: "Billing" },
  ] },
]

function ListsPanel() {
  const [ran, setRan] = useState<string | null>(null)
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Specimen
        name="tree"
        title="Tree"
        keys={[
          { k: "↑↓", does: "move", match: ["ArrowUp", "ArrowDown"] },
          { k: "←→", does: "close, open", match: ["ArrowLeft", "ArrowRight"] },
          { k: "a–z", does: "jump", match: ["a-z"] },
          { k: "*", does: "open siblings", match: ["*"] },
        ]}
      >
        <Tree aria-label="Files" defaultExpanded={["app"]} defaultValue="app/page.tsx" className="rounded-md border border-border bg-background p-1">
          <Items items={FILES} />
        </Tree>
      </Specimen>

      <Specimen
        name="command"
        title="Command palette"
        keys={[
          { k: "type", does: "rank", match: ["a-z"] },
          { k: "↑↓", does: "move", match: ["ArrowUp", "ArrowDown"] },
          { k: "Enter", does: "run", match: ["Enter"] },
        ]}
      >
        <Command onAction={(value) => setRan(value)} className="overflow-hidden rounded-md border border-border bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Icon d={icons.search} className="text-muted-foreground" />
            <CommandInput aria-label="Search commands" placeholder="Type a command…" className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <CommandList className="max-h-48 overflow-y-auto p-1">
            <CommandEmpty className="px-2 py-3 text-center text-sm text-muted-foreground">No command matches.</CommandEmpty>
            {COMMANDS.map((g) => (
              <CommandGroup key={g.group}>
                <CommandGroupLabel className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{g.group}</CommandGroupLabel>
                {g.items.map((c) => (
                  <CommandItem key={c.value} value={c.value} className={`${ui.item} text-sm`}>
                    {c.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <p className="mt-2 text-xs text-muted-foreground">Last command run: {ran ?? "none"}</p>
      </Specimen>
    </div>
  )
}

export default ListsPanel
