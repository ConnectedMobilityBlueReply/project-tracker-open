"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CaretDown } from "@phosphor-icons/react"

import { tv, type VariantProps } from "@/lib/tv"
import { cn } from "@/lib/utils"
import { useControlSize, useDensity, type Density } from "@/lib/density"
import { createContext } from "@/lib/create-context"
import { Checkbox } from "@/components/ui/checkbox"
import { SwitchIndicator } from "@/components/ui/switch"
import { AnimatedNumber } from "@/components/ui/animated-number"

/**
 * MultiSelect: a select that picks *many* values and stays open while you toggle them.
 *
 * Radix Select is strictly single-value and closes on pick, so it can't host checkboxes,
 * switches, or interactive sections. MultiSelect is built on Radix Popover instead: the panel
 * is styled to match `SelectContent` (same surface, radius, shadow, enter/exit), but each row is
 * an `option` that toggles membership in one `string[]` rather than committing a single value.
 *
 * Rows come in two flavours that share that state: `MultiSelectItem` (a checkbox) and
 * `MultiSelectSwitchItem` (a switch, for a settings-panel feel). Both embed the *real* DS
 * `Checkbox`/`Switch` as decorative indicators (the row is the control), so they never drift from
 * the canonical components. Group rows with `MultiSelectGroup` + `MultiSelectLabel` and split
 * sections with `MultiSelectSeparator`.
 *
 * Named parts, not dot-notation (RSC-safe). Cross-part state flows through a typed Context.
 */

