"use client"

import * as React from "react"

/**
 * Optional context published by `Field` so any control nested inside it can pick up the
 * generated `id`, the hint's `aria-describedby`, and the field's error/disabled state,
 * without the consumer wiring those by hand. Deliberately NOT built on `createContext`
 * (which throws when missing): this returns `null` outside a Field, so every control stays
 * fully usable on its own. A control reads it and treats the values as defaults its own
 * props can still override.
 */
export interface FieldContextValue {
  /** Generated id wired to the control and to the label's `htmlFor`. */
  id: string
  /** Stable id a `Label` adopts, so a control can point back at it. */
  labelId: string
  /**
   * The label's id, or `undefined` when no label is rendered. Spread as `aria-labelledby` by
   * controls that are NOT labelable: `htmlFor` only names an input, select, textarea or
   * button, so anything rendering a plain `div` (RadioGroup, Slider, ToggleGroup) has to be
   * named the other way round.
   */
  labelledBy: string | undefined
  /** A `Label` calls this on mount, so a dangling `aria-labelledby` is never emitted. */
  registerLabel: () => () => void
  /** The hint's id, or `undefined` when no hint is rendered. Spread as `aria-describedby`. */
  describedBy: string | undefined
  /** Stable id a `Hint` adopts so it matches what the control's `aria-describedby` points at. */
  hintId: string
  /** A `Hint` calls this on mount so the control only advertises a hint that's actually present. */
  registerHint: () => () => void
  hasError: boolean
  disabled: boolean
  required: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)
FieldContext.displayName = "FieldContext"

export const FieldContextProvider = FieldContext.Provider

/** Read the surrounding Field, if any. `null` when the control isn't inside a Field. */
export function useFieldContext(): FieldContextValue | null {
  return React.useContext(FieldContext)
}
