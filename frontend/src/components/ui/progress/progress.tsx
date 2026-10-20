"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"
import { createContext } from "@/lib/create-context"

/**
 * Progress: a determinate (or indeterminate) bar on Radix Progress, styled with Koala tokens.
 *
 * Conceptually single-part — track and fill scale together, so one `tv` recipe with `slots`, the
 * same shape as Slider. What *is* optional is the row above the bar, so the label and the readout
 * are real, droppable parts (memory `parts-must-be-droppable`): a bare bar is
 * `<Progress value={64} />` and there is no `showLabel` prop anywhere. Anything passed as children
 * becomes that header row; the track is always the root's own last child, so it can never be
 * composed away by accident.
 *
 *   <Progress value={64} />
 *
 *   <Progress value={64}>
 *     <ProgressLabel>Uploading assets</ProgressLabel>
 *     <ProgressValue />
 *   </Progress>
 *
 * Pass `value={null}` for indeterminate: the fill becomes a short pill sweeping the track, which is
 * the honest reading when there is no percentage to report.
 *
 * `orientation="vertical"` stands the bar up: the fill rises from the floor, `size` sets the bar's
 * width instead of its height, and the header parts stack centred above it. Give the root a height,
 * or let a parent size it (`h-auto flex-1` in a column flex parent); it defaults to 128px.
 *
 * `"use client"` because Radix Progress carries context and the value animates on change.
 */
