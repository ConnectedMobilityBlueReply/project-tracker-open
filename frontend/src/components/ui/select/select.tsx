"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { CaretDown, Check } from "@phosphor-icons/react"

import { tv, type VariantProps } from "@/lib/tv"
import { cn } from "@/lib/utils"
import { useDensity, useControlSize } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"
import { Tooltip, type TooltipProps } from "@/components/ui/tooltip"

export const selectVariants = tv({
  slots: {
    trigger: [
      // `group` lets the chevron read data-state=open off the trigger.
      // rounded-md matches Button + Input: form controls share one control radius.
      "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input",
      // Opaque background that matches whatever surface the trigger sits on: reads `--surface`
      // if a container set one (e.g. Dialog → popover), else falls back to the page background:
      // same logic as Input, so the control blends in without ever looking "filled".
      // The selected value reads at font-medium (500), matching the option rows; the
      // placeholder stays normal weight (see data-[placeholder] below) so "empty" reads lighter.
      // `pointer-coarse:text-base` keeps the trigger's value on the same 16px as the fields beside
      // it on touch (they go 16px there so iOS won't zoom into them).
      "bg-[var(--surface,var(--background))] px-3 text-sm pointer-coarse:text-base font-medium text-left text-foreground shadow-xs",
      // `scale` is named explicitly: in Tailwind v4 it's a standalone property, so a transition
      // that only listed border-color/box-shadow would leave the press below snapping, not easing.
      "transition-[border-color,box-shadow,scale] duration-fast ease-out",
      "hover:border-ring/50",
      // Focus + open read like an Input: a brand border plus the soft `brand-ring` halo (not a
      // hard 2px ring). `data-[state=open]` keeps the halo while the listbox owns focus.
      "outline-none focus-visible:border-brand focus-visible:brand-ring",
      "active:scale-[0.99]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Inside a Field with `hasError`, the trigger picks up aria-invalid and turns red.
      "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:destructive-ring aria-[invalid=true]:data-[state=open]:destructive-ring",
      "data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground",
      // The selected value mirrors the chosen item (leading icon + label). Lay it out as a
      // flex row so the icon stays aligned and correctly sized: a `line-clamp` here forces
      // `display: -webkit-box`, which distorts inline SVGs (e.g. a leading Sparkle rendered
      // doubled/oversized). `truncate` keeps long labels on one line; `min-w-0` lets them clip.
      "[&>span]:flex [&>span]:min-w-0 [&>span]:items-center [&>span]:gap-2 [&>span]:truncate",
      // Any icon in the trigger (mirrored value icon) gets a 1rem box and never shrinks; the
      // chevron keeps its own size (it already carries a `size-*`, so it's excluded).
      "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
      // The mirrored value's leading icon reads muted (gray icon, dark label), matching the
      // option rows. Scoped to the value span (`>span`), so the sibling chevron is untouched.
      "[&>span_svg]:text-muted-foreground",
      // A leading icon dropped straight into the trigger (SelectSearchTrigger allows one, since
      // its value is a plain span) reads muted too, like the row icons it stands in for.
      "[&>svg]:text-muted-foreground",
    ],
    chevron: [
      "size-4 shrink-0 text-muted-foreground",
      "caret-turn-fast",
      "group-data-[state=open]:rotate-180",
    ],
    content: [
      "relative z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden",
      // rounded-lg (16px) is the shared menu-surface radius (DropdownMenu, Popover): close enough
      // to the trigger's rounded-md (12px) that the open pair reads as one control, not two shapes.
      "rounded-lg border border-border bg-popover text-popover-foreground shadow-lg [--surface:var(--popover)]",
      // Enter: fade + zoom + slide. Exit: fade + slide only, softer than the enter.
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=bottom]:slide-out-to-top-2 data-[side=top]:slide-out-to-bottom-2",
      "data-[state=open]:duration-fast data-[state=closed]:duration-[100ms] ease-out",
    ],
    item: [
      // Check sits on the right (pr-7) so leading icons/flags align flush-left regardless of
      // selection: the left edge is a stable optical line.
      "relative flex w-full cursor-pointer select-none items-center gap-2 pl-2 pr-7",
      "text-sm font-medium outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      // SelectSearch's rows are roved by attribute, not by focus (focus stays in the search
      // field so typing never stops), so they light up on `data-active` instead of `:focus`.
      // Inert for a Radix SelectItem, which never carries the attribute.
      "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
      // Row layout for the option lives here, not on `itemText`: Radix renders SelectItemText as
      // the LAST child and drops its className, so we style that span from the parent. Making it a
      // nowrap flex row keeps a leading icon + label on one line even when the dropdown is sized
      // narrow (e.g. a chromeless trigger inside an InputGroup, whose width the content inherits via
      // `min-w-[--radix-select-trigger-width]`). So a bare `<SelectItem><Icon /> Label></SelectItem>`
      // lays out correctly with no wrapper; a consumer wrapper still works (it becomes the lone flex
      // child, so the `gap-2` here is a no-op and its own gap takes over).
      "[&>span:last-child]:flex [&>span:last-child]:min-w-0 [&>span:last-child]:items-center [&>span:last-child]:gap-2",
      // Leading icon reads muted (gray icon, dark label), scoped to the ItemText span (the LAST
      // child) so the brand check in the first/indicator span is never recolored.
      "[&>span:last-child_svg]:text-muted-foreground",
    ],
    // Radix's SelectItemText renders a bare <span> and does NOT forward this className (it's a
    // marker for the trigger value mirror + typeahead). Row layout is applied from the `item`
    // slot above (via `>span:last-child`), not here; kept only to document the intended shape.
    itemText: "flex min-w-0 items-center gap-2",
    // Brand-colored check: the selected option's mark reads as a positive, on-brand
    // confirmation (matching country-select / phone-input), not a muted glyph.
    itemIndicator: "absolute right-2 flex size-4 items-center justify-center text-brand",
    label: "px-2 font-medium text-muted-foreground",
    separator: "-mx-0.75 h-px bg-border",
    // The scroll arrows overlay the viewport's fade band instead of pushing the rows down, so the
    // list never jumps when one appears. Radix scrolls while the pointer rests on them.
    scrollButton: "absolute inset-x-0 z-10 flex h-7 cursor-pointer items-center justify-center text-muted-foreground",

    // ── SelectSearch (the searchable sibling, select-search.tsx) ──────────────────
    // Its value is a plain span (no Radix mirror), so it has to claim the row itself: `flex-1`
    // keeps the chevron pinned right and a leading icon pinned left, whatever sits between.
    searchValue: "flex min-w-0 flex-1 items-center gap-2 truncate text-left",
    // The panel's own search row. Inset by the same p-1 as the list below it, so the field's box
    // lines up with the row fills (content rounded-lg 16 → p-1 4 → rounded-md 12: the ladder).
    search: "shrink-0 p-1",
    // The scrolling option list, capped off the collision-aware space like SelectContent's
    // viewport, with the same fade + scroll-padding pair (a focused row never sits half-dissolved).
    list: [
      "group/select-search-list p-1",
      "max-h-[min(18rem,var(--radix-popover-content-available-height,18rem))]",
      "overflow-y-auto overscroll-contain scroll-fade scroll-py-10",
    ],
    // Shown only while the list holds no row: same `:has` collapse the Command palette uses.
    empty: "px-3 py-6 text-center text-sm text-muted-foreground group-has-[[data-slot=select-search-item]]/select-search-list:hidden",
  },
  variants: {
    // Trigger height comes from `size`, the one axis every control shares: sm 32 · md 36 · lg
    // 40px, matching Button + Input. Density no longer sets the trigger height; it only picks the
    // default size (see SelectTrigger). The base trigger carries px-3 + text-sm; sm/lg override.
    size: {
      sm: { trigger: "h-8 px-2.5" },
      md: { trigger: "h-9" },
      lg: { trigger: "h-10 px-3.5 text-sm pointer-coarse:text-base" },
    },
    // What the trigger does while its panel is open, which depends on where the panel went.
    // A panel hanging off the trigger (every Select, and SelectSearch's default) keeps the brand
    // halo on it, so the pair reads as one control. SelectSearch's `inline` panel is its own block
    // in the flow and its search field takes the focus (and the halo), so a second halo on the
    // trigger would only stack two ringed controls: the trigger stays quiet and keeps its own
    // focus ring. A variant, not a className override: both states write `box-shadow`, so they
    // must never be handed to tailwind-merge together.
    panel: {
      floating: { trigger: "data-[state=open]:border-brand data-[state=open]:brand-ring" },
      inline: {},
    },
    // The dropdown's own row spacing stays on `density` (it's content, not a control), so a
    // compact app tightens the menu rows independently of the trigger size. The radius does NOT
    // move with density: viewport p-1 (4) under content rounded-lg (16) = rounded-md (12) rows at
    // both densities, the same concentric pair DropdownMenu uses. Soft rows, never pills.
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
  defaultVariants: { size: "md", density: "comfortable", panel: "floating" },
})

