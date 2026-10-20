"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { createContext } from "@/lib/create-context"
import { tv } from "@/lib/tv"
import { duration } from "@/lib/motion"
import { Tooltip, TooltipGroup, TooltipSeparator } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Chart: a small, dependency-free plotting primitive for line / area / bar trends, funnels and
 * pies. It's a multi-part component built like Card: the `Chart` root owns the data, the series
 * config, the series state (which are hidden, which is in focus) and the measured geometry, and the
 * parts (`ChartGrid`, `ChartArea`, `ChartLine`, `ChartBar`, `ChartXAxis`, `ChartYAxis`,
 * `ChartTooltip`, `ChartLegend`, …) read it from React Context and draw into one shared,
 * pixel-measured `<svg>`. The one HTML part, `ChartLegend`, portals itself into a slot above or
 * below the plot, so it still composes as a child.
 *
 * Everything paints from tokens: series take a semantic hue (`primary`, `teal`,
 * `purple`, …) resolved to a `currentColor` so the stroke, fill gradient and dots
 * theme across all four palettes for free. There is no chart library underneath:
 * just `<path>` math, the same hand-rolled approach as Calendar (native Date).
 *
 * Hover is delegated to Koala's own {@link Tooltip}: a full-height transparent band
 * per category becomes a tooltip trigger, wrapped in a {@link TooltipGroup} so one
 * bubble *glides* across the columns while a crosshair tracks the active point.
 * See docs/ARCHITECTURE.md.
 */
export const chartVariants = tv({
  slots: {
    // Carries the height utility. A column: the legend slots, then the measured plot between them.
    root: "relative flex w-full flex-col text-foreground",
    // Geometry comes from measuring this box: whatever height the legend leaves.
    plot: "relative min-h-0 flex-1",
    // overflow-visible lets edge dots and the last x-axis label spill past the plot.
    svg: "absolute inset-0 size-full overflow-visible",
    // The hover bubble's inner column (label on top, one row per series below).
    tooltip: "flex flex-col gap-1.5 tabular-nums",
    // A legend key: the swatch, then the label (and an optional figure).
    legendItem:
      "relative flex items-center gap-2 rounded-xs text-xs text-muted-foreground outline-none transition-[color,opacity] duration-fast ease-out",
    // The swatch every key and tooltip row uses: a small rounded square, as Attio and Mixpanel draw.
    swatch: "size-2.5 shrink-0 rounded-[3px]",
  },
})

/* ------------------------------------------------------------------- colors --- */

/** The semantic hues a series can take. `current` inherits the ambient `currentColor`
 *  (set with a `text-*` utility). That's how the chromeless Stat sparkline themes. */
export type ChartColor =
  | "current"
  | "blue"
  // The tonal steps of the house blue, for a stack read by its order rather than by its hues.
  | "blue-800"
  | "blue-700"
  | "blue-600"
  | "blue-400"
  | "blue-300"
  | "blue-200"
  | "brand"
  | "neutral"
  // A mid grey that holds its own as a segment: the "Other" bucket of a breakdown.
  | "gray"
  | "primary"
  | "purple"
  | "pink"
  | "teal"
  | "orange"
  | "success"
  | "warning"
  | "info"
  | "destructive"

// Complete class strings (never interpolated) so Tailwind can see every utility. `blue` is the
// default chart hue: a blue-500 stroke whose area wash (currentColor @ ~22%) lands at blue-100/200.
const SERIES_TEXT: Record<ChartColor, string> = {
  current: "",
  blue: "text-blue-500",
  "blue-800": "text-blue-800",
  "blue-700": "text-blue-700",
  "blue-600": "text-blue-600",
  "blue-400": "text-blue-400",
  "blue-300": "text-blue-300",
  "blue-200": "text-blue-200",
  // The accent, for the one datum a chart singles out (the current week, the leader).
  brand: "text-brand",
  // The recessive ink for the rest of the data when one datum carries the brand: the foreground at
  // 10% reads as a quiet grey on every theme, light or dark, without a token of its own.
  neutral: "text-foreground/10",
  gray: "text-muted-foreground",
  primary: "text-primary",
  purple: "text-purple",
  pink: "text-pink",
  teal: "text-teal",
  orange: "text-orange",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
}
const SERIES_BG: Record<ChartColor, string> = {
  current: "bg-current",
  blue: "bg-blue-500",
  "blue-800": "bg-blue-800",
  "blue-700": "bg-blue-700",
  "blue-600": "bg-blue-600",
  "blue-400": "bg-blue-400",
  "blue-300": "bg-blue-300",
  "blue-200": "bg-blue-200",
  brand: "bg-brand",
  neutral: "bg-foreground/10",
  gray: "bg-muted-foreground",
  primary: "bg-primary",
  purple: "bg-purple",
  pink: "bg-pink",
  teal: "bg-teal",
  orange: "bg-orange",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  destructive: "bg-destructive",
}

/** Default hue rotation for series that don't name a color. `blue` leads (the house chart hue);
 *  eight hues before it repeats, so a wide breakdown keeps every category apart. */
const PALETTE: ChartColor[] = ["blue", "teal", "purple", "orange", "pink", "info", "warning", "success"]

/** The house blue from dark to light: the steps a tonal palette spreads its series over. */
const TONES: ChartColor[] = ["blue-800", "blue-700", "blue-600", "blue", "blue-400", "blue-300", "blue-200"]

/**
 * `count` shades of the house blue, dark to light, spread as far apart as the count allows so
 * neighbours stay distinct: two or three series keep off the extremes (700 to 300), four or more use
 * the whole ramp. The first series (a stack's floor) is the darkest.
 */
export function tonalRamp(count: number): ChartColor[] {
  if (count <= 1) return ["blue"]
  const [lo, hi] = count <= 3 ? [1, 5] : [0, TONES.length - 1]
  return Array.from({ length: count }, (_, i) =>
    count > TONES.length ? TONES[i % TONES.length] : TONES[lo + Math.round((i * (hi - lo)) / (count - 1))],
  )
}

/** `count` hues from a palette: the categorical rotation, or the tonal ramp of the house blue. */
export function chartPalette(count: number, palette: "categorical" | "tonal" = "categorical"): ChartColor[] {
  return palette === "tonal"
    ? tonalRamp(count)
    : Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length])
}

/** The utility that paints `color` as a fill: for a part drawn in HTML, outside the chart's SVG. */
export function chartFillClass(color: ChartColor): string {
  return SERIES_BG[color]
}

/**
 * How a bar recedes while ANOTHER column is hovered. Saturated hues drop to 40%. `neutral` is already
 * the foreground at 10%, so the same dim would leave it at 4% and all but erase it: it holds its ink
 * instead, and the hovered neutral bar steps up to 20% ({@link barLift}) so the column still reads.
 */
function barDim(color: ChartColor): string {
  return color === "neutral" ? "opacity-100" : "opacity-40"
}
function barLift(color: ChartColor): string {
  return color === "neutral" ? "text-foreground/20" : ""
}

/**
 * The chart's own figures (the screen-reader table, the axis ticks, the default tooltip), pinned
 * to one locale. The table renders on the server and hydrates on the client; a bare
 * `toLocaleString()` takes each side's locale, so "18,484" from the server meets "18.484" in a
 * Spanish browser and React throws the whole page away to re-render it. Pass `tickFormatter` /
 * `valueFormatter` to show a different locale.
 */
const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
/** The axis default: a tick reads at a glance as 12K or 1.4M, the way Mixpanel and Attio print them. */
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const PERCENT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 })

/* -------------------------------------------------------------------- types --- */

// `null` (or an absent key) marks a missing point: it becomes a gap in the line/area.
export type ChartDatum = Record<string, number | string | null>
export interface ChartSeriesConfig {
  /** Human label shown in the tooltip. Defaults to the data key. */
  label?: string
  /** Semantic hue. Defaults to a rotating slot in {@link PALETTE}. */
  color?: ChartColor
  /** Format this series' value in the tooltip (overrides ChartTooltip's `valueFormatter`). */
  format?: (value: number) => string
  /** Scale this series against the secondary (right) y-axis instead of the primary. */
  axis?: "left" | "right"
  /**
   * The key of the series this one is measured against, usually the previous period. That series
   * becomes its ghost: it borrows this hue (unless it names its own), draws faint and dashed, and
   * the tooltip prints this series' change against it.
   */
  compare?: string
  /** Down is good for this metric (refunds, churn, latency): a fall reads green, a rise red. */
  inverted?: boolean
}
export type ChartConfig = Record<string, ChartSeriesConfig>

/**
 * How a line or area joins its points. `linear` draws straight segments; `monotone` draws a monotone
 * cubic (Fritsch-Carlson), a smooth curve that still passes through every point and never swings
 * above a peak or below a trough the data does not have.
 */
export type ChartCurve = "linear" | "monotone"

/**
 * Which bars a {@link ChartBar} paints in its `highlightColor`: a category index, a list of them,
 * `"active"` for the bar under the pointer, or a predicate that also receives the active index.
 */
export type ChartBarHighlight =
  | number
  | number[]
  | "active"
  | ((datum: ChartDatum, index: number, active: number | null) => boolean)

interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

interface ResolvedSeries {
  key: string
  label: string
  color: ChartColor
  format?: (value: number) => string
  axis: "left" | "right"
  /** The series this one is measured against (see {@link ChartSeriesConfig.compare}). */
  compare?: string
  inverted: boolean
  /** Another series compares against this one: it draws as a faint, dashed reference. */
  ghost: boolean
}

interface ChartContextValue {
  data: ChartDatum[]
  index?: string
  /** The visible series: what the scale, the tooltip, the stacks and the data table read. */
  series: ResolvedSeries[]
  /** Every series, hidden ones included, in config order: what the legend lists. */
  allSeries: ResolvedSeries[]
  /** Quick lookup from data key to its resolved label + color (hidden series included). */
  seriesByKey: Record<string, ResolvedSeries>
  /** Keys the viewer has switched off (from the legend, or controlled through `hiddenSeries`). */
  hidden: string[]
  /** Show or hide one series. Never hides the last one showing. */
  toggleSeries: (key: string) => void
  /** Show only this series, or everything again when it already stands alone. */
  isolateSeries: (key: string) => void
  /** The series in focus (a legend key under the pointer): the others recede. */
  focused: string | null
  setFocused: (key: string | null) => void
  /** Whether a part drawing `key` should recede because another series has the focus. */
  isDimmed: (key: string) => boolean
  /** True for a moment after the data or the visible series change, so geometry tweens between
   *  the two states instead of jumping. Off the rest of the time, so a resize never lags. */
  morph: boolean
  /** The first category still in progress (the current day or week), or null when every period is
   *  complete. Lines dash from the last complete point, bars hatch. */
  partialFrom: number | null
  domain: [number, number]
  plot: Insets & { width: number; height: number }
  /** True once the box has been measured and the plot has a positive area. */
  ready: boolean
  sparkline: boolean
  /** When true, the data parts play their one-shot load reveal on mount. */
  animate: boolean
  /** When true, multi-series bars/areas stack (and the domain covers the per-category total). */
  stacked: boolean
  xFor: (i: number) => number
  yFor: (v: number) => number
  /** Scale for series on the secondary (right) axis. Equals `yFor` when no right axis is used. */
  yForRight: (v: number) => number
  /** True when at least one series is assigned to the right axis. */
  hasRight: boolean
  /** The y-pixel of the value baseline (0 for full charts, clamped into the plot; the plot
   *  floor for sparklines). Bars and areas grow from here, so negatives read correctly. */
  baseline: number
  /** The baseline for the secondary axis. */
  baselineRight: number
  /** The chart's resolved `color` (currentColor as a concrete value). The tooltip bubble is
   *  portaled out of the chart, so a `current`-hued series can't inherit it via CSS; the legend
   *  dot uses this instead. Re-read on theme change. */
  ink: string
  /** Center-to-center category spacing (also the bar/hover-band width). */
  band: number
  ticks: (count: number) => number[]
  /** Tick values for the secondary (right) axis. */
  ticksRight: (count: number) => number[]
  active: number | null
  /** The most recent hovered index; retained when `active` clears so the hover
   *  chrome (crosshair, active dot) can scale + fade out *in place* instead of
   *  unmounting and popping. */
  lastActive: number
  setActive: (i: number | null) => void
  /** A bar part announces itself on mount (and withdraws on unmount), so a sparkline that draws
   *  bars can lay its categories out in bands and anchor its scale to zero. */
  registerBars: () => () => void
  /** The categories each bar series currently paints in a highlight hue, keyed by data key, so the
   *  tooltip swatch matches the bar it describes. */
  highlights: Record<string, { color: ChartColor; indices: number[] }>
  /** A highlighted {@link ChartBar} publishes its lit categories (returns the withdrawal). */
  markHighlight: (key: string, color: ChartColor, indices: number[]) => () => void
  /** A {@link ChartPie} announces its slice hues, so the legend keys the categories and the
   *  crosshair stays off. Null when no pie is drawn. */
  pie: { colors: ChartColor[] } | null
  registerPie: (colors: ChartColor[]) => () => void
  /** The data key a {@link ChartFunnel} draws, so the tooltip adds conversion and drop-off rows. */
  funnel: string | null
  registerFunnel: (key: string) => () => void
  /** A {@link ChartAnnotation} announces itself, so the plot makes room for its marker above. */
  registerAnnotation: () => () => void
  /** Where the HTML parts render: the legend slots above and below the plot, and a visually-hidden
   *  region that carries annotation text to assistive tech. */
  slots: { top: HTMLElement | null; bottom: HTMLElement | null; sr: HTMLElement | null }
  /** Re-measure the plot now. A legend calls it as it lands, so the first paint already fits. */
  measure: () => void
}

const [ChartProvider, useChartContext] = createContext<ChartContextValue>("Chart")

/**
 * The same context, read optionally: a {@link ChartLegend} placed outside any chart renders as a
 * plain key instead of throwing.
 */
const ChartHostContext = React.createContext<ChartContextValue | null>(null)

/* --------------------------------------------------------------------- root --- */

