"use client"

import * as React from "react"
import { CaretUp, CaretDown, Minus, Plus } from "@phosphor-icons/react"

import { tv } from "@/lib/tv"
import { useControlSize } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"
import {
  InputRoot,
  InputField,
  type InputFieldProps,
  type InputRootProps,
} from "./input"

// ─── Variants ─────────────────────────────────────────────────────────────────

// The stepper rail is NumberInput's own concern, so it gets its own recipe (one per
// component). It mirrors InputSuffixButton's per-size widths and negative margins so the
// controls sit flush against the right border: the root's overflow-hidden clips them at
// the rounded corner.
const numberStepperVariants = tv({
  slots: {
    rail: "flex shrink-0 self-stretch border-input",
    button: [
      "flex flex-1 items-center justify-center",
      "text-muted-foreground hover:text-foreground hover:bg-accent",
      "transition-[color,background-color,scale] duration-fast ease-out",
      "disabled:pointer-events-none disabled:opacity-40",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    ],
  },
  variants: {
    size: {
      sm: { rail: "w-6", button: "[&_svg:not([class*='size-'])]:size-3" },
      md: { rail: "w-7", button: "[&_svg:not([class*='size-'])]:size-3.5" },
      lg: { rail: "w-8", button: "[&_svg:not([class*='size-'])]:size-4" },
    },
    // Which border of the root the rail hugs. The negative margin (size-dependent, set in
    // compoundVariants) cancels the root's matching padding so the rail clips at the corner.
    edge: {
      right: { rail: "border-l" },
      left: { rail: "border-r" },
    },
    // Stacked carets share a horizontal divider and stack vertically; inline ± buttons fill
    // their rail.
    layout: {
      stacked: { rail: "flex-col" },
      inline: {},
    },
    static: { true: { button: "active:scale-100" }, false: { button: "active:scale-[0.96]" } },
  },
  compoundVariants: [
    { size: "sm", edge: "right", class: { rail: "-mr-2.5" } },
    { size: "sm", edge: "left", class: { rail: "-ml-2.5" } },
    { size: "md", edge: "right", class: { rail: "-mr-3" } },
    { size: "md", edge: "left", class: { rail: "-ml-3" } },
    { size: "lg", edge: "right", class: { rail: "-mr-3.5" } },
    { size: "lg", edge: "left", class: { rail: "-ml-3.5" } },
  ],
  defaultVariants: { size: "md", edge: "right", layout: "stacked", static: false },
})

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Decimal places implied by `step` (e.g. 0.25 → 2) so arithmetic stays free of float drift. */
function decimalsOf(step: number): number {
  const s = String(step)
  const dot = s.indexOf(".")
  return dot === -1 ? 0 : s.length - dot - 1
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  if (min != null && value < min) return min
  if (max != null && value > max) return max
  return value
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

export interface NumberInputProps
  extends Omit<InputFieldProps, "value" | "defaultValue" | "onChange" | "type"> {
  /** Controlled value. Pass `null`/`undefined` for an empty field. */
  value?: number | null
  /** Initial value when uncontrolled. */
  defaultValue?: number | null
  /** Fires on every committed change with the parsed number, or `null` when cleared. */
  onValueChange?: (value: number | null) => void
  min?: number
  max?: number
  /** Increment applied by the steppers and arrow keys. Defaults to `1`. */
  step?: number
  /** `"stacked"` carets on the right (default) or inline `−`/`+` flanking the field. */
  layout?: "stacked" | "inline"
  size?: InputRootProps["size"]
  hasError?: boolean
  /** Disable the press-scale on the stepper buttons. */
  static?: boolean
  /** Forwarded to the wrapping `InputRoot`. */
  rootClassName?: string
}

export function NumberInput({
  value,
  defaultValue,
  onValueChange,
  min,
  max,
  step = 1,
  layout = "stacked",
  size,
  hasError,
  disabled,
  static: isStatic,
  rootClassName,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...fieldProps
}: NumberInputProps) {
  const decimals = React.useMemo(() => decimalsOf(step), [step])
  const isControlled = value !== undefined

  // Uncontrolled buffer is a *string* so intermediate states ("", "-", "1.") survive typing.
  const [internal, setInternal] = React.useState(() =>
    defaultValue == null ? "" : String(defaultValue),
  )
  const displayed = isControlled ? (value == null ? "" : String(value)) : internal

  // The current value as a number, or null while the field is empty/partial ("", "-", ".").
  const numeric =
    displayed === "" || displayed === "-" || displayed === "." ? null : Number(displayed)

  // Mirror of `numeric` (falling back to the floor) kept in a ref so hold-to-repeat reads the
  // freshest figure even before a controlled parent re-renders. Synced in an effect (never
  // written during render) and updated optimistically inside `stepBy` for repeat ticks.
  const numericRef = React.useRef<number>(numeric ?? min ?? 0)
  React.useEffect(() => {
    numericRef.current = numeric ?? min ?? 0
  }, [numeric, min])

  const field = useFieldContext()
  const resolvedDisabled = disabled ?? field?.disabled ?? false

  const commit = React.useCallback(
    (next: string, numeric: number | null) => {
      if (!isControlled) setInternal(next)
      onValueChange?.(numeric)
    },
    [isControlled, onValueChange],
  )

  const stepBy = React.useCallback(
    (direction: 1 | -1) => {
      const base = Number.isFinite(numericRef.current) ? numericRef.current : (min ?? 0)
      const next = round(clamp(base + direction * step, min, max), decimals)
      numericRef.current = next
      commit(String(next), next)
    },
    [commit, decimals, max, min, step],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Allow only a leading minus, digits, and a single decimal point while typing.
    if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return
    const numeric = raw === "" || raw === "-" || raw === "." ? null : Number(raw)
    commit(raw, numeric)
  }

  // Re-clamp once editing finishes, so a typed out-of-range value snaps to the bound.
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (displayed === "" || displayed === "-" || displayed === ".") {
      commit("", null)
    } else {
      const clamped = round(clamp(Number(displayed), min, max), decimals)
      numericRef.current = clamped
      commit(String(clamped), clamped)
    }
    fieldProps.onBlur?.(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault()
      stepBy(1)
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      stepBy(-1)
    }
    fieldProps.onKeyDown?.(e)
  }

  const atMax = max != null && numeric != null && numeric >= max
  const atMin = min != null && numeric != null && numeric <= min

  // The stepper rail has to be sized with the SAME value the wrapping InputRoot resolves, so the
  // size is resolved once here (own prop > container > ambient density) and handed to both.
  const resolvedSize = useControlSize(size)
  const slots = numberStepperVariants({ size: resolvedSize, layout, static: isStatic })
  const railClass = (edge: "left" | "right") =>
    numberStepperVariants({ size: resolvedSize, layout, edge, static: isStatic }).rail()

  // Hold-to-repeat: an initial pause, then an accelerating interval until pointer release.
  const holdTimers = React.useRef<{ timeout?: number; interval?: number }>({})
  const stopHold = React.useCallback(() => {
    window.clearTimeout(holdTimers.current.timeout)
    window.clearInterval(holdTimers.current.interval)
    holdTimers.current = {}
  }, [])
  React.useEffect(() => stopHold, [stopHold])

  const startHold = (direction: 1 | -1) => {
    stepBy(direction)
    holdTimers.current.timeout = window.setTimeout(() => {
      holdTimers.current.interval = window.setInterval(() => stepBy(direction), 60)
    }, 400)
  }

  const stepper = (direction: 1 | -1, atBound: boolean) => {
    const isUp = direction === 1
    const Icon = layout === "inline" ? (isUp ? Plus : Minus) : isUp ? CaretUp : CaretDown
    return (
      <button
        type="button"
        tabIndex={-1}
        data-slot={isUp ? "number-input-increment" : "number-input-decrement"}
        aria-label={isUp ? "Increase" : "Decrease"}
        disabled={resolvedDisabled || atBound}
        className={slots.button()}
        onPointerDown={(e) => {
          e.preventDefault() // keep focus on the field
          if (e.button === 0) startHold(direction)
        }}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <Icon weight="bold" aria-hidden="true" />
      </button>
    )
  }

  const inputField = (
    <InputField
      id={id ?? field?.id}
      type="text"
      inputMode={decimals > 0 ? "decimal" : "numeric"}
      role="spinbutton"
      aria-valuenow={numeric ?? undefined}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      className={`tabular-nums ${layout === "inline" ? "text-center" : ""} ${className ?? ""}`}
      value={displayed}
      disabled={resolvedDisabled}
      {...fieldProps}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    <InputRoot size={resolvedSize} hasError={hasError} disabled={disabled} className={rootClassName}>
      {layout === "inline" ? (
        <>
          <span className={railClass("left")}>{stepper(-1, atMin)}</span>
          {inputField}
          <span className={railClass("right")}>{stepper(1, atMax)}</span>
        </>
      ) : (
        <>
          {inputField}
          <span className={railClass("right")}>
            {stepper(1, atMax)}
            <span className="h-px w-full bg-input" aria-hidden="true" />
            {stepper(-1, atMin)}
          </span>
        </>
      )}
    </InputRoot>
  )
}
