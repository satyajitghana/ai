"use client"

import { useEffect, useState } from "react"

import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog"
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuItemIndicator,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { Toast, ToastAction, ToastClose, ToastDescription, ToastRegion, ToastTitle, createToaster } from "@ui-sdk/react/toast"

import { cn } from "@/lib/utils"

import { Icon, icons, Specimen, ui } from "./kit"

function OverlaysPanel() {
  const [toaster] = useState(() => createToaster())
  const [deleted, setDeleted] = useState(0)
  const [pinned, setPinned] = useState(true)
  useEffect(() => () => toaster.dismiss(), [toaster])

  function act(what: string) {
    toaster(what, {
      description: "A toast from createToaster(). It pauses while hovered or focused.",
      action: { label: "Undo", onAction: () => toaster(`Undid: ${what.toLowerCase()}`) },
    })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Specimen
        name="menu"
        title="Menu"
        keys={[
          { k: "Enter", does: "open", match: ["Enter", " "] },
          { k: "↑↓", does: "move", match: ["ArrowUp", "ArrowDown"] },
          { k: "a–z", does: "jump", match: ["a-z"] },
          { k: "Esc", does: "close", match: ["Escape"] },
        ]}
      >
        <Menu presentation="auto" onAction={(value) => act(value === "duplicate" ? "Duplicated the project" : "Renamed the project")}>
          <MenuTrigger className={ui.button}>
            Project
            <Icon d={icons.chevronDown} className="text-muted-foreground" />
          </MenuTrigger>
          <MenuContent className={`${ui.popup} min-w-48`}>
            <MenuItem value="rename" className={ui.item}>
              Rename
            </MenuItem>
            <MenuItem value="duplicate" className={ui.item}>
              Duplicate
            </MenuItem>
            <MenuSeparator className="-mx-1 my-1 h-px bg-border" />
            <MenuCheckboxItem value="pin" checked={pinned} onCheckedChange={setPinned} className={ui.item}>
              Pin to sidebar
              <MenuItemIndicator>
                <Icon d={icons.check} className="size-3.5" />
              </MenuItemIndicator>
            </MenuCheckboxItem>
          </MenuContent>
        </Menu>
      </Specimen>

      <Specimen
        name="dialog"
        title="Dialog"
        keys={[
          { k: "Tab", does: "stays inside", match: ["Tab"] },
          { k: "Esc", does: "close", match: ["Escape"] },
        ]}
      >
        <Dialog>
          <DialogTrigger className={ui.button}>Delete project…</DialogTrigger>
          <DialogBackdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none" />
          <DialogContent className="fixed top-1/2 left-1/2 z-50 grid w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-xl outline-none transition-[opacity,scale] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none">
            <div className="grid gap-1.5 pr-6">
              <DialogTitle className="text-base font-semibold">Delete Apollo?</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Nothing is deleted here; this is a demo. Focus is trapped in this box until you close it, and goes back to the
                button after.
              </DialogDescription>
            </div>
            <div className="flex justify-end gap-2">
              <DialogClose className={ui.button}>Cancel</DialogClose>
              <DialogClose className={cn(ui.solid, "bg-destructive text-white")} onClick={() => setDeleted((n) => n + 1)}>
                Delete
              </DialogClose>
            </div>
            <DialogClose aria-label="Close" className={`absolute top-3 right-3 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted ${ui.focusRing}`}>
              <Icon d={icons.x} />
            </DialogClose>
          </DialogContent>
        </Dialog>
        <p className="mt-2 text-xs text-muted-foreground">Pretend deletes: {deleted}</p>
      </Specimen>

      <Specimen
        name="toast"
        title="Toast"
        keys={[
          { k: "F6", does: "reach toasts", match: ["F6"] },
          { k: "Esc", does: "dismiss", match: ["Escape"] },
        ]}
      >
        <button type="button" className={ui.button} onClick={() => act("Saved the settings")}>
          Save settings
        </button>
        <ToastRegion
          toaster={toaster}
          className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 outline-none"
        >
          {() => (
            <Toast className="relative grid gap-1 rounded-md border border-border bg-popover p-3 pr-9 text-sm text-popover-foreground shadow-lg transition-[opacity,translate] duration-200 data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none">
              <ToastTitle className="font-medium" />
              <ToastDescription className="text-xs text-muted-foreground" />
              <ToastAction className={`${ui.button} mt-1 h-7 w-fit px-2 text-xs`} />
              <ToastClose aria-label="Dismiss" className={`absolute top-2 right-2 grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted ${ui.focusRing}`}>
                <Icon d={icons.x} className="size-3.5" />
              </ToastClose>
            </Toast>
          )}
        </ToastRegion>
      </Specimen>
    </div>
  )
}

export default OverlaysPanel
