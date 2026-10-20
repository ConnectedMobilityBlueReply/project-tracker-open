"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { CheckCircle } from "@phosphor-icons/react"

import { createContext } from "@/lib/create-context"
import { useDensity } from "@/lib/density"
import { cn } from "@/lib/utils"
import { morphBox, useMorphBox } from "@/lib/morph"
import { tv, type VariantProps } from "@/lib/tv"
import { hitY } from "@/lib/hit-area"

/**
 * Tabs: multi-part component over Radix Tabs. Pattern: one `tv` recipe with `slots`,
 * shared variants flowing to every part through React Context. See docs/ARCHITECTURE.md §2.
 *
 * The active state is drawn by a single **sliding indicator** measured in JS and moved
 * with `transform`: the one detail that makes tabs feel alive (polish:
 * interruptible transitions, skip-animation-on-load).
 */
export const tabsVariants = tv({
  slots: {
    // `orientation="vertical"` (forwarded straight to Radix, which also gives it up/down arrow
    // keys) turns the rail into a column beside its panel: the reading-pane layout, where the
    // questions stand in a list on the left and the answer holds a pane on the right. Radix stamps
    // `data-orientation` on the root, the list AND every trigger, so the whole layout is one set of
    // `data-[orientation=vertical]:` classes with no second prop to keep in sync. The sliding
    // indicator needs nothing: it already tracks the active trigger's box wherever it sits.
    root: "flex flex-col gap-2 data-[orientation=vertical]:flex-row data-[orientation=vertical]:gap-8",
    // Responsive: when the row of tabs is wider than its container it scrolls on the main axis
    // instead of overflowing the page (the classic mobile break). `max-w-full` caps the inline-flex
    // at the container so the overflow lands *inside* the list; `overflow-y-hidden` keeps it a single
    // row; `scroll-fade-x` fades the edge you can still scroll toward - the canonical segmented-bar
    // cue (globals.css), and the only affordance left once scrollbars are hidden site-wide. Inert
    // when the tabs fit: edges stay crisp and nothing scrolls, so wide layouts are unchanged.
    //
    // A vertical rail undoes all of that: it is a column that wraps rather than a row that scrolls,
    // so the horizontal scroll box and its edge fade stand down (`scroll-fade-x` is a mask, and it
    // would clip a column's ends instead of hinting at more).
    list: [
      "relative inline-flex max-w-full self-start items-center overflow-x-auto overflow-y-hidden scroll-fade-x",
      "data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
      "data-[orientation=vertical]:overflow-visible data-[orientation=vertical]:[mask-image:none]",
    ],
    trigger: [
      // `relative z-10` keeps the label above the indicator that slides behind it. `group/tabs-trigger`
      // lets a TabsTriggerIcon inside read whether its tab is the selected one.
      "group/tabs-trigger relative z-10 inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap",
      // In a column the label reads from the left edge, and it wraps instead of forcing the rail
      // wider than the column it was given.
      "data-[orientation=vertical]:justify-start data-[orientation=vertical]:whitespace-normal data-[orientation=vertical]:text-left",
      // One tight size: 14px label in a 28px-tall trigger with snug 10px sides.
      "h-7 px-2.5 text-sm",
      // `tracking-tight` crisps the label; inactive tabs answer hover so the control feels alive.
      "font-medium tracking-tight text-muted-foreground hover:text-foreground",
      // Specific transition (never `transition: all`); `transition` covers colors + scale.
      "transition duration-fast ease-out",
      // polish: tactile scale-on-press. Disable via the `static` prop.
      "active:scale-[0.96]",
      // Inset (not offset) focus ring: the list is a scroll box (see the `list` slot), which clips
      // on both axes, so an offset ring would be trimmed at the top/bottom edge. Drawn inside the
      // trigger, the ring stays whole in every variant/density, scroll or not.
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
      "disabled:pointer-events-none disabled:opacity-50",
      // Active label is full ink; the indicator behind it does the lifting.
      "data-[state=active]:text-foreground",
      // polish: ≥40px hit area without growing the visual.
      // Vertical-only, so it never overlaps a horizontally-adjacent trigger.
      hitY,
      "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    ],
    // Radix unmounts the inactive panel and mounts the active one fresh, so the new panel
    // appears at its end state: a CSS transition wouldn't fire, but a tw-animate-css animation
    // runs on mount. Cross-fade + a 4px rise on activate, riding the same motion tokens as the
    // sliding indicator, so switching tabs reads as one gesture instead of a snap.
    content: [
      "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1",
      "duration-base ease-out",
    ],
    // Optional wrapper around the panels (see TabsPanels), which eases the block's height between
    // panels of different sizes. It clips, so the panel's own focus ring moves inside: a ring
    // drawn 4px outside the box would be cut off by the very clip that makes the morph read as one
    // object. Scoped to this wrapper, so a Tabs without it keeps the offset ring it has always had.
    panels: "[&>[data-slot=tabs-content]]:ring-inset [&>[data-slot=tabs-content]]:ring-offset-0",
    // Positioned/sized by JS (see useActiveIndicator); transition added once ready.
    indicator: "pointer-events-none absolute left-0 top-0 z-0",
    // TabsTriggerIcon: two glyphs in one grid cell, cross-faded on the trigger's state. A CSS
    // transition on the three properties the polish rules name for an icon swap, so a quick
    // switch back reverses mid-way instead of restarting.
    triggerIcon: "inline-grid shrink-0 place-items-center",
    // At rest: the tab's own glyph. Selected: it shrinks to a quarter, fades and blurs out.
    triggerIconIdle: [
      "col-start-1 row-start-1 flex transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none",
      "group-data-[state=active]/tabs-trigger:scale-25 group-data-[state=active]/tabs-trigger:opacity-0 group-data-[state=active]/tabs-trigger:blur-xs",
    ],
    // The mirror image: hidden at rest, the selected mark resolves into place.
    triggerIconActive: [
      "col-start-1 row-start-1 flex transition-[opacity,scale,filter] duration-base ease-out motion-reduce:transition-none",
      "scale-25 opacity-0 blur-xs",
      "group-data-[state=active]/tabs-trigger:scale-100 group-data-[state=active]/tabs-trigger:opacity-100 group-data-[state=active]/tabs-trigger:blur-none",
    ],
  },
  variants: {
    variant: {
      // Active pill floats off the track: a hairline ring draws a crisp 1px edge and
      // `shadow-sm` lifts it (the "shadow as border" stack), so the segment reads sharp
      // instead of melting into the muted track. Both are theme tokens, so it adapts.
      // Dark paints foreground *tints* instead of solid tokens: a `bg-card` track disappears on any
      // card or popover (same .205 in dark), while a tint is relative to whatever sits behind it.
      // The indicator's tint layers over the list's, so it always lands one step above the trough.
      pill: {
        list: "gap-1 bg-muted dark:bg-foreground/6",
        // A vertical rail is a nav, not a segmented control, so the trough and the lift both stand
        // down (see the compound below for the padding the trough leaves behind) and the indicator
        // becomes the selected row's own fill. Written as an ancestor selector because the
        // indicator is our own span: Radix stamps `data-orientation` on the list around it, not
        // on it.
        indicator: [
          "bg-background dark:bg-foreground/10 shadow-sm ring-1 ring-border",
          "[[data-orientation=vertical]_&]:bg-muted dark:[[data-orientation=vertical]_&]:bg-foreground/8",
          "[[data-orientation=vertical]_&]:shadow-none [[data-orientation=vertical]_&]:ring-0",
        ],
      },
      // Active trigger shows a pill background (CSS fade) + a sliding bar on the bottom rule.
      // `pb-1.5` opens the gap that separates the pill from the colored indicator below it.
      folder: {
        list: "gap-1 border-b border-border pb-2.5",
        trigger: "data-[state=active]:bg-muted",
        indicator: "rounded-full bg-primary",
      },
      // Folder geometry (bar on the bottom rule, gap below) but no pill container: the
      // only active affordance is a single bar in the accent color, keyed off `--brand`
      // so it follows whatever accent is active (see globals.css §accent).
      line: {
        list: "gap-1 border-b border-border pb-2.5",
        indicator: "rounded-full bg-brand",
      },
      // A row of separate outlined chips, for a showcase switcher where each tab is a destination
      // with its own icon ("Home", "Blog", "Pricing"…) rather than a view of one panel. Every chip
      // keeps full-ink text and an outline; the active one settles onto a muted fill, so there is no
      // sliding indicator to draw. `py-1` gives the chips' shadow room inside the list, which clips
      // vertically (it scrolls on the x axis). Icons step back to muted, like a menu's leading glyph.
      //
      // Marketing scale, not app scale: a chip is a standalone destination under a display
      // headline, so it takes a 16px label with the 20px glyph of a text-label row (FOUNDATIONS
      // "icon size by context") rather than the 14px/16px of a segmented app tab. A leading icon
      // trims the left padding one step (`has-[>svg]:pl-2.5`), the same optical correction Button
      // makes, because a glyph edge reads lighter than a letter edge.
      //
      // Opaque at rest: this is the one tab rail that is routinely pinned (`sticky`) over the artwork
      // it switches, and a transparent chip would let the picture scroll through its label. It paints
      // the ground it sits on through the `--surface` contract, like any control, so it matches the
      // page, a muted band or a dialog instead of a fixed white.
      chip: {
        list: "gap-2 py-1",
        trigger: [
          // The leading glyph sits 2px tighter to the edge (optical: a glyph's box is airier than a
          // letter's), whether it is a bare icon or a TabsTriggerIcon cell.
          "h-9 rounded-md border border-border px-3 text-base text-foreground shadow-xs has-[>svg]:pl-2.5 has-[>[data-slot=tabs-trigger-icon]]:pl-2.5",
          "bg-[var(--surface,var(--background))]",
          "hover:border-foreground/20 hover:text-foreground data-[state=active]:bg-muted",
          // Glyphs rest muted; the chosen chip's goes to full ink (a faint chip and a full-strength
          // glyph is how this system marks a selection), its check included.
          "[&_svg]:size-5 [&_svg]:text-muted-foreground data-[state=active]:[&_svg]:text-foreground",
        ],
        indicator: "hidden",
      },
    },
    // Density is Koala's cross-cutting spacing axis (see lib/density.tsx). For Tabs it
    // tightens the pill chrome (container padding + concentric radii); the trigger keeps
    // its single height/text tier. Geometry lives in compoundVariants below.
    density: {
      comfortable: {},
      compact: {},
    },
  },
  compoundVariants: [
    // polish: concentric radius. inner = outer − padding. Kept tight/sharp: a small
    // corner reads crisper than a pillowy one, and still nests concentrically.
    // pill·comfortable: list rounded-lg(16) + p-1(4) → trigger/indicator rounded-md(12).
    { variant: "pill", density: "comfortable", className: { list: "rounded-lg p-1", trigger: "rounded-md", indicator: "rounded-md" } },
    // pill·compact: list rounded-md(12) + p-0.5(2) → trigger/indicator rounded-sm(8).
    { variant: "pill", density: "compact", className: { list: "rounded-md p-0.5", trigger: "rounded-sm", indicator: "rounded-sm" } },
    // Line triggers are square; the moving accent bar is the only active affordance.
    { variant: "line", className: { trigger: "rounded-none" } },
    // Folder: concentric radius on active trigger background (outer list has no padding container).
    { variant: "folder", density: "comfortable", className: { trigger: "rounded-md" } },
    { variant: "folder", density: "compact", className: { trigger: "rounded-sm" } },
    // Vertical, last so it wins the padding the pill compounds above just set: a rail has no
    // trough to inset from. Rows grow to a 40px reading row (which also makes the `hitY` extender
    // inert, so two stacked rows can never claim the same pixels) and keep a hairline separating
    // the rail from the pane it drives.
    {
      variant: "pill",
      className: {
        list: "data-[orientation=vertical]:gap-0.5 data-[orientation=vertical]:rounded-none data-[orientation=vertical]:bg-transparent data-[orientation=vertical]:p-0 dark:data-[orientation=vertical]:bg-transparent",
        trigger: "data-[orientation=vertical]:h-auto data-[orientation=vertical]:rounded-lg data-[orientation=vertical]:px-3 data-[orientation=vertical]:py-2.5",
        indicator: "[[data-orientation=vertical]_&]:rounded-lg",
      },
    },
  ],
  defaultVariants: {
    variant: "pill",
    density: "compact",
  },
})

type TabsSlots = ReturnType<typeof tabsVariants>
type TabsVariant = NonNullable<VariantProps<typeof tabsVariants>["variant"]>

const [TabsProvider, useTabsContext] = createContext<{
  slots: TabsSlots
  variant: TabsVariant
}>("Tabs")

/**
 * Tracks the active trigger's box and returns the indicator's transform/size. Re-measures
 * on selection change (data-state mutation), on resize, and on font/layout shifts, never
 * polls. `ready` gates visibility so the indicator never paints at the origin; `animate`
 * turns the transition on one frame *after* the first placement, so it snaps into position
 * on load and only slides on later selection changes (polish).
 */
function useActiveIndicator(
  listRef: React.RefObject<HTMLDivElement | null>,
  variant: TabsVariant,
) {
  const [style, setStyle] = React.useState<React.CSSProperties>()
  const [ready, setReady] = React.useState(false)
  const [animate, setAnimate] = React.useState(false)

  React.useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]')
      if (!active) {
        setReady(false)
        return
      }
      const { offsetLeft: left, offsetTop: top, offsetWidth: width, offsetHeight: height } = active
      let next: React.CSSProperties
      if (variant === "line") {
        // Bar sits on the bottom rule like folder, but inset to the trigger's content box
        // (padding removed) so it underlines the *label*, not the full padded hit area;
        // otherwise it spills left of the first tab's text and reads misaligned.
        const cs = getComputedStyle(active)
        const padL = parseFloat(cs.paddingLeft) || 0
        const padR = parseFloat(cs.paddingRight) || 0
        next = { transform: `translate(${left + padL}px, ${list.clientHeight - 1}px)`, width: width - padL - padR, height: 2 }
      } else if (variant === "folder") {
        // Bar sits on the list's bottom rule, in the gap below the active pill, so the
        // pill background never covers it (no z-index fight with the trigger).
        next = { transform: `translate(${left}px, ${list.clientHeight - 1}px)`, width, height: 2 }
      } else {
        next = { transform: `translate(${left}px, ${top}px)`, width, height }
      }
      setStyle(next)
      setReady(true)
    }

    measure()

    // Enable the slide only after the first placement has painted, so loading the
    // component never animates the bar in from the origin.
    const raf = requestAnimationFrame(() => setAnimate(true))

    // Width/position can change without a selection change (resize, late-loading fonts).
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    for (const child of list.children) ro.observe(child)

    // Radix flips `data-state` on the triggers when the value changes; watch that.
    const mo = new MutationObserver(measure)
    mo.observe(list, { attributes: true, attributeFilter: ["data-state"], subtree: true })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
    }
  }, [listRef, variant])

  return { style, ready, animate }
}

