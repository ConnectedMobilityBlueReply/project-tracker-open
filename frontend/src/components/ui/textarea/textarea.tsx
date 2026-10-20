"use client"

import * as React from "react"
import { tv, type VariantProps } from "@/lib/tv"
import { createContext } from "@/lib/create-context"
import { useControlSize, type Density } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"

// ─── Variants ─────────────────────────────────────────────────────────────────

const textareaVariants = tv({
  slots: {
    root: [
      "flex flex-col w-full overflow-hidden",
      // Opaque background that matches whatever surface the textarea sits on: reads `--surface`
      // if a container set one (e.g. Dialog → popover), else falls back to the page background.
      // The field stays opaque (real bg) but visually blends, so it never looks "filled".
      "rounded-md border border-input bg-[var(--surface,var(--background))]",
      "transition-[border-color,box-shadow] duration-fast ease-out",
      "focus-within:outline-none focus-within:border-brand focus-within:brand-ring",
      // A browser-autofilled value washes the frame in the brand (globals.css, `autofill-tint`).
      "autofill-tint",
    ],
    field: [
      "w-full bg-transparent outline-none",
      "text-foreground placeholder:text-muted-foreground",
      "disabled:cursor-not-allowed",
      // Keeps the browser's autofill paint and forced text color off the field.
      "autofill-clear",
    ],
    footer: [
      "flex shrink-0 items-center justify-between gap-2",
      "text-muted-foreground",
    ],
    count: "tabular-nums select-none",
  },
  variants: {
    size: {
      // `pointer-coarse:text-base`: iOS zooms the page into a focused field under 16px, and it
      // decides by input device, not width. Touch gets 16px; a desktop keeps 14px at any width.
      sm: {
        field: "min-h-16 px-2.5 py-2 text-sm pointer-coarse:text-base",
        footer: "px-2.5 pb-2 text-xs",
        count: "text-xs",
      },
      md: {
        field: "min-h-20 px-3 py-2.5 text-sm pointer-coarse:text-base",
        footer: "px-3 pb-2.5 text-xs",
        count: "text-xs",
      },
      lg: {
        field: "min-h-24 px-3.5 py-3 text-sm pointer-coarse:text-base",
        footer: "px-3.5 pb-3 text-sm",
        count: "text-sm",
      },
    },
    resize: {
      none: { field: "resize-none" },
      vertical: { field: "resize-y" },
      horizontal: { field: "resize-x" },
      both: { field: "resize" },
    },
    hasError: {
      true: {
        root: [
          "border-destructive",
          "focus-within:border-destructive focus-within:destructive-ring",
        ],
      },
    },
    disabled: {
      true: {
        root: "opacity-50 pointer-events-none select-none",
      },
    },
  },
  defaultVariants: {
    size: "md",
    resize: "vertical",
  },
})

// ─── Context ──────────────────────────────────────────────────────────────────

type Size = NonNullable<VariantProps<typeof textareaVariants>["size"]>
type Resize = NonNullable<VariantProps<typeof textareaVariants>["resize"]>

type TextareaContextValue = {
  size: Size
  resize: Resize
  disabled: boolean
  hasError: boolean
  slots: ReturnType<typeof textareaVariants>
}

const [TextareaProvider, useTextareaContext] =
  createContext<TextareaContextValue>("Textarea")

// ─── TextareaRoot ───────────────────────────────────────────────────────────

export interface TextareaRootProps
  extends React.ComponentPropsWithoutRef<"div"> {
  /** Padding + text tier. Unset, it follows the container (a `Form`) or the ambient density. */
  size?: Size
  /**
   * Spacing tier. Like every other control, this only picks the DEFAULT `size` (compact → "sm",
   * comfortable → "md"); an explicit `size` always wins.
   */
  density?: Density
  /** Controls the native resize affordance. `autoResize` on the field forces `none`. */
  resize?: Resize
  hasError?: boolean
  disabled?: boolean
}

function TextareaRoot({
  size,
  density,
  resize = "vertical",
  hasError,
  disabled,
  className,
  children,
  ...props
}: TextareaRootProps) {
  // Inside a Field, error/disabled cascade from `<Field hasError>` / `<Field disabled>` so
  // the consumer sets them once. A local prop always wins over the field default.
  const field = useFieldContext()
  const resolvedError = hasError ?? field?.hasError ?? false
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  // Resolves like every other control (see lib/density.tsx), so a textarea in a `Form` matches the
  // Inputs beside it instead of pinning itself to `md` and reading a step short of them.
  const resolvedSize = useControlSize(size, density)
  const slots = textareaVariants({
    size: resolvedSize,
    resize,
    hasError: resolvedError,
    disabled: resolvedDisabled,
  })
  return (
    <TextareaProvider
      size={resolvedSize}
      resize={resize}
      disabled={resolvedDisabled}
      hasError={resolvedError}
      slots={slots}
    >
      <div
        data-slot="textarea-root"
        data-disabled={resolvedDisabled || undefined}
        data-error={resolvedError || undefined}
        className={slots.root({ className })}
        {...props}
      >
        {children}
      </div>
    </TextareaProvider>
  )
}

// ─── TextareaField ────────────────────────────────────────────────────────────

// Auto-resize rides the native CSS `field-sizing: content` (no JS, no scrollbar). Where the
// browser lacks it (Firefox today) we fall back to measuring `scrollHeight`. Detection is
// memoized and SSR-safe: `false` on the server, so the JS path only ever runs on the client.
let fieldSizingSupported: boolean | null = null
function supportsFieldSizing() {
  if (fieldSizingSupported === null) {
    fieldSizingSupported =
      typeof CSS !== "undefined" &&
      typeof CSS.supports === "function" &&
      CSS.supports("field-sizing", "content")
  }
  return fieldSizingSupported
}

