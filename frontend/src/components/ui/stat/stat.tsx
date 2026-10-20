"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import { TrendUp, TrendDown, Minus } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { useDensity, type Density } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"
import { cubicBezier, countUpDuration, easingPoints } from "@/lib/motion"
import { IN_VIEW_OPTIONS } from "@/lib/in-view"
import { Chart, ChartArea, ChartLine, ChartTooltip } from "@/components/ui/chart"

/**
 * Stat: the Data Display KPI/metric card. A multi-part component built like Card:
 * one `tv` recipe with `slots`, shared variants flowing to every part through React
 * Context (never prop-drilled or cloned). Compose the parts (`StatLabel`,
 * `StatValue`, `StatTrend`, `StatIcon`, `StatSparkline`) to assemble a dashboard tile.
 * See docs/ARCHITECTURE.md §2.
 *
 * Two ways to use it without the tile: `variant="plain"` keeps the Stat's layout and type ramp
 * with no frame at all (a headline figure laid on the sheet or inside a Card), and every part but
 * `StatSparkline` also renders on its own, outside any Stat, with the plain look at the ambient
 * density. That makes `StatValue` the DS's one headline figure and `StatTrend` its one trend chip,
 * wherever a figure sits.
 */
export const statVariants = tv({
  slots: {
    // No fill here: fill is elevation, so only `elevated` paints one (see Card).
    // The edge is a ring (box-shadow), not a border: it takes no layout, so the sparkline bleed and
    // every inner radius stay concentric with the tile, and it composes with the lift below.
    root: "flex flex-col rounded-xl text-card-foreground",
    // Header is a row so the label sits left and an icon/action rides top-right.
    header: "flex items-start justify-between gap-3",
    label: "text-sm font-medium text-muted-foreground",
    // tabular-nums so a live-updating figure never reflows its own width. The figure is the tile's
    // headline, so it speaks in the display face (DM Sans, like h1-h4) one step up the scale.
    value: "font-heading font-semibold leading-none tracking-tight tabular-nums text-foreground",
    // Soft chip; the directional tone (success/destructive/muted) is applied per
    // instance in StatTrend, since each trend carries its own direction. It never wraps and never
    // shrinks: "+1.1 pts" broken over two lines in a narrow tile reads as two chips, so the row
    // beside it gives way instead.
    trend:
      "inline-flex w-fit shrink-0 items-center gap-0.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums [&>svg]:size-3.5",
    caption: "text-sm text-pretty text-muted-foreground",
    footer: "flex items-center gap-2",
    // The card is rounded-xl (20px), so the inner tile steps down to lg (16px): one rung smaller,
    // never the same radius as its parent.
    icon: "grid shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5",
    sparkline: "w-full",
  },
  variants: {
    variant: {
      // In-flow tiles are contours on whatever ground holds them; only `elevated` floats, and in
      // dark the lifted fill (not the shadow, which barely reads on near-black) is what shows it.
      // Shadows over borders: `default` is a `--edge` ring plus the xs lift, `outline` the bare
      // ring at full `--border` strength (no lift to help it), `elevated` the lift alone.
      default: { root: "shadow-xs ring-1 ring-edge" },
      outline: { root: "shadow-none ring-1 ring-border" },
      elevated: { root: "bg-card shadow-lg [--surface:var(--card)]" },
      // No frame at all: no ring, no lift, no fill, no padding. The figure lies on whatever holds
      // it (the page sheet, a Card's content) and keeps the Stat's type ramp and part rhythm. The
      // padding and the tighter gap live in the compound variants below, keyed on density.
      plain: { root: "bg-transparent shadow-none ring-0" },
    },
    // Density is Koala's cross-cutting spacing axis (see lib/density.tsx). For Stat it
    // governs padding, gap, value size, and the icon tile. `compact` is the dashboard
    // default; `comfortable` is the roomier marketing alternative.
    density: {
      compact: { root: "gap-2.5 p-4", value: "text-3xl", icon: "size-9" },
      comfortable: { root: "gap-3 p-5", value: "text-4xl", icon: "size-10" },
    },
    // When the whole tile is a link/button, add affordance: pointer, hover lift, and a
    // focus ring. Display tiles stay inert (a KPI card is data, not a control).
    interactive: {
      true: {
        // A full tile scaling 0.96 reads janky; 0.98 gives press feedback on a large
        // surface while staying above the 0.95 floor. Transition only the two properties
        // that actually move (the hover shadow and the press scale), never the catch-all.
        root: "cursor-pointer transition-[box-shadow,transform] duration-fast ease-out hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      },
    },
    // Set automatically when a tile sits inside a StatGroup. The group owns the one
    // shared border, radius, and shadow, so each tile drops its own chrome and lies
    // flush. It still paints an OPAQUE fill, the ground it sits on (`--surface`, which an
    // elevated group sets to the card, else the page), so it covers the group's
    // hairline-divider backdrop. `[--surface:inherit]` cancels a tile's own `elevated`
    // declaration so the tile always takes the group's ground, never its own.
    // (ring-0 drops the variant's edge ring whatever its color; shadow-none drops the lift.)
    grouped: {
      true: {
        root: "rounded-none bg-[var(--surface,var(--background))] shadow-none ring-0 [--surface:inherit]",
      },
    },
  },
  compoundVariants: [
    // Plain drops the tile's padding, and the parts close up (label, figure and caption read as
    // one block once there is no frame to space them against). Comfortable keeps a step more.
    { variant: "plain", density: "compact", className: { root: "gap-1.5 p-0" } },
    { variant: "plain", density: "comfortable", className: { root: "gap-2 p-0" } },
    // An interactive plain figure has no frame for the hover lift to raise, and gets no press
    // scale: the pointer and the focus ring are its affordance.
    { variant: "plain", interactive: true, className: { root: "hover:shadow-none active:scale-100" } },
  ],
  defaultVariants: {
    variant: "default",
    density: "compact",
  },
})

type StatSlots = ReturnType<typeof statVariants>
interface StatContextValue {
  slots: StatSlots
  density: Density
}

/**
 * A plain Context with a `null` default (not the throwing `lib/create-context` factory), because
 * the parts are allowed to render without a Stat: `StatValue` beside a chart title, `StatTrend`
 * next to any figure. Inside a Stat they read the root's slots; outside one they fall back to
 * {@link STANDALONE_SLOTS}. Only `StatSparkline` insists on a Stat, since it bleeds to the tile.
 */
const StatContext = React.createContext<StatContextValue | null>(null)
StatContext.displayName = "StatContext"

/** The recipe a part uses outside any Stat: the plain look at each density, resolved once. */
const STANDALONE_SLOTS: Record<Density, StatSlots> = {
  compact: statVariants({ variant: "plain", density: "compact" }),
  comfortable: statVariants({ variant: "plain", density: "comfortable" }),
}

/** The slots a part paints with: its Stat's, or the standalone plain recipe at ambient density. */
function useStatSlots(): StatSlots {
  const context = React.useContext(StatContext)
  const density = useDensity()
  return context ? context.slots : STANDALONE_SLOTS[density]
}

function useStatContext(consumerName: string): StatContextValue {
  const context = React.useContext(StatContext)
  if (context === null) {
    throw new Error(`\`${consumerName}\` must be used within \`Stat\``)
  }
  return context
}

/**
 * Ambient flag a {@link StatGroup} sets so every nested {@link Stat} renders flush
 * (no own border/radius/shadow). A plain Context with a safe `false` default (not the
 * typed factory) because this is an *optional* signal: a Stat is perfectly valid on its
 * own, so it must read `false` outside a group rather than throw.
 */
const StatGroupContext = React.createContext(false)

export interface StatProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof statVariants> {
  asChild?: boolean
}

/**
 * Parts are exported individually (not `Stat.Value` dot-notation) because namespaced
 * statics don't survive the RSC server→client boundary; only named exports do.
 * Compose as `<Stat><StatLabel>…`.
 */
export function Stat({
  className,
  variant,
  density,
  interactive,
  asChild = false,
  ...props
}: StatProps) {
  // Density resolves prop > provider > "compact"; compute the slots once, every part
  // reads them from context. The resolved density is shared too, so StatSparkline can
  // bleed past the exact card padding.
  const resolvedDensity = useDensity(density)
  // Inside a StatGroup the tile sheds its own chrome; standalone it keeps it. The group already
  // owns the frame, so `plain` has nothing left to strip there: the tile keeps the group's padding.
  const grouped = React.useContext(StatGroupContext)
  const resolvedVariant = grouped && variant === "plain" ? undefined : variant
  const context = React.useMemo<StatContextValue>(
    () => ({
      slots: statVariants({ variant: resolvedVariant, interactive, density: resolvedDensity, grouped }),
      density: resolvedDensity,
    }),
    [resolvedVariant, interactive, resolvedDensity, grouped],
  )
  const Comp = asChild ? Slot.Root : "div"
  return (
    <StatContext.Provider value={context}>
      <Comp data-slot="stat" className={context.slots.root({ className })} {...props} />
    </StatContext.Provider>
  )
}

export function StatHeader({ className, ...props }: React.ComponentProps<"div">) {
  const slots = useStatSlots()
  return <div data-slot="stat-header" className={slots.header({ className })} {...props} />
}

/** The metric's name. Renders inside a Stat or on its own (muted, medium weight). */
export function StatLabel({ className, ...props }: React.ComponentProps<"div">) {
  const slots = useStatSlots()
  return <div data-slot="stat-label" className={slots.label({ className })} {...props} />
}

// ── Count-up ─────────────────────────────────────────────────────────────────────────────────────
// `countUp` counts the figure up from zero to its target the first time it scrolls into view, and
// re-counts every time it re-enters (same IntersectionObserver trigger as the marketing `Reveal`). It
// climbs and decelerates onto the final value, so it reads as a real count, not a static number. The
// count is driven imperatively (the freshly formatted value is written straight to the DOM each
// frame), so nothing re-renders React mid-count and it stays smooth at 60fps.

/** The numeric core of a figure string, parsed so the driver can count up to it while preserving the
 *  surrounding format. */
interface ParsedMetric {
  prefix: string
  suffix: string
  /** The value to count up to; the count lands exactly on it. */
  target: number
  /** Fixed fractional digits to render every frame (taken from the source string, e.g. `4.2` → 1). */
  decimals: number
  /** Group thousands with commas as the figure climbs (mirrors the source string). */
  grouping: boolean
}

// `\D*?` (lazy) claims only a leading prefix like "$"; the numeric core carries commas + an optional
// decimal; everything after is the suffix. Anything without a number (or non-string children) yields
// null, and StatValue renders the children verbatim.
const METRIC_PATTERN = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/

function parseMetric(children: React.ReactNode): ParsedMetric | null {
  if (typeof children !== "string") return null
  const match = METRIC_PATTERN.exec(children.trim())
  if (!match) return null
  const [, prefix, digits, suffix] = match
  const target = Number.parseFloat(digits.replace(/,/g, ""))
  if (Number.isNaN(target)) return null
  const dot = digits.indexOf(".")
  const decimals = dot === -1 ? 0 : digits.length - dot - 1
  return { prefix, suffix, target, decimals, grouping: digits.includes(",") }
}

// The count eases up on the same curve as the CSS `ease-out` token (see lib/motion): it shoots up fast
// then decelerates onto the final figure, the classic count-up settle.
const countEase = cubicBezier(easingPoints.out)

/**
 * Renders a parsed figure and counts it up from zero to its target imperatively. It mirrors the
 * marketing {@link Reveal}: an IntersectionObserver counts up the first time it scrolls into view and
 * re-counts on every re-entry, writing the freshly formatted value straight to the DOM each frame
 * (never through React state), so nothing re-renders mid-count. The number server-renders its final
 * value, so SSR / no-JS / `prefers-reduced-motion` show the real figure; the effect only resets it to
 * zero once it is ready to animate. The visual figure is `aria-hidden`; StatValue pairs it with an
 * `sr-only` copy of the real value.
 */
function RollingNumber({ parsed }: { parsed: ParsedMetric }) {
  const numberRef = React.useRef<HTMLSpanElement>(null)
  // One en-US formatter, reused every frame: fixed fraction digits and the source's grouping, so the
  // climbing figure keeps its decimals and grows commas exactly like the final value.
  const format = React.useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: parsed.decimals,
        maximumFractionDigits: parsed.decimals,
        useGrouping: parsed.grouping,
      }),
    [parsed.decimals, parsed.grouping],
  )

  React.useEffect(() => {
    const el = numberRef.current
    if (!el) return
    const write = (value: number) => {
      el.textContent = format.format(value)
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      write(parsed.target) // hold on the real figure, no count
      return
    }

    let raf = 0
    let start: number | null = null
    const step = (now: number) => {
      if (start === null) start = now
      const t = Math.min((now - start) / countUpDuration, 1)
      if (t < 1) {
        write(parsed.target * countEase(t))
        raf = requestAnimationFrame(step)
      } else {
        write(parsed.target) // land exactly on the target, free of any rounding drift
      }
    }
    const play = () => {
      cancelAnimationFrame(raf)
      start = null
      raf = requestAnimationFrame(step)
    }

    write(0) // reset to zero, ready to count up when it (re-)enters view
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play()
        else {
          cancelAnimationFrame(raf)
          write(0) // rearm so it counts up fresh next time it scrolls back in
        }
      },
      // Shares the DS viewport gate with Stagger/SectionHeader, but keeps its own observer: the
      // count-up drives the DOM per frame, so routing it through React state would cost a render
      // on every scroll crossing.
      IN_VIEW_OPTIONS,
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [parsed, format])

  // tabular-nums keeps every intermediate figure the same width per digit, so the row never jitters as
  // the count climbs and grows digits from the right; the prefix and suffix stay put.
  return (
    <span aria-hidden className="tabular-nums">
      {parsed.prefix && <span className="whitespace-pre">{parsed.prefix}</span>}
      <span ref={numberRef}>{format.format(parsed.target)}</span>
      {parsed.suffix && <span className="whitespace-pre">{parsed.suffix}</span>}
    </span>
  )
}

