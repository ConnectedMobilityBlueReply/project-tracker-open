"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { Check } from "@phosphor-icons/react"

import { createContext } from "@/lib/create-context"
import { Spinner } from "@/components/ui/spinner"
import { useDensity } from "@/lib/density"
import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"
import { hitBox } from "@/lib/hit-area"

/**
 * Stepper: a multi-part progress indicator for sequential flows (onboarding, checkout,
 * multi-step dialogs). There is no Radix primitive for a stepper, so behavior is hand-rolled,
 * but the house rules still hold: one `tv` recipe with `slots`, cross-part state through a
 * typed React Context (never prop-drilled or cloned), named exports, tokens only.
 *
 * State model: the Root tracks the active step (controlled `value` / uncontrolled
 * `defaultValue`). Each `StepperItem` carries a 1-based `step` and derives its own state
 * (`completed` (step < active), `active` (step === active), or `inactive`) published on a
 * `data-state` attribute. Indicator, title, and the connecting separator all restyle off that
 * via `group-data-[state=…]/step`, so a step transition animates with no JS measurement.
 *
 * Orientation is known at the Root, so it's a recipe variant (not a runtime group selector):
 * horizontal lays items in a row with flexible connectors; vertical stacks them with the
 * connector running down the indicator column. A single `--step-size` CSS variable (set per
 * density) drives the indicator diameter and every connector offset, so the geometry stays
 * exact at either density without per-case math.
 */
export const stepperVariants = tv({
  slots: {
    root: "flex",
    // `group/step` lets descendants restyle off this item's data-state; `relative` anchors
    // the connector, which is absolutely positioned (centre-to-centre between circles).
    item: "group/step relative flex",
    // `group/trigger` lets the indicator react to the button's focus (the ring hugs the
    // circle, not the whole row). polish: tactile scale-on-press,
    // matching Tabs; disable via the `static` prop. Layout (stacked vs. inline) is per-orientation.
    trigger: [
      "group/trigger inline-flex outline-none cursor-pointer",
      "transition-transform duration-fast ease-out active:scale-[0.96]",
      "disabled:pointer-events-none disabled:cursor-not-allowed",
    ],
    indicator: [
      // `z-10` keeps the circle above the connector, which passes behind it centre-to-centre.
      "relative z-10 inline-flex size-[var(--step-size)] shrink-0 items-center justify-center rounded-full",
      "border-2 border-border bg-background font-medium text-muted-foreground",
      // Curated `transition` (colors + ring, never `transition: all`) so state changes ease.
      "transition duration-fast ease-out",
      // Focus ring hugs the circle (outline, so it never fights the active state's ring).
      "group-focus-visible/trigger:outline-2 group-focus-visible/trigger:outline-offset-2 group-focus-visible/trigger:outline-brand",
      // Active: outlined in primary with a soft glow ring. Completed: filled primary.
      "group-data-[state=active]/step:border-primary group-data-[state=active]/step:text-primary group-data-[state=active]/step:ring-4 group-data-[state=active]/step:ring-primary/10",
      "group-data-[state=completed]/step:border-primary group-data-[state=completed]/step:bg-primary group-data-[state=completed]/step:text-primary-foreground",
      "group-data-[disabled]/step:opacity-50",
      // polish: a 40px hit halo so the trigger stays tappable even
      // when compact density shrinks the visible circle to 32px. Centered, so neighbours never overlap.
      hitBox,
      "[&_svg]:shrink-0",
    ],
    title:
      "font-medium text-muted-foreground transition-colors duration-fast ease-out group-data-[state=active]/step:text-foreground group-data-[state=completed]/step:text-foreground",
    description: "text-pretty text-muted-foreground",
    // Connector track. Absolute in both orientations; geometry baked per orientation below.
    separator: "absolute overflow-hidden bg-border",
    // The fill grows from empty to full when the owning step completes (#13: interruptible).
    separatorFill: "block size-full bg-primary transition-transform duration-base ease-out",
  },
  variants: {
    // Indicator fill style. `outline` (default) is the quiet ringed circle; `solid` fills every
    // state (muted grey when upcoming, brand-filled (number) when active, brand-filled (check)
    // when done) for the bolder, Calendly-style rail used in big multi-step wizards.
    variant: {
      outline: {},
      solid: {
        indicator: [
          "border-transparent bg-muted text-muted-foreground",
          // Active: brand fill, no halo ring (flat, like the upcoming/done circles).
          "group-data-[state=active]/step:border-transparent group-data-[state=active]/step:bg-primary group-data-[state=active]/step:text-primary-foreground group-data-[state=active]/step:ring-0",
          // Done already fills via the base rule; just drop the border so it reads fully solid.
          "group-data-[state=completed]/step:border-transparent",
        ],
      },
    },
    orientation: {
      // Stacked: circles in a row with the label centred below; the connector runs from this
      // circle's centre to the next one's, passing behind both (the circles paint over it).
      horizontal: {
        item: "min-w-0 flex-1 flex-col items-center",
        trigger: "flex-col items-center gap-2 text-center",
        separator:
          "top-[calc(var(--step-size)/2)] left-[calc(50%+var(--step-size)/2)] h-0.5 w-[calc(100%-var(--step-size))] -translate-y-1/2 rounded-full",
        separatorFill: "origin-left scale-x-0 group-data-[state=completed]/step:scale-x-100",
      },
      // Inline: circle left, label right; the connector runs straight down the circle's column.
      vertical: {
        root: "flex-col",
        // Reserve vertical room (except on the last item) so the connector always has length.
        item: "flex-row items-start gap-3 [&:not(:last-child)]:min-h-[calc(var(--step-size)+2rem)]",
        trigger: "flex-row items-start gap-3 text-left",
        // The row top-aligns (a description must stack under the title, not center against
        // the circle), so the title carries the nudge that sits its FIRST LINE on the circle's
        // centre: 4px at both densities ((28−20)/2 and (24−16)/2). Without it a title-only
        // step reads as hanging off the top of its indicator.
        title: "pt-1",
        separator:
          "left-[calc(var(--step-size)/2)] top-[calc(var(--step-size)+0.25rem)] bottom-1 w-0.5 -translate-x-1/2 rounded-full",
        separatorFill: "origin-top scale-y-0 group-data-[state=completed]/step:scale-y-100",
      },
    },
    // Density is Koala's cross-cutting spacing axis (see lib/density.tsx). `--step-size` sets
    // the indicator diameter (and, through it, every connector offset); text tiers track it.
    density: {
      comfortable: {
        root: "[--step-size:1.75rem]",
        indicator: "text-sm [&_svg]:size-4",
        title: "text-sm",
        description: "text-xs",
      },
      compact: {
        root: "[--step-size:1.5rem]",
        indicator: "text-xs [&_svg]:size-3.5",
        title: "text-xs",
        description: "text-xs",
      },
    },
  },
  defaultVariants: {
    variant: "outline",
    orientation: "horizontal",
    density: "comfortable",
  },
})

