"use client"

import * as React from "react"
import { Eye, EyeSlash } from "@phosphor-icons/react"
import { tv, type VariantProps } from "@/lib/tv"
import { createContext } from "@/lib/create-context"
import { useControlSize, type Density } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"

// ─── Variants ─────────────────────────────────────────────────────────────────

const inputVariants = tv({
  slots: {
    root: [
      "flex items-center w-full overflow-hidden",
      // Opaque background that matches whatever surface the input sits on: reads `--surface`
      // if a container set one (e.g. Dialog → popover), else falls back to the page background.
      // The field stays opaque (real bg) but visually blends, so it never looks "filled".
      "rounded-md border border-input bg-[var(--surface,var(--background))]",
      "transition-[border-color,box-shadow] duration-fast ease-out",
      "focus-within:outline-none focus-within:border-brand focus-within:brand-ring",
      // A browser-autofilled value washes the frame in the brand (globals.css, `autofill-tint`).
      "autofill-tint",
    ],
    field: [
      "flex-1 min-w-0 bg-transparent outline-none",
      // Keeps the browser's autofill paint and forced text color off the field.
      "autofill-clear",
      "text-foreground placeholder:text-muted-foreground",
      "disabled:cursor-not-allowed",
      "file:border-0 file:bg-transparent file:font-medium",
    ],
    adornment: [
      "flex shrink-0 items-center",
      "text-muted-foreground",
      "[&_svg]:pointer-events-none [&_svg]:shrink-0",
      // Default icon size per slot; overridable via className
      "[&_svg:not([class*='size-'])]:size-4",
    ],
    prefixLabel: [
      "flex shrink-0 items-center self-stretch",
      "border-r border-input bg-[var(--surface,var(--background))] text-muted-foreground",
      "whitespace-nowrap select-none font-medium",
    ],
    suffixButton: [
      "flex shrink-0 cursor-pointer items-center justify-center",
      "rounded-sm",
      "text-muted-foreground hover:text-foreground hover:bg-accent",
      "transition-[color,background-color,scale] duration-fast ease-out",
      "active:scale-[0.96]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    ],
  },
  variants: {
    // `variant` is listed first so `hasError` / `disabled` border + bg rules below
    // win the tailwind-merge conflict and stay visible even in the inline variant.
    variant: {
      // Default reproduces the base recipe verbatim: the bordered container is always shown.
      default: {},
      // Inline: chromeless at rest, the container only materializes on hover. Focus keeps the
      // brand border + ring from the base slot (hover is scoped to :not(:focus-within) so the
      // two never fight). Ideal for inline-edit fields: titles, cells, settings rows.
      inline: {
        root: [
          "border-transparent bg-transparent",
          // The base only transitions border-color + box-shadow; the inline reveal also
          // fades the background in, so widen the transition to cover it.
          "transition-[border-color,box-shadow,background-color] duration-fast ease-out",
          "[&:not(:focus-within)]:hover:border-input",
          "[&:not(:focus-within)]:hover:bg-[var(--surface,var(--background))]",
        ],
        // Drop the prefix-label divider/fill so it doesn't paint a seam over the bare field.
        prefixLabel: "border-transparent bg-transparent",
      },
    },
    size: {
      sm: {
        root: "h-8 gap-1.5 px-2.5",
        field: "py-0 text-sm pointer-coarse:text-base",
        adornment: "[&_svg:not([class*='size-'])]:size-[15px]",
        // Negative margin cancels root's pl so the label sits flush against the left border.
        // overflow-hidden on root clips it cleanly at the rounded corner.
        prefixLabel: "-ml-2.5 pl-2.5 pr-2.5 text-xs",
        suffixButton: "size-6 -mr-1.5",
      },
      md: {
        root: "h-9 gap-2 px-3",
        field: "py-0 text-sm pointer-coarse:text-base",
        adornment: "[&_svg:not([class*='size-'])]:size-4",
        prefixLabel: "-ml-3 pl-3 pr-3 text-sm",
        suffixButton: "size-7 -mr-2",
      },
      lg: {
        root: "h-10 gap-2 px-3.5",
        field: "py-0 text-sm pointer-coarse:text-base",
        adornment: "[&_svg:not([class*='size-'])]:size-[18px]",
        prefixLabel: "-ml-3.5 pl-3.5 pr-3.5 text-sm",
        suffixButton: "size-8 -mr-2",
      },
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
    variant: "default",
    size: "md",
  },
})

// ─── Context ──────────────────────────────────────────────────────────────────

type Size = NonNullable<VariantProps<typeof inputVariants>["size"]>
type Variant = NonNullable<VariantProps<typeof inputVariants>["variant"]>

type InputContextValue = {
  size: Size
  variant: Variant
  disabled: boolean
  hasError: boolean
  slots: ReturnType<typeof inputVariants>
}

const [InputProvider, useInputContext] = createContext<InputContextValue>("Input")

// ─── InputRoot ────────────────────────────────────────────────────────────────

export interface InputRootProps extends React.ComponentPropsWithoutRef<"div"> {
  size?: Size
  variant?: Variant
  hasError?: boolean
  disabled?: boolean
  /**
   * Spacing tier. Height comes from `size`, not density; this only sets the DEFAULT `size`
   * when none is given (compact → "sm", comfortable → "md"). Resolves prop > DensityProvider >
   * "compact". An explicit `size` always wins.
   */
  density?: Density
}

function InputRoot({
  size,
  variant = "default",
  hasError,
  disabled,
  density,
  className,
  children,
  ...props
}: InputRootProps) {
  // Inside a Field, error/disabled cascade from `<Field hasError>` / `<Field disabled>` so
  // the consumer sets them once. A local prop always wins over the field default.
  const field = useFieldContext()
  const resolvedError = hasError ?? field?.hasError ?? false
  const resolvedDisabled = disabled ?? field?.disabled ?? false
  // Height comes from `size`; density only picks the DEFAULT size (compact → sm, comfortable →
  // md) so a bare field in a compact app shell keeps step with a same-defaulted Button.
  const resolvedSize = useControlSize(size, density)
  const slots = inputVariants({
    size: resolvedSize,
    variant,
    hasError: resolvedError,
    disabled: resolvedDisabled,
  })
  return (
    <InputProvider
      size={resolvedSize}
      variant={variant}
      disabled={resolvedDisabled}
      hasError={resolvedError}
      slots={slots}
    >
      <div
        data-slot="input-root"
        data-disabled={resolvedDisabled || undefined}
        data-error={resolvedError || undefined}
        className={slots.root({ className })}
        {...props}
      >
        {children}
      </div>
    </InputProvider>
  )
}

// ─── InputField ───────────────────────────────────────────────────────────────

// React 19: `ref` is a regular prop. ComponentProps (not …WithoutRef) keeps it in the type
// so callers can grab the underlying <input> (e.g. to focus it when a dialog opens).
export type InputFieldProps = Omit<React.ComponentProps<"input">, "size">

function InputField({
  className,
  disabled,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputFieldProps) {
  const { slots, disabled: ctxDisabled, hasError } = useInputContext("InputField")
  // Surrounding Field (if any) supplies the id + aria wiring; explicit props still win.
  const field = useFieldContext()
  return (
    <input
      data-slot="input-field"
      id={id ?? field?.id}
      className={slots.field({ className })}
      disabled={disabled ?? ctxDisabled}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      aria-invalid={hasError || field?.hasError || undefined}
      {...props}
    />
  )
}

// ─── InputPrefix ──────────────────────────────────────────────────────────────

export type InputPrefixProps = React.ComponentPropsWithoutRef<"span">

function InputPrefix({ className, ...props }: InputPrefixProps) {
  const { slots } = useInputContext("InputPrefix")
  return (
    <span
      data-slot="input-prefix"
      aria-hidden="true"
      className={slots.adornment({ className })}
      {...props}
    />
  )
}

// ─── InputSuffix ──────────────────────────────────────────────────────────────

export type InputSuffixProps = React.ComponentPropsWithoutRef<"span">

function InputSuffix({ className, ...props }: InputSuffixProps) {
  const { slots } = useInputContext("InputSuffix")
  return (
    <span
      data-slot="input-suffix"
      aria-hidden="true"
      className={slots.adornment({ className })}
      {...props}
    />
  )
}

// ─── InputPrefixLabel ─────────────────────────────────────────────────────────

export type InputPrefixLabelProps = React.ComponentPropsWithoutRef<"span">

function InputPrefixLabel({ className, ...props }: InputPrefixLabelProps) {
  const { slots } = useInputContext("InputPrefixLabel")
  return (
    <span
      data-slot="input-prefix-label"
      className={slots.prefixLabel({ className })}
      {...props}
    />
  )
}

// ─── InputSuffixButton ────────────────────────────────────────────────────────

export type InputSuffixButtonProps = React.ComponentPropsWithoutRef<"button">

function InputSuffixButton({ className, ...props }: InputSuffixButtonProps) {
  const { slots } = useInputContext("InputSuffixButton")
  return (
    <button
      data-slot="input-suffix-button"
      type="button"
      className={slots.suffixButton({ className })}
      {...props}
    />
  )
}

// ─── PasswordInput ────────────────────────────────────────────────────────────

export interface PasswordInputProps extends InputFieldProps {
  rootClassName?: string
  size?: Size
  variant?: Variant
  hasError?: boolean
  density?: Density
}

function PasswordInput({
  rootClassName,
  size,
  variant,
  hasError,
  disabled,
  density,
  className,
  ...fieldProps
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)

  return (
    <InputRoot
      size={size}
      variant={variant}
      hasError={hasError}
      disabled={disabled}
      density={density}
      className={rootClassName}
    >
      <InputField
        type={visible ? "text" : "password"}
        className={className}
        {...fieldProps}
      />
      <InputSuffixButton
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((v) => !v)}
      >
        <span className="relative flex size-4 items-center justify-center">
          <Eye
            weight="bold"
            className={`absolute size-4 transition-[opacity,scale,filter] duration-fast ease-out ${visible ? "opacity-0 scale-[0.25] blur-[4px]" : "opacity-100 scale-100 blur-[0px]"}`}
            aria-hidden="true"
          />
          <EyeSlash
            weight="bold"
            className={`absolute size-4 transition-[opacity,scale,filter] duration-fast ease-out ${visible ? "opacity-100 scale-100 blur-[0px]" : "opacity-0 scale-[0.25] blur-[4px]"}`}
            aria-hidden="true"
          />
        </span>
      </InputSuffixButton>
    </InputRoot>
  )
}

// InputLabel / InputHint are the shared Label / Hint primitives (one label recipe in the DS).
// Placed *outside* InputRoot, they style identically and, inside a Field, auto-wire ids/aria.
export {
  InputRoot,
  InputField,
  InputPrefix,
  InputSuffix,
  InputPrefixLabel,
  InputSuffixButton,
  PasswordInput,
  inputVariants,
}

export {
  Label as InputLabel,
  Hint as InputHint,
  type LabelProps as InputLabelProps,
  type HintProps as InputHintProps,
} from "@/components/ui/label"