export interface ChartProps
  extends Omit<React.ComponentProps<"div">, "children"> {
  /** A row per category (objects), or a bare `number[]` for a single `value` series. */
  data: ChartDatum[] | number[]
  /** Key holding each row's category label (for the x-axis / tooltip heading). */
  index?: string
  /** Per-series label + color. Omitted keys fall back to the rotating palette. */
  config?: ChartConfig
  /**
   * The y-domain. `"auto"` (the default) anchors full charts to zero and rounds the top to a nice
   * value; sparklines run tight from min to max. `"fit"` wraps the data's own extent in nice rounded
   * bounds with nice ticks, for a rate or a balance that moves in a band far from zero (a line or an
   * area; bars read against zero, so keep `"auto"` for them). A `[min, max]` pair fixes it exactly,
   * with ticks dividing it evenly by the axis `count`.
   * @default "auto"
   */
  domain?: [number, number] | "auto" | "fit"
  /** Chromeless mode: zero padding, points span the full width, currentColor. */
  sparkline?: boolean
  /** Stack multi-series `ChartBars`/`ChartAreas` and size the domain to the per-category total.
   *  Without it, `ChartBars` renders series grouped side by side. */
  stack?: boolean
  /**
   * How series that name no `color` are painted. `categorical` rotates distinct hues (blue, teal,
   * purple…), for lines that cross and must be told apart. `tonal` spreads shades of the house blue,
   * dark to light: a stack reads by its order, so one quiet hue is enough. Explicit colors always
   * win. @default "tonal" when `stack` is set, else "categorical"
   */
  palette?: "categorical" | "tonal"
  /** Override the plot insets (raise `bottom`/`left` to make room for axes). */
  padding?: Partial<Insets>
  /**
   * Play the one-shot load reveal when the chart first mounts: the line self-draws, the area rises,
   * and bars grow from the baseline. Honors `prefers-reduced-motion`. @default true
   */
  animate?: boolean
  /**
   * Show the vertical hover crosshair. It paints *behind* the data layers (under the line and any
   * markers) so the trend always reads on top. Defaults to `true` for full charts, `false` for
   * sparklines.
   */
  crosshair?: boolean
  /**
   * The active (hovered) category, controlled. `null` means none. Leave it undefined and the chart
   * tracks hover itself; set it to drive the crosshair, the active dot, the bar dim and an
   * `"active"` bar highlight from outside (a table row, a legend).
   */
  activeIndex?: number | null
  /**
   * Called when the active category changes: the index under the pointer as it crosses the
   * {@link ChartTooltip} bands, and `null` when it leaves the plot. Fires for controlled and
   * uncontrolled charts alike, only on a real change.
   */
  onActiveIndexChange?: (index: number | null) => void
  /**
   * The series switched off, controlled. A {@link ChartLegend} inside the chart toggles them (click)
   * or isolates one (Alt+click); pass this with `onHiddenSeriesChange` to drive it from outside, a
   * table's checkboxes say. Hidden series leave the scale, the stacks and the tooltip.
   */
  hiddenSeries?: string[]
  /** The series switched off at first, uncontrolled. */
  defaultHiddenSeries?: string[]
  /** Called with the new list whenever a series is shown or hidden. */
  onHiddenSeriesChange?: (keys: string[]) => void
  /**
   * The series in focus, controlled: every other series recedes. A legend key sets it under the
   * pointer (and on keyboard focus); set it from outside to light a series from a table row.
   */
  focusedSeries?: string | null
  /** Called when the focused series changes. */
  onFocusedSeriesChange?: (key: string | null) => void
  /**
   * How many trailing categories are still in progress (`true` = the last one): the current day of
   * a daily chart, whose count is still climbing. Lines dash from the last complete point, areas
   * fade, bars hatch, and the tooltip marks the period, so a half-finished today never reads as a
   * drop. Mixpanel's incomplete-period treatment.
   */
  partial?: boolean | number
  /** Render a loading placeholder (Skeleton) in place of the plot. Sets `aria-busy`. */
  loading?: boolean
  /** Shown when `data` is empty (and not loading). Defaults to a muted "No data" message. */
  empty?: React.ReactNode
  /**
   * Accessible name for the chart. The SVG is decorative (`aria-hidden`); screen readers read a
   * visually-hidden data table instead, captioned with this label. Strongly recommended.
   */
  label?: string
  children?: React.ReactNode
}

function numericKeys(row: ChartDatum | undefined, index?: string): string[] {
  if (!row) return []
  return Object.keys(row).filter((k) => k !== index && typeof row[k] === "number")
}

/** Round a number up (or, when `round`, to nearest) to a "nice" 1/2/5 × 10^k value. */
function niceNum(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range || 1))
  const frac = (range || 1) / 10 ** exp
  const nf = round
    ? frac < 1.5
      ? 1
      : frac < 3
        ? 2
        : frac < 7
          ? 5
          : 10
    : frac <= 1
      ? 1
      : frac <= 2
        ? 2
        : frac <= 5
          ? 5
          : 10
  return nf * 10 ** exp
}

/** "Nice" axis bounds + step for `[min, max]` targeting ~`count` ticks (the d3-style algorithm). */
function niceScale(min: number, max: number, count: number): { lo: number; hi: number; step: number } {
  if (min === max) max = min + 1
  const step = niceNum(niceNum(max - min, false) / Math.max(count, 1), true)
  return {
    lo: Math.floor(min / step) * step,
    hi: Math.ceil(max / step) * step,
    step,
  }
}

/**
 * The y-scale a full chart draws against, from the raw data `extent`: nice 1/2/5 × 10^k bounds and
 * the tick set on that step. `"zero"` (the default look) stretches the range down to 0; `"fit"`
 * wraps the data's own extent, so a series moving in a band far from zero fills the plot. A flat
 * series is padded ±10% (or ±1 at zero) so it sits mid-plot instead of collapsing the scale.
 */
export function niceDomain(
  extent: [number, number],
  mode: "zero" | "fit" = "zero",
  count = 4,
): { domain: [number, number]; ticks: number[] } {
  let [min, max] = extent
  if (mode === "zero") min = Math.min(0, min)
  else if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1
    // Never pad across zero: a flat positive series keeps a floor at or above 0, and vice versa.
    min = min >= 0 ? Math.max(0, min - pad) : min - pad
    max = max <= 0 ? Math.min(0, max + pad) : max + pad
  }
  const { lo, hi, step } = niceScale(min, max, count)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1e6; v += step) ticks.push(Number(v.toPrecision(12)))
  return { domain: [lo, hi], ticks }
}

/**
 * How many categories each x-axis label covers so none collide: the smallest step at which one
 * label (`labelWidth` plus `gap`) fits the distance between the labelled categories, never below
 * `min`. `spacing` is the distance between two neighbouring categories.
 */
export function autoTickInterval(
  count: number,
  spacing: number,
  labelWidth: number,
  gap = 12,
  min = 1,
): number {
  const floor = Math.max(1, Math.floor(min))
  if (count <= 1 || spacing <= 0 || labelWidth <= 0) return floor
  return Math.max(floor, Math.ceil((labelWidth + gap) / spacing))
}

/** Whether the label at `i` shows at `step`, counted back from the LAST category, so the latest
 *  period always carries its name. */
export function tickShownFromEnd(i: number, count: number, step: number): boolean {
  return (count - 1 - i) % Math.max(1, step) === 0
}

interface Point {
  x: number
  y: number
}

/**
 * The slope at each point of a monotone cubic through `points` (Fritsch-Carlson, 1980). Interior
 * slopes average the two neighbouring secants, and drop to 0 where the data turns (a peak, a trough)
 * or runs flat, so an extreme sits exactly on its point. Each segment's pair is then scaled into the
 * monotone region (α² + β² ≤ 9), so no segment can rise past its higher end or dip past its lower.
 */
function monotoneSlopes(points: Point[]): number[] {
  const n = points.length
  const m = new Array<number>(n).fill(0)
  if (n < 2) return m
  const secant: number[] = []
  for (let k = 0; k < n - 1; k++) {
    const h = points[k + 1].x - points[k].x
    secant.push(h ? (points[k + 1].y - points[k].y) / h : 0)
  }
  m[0] = secant[0]
  m[n - 1] = secant[n - 2]
  for (let k = 1; k < n - 1; k++) {
    m[k] = secant[k - 1] * secant[k] <= 0 ? 0 : (secant[k - 1] + secant[k]) / 2
  }
  for (let k = 0; k < n - 1; k++) {
    if (secant[k] === 0) {
      m[k] = 0
      m[k + 1] = 0
      continue
    }
    const a = m[k] / secant[k]
    const b = m[k + 1] / secant[k]
    const r = a * a + b * b
    if (r > 9) {
      const t = 3 / Math.sqrt(r)
      m[k] = t * a * secant[k]
      m[k + 1] = t * b * secant[k]
    }
  }
  return m
}

/**
 * The path commands that carry the pen through `points`, reaching the first one with `start` (`M`
 * to begin a subpath, `L` to continue one): straight segments for `linear`, cubic Béziers for
 * `monotone`. `reverse` walks the same curve backwards (an area's lower edge), with the slopes
 * computed left to right either way, so two stacked bands that share an edge draw it identically.
 */
export function curveThrough(
  points: Point[],
  curve: ChartCurve = "linear",
  start: "M" | "L" = "M",
  reverse = false,
): string {
  if (!points.length) return ""
  const order = reverse ? [...points].reverse() : points
  if (curve === "linear" || points.length < 3) {
    return order.map((p, k) => `${k === 0 ? start : "L"}${p.x},${p.y}`).join(" ")
  }
  const m = monotoneSlopes(points)
  // Hermite to Bézier: each control point sits a third of the way along the segment, on its slope.
  const segments: string[] = []
  for (let k = 0; k < points.length - 1; k++) {
    const p0 = points[k]
    const p1 = points[k + 1]
    const third = (p1.x - p0.x) / 3
    const c0 = `${p0.x + third},${p0.y + m[k] * third}`
    const c1 = `${p1.x - third},${p1.y - m[k + 1] * third}`
    segments.push(reverse ? `C${c1} ${c0} ${p0.x},${p0.y}` : `C${c0} ${c1} ${p1.x},${p1.y}`)
  }
  if (reverse) segments.reverse()
  return `${start}${order[0].x},${order[0].y} ${segments.join(" ")}`
}

/** Point `ref` (a consumer's, callback or object) at `node`. A module helper, so the ref merge below
 *  never reads or writes a ref during render. */
function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") return ref(node)
  if (ref) (ref as React.RefObject<T | null>).current = node
}

/**
 * One callback ref that feeds both the part's own `ref` (which it measures through) and a consumer's
 * `ref`, so passing one never silently replaces the other. Honors a React 19 callback ref's cleanup.
 */
function useMergedRef<T>(own: React.RefObject<T | null>, theirs: React.Ref<T> | undefined) {
  return React.useCallback(
    (node: T | null) => {
      assignRef(own, node)
      const cleanup = assignRef(theirs, node)
      return () => {
        assignRef(own, null)
        if (typeof cleanup === "function") cleanup()
        else assignRef(theirs, null)
      }
    },
    [own, theirs],
  )
}

