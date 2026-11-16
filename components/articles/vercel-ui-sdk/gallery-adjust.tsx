"use client"

import {
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerInput,
  ColorPickerSlider,
  ColorPickerSliderThumb,
} from "@ui-sdk/react/color-picker"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputScrubArea,
} from "@ui-sdk/react/number-input"
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
  SliderValue,
} from "@ui-sdk/react/slider"

import { Icon, icons, Specimen, ui } from "./kit"

const thumb = `block size-4 rounded-full border-2 border-foreground bg-background shadow ${ui.focusRing} data-dragging:scale-110 transition-transform motion-reduce:transition-none`

function AdjustPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Specimen
        name="slider"
        title="Range slider"
        keys={[
          { k: "←→", does: "step", match: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] },
          { k: "PgUp PgDn", does: "big step", match: ["PageUp", "PageDown"] },
          { k: "Home End", does: "ends", match: ["Home", "End"] },
        ]}
      >
        <Field>
          <Slider
            defaultValue={[20, 60]}
            min={0}
            max={100}
            step={5}
            format={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
            className="grid gap-2"
          >
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel className={ui.label}>Monthly budget</FieldLabel>
              <SliderValue className="font-mono text-xs tabular-nums" />
            </div>
            <SliderControl className="flex h-6 items-center">
              <SliderTrack className="relative h-1.5 w-full rounded-full bg-muted">
                <SliderIndicator className="h-full rounded-full bg-foreground" />
                <SliderThumb index={0} aria-label="Minimum budget" className={`top-1/2 -translate-x-1/2 -translate-y-1/2 ${thumb}`} />
                <SliderThumb index={1} aria-label="Maximum budget" className={`top-1/2 -translate-x-1/2 -translate-y-1/2 ${thumb}`} />
              </SliderTrack>
            </SliderControl>
          </Slider>
        </Field>
      </Specimen>

      <Specimen
        name="number-input"
        title="Number input"
        keys={[
          { k: "↑↓", does: "step", match: ["ArrowUp", "ArrowDown"] },
          { k: "PgUp PgDn", does: "×10", match: ["PageUp", "PageDown"] },
          { k: "Home End", does: "min, max", match: ["Home", "End"] },
        ]}
      >
        <Field>
          <NumberInput defaultValue={3} min={1} max={20} className="grid gap-1.5">
            <NumberInputScrubArea pixelsPerStep={6} className="w-fit cursor-ew-resize">
              <FieldLabel className={`${ui.label} cursor-ew-resize`}>Instances (drag the label)</FieldLabel>
            </NumberInputScrubArea>
            <NumberInputGroup className="flex h-9 w-full items-stretch overflow-hidden rounded-md border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
              <NumberInputDecrement aria-label="Fewer instances" className="grid w-9 place-items-center border-r border-border text-muted-foreground hover:bg-muted data-[disabled]:opacity-40">
                <Icon d={icons.minus} />
              </NumberInputDecrement>
              <NumberInputControl className="min-w-0 flex-1 bg-transparent text-center font-mono text-sm tabular-nums outline-none" />
              <NumberInputIncrement aria-label="More instances" className="grid w-9 place-items-center border-l border-border text-muted-foreground hover:bg-muted data-[disabled]:opacity-40">
                <Icon d={icons.plus} />
              </NumberInputIncrement>
            </NumberInputGroup>
          </NumberInput>
        </Field>
      </Specimen>

      <Specimen
        className="sm:col-span-2"
        name="color-picker"
        title="Color picker"
        keys={[
          { k: "←→↑↓", does: "move in the area", match: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] },
          { k: "PgUp PgDn", does: "big step", match: ["PageUp", "PageDown"] },
          { k: "Tab", does: "area, hue, hex", match: ["Tab"] },
        ]}
      >
        <ColorPicker aria-label="Accent color" defaultValue="#d13fa4" className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <ColorPickerArea className="relative h-36 w-full touch-none rounded-md bg-(image:--color-area-background)">
            <ColorPickerAreaThumb
              className={`absolute size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-[0_0_0_1px_rgba(0,0,0,0.4)] left-[calc(var(--area-x)*100%)] bottom-[calc(var(--area-y)*100%)] ${ui.focusRing}`}
            />
          </ColorPickerArea>
          <div className="flex flex-col justify-between gap-3">
            <ColorPickerSlider channel="hue" className="relative h-3 w-full touch-none rounded-full bg-(image:--color-slider-background)">
              <ColorPickerSliderThumb
                className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-(--color-picker-color) shadow-[0_0_0_1px_rgba(0,0,0,0.4)] left-(--color-slider-thumb-position) ${ui.focusRing}`}
              />
            </ColorPickerSlider>
            <div className="flex items-center gap-2">
              <span className="size-9 shrink-0 rounded-md border border-border bg-(--color-picker-color)" aria-hidden="true" />
              <ColorPickerInput aria-label="Hex" className={`${ui.field} font-mono uppercase`} />
            </div>
          </div>
        </ColorPicker>
      </Specimen>
    </div>
  )
}

export default AdjustPanel
