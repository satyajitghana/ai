"use client"

import {
  CalendarDay,
  CalendarGrid,
  CalendarHeading,
  CalendarNext,
  CalendarPrevious,
  CalendarWeekday,
  CalendarWeekdays,
  CalendarWeeks,
  DatePicker,
  DatePickerContent,
  DatePickerInput,
  DatePickerTrigger,
} from "@ui-sdk/react/date-picker"
import { Field, FieldLabel } from "@ui-sdk/react/field"
import { OTPInput, OTPInputGroup, OTPInputSeparator, OTPInputSlot } from "@ui-sdk/react/otp-input"

import { Icon, icons, Specimen, ui } from "./kit"

const slot =
  "relative grid size-10 place-items-center border-y border-r border-border bg-background font-mono text-base first:rounded-l-md first:border-l last:rounded-r-md data-[active]:z-10 data-[active]:ring-2 data-[active]:ring-ring"

function DatesPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Specimen
        name="date-picker"
        title="Date picker"
        keys={[
          { k: "type", does: "a date", match: ["a-z"] },
          { k: "←→↑↓", does: "day, week", match: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] },
          { k: "PgUp PgDn", does: "month", match: ["PageUp", "PageDown"] },
          { k: "Enter", does: "pick", match: ["Enter"] },
        ]}
      >
        <DatePicker defaultValue="2026-11-20" locale="en-GB" className="grid gap-1.5">
          <span className={ui.label}>Launch date</span>
          <div className="flex gap-2">
            <DatePickerInput aria-label="Launch date" className={`${ui.field} font-mono`} />
            <DatePickerTrigger aria-label="Open calendar" className={`${ui.button} w-9 shrink-0 px-0`}>
              <Icon d={icons.calendar} />
            </DatePickerTrigger>
          </div>
          <DatePickerContent className={`${ui.popup} w-[17rem] min-w-0 max-h-none p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <CalendarPrevious aria-label="Previous month" className={`${ui.button} size-8 px-0`}>
                <Icon d={icons.chevronLeft} />
              </CalendarPrevious>
              <CalendarHeading className="text-sm font-medium" />
              <CalendarNext aria-label="Next month" className={`${ui.button} size-8 px-0`}>
                <Icon d={icons.chevronRight} />
              </CalendarNext>
            </div>
            <CalendarGrid className="w-full border-collapse">
              <CalendarWeekdays>
                {(index) => <CalendarWeekday index={index} className="pb-1 text-[11px] font-normal text-muted-foreground" />}
              </CalendarWeekdays>
              <CalendarWeeks>
                {(cell) => (
                  <CalendarDay
                    value={cell.date}
                    className={`h-8 w-9 cursor-default rounded-md text-center align-middle text-sm hover:bg-muted data-outside:text-muted-foreground/50 data-today:font-semibold data-today:underline data-[selected]:bg-foreground data-[selected]:text-background data-[disabled]:opacity-30 ${ui.focusRing}`}
                  />
                )}
              </CalendarWeeks>
            </CalendarGrid>
          </DatePickerContent>
        </DatePicker>
      </Specimen>

      <Specimen
        name="otp-input"
        title="One-time code"
        keys={[
          { k: "0–9", does: "fill", match: ["a-z"] },
          { k: "⌫", does: "back", match: ["Backspace"] },
          { k: "←→", does: "move", match: ["ArrowLeft", "ArrowRight"] },
          { k: "paste", does: "all six", match: ["v"] },
        ]}
      >
        <Field className="grid gap-1.5">
          <FieldLabel className={ui.label}>Verification code (try typing)</FieldLabel>
          <OTPInput maxLength={6} pattern="digits" className="flex items-center gap-2">
            <OTPInputGroup className="flex">
              {[0, 1, 2].map((i) => (
                <OTPInputSlot key={i} index={i} className={slot} />
              ))}
            </OTPInputGroup>
            <OTPInputSeparator className="text-muted-foreground">
              <Icon d={icons.minus} className="size-3" />
            </OTPInputSeparator>
            <OTPInputGroup className="flex">
              {[3, 4, 5].map((i) => (
                <OTPInputSlot key={i} index={i} className={slot} />
              ))}
            </OTPInputGroup>
          </OTPInput>
        </Field>
        <p className="mt-2 text-xs text-muted-foreground">
          The readout below prints this field as <code className="font-mono">[redacted]</code>: observe() and the agent
          bridge never pass a one-time code on.
        </p>
      </Specimen>
    </div>
  )
}

export default DatesPanel