export interface TabsProps
  extends React.ComponentProps<typeof TabsPrimitive.Root>,
    VariantProps<typeof tabsVariants> {}

export function Tabs({ className, variant, density, ...props }: TabsProps) {
  const slots = tabsVariants({ variant, density: useDensity(density) })
  return (
    <TabsProvider slots={slots} variant={variant ?? "pill"}>
      <TabsPrimitive.Root data-slot="tabs" className={slots.root({ className })} {...props} />
    </TabsProvider>
  )
}

export function TabsList({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const { slots, variant } = useTabsContext("Tabs.List")
  const listRef = React.useRef<HTMLDivElement>(null)
  const { style, ready, animate } = useActiveIndicator(listRef, variant)

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={slots.list({ className })}
      {...props}
    >
      <span
        aria-hidden
        data-slot="tabs-indicator"
        // Interruptible transition (CSS, named properties, never `transition: all`);
        // hidden until the first measure, and the transition only switches on after that
        // placement has painted, so it never slides in from the origin on load.
        className={cn(
          slots.indicator(),
          ready ? "opacity-100" : "opacity-0",
          animate &&
            "transition-[transform,width,height] duration-base ease-out motion-reduce:transition-none",
        )}
        style={style}
      />
      {children}
    </TabsPrimitive.List>
  )
}

export interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger> {
  /** Disable the tactile scale-on-press, e.g. where motion would distract. */
  static?: boolean
}

export function TabsTrigger({ className, static: isStatic = false, ...props }: TabsTriggerProps) {
  const { slots } = useTabsContext("Tabs.Trigger")
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={slots.trigger({ className: cn(isStatic && "active:scale-100", className) })}
      {...props}
    />
  )
}

export interface TabsTriggerIconProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** The tab's own glyph, shown while it is not selected. */
  icon: React.ReactNode
  /** The glyph once selected. @default a filled check circle */
  activeIcon?: React.ReactNode
}

/**
 * The glyph of a trigger that marks the selection itself: the tab's own icon at rest, a check once
 * it is the selected one. Both stay mounted and cross-fade (opacity, scale, blur) on the trigger's
 * `data-state`, so the swap is as interruptible as the indicator sliding under it. The check is the
 * label's ink, full strength, not brand: selection is ink in this system. Decorative
 * (`aria-hidden`): the trigger's `aria-selected` already says which tab is chosen.
 *
 *   <TabsTrigger value="portfolio">
 *     <TabsTriggerIcon icon={<Briefcase weight="bold" />} />
 *     Portfolio
 *   </TabsTrigger>
 */
export function TabsTriggerIcon({
  icon,
  activeIcon = <CheckCircle weight="fill" />,
  className,
  ...props
}: TabsTriggerIconProps) {
  const { slots } = useTabsContext("TabsTriggerIcon")
  return (
    <span data-slot="tabs-trigger-icon" aria-hidden className={slots.triggerIcon({ className })} {...props}>
      <span data-slot="tabs-trigger-icon-idle" className={slots.triggerIconIdle()}>
        {icon}
      </span>
      <span data-slot="tabs-trigger-icon-active" className={slots.triggerIconActive()}>
        {activeIcon}
      </span>
    </span>
  )
}

