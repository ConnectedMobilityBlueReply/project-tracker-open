"use client"

import * as React from "react"

import { tv } from "@/lib/tv"
import { useFieldContext } from "@/lib/field-context"
import { useFieldGroupContext } from "@/lib/field-group-context"

// === Variants =================================================================

// The single source of truth for form label + helper-text styling across the DS.
// Input, Field, and OTPInput all compose `Label`/`Hint` instead of carrying their own
// copies, so the look stays identical everywhere and only drifts on purpose.
const labelVariants = tv({
  slots: {
    // Canonical label: weight 400 on `muted-foreground`, a soft, quiet label that sits
    // below the control's own text in emphasis, and softens consistently across all four
    // themes (foreground/secondary-foreground stay full-strength in the dark themes).
    // Opacity transitions so toggling `disabled` dims smoothly instead of snapping.
    root: "flex items-center gap-1 text-sm font-normal text-muted-foreground select-none transition-opacity duration-fast ease-out",
    requiredMark: "text-destructive",
    // Helper text below the control. `text-pretty` keeps short messages off a lonely last line.
    // the color transition lets the error tone fade in (interruptible) rather than jump.
    hint: "text-xs text-pretty text-muted-foreground transition-colors duration-fast ease-out",
  },
  variants: {
    disabled: {
      true: { root: "opacity-50" },
    },
    hasError: {
      // The hint doubles as the error message: switch it to the destructive tone.
      true: { hint: "text-destructive" },
    },
  },
})

// === Label ====================================================================

export interface LabelProps extends React.ComponentPropsWithoutRef<"label"> {
  /** Appends a destructive asterisk (with an sr-only "(required)") after the label text. */
  required?: boolean
  /** Dims the label. Inferred from a surrounding `Field` when omitted. */
  disabled?: boolean
}

// Standalone primitive. On its own it's a plain styled `<label>` (pass `htmlFor` yourself).
// Inside a `Field` it auto-adopts the field's `id` (→ `htmlFor`), `required`, and `disabled`
// from context, so `<Field><Label>…` wires up with no manual ids. An explicit prop always wins.
function Label({
  className,
  children,
  required,
  disabled,
  htmlFor,
  id,
  ...props
}: LabelProps) {
  const field = useFieldContext()
  const resolvedRequired = required ?? field?.required ?? false
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  const { root, requiredMark } = labelVariants({ disabled: resolvedDisabled })
  // Same self-registration as Hint, so a non-labelable control only points its
  // `aria-labelledby` at a label that's really rendered. No-op outside a Field.
  React.useEffect(() => field?.registerLabel?.(), [field])

  return (
    <label
      data-slot="label"
      // `htmlFor` names a labelable control. Controls that aren't labelable (RadioGroup and
      // friends render a `div`) can't be reached that way, so the label also publishes its own
      // id for them to point at with `aria-labelledby`.
      id={id ?? field?.labelId}
      htmlFor={htmlFor ?? field?.id}
      className={root({ className })}
      {...props}
    >
      {children}
      {resolvedRequired ? (
        <>
          <span aria-hidden="true" className={requiredMark()}>
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </label>
  )
}

// === Hint =====================================================================

export interface HintProps extends React.ComponentPropsWithoutRef<"p"> {
  /** Switches the hint to the destructive tone. Inferred from a surrounding `Field` when omitted. */
  hasError?: boolean
}

// Helper / error text below the control. Inside a `Field` it adopts the field's hint `id`
// and registers itself on mount so the control only points its `aria-describedby` at a hint
// that actually exists; standalone, pass an `id` and wire it yourself.
function Hint({ className, hasError, id, ...props }: HintProps) {
  // A hint describes whatever wraps it: a single `Field`, or the `FieldGroup` fieldset when
  // several controls answer one question. Field wins when both are present (a Field nested in
  // a group owns its own hint). Both hooks run unconditionally, so the order stays stable.
  const field = useFieldContext()
  const group = useFieldGroupContext()
  const owner = field ?? group
  const resolvedError = hasError ?? owner?.hasError ?? false
  // Effect (not render) so SSR and the first client render agree (no hint → no attr),
  // matching how Field gates `aria-describedby`. No-op outside a Field or FieldGroup.
  React.useEffect(() => owner?.registerHint?.(), [owner])

  return (
    <p
      data-slot="hint"
      id={id ?? owner?.hintId}
      className={labelVariants({ hasError: resolvedError }).hint({ className })}
      {...props}
    />
  )
}

export { Label, Hint, labelVariants }