export const multiSelectVariants = tv({
  slots: {
    trigger: [
      // `group` lets the chevron read data-state=open off the trigger.
      // rounded-md matches Button + Input: form controls share one control radius.
      "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input",
      // Opaque background that matches whatever surface the trigger sits on, same `--surface`
      // logic as Input/Select, so the control blends in without ever looking "filled".
      // 16px on touch, in step with the text fields beside it (see Select).
      "bg-[var(--surface,var(--background))] px-3 text-sm pointer-coarse:text-base text-left text-foreground shadow-xs",
      // `scale` is named explicitly: in Tailwind v4 it's a standalone property, so a transition
      // that only listed border-color/box-shadow would leave the press below snapping, not easing.
      "transition-[border-color,box-shadow,scale] duration-fast ease-out",
      "hover:border-ring/50",
      // Focus + open read like an Input/Select: brand border + soft `brand-ring` halo, not a
      // hard 2px ring. Held open, the trigger keeps the halo so the link to the panel reads.
      "outline-none focus-visible:border-brand focus-visible:brand-ring",
      "data-[state=open]:border-brand data-[state=open]:brand-ring",
      "active:scale-[0.99]",
      "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    value: "line-clamp-1 flex-1 text-left tabular-nums",
    chevron: [
      "size-4 shrink-0 text-muted-foreground",
      "caret-turn-fast",
      "group-data-[state=open]:rotate-180",
    ],
    content: [
      "relative z-50 min-w-[var(--radix-popover-trigger-width)] overflow-hidden",
      // rounded-lg (16px): the shared menu-surface radius (Select, DropdownMenu, Popover), close
      // enough to the trigger's rounded-md (12px) that the open pair reads as one control.
      "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
      // Nested controls read this so they paint the panel surface, not a --background block.
      "[--surface:var(--popover)]",
      // Enter: fade + zoom + slide. Exit: fade + slide only, softer than the enter.
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=bottom]:slide-out-to-top-2 data-[side=top]:slide-out-to-bottom-2",
      "data-[state=open]:duration-fast data-[state=closed]:duration-[100ms] ease-out",
    ],
    // Cap height off the collision-aware available space so long sectioned lists scroll.
    // `scroll-fade` softens the top/bottom edges into the panel; `scroll-py-10` matches the fade
    // depth so a keyboard-focused row scrolls in clear of the fade, never half-dissolved under it.
    viewport:
      "max-h-[min(20rem,var(--radix-popover-content-available-height,20rem))] overflow-y-auto scroll-fade scroll-py-10",
    item: [
      // The whole row is the hit target; the embedded Checkbox/Switch is decorative.
      "relative flex w-full cursor-pointer select-none items-center gap-2 px-2",
      "text-sm font-medium text-left text-foreground outline-none",
      "transition-colors duration-fast ease-out",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:bg-accent focus-visible:text-accent-foreground",
      "aria-disabled:pointer-events-none aria-disabled:opacity-50",
      "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    itemLabel:
      "flex min-w-0 flex-1 items-center gap-2 truncate [&_svg]:text-muted-foreground",
    label: "px-2 font-medium text-muted-foreground",
    separator: "-mx-0.75 h-px bg-border",
  },
  variants: {
    // Trigger height comes from `size`, the one axis every control shares (sm 32 · md 36 · lg
    // 40px), matching Button + Input + Select. Density only picks the default size (see
    // MultiSelect root). The base trigger carries px-3 + text-sm; sm/lg override.
    size: {
      sm: { trigger: "h-8 px-2.5" },
      md: { trigger: "h-9" },
      lg: { trigger: "h-10 px-3.5 text-sm pointer-coarse:text-base" },
    },
    // The dropdown's own row spacing stays on `density` (content, not a control). The radius does
    // NOT move with density: viewport p-1 (4) under content rounded-lg (16) = rounded-md (12) rows
    // at both densities, matching Select + DropdownMenu. Soft rows, never pills.
    density: {
      comfortable: {
        item: "py-2 rounded-md",
        label: "py-1.5 text-xs",
        separator: "my-1.5",
      },
      compact: {
        item: "py-1.5 rounded-md",
        label: "py-1 text-xs",
        separator: "my-1",
      },
    },
  },
  defaultVariants: { size: "md", density: "comfortable" },
})

// Viewport padding is applied inline (position-conditional), matching Select: p-1 (4px) at both
// densities, so the concentric row radius and the 12px edge inset (p-1 4 + row px-2 8) stay put
// while density only tunes row height.
const viewportPadding: Record<Density, string> = {
  comfortable: "p-1",
  compact: "p-1",
}

type MultiSelectSlots = ReturnType<typeof multiSelectVariants>

const [MultiSelectProvider, useMultiSelectContext] = createContext<{
  value: string[]
  toggle: (value: string) => void
  density: Density
  slots: MultiSelectSlots
}>("MultiSelect")

export interface MultiSelectProps
  extends Omit<React.ComponentProps<typeof PopoverPrimitive.Root>, "children">,
    VariantProps<typeof multiSelectVariants> {
  /** Controlled selected values. */
  value?: string[]
  /** Uncontrolled initial selection. */
  defaultValue?: string[]
  /** Called with the next selection whenever a row is toggled. */
  onValueChange?: (value: string[]) => void
  children?: React.ReactNode
}

export function MultiSelect({
  value,
  defaultValue,
  onValueChange,
  size,
  density,
  children,
  ...props
}: MultiSelectProps) {
  const d = useDensity(density)
  // Trigger height comes from `size`; density only picks the DEFAULT size (compact → sm,
  // comfortable → md) so a bare MultiSelect keeps step with a same-defaulted Button/Select.
  const slots = multiSelectVariants({ size: useControlSize(size, density), density: d })

  // Controlled/uncontrolled value, hand-rolled to keep the lint-strict rules happy.
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = React.useState<string[]>(defaultValue ?? [])
  const selected = isControlled ? value : uncontrolled

  const toggle = React.useCallback(
    (v: string) => {
      const current = isControlled ? (value ?? []) : uncontrolled
      const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v]
      if (!isControlled) setUncontrolled(next)
      onValueChange?.(next)
    },
    [isControlled, value, uncontrolled, onValueChange],
  )

  return (
    <MultiSelectProvider value={selected} toggle={toggle} density={d} slots={slots}>
      <PopoverPrimitive.Root {...props}>{children}</PopoverPrimitive.Root>
    </MultiSelectProvider>
  )
}

export type MultiSelectTriggerProps = React.ComponentProps<typeof PopoverPrimitive.Trigger>

export function MultiSelectTrigger({ className, children, ...props }: MultiSelectTriggerProps) {
  const { slots } = useMultiSelectContext("MultiSelectTrigger")
  return (
    <PopoverPrimitive.Trigger
      data-slot="multi-select-trigger"
      className={slots.trigger({ className })}
      {...props}
    >
      {children}
      <CaretDown weight="bold" className={slots.chevron()} />
    </PopoverPrimitive.Trigger>
  )
}

export interface MultiSelectValueProps extends React.ComponentProps<"span"> {
  /** Shown when nothing is selected. */
  placeholder?: string
  /** Render the selected values yourself (e.g. chips with your own labels). Defaults to a rolling count. */
  renderValue?: (value: string[]) => React.ReactNode
}