export interface StatValueProps extends React.ComponentProps<"div"> {
  /**
   * Count the figure up from zero to its value the first time it scrolls into view (same trigger as
   * the marketing `Reveal`), and re-count every time it re-enters. The figure climbs and decelerates
   * onto its target, reading as a real count-up rather than a static number. Needs string children
   * like `"4,100"`, `"$4.2M"`, or `"74%"`; the prefix, suffix, and comma/decimal format are preserved
   * and the count lands exactly on target. No-ops (renders the children verbatim) for non-string or
   * number-less content, and honors `prefers-reduced-motion` by showing the final figure immediately.
   * Pairs with the slot's built-in `tabular-nums`, so the row never jitters as the count climbs.
   */
  countUp?: boolean
}

/**
 * The headline figure: the display face, `tabular-nums`, one step up the scale per density. Inside
 * a Stat it follows the tile's density; on its own (beside a chart title, in a Ranking header, on
 * the sheet) it takes the ambient density, so it is the same figure wherever a number leads.
 */
export function StatValue({ className, countUp = false, children, ...props }: StatValueProps) {
  const slots = useStatSlots()
  const parsed = React.useMemo(
    () => (countUp ? parseMetric(children) : null),
    [countUp, children],
  )
  return (
    <div data-slot="stat-value" className={slots.value({ className })} {...props}>
      {parsed ? (
        <>
          {/* Screen readers get the real figure; the animated count is decorative. */}
          <span className="sr-only">{children}</span>
          <RollingNumber key={String(children)} parsed={parsed} />
        </>
      ) : (
        children
      )}
    </div>
  )
}

