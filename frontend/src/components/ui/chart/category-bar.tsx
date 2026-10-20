"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { createContext } from "@/lib/create-context"
import { tv, type VariantProps } from "@/lib/tv"
import { Tooltip, TooltipGroup } from "@/components/ui/tooltip"
import {
  chartFillClass,
  chartPalette,
  chartVariants,
  ChartTooltipItem,
  type ChartColor,
  type ChartDatum,
} from "./chart"

/**
 * CategoryBar: how one whole splits into its parts, as a single bar. Each row of `data` is a
 * category; its share of the total sets its segment's width, left to right, with a clean gap
 * between segments. Where a donut ({@link ChartPie}) spends a square on the same numbers, this
 * spends one line, so it sits under a KPI or across a card: credits by feature, storage by file
 * type, time by project. Compose {@link CategoryBarLegend} under it for the key and the shares.
 *
 * It shares the Chart's hues (the categorical rotation, or `palette="tonal"` for shades of the
 * house blue), swatches and tooltip rows, so a bar and a chart on one page read as one system.
 */
export const categoryBarVariants = tv({
  slots: {
    root: "flex w-full flex-col gap-4",
    // The rounded ends come from clipping the row of segments; the gaps between them are empty,
    // so the bar sits on any surface. The load reveal sweeps the clip open left to right.
    track:
      "flex w-full gap-0.5 overflow-hidden rounded-full transition-[clip-path] duration-slow ease-out motion-reduce:transition-none",
    // min-w keeps a sliver of a share visible instead of collapsing it into the gap.
    segment: "h-full min-w-1 transition-opacity duration-fast ease-out",
    legend: "flex flex-wrap items-center gap-x-5 gap-y-2",
    legendItem: "flex items-center gap-2 text-xs transition-opacity duration-fast ease-out",
    legendLabel: "font-medium text-foreground",
    legendValue: "tabular-nums text-muted-foreground",
  },
  variants: {
    /** The bar's thickness. */
    size: {
      sm: { track: "h-1.5" },
      md: { track: "h-2" },
      lg: { track: "h-3" },
    },
  },
  defaultVariants: { size: "md" },
})

interface CategoryItem {
  label: string
  value: number
  share: number
  color: ChartColor
}

interface CategoryBarContextValue {
  items: CategoryItem[]
  active: number | null
  setActive: (index: number | null) => void
  format: (value: number) => string
}

const [CategoryBarProvider, useCategoryBarContext] = createContext<CategoryBarContextValue>("CategoryBar")

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const PERCENT = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 })

/**
 * A share as a whole percent, the way a key prints it ("27%"). A share too small to round to 1%
 * still says it is there ("<1%") rather than claiming nothing.
 */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.005) return "<1%"
  return `${Math.round(share * 100)}%`
}

export interface CategoryBarProps
  extends Omit<React.ComponentProps<"div">, "children">,
    VariantProps<typeof categoryBarVariants> {
  /** One row per category. */
  data: ChartDatum[]
  /** The key holding each category's name. @default "label" */
  index?: string
  /** The key holding each category's amount. Shares are worked out from the total. @default "value" */
  dataKey?: string
  /** Segment hues, in row order. Defaults to the palette. Give "Other" `gray`. */
  colors?: ChartColor[]
  /**
   * The hues for categories `colors` leaves out: `categorical` rotates distinct hues, `tonal`
   * spreads shades of the house blue. @default "categorical"
   */
  palette?: "categorical" | "tonal"
  /** Format an amount in the tooltip (and in a legend showing values). */
  valueFormatter?: (value: number) => string
  /** Show a tooltip per segment: its name, amount and share. @default true */
  tooltip?: boolean
  /** Sweep the bar open left to right when it mounts. Honors reduced motion. @default true */
  animate?: boolean
  /**
   * What the bar breaks down ("Credits by feature"). It leads the bar's accessible name, which then
   * reads every category with its share.
   */
  label?: string
  /** Parts under the bar: a {@link CategoryBarLegend}. */
  children?: React.ReactNode
}