export function MultiSelectValue({
  className,
  placeholder,
  renderValue,
  ...props
}: MultiSelectValueProps) {
  const { value, slots } = useMultiSelectContext("MultiSelectValue")
  const isEmpty = value.length === 0
  return (
    <span
      data-slot="multi-select-value"
      className={slots.value({ className: cn(isEmpty && "text-muted-foreground", className) })}
      {...props}
    >
      {isEmpty ? (
        placeholder
      ) : renderValue ? (
        renderValue(value)
      ) : (
        // Default read-out. The count rolls (old digit up + out, new up from below) via the
        // canonical AnimatedNumber, so "3 selected" → "4 selected" reads as a change, not a
        // hard swap. Holds still under reduced-motion.
        <>
          <AnimatedNumber value={value.length} /> selected
        </>
      )}
    </span>
  )
}

export type MultiSelectContentProps = React.ComponentProps<typeof PopoverPrimitive.Content>

export function MultiSelectContent({
  className,
  children,
  align = "start",
  sideOffset = 6,
  onKeyDown,
  ...props
}: MultiSelectContentProps) {
  const { density, slots } = useMultiSelectContext("MultiSelectContent")

  // Roving keyboard: Arrow/Home/End move focus between option rows (both checkbox and switch
  // rows carry `data-multi-select-item`). The handler lives on Content so it also fires while
  // focus is still on the freshly-opened panel: the first ArrowDown lands on the first row.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        '[data-multi-select-item]:not([aria-disabled="true"])',
      ),
    )
    if (items.length === 0) return
    e.preventDefault()
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (e.key === "Home") next = 0
    else if (e.key === "End") next = items.length - 1
    else if (e.key === "ArrowDown") next = index < items.length - 1 ? index + 1 : 0
    else next = index > 0 ? index - 1 : items.length - 1
    items[next]?.focus()
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="multi-select-content"
        role="listbox"
        aria-multiselectable
        align={align}
        sideOffset={sideOffset}
        onKeyDown={handleKeyDown}
        className={slots.content({ className })}
        {...props}
      >
        <div className={cn(viewportPadding[density], slots.viewport())}>{children}</div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

interface OptionRowProps extends Omit<React.ComponentProps<"div">, "onClick"> {
  value: string
  disabled?: boolean
}

/** Shared row behaviour for checkbox + switch items: toggles on click and on Enter/Space. */
function useOptionRow({ value, disabled }: { value: string; disabled?: boolean }) {
  const { value: selected, toggle, slots } = useMultiSelectContext("MultiSelectItem")
  const isSelected = selected.includes(value)

  function onClick() {
    if (!disabled) toggle(value)
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      toggle(value)
    }
  }
  return { isSelected, onClick, onKeyDown, slots }
}

export type MultiSelectItemProps = OptionRowProps

export function MultiSelectItem({
  className,
  children,
  value,
  disabled,
  ...props
}: MultiSelectItemProps) {
  const { isSelected, onClick, onKeyDown, slots } = useOptionRow({ value, disabled })
  return (
    <div
      data-slot="multi-select-item"
      data-multi-select-item=""
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : 0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={slots.item({ className })}
      {...props}
    >
      <span className={slots.itemLabel()}>{children}</span>
      {/* The real DS Checkbox, decorative: the row owns focus + toggling. Sits on the
          right so the label (icon + text) reads first, matching MultiSelectSwitchItem. */}
      <Checkbox
        checked={isSelected}
        size="md"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none ml-auto"
      />
    </div>
  )
}

export type MultiSelectSwitchItemProps = OptionRowProps

export function MultiSelectSwitchItem({
  className,
  children,
  value,
  disabled,
  ...props
}: MultiSelectSwitchItemProps) {
  const { isSelected, onClick, onKeyDown, slots } = useOptionRow({ value, disabled })
  return (
    <div
      data-slot="multi-select-switch-item"
      data-multi-select-item=""
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? undefined : 0}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={slots.item({ className })}
      {...props}
    >
      <span className={slots.itemLabel()}>{children}</span>
      {/* The switch's drawing, not a second control: the row owns focus and the toggle, and a
          real Switch nested in an option would be an interactive control inside another. */}
      <SwitchIndicator checked={isSelected} className="ml-auto" />
    </div>
  )
}

export function MultiSelectGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="multi-select-group" role="group" className={className} {...props} />
}

export function MultiSelectLabel({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useMultiSelectContext("MultiSelectLabel")
  return <div data-slot="multi-select-label" className={slots.label({ className })} {...props} />
}

export function MultiSelectSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useMultiSelectContext("MultiSelectSeparator")
  return (
    <div
      data-slot="multi-select-separator"
      role="separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}