/** The muted line that frames the figure (a period, a comparison). Works inside or outside a Stat. */
export function StatCaption({ className, ...props }: React.ComponentProps<"div">) {
  const slots = useStatSlots()
  return <div data-slot="stat-caption" className={slots.caption({ className })} {...props} />
}

export function StatFooter({ className, ...props }: React.ComponentProps<"div">) {
  const slots = useStatSlots()
  return <div data-slot="stat-footer" className={slots.footer({ className })} {...props} />
}

export function StatIcon({ className, ...props }: React.ComponentProps<"div">) {
  const slots = useStatSlots()
  return <div data-slot="stat-icon" aria-hidden className={slots.icon({ className })} {...props} />
}

/** Maps each direction to its arrow + tone. `inverted` flips only the color meaning
 *  (for metrics where down is the good outcome: refunds, churn, bounce rate) while
 *  the arrow keeps pointing the honest way. */
const TREND_ARROW = { up: TrendUp, down: TrendDown, neutral: Minus } as const
// Tones mirror the canonical soft Badge (see components/ui/badge): a tinted fill at /10, the
// darker `-strong` text counterpart for legibility, and a transparent border so the fill alone
// carries the color (no colored hairline). Keeps trend chips consistent with the Badge system.
const TREND_TONE = {
  positive: "border-transparent bg-success/10 text-success-strong",
  negative: "border-transparent bg-destructive/10 text-destructive-strong",
  neutral: "border-transparent bg-muted text-muted-foreground",
} as const