export function Chart({
  data,
  index,
  config,
  domain: domainProp = "auto",
  sparkline = false,
  stack = false,
  palette: paletteProp,
  padding,
  animate = true,
  crosshair,
  activeIndex,
  onActiveIndexChange,
  hiddenSeries,
  defaultHiddenSeries,
  onHiddenSeriesChange,
  focusedSeries,
  onFocusedSeriesChange,
  partial,
  loading = false,
  empty,
  label,
  className,
  children,
  ref: refProp,
  ...props
}: ChartProps) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })
  const [activeState, setActiveState] = React.useState<number | null>(null)
  const [lastActive, setLastActive] = React.useState(0)
  // The chart's resolved currentColor, captured for the portaled tooltip (see context.ink).
  const [ink, setInk] = React.useState("")
  // How many bar parts are drawn. A sparkline that draws bars lays its categories out in bands.
  const [barLayers, setBarLayers] = React.useState(0)
  const registerBars = React.useCallback(() => {
    setBarLayers((count) => count + 1)
    return () => setBarLayers((count) => count - 1)
  }, [])
  // Pies, funnels and annotations announce themselves the same way.
  const [pie, setPie] = React.useState<ChartContextValue["pie"]>(null)
  const registerPie = React.useCallback((colors: ChartColor[]) => {
    setPie((prev) => (prev && prev.colors.join() === colors.join() ? prev : { colors }))
    return () => setPie(null)
  }, [])
  const [funnel, setFunnel] = React.useState<string | null>(null)
  const registerFunnel = React.useCallback((key: string) => {
    setFunnel(key)
    return () => setFunnel(null)
  }, [])
  const [annotations, setAnnotations] = React.useState(0)
  const registerAnnotation = React.useCallback(() => {
    setAnnotations((count) => count + 1)
    return () => setAnnotations((count) => count - 1)
  }, [])
  // The HTML slots: set through callback refs, so a legend can portal into them once they exist.
  const [topSlot, setTopSlot] = React.useState<HTMLElement | null>(null)
  const [bottomSlot, setBottomSlot] = React.useState<HTMLElement | null>(null)
  const [srSlot, setSrSlot] = React.useState<HTMLElement | null>(null)
  const htmlSlots = React.useMemo(() => ({ top: topSlot, bottom: bottomSlot, sr: srSlot }), [topSlot, bottomSlot, srSlot])

  // Series state. Hidden: controlled through `hiddenSeries`, else owned here.
  const [hiddenState, setHiddenState] = React.useState<string[]>(defaultHiddenSeries ?? [])
  const hidden = hiddenSeries ?? hiddenState
  const setHidden = React.useCallback(
    (next: string[]) => {
      if (hiddenSeries === undefined) setHiddenState(next)
      onHiddenSeriesChange?.(next)
    },
    [hiddenSeries, onHiddenSeriesChange],
  )
  // Focused: the same pattern.
  const [focusedState, setFocusedState] = React.useState<string | null>(null)
  const focused = focusedSeries !== undefined ? focusedSeries : focusedState
  const setFocused = React.useCallback(
    (key: string | null) => {
      if (key === focused) return
      if (focusedSeries === undefined) setFocusedState(key)
      onFocusedSeriesChange?.(key)
    },
    [focused, focusedSeries, onFocusedSeriesChange],
  )
  // Which categories each bar series paints in its highlight hue (see context.highlights). Only a
  // real change of hue or categories stores a new value, so publishing never loops.
  const [highlights, setHighlights] = React.useState<ChartContextValue["highlights"]>({})
  const markHighlight = React.useCallback((key: string, color: ChartColor, indices: number[]) => {
    setHighlights((prev) => {
      const current = prev[key]
      if (current && current.color === color && current.indices.join() === indices.join()) return prev
      return { ...prev, [key]: { color, indices } }
    })
    return () =>
      setHighlights((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
  }, [])

  // Lint-safe: setState lives in named handlers, only called from observer callbacks (never in render).
  // The plot box is measured through `plotRef`; the consumer's `ref` lands on the root.
  const plotRef = React.useRef<HTMLDivElement | null>(null)
  const measure = React.useCallback(() => {
    const el = plotRef.current
    if (!el) return
    const w = el.clientWidth
    const h = el.clientHeight
    // A hint, not the source of truth: an empty reading (a detached or unlaid-out box) leaves the
    // ResizeObserver's size in place, and the observer reports a real collapse on its own.
    if (!w || !h) return
    setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
  }, [])
  React.useEffect(() => {
    const el = plotRef.current
    if (!el) return
    const apply = (w: number, h: number) =>
      setSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }))
    const readInk = () => setInk(getComputedStyle(el).color)
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect
      if (box) apply(box.width, box.height)
      readInk() // fires on mount + resize, so ink is set well before any hover
    })
    ro.observe(el)
    // Re-read on theme switch (the theme is a class on <html>), keeping the tooltip dot in sync.
    const mo = new MutationObserver(readInk)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])

  // Normalize `number[]` → `[{ value }]` so every path below speaks objects.
  const rows = React.useMemo<ChartDatum[]>(
    () =>
      Array.isArray(data) && typeof data[0] === "number"
        ? (data as number[]).map((value) => ({ value }))
        : (data as ChartDatum[]) ?? [],
    [data],
  )

  // Resolve series once: label + a stable color (explicit > config > palette slot).
  // When a `config` is given it's the source of truth for *which* keys are plotted,
  // so the y-domain isn't dragged by other numeric columns sharing the data rows
  // (e.g. a revenue field next to an orders field at a totally different scale).
  const palette = paletteProp ?? (stack ? "tonal" : "categorical")
  const allSeries = React.useMemo<ResolvedSeries[]>(() => {
    const keys = config
      ? Object.keys(config).filter((k) => rows.some((r) => typeof r[k] === "number"))
      : numericKeys(rows[0], index)
    // A comparison target is a ghost of the series that compares against it: it takes no palette
    // slot of its own, and borrows that series' hue unless it names one.
    const comparer = new Map<string, string>()
    for (const key of keys) {
      const target = config?.[key]?.compare
      if (target && keys.includes(target)) comparer.set(target, key)
    }
    // Series with no color of their own take the next palette slot: a hue, or a shade of blue.
    const auto = keys.filter((key) => !comparer.has(key) && !config?.[key]?.color)
    const tones = palette === "tonal" ? tonalRamp(auto.length) : null
    let slot = 0
    const colorOf = new Map<string, ChartColor>()
    for (const key of keys) {
      if (comparer.has(key)) continue
      const own = config?.[key]?.color
      if (own) colorOf.set(key, own)
      else colorOf.set(key, sparkline ? "current" : tones ? tones[slot++] : PALETTE[slot++ % PALETTE.length])
    }
    return keys.map((key) => {
      const cfg = config?.[key]
      const of = comparer.get(key)
      return {
        key,
        label: cfg?.label ?? key,
        color: colorOf.get(key) ?? cfg?.color ?? (of ? colorOf.get(of) : undefined) ?? "blue",
        format: cfg?.format,
        axis: cfg?.axis ?? "left",
        compare: cfg?.compare && keys.includes(cfg.compare) ? cfg.compare : undefined,
        inverted: cfg?.inverted ?? false,
        ghost: of !== undefined,
      }
    })
  }, [rows, index, config, sparkline, palette])

  // Only the visible series set the scale, stack, and fill the tooltip and the data table.
  const series = React.useMemo(() => allSeries.filter((s) => !hidden.includes(s.key)), [allSeries, hidden])

  const seriesByKey = React.useMemo(
    () => Object.fromEntries(allSeries.map((s) => [s.key, s])),
    [allSeries],
  )

  const toggleSeries = React.useCallback(
    (key: string) => {
      if (hidden.includes(key)) setHidden(hidden.filter((k) => k !== key))
      // The last series showing stays: an empty plot answers nothing.
      else if (series.length > 1) setHidden([...hidden, key])
    },
    [hidden, series.length, setHidden],
  )
  const isolateSeries = React.useCallback(
    (key: string) => {
      const alone = series.length === 1 && series[0].key === key
      setHidden(alone ? [] : allSeries.filter((s) => s.key !== key).map((s) => s.key))
    },
    [series, allSeries, setHidden],
  )
  // A series and its ghost (the period it compares against) stay lit together.
  const isDimmed = React.useCallback(
    (key: string) => {
      if (focused == null || focused === key) return false
      return seriesByKey[focused]?.compare !== key && seriesByKey[key]?.compare !== focused
    },
    [focused, seriesByKey],
  )

  // Tween the geometry for a moment when the data or the visible series change (a period switch, a
  // legend toggle), and only then, so dragging the window never drags the chart behind it. Tracked
  // during render (like `lastActive` below), cleared by a timer.
  const signature = `${hidden.join("|")}`
  const [seen, setSeen] = React.useState({ rows, signature })
  const [morph, setMorph] = React.useState(false)
  if (seen.rows !== rows || seen.signature !== signature) {
    setSeen({ rows, signature })
    setMorph(true)
  }
  React.useEffect(() => {
    if (!morph) return
    const timer = window.setTimeout(() => setMorph(false), duration.slow + duration.fast)
    return () => window.clearTimeout(timer)
  }, [morph, seen])

  const partialCount = partial === true ? 1 : typeof partial === "number" ? Math.max(0, Math.floor(partial)) : 0
  const partialFrom = partialCount > 0 && rows.length > 0 ? Math.max(0, rows.length - partialCount) : null

  // A sparkline plots points edge to edge. Once it draws bars it lays its categories out in bands,
  // like a full chart (so the first and last bars keep their whole width), and anchors to zero.
  const barSparkline = sparkline && barLayers > 0
  const pointLayout = sparkline && !barSparkline
  const fixedDomain = Array.isArray(domainProp) ? domainProp : null
  const fit = domainProp === "fit"

  // Raw extent over a series SUBSET (so each axis scales to its own series); stacked sums per
  // category. The zero anchor (or the fit) is applied by `makeScale`.
  const extentOf = React.useCallback(
    (subset: ResolvedSeries[]): [number, number] => {
      let min = Infinity
      let max = -Infinity
      if (stack) {
        for (const row of rows) {
          let pos = 0
          let neg = 0
          for (const s of subset) {
            const v = row[s.key]
            if (typeof v !== "number") continue
            if (v >= 0) pos += v
            else neg += v
          }
          if (pos > max) max = pos
          if (neg < min) min = neg
        }
      } else {
        for (const row of rows)
          for (const s of subset) {
            const v = row[s.key]
            if (typeof v !== "number") continue // skip gaps so they don't drag the domain to 0
            if (v < min) min = v
            if (v > max) max = v
          }
      }
      if (!Number.isFinite(max)) return [0, 1] // no numeric data
      return [Number.isFinite(min) ? min : 0, max]
    },
    [rows, stack],
  )

  // Full charts round the domain to "nice" bounds + a tick step (0, 2k, 4k…), so the axis reads
  // cleanly and grid lines land on round values: 0-anchored by default, around the data with "fit".
  // Sparklines (tight, or 0-anchored once they draw bars) and an explicit `domain` skip nicing.
  const makeScale = React.useCallback(
    (ext: [number, number], allowProp: boolean): { domain: [number, number]; ticks: number[] | null } => {
      if (allowProp && fixedDomain) return { domain: fixedDomain, ticks: null }
      if (pointLayout) return { domain: ext, ticks: null }
      if (sparkline) return { domain: [Math.min(0, ext[0]), Math.max(0, ext[1])], ticks: null }
      return niceDomain(ext, fit ? "fit" : "zero")
    },
    [fixedDomain, pointLayout, sparkline, fit],
  )

  const hasRight = React.useMemo(() => series.some((s) => s.axis === "right"), [series])
  // Left axis scales the primary series (or all of them when nothing is on the right).
  const leftScale = React.useMemo(
    () => makeScale(extentOf(series.filter((s) => s.axis !== "right")), true),
    [makeScale, extentOf, series],
  )
  const rightScale = React.useMemo(
    () => makeScale(extentOf(series.filter((s) => s.axis === "right")), false),
    [makeScale, extentOf, series],
  )
  const domain = leftScale.domain
  const niceTicks = leftScale.ticks
  const domainRight = rightScale.domain
  const niceTicksRight = rightScale.ticks

  // Plot insets. Sparkline bleeds to the bottom/sides; a 2px top guards the peak cap.
  const plotInsets: Insets = sparkline
    ? { top: 2, right: 0, bottom: 0, left: 0, ...padding }
    : { top: 8, right: 8, bottom: 8, left: 8, ...padding }
  // Annotation markers sit in a lane above the plot, so the plot steps down to make room for it.
  if (annotations > 0) plotInsets.top += ANNOTATION_LANE

  const plot = {
    ...plotInsets,
    width: Math.max(0, size.width - plotInsets.left - plotInsets.right),
    height: Math.max(0, size.height - plotInsets.top - plotInsets.bottom),
  }
  const ready = plot.width > 0 && plot.height > 0 && rows.length > 0

  const n = rows.length
  const band = pointLayout ? (n > 1 ? plot.width / (n - 1) : plot.width) : plot.width / Math.max(n, 1)

  const xFor = React.useCallback(
    (i: number) =>
      pointLayout
        ? plot.left + (n > 1 ? (i / (n - 1)) * plot.width : plot.width / 2)
        : plot.left + (i + 0.5) * band,
    [pointLayout, n, plot.left, plot.width, band],
  )
  // One scale factory for both axes: maps a value to a y-pixel against the given domain.
  const scaleFor = React.useCallback(
    (d: [number, number]) => (v: number) =>
      plot.top + (1 - (v - d[0]) / (d[1] - d[0] || 1)) * plot.height,
    [plot.top, plot.height],
  )
  const yFor = React.useMemo(() => scaleFor(domain), [scaleFor, domain])
  const yForRight = React.useMemo(() => scaleFor(domainRight), [scaleFor, domainRight])

  const tickFor = React.useCallback(
    (nice: number[] | null, d: [number, number]) => (count: number) => {
      // Full charts share ONE nice tick set (so grid lines and y-labels always align, regardless of
      // the requested count); sparklines/custom domains fall back to even division.
      if (nice) return nice
      return Array.from({ length: count + 1 }, (_, i) => d[0] + ((d[1] - d[0]) * i) / count)
    },
    [],
  )
  const ticks = React.useMemo(() => tickFor(niceTicks, domain), [tickFor, niceTicks, domain])
  const ticksRight = React.useMemo(
    () => tickFor(niceTicksRight, domainRight),
    [tickFor, niceTicksRight, domainRight],
  )

  // Controlled when `activeIndex` is passed (null included); otherwise the chart owns hover.
  const controlled = activeIndex !== undefined
  const active = controlled ? activeIndex : activeState
  const setActive = React.useCallback(
    (i: number | null) => {
      if (i === active) return
      if (!controlled) setActiveState(i)
      onActiveIndexChange?.(i)
    },
    [active, controlled, onActiveIndexChange],
  )

  // Remember the last hovered index during render (lint-safe: no effect, no ref) so
  // the crosshair and active dot can fade out where they were rather than vanishing.
  // Converges in one re-render: once `lastActive` matches `active` the check is false.
  if (active != null && active !== lastActive) setLastActive(active)

  const slots = chartVariants()

  // The crosshair is owned by the root (not ChartTooltip) so it paints BEHIND every data layer:
  // the line and any markers always sit on top of the tracking line. Defaults off for sparklines.
  const showCrosshair = (crosshair ?? !sparkline) && !pie
  // Frozen on the last column so the crosshair fades out in place, never jumping.
  const crosshairX = xFor(active ?? lastActive)

  // Value baseline: bars and areas grow from y(0) (clamped into the plot) so negative values read
  // below it. A line sparkline has a tight, non-0-anchored domain, so it falls back to the plot floor.
  const floor = plot.top + plot.height
  const baseline = pointLayout ? floor : Math.max(plot.top, Math.min(floor, yFor(0)))
  const baselineRight = pointLayout ? floor : Math.max(plot.top, Math.min(floor, yForRight(0)))

  const isEmpty = !loading && rows.length === 0

  return (
    <ChartProvider
      data={rows}
      index={index}
      series={series}
      seriesByKey={seriesByKey}
      domain={domain}
      plot={plot}
      ready={ready}
      sparkline={sparkline}
      animate={animate}
      stacked={stack}
      xFor={xFor}
      yFor={yFor}
      yForRight={yForRight}
      hasRight={hasRight}
      baseline={baseline}
      baselineRight={baselineRight}
      ink={ink}
      band={band}
      ticks={ticks}
      ticksRight={ticksRight}
      active={active}
      lastActive={lastActive}
      setActive={setActive}
      registerBars={registerBars}
      highlights={highlights}
      markHighlight={markHighlight}
      allSeries={allSeries}
      hidden={hidden}
      toggleSeries={toggleSeries}
      isolateSeries={isolateSeries}
      focused={focused}
      setFocused={setFocused}
      isDimmed={isDimmed}
      morph={morph}
      partialFrom={partialFrom}
      pie={pie}
      registerPie={registerPie}
      funnel={funnel}
      registerFunnel={registerFunnel}
      registerAnnotation={registerAnnotation}
      slots={htmlSlots}
      measure={measure}
    >
      <ChartHostBridge>
      <div
        ref={refProp}
        data-slot="chart"
        className={slots.root({ className })}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* The legend slots: empty (and collapsed) until a ChartLegend portals into one. */}
        <div ref={setTopSlot} data-slot="chart-legend-top" className="empty:hidden" />
        <div ref={plotRef} data-slot="chart-plot" className={slots.plot()}>
        {loading ? (
          // Loading: a placeholder fills the plot; the SVG (and its parts) stay unmounted.
          <Skeleton data-slot="chart-skeleton" className="absolute inset-0 size-full rounded-lg" />
        ) : isEmpty ? (
          // Empty: a centered message in place of the plot.
          <div
            data-slot="chart-empty"
            className="absolute inset-0 flex items-center justify-center p-4 text-center"
          >
            {empty ?? <p className="text-sm text-muted-foreground">No data to display</p>}
          </div>
        ) : (
          <svg
            className={slots.svg()}
            width={size.width || undefined}
            height={size.height || undefined}
            // The SVG is decorative for AT: screen readers read the data table below instead.
            aria-hidden
            // Clearing on leave lives in a handler: no synchronous render setState.
            onPointerLeave={() => setActive(null)}
          >
            {/* Crosshair first => it sits behind the grid, area, line, and markers. The area fades to
                transparent, so the tracking line still reads through it without ever covering data. */}
            {ready && showCrosshair && (
              <line
                data-slot="chart-crosshair"
                x1={crosshairX}
                x2={crosshairX}
                y1={plot.top}
                y2={plot.top + plot.height}
                strokeDasharray="4 4"
                className={cn(
                  "origin-center stroke-border [transform-box:fill-box]",
                  "transition-[opacity,scale] duration-fast ease-out",
                  active != null ? "scale-y-100 opacity-100" : "scale-y-90 opacity-0",
                )}
              />
            )}
            {ready ? children : null}
          </svg>
        )}
        </div>
        <div ref={setBottomSlot} data-slot="chart-legend-bottom" className="empty:hidden" />

        {/* Accessible alternative: a visually-hidden data table is the real semantic content for
            screen readers (the SVG is aria-hidden). Skipped for chromeless sparklines, which are
            decorative and labelled by their surrounding context (e.g. a Stat's value). */}
        {!loading && !isEmpty && !sparkline && (
          <table data-slot="chart-table" className="sr-only">
            {label && <caption>{label}</caption>}
            <thead>
              <tr>
                <th scope="col">{index ?? "Point"}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <th scope="row">{String((index ? row[index] : i + 1) ?? i + 1)}</th>
                  {series.map((s) => {
                    const v = row[s.key]
                    return <td key={s.key}>{typeof v === "number" ? NUMBER.format(v) : ""}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Annotation text for assistive tech (the markers live in the aria-hidden SVG). */}
        <div ref={setSrSlot} data-slot="chart-notes" className="sr-only" />
      </div>
      </ChartHostBridge>
    </ChartProvider>
  )
}

/** Re-provides the chart's context through the optional {@link ChartHostContext}. */
function ChartHostBridge({ children }: { children: React.ReactNode }) {
  const context = useChartContext("Chart")
  return <ChartHostContext.Provider value={context}>{children}</ChartHostContext.Provider>
}

/* ------------------------------------------------------------------ helpers --- */

/** Height of the lane above the plot that {@link ChartAnnotation} markers sit in. */
const ANNOTATION_LANE = 24

/**
 * A bar's outline as a path, square where it meets the baseline and rounded only at its value end
 * (`top` for a bar rising from the baseline, `bottom` for one hanging below it, `none` for a stacked
 * segment another sits on). One command shape for every case, so a bar that changes height or
 * rounding tweens instead of jumping.
 */
function barPath(x: number, y: number, w: number, h: number, radius: number, round: "top" | "bottom" | "none"): string {
  const width = Math.max(0, w)
  const height = Math.max(0, h)
  const r = round === "none" ? 0 : Math.max(0, Math.min(radius, width / 2, height))
  const t = round === "top" ? r : 0
  const b = round === "bottom" ? r : 0
  const x1 = x + width
  const y1 = y + height
  return [
    `M${x},${y + t}`,
    `A${t},${t} 0 0 1 ${x + t},${y}`,
    `H${x1 - t}`,
    `A${t},${t} 0 0 1 ${x1},${y + t}`,
    `V${y1 - b}`,
    `A${b},${b} 0 0 1 ${x1 - b},${y1}`,
    `H${x + b}`,
    `A${b},${b} 0 0 1 ${x},${y1 - b}`,
    "Z",
  ].join(" ")
}

/** The percent change from `previous` to `value`, or null when there is no fair base. */
function changeOf(value: number, previous: unknown): number | null {
  if (typeof previous !== "number" || previous === 0) return null
  return (value - previous) / Math.abs(previous)
}

/** The category label at row `i`, as the axis and the tooltip heading print it by default. */
function categoryOf(row: ChartDatum | undefined, index: string | undefined, i: number): string | number {
  return (index ? row?.[index] : i + 1) ?? i + 1
}

/**
 * Two clip regions split at `x`: everything left of it and everything right of it, generously
 * padded so strokes and markers near the edges never clip. A line or an area draws twice through
 * them (solid, then dashed or faded) so an in-progress stretch keeps the exact curve of the whole.
 */
function SplitClips({ x, ids }: { x: number; ids: [string, string] }) {
  const reach = 100000
  return (
    <defs>
      <clipPath id={ids[0]}>
        <rect x={-reach} y={-reach} width={reach + x} height={reach * 2} />
      </clipPath>
      <clipPath id={ids[1]}>
        <rect x={x} y={-reach} width={reach} height={reach * 2} />
      </clipPath>
    </defs>
  )
}

/**
 * The fill for an in-progress bar: the series hue as fine diagonal hatching over a faint wash.
 * Defined inside the series group, so `currentColor` resolves to that series' hue.
 */
function HatchPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
        <rect width={6} height={6} fill="currentColor" fillOpacity={0.16} />
        <rect width={2} height={6} fill="currentColor" fillOpacity={0.6} />
      </pattern>
    </defs>
  )
}