export function CategoryBar({
  data,
  index = "label",
  dataKey = "value",
  colors,
  palette = "categorical",
  valueFormatter,
  tooltip = true,
  animate = true,
  label,
  size,
  className,
  children,
  ...props
}: CategoryBarProps) {
  const [active, setActiveState] = React.useState<number | null>(null)
  const setActive = React.useCallback((i: number | null) => setActiveState(i), [])
  // Starts clipped shut and opens a frame after mount, so the sweep has a closed state to leave.
  const [open, setOpen] = React.useState(!animate)
  React.useEffect(() => {
    if (!animate) return
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOpen(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [animate])

  const items = React.useMemo<CategoryItem[]>(() => {
    const rows = data.filter((row) => typeof row[dataKey] === "number" && (row[dataKey] as number) > 0)
    const total = rows.reduce((sum, row) => sum + (row[dataKey] as number), 0)
    const hues = chartPalette(rows.length, palette)
    return rows.map((row, i) => ({
      label: String(row[index] ?? i + 1),
      value: row[dataKey] as number,
      share: total > 0 ? (row[dataKey] as number) / total : 0,
      color: colors?.[i] ?? hues[i],
    }))
  }, [data, index, dataKey, colors, palette])

  const format = valueFormatter ?? NUMBER.format
  const slots = categoryBarVariants({ size })
  const summary = items.map((item) => `${item.label} ${formatShare(item.share)}`).join(", ")

  const segments = items.map((item, i) => {
    const segment = (
      <div
        key={i}
        data-slot="category-bar-segment"
        className={cn(slots.segment(), chartFillClass(item.color), active != null && active !== i && "opacity-40")}
        // Grow from a zero basis: the free space (the bar less its gaps) splits exactly by share.
        style={{ flexGrow: item.value, flexBasis: 0 }}
        onPointerEnter={() => setActive(i)}
      />
    )
    if (!tooltip) return segment
    return (
      <Tooltip
        key={i}
        placement="top"
        content={
          <div className={chartVariants().tooltip()}>
            <ChartTooltipItem color={item.color} label={item.label} value={format(item.value)} />
            <ChartTooltipItem label="Share" value={PERCENT.format(item.share)} />
          </div>
        }
      >
        {segment}
      </Tooltip>
    )
  })

  return (
    <CategoryBarProvider items={items} active={active} setActive={setActive} format={format}>
      <div data-slot="category-bar" className={slots.root({ className })} {...props}>
        <div
          data-slot="category-bar-track"
          role="img"
          aria-label={label ? `${label}: ${summary}` : summary}
          className={cn(slots.track(), open ? "[clip-path:inset(0)]" : "[clip-path:inset(0_100%_0_0)]")}
          onPointerLeave={() => setActive(null)}
        >
          {tooltip ? (
            // One bubble glides from segment to segment, as it does across a chart's columns.
            <TooltipGroup variant="graph" className="px-2.5 py-2" offset={[0, 10]}>
              {segments}
            </TooltipGroup>
          ) : (
            segments
          )}
        </div>
        {children}
      </div>
    </CategoryBarProvider>
  )
}

export interface CategoryBarLegendProps extends React.ComponentProps<"ul"> {
  /**
   * What follows each name: its share (`27%`), its amount, both, or nothing.
   * @default "share"
   */
  value?: "share" | "value" | "both" | "none"
}

/**
 * CategoryBarLegend: the key under a {@link CategoryBar}, one entry per segment in its hue, with
 * the share after the name. Hovering an entry lights its segment and recedes the rest, the same as
 * hovering the segment. The bar's accessible name already reads every category, so the key is
 * hidden from assistive tech rather than read twice.
 */
export function CategoryBarLegend({ value = "share", className, ...props }: CategoryBarLegendProps) {
  const { items, active, setActive, format } = useCategoryBarContext("CategoryBarLegend")
  const slots = categoryBarVariants()
  const swatch = chartVariants().swatch()
  return (
    <ul data-slot="category-bar-legend" aria-hidden className={slots.legend({ className })} {...props}>
      {items.map((item, i) => (
        <li
          key={i}
          data-slot="category-bar-legend-item"
          className={cn(slots.legendItem(), active != null && active !== i && "opacity-40")}
          onPointerEnter={() => setActive(i)}
          onPointerLeave={() => setActive(null)}
        >
          <span className={cn(swatch, chartFillClass(item.color))} />
          <span className={slots.legendLabel()}>{item.label}</span>
          {value !== "none" && (
            <span className={slots.legendValue()}>
              {value === "share"
                ? formatShare(item.share)
                : value === "value"
                  ? format(item.value)
                  : `${format(item.value)} · ${formatShare(item.share)}`}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