export interface StatTrendProps extends React.ComponentProps<"span"> {
  /** Arrow direction. Drives the glyph and, by default, the color. */
  direction?: "up" | "down" | "neutral"
  /** Flip the color meaning without flipping the arrow (down-is-good metrics). */
  inverted?: boolean
}

/**
 * The trend chip: an arrow that points the honest way and a tone that says whether it is good
 * news. It never wraps. Inside a Stat or on its own, it is the chip to set beside any figure.
 */
export function StatTrend({
  className,
  direction = "up",
  inverted = false,
  children,
  ...props
}: StatTrendProps) {
  const slots = useStatSlots()
  const Arrow = TREND_ARROW[direction]
  const tone =
    direction === "neutral"
      ? "neutral"
      : (direction === "up") !== inverted
        ? "positive"
        : "negative"

  return (
    <span
      data-slot="stat-trend"
      data-direction={direction}
      className={slots.trend({ className: cn(TREND_TONE[tone], className) })}
      {...props}
    >
      <Arrow weight="bold" aria-hidden />
      {children}
    </span>
  )
}

/** Cancel the card's bottom (and side) padding so the trend bleeds to the edge,
 *  matched exactly to the resolved density. */
const SPARKLINE_BLEED: Record<Density, string> = {
  compact: "-mx-4 -mb-4 rounded-b-xl",
  comfortable: "-mx-5 -mb-5 rounded-b-xl",
}