/** Split a series into runs of plotted indices. A non-numeric value is a gap that ends a run, unless
 *  `connectNulls` bridges it (the run carries on to the next valid point). */
function runsOf(data: ChartDatum[], key: string, connectNulls: boolean): number[][] {
  const runs: number[][] = []
  let run: number[] = []
  data.forEach((row, i) => {
    if (typeof row[key] === "number") run.push(i)
    else if (!connectNulls && run.length) {
      runs.push(run)
      run = []
    }
  })
  if (run.length) runs.push(run)
  return runs
}

/** Build the line `d` for a series. A non-numeric value is a gap: by default it BREAKS the line into
 *  separate subpaths (the next valid point starts a fresh `M`); `connectNulls` bridges across the gap
 *  instead. `curve` joins each run's points straight or as a monotone cubic. */
function linePath(
  data: ChartDatum[],
  key: string,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  connectNulls = false,
  curve: ChartCurve = "linear",
): string {
  return runsOf(data, key, connectNulls)
    .map((run) => curveThrough(run.map((i) => ({ x: xFor(i), y: yFor(data[i][key] as number) })), curve))
    .join(" ")
}

/** Build the filled-area `d`: each contiguous run of valid points is closed down to `baseline`
 *  (the y(0) line), so gaps leave holes (unless `connectNulls`) and negatives fill below it. */
function areaPath(
  data: ChartDatum[],
  key: string,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  baseline: number,
  connectNulls = false,
  curve: ChartCurve = "linear",
): string {
  return runsOf(data, key, connectNulls)
    .map((run) => {
      const first = xFor(run[0])
      const last = xFor(run[run.length - 1])
      const edge = curveThrough(run.map((i) => ({ x: xFor(i), y: yFor(data[i][key] as number) })), curve, "L")
      return `M${first},${baseline} ${edge} L${last},${baseline} Z`
    })
    .join(" ")
}

/** Build a (possibly stacked) area's filled band + its top-edge line in one pass. The band's top
 *  edge follows the series' upper value; its bottom edge is the cumulative below it when stacked, or
 *  the y-zero baseline otherwise. Gaps break both (unless `connectNulls`). Both edges take the same
 *  `curve`, so a stacked band's floor is exactly the curve of the band beneath it. */
function buildAreaPaths(
  data: ChartDatum[],
  series: ResolvedSeries[],
  key: string,
  xFor: (i: number) => number,
  yFor: (v: number) => number,
  baseline: number,
  stacked: boolean,
  connectNulls: boolean,
  curve: ChartCurve = "linear",
): { band: string; line: string } {
  const bands: string[] = []
  const lines: string[] = []
  for (const run of runsOf(data, key, connectNulls)) {
    const tops: Point[] = []
    const bots: Point[] = []
    for (const i of run) {
      const x = xFor(i)
      if (stacked) {
        // A run only holds numeric values, so the stacked range always exists.
        const r = stackedRange(data, series, i, key) as [number, number]
        tops.push({ x, y: yFor(Math.max(r[0], r[1])) })
        bots.push({ x, y: yFor(Math.min(r[0], r[1])) })
      } else {
        const yv = yFor(data[i][key] as number)
        tops.push({ x, y: Math.min(yv, baseline) })
        bots.push({ x, y: Math.max(yv, baseline) })
      }
    }
    bands.push(
      `M${tops[0].x},${tops[0].y} ${curveThrough(tops, curve, "L")} ${curveThrough(bots, curve, "L", true)} Z`,
    )
    lines.push(curveThrough(tops, curve))
  }
  return { band: bands.join(" "), line: lines.join(" ") }
}

/** The value-space `[start, end]` a series occupies in a stack at row `i`: the same-sign running
 *  total of the series listed before it. Drives stacked bars and stacked areas. Returns null for a
 *  gap. */
function stackedRange(
  data: ChartDatum[],
  series: ResolvedSeries[],
  i: number,
  key: string,
): [number, number] | null {
  const v = data[i]?.[key]
  if (typeof v !== "number") return null
  let base = 0
  for (const s of series) {
    if (s.key === key) break
    const sv = data[i]?.[s.key]
    // Stack same-sign values, so positives pile up and negatives pile down independently.
    if (typeof sv === "number" && sv >= 0 === v >= 0) base += sv
  }
  return [base, base + v]
}

/** Whether series `key` is the last same-sign segment of the stack at row `i` (its value end is the
 *  column's outer edge, so it is the one that rounds). */
function isOuterSegment(data: ChartDatum[], series: ResolvedSeries[], i: number, key: string): boolean {
  const v = data[i]?.[key]
  if (typeof v !== "number") return false
  const at = series.findIndex((s) => s.key === key)
  for (const s of series.slice(at + 1)) {
    const sv = data[i]?.[s.key]
    if (typeof sv === "number" && sv !== 0 && sv >= 0 === v >= 0) return false
  }
  return true
}

/** Wrap children in a `<g>` carrying the series' hue as `currentColor`. `dimmed` recedes the whole
 *  series while another one holds the focus. */
function SeriesGroup({
  color,
  dimmed = false,
  className,
  children,
  ...props
}: { color: ChartColor; dimmed?: boolean } & React.ComponentProps<"g">) {
  return (
    <g
      className={cn(
        SERIES_TEXT[color],
        "transition-opacity duration-fast ease-out",
        dimmed && "opacity-25",
        className,
      )}
      {...props}
    >
      {children}
    </g>
  )
}

/* -------------------------------------------------------------------- parts --- */

export interface ChartLineProps extends Omit<React.ComponentProps<"path">, "d"> {
  /** Which series to plot. Defaults to the lone `value` series. */
  dataKey?: string
  /** Override the resolved hue. */
  color?: ChartColor
  strokeWidth?: number
  /** Hide the dot that marks the hovered point. */
  hideActiveDot?: boolean
  /** Bridge across missing (non-numeric) points instead of breaking the line at the gap. */
  connectNulls?: boolean
  /** Render the line dashed (for projected / forecast data). Skips the self-draw reveal. */
  dashed?: boolean
  /** Always mark the last point with a filled dot (a "current value" marker). */
  markEnd?: boolean
  /**
   * How the line joins its points: straight segments, or a `monotone` cubic that runs smooth through
   * every point without overshooting a peak or a trough. Match it on the `ChartArea` underneath.
   * @default "linear"
   */
  curve?: ChartCurve
  /**
   * `comparison` draws the faint, thin, dashed reference a previous period reads as, the way
   * Mixpanel overlays "compare to previous". It is the default for a series another one names in
   * its config `compare`, so a comparison line usually needs nothing set.
   */
  variant?: "default" | "comparison"
}