type StepperSlots = ReturnType<typeof stepperVariants>

const [StepperProvider, useStepperContext] = createContext<{
  slots: StepperSlots
  activeStep: number
  setActiveStep: (step: number) => void
}>("Stepper")

type StepState = "completed" | "active" | "inactive"

const [StepperItemProvider, useStepperItemContext] = createContext<{
  step: number
  state: StepState
  disabled: boolean
  loading: boolean
}>("StepperItem")

export interface StepperProps
  extends Omit<React.ComponentProps<"div">, "onChange">,
    VariantProps<typeof stepperVariants> {
  /** Active step, 1-based, controlled. Pair with `onValueChange`. */
  value?: number
  /** Initial active step, 1-based, uncontrolled. Defaults to `1`. */
  defaultValue?: number
  /** Fired when a step is selected via its trigger. */
  onValueChange?: (step: number) => void
}

/**
 * Parts are exported individually (not `Stepper.Item` dot-notation) because namespaced
 * statics don't survive the RSC server→client boundary. Compose as `<Stepper><StepperItem>…`.
 */
export function Stepper({
  className,
  variant,
  orientation,
  density,
  value,
  defaultValue = 1,
  onValueChange,
  ...props
}: StepperProps) {
  const slots = stepperVariants({ variant, orientation, density: useDensity(density) })

  // Controllable active step: prop > internal. `value` defined ⇒ controlled.
  const [internalStep, setInternalStep] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const activeStep = isControlled ? value : internalStep

  const setActiveStep = React.useCallback(
    (step: number) => {
      if (!isControlled) setInternalStep(step)
      onValueChange?.(step)
    },
    [isControlled, onValueChange],
  )

  return (
    <StepperProvider slots={slots} activeStep={activeStep} setActiveStep={setActiveStep}>
      <div
        role="group"
        data-slot="stepper"
        data-orientation={orientation ?? "horizontal"}
        className={slots.root({ className })}
        {...props}
      />
    </StepperProvider>
  )
}

