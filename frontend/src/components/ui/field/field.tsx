"use client"

import * as React from "react"

import { tv } from "@/lib/tv"
import { FieldContextProvider } from "@/lib/field-context"
import { FieldGroupContextProvider, useFieldGroupContext } from "@/lib/field-group-context"
import { labelVariants } from "@/components/ui/label"

// ─── Variants ─────────────────────────────────────────────────────────────────

// Field is now a pure wiring + layout layer: it generates the ids/aria the control, label,
// and hint share, and stacks them. The label/hint *styling* lives in `Label`/`Hint`, which
// Field re-exports below, so a field reads identically whether you compose it with the
// shared primitives or the input-local parts.
const fieldVariants = tv({
  base: "flex w-full flex-col gap-1.5",
})

// ─── Field ────────────────────────────────────────────────────────────────────

export interface FieldProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Drives the destructive tone and `aria-invalid` on the control and hint. */
  hasError?: boolean
  /** Dims the label and disables the control. */
  disabled?: boolean
  /** Appends a destructive asterisk to the label. */
  required?: boolean
}

function Field({
  hasError = false,
  disabled = false,
  required = false,
  className,
  children,
  ...props
}: FieldProps) {
  // Stable ids so the label's `htmlFor`, the control's `id`, and the hint's
  // `aria-describedby` all line up without the consumer touching them.
  const id = React.useId()
  const labelId = React.useId()
  const hintId = React.useId()

  // Only advertise `aria-describedby` / `aria-labelledby` when a Hint or Label is actually
  // present, so a control never points at a missing node. A child's `type` can't be inspected
  // reliably across the Server→Client boundary, so each part registers itself on mount
  // instead. SSR and the first client render agree (nothing there → no attr), avoiding a
  // hydration mismatch.
  const [hasHint, setHasHint] = React.useState(false)
  const registerHint = React.useCallback(() => {
    setHasHint(true)
    return () => setHasHint(false)
  }, [])
  const describedBy = hasHint ? hintId : undefined

  const [hasLabel, setHasLabel] = React.useState(false)
  const registerLabel = React.useCallback(() => {
    setHasLabel(true)
    return () => setHasLabel(false)
  }, [])
  const labelledBy = hasLabel ? labelId : undefined

  const context = React.useMemo(
    () => ({
      id,
      labelId,
      labelledBy,
      registerLabel,
      hintId,
      describedBy,
      registerHint,
      hasError,
      disabled,
      required,
    }),
    [
      id,
      labelId,
      labelledBy,
      registerLabel,
      hintId,
      describedBy,
      registerHint,
      hasError,
      disabled,
      required,
    ],
  )

  return (
    <FieldContextProvider value={context}>
      <div
        data-slot="field"
        data-error={hasError || undefined}
        data-disabled={disabled || undefined}
        className={fieldVariants({ className })}
        {...props}
      >
        {children}
      </div>
    </FieldContextProvider>
  )
}

// ─── FieldGroup ───────────────────────────────────────────────────────────────

// Several controls answering ONE question (a RadioGroup, a cluster of checkboxes) are a
// group, not a field: there's no single control for a label to point at. So this is a real
// `<fieldset>` with a real `<legend>`, which is the one construct that names a set of
// controls with no ARIA at all, and whose `disabled` attribute natively disables everything
// nested inside it. Use `Field` for one control, `FieldGroup` for several.
const fieldGroupVariants = tv({
  slots: {
    root: [
      // `min-w-0`: the UA sets `min-inline-size: min-content` on fieldset (Preflight doesn't
      // reset it), which makes it refuse to shrink inside a grid/flex parent and overflow.
      //
      // Block flow + `space-y`, NOT the `flex flex-col gap` that Field uses. Browsers pull the
      // "rendered legend" out of the fieldset's principal box, so it is not a flex item and flex
      // `gap` would never apply below it. `space-y` is a sibling selector on the DOM, so it lands
      // the same 6px under the legend either way, with nothing to special-case.
      "w-full min-w-0 space-y-1.5",
      // `<fieldset disabled>` disables the controls for free but doesn't dim the text around
      // them; Label already transitions its opacity, so this fades with the rest.
      "[&:disabled_[data-slot=label]]:opacity-50",
    ],
    legend: "",
  },
})