export function ChartLine({
  dataKey = "value",
  color,
  strokeWidth,
  hideActiveDot = false,
  connectNulls = false,
  dashed = false,
  markEnd = false,
  curve = "linear",
  variant,
  className,
  ...props
}: ChartLineProps) {
  const { data, seriesByKey, xFor, yFor, yForRight, active, lastActive, animate, hidden, isDimmed, morph, partialFrom } =
    useChartContext("ChartLine")
  const clipId = React.useId()
  if (hidden.includes(dataKey)) return null
  const series = seriesByKey[dataKey]
  const ghost = (variant ?? (series?.ghost ? "comparison" : "default")) === "comparison"
  const hue = color ?? series?.color ?? "blue"
  // Series on the right axis scale against its domain.
  const sy = series?.axis === "right" ? yForRight : yFor
  const d = linePath(data, dataKey, xFor, sy, connectNulls, curve)
  // Freeze on the last hovered point so the marker can scale + fade out *in place*
  // (principle 7) rather than unmounting and popping. `shown` drives the in/out.
  const idx = active ?? lastActive
  const mv = data[idx]?.[dataKey] as number | undefined
  const shown = active != null && typeof mv === "number"
  const dash = ghost ? "4 4" : dashed ? "6 5" : undefined
  // A dashed line can't also self-draw (the draw reuses stroke-dasharray), so it appears statically.
  const draw = animate && !dash
  // Last point with a numeric value, for the optional end marker.
  let endIdx = -1
  for (let i = data.length - 1; i >= 0; i--) {
    if (typeof data[i]?.[dataKey] === "number") {
      endIdx = i
      break
    }
  }
  // The in-progress stretch runs dashed from the last complete point. A line that is dashed anyway
  // has nothing to split.
  const split = !dash && partialFrom != null && endIdx >= partialFrom
  const seamX = split ? xFor(Math.max(0, (partialFrom as number) - 1)) : 0
  const clips: [string, string] = [`${clipId}-done`, `${clipId}-open`]
  const width = strokeWidth ?? (ghost ? 1.5 : 2)
  const stroke = {
    d,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: width,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  // While the chart morphs (a period switch, a series shown or hidden), the path tweens to its new
  // shape instead of jumping.
  const tween = morph && "transition-[d] duration-base ease-out"

  return (
    <SeriesGroup color={hue} dimmed={isDimmed(dataKey)} data-slot="chart-line" data-variant={ghost ? "comparison" : undefined}>
      {split && <SplitClips x={seamX} ids={clips} />}
      <path
        {...stroke}
        strokeDasharray={dash}
        // pathLength normalizes the trend to length 1 so stroke-dashoffset 1→0 draws it end-to-end.
        pathLength={draw ? 1 : undefined}
        clipPath={split ? `url(#${clips[0]})` : undefined}
        className={cn(
          ghost && "opacity-55",
          draw && "[stroke-dasharray:1] animate-chart-draw motion-reduce:animate-none",
          tween,
          className,
        )}
        {...props}
      />
      {split && (
        // The same curve again, dashed, clipped to the open period: it lands as the draw finishes.
        <path
          {...stroke}
          strokeDasharray="2 5"
          clipPath={`url(#${clips[1]})`}
          className={cn(
            animate && "animate-in fade-in-0 fill-mode-both duration-base ease-out motion-reduce:animate-none",
            tween,
            className,
          )}
          style={animate ? { animationDelay: `${duration.slow}ms` } : undefined}
        />
      )}
      {markEnd && endIdx >= 0 && (
        <circle
          cx={xFor(endIdx)}
          cy={sy(data[endIdx][dataKey] as number)}
          r={4}
          // Filled dot in the series hue, with a background ring so it pops off the line.
          className="fill-current stroke-background"
          strokeWidth={2}
        />
      )}
      {!hideActiveDot && typeof mv === "number" && (
        <circle
          cx={xFor(idx)}
          cy={sy(mv)}
          // A comparison marks its point smaller, so the current period's dot stays the one to read.
          r={ghost ? 3 : 4}
          strokeWidth={ghost ? 1.5 : 2}
          className={cn(
            "origin-center fill-background stroke-current [transform-box:fill-box]",
            // v4: scale-* sets the standalone `scale` property, so name it (not `transform`).
            "transition-[opacity,scale] duration-fast ease-out",
            shown ? "scale-100 opacity-100" : "scale-[0.25] opacity-0",
          )}
        />
      )}
    </SeriesGroup>
  )
}

export interface ChartAreaProps extends Omit<React.ComponentProps<"path">, "d"> {
  dataKey?: string
  color?: ChartColor
  /** Bridge across missing (non-numeric) points instead of leaving a hole at the gap. */
  connectNulls?: boolean
  /** How the top edge joins its points; match the `ChartLine` drawn over it. @default "linear" */
  curve?: ChartCurve
}

export function ChartArea({
  dataKey = "value",
  color,
  connectNulls = false,
  curve = "linear",
  className,
  ...props
}: ChartAreaProps) {
  const {
    data,
    seriesByKey,
    xFor,
    yFor,
    yForRight,
    baseline,
    baselineRight,
    sparkline,
    animate,
    hidden,
    isDimmed,
    morph,
    partialFrom,
  } = useChartContext("ChartArea")
  const gradientId = React.useId()
  if (hidden.includes(dataKey)) return null
  const hue = color ?? seriesByKey[dataKey]?.color ?? "blue"
  const onRight = seriesByKey[dataKey]?.axis === "right"
  const sy = onRight ? yForRight : yFor
  const base = onRight ? baselineRight : baseline
  // Each segment is closed down to the y(0) baseline (the plot floor for sparklines).
  const area = areaPath(data, dataKey, xFor, sy, base, connectNulls, curve)
  if (!area) return null
  // The open period's wash fades to half, under the dashed stretch of its line.
  let last = -1
  for (let i = data.length - 1; i >= 0; i--) {
    if (typeof data[i]?.[dataKey] === "number") {
      last = i
      break
    }
  }
  const split = partialFrom != null && last >= partialFrom
  const clips: [string, string] = [`${gradientId}-done`, `${gradientId}-open`]
  const fill = {
    d: area,
    fill: `url(#${gradientId})`,
    className: cn(
      // scaleY grows from the plot floor (origin-bottom); fill-box anchors it to the path bbox.
      animate && "origin-bottom [transform-box:fill-box] animate-chart-area motion-reduce:animate-none",
      morph && "transition-[d] duration-base ease-out",
      className,
    ),
  }

  return (
    <SeriesGroup color={hue} dimmed={isDimmed(dataKey)} data-slot="chart-area">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {/* currentColor inherits the series hue; opacity fades to the baseline. */}
          <stop offset="0%" stopColor="currentColor" stopOpacity={sparkline ? 0.18 : 0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {split && <SplitClips x={xFor(Math.max(0, (partialFrom as number) - 1))} ids={clips} />}
      <path {...fill} clipPath={split ? `url(#${clips[0]})` : undefined} {...props} />
      {split && <path {...fill} clipPath={`url(#${clips[1]})`} opacity={0.45} />}
    </SeriesGroup>
  )
}

export interface ChartAreasProps extends React.ComponentProps<"g"> {
  /** Series keys to draw, in order (bottom of the stack first). Defaults to every series. */
  keys?: string[]
  /** Bridge across missing (non-numeric) points instead of leaving a hole at the gap. */
  connectNulls?: boolean
  /** How every band's edges join their points. Stacked bands share one curve per seam. @default "linear" */
  curve?: ChartCurve
}

/**
 * ChartAreas: several area series at once. Set `stack` on {@link Chart} to stack them into a band
 * chart (each series sits on the cumulative total below it, as a flat translucent wash under its
 * full-strength edge line); without it they overlap from the baseline like layered {@link ChartArea}s. Each band
 * carries its own top-edge line. For a single area, reach for {@link ChartArea} + {@link ChartLine}.
 */
export function ChartAreas({
  keys,
  connectNulls = false,
  curve = "linear",
  className,
  ...props
}: ChartAreasProps) {
  const {
    data,
    series,
    seriesByKey,
    xFor,
    yFor,
    yForRight,
    baseline,
    baselineRight,
    animate,
    stacked,
    hidden,
    isDimmed,
    morph,
    partialFrom,
  } = useChartContext("ChartAreas")
  const drawKeys = (keys ?? series.map((s) => s.key)).filter((key) => !hidden.includes(key))
  // One useId base; per-series gradients derive a suffix (no hooks in the map).
  const gradientBase = React.useId()
  // The open period (see Chart `partial`) splits every band at the last complete category.
  const split = partialFrom != null && partialFrom < data.length
  const clips: [string, string] = [`${gradientBase}-done`, `${gradientBase}-open`]
  const tween = morph && "transition-[d] duration-base ease-out"

  return (
    <g data-slot="chart-areas" className={className} {...props}>
      {split && <SplitClips x={xFor(Math.max(0, (partialFrom as number) - 1))} ids={clips} />}
      {drawKeys.map((key, j) => {
        const hue = seriesByKey[key]?.color ?? "blue"
        const onRight = seriesByKey[key]?.axis === "right"
        const { band, line } = buildAreaPaths(
          data,
          series,
          key,
          xFor,
          onRight ? yForRight : yFor,
          onRight ? baselineRight : baseline,
          stacked,
          connectNulls,
          curve,
        )
        if (!band) return null
        const gid = `${gradientBase}-${j}`
        const bandProps = {
          d: band,
          fill: `url(#${gid})`,
          className: cn(
            animate && "origin-bottom [transform-box:fill-box] animate-chart-area motion-reduce:animate-none",
            tween,
          ),
        }
        const lineProps = {
          d: line,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round" as const,
          strokeLinejoin: "round" as const,
        }
        return (
          <SeriesGroup key={key} color={hue} dimmed={isDimmed(key)}>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                {/* Stacked bands are flat washes: next to each other a fade would muddy one shade into
                    the next, and a solid slab swallows the edge line. Bands never overlap, so a
                    translucent tint stays clean while the full-strength line marks each seam.
                    Overlapping areas stay airy, fading to the baseline. */}
                <stop offset="0%" stopColor="currentColor" stopOpacity={stacked ? 0.32 : 0.22} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={stacked ? 0.32 : 0} />
              </linearGradient>
            </defs>
            <path {...bandProps} clipPath={split ? `url(#${clips[0]})` : undefined} />
            {split && <path {...bandProps} clipPath={`url(#${clips[1]})`} opacity={0.45} />}
            <path
              {...lineProps}
              pathLength={animate ? 1 : undefined}
              clipPath={split ? `url(#${clips[0]})` : undefined}
              className={cn(animate && "[stroke-dasharray:1] animate-chart-draw motion-reduce:animate-none", tween)}
            />
            {split && (
              <path
                {...lineProps}
                strokeDasharray="2 5"
                clipPath={`url(#${clips[1]})`}
                className={cn(
                  animate && "animate-in fade-in-0 fill-mode-both duration-base ease-out motion-reduce:animate-none",
                  tween,
                )}
                style={animate ? { animationDelay: `${duration.slow}ms` } : undefined}
              />
            )}
          </SeriesGroup>
        )
      })}
    </g>
  )
}

export interface ChartBarProps extends Omit<React.ComponentProps<"path">, "d"> {
  dataKey?: string
  color?: ChartColor
  /** Bar width as a fraction of the category band (0–1). */
  barRatio?: number
  /**
   * Corner radius in px, at the bar's value end only: a bar stands square on its baseline. 8 is
   * `--radius-sm`, the one radius every data bar in the system shares (Ranking's too). @default 8
   */
  radius?: number
  /**
   * Print each bar's value just past its end (above a positive bar, below a negative one). Return
   * any inline content, so a figure can carry a glyph (a crown on the week's best). Give the Chart
   * a `padding.top` of about 24px so the tallest label has room.
   */
  label?: (value: number, index: number) => React.ReactNode
  /**
   * Paint chosen bars in `highlightColor` instead of the series hue, in one series: a category index
   * (today), a list of them, `"active"` (the bar under the pointer), or a predicate that also gets
   * the active index, so `(row, i, active) => i === (active ?? last)` keeps the latest bar lit until
   * another is hovered. Swapping the highlight recolors bars in place; it never replays the grow-in.
   * An `"active"` highlight is the hover feedback, so the other bars do not also dim.
   */
  highlight?: ChartBarHighlight
  /** The hue a highlighted bar takes. @default "brand" */
  highlightColor?: ChartColor
}

/** Height of the box a bar's value label sits in, and its gap to the bar end. */
const BAR_LABEL_HEIGHT = 16
const BAR_LABEL_GAP = 6

/** Whether bar `i` wears the highlight. */
function isHighlighted(
  highlight: ChartBarHighlight | undefined,
  row: ChartDatum,
  i: number,
  active: number | null,
): boolean {
  if (highlight === undefined) return false
  if (highlight === "active") return active === i
  if (typeof highlight === "number") return highlight === i
  if (Array.isArray(highlight)) return highlight.includes(i)
  return highlight(row, i, active)
}

export function ChartBar({
  dataKey = "value",
  color,
  barRatio = 0.62,
  radius = 8,
  label,
  highlight,
  highlightColor = "brand",
  className,
  ...props
}: ChartBarProps) {
  const {
    data,
    seriesByKey,
    xFor,
    yFor,
    yForRight,
    baseline,
    baselineRight,
    band,
    active,
    animate,
    registerBars,
    markHighlight,
    hidden,
    isDimmed,
    morph,
    partialFrom,
  } = useChartContext("ChartBar")
  const hatchId = React.useId()
  // Tell the root a bar is drawn, so a sparkline lays out bands and anchors its scale to zero.
  React.useLayoutEffect(registerBars, [registerBars])
  // Publish the lit categories (as a stable string, so an inline predicate never re-publishes an
  // unchanged set) for the tooltip swatch to match the bar.
  const lit =
    highlight === undefined
      ? ""
      : data
          .flatMap((row, i) => (typeof row[dataKey] === "number" && isHighlighted(highlight, row, i, active) ? [i] : []))
          .join(",")
  React.useLayoutEffect(() => {
    if (!lit) return
    return markHighlight(dataKey, highlightColor, lit.split(",").map(Number))
  }, [markHighlight, dataKey, highlightColor, lit])
  if (hidden.includes(dataKey)) return null
  const hue = color ?? seriesByKey[dataKey]?.color ?? "blue"
  const onRight = seriesByKey[dataKey]?.axis === "right"
  const sy = onRight ? yForRight : yFor
  const base = onRight ? baselineRight : baseline
  const width = band * barRatio
  const n = data.length
  const dims = highlight !== "active"

  return (
    <SeriesGroup color={hue} dimmed={isDimmed(dataKey)} data-slot="chart-bar">
      {partialFrom != null && <HatchPattern id={hatchId} />}
      {data.map((row, i) => {
        const v = row[dataKey]
        if (typeof v !== "number") return null
        // Span from the value to the baseline, so positives rise above it and negatives drop below.
        const y = sy(v)
        const top = Math.min(y, base)
        const h = Math.abs(y - base)
        const negative = v < 0
        const delay = `${(i / Math.max(n, 1)) * duration.slow}ms`
        const on = isHighlighted(highlight, row, i, active)
        const ink = on ? highlightColor : hue
        // A period still in progress hatches, so its short bar never reads as a drop.
        const open = partialFrom != null && i >= partialFrom
        return (
          <React.Fragment key={i}>
            <path
              d={barPath(xFor(i) - width / 2, top, width, h, radius, negative ? "bottom" : "top")}
              {...props}
              fill={open ? `url(#${hatchId})` : undefined}
              // Non-active bars sit back; the hovered one comes forward. `fill-current`
              // ties the bar to the series hue, or to the highlight hue on a lit bar (its own
              // `text-*` over the group's, so a swap recolors in place and the grow-in holds).
              className={cn(
                !open && "fill-current",
                morph
                  ? "transition-[opacity,color,d] duration-base ease-out"
                  : "transition-[opacity,color] duration-fast ease-out",
                on && SERIES_TEXT[highlightColor],
                active === i && !on && barLift(hue),
                active != null && active !== i && dims ? barDim(ink) : "opacity-100",
                // Grow from the baseline edge: up for positives (origin-bottom), down for negatives.
                animate &&
                  cn(
                    negative ? "origin-top" : "origin-bottom",
                    "[transform-box:fill-box] animate-chart-bar motion-reduce:animate-none",
                  ),
                className,
              )}
              // Spread the column cascade left→right across the line-draw window (delays, not durations).
              style={animate ? { animationDelay: delay, ...props.style } : props.style}
            />
            {label && (
              // HTML in a foreignObject, so a label can hold an icon beside its figure. It spans the
              // whole category band and centers on the bar; it never takes the pointer, so the
              // tooltip bands underneath keep working through it.
              <foreignObject
                x={xFor(i) - band / 2}
                y={negative ? top + h + BAR_LABEL_GAP : top - BAR_LABEL_GAP - BAR_LABEL_HEIGHT}
                width={band}
                height={BAR_LABEL_HEIGHT}
                className="pointer-events-none overflow-visible"
              >
                <div
                  data-slot="chart-bar-label"
                  className={cn(
                    "flex h-full items-center justify-center gap-1 whitespace-nowrap text-[11px] font-medium leading-none tabular-nums text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
                    // The label lands once its bar has grown: same cascade delay, a fade instead of a rise.
                    animate && "animate-in fade-in-0 fill-mode-both duration-slow ease-out motion-reduce:animate-none",
                  )}
                  style={animate ? { animationDelay: delay } : undefined}
                >
                  {label(v, i)}
                </div>
              </foreignObject>
            )}
          </React.Fragment>
        )
      })}
    </SeriesGroup>
  )
}

export interface ChartBarsProps extends Omit<React.ComponentProps<"path">, "d"> {
  /** Series keys to draw, in order. Defaults to every series in the chart. */
  keys?: string[]
  /** Total group width as a fraction of the category band (0–1). @default 0.7 */
  barRatio?: number
  /** Corner radius in px, at each bar's value end (a stack rounds only its outer segment). @default 8 */
  radius?: number
}

/**
 * ChartBars: several bar series sharing each category band. Set `stack` on {@link Chart} to pile the
 * segments from the y-zero baseline (same sign stacks together); otherwise the series render grouped
 * side by side. For a single series, reach for {@link ChartBar}.
 */
export function ChartBars({ keys, barRatio = 0.7, radius = 8, className, ...props }: ChartBarsProps) {
  const {
    data,
    series,
    seriesByKey,
    xFor,
    yFor,
    yForRight,
    baseline,
    baselineRight,
    band,
    active,
    animate,
    stacked,
    registerBars,
    hidden,
    isDimmed,
    morph,
    partialFrom,
  } = useChartContext("ChartBars")
  const hatchBase = React.useId()
  // Tell the root bars are drawn, so a sparkline lays out bands and anchors its scale to zero.
  React.useLayoutEffect(registerBars, [registerBars])
  // A hidden series gives up its slot, so the group closes ranks around the rest.
  const drawKeys = (keys ?? series.map((s) => s.key)).filter((key) => !hidden.includes(key))
  const count = Math.max(drawKeys.length, 1)
  const groupWidth = band * barRatio
  const slot = groupWidth / count
  // Grouped bars get a slot each (with a small inner gap); stacked bars share the full group width.
  const barWidth = stacked ? groupWidth : slot * 0.82
  // A hairline seam between stacked segments reads as a clean segmented column.
  const segGap = stacked ? 2 : 0
  const n = data.length

  return (
    <g data-slot="chart-bars">
      {drawKeys.map((key, j) => {
        const onRight = seriesByKey[key]?.axis === "right"
        const sy = onRight ? yForRight : yFor
        const base = onRight ? baselineRight : baseline
        const hue = seriesByKey[key]?.color ?? "blue"
        // A comparison series (the previous period) stands beside its partner, faint.
        const ghost = !stacked && seriesByKey[key]?.ghost
        const hatchId = `${hatchBase}-${j}`
        return (
        <SeriesGroup key={key} color={hue} dimmed={isDimmed(key)} opacity={ghost ? 0.4 : undefined}>
          {partialFrom != null && <HatchPattern id={hatchId} />}
          {data.map((row, i) => {
            const v = row[key]
            if (typeof v !== "number") return null
            const negative = v < 0
            let top: number
            let h: number
            let round: "top" | "bottom" | "none" = negative ? "bottom" : "top"
            if (stacked) {
              const r = stackedRange(data, series, i, key)
              if (!r) return null
              const ya = sy(r[0])
              const yb = sy(r[1])
              top = Math.min(ya, yb)
              // The seam opens on the side facing the baseline, so the first segment still stands on it.
              const seam = r[0] === 0 ? 0 : segGap
              h = Math.max(0, Math.abs(ya - yb) - seam)
              if (negative) top += seam
              // Only the segment at the end of the stack rounds; the rest butt against their neighbours.
              if (!isOuterSegment(data, series, i, key)) round = "none"
            } else {
              // Each bar spans value → baseline, so positives rise and negatives drop.
              const yv = sy(v)
              top = Math.min(yv, base)
              h = Math.abs(yv - base)
            }
            const x = stacked
              ? xFor(i) - groupWidth / 2
              : xFor(i) - groupWidth / 2 + j * slot + (slot - barWidth) / 2
            const open = partialFrom != null && i >= partialFrom
            return (
              <path
                key={i}
                d={barPath(x, top, barWidth, h, radius, round)}
                {...props}
                fill={open ? `url(#${hatchId})` : undefined}
                className={cn(
                  !open && "fill-current",
                  morph
                    ? "transition-[opacity,color,d] duration-base ease-out"
                    : "transition-[opacity,color] duration-fast ease-out",
                  active === i && barLift(hue),
                  active != null && active !== i ? barDim(hue) : "opacity-100",
                  // Grow from the baseline edge: up for positives, down for negatives.
                  animate &&
                    cn(
                      negative ? "origin-top" : "origin-bottom",
                      "[transform-box:fill-box] animate-chart-bar motion-reduce:animate-none",
                    ),
                  className,
                )}
                // Per-category cascade (delay, not duration); every series at a column moves together.
                style={
                  animate
                    ? { animationDelay: `${(i / Math.max(n, 1)) * duration.slow}ms`, ...props.style }
                    : props.style
                }
              />
            )
          })}
        </SeriesGroup>
        )
      })}
    </g>
  )
}

export interface ChartGridProps extends React.ComponentProps<"g"> {
  /** Number of horizontal bands (default 4). */
  rows?: number
  /** Also draw a vertical line per category. */
  showVertical?: boolean
  /**
   * Draw the zero line a step stronger than the rest of the grid, so bars stand on a floor and a
   * series that crosses zero reads against it. Only when zero falls inside the domain. @default true
   */
  baseline?: boolean
}

export function ChartGrid({ rows = 4, showVertical = false, baseline = true, className, ...props }: ChartGridProps) {
  const { plot, ticks, data, xFor, yFor } = useChartContext("ChartGrid")
  const left = plot.left
  const right = plot.left + plot.width
  return (
    <g data-slot="chart-grid" className={cn("stroke-border", className)} {...props}>
      {ticks(rows).map((t, i) => {
        const y = yFor(t)
        return (
          <line
            key={`h${i}`}
            x1={left}
            x2={right}
            y1={y}
            y2={y}
            data-baseline={baseline && t === 0 ? "" : undefined}
            className={baseline && t === 0 ? "stroke-foreground/20" : undefined}
          />
        )
      })}
      {showVertical &&
        data.map((_, i) => (
          <line key={`v${i}`} x1={xFor(i)} x2={xFor(i)} y1={plot.top} y2={plot.top + plot.height} />
        ))}
    </g>
  )
}

export interface ChartAxisProps extends React.ComponentProps<"g"> {
  /** Format a category label. */
  tickFormatter?: (value: string | number, index: number) => string
  /**
   * Skip labels to avoid crowding. A number renders every Nth label, counted from the first.
   * `"auto"` measures the labels against the plot's width and keeps the fewest skips at which none
   * collide, counted back from the LAST category so the latest period always carries its name. It
   * re-thins as the chart resizes, so one axis reads on a phone and a wide screen alike.
   * @default 1
   */
  interval?: number | "auto"
  /**
   * With `interval="auto"`: the minimum clear space between two neighbouring labels, in px, measured
   * against the widest label. 12px keeps 11 to 12px axis figures apart without thinning a week or a
   * year out of a third-width card. @default 12
   */
  minTickGap?: number
  /**
   * With `interval="auto"`: never label more often than every Nth category, however wide the plot
   * (7 keeps a month of days reading by the week). @default 1
   */
  minInterval?: number
  /**
   * An axis title centered under the tick labels, naming what the categories are ("Close date ·
   * Month"). Give the Chart about 24px more `padding.bottom` for it.
   */
  label?: string
}

/** How far an axis title sits past its tick labels. */
const AXIS_TITLE_GAP = 20

export function ChartXAxis({
  tickFormatter,
  interval = 1,
  minTickGap = 12,
  minInterval = 1,
  label: title,
  className,
  ref,
  ...props
}: ChartAxisProps) {
  const { data, index, xFor, plot, band, active } = useChartContext("ChartXAxis")
  const baseline = plot.top + plot.height
  const auto = interval === "auto"
  const labels = data.map((row, i) => {
    const raw = (index ? row[index] : i + 1) ?? i + 1
    return tickFormatter ? tickFormatter(raw, i) : String(raw)
  })

  // "auto" renders every label (the skipped ones hidden) so the widest can be measured, then picks
  // the step from that width. A layout effect, so the thinned axis is what paints first.
  const groupRef = React.useRef<SVGGElement>(null)
  const axisRef = useMergedRef(groupRef, ref)
  const [labelWidth, setLabelWidth] = React.useState(0)
  const signature = auto ? labels.join("\n") : ""
  React.useLayoutEffect(() => {
    const group = groupRef.current
    if (!auto || !group) return
    let live = true
    const measure = () => {
      if (!live) return
      let widest = 0
      group.querySelectorAll<SVGTextElement>("text:not([data-slot=chart-axis-title])").forEach((text) => {
        if (typeof text.getComputedTextLength === "function") {
          widest = Math.max(widest, text.getComputedTextLength())
        }
      })
      setLabelWidth((prev) => (Math.abs(prev - widest) < 0.5 ? prev : widest))
    }
    measure()
    // Web fonts can land after the first measure and widen every label.
    document.fonts?.ready.then(measure)
    return () => {
      live = false
    }
  }, [auto, signature, className])
  const step = auto ? autoTickInterval(data.length, band, labelWidth, minTickGap, minInterval) : interval

  return (
    <g
      ref={axisRef}
      data-slot="chart-x-axis"
      // tabular-nums: categories are often figures (days, hours, years), and a row of ticks reads
      // evenly only when each label's digits hold one width.
      className={cn("fill-muted-foreground text-[11px] tabular-nums", className)}
      {...props}
    >
      {labels.map((label, i) => {
        const shown = auto ? tickShownFromEnd(i, data.length, step) : i % interval === 0
        if (!shown && !auto) return null
        return (
          <text
            key={i}
            x={xFor(i)}
            y={baseline + 16}
            textAnchor="middle"
            visibility={shown ? undefined : "hidden"}
            // The hovered category's tick steps up to the foreground, naming the column under the
            // pointer while the rest stay muted.
            className={cn("transition-[fill] duration-fast ease-out", active === i && "fill-foreground")}
          >
            {label}
          </text>
        )
      })}
      {title && (
        <text
          data-slot="chart-axis-title"
          x={plot.left + plot.width / 2}
          y={baseline + 16 + AXIS_TITLE_GAP}
          textAnchor="middle"
          className="text-xs font-medium"
        >
          {title}
        </text>
      )}
    </g>
  )
}

export interface ChartYAxisProps extends React.ComponentProps<"g"> {
  /** Number of ticks (default 4). */
  count?: number
  /** Format a tick. Defaults to compact figures (12K, 1.4M). */
  tickFormatter?: (value: number) => string
  /** Which axis to label. `right` reads the secondary scale and sits on the right edge. */
  side?: "left" | "right"
  /**
   * An axis title, turned to run along the chart's outer edge ("Deals", "Revenue"). Give the Chart
   * about 20px more `padding.left` (or `right`) for it.
   */
  label?: string
}

export function ChartYAxis({ count = 4, tickFormatter, side = "left", label: title, className, ...props }: ChartYAxisProps) {
  const { ticks, ticksRight, yFor, yForRight, plot } = useChartContext("ChartYAxis")
  const right = side === "right"
  const scaleY = right ? yForRight : yFor
  const x = right ? plot.left + plot.width + 8 : plot.left - 8
  // The title hugs the outer edge of the SVG, centered on the plot, reading bottom to top on the left
  // (top to bottom on the right). Rotated with the SVG attribute, which turns about the given point.
  const titleX = right ? plot.left + plot.width + plot.right - 6 : 6
  const titleY = plot.top + plot.height / 2
  return (
    <g
      data-slot="chart-y-axis"
      // tabular-nums: these ticks stack into a column of figures, so the digits must hold one
      // width or the column's edge ripples and shifts as the domain rescales.
      className={cn("fill-muted-foreground text-[11px] tabular-nums", className)}
      {...props}
    >
      {(right ? ticksRight : ticks)(count).map((t, i) => (
        <text key={i} x={x} y={scaleY(t) + 3} textAnchor={right ? "start" : "end"}>
          {tickFormatter ? tickFormatter(t) : COMPACT.format(t)}
        </text>
      ))}
      {title && (
        <text
          data-slot="chart-axis-title"
          x={titleX}
          y={titleY}
          textAnchor="middle"
          // Hangs inward from the edge on either side: the rotation turns "below" toward the plot.
          dominantBaseline="text-before-edge"
          transform={`rotate(${right ? 90 : -90} ${titleX} ${titleY})`}
          className="text-xs font-medium"
        >
          {title}
        </text>
      )}
    </g>
  )
}

/* ---------------------------------------------------------------- reference --- */

export interface ChartReferenceLineProps extends Omit<React.ComponentProps<"line">, "x" | "y"> {
  /** Draw a horizontal line at this value (a threshold/goal). */
  y?: number
  /** Draw a vertical line at this category index. */
  x?: number
  /** Optional label rendered at the line's end. */
  label?: string
  /** Dashed (default) or solid. */
  variant?: "dashed" | "solid"
  /** Hue; defaults to a muted neutral so it reads as chrome, not data. */
  color?: ChartColor
}

/**
 * ChartReferenceLine: a horizontal threshold (`y`) or vertical marker (`x`) drawn across the plot,
 * with an optional end `label`. Compose it after the data parts so it annotates on top (e.g. a
 * "target" or "limit" line). Defaults to a muted dashed line; pass a `color` to emphasize it.
 */
export function ChartReferenceLine({
  y,
  x,
  label,
  variant = "dashed",
  color,
  className,
  ...props
}: ChartReferenceLineProps) {
  const { plot, xFor, yFor } = useChartContext("ChartReferenceLine")
  if (y == null && x == null) return null
  const left = plot.left
  const right = plot.left + plot.width
  const top = plot.top
  const bottom = plot.top + plot.height
  const isH = y != null
  const yPix = y != null ? yFor(y) : 0
  const xPix = xFor(x ?? 0)

  return (
    <g
      data-slot="chart-reference-line"
      className={cn(color ? SERIES_TEXT[color] : "text-muted-foreground", className)}
    >
      <line
        x1={isH ? left : xPix}
        x2={isH ? right : xPix}
        y1={isH ? yPix : top}
        y2={isH ? yPix : bottom}
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray={variant === "dashed" ? "5 4" : undefined}
        className="opacity-70"
        {...props}
      />
      {label && (
        <text
          x={isH ? right : xPix}
          y={isH ? yPix - 5 : top - 5}
          textAnchor={isH ? "end" : "middle"}
          className="fill-current text-[10px] font-medium"
        >
          {label}
        </text>
      )}
    </g>
  )
}

/* ------------------------------------------------------------------ tooltip --- */

function defaultFormat(v: number): string {
  return NUMBER.format(v)
}

/** A change as a signed percent: "+12.4%", "−3%" (a true minus sign, so the column aligns). */
function formatChange(change: number): string {
  const sign = change > 0 ? "+" : change < 0 ? "−" : ""
  return `${sign}${PERCENT.format(Math.abs(change))}`
}

export interface ChartTooltipProps {
  /** Format each series value in the bubble. */
  valueFormatter?: (value: number) => string
  /**
   * Format the heading. It gets the category label, then the whole row and its index, so a heading
   * can say more than the axis does (a full date, a weekday). Return text or inline content.
   */
  labelFormatter?: (value: string | number, datum: ChartDatum, index: number) => React.ReactNode
  /**
   * Extra rows under the series rows, below a hairline: a figure the chart does not draw, like the
   * net of income and expenses. Build each row with {@link ChartTooltipItem} so it lines up with the
   * series above. Return `null` to leave a category without one.
   */
  footer?: (datum: ChartDatum, index: number) => React.ReactNode
  /**
   * Order the series rows by their value at the hovered category, largest first (`desc`) or last
   * (`asc`), so the leader reads first however the lines cross. A comparison row stays under its
   * series. @default "none" (config order)
   */
  sort?: "none" | "desc" | "asc"
  /**
   * Add a total row under the series (comparison series left out): `true` labels it "Total", a
   * string names it. For stacked bars and areas, where the column's sum is the figure people want.
   */
  total?: boolean | string
  /** Show at most this many series rows; the rest fold into a "+N more" line. For wide breakdowns. */
  maxItems?: number
  /** What the heading says for a category still in progress (see Chart `partial`). @default "In progress" */
  partialLabel?: React.ReactNode
  /** Classes merged onto the shared tooltip bubble. */
  className?: string
}

export interface ChartTooltipItemProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The swatch hue. Omit it for a row without a swatch; the label still lines up with the rest. */
  color?: ChartColor
  /** What the row measures, in the muted ink. */
  label: React.ReactNode
  /** The figure, right-aligned in the foreground. */
  value: React.ReactNode
  /** A change to print before the value, as a fraction (0.12 prints "+12%"): green up, red down. */
  change?: number | null
  /** Down is good for this figure: a fall prints green, a rise red. */
  inverted?: boolean
  /** A comparison row (the previous period): its swatch draws faint, like its line. */
  ghost?: boolean
  /** Recede the row, because another series holds the focus. */
  dimmed?: boolean
}

/**
 * ChartTooltipItem: one row of the chart's hover bubble (a swatch, a label, a right-aligned value,
 * and optionally the change against a previous period). {@link ChartTooltip} draws a row per series
 * with it; use it in the tooltip's `footer` to add a row of your own that reads as part of the list.
 */
export function ChartTooltipItem({
  color,
  label,
  value,
  change,
  inverted = false,
  ghost = false,
  dimmed = false,
  className,
  ...props
}: ChartTooltipItemProps) {
  // Read optionally: a CategoryBar's tooltip uses the same rows without a Chart around them.
  const ink = React.useContext(ChartHostContext)?.ink ?? ""
  const slots = chartVariants()
  const good = change != null && (inverted ? change < 0 : change > 0)
  const bad = change != null && (inverted ? change > 0 : change < 0)
  return (
    <span
      data-slot="chart-tooltip-item"
      className={cn(
        "flex items-center gap-2 text-xs transition-opacity duration-fast ease-out",
        dimmed && "opacity-45",
        className,
      )}
      {...props}
    >
      {/* The bubble is portaled, so a `current`-hued swatch can't inherit the chart's color via CSS
          (`bg-current` would read black); use the captured ink instead. */}
      <span
        className={cn(
          slots.swatch(),
          color && color !== "current" && SERIES_BG[color],
          ghost && "opacity-40",
        )}
        style={color === "current" ? { backgroundColor: ink || "currentColor" } : undefined}
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto flex items-baseline gap-2 pl-4">
        {change != null && (
          <span
            data-slot="chart-tooltip-change"
            className={cn(
              "text-[11px] font-medium",
              good ? "text-success-strong" : bad ? "text-destructive-strong" : "text-muted-foreground",
            )}
          >
            {formatChange(change)}
          </span>
        )}
        <span className="font-medium text-popover-foreground">{value}</span>
      </span>
    </span>
  )
}

/**
 * ChartTooltip: the hover layer. A full-height transparent band per category is the tooltip trigger;
 * all bands share ONE {@link TooltipGroup} bubble that glides between columns. The bands paint last,
 * on top, so they reliably catch the pointer. The tracking crosshair is owned by the {@link Chart}
 * root (so it paints behind the data); each ChartLine/Bar lights its own point.
 */
export function ChartTooltip({
  valueFormatter = defaultFormat,
  labelFormatter,
  footer,
  sort = "none",
  total,
  maxItems,
  partialLabel = "In progress",
  className,
}: ChartTooltipProps) {
  const { data, index, series, xFor, plot, band, setActive, highlights, isDimmed, partialFrom, funnel, pie } =
    useChartContext("ChartTooltip")
  // A pie hovers its own slices.
  if (pie) return null
  const slots = chartVariants()
  const left = plot.left
  const top = plot.top
  const bottom = plot.top + plot.height

  return (
    <g data-slot="chart-tooltip">
      {/* A data card, not a hint: the graph variant keeps it on the popover surface its ink is
          tuned for (muted labels, popover-foreground values). */}
      <TooltipGroup variant="graph" className={cn("px-2.5 py-2", className)} offset={[0, 10]}>
        {data.map((row, i) => {
          const heading = labelFormatter
            ? labelFormatter(categoryOf(row, index, i), row, i)
            : String(categoryOf(row, index, i))
          const extra = footer?.(row, i)
          const open = partialFrom != null && i >= partialFrom

          // One group per series, with its comparison (the previous period) right under it.
          const plotted = series.filter((s) => typeof row[s.key] === "number")
          const groups: ResolvedSeries[][] = []
          const placed = new Set<string>()
          for (const s of plotted) {
            if (placed.has(s.key)) continue
            if (s.ghost && plotted.some((p) => p.compare === s.key)) continue
            const group = [s]
            placed.add(s.key)
            const partner = s.compare ? plotted.find((p) => p.key === s.compare) : undefined
            if (partner) {
              group.push(partner)
              placed.add(partner.key)
            }
            groups.push(group)
          }
          if (sort !== "none") {
            const dir = sort === "desc" ? -1 : 1
            groups.sort((a, b) => dir * ((row[a[0].key] as number) - (row[b[0].key] as number)))
          }
          const ordered = groups.flat()
          const shown = maxItems != null ? ordered.slice(0, Math.max(0, maxItems)) : ordered
          const folded = ordered.length - shown.length
          const sum = plotted.filter((s) => !s.ghost).reduce((acc, s) => acc + (row[s.key] as number), 0)

          // A funnel step reads as its conversion from the first step and its drop from the one before.
          const step = funnel != null && i > 0 ? row[funnel] : null
          const first = funnel != null ? data[0]?.[funnel] : null
          const before = funnel != null ? data[i - 1]?.[funnel] : null
          const funnelRows =
            typeof step === "number" && typeof first === "number" && typeof before === "number" && first > 0 && before > 0
              ? { converted: step / first, dropped: before - step, dropRate: (before - step) / before }
              : null

          const content = (
            <div className={slots.tooltip()}>
              <span className="flex items-center justify-between gap-4 text-[11px] font-medium text-muted-foreground">
                <span>{heading}</span>
                {open && (
                  <span data-slot="chart-tooltip-partial" className="font-normal text-muted-foreground/80">
                    {partialLabel}
                  </span>
                )}
              </span>
              {shown.map((s) => {
                const v = row[s.key] as number
                // A bar painted in its highlight hue gets a swatch in that hue, matching what's drawn.
                const lit = highlights[s.key]
                return (
                  <ChartTooltipItem
                    key={s.key}
                    color={lit?.indices.includes(i) ? lit.color : s.color}
                    label={s.label}
                    // Per-series formatter (config.format) wins, else the shared valueFormatter.
                    value={(s.format ?? valueFormatter)(v)}
                    change={s.compare ? changeOf(v, row[s.compare]) : null}
                    inverted={s.inverted}
                    ghost={s.ghost}
                    dimmed={isDimmed(s.key)}
                  />
                )
              })}
              {folded > 0 && (
                <span data-slot="chart-tooltip-more" className="pl-4.5 text-[11px] text-muted-foreground">
                  +{folded} more
                </span>
              )}
              {funnelRows && (
                <>
                  <TooltipSeparator />
                  <ChartTooltipItem label="Converted" value={PERCENT.format(funnelRows.converted)} />
                  <ChartTooltipItem
                    label="Dropped off"
                    value={`${PERCENT.format(funnelRows.dropRate)} · ${valueFormatter(funnelRows.dropped)}`}
                  />
                </>
              )}
              {total && plotted.length > 1 && (
                <>
                  <TooltipSeparator />
                  <ChartTooltipItem
                    data-slot="chart-tooltip-total"
                    label={typeof total === "string" ? total : "Total"}
                    value={valueFormatter(sum)}
                  />
                </>
              )}
              {extra != null && extra !== false && (
                <>
                  <TooltipSeparator />
                  <div data-slot="chart-tooltip-footer" className="flex flex-col gap-1.5">
                    {extra}
                  </div>
                </>
              )}
            </div>
          )
          // Band centered on the point; clamped so edge bands stay inside the plot.
          const bx = Math.max(left, xFor(i) - band / 2)
          const bw = Math.min(plot.left + plot.width - bx, band)
          return (
            <Tooltip key={i} content={content} placement="top">
              <rect
                x={bx}
                y={top}
                width={bw}
                height={Math.max(0, bottom - top)}
                className="fill-transparent"
                onPointerEnter={() => setActive(i)}
              />
            </Tooltip>
          )
        })}
      </TooltipGroup>
    </g>
  )
}

/* ------------------------------------------------------------------- legend --- */

export interface ChartLegendItem {
  label: string
  color?: ChartColor
  /** A figure printed after the label in the foreground (a series total), so the key doubles as a summary. */
  value?: React.ReactNode
  /** Inside a Chart: the series this entry keys, so it can focus and toggle it. */
  dataKey?: string
}

/** A figure a legend inside a chart can print after each series: summarised from the data. */
export type ChartLegendValue = "last" | "sum" | "average" | ((key: string) => React.ReactNode)

export interface ChartLegendProps extends React.ComponentProps<"div"> {
  /** Derive entries from the same `config` you pass to {@link Chart} (label + color per key). */
  config?: ChartConfig
  /** Or pass entries explicitly. Takes precedence over `config` (and, inside a Chart, over its series). */
  items?: ChartLegendItem[]
  /** Horizontal alignment of the row. @default "start" */
  align?: "start" | "center" | "end"
  /** Inside a Chart: whether the key sits above the plot or below it. @default "top" */
  placement?: "top" | "bottom"
  /**
   * Inside a Chart: hovering a key focuses its series (the rest recede), clicking one hides or shows
   * it, and Alt+click shows it alone. Set `false` for a static key. @default true
   */
  interactive?: boolean
  /** Inside a Chart: show at most this many keys; the rest move into a "+N more" menu. */
  max?: number
  /**
   * Inside a Chart: a figure after each label, summarised from the data (`last`, `sum`,
   * `average`) or returned per series key. Formatted with the series' own `format`.
   */
  value?: ChartLegendValue
}

const LEGEND_ALIGN: Record<NonNullable<ChartLegendProps["align"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
}

interface LegendEntry {
  id: string
  label: string
  color: ChartColor
  value?: React.ReactNode
  /** The series (or, for a pie, the slice index) it controls; absent for a static entry. */
  dataKey?: string
  slice?: number
  ghost: boolean
  hidden: boolean
}

/** The figure a legend prints for series `key`. */
function summarise(value: ChartLegendValue, data: ChartDatum[], key: string, format?: (v: number) => string) {
  if (typeof value === "function") return value(key)
  const values = data.map((row) => row[key]).filter((v): v is number => typeof v === "number")
  if (!values.length) return null
  const figure =
    value === "last"
      ? values[values.length - 1]
      : value === "sum"
        ? values.reduce((a, b) => a + b, 0)
        : values.reduce((a, b) => a + b, 0) / values.length
  return (format ?? defaultFormat)(figure)
}

/**
 * ChartLegend: the key. Outside a chart it is a plain HTML row fed the same `config` (or `items`).
 * Placed INSIDE a {@link Chart}, it lists the chart's own series (or a pie's slices), sits in a slot
 * above or below the plot (the plot gives up the height), and becomes the chart's control surface:
 * hover a key and its series comes forward while the rest recede, click to hide or show it (the
 * scale refits), Alt+click to see it alone. Past `max` keys, the rest fold into a "+N more" menu.
 */
export function ChartLegend({
  config,
  items,
  align = "start",
  placement = "top",
  interactive = true,
  max,
  value,
  className,
  ...props
}: ChartLegendProps) {
  const host = React.useContext(ChartHostContext)
  const slot = host ? (placement === "bottom" ? host.slots.bottom : host.slots.top) : null
  const measure = host?.measure

  let entries: LegendEntry[]
  if (items) {
    entries = items.map((item, i) => ({
      id: item.dataKey ?? `${i}`,
      label: item.label,
      color: item.color ?? (item.dataKey ? host?.seriesByKey[item.dataKey]?.color : undefined) ?? "blue",
      value: item.value,
      dataKey: item.dataKey && host?.seriesByKey[item.dataKey] ? item.dataKey : undefined,
      ghost: !!(item.dataKey && host?.seriesByKey[item.dataKey]?.ghost),
      hidden: !!(item.dataKey && host?.hidden.includes(item.dataKey)),
    }))
  } else if (host?.pie) {
    // A pie keys its categories, in the slices' hues.
    const colors = host.pie.colors
    entries = host.data.map((row, i) => ({
      id: `${i}`,
      label: String(categoryOf(row, host.index, i)),
      color: colors[i] ?? PALETTE[i % PALETTE.length],
      value: typeof value === "function" ? value(String(categoryOf(row, host.index, i))) : undefined,
      slice: i,
      ghost: false,
      hidden: false,
    }))
  } else if (host) {
    entries = host.allSeries.map((s) => ({
      id: s.key,
      label: s.label,
      color: s.color,
      value: value ? summarise(value, host.data, s.key, s.format) : undefined,
      dataKey: s.key,
      ghost: s.ghost,
      hidden: host.hidden.includes(s.key),
    }))
  } else {
    entries = config
      ? Object.entries(config).map(([key, cfg], i) => ({
          id: key,
          label: cfg.label ?? key,
          color: cfg.color ?? PALETTE[i % PALETTE.length],
          ghost: false,
          hidden: false,
        }))
      : []
  }

  // The legend takes height from the plot: re-measure as it lands, so the first paint already fits.
  const signature = entries.map((e) => e.id).join("|")
  React.useLayoutEffect(() => {
    if (slot) measure?.()
  }, [slot, measure, signature])

  if (!entries.length) return null
  if (host && !slot) return null

  const live = !!host && interactive
  const cap = live && max != null && entries.length > max ? Math.max(1, max) : entries.length
  const inline = entries.slice(0, cap)
  const overflow = entries.slice(cap)

  const row = (
    <div
      data-slot="chart-legend"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5",
        LEGEND_ALIGN[align],
        host && (placement === "bottom" ? "pt-3" : "pb-4"),
        className,
      )}
      {...props}
    >
      {inline.map((entry) => (
        <LegendKey key={entry.id} entry={entry} live={live} />
      ))}
      {overflow.length > 0 && <LegendOverflow entries={overflow} />}
    </div>
  )

  return slot ? createPortal(row, slot) : row
}