// JS fallback: grow the element to fit its content by writing the inline height directly,
// no React state, so it stays clear of the repo's set-state-in-effect lint.
function autoSize(el: HTMLTextAreaElement) {
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight}px`
}

// React 19: `ref` is a regular prop. ComponentProps (not …WithoutRef) keeps it in the type
// so callers can grab the underlying <textarea> (e.g. to focus it when a dialog opens).
export interface TextareaFieldProps
  extends Omit<React.ComponentProps<"textarea">, "size"> {
  /** Grow to fit content as the user types; pins the resize affordance to `none`. */
  autoResize?: boolean
  /**
   * Opt-in character-count addon: renders a `TextareaFooter` + `TextareaCount` below the
   * field, tracked automatically (works controlled or uncontrolled). Pass the native
   * `maxLength` to show `current / max` and hard-cap input.
   */
  showCount?: boolean
}

function TextareaField({
  className,
  disabled,
  autoResize,
  showCount,
  id,
  ref,
  value,
  defaultValue,
  onInput,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaFieldProps) {
  const { slots, disabled: ctxDisabled, hasError } =
    useTextareaContext("TextareaField")
  // Surrounding Field (if any) supplies the id + aria wiring; explicit props still win.
  const field = useFieldContext()

  // The JS measuring path only matters when CSS field-sizing is missing. In supporting
  // browsers these hooks all no-op, so there's zero runtime cost on the happy path.
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
  const fallbackActive = autoResize && !supportsFieldSizing()

  // Compose our measuring ref with whatever the caller passed; size on first mount.
  const setRefs = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
      if (node && fallbackActive) autoSize(node)
    },
    [ref, fallbackActive],
  )

  // Re-fit when a controlled `value` changes from the outside (paste, autofill, reset).
  // Reads the ref and mutates style only, no state, so the strict hooks lint stays happy.
  React.useEffect(() => {
    if (fallbackActive && innerRef.current) autoSize(innerRef.current)
  }, [fallbackActive, value])

  // Character-count addon: when controlled the count derives straight from `value` (no state);
  // when uncontrolled we track the field's own length, seeded from `defaultValue` and updated on
  // input: the setState lives in the event handler, clear of the repo's set-state-in-effect lint.
  const isControlled = value !== undefined
  const [uncontrolledCount, setUncontrolledCount] = React.useState(
    () => String(defaultValue ?? "").length,
  )
  const count = isControlled ? String(value ?? "").length : uncontrolledCount

  const handleInput: NonNullable<TextareaFieldProps["onInput"]> = (event) => {
    if (fallbackActive) autoSize(event.currentTarget)
    if (showCount && !isControlled) setUncontrolledCount(event.currentTarget.value.length)
    onInput?.(event)
  }

  // `field-sizing: content` does the work in supporting browsers; the manual grip would fight
  // either path, so pin resize off. Appended via className so tailwind-merge lets `resize-none`
  // win over the recipe's `resize-*`.
  const autoClasses = autoResize ? "field-sizing-content resize-none" : ""
  const textarea = (
    <textarea
      data-slot="textarea-field"
      ref={setRefs}
      id={id ?? field?.id}
      value={value}
      defaultValue={defaultValue}
      onInput={handleInput}
      className={slots.field({
        className: `${autoClasses} ${className ?? ""}`.trim() || undefined,
      })}
      disabled={disabled ?? ctxDisabled}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-invalid={hasError || field?.hasError || undefined}
      {...props}
    />
  )

  // The addon footer is a sibling of the <textarea> inside the root, so it lays out below the
  // field exactly like a hand-composed TextareaFooter would.
  if (!showCount) return textarea
  return (
    <>
      {textarea}
      <TextareaFooter>
        <TextareaCount current={count} max={props.maxLength} />
      </TextareaFooter>
    </>
  )
}

// ─── TextareaFooter ───────────────────────────────────────────────────────────

export type TextareaFooterProps = React.ComponentPropsWithoutRef<"div">

function TextareaFooter({ className, ...props }: TextareaFooterProps) {
  const { slots } = useTextareaContext("TextareaFooter")
  return (
    <div
      data-slot="textarea-footer"
      className={slots.footer({ className })}
      {...props}
    />
  )
}

// ─── TextareaCount ────────────────────────────────────────────────────────────

export interface TextareaCountProps
  extends Omit<React.ComponentPropsWithoutRef<"span">, "children"> {
  /** Current character count: pass `value.length` from your controlled field. */
  current: number
  /** Optional limit. Rendered as `current / max` and turns destructive once exceeded. */
  max?: number
}

function TextareaCount({ current, max, className, ...props }: TextareaCountProps) {
  const { slots } = useTextareaContext("TextareaCount")
  const over = max != null && current > max
  return (
    <span
      data-slot="textarea-count"
      data-over={over || undefined}
      aria-live="polite"
      className={slots.count({
        className: `${over ? "text-destructive" : ""} ${className ?? ""}`.trim(),
      })}
      {...props}
    >
      {current}
      {max != null ? ` / ${max}` : null}
    </span>
  )
}

// TextareaLabel / TextareaHint are the shared Label / Hint primitives (one label recipe in
// the DS). Placed *outside* TextareaRoot, they style identically and, inside a Field,
// auto-wire ids/aria.
export {
  TextareaRoot,
  TextareaField,
  TextareaFooter,
  TextareaCount,
  textareaVariants,
}

export {
  Label as TextareaLabel,
  Hint as TextareaHint,
  type LabelProps as TextareaLabelProps,
  type HintProps as TextareaHintProps,
} from "@/components/ui/label"
