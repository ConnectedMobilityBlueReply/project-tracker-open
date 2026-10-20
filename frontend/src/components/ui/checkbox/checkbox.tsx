"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { tv, type VariantProps } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { hitCoarse } from "@/lib/hit-area"

/**
 * Checkbox: a Radix Checkbox styled with Koala tokens. Single-part, so one `tv` recipe with
 * `slots` (the box and its indicator icon scale together). Supports the tri-state
 * `"indeterminate"` value a "select all" needs, shown as a minus rather than a check.
 *
 * `"use client"` because Radix Checkbox is interactive (state + context). Pair it with a
 * `<label htmlFor>` for an accessible name and a larger hit target. See the docs.
 */
export const checkboxVariants = tv({
  slots: {
    root: [
      // The empty box fills with `--surface`, the DS contract for "what surface am I sitting on"
      // (the same one Input follows): inside a card, a Dialog or a Survey it blends with that
      // surface instead of painting the page `--background`, which sits a step darker in the dark
      // themes and would read as a hole. Identical in light, where `--card` equals `--background`.
      "peer inline-flex shrink-0 cursor-pointer items-center justify-center border border-input bg-[var(--surface,var(--background))] shadow-xs",
      // A 16-20px box is a fine target for a cursor, not a fingertip: on touch the hit area grows
      // to 44x44 (lib/hit-area.ts). On desktop pair it with a `<label htmlFor>`, as always.
      hitCoarse,
      // Specific transition (never `transition: all`, #14); tactile press scale (#12).
      "transition-colors duration-fast ease-out active:scale-[0.96]",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Checked and indeterminate both fill with the accent (brand); the indicator inherits the fg,
      // a black tick in every theme (as the Checklist's), which clears the 3:1 a graphic needs on
      // all nine accent presets, lime included.
      "data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-black",
      "data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand data-[state=indeterminate]:text-black",
      "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    indicator: "flex items-center justify-center text-current",
    icon: "",
  },
  variants: {
    // The corner radius scales with the box so both sizes read with the same roundness. `md`
    // (20px) uses the `rounded-sm` token; `sm` (16px) is 0.8× that, exactly its box ratio
    // (16/20), so it stays proportional instead of looking over-rounded at the smaller size.
    size: {
      sm: { root: "size-4 rounded-[calc(var(--radius-sm)*0.8)]", icon: "size-3" },
      md: { root: "size-5 rounded-sm", icon: "size-3.5" },
    },
  },
  defaultVariants: {
    size: "md",
  },
})

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

export function Checkbox({
  className,
  size,
  checked,
  id,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...props
}: CheckboxProps) {
  const { root, indicator, icon } = checkboxVariants({ size })
  // A single checkbox ("I agree to the terms") is one control, so it belongs in a Field and
  // picks up its id + aria + disabled here. A CLUSTER of checkboxes is a FieldGroup instead:
  // there the fieldset names and disables them, and this context is (correctly) null.
  const field = useFieldContext()
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      id={id ?? field?.id}
      disabled={disabled ?? field?.disabled}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-invalid={field?.hasError || undefined}
      className={root({ className })}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className={indicator()}>
        {/*
         * Inline stroked glyph (not Phosphor's filled Check) so the symbol can *draw* itself:
         * `pathLength={1}` normalizes the path to length 1, so the dash math is a clean 1→0
         * regardless of the geometry. The `animate-check-draw` keyframe sweeps the dash offset.
         */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={icon()}
          aria-hidden
        >
          <path
            d={checked === "indeterminate" ? "M5 12h14" : "M5 12.5l4.5 4.5L19 7.5"}
            pathLength={1}
            className="animate-check-draw [stroke-dasharray:1]"
          />
        </svg>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