/** One key: a swatch and a label (and a figure). A button when the legend is live. */
function LegendKey({ entry, live, inMenu = false }: { entry: LegendEntry; live: boolean; inMenu?: boolean }) {
  const host = React.useContext(ChartHostContext)
  const slots = chartVariants()
  const controls = live && host && (entry.dataKey !== undefined || entry.slice !== undefined)
  const swatch = (
    <span
      aria-hidden
      className={cn(
        slots.swatch(),
        "transition-opacity duration-fast ease-out",
        entry.color !== "current" && SERIES_BG[entry.color],
        entry.ghost && "opacity-40",
        entry.hidden && "opacity-25",
      )}
      style={entry.color === "current" && host?.ink ? { backgroundColor: host.ink } : undefined}
    />
  )
  const text = (
    <>
      <span className={cn("truncate", entry.hidden && "line-through decoration-muted-foreground/60")}>
        {entry.label}
      </span>
      {entry.value != null && (
        <span className={cn("font-medium tabular-nums text-foreground", inMenu && "ml-auto pl-4")}>{entry.value}</span>
      )}
    </>
  )
  if (!controls) {
    return (
      <span data-slot="chart-legend-item" className={slots.legendItem()}>
        {swatch}
        {entry.value != null && !inMenu ? (
          <>
            {entry.label}:
            <span className="font-medium tabular-nums text-foreground">{entry.value}</span>
          </>
        ) : (
          text
        )}
      </span>
    )
  }

  const focus = () => {
    if (entry.slice !== undefined) host.setActive(entry.slice)
    else if (entry.dataKey && !entry.hidden) host.setFocused(entry.dataKey)
  }
  const blur = () => {
    if (entry.slice !== undefined) host.setActive(null)
    else host.setFocused(null)
  }
  const pressable = entry.dataKey !== undefined
  return (
    <button
      type="button"
      data-slot="chart-legend-item"
      data-hidden={entry.hidden ? "" : undefined}
      aria-pressed={pressable ? !entry.hidden : undefined}
      disabled={!pressable && entry.slice === undefined}
      onPointerEnter={focus}
      onPointerLeave={blur}
      // Keyboard focus lights the series too, but not the focus a menu hands its first key when it
      // opens under the pointer.
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) focus()
      }}
      onBlur={blur}
      onClick={(event) => {
        if (!entry.dataKey) return
        if (event.altKey) host.isolateSeries(entry.dataKey)
        else host.toggleSeries(entry.dataKey)
        // A key just switched off can't hold the focus it had under the pointer.
        host.setFocused(null)
      }}
      className={cn(
        slots.legendItem(),
        pressable ? "cursor-pointer" : "cursor-default",
        "hover:text-foreground focus-visible:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // A 40px-tall hit area around a 16px key, without moving it.
        "after:absolute after:-inset-x-1.5 after:-inset-y-3",
        entry.hidden && "text-muted-foreground/70",
        inMenu && "w-full rounded-sm px-2 py-1.5 hover:bg-accent after:hidden",
      )}
    >
      {swatch}
      {text}
    </button>
  )
}