// Viewport padding is not in the recipe because it's applied inline (position-conditional).
// p-1 (4px) at both densities: it sets the concentric row radius and the 12px edge inset
// (p-1 4 + row pl-2 8), which must stay put while density only tunes row height.
const viewportPadding: Record<"comfortable" | "compact", string> = {
  comfortable: "p-1",
  compact: "p-1",
}

// Radix's hidden form <select> reports '' when `value` matches no item; a real pick can't be ''
// (SelectItem forbids value=""), so swallowing it stops off-catalog values from being wiped.
export function Select({ onValueChange, ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return (
    <SelectPrimitive.Root
      {...props}
      onValueChange={onValueChange && (value => { if (value !== '') onValueChange(value) })}
    />
  )
}
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export interface SelectTriggerProps
  extends React.ComponentProps<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof selectVariants> {}

export function SelectTrigger({
  className,
  children,
  size,
  density,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SelectTriggerProps) {
  // Trigger height comes from `size`; density only picks the DEFAULT size (compact → sm,
  // comfortable → md) so a bare Select keeps step with a same-defaulted Button/Input.
  const slots = selectVariants({ size: useControlSize(size, density) })
  // Surrounding Field (if any) supplies the id + aria wiring; explicit props still win.
  const field = useFieldContext()
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      id={id ?? field?.id}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-invalid={field?.hasError || undefined}
      className={slots.trigger({ className })}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <CaretDown weight="bold" className={slots.chevron()} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export interface SelectContentProps
  extends React.ComponentProps<typeof SelectPrimitive.Content>,
    VariantProps<typeof selectVariants> {}

export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  density,
  ...props
}: SelectContentProps) {
  const d = useDensity(density)
  const slots = selectVariants({ density: d })
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={slots.content({
          // A popper list is capped at 20rem or the room left on screen, whichever is smaller, so a
          // long list scrolls inside the panel instead of running off a phone's viewport. (Radix
          // lays the content out as a flex column with a flex-1 viewport, so the cap is all it takes.)
          className: cn(
            position === "popper" && "max-h-[min(20rem,var(--radix-select-content-available-height,20rem))]",
            className,
          ),
        })}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className={slots.scrollButton({ className: "top-0" })}>
          <CaretDown weight="bold" className="size-4 rotate-180" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport
          className={cn(
            // Soften the scroll edges into the popover (the only scroll cue, since the viewport's
            // scrollbar is hidden). `scroll-py-10` matches the fade depth so a keyboard-focused
            // item scrolls in clear of the fade, never half-dissolved. The native overflow scroll
            // (Radix sets `overflow:hidden auto`) is what the `scroll()` timeline tracks.
            "scroll-fade scroll-py-10",
            viewportPadding[d],
            position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className={slots.scrollButton({ className: "bottom-0" })}>
          <CaretDown weight="bold" className="size-4" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export interface SelectItemProps
  extends React.ComponentProps<typeof SelectPrimitive.Item>,
    VariantProps<typeof selectVariants> {
  /**
   * Optional hint shown on hover/keyboard-focus of the row. Use it for terse options whose
   * meaning isn't obvious from the label alone. "High" / "Medium" tells you nothing about the
   * trade-off, so a hint like "Optimizes for latency" earns its place. Supply any node (plain
   * text, or text plus a small leading glyph). When set, the row renders inside a {@link Tooltip}.
   */
  tooltip?: React.ReactNode
  /** Side the hint grows toward. Defaults to `"right"`, the open side of a left-aligned row. */
  tooltipPlacement?: TooltipProps["placement"]
}

export function SelectItem({
  className,
  children,
  density,
  tooltip,
  tooltipPlacement = "right",
  ...props
}: SelectItemProps) {
  const slots = selectVariants({ density: useDensity(density) })
  const item = (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={slots.item({ className })}
      {...props}
    >
      <span className={slots.itemIndicator()}>
        <SelectPrimitive.ItemIndicator>
          <Check weight="bold" className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText className={slots.itemText()}>
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )

  if (!tooltip) return item

  // `mouseenter focus` (Tooltip's default) means arrowing through the list also surfaces the
  // hint, not just hovering, so the keyboard path stays informative. The tooltip portals to the
  // body, so it floats above the content's `overflow-hidden` without being clipped.
  return (
    <Tooltip content={tooltip} placement={tooltipPlacement} offset={[0, 8]}>
      {item}
    </Tooltip>
  )
}

export function SelectLabel({
  className,
  density,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label> & VariantProps<typeof selectVariants>) {
  const slots = selectVariants({ density: useDensity(density) })
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={slots.label({ className })}
      {...props}
    />
  )
}

export function SelectSeparator({
  className,
  density,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator> & VariantProps<typeof selectVariants>) {
  const slots = selectVariants({ density: useDensity(density) })
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}