export interface StepperItemProps extends React.ComponentProps<"div"> {
  /** This step's 1-based position. Drives whether it reads as completed/active/inactive. */
  step: number
  /** Force the completed state regardless of the active step (non-linear flows). */
  completed?: boolean
  /** Block selection of this step and mute it (e.g. steps the user can't reach yet). */
  disabled?: boolean
  /** Swap the indicator glyph for a spinner, e.g. while the active step validates/submits. */
  loading?: boolean
}

export function StepperItem({
  className,
  step,
  completed,
  disabled = false,
  loading = false,
  ...props
}: StepperItemProps) {
  const { slots, activeStep } = useStepperContext("StepperItem")
  const state: StepState = (completed ?? activeStep > step)
    ? "completed"
    : activeStep === step
      ? "active"
      : "inactive"

  return (
    <StepperItemProvider step={step} state={state} disabled={disabled} loading={loading}>
      <div
        data-slot="stepper-item"
        data-state={state}
        data-disabled={disabled || undefined}
        data-loading={loading || undefined}
        className={slots.item({ className })}
        {...props}
      />
    </StepperItemProvider>
  )
}

export interface StepperTriggerProps extends React.ComponentProps<"button"> {
  /** Render onto a child element via Radix Slot instead of a `<button>`. */
  asChild?: boolean
  /** Disable the tactile scale-on-press, e.g. where motion would distract. */
  static?: boolean
}

/**
 * The clickable region that selects its step. Wrap the indicator (and optionally the label)
 * in it for navigable steppers; omit it for a read-only progress indicator and place
 * `StepperIndicator` / `StepperTitle` directly in the item.
 */
export function StepperTrigger({
  className,
  asChild = false,
  static: isStatic = false,
  onClick,
  ...props
}: StepperTriggerProps) {
  const { slots, setActiveStep } = useStepperContext("StepperTrigger")
  const { step, state, disabled } = useStepperItemContext("StepperTrigger")
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      type={asChild ? undefined : "button"}
      data-slot="stepper-trigger"
      disabled={disabled || undefined}
      aria-current={state === "active" ? "step" : undefined}
      className={slots.trigger({ className: cn(isStatic && "active:scale-100", className) })}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        if (!event.defaultPrevented) setActiveStep(step)
      }}
      {...props}
    />
  )
}

/**
 * The numbered circle. Shows the step number by default (or `children` as a custom resting
 * glyph), a check once completed, and a spinner while the item is `loading`.
 */
export function StepperIndicator({
  className,
  children,
  ...props
}: React.ComponentProps<"span">) {
  const { slots } = useStepperContext("StepperIndicator")
  const { step, state, loading } = useStepperItemContext("StepperIndicator")

  return (
    <span data-slot="stepper-indicator" className={slots.indicator({ className })} {...props}>
      {loading ? (
        <Spinner aria-hidden />
      ) : state === "completed" ? (
        // #7: the check pops in when a step completes, rather than hard-cutting from the number.
        <Check weight="bold" aria-hidden className="animate-in zoom-in-50 fade-in duration-base ease-out" />
      ) : (
        // Tabular figures keep multi-digit steps from reflowing as the active step changes.
        <span className="tabular-nums">{children ?? step}</span>
      )}
    </span>
  )
}

export function StepperTitle({ className, ...props }: React.ComponentProps<"span">) {
  const { slots } = useStepperContext("StepperTitle")
  return <span data-slot="stepper-title" className={slots.title({ className })} {...props} />
}

export function StepperDescription({ className, ...props }: React.ComponentProps<"span">) {
  const { slots } = useStepperContext("StepperDescription")
  return (
    <span
      data-slot="stepper-description"
      className={slots.description({ className })}
      {...props}
    />
  )
}

/**
 * The connector between two steps. Place it as the last child of every item except the last;
 * its fill grows as that step completes. Decorative: hidden from assistive tech.
 */
export function StepperSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useStepperContext("StepperSeparator")
  return (
    <div
      aria-hidden
      data-slot="stepper-separator"
      className={slots.separator({ className })}
      {...props}
    >
      <span className={slots.separatorFill()} />
    </div>
  )
}