/** The keys past `max`, behind a "+N more" chip that opens them in a menu. */
function LegendOverflow({ entries }: { entries: LegendEntry[] }) {
  const slots = chartVariants()
  return (
    <Popover>
      <PopoverTrigger
        data-slot="chart-legend-more"
        className={cn(
          slots.legendItem(),
          "cursor-pointer font-medium hover:text-foreground focus-visible:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "after:absolute after:-inset-x-1.5 after:-inset-y-3",
        )}
      >
        {/* The stacked swatches of what is folded: a hint of the hues inside. */}
        <span aria-hidden className="flex -space-x-1">
          {entries.slice(0, 3).map((entry) => (
            <span
              key={entry.id}
              className={cn(
                slots.swatch(),
                "ring-2 ring-[var(--surface,var(--background))]",
                entry.color !== "current" && SERIES_BG[entry.color],
              )}
            />
          ))}
        </span>
        +{entries.length} more
      </PopoverTrigger>
      {/* 8px in from the panel's 16px corner, so each rounded-sm (8px) row sits concentric. */}
      <PopoverContent align="start" className="flex w-56 flex-col gap-0.5 p-2">
        {entries.map((entry) => (
          <LegendKey key={entry.id} entry={entry} live inMenu />
        ))}
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------------------------------------- annotation --- */

export interface ChartAnnotationProps extends Omit<React.ComponentProps<"g">, "title"> {
  /** The category the note belongs to (its index in `data`). */
  index: number
  /** What the marker shows: a number or a letter (Mixpanel numbers them). Omit for a dot. */
  label?: React.ReactNode
  /** The note's headline, first line of its tooltip. */
  title: React.ReactNode
  /** More detail under the title. */
  description?: React.ReactNode
  /** The marker's hue. Defaults to the foreground, so a note reads as chrome, not data. */
  color?: ChartColor
}

/**
 * ChartAnnotation: a note pinned to one category, the way Mixpanel annotates a launch or an outage.
 * A marker sits in a lane above the plot (the plot steps down to make room) with a faint rule down
 * to the baseline; hovering the marker opens the note. Its text also reaches screen readers, beside
 * the chart's data table.
 */
export function ChartAnnotation({ index: at, label, title, description, color, className, ...props }: ChartAnnotationProps) {
  const { data, index, xFor, plot, registerAnnotation, slots, animate } = useChartContext("ChartAnnotation")
  React.useLayoutEffect(registerAnnotation, [registerAnnotation])
  if (at < 0 || at >= data.length) return null
  const x = xFor(at)
  const y = plot.top - ANNOTATION_LANE / 2 - 2
  const category = categoryOf(data[at], index, at)
  const size = 20
  const content = (
    <div className="flex max-w-60 flex-col gap-0.5 text-xs">
      <span className="text-[11px] font-medium text-muted-foreground">{String(category)}</span>
      <span className="font-medium text-popover-foreground">{title}</span>
      {description && <span className="text-pretty text-muted-foreground">{description}</span>}
    </div>
  )

  return (
    <g
      data-slot="chart-annotation"
      className={cn(color ? SERIES_TEXT[color] : "text-foreground", className)}
      {...props}
    >
      <line
        x1={x}
        x2={x}
        y1={y + size / 2}
        y2={plot.top + plot.height}
        stroke="currentColor"
        strokeDasharray="2 3"
        className="pointer-events-none opacity-25"
      />
      {/* An HTML marker, so it can carry any label and anchor our own Tooltip. The box is wide enough
          for a short word; only the marker itself takes the pointer. */}
      <foreignObject x={x - 60} y={y - size / 2} width={120} height={size} className="pointer-events-none overflow-visible">
        <div className="flex h-full items-center justify-center">
          <Tooltip variant="graph" content={content} placement="top" offset={[0, 8]}>
            <span
              data-slot="chart-annotation-marker"
              className={cn(
                "pointer-events-auto relative inline-flex h-5 min-w-5 cursor-default items-center justify-center rounded-full px-1.5",
                // A 40px target around a 20px marker, without moving it.
                "after:absolute after:-inset-2.5 after:rounded-full",
                "text-[11px] font-semibold leading-none tabular-nums text-background shadow-xs",
                color && color !== "current" ? SERIES_BG[color] : "bg-foreground",
                label == null && "h-2.5 min-w-2.5 px-0",
                animate && "animate-in fade-in-0 zoom-in-50 fill-mode-both duration-base ease-out motion-reduce:animate-none",
              )}
              style={animate ? { animationDelay: `${duration.slow}ms` } : undefined}
            >
              {label}
            </span>
          </Tooltip>
        </div>
      </foreignObject>
      {slots.sr &&
        createPortal(
          <p>
            {String(category)}: {title}
            {description ? <>. {description}</> : null}
          </p>,
          slots.sr,
        )}
    </g>
  )
}

/* ------------------------------------------------------------------- funnel --- */

export interface ChartFunnelProps extends Omit<React.ComponentProps<"path">, "d"> {
  /** The count at each step. */
  dataKey?: string
  color?: ChartColor
  /** Column width as a fraction of the step band (0–1). @default 0.62 */
  barRatio?: number
  /** Corner radius in px at the top of each column, the data-bar radius. @default 8 */
  radius?: number
  /**
   * The label over each step. By default its conversion from the first step ("62%"); return your own
   * content, or pass `false` for none. Give the Chart about 28px of `padding.top` for it.
   */
  label?: false | ((value: number, index: number, conversion: number) => React.ReactNode)
}

/**
 * ChartFunnel: conversion through ordered steps, the way Mixpanel and Attio draw a funnel. Each step
 * is a column; above it, a faint ghost rises to the step before, so the drop-off reads as the empty
 * part of the column. Each step carries its conversion from the first, and the tooltip adds the
 * conversion and drop-off rows by itself.
 */
export function ChartFunnel({
  dataKey = "value",
  color,
  barRatio = 0.62,
  radius = 8,
  label,
  className,
  ...props
}: ChartFunnelProps) {
  const { data, seriesByKey, xFor, yFor, baseline, band, active, animate, registerBars, registerFunnel, morph } =
    useChartContext("ChartFunnel")
  React.useLayoutEffect(registerBars, [registerBars])
  React.useLayoutEffect(() => registerFunnel(dataKey), [registerFunnel, dataKey])
  const hue = color ?? seriesByKey[dataKey]?.color ?? "blue"
  const width = band * barRatio
  const first = data[0]?.[dataKey]
  const n = data.length
  const tween = morph ? "transition-[opacity,d] duration-base ease-out" : "transition-opacity duration-fast ease-out"

  return (
    <SeriesGroup color={hue} data-slot="chart-funnel">
      {data.map((row, i) => {
        const v = row[dataKey]
        if (typeof v !== "number") return null
        const prev = i > 0 ? data[i - 1]?.[dataKey] : null
        const x = xFor(i) - width / 2
        const y = yFor(v)
        const h = Math.max(0, baseline - y)
        // The ghost: from this step up to the one before it, the share that dropped off.
        const lost = typeof prev === "number" && prev > v
        const ghostTop = lost ? yFor(prev) : y
        const conversion = typeof first === "number" && first > 0 ? v / first : 1
        const delay = `${(i / Math.max(n, 1)) * duration.slow}ms`
        const dim = active != null && active !== i
        return (
          <React.Fragment key={i}>
            {lost && (
              <path
                data-slot="chart-funnel-dropoff"
                d={barPath(x, ghostTop, width, y - ghostTop, radius, "top")}
                className={cn(
                  "fill-current",
                  tween,
                  dim ? "opacity-[0.06]" : "opacity-[0.14]",
                  animate && "animate-in fade-in-0 fill-mode-both duration-slow ease-out motion-reduce:animate-none",
                )}
                style={animate ? { animationDelay: delay } : undefined}
              />
            )}
            <path
              d={barPath(x, y, width, h, radius, lost ? "none" : "top")}
              {...props}
              className={cn(
                "fill-current",
                tween,
                dim ? "opacity-40" : "opacity-100",
                animate && "origin-bottom [transform-box:fill-box] animate-chart-bar motion-reduce:animate-none",
                className,
              )}
              style={animate ? { animationDelay: delay, ...props.style } : props.style}
            />
            {label !== false && (
              <foreignObject
                x={xFor(i) - band / 2}
                y={ghostTop - BAR_LABEL_GAP - 20}
                width={band}
                height={20}
                className="pointer-events-none overflow-visible"
              >
                <div
                  data-slot="chart-funnel-label"
                  className={cn(
                    "flex h-full items-center justify-center",
                    animate && "animate-in fade-in-0 fill-mode-both duration-slow ease-out motion-reduce:animate-none",
                  )}
                  style={animate ? { animationDelay: delay } : undefined}
                >
                  {label ? (
                    label(v, i, conversion)
                  ) : (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums text-foreground">
                      {PERCENT.format(conversion)}
                    </span>
                  )}
                </div>
              </foreignObject>
            )}
          </React.Fragment>
        )
      })}
    </SeriesGroup>
  )
}

/* ---------------------------------------------------------------------- pie --- */

export interface ChartPieProps extends Omit<React.ComponentProps<"g">, "children"> {
  /** The value each slice is sized by. Each data row is a slice; the Chart's `index` names it. */
  dataKey?: string
  /**
   * The hole, as a fraction of the radius: `0` draws a pie, anything above a donut. @default 0.62
   */
  innerRadius?: number
  /** Clear space between slices, in px. @default 2 */
  gap?: number
  /** Slice hues, in row order. Defaults to the chart palette, led by blue. */
  colors?: ChartColor[]
  /** Format the value in the slice tooltip. */
  valueFormatter?: (value: number) => string
  /** Show a tooltip per slice (its name, value and share). @default true */
  tooltip?: boolean
  /** Content for a donut's hole: a total, a label. Centered, and never in the pointer's way. */
  children?: React.ReactNode
}

/** A point on a circle, with 0 at twelve o'clock and angles running clockwise. */
function polar(cx: number, cy: number, r: number, a: number): string {
  return `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`
}

/** Each slice's start and end angle, running clockwise from twelve o'clock. */
function sliceAngles(values: number[], total: number): { i: number; v: number; a0: number; a1: number }[] {
  const shapes: { i: number; v: number; a0: number; a1: number }[] = []
  let angle = 0
  for (let i = 0; i < values.length; i++) {
    const turn = (values[i] / total) * Math.PI * 2
    // A lone slice stops a hair short of the full turn, so its arc still has two ends.
    shapes.push({ i, v: values[i], a0: angle, a1: angle + Math.min(turn, Math.PI * 2 - 1e-4) })
    angle += turn
  }
  return shapes
}

/** One ring sector from angle `a0` to `a1`, trimmed by `gap` px on each side. */
function slicePath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, gap: number): string {
  // The gap is a constant width, so it spans a smaller angle on the outer edge than on the inner.
  const outerPad = r1 > 0 ? gap / 2 / r1 : 0
  const innerPad = r0 > 0 ? gap / 2 / r0 : 0
  const mid = (a0 + a1) / 2
  const o0 = Math.min(a0 + outerPad, mid)
  const o1 = Math.max(a1 - outerPad, mid)
  const i0 = Math.min(a0 + innerPad, mid)
  const i1 = Math.max(a1 - innerPad, mid)
  const largeOuter = o1 - o0 > Math.PI ? 1 : 0
  const largeInner = i1 - i0 > Math.PI ? 1 : 0
  const outer = `M${polar(cx, cy, r1, o0)} A${r1},${r1} 0 ${largeOuter} 1 ${polar(cx, cy, r1, o1)}`
  if (r0 <= 0) return `${outer} L${cx},${cy} Z`
  return `${outer} L${polar(cx, cy, r0, i1)} A${r0},${r0} 0 ${largeInner} 0 ${polar(cx, cy, r0, i0)} Z`
}

/**
 * ChartPie: a pie or a donut (Attio's reports draw both). Each data row is a slice sized by
 * `dataKey`; slices run clockwise from twelve o'clock with a clean gap between them. Hovering one
 * lifts it out a step while the others recede, with a tooltip of its value and share; a
 * {@link ChartLegend} in the same chart keys the slices and lights them from the legend too. The
 * load reveal sweeps the ring round once.
 */
export function ChartPie({
  dataKey = "value",
  innerRadius = 0.62,
  gap = 2,
  colors,
  valueFormatter = defaultFormat,
  tooltip = true,
  className,
  children,
  ...props
}: ChartPieProps) {
  const { data, index, plot, active, setActive, animate, registerPie, seriesByKey, morph } = useChartContext("ChartPie")
  const maskId = React.useId()
  const hues = React.useMemo(
    () => data.map((_, i) => colors?.[i] ?? PALETTE[i % PALETTE.length]),
    [data, colors],
  )
  React.useLayoutEffect(() => registerPie(hues), [registerPie, hues])

  const values = data.map((row) => {
    const v = row[dataKey]
    return typeof v === "number" && v > 0 ? v : 0
  })
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const lift = 4
  const cx = plot.left + plot.width / 2
  const cy = plot.top + plot.height / 2
  const r1 = Math.max(0, Math.min(plot.width, plot.height) / 2 - lift)
  const r0 = r1 * Math.min(Math.max(innerRadius, 0), 0.95)
  const slices = values.filter((v) => v > 0).length
  const pad = slices > 1 ? gap : 0
  const label = seriesByKey[dataKey]?.label ?? dataKey
  const format = seriesByKey[dataKey]?.format ?? valueFormatter

  const shapes = sliceAngles(values, total)

  const slicesNode = shapes.map(({ i, v, a0, a1 }) => {
    if (v <= 0) return null
    const on = active === i
    const path = (
      <path
        key={i}
        d={slicePath(cx, cy, r0, on ? r1 + lift : r1, a0, a1, pad)}
        onPointerEnter={() => setActive(i)}
        className={cn(
          "fill-current",
          SERIES_TEXT[hues[i]],
          morph || active != null
            ? "transition-[opacity,d] duration-fast ease-out"
            : "transition-opacity duration-fast ease-out",
          active != null && !on && barDim(hues[i]),
        )}
      />
    )
    if (!tooltip) return path
    const heading = String(categoryOf(data[i], index, i))
    return (
      <Tooltip
        key={i}
        placement="top"
        content={
          <div className="flex flex-col gap-1.5 tabular-nums">
            <span className="text-[11px] font-medium text-muted-foreground">{heading}</span>
            <ChartTooltipItem color={hues[i]} label={label} value={format(v)} />
            <ChartTooltipItem label="Share" value={PERCENT.format(v / total)} />
          </div>
        }
      >
        {path}
      </Tooltip>
    )
  })

  return (
    <g data-slot="chart-pie" className={className} {...props} onPointerLeave={() => setActive(null)}>
      {animate && (
        // The reveal: a ring-shaped mask whose stroke draws round once, uncovering the slices.
        <defs>
          <mask id={maskId}>
            <circle
              cx={cx}
              cy={cy}
              r={(r1 + lift) / 2}
              fill="none"
              stroke="white"
              strokeWidth={r1 + lift + 2}
              pathLength={1}
              transform={`rotate(-90 ${cx} ${cy})`}
              className="[stroke-dasharray:1] animate-chart-draw motion-reduce:animate-none"
            />
          </mask>
        </defs>
      )}
      <g mask={animate ? `url(#${maskId})` : undefined}>
        {/* A transparent ring under the slices holds the pointer across the gaps between them, so
            gliding from one slice to the next never drops the hover for a frame. */}
        <path
          d={slicePath(cx, cy, r0, r1 + lift, 0, Math.PI * 2 - 1e-4, 0)}
          className="fill-transparent"
        />
        {tooltip ? (
          <TooltipGroup variant="graph" className="px-2.5 py-2" offset={[0, 10]}>
            {slicesNode}
          </TooltipGroup>
        ) : (
          slicesNode
        )}
      </g>
      {children != null && r0 > 0 && (
        <foreignObject
          x={cx - r0}
          y={cy - r0}
          width={r0 * 2}
          height={r0 * 2}
          className="pointer-events-none overflow-visible"
        >
          <div
            data-slot="chart-pie-center"
            className="flex size-full flex-col items-center justify-center text-center tabular-nums"
          >
            {children}
          </div>
        </foreignObject>
      )}
    </g>
  )
}
