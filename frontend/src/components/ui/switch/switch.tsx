"use client"

import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { tv } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { hitX } from "@/lib/hit-area"

/**
 * Switch: a Radix Switch styled with Koala tokens. Conceptually single-part, so one `tv`
 * recipe with `slots` (the track and its thumb scale together). Use it for an instant,
 * self-applying boolean (notifications on/off); reach for a Checkbox when the choice is
 * submitted with a form.
 *
 * `"use client"` because Radix Switch is interactive (state + context). It renders only the
 * control. Pair it with a `<label htmlFor>` for an accessible name and a larger hit target.
 */
// polish: the 20px-tall track sits under the 40px hit target on the short axis, so `hitX`
// (lib/hit-area.ts) extends the click area vertically without changing the visual, and grows it
// to 44x44 on touch.

export const switchVariants = tv({
  slots: {
    root: [
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5",
      // Single size: a 20×36 track. The thumb's checked travel = 36 − 16 − 2×2 = 16px.
      "h-5 w-9",
      hitX,
      // Specific transition (never `transition: all`, #14); tactile press scale (#12).
      "transition-colors duration-fast ease-out active:scale-[0.96]",
      // Focus ring is always the accent (brand): one universal focus indicator across the
      // library, matching the on-track fill here.
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Off track is the form-control fill; on fills with the accent (brand), the primary-action color.
      "bg-input data-[state=checked]:bg-brand",
      "disabled:cursor-not-allowed disabled:opacity-50",
    ],
    // The thumb is a fixed surface-colored disc that slides; the shadow lifts it off both
    // track states in every theme. Checked, it slides 16px to land flush at the far edge.
    thumb: [
      "pointer-events-none block size-4 rounded-full bg-background shadow-sm",
      // Only the slide transitions: the position is the one property that animates (#14).
      "transition-transform duration-fast ease-out",
      "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4",
    ],
  },
})

export interface SwitchProps extends React.ComponentProps<typeof SwitchPrimitive.Root> {
  /** Disable the tactile scale-on-press, e.g. where motion would distract. */
  static?: boolean
}

export function Switch({
  className,
  static: isStatic = false,
  id,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SwitchProps) {
  const { root, thumb } = switchVariants()
  // Radix renders a `<button>`, which IS labelable, so a surrounding Field can name it with
  // plain `htmlFor` → `id`. Explicit props still win.
  const field = useFieldContext()
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      id={id ?? field?.id}
      disabled={disabled ?? field?.disabled}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      // `static` neutralizes the press scale; twMerge keeps it (and `className`) last.
      className={root({ className: cn(isStatic && "active:scale-100", className) })}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={thumb()} />
    </SwitchPrimitive.Root>
  )
}

export interface SwitchIndicatorProps extends React.ComponentProps<"span"> {
  checked: boolean
}

/**
 * SwitchIndicator: the switch's drawing without the control, for a row that owns the toggle itself
 * (a menu checkbox item, a MultiSelect option). A real Switch there is a button nested inside an
 * interactive row, which assistive tech has no way to express (axe `nested-interactive`), even at
 * `tabIndex={-1}`. This is a decorative span painted by the same recipe, so the two never drift.
 */
export function SwitchIndicator({ checked, className, ...props }: SwitchIndicatorProps) {
  const { root, thumb } = switchVariants()
  const state = checked ? "checked" : "unchecked"
  return (
    <span
      aria-hidden
      data-slot="switch-indicator"
      data-state={state}
      // Inert: the row takes the pointer, and the press belongs to the row too.
      className={root({ className: cn("pointer-events-none active:scale-100", className) })}
      {...props}
    >
      <span data-state={state} className={thumb()} />
    </span>
  )
}
