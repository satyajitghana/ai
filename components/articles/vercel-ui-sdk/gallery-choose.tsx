"use client"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@ui-sdk/react/combobox"
import { Rating, RatingItem } from "@ui-sdk/react/rating"
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@ui-sdk/react/select"

import { Icon, icons, Specimen, ui } from "./kit"

const REGIONS = [
  { value: "us-east", label: "US East" },
  { value: "us-west", label: "US West" },
  { value: "europe", label: "Europe" },
  { value: "india", label: "India" },
  { value: "asia-pacific", label: "Asia Pacific" },
  { value: "south-america", label: "South America" },
]

const FRAMEWORKS = [
  { value: "next", label: "Next.js" },
  { value: "sveltekit", label: "SvelteKit" },
  { value: "nuxt", label: "Nuxt" },
  { value: "remix", label: "Remix" },
  { value: "astro", label: "Astro" },
  { value: "solid-start", label: "SolidStart" },
  { value: "vite", label: "Vite" },
]

function ChoosePanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Specimen
        name="select"
        title="Select"
        keys={[
          { k: "Enter", does: "open", match: ["Enter", " "] },
          { k: "↑↓", does: "move", match: ["ArrowUp", "ArrowDown"] },
          { k: "a–z", does: "jump", match: ["a-z"] },
          { k: "Esc", does: "close", match: ["Escape"] },
        ]}
      >
        <Select defaultValue="europe" items={REGIONS} presentation="auto">
          <div className="grid gap-1.5">
            <SelectLabel className={ui.label}>Region</SelectLabel>
            <SelectTrigger className={ui.trigger}>
              <SelectValue />
              <Icon d={icons.chevronDown} className="text-muted-foreground" />
            </SelectTrigger>
          </div>
          <SelectContent className={ui.popup}>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value} className={ui.item}>
                {r.label}
                <SelectItemIndicator>
                  <Icon d={icons.check} className="size-3.5" />
                </SelectItemIndicator>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Specimen>

      <Specimen
        name="combobox"
        title="Combobox"
        keys={[
          { k: "type", does: "filter", match: ["a-z"] },
          { k: "↑↓", does: "move", match: ["ArrowUp", "ArrowDown"] },
          { k: "Enter", does: "pick", match: ["Enter"] },
          { k: "Esc", does: "close", match: ["Escape"] },
        ]}
      >
        <Combobox defaultValue="next" items={FRAMEWORKS}>
          <div className="grid gap-1.5">
            <ComboboxLabel className={ui.label}>Framework</ComboboxLabel>
            <ComboboxInput placeholder="Search frameworks" className={ui.field} />
          </div>
          <ComboboxContent className={ui.popup}>
            <ComboboxEmpty className="px-2 py-1.5 text-muted-foreground">No framework matches.</ComboboxEmpty>
            <ComboboxList>
              {FRAMEWORKS.map((f) => (
                <ComboboxItem key={f.value} value={f.value} label={f.label} className={ui.item}>
                  {f.label}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </Specimen>

      <Specimen
        name="segmented-control"
        title="Segmented control"
        keys={[
          { k: "←→", does: "choose", match: ["ArrowLeft", "ArrowRight"] },
          { k: "Home End", does: "ends", match: ["Home", "End"] },
        ]}
      >
        <div className="grid gap-1.5">
          <span className={ui.label} id="uisdk-seg-label">
            Plan
          </span>
          <SegmentedControl
            aria-labelledby="uisdk-seg-label"
            defaultValue="pro"
            className="relative isolate grid grid-cols-3 rounded-md border border-border bg-muted p-0.5"
          >
            <SegmentedControlIndicator className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-[5px] bg-background shadow-sm transition-[left,width] duration-200 motion-reduce:transition-none" />
            {["Hobby", "Pro", "Team"].map((p) => (
              <SegmentedControlItem
                key={p}
                value={p.toLowerCase()}
                className={`h-8 rounded-[5px] px-2 text-sm text-muted-foreground data-[checked]:font-medium data-[checked]:text-foreground ${ui.focusRing}`}
              >
                {p}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </div>
      </Specimen>

      <Specimen
        name="rating"
        title="Rating"
        keys={[
          { k: "←→", does: "score", match: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] },
          { k: "Tab", does: "one stop", match: ["Tab"] },
        ]}
      >
        <div className="grid gap-1.5">
          <span className={ui.label}>How was this article?</span>
          <Rating aria-label="Article rating" defaultValue={4} className={`flex w-fit gap-1 rounded-md ${ui.focusRing}`}>
            <RatingItem className="relative size-7 text-muted-foreground/40 data-highlighted:scale-110 transition-transform motion-reduce:transition-none">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="absolute inset-0 size-7">
                <path d={icons.star} fill="currentColor" />
              </svg>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="absolute inset-0 size-7 text-amber-500 [clip-path:inset(0_calc((1-var(--rating-fill,0))*100%)_0_0)]"
              >
                <path d={icons.star} fill="currentColor" />
              </svg>
            </RatingItem>
          </Rating>
        </div>
      </Specimen>
    </div>
  )
}

export default ChoosePanel