export const progressVariants = tv({
  slots: {
    root: "flex w-full flex-col gap-2",
    header: "flex items-center justify-between gap-4",
    label: "text-sm font-medium text-foreground",
    value: "text-sm tabular-nums text-muted-foreground",
    // The track clips the fill, so the fill inherits the track's pill ends and an indeterminate
    // sweep can run past both edges without escaping.
    //
    // Its ground is a relative tint of the foreground, not the opaque `--muted`: an opaque muted
    // groove vanished on a muted ground (a selected DataTable row, a muted panel), while a tint
    // always sits one step off whatever is behind it. The alphas are matched to `--muted`: 4% lands
    // exactly on light's muted over white, and 6% in dark is the trough ink the Tabs pill list and
    // the segmented ToggleGroup already use, within a hair of dark's muted over the card (on the
    // bare dark page it sits a step softer, as those troughs do). It rides a variable the track
    // declares for itself, so the `dark:` swap only ever writes the variable: a consumer's own
    // track colour (`[&_[data-slot=progress-track]]:bg-…`) still wins, with no specificity fight.
    track: [
      "relative w-full overflow-hidden rounded-full bg-(--progress-track)",
      "[--progress-track:color-mix(in_oklab,var(--foreground)_4%,transparent)]",
      "dark:[--progress-track:color-mix(in_oklab,var(--foreground)_6%,transparent)]",
    ],
    // Vertical only: the frame the fill rises in. It is absolutely positioned over the track, so its
    // height is the track's used height whatever sized the track (a class, a flexing parent, a
    // stretch), and the fill's percentage height always resolves; a percentage of an in-flow
    // flexed track, or container-query units, came out 0 inside a column flex parent. It inherits
    // the track's padding and radius, so padding on the track insets the fill (a gauge's well,
    // with no calc) and the fill's corners follow the track's instead of a pill's dome.
    rail: "absolute inset-0 flex flex-col justify-end rounded-[inherit] p-[inherit]",
    // Vertical indeterminate only: a square as tall as the track, centred on it and turned a
    // quarter anticlockwise, so the shared X sweep keyframe (`--animate-progress-indeterminate`)
    // runs from the floor to the top. The square is wider than the track; the track clips it to
    // the bar. `aspect-square` on a full-height box is what makes its side the track's height.
    sweep: "absolute top-0 left-1/2 aspect-square h-full -translate-x-1/2 -rotate-90",
    // Width (not scaleX) is driven inline from `value`: scaling would squash the pill's rounded
    // caps into ellipses at low values, and the fill is one contained element, so the layout cost
    // is nil.
    indicator: "h-full rounded-full",
  },
  variants: {
    /**
     * `default` is a measured bar sitting in content: a pill on a muted track that shows the whole
     * distance. `chrome` is the full-bleed page treatment — a reading or loading bar pinned under a
     * header — where the track is dropped and the ends squared off, because a bar that spans the
     * viewport has no edges to round and no gutter to sit a track in.
     */
    variant: {
      default: {},
      chrome: {
        root: "gap-0",
        track: "rounded-none bg-transparent",
        indicator: "rounded-none",
      },
    },
    size: {
      // 4px: page chrome — the reading bar that rides under a navbar.
      xs: { track: "h-1" },
      sm: { track: "h-1.5" },
      md: { track: "h-2" },
      lg: { track: "h-3" },
    },
    tone: {
      brand: { indicator: "bg-brand" },
      foreground: { indicator: "bg-foreground" },
      success: { indicator: "bg-success" },
      warning: { indicator: "bg-warning" },
      destructive: { indicator: "bg-destructive" },
      info: { indicator: "bg-info" },
    },
    /**
     * How the fill reacts to a new value. `smooth` glides between discrete steps (an upload going
     * 0 → 33 → 66); `none` welds the fill to the value, which is what a continuously-driven bar
     * wants — a scroll-progress bar under a transition would trail the scrollbar by 300ms and read
     * as lag rather than polish.
     */
    transition: {
      // Named property, never `transition: all`.
      smooth: {
        indicator: "transition-[width] duration-base ease-out motion-reduce:transition-none",
      },
      none: { indicator: "transition-none" },
    },
    /**
     * Which way the bar runs. `vertical` stands it up: the fill rises from the floor, the header
     * stacks centred above the track, and the track takes the root's height (128px unless the
     * root is given one). `size` maps to the track's width there, in the compound variants below.
     */
    orientation: {
      horizontal: {},
      vertical: {
        root: "h-32 w-fit items-center",
        header: "flex-col justify-center gap-0.5 text-center",
        track: "min-h-0 flex-1",
        // The height is driven inline from `value`, in the rail; the corners follow the track's.
        indicator: "w-full shrink-0 rounded-[inherit]",
      },
    },
  },
  compoundVariants: [
    // Vertical: the size scale sets the bar's thickness, its width, and the height is the root's.
    { orientation: "vertical", size: "xs", className: { track: "h-auto w-1" } },
    { orientation: "vertical", size: "sm", className: { track: "h-auto w-1.5" } },
    { orientation: "vertical", size: "md", className: { track: "h-auto w-2" } },
    { orientation: "vertical", size: "lg", className: { track: "h-auto w-3" } },
    // Standing up, the fill glides on its height.
    {
      orientation: "vertical",
      transition: "smooth",
      className: { indicator: "transition-[height] duration-base ease-out motion-reduce:transition-none" },
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "sm",
    tone: "brand",
    transition: "smooth",
    orientation: "horizontal",
  },
})

type Slots = ReturnType<typeof progressVariants>

const [ProgressProvider, useProgressContext] = createContext<{
  /** null while indeterminate. */
  value: number | null
  max: number
  slots: Slots
  /** Id the root points `aria-labelledby` at; `ProgressLabel` claims it. */
  labelId: string
}>("Progress")

// ─── Progress (root) ──────────────────────────────────────────────────────────

export interface ProgressProps
  extends Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "asChild" | "value">,
    VariantProps<typeof progressVariants> {
  /** 0…`max`. Pass `null` for indeterminate (no known percentage). */
  value?: number | null
  /** Upper bound of the scale. Defaults to 100, so `value` reads as a percentage. */
  max?: number
  /**
   * Which way the bar runs. `vertical` fills from the bottom up (a tank, a level meter): `size`
   * then sets the bar's width, the header parts stack centred above it, and the root needs a
   * height (`className="h-40"`, 128px by default). Stamped as `data-orientation` on the root.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical"
}

function Progress({
  value = 0,
  max = 100,
  variant,
  size,
  tone,
  transition,
  orientation = "horizontal",
  className,
  children,
  ...props
}: ProgressProps) {
  const slots = progressVariants({ variant, size, tone, transition, orientation })
  const vertical = orientation === "vertical"
  const labelId = React.useId()

  // Clamp before painting: a value outside the scale would otherwise overflow the track, and Radix
  // warns on out-of-range values.
  const clamped = value === null || Number.isNaN(value) ? null : Math.min(Math.max(value, 0), max)
  const percent = clamped === null ? 0 : (clamped / max) * 100

  // `role="progressbar"` is a leaf role: a screen reader reads its accessible NAME, not the text
  // sitting inside it, so a visible `ProgressLabel` would go unannounced. Point the root at the
  // label when one is actually composed in — never unconditionally, since a dangling
  // `aria-labelledby` wins over the caller's own `aria-label` and leaves the bar nameless.
  const hasLabel = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === ProgressLabel,
  )
  const labelled = hasLabel && !props["aria-label"] && !props["aria-labelledby"]

  const indicator = (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={slots.indicator({
        // Indeterminate: a short pill sweeps the track on the shared motion token, so no
        // length is implied. Determinate: the width (the height, standing up) *is* the value.
        // Standing up, the sweep runs inside the turned `sweep` square, a band as thick as the
        // square; the track clips it to the bar, so its own corners never show.
        className:
          clamped === null
            ? cn(
                "w-1/4 animate-progress-indeterminate transition-none motion-reduce:animate-none",
                vertical && "h-full rounded-none",
              )
            : undefined,
      })}
      style={clamped === null ? undefined : vertical ? { height: `${percent}%` } : { width: `${percent}%` }}
    />
  )

  // No `aria-orientation`: WAI-ARIA does not allow it on `progressbar` (axe flags it), and the
  // direction a bar fills carries no meaning for assistive tech, which reads the value either way.
  // `data-orientation` is the styling hook, the same attribute Radix stamps on its oriented parts.
  return (
    <ProgressProvider value={clamped} max={max} slots={slots} labelId={labelId}>
      <ProgressPrimitive.Root
        data-slot="progress"
        data-orientation={orientation}
        value={clamped}
        max={max}
        aria-labelledby={labelled ? labelId : undefined}
        className={slots.root({ className })}
        {...props}
      >
        {children ? (
          <div data-slot="progress-header" className={slots.header()}>
            {children}
          </div>
        ) : null}
        <div data-slot="progress-track" className={slots.track()}>
          {!vertical ? (
            indicator
          ) : clamped === null ? (
            <div className={slots.sweep()}>{indicator}</div>
          ) : (
            <div className={slots.rail()}>{indicator}</div>
          )}
        </div>
      </ProgressPrimitive.Root>
    </ProgressProvider>
  )
}

// ─── ProgressLabel ────────────────────────────────────────────────────────────

export type ProgressLabelProps = React.ComponentProps<"span">

function ProgressLabel({ className, id, ...props }: ProgressLabelProps) {
  const { slots, labelId } = useProgressContext("ProgressLabel")
  // Carries the id the root's `aria-labelledby` points at, so the visible label is also the bar's
  // accessible name. An explicit `id` still wins.
  return (
    <span
      data-slot="progress-label"
      id={id ?? labelId}
      className={slots.label({ className })}
      {...props}
    />
  )
}

// ─── ProgressValue ────────────────────────────────────────────────────────────

export interface ProgressValueProps extends Omit<React.ComponentProps<"span">, "children"> {
  /**
   * Render the readout yourself (`(value, max) => …`), e.g. "3 of 8" or a byte count. Defaults to a
   * whole percentage. `value` is null while indeterminate.
   */
  children?: (value: number | null, max: number) => React.ReactNode
}

function ProgressValue({ className, children, ...props }: ProgressValueProps) {
  const { value, max, slots } = useProgressContext("ProgressValue")
  const content = children
    ? children(value, max)
    : value === null
      ? "—"
      : `${Math.round((value / max) * 100)}%`

  // aria-hidden: Radix already exposes the value on the root's progressbar role, so announcing the
  // readout again would double it up for a screen reader.
  return (
    <span
      data-slot="progress-value"
      aria-hidden="true"
      className={slots.value({ className })}
      {...props}
    >
      {content}
    </span>
  )
}

// ─── useScrollProgress ────────────────────────────────────────────────────────

/**
 * How far the document has been scrolled, 0→100. The building block for a reading-progress bar:
 *
 *   const progress = useScrollProgress()
 *   <Progress value={progress} size="xs" aria-label="Reading progress" />
 *
 * Pass a ref to measure a scroll container instead of the document: a reader pane, a modal body,
 * a panel that scrolls on its own.
 *
 *   const pane = React.useRef<HTMLDivElement>(null)
 *   const progress = useScrollProgress(pane)
 *
 * Reads its own `document`, so it works unchanged inside the docs preview iframes (the component
 * executes in that realm). State is only ever set from the scroll/resize listener, never from the
 * effect body, per the strict react-hooks lint (memory `react-hooks-strict-lint`); the first
 * measurement is taken by calling the same handler once on mount.
 */
export function useScrollProgress(target?: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    const box = target?.current ?? null
    let frame = 0

    const measure = () => {
      frame = 0
      const scroller = box ?? document.documentElement
      // The scrollable distance, not the content height: at the bottom of a page one viewport
      // taller than the window, scrollTop equals this and the bar reads a true 100%.
      const scrollable = scroller.scrollHeight - scroller.clientHeight
      setProgress(scrollable <= 0 ? 0 : Math.min(100, (scroller.scrollTop / scrollable) * 100))
    }

    // Coalesce to one measurement per frame: scroll fires far faster than we can paint.
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    // A container reports its own scroll; the document reports through the window.
    const source: HTMLElement | Window = box ?? window
    onScroll()
    source.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      source.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [target])

  return progress
}

export { Progress, ProgressLabel, ProgressValue }