/**
 * Chip numerico accanto all'etichetta di un trigger (es. "Task 12"). Neutro a riposo, tinta viola
 * quando la tab è selezionata: legge `data-state` del trigger tramite il gruppo `tabs-trigger`.
 * Mostra anche `0`; si allarga con il numero di cifre.
 *
 *   <TabsTrigger value="task">Task <TabsTriggerCount>{tasks.length}</TabsTriggerCount></TabsTrigger>
 */
export function TabsTriggerCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="tabs-trigger-count"
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-chip px-1.5 text-xs font-medium tabular-nums text-body",
        "group-data-[state=active]/tabs-trigger:bg-chip-active group-data-[state=active]/tabs-trigger:text-chip-active-foreground",
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const { slots } = useTabsContext("TabsContent")
  return (
    <TabsPrimitive.Content data-slot="tabs-content" className={slots.content({ className })} {...props} />
  )
}

/**
 * Optional wrapper around the panels, for tabs whose panels are different heights. Radix unmounts
 * the panel you leave and mounts the one you arrive at, so without it the block below the tabs
 * snaps from one height to the other while the new panel is still fading up: two gestures fighting
 * over the same moment. Wrapped, the block eases to the new panel's height, and the fade rides
 * along with it as one movement.
 *
 *   <Tabs defaultValue="a">
 *     <TabsList>…</TabsList>
 *     <TabsPanels>
 *       <TabsContent value="a">…</TabsContent>
 *       <TabsContent value="b">…</TabsContent>
 *     </TabsPanels>
 *   </Tabs>
 *
 * Opt-in on purpose: it CLIPS (that is what makes the reveal read as one object), so a panel that
 * needs to paint outside its own box, a sticky header or a non-portalled popover, should stay
 * unwrapped. Panels that grow without a ceiling should too: past a certain height the ease stops
 * reading as a gesture and turns back into a jump.
 */
export function TabsPanels({ className, children, ...props }: React.ComponentProps<"div">) {
  const { slots } = useTabsContext("TabsPanels")
  const { ref, style, ready, viewportClassName } = useMorphBox<HTMLDivElement>("height")

  return (
    <div
      data-slot="tabs-panels"
      data-morph-ready={ready ? "" : undefined}
      style={style}
      className={cn(morphBox, slots.panels({ className }))}
      {...props}
    >
      <div ref={ref} className={viewportClassName}>
        {children}
      </div>
    </div>
  )
}