export interface FieldGroupProps extends React.ComponentPropsWithoutRef<"fieldset"> {
  /** Drives the destructive tone on the group's hint and `aria-invalid` on the fieldset. */
  hasError?: boolean
  /** Natively disables every control inside, and dims the labels. */
  disabled?: boolean
  /** Appends a destructive asterisk to the legend. */
  required?: boolean
}

function FieldGroup({
  hasError = false,
  disabled = false,
  required = false,
  className,
  children,
  ...props
}: FieldGroupProps) {
  const hintId = React.useId()

  // Same self-registration as Field, for the same reason: never point `aria-describedby` at
  // a hint that isn't rendered, and keep SSR and the first client render in agreement.
  const [hasHint, setHasHint] = React.useState(false)
  const registerHint = React.useCallback(() => {
    setHasHint(true)
    return () => setHasHint(false)
  }, [])
  const describedBy = hasHint ? hintId : undefined

  const context = React.useMemo(
    () => ({ hintId, describedBy, registerHint, hasError, disabled, required }),
    [hintId, describedBy, registerHint, hasError, disabled, required],
  )

  return (
    <FieldGroupContextProvider value={context}>
      <fieldset
        data-slot="field-group"
        data-error={hasError || undefined}
        disabled={disabled || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={fieldGroupVariants().root({ className })}
        {...props}
      >
        {children}
      </fieldset>
    </FieldGroupContextProvider>
  )
}

// ─── FieldGroupLabel ──────────────────────────────────────────────────────────

export interface FieldGroupLabelProps extends React.ComponentPropsWithoutRef<"legend"> {
  /** Appends a destructive asterisk. Inferred from the surrounding `FieldGroup` when omitted. */
  required?: boolean
}

// The group's accessible name. A `<legend>` can't be a `<label>`, so this can't just be the
// shared `Label` component, but it reads from the same `labelVariants` recipe rather than
// carrying its own copy: a legend and a label are the same type in the DS.
function FieldGroupLabel({ className, children, required, ...props }: FieldGroupLabelProps) {
  const group = useFieldGroupContext()
  const resolvedRequired = required ?? group?.required ?? false
  const { root, requiredMark } = labelVariants({ disabled: group?.disabled ?? false })

  return (
    <legend data-slot="field-group-label" className={root({ className })} {...props}>
      {children}
      {resolvedRequired ? (
        <>
          <span aria-hidden="true" className={requiredMark()}>
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
    </legend>
  )
}

// ─── FieldRow ─────────────────────────────────────────────────────────────────

// Lays sibling fields side by side on a single row, stacking on narrow viewports. Pure
// layout, no context, so it composes with anything (two Fields, a Field + a button…).
export interface FieldRowProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Columns from the `sm` breakpoint up. Below it the row always stacks. */
  columns?: 2 | 3
}

function FieldRow({ className, columns, ...props }: FieldRowProps) {
  return (
    <div
      data-slot="field-row"
      className={fieldRowVariants({ columns, className })}
      {...props}
    />
  )
}

const fieldRowVariants = tv({
  base: "grid grid-cols-1 gap-x-4 gap-y-5",
  variants: {
    columns: {
      2: "sm:grid-cols-2",
      3: "sm:grid-cols-3",
    },
  },
  defaultVariants: {
    columns: 2,
  },
})

export { Field, FieldGroup, FieldGroupLabel, FieldRow, fieldVariants, fieldGroupVariants }

// FieldLabel / FieldHint are the shared Label / Hint primitives. They read the Field context
// above for their id/aria wiring and error/disabled state, so `<Field><FieldLabel>…` works
// unchanged. Re-exported (not re-implemented) so there's exactly one label recipe in the DS.
// `FieldHint` doubles as the group's hint: it falls back to the FieldGroup context.
export {
  Label as FieldLabel,
  Hint as FieldHint,
  type LabelProps as FieldLabelProps,
  type HintProps as FieldHintProps,
} from "@/components/ui/label"
