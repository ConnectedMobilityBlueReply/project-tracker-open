"use client"

import * as React from "react"

/**
 * Optional context published by `FieldGroup` (the `<fieldset>` that wraps several controls
 * answering ONE question) so a `Hint` nested in it adopts the group's id and error tone.
 * Same contract as `lib/field-context.tsx`: deliberately NOT built on `create-context`
 * (which throws when missing), so it returns `null` outside a group and every part stays
 * usable on its own.
 *
 * Deliberately carries no `id`. A group has no single control to point a label at: three
 * checkboxes sharing one id would collide. The accessible NAME comes from the `<legend>`,
 * which the HTML gives us for free, so the only thing worth sharing here is the hint wiring
 * and the error/disabled/required state.
 */
export interface FieldGroupContextValue {
  /** Stable id a `Hint` adopts so it matches what the fieldset's `aria-describedby` points at. */
  hintId: string
  /** The hint's id, or `undefined` when no hint is rendered. Spread as `aria-describedby`. */
  describedBy: string | undefined
  /** A `Hint` calls this on mount so the group only advertises a hint that's actually present. */
  registerHint: () => () => void
  hasError: boolean
  disabled: boolean
  required: boolean
}

const FieldGroupContext = React.createContext<FieldGroupContextValue | null>(null)
FieldGroupContext.displayName = "FieldGroupContext"

export const FieldGroupContextProvider = FieldGroupContext.Provider

/** Read the surrounding FieldGroup, if any. `null` when the part isn't inside one. */
export function useFieldGroupContext(): FieldGroupContextValue | null {
  return React.useContext(FieldGroupContext)
}