export interface StatSparklineProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** The series to plot. Rendered as a soft area fill under a trend line. */
  data: number[]
  /** Stroke width in px. */
  strokeWidth?: number
  /** Show a gliding tooltip with the value at each point on hover. */
  tooltip?: boolean
  /** Format each point's value in the tooltip. */
  valueFormatter?: (value: number) => string
}

/**
 * StatSparkline: a chromeless trend built on {@link Chart} in `sparkline` mode. It
 * paints in `currentColor`, so set the hue with a text utility (e.g.
 * `className="text-success"`) and it themes for free. It bleeds to the bottom and side
 * edges of the tile (no padding gap under the line); pass `tooltip` to light up each
 * point on hover with Koala's gliding {@link Tooltip}.
 */
export function StatSparkline({
  data,
  strokeWidth = 2,
  tooltip = false,
  valueFormatter,
  className,
  ...props
}: StatSparklineProps) {
  const { slots, density } = useStatContext("StatSparkline")
  return (
    <Chart
      data={data}
      sparkline
      data-slot="stat-sparkline"
      // Decorative: the figure already lives in StatValue, so the chart stays hidden from
      // assistive tech. The tooltip is a mouse-only enhancement.
      aria-hidden
      // w-auto (not w-full) so the negative side margins actually stretch it edge-to-edge.
      className={slots.sparkline({
        className: cn("h-14 w-auto overflow-hidden", SPARKLINE_BLEED[density], className),
      })}
      {...props}
    >
      <ChartArea />
      <ChartLine strokeWidth={strokeWidth} hideActiveDot={!tooltip} />
      {tooltip && (
        <ChartTooltip valueFormatter={valueFormatter} labelFormatter={(i) => `Point ${i}`} />
      )}
    </Chart>
  )
}

/**
 * StatGroup: fuses a row of {@link Stat} tiles into one segmented surface, the way a
 * dashboard header bands several KPIs together instead of floating them as separate
 * cards. The group owns the single border, radius, and shadow; nested tiles read the
 * {@link StatGroupContext} flag and shed their own chrome to lie flush.
 *
 * The dividers are the trick: the container paints `bg-border` under a `gap-px` grid,
 * and each tile paints the ground it sits on (opaque) on top, so all that shows through
 * the seams is a hairline. Unlike `divide-x`/`divide-y`, this stays clean across both axes and when
 * tiles wrap to a new row. `overflow-hidden` clips the square tile corners to the
 * group's radius.
 */
export const statGroupVariants = tv({
  base: "grid gap-px overflow-hidden rounded-xl bg-border",
  variants: {
    variant: {
      // Mirror Stat's own variants so a group reads as one big tile. Only `elevated` lifts the
      // ground: it declares the card as `--surface`, which the grouped tiles paint.
      default: "shadow-xs ring-1 ring-edge",
      outline: "shadow-none ring-1 ring-border",
      elevated: "shadow-lg [--surface:var(--card)]",
    },
    // Columns at the widest breakpoint; everything steps down to 1→2 below it so the
    // band never crushes its tiles on narrow screens.
    columns: {
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    },
  },
  defaultVariants: {
    variant: "default",
    columns: 4,
  },
})

export interface StatGroupProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof statGroupVariants> {
  asChild?: boolean
}

export function StatGroup({
  className,
  variant,
  columns,
  asChild = false,
  ...props
}: StatGroupProps) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <StatGroupContext.Provider value={true}>
      <Comp
        data-slot="stat-group"
        className={statGroupVariants({ variant, columns, className })}
        {...props}
      />
    </StatGroupContext.Provider>
  )
}
