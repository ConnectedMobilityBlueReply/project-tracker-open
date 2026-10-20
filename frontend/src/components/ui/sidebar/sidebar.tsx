"use client"

import * as React from "react"
import { Slot, Collapsible as CollapsiblePrimitive } from "radix-ui"
import { CaretUpDown, CaretRight } from "@phosphor-icons/react"

import { createContext } from "@/lib/create-context"
import { useDensity, type Density } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"
import { Tooltip } from "@/components/ui/tooltip"

/**
 * Sidebar: the application navigation rail. A multi-part component: one `tv` recipe with
 * `slots`, density flowing to every part through React Context (see docs/ARCHITECTURE.md §2).
 *
 * It is composition, not configuration: you stack the parts in the order you want:
 *
 *   <Sidebar>
 *     <SidebarHeader>                  // workspace switcher lives here
 *       <DropdownMenu>…<SidebarSwitcher title="Koala" subtitle="Enterprise" />…</DropdownMenu>
 *     </SidebarHeader>
 *
 *     <SidebarContent>                 // the scroll region: primary nav, then sections
 *       <SidebarGroup>                 // primary actions/pages, first, unlabeled
 *         <SidebarItem active>…</SidebarItem>
 *       </SidebarGroup>
 *       <SidebarGroup>
 *         <SidebarGroupLabel>Favorites</SidebarGroupLabel>
 *         <SidebarItem>…</SidebarItem>
 *       </SidebarGroup>
 *     </SidebarContent>
 *
 *     <SidebarFooter>                  // profile switcher lives here
 *       <DropdownMenu>…<SidebarSwitcher title="Mara" subtitle="mara@koalaui.com" />…</DropdownMenu>
 *     </SidebarFooter>
 *   </Sidebar>
 *
 * The two switchers (workspace at the top, profile at the bottom) are the same
 * `SidebarSwitcher` trigger, composed with the DS `DropdownMenu` for the menu behavior:
 * Radix owns the keyboard/focus/ARIA, the Sidebar owns the chrome.
 *
 * Behavior (links vs. buttons) is yours: every `SidebarItem` is a `<button>` by default and
 * `asChild` to wrap an `<a>` / Next `<Link>`. Density resolves once at the root (prop >
 * provider > "compact") and the computed slots flow to every part through context.
 */
export const sidebarVariants = tv({
  slots: {
    // The rail itself: a full-height card surface. The separating border is set by the `side`
    // axis (a hairline on the edge that meets the content) or replaced by a full outline +
    // shadow when `floating`. `overflow-hidden` so a rounded override (a floating sidebar)
    // clips its children.
    root: [
      "flex h-full w-64 shrink-0 flex-col overflow-hidden",
      // Declares the surface it paints so a nested Input / Select / Command blends with the rail
      // instead of falling back to the page background (the --surface contract). The `docked`
      // variant below paints nothing and resets it back.
      "bg-card text-card-foreground [--surface:var(--card)]",
    ],
    // Top zone: holds the workspace switcher. Hairline below separates it from the scroll.
    // Holding a `SidebarActions` turns it into a row: the switcher, then the icon buttons beside
    // it (the GitBook header), keyed on the part being there rather than on a prop. In that row
    // the switcher hugs its content, so its caret follows the name instead of landing against
    // the first icon, where it read as one more button in the cluster.
    header: [
      "flex shrink-0 flex-col gap-1 border-b border-border",
      "has-[>[data-slot=sidebar-actions]]:flex-row has-[>[data-slot=sidebar-actions]]:items-center",
      "[&:has(>[data-slot=sidebar-actions])>[data-slot=sidebar-switcher]]:w-auto",
    ],
    // The scroll region. `min-h-0` lets it actually become the flex scroll container;
    // `gap` opens air between sections. `relative` makes it the containing block for the
    // absolutely-positioned sliding `indicator` pill, so the pill is measured and placed in
    // the same coordinate space (without it the pill resolves against an outer positioned
    // ancestor and lands on the wrong row).
    content: "relative flex min-h-0 flex-1 flex-col overflow-y-auto",
    // Bottom zone: holds the profile switcher. Hairline above mirrors the header, and like the
    // header it turns into a row when it holds a `SidebarActions`.
    footer: [
      "flex shrink-0 flex-col gap-1 border-t border-border",
      "has-[>[data-slot=sidebar-actions]]:flex-row has-[>[data-slot=sidebar-actions]]:items-center",
      "[&:has(>[data-slot=sidebar-actions])>[data-slot=sidebar-switcher]]:w-auto",
    ],
    // A cluster of icon buttons in the header or footer, beside the switcher: search and
    // notifications up top (GitBook, Squarespace), help and settings at the foot. Pushed to the
    // zone's far edge, so it lines up with the ends of the rows below. It sets the rail's muted
    // ink for the ghost buttons inside (which inherit colour at rest and lift to foreground on
    // hover), so they read at the weight of the row icons, not as white glyphs.
    actions: "ml-auto flex shrink-0 items-center gap-0.5 text-muted-foreground",
    // A labeled section ("clear sections"). Items stack tight inside.
    group: "flex flex-col gap-0.5",
    // The small, muted section heading.
    groupLabel:
      "flex items-center font-medium uppercase tracking-wider text-muted-foreground",
    // A nav row. `group/item` lets the icon track the row's hover/active state. The active
    // row reads as a neutral chip carrying a 3×16 brand accent bar in the left gutter and
    // full-strength (dark) text + icon; inactive rows are muted and lift to foreground on
    // hover. polish: specific transition (#14).
    item: [
      "group/item relative flex w-full cursor-pointer select-none items-center gap-3",
      // tabular-nums: a trailing count stacks into a right-aligned column down the rail.
      "rounded-md text-sm font-medium tabular-nums text-muted-foreground",
      "outline-none transition duration-fast ease-out",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-card",
      "data-[active=true]:bg-accent data-[active=true]:font-semibold data-[active=true]:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      // Active marker: a 3×16 brand accent bar that sits flush against the rail's left edge:
      // the negative offset cancels the row's left inset so the bar lands right on the rail's
      // inner edge (kissing the separating stroke), still inside the padded content so it never
      // triggers horizontal scroll. The offset equals the `content` left padding, so it's tuned
      // per density in compoundVariants below; this base value matches the `compact` `p-2`. It
      // fades in only when active; its geometry is also overridden for the collapsed rail.
      // polish: opacity transition (#14).
      "before:absolute before:-left-2 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2",
      "before:rounded-r-full before:bg-brand before:opacity-0 before:transition-opacity before:duration-fast before:ease-out before:content-['']",
      "data-[active=true]:before:opacity-100",
      // Leading glyph: 20px, the text-label-row standard across the DS (menus, select, lists);
      // never shrinks.
      "[&>svg]:size-5 [&>svg]:shrink-0",
    ],
    // A colored icon tile: the leading visual for the "tinted tile" rail (a Productboard-style
    // sidebar where each row carries a soft rounded square with a hue-colored glyph, rendered by
    // `SidebarItemIcon`). The tint + glyph color come from the `tone` variant (a hue role, the
    // same soft-10%/solid pair Bento uses); the square's size scales with density. It sits inside
    // the row like any other leading element, so the active chip + brand bar still belong to the
    // row. `place-items-center` centers the Phosphor icon, which is sized here (not by the row's
    // `[&>svg]` rule, since the icon is nested one level down inside this tile). In the collapsed
    // rail it becomes the centered chip: it's the row's leading element, so `leadingChild` keeps it.
    itemIcon: "grid shrink-0 place-items-center rounded-sm [&>svg]:size-[0.9375rem]",
    // The switcher trigger: an identity row (avatar/logo · title/subtitle · caret) that
    // opens a DropdownMenu. `data-[state=open]` keeps it lit while the menu is open. The
    // gap, hover fill, and padding are set by the `variant` axis below (compact default vs full).
    // `min-w-0` so beside a `SidebarActions` it is the one that gives way, truncating its text.
    switcher: [
      "group/switcher relative flex w-full min-w-0 cursor-pointer items-center text-left",
      "rounded-md outline-none transition duration-fast ease-out",
      "focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-card",
      "data-[state=open]:bg-accent",
    ],
    switcherText: "flex min-w-0 flex-1 flex-col",
    switcherTitle: "truncate text-sm font-medium text-foreground",
    switcherSubtitle: "truncate text-xs text-muted-foreground",
    switcherCaret: "ml-auto size-4 shrink-0 text-muted-foreground",
    // The caret on a collapsible `SidebarGroupLabel` (when `SidebarGroup collapsible`). It sits
    // at the end of the label row and flips on open, reading the trigger button's own
    // `data-state`. `caret-turn` carries the beat and the reduced-motion stand-down (#14).
    groupCaret:
      "ms-auto size-3.5 shrink-0 text-muted-foreground caret-turn group-data-[state=open]/grouplabel:rotate-90",
    // The nested sub-navigation list opened by a `SidebarCollapsible` parent row. It is indented
    // to sit under the parent's label and traces a hairline guide rail down the left so the
    // hierarchy reads at a glance. Its rows are ordinary `SidebarItem`s, but their left accent
    // bar is suppressed here: the rail already carries the nesting, and the active row keeps
    // only its `bg-accent` chip. `data-[state]` animations ride Radix Collapsible, and the
    // disclosure keyframes carry the clip, so it exists only mid-tween: at rest a focused row's
    // ring paints its full edge instead of being shaved flush with the list.
    sub: [
      "relative flex flex-col gap-0.5",
      "data-[state=open]:animate-disclosure-open data-[state=closed]:animate-disclosure-close",
      "before:pointer-events-none before:absolute before:inset-y-1 before:start-0 before:w-px before:bg-border before:content-['']",
      "[&_[data-slot=sidebar-item]]:before:hidden",
    ],
    // The animated content of a collapsible `SidebarGroup` (top-level, so no indent or rail,
    // just the same height tween as the nested list). Harmless on a non-collapsible group: with
    // no Radix `data-state` the animation simply never fires. Clipped only mid-tween (the clip
    // rides in the disclosure keyframes), so the rows' focus rings are never shaved at rest.
    groupContent: [
      "flex flex-col gap-0.5",
      "data-[state=open]:animate-disclosure-open data-[state=closed]:animate-disclosure-close",
    ],
    // The caret on a `SidebarCollapsible` parent row. A box (not a bare svg) so the trigger's
    // leading-glyph rule (`[&>svg]`) sizes only the icon, not this caret. Pushed to the end of
    // the row and flipped on open, reading the trigger button's `data-state`.
    subCaret:
      "ml-auto flex size-4 shrink-0 items-center justify-center text-muted-foreground caret-turn group-data-[state=open]/collapsible:rotate-90",
    // A divider between groups inside the scroll region.
    separator: "h-px shrink-0 bg-border",
    // The sliding active indicator: a single brand-tinted pill that glides between rows when
    // the root `indicator` prop is on (see the `indicator` variant). It is absolutely
    // positioned inside the scroll region and JS-measured to the active row, so it animates on
    // navigation instead of each row painting its own static chip. polish: a named-property
    // transition (#14), `will-change-transform` to keep the slide on the compositor.
    //
    // The pill also carries the 3×16 brand accent bar itself (on its `before` pseudo) instead of
    // each active row painting a static one: the bar is glued to the pill, so it glides between
    // rows *with* the chip on navigation rather than fading in place a row away. Geometry mirrors
    // the row's own bar (flush to the rail's inner edge via a negative offset that cancels the
    // content gutter, vertically centered); the offset is tuned per density in compoundVariants
    // (this base matches the `compact` p-2 gutter). The per-row bar is suppressed in this mode
    // (see the `indicator` variant) so there's only ever the one sliding bar.
    //
    // The size tweens with the slide: a nested `SidebarCollapsible` row is narrower than a
    // top-level one, and a width that snapped while the pill was still in flight would poke past
    // the rail's edge for the length of the glide.
    indicator: [
      "pointer-events-none absolute left-0 top-0 rounded-md bg-accent will-change-transform transition-[transform,width,height] duration-base ease-out",
      "before:absolute before:-left-2 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2",
      "before:rounded-r-full before:bg-brand before:content-['']",
    ],
  },
  variants: {
    // Density is Koala's cross-cutting spacing axis (lib/density.tsx). It tunes the zone
    // padding, the inter-section gap, the row height, and the switcher padding, never the
    // radius or color. `compact` is the Koala default (app UI); `comfortable` is roomier.
    density: {
      comfortable: {
        header: "p-3",
        content: "gap-5 p-3",
        footer: "p-3",
        groupLabel: "px-3 pb-1.5 pt-1 text-xs",
        item: "px-3 py-2",
        itemIcon: "size-7",
        separator: "-mx-3 my-1",
        // Indent the nested list so its rail sits under the parent label and its rows align a
        // step in from the parent.
        sub: "ms-5 mt-0.5 ps-2.5",
      },
      compact: {
        header: "p-2",
        content: "gap-4 p-2",
        footer: "p-2",
        groupLabel: "px-2.5 pb-1 pt-0.5 text-xs",
        item: "px-2.5 py-1.5",
        itemIcon: "size-6",
        separator: "-mx-2 my-1",
        sub: "ms-[1.125rem] mt-0.5 ps-2",
      },
    },
    // Switcher chrome. `default` is the compact trigger: a tighter gap, a small muted caret, and
    // reduced padding: the everyday switcher, paired with a small `leading` (e.g. an
    // `Avatar size="xs"`). `full` is the roomier identity row (logo/avatar · title/subtitle ·
    // caret) with a larger leading, for a primary/standalone switcher. Only touches the switcher
    // slots, so the rest of the rail is unaffected. (Switcher padding scales with density too,
    // set in compoundVariants below.)
    variant: {
      default: {
        switcher: "gap-2 hover:bg-accent",
        switcherCaret: "size-3.5 opacity-70",
      },
      full: {
        switcher: "gap-3 hover:bg-accent",
        // The roomy identity row carries a heavier title and a touch more air between the two
        // lines, so a larger leading (an `Avatar size="md"`, two initials) reads as a primary
        // switcher rather than a denser everyday row.
        switcherText: "gap-0.5",
        switcherTitle: "font-semibold",
      },
    },
    // Sliding active indicator. When on, both the active background *and* the brand accent bar
    // are owned by the single `indicator` pill (animated by `SidebarContent`), so the row itself
    // stays transparent and its own `before` bar is hidden: the row keeps only the active
    // text/icon coloring, and the chip + bar glide together to it. Off (default), each row paints
    // its own static chip and bar, the right choice when there's no measurable scroll container
    // (e.g. a collapsed rail or a non-routed menu).
    indicator: {
      true: { item: "data-[active=true]:bg-transparent before:hidden" },
      false: {},
    },
    // Collapse the rail to an icon-only column. The width shrinks to a single 40px tap
    // column, the zones center their contents, and every label is hidden: group headings go
    // `sr-only` (kept for screen readers), switcher text/caret disappear, and each row
    // becomes a centered icon chip (the row geometry is set in compoundVariants so it wins
    // over the density padding). Pair with `SidebarItem label="…"` for a hover tooltip and
    // an accessible name. Density still tunes the surrounding zone padding.
    collapsed: {
      true: {
        // A tight icon rail: 48px wide with a fixed 4px gutter (overriding the density padding
        // so the width is identical in both densities), leaving a 40px tap column for the icon
        // chips below.
        root: "w-12",
        // A zone holding `SidebarActions` goes back to a column: the icon buttons stack under the
        // switcher's mark instead of being cut off, so search and notifications stay in reach.
        // The row's hug-content rule outranks the switcher's own 40px square, so it is restated.
        header: [
          "items-center p-1 has-[>[data-slot=sidebar-actions]]:flex-col",
          "[&:has(>[data-slot=sidebar-actions])>[data-slot=sidebar-switcher]]:w-10",
        ],
        content: "items-center gap-2 p-1",
        footer: [
          "items-center p-1 has-[>[data-slot=sidebar-actions]]:flex-col",
          "[&:has(>[data-slot=sidebar-actions])>[data-slot=sidebar-switcher]]:w-10",
        ],
        actions: "ml-0 flex-col",
        // The section heading can't show in the rail, so it goes to screen readers only. To
        // keep the sections legible without it, each group after the first draws a short
        // centered rule above itself: a 40px divider aligned to the icon column.
        groupLabel: "sr-only",
        group:
          "[&:not(:first-child)]:border-t [&:not(:first-child)]:border-border [&:not(:first-child)]:pt-2",
        switcherText: "hidden",
        switcherCaret: "hidden",
      },
      false: {},
    },
    // Which edge the rail docks against. `left` is the app navigation default; `right` docks it
    // as an inspector/detail panel. Only the separating hairline flips (set in compoundVariants
    // so it yields to `floating`); the rest of the chrome is symmetric.
    side: {
      left: {},
      right: {},
    },
    // Floating (inset) treatment. Instead of a single hairline against the content, the rail
    // becomes a detached card: a full outline, a rounded radius (concentric with the app shell,
    // polish #9), and a shadow to lift it off the canvas. Pair it with padding on the container
    // (or the Layout gutter) so it floats clear of the edges. The base `overflow-hidden` clips
    // the children to the new radius.
    floating: {
      true: { root: "rounded-xl border border-border shadow-lg" },
      false: {},
    },
    // Docked shell treatment: the rail stops being its own card and becomes part of the app
    // shell's black frame, so the content sheet set into that frame is the only surface. This is
    // the house structure for every Koala dashboard (see memory `docked-shell-for-dashboards`;
    // the host column pins the rail `.dark`, not this variant): no `bg-card` fill, no separating
    // hairline (the compounds below opt out), and the width is surrendered to the shell column
    // that hosts it (`LayoutSidebar`), which is what animates it between expanded and collapsed.
    //
    // It deliberately does NOT declare `--surface`: a transparent rail paints nothing, so the
    // surface contract belongs to whatever it sits on (the `LayoutSidebar` canvas column, or a
    // `Drawer` panel on mobile). Inheriting it is what keeps a nested Input or Select blending
    // with the real surface in both places. See memory `surface-css-var-contract`.
    //
    // Set it explicitly, or let it be inherited: dropping a `Sidebar` inside a `LayoutSidebar`
    // turns it on automatically through `SidebarShellContext`, so the docked shell is what you
    // get by default rather than something each screen re-styles by hand.
    //
    // Declared after `collapsed` so its `w-full` wins over the icon rail's fixed `w-12`: in a
    // docked rail the collapsing is the *column's* job, not the Sidebar's.
    docked: {
      true: { root: "w-full bg-transparent text-foreground [--surface:initial]" },
      false: {},
    },
    // The hue tint of a `SidebarItemIcon` tile: a soft 10% wash behind a solid glyph, the same
    // pair Bento uses. A per-row axis (each page gets its own color), so it's set on the
    // `SidebarItemIcon`, not the root. Values scope to the `itemIcon` slot only (a slotted recipe
    // needs `{ slot: "…" }` objects, not a bare string). The decorative hues (purple/pink/teal/
    // orange) carry text at their base weight (already dark enough on the tint, and they lighten
    // in dark themes); the status hues (green/blue/red/amber) use the darker `-strong` text so the
    // glyph stays legible on the light-theme tint.
    tone: {
      brand: { itemIcon: "bg-brand/10 text-brand" },
      purple: { itemIcon: "bg-purple/10 text-purple" },
      pink: { itemIcon: "bg-pink/10 text-pink" },
      teal: { itemIcon: "bg-teal/10 text-teal" },
      orange: { itemIcon: "bg-orange/10 text-orange" },
      green: { itemIcon: "bg-success/10 text-success-strong" },
      blue: { itemIcon: "bg-info/10 text-info-strong" },
      red: { itemIcon: "bg-destructive/10 text-destructive-strong" },
      amber: { itemIcon: "bg-warning/10 text-warning-strong" },
    },
  },
  compoundVariants: [
    // The separating hairline lives on the edge that meets the content, and only when the rail
    // isn't floating (the floating card draws its own full outline instead) and isn't docked
    // (a docked rail sits *on* the canvas: there is no surface change to divide, so a hairline
    // there would draw a seam through one continuous background).
    { docked: false, floating: false, side: "left", class: { root: "border-r border-border" } },
    { docked: false, floating: false, side: "right", class: { root: "border-l border-border" } },
    // `docked` + `floating` is a legitimate pair (a detached rail card floating in the shell
    // gutter, the Discord-style read). Floating owns the surface in that combo, so restore the
    // card fill that `docked` stripped; listed after the `docked` variant so it wins the merge.
    { docked: true, floating: true, class: { root: "bg-card text-card-foreground [--surface:var(--card)]" } },
    // Switcher padding = variant × density. The compact `default` sits one step tighter than
    // `full` at each density, so it always reads as the smaller trigger.
    { variant: "default", density: "comfortable", class: { switcher: "p-1.5" } },
    { variant: "default", density: "compact", class: { switcher: "p-1" } },
    { variant: "full", density: "comfortable", class: { switcher: "p-2" } },
    { variant: "full", density: "compact", class: { switcher: "p-1.5" } },
    // Comfortable density has a wider zone gutter (`content` `p-3`), so the active accent bar
    // sits one step further left to stay flush against the rail edge (compact keeps the base
    // `-left-2` = its `p-2`). The sliding pill is placed at the row's left (already inset by that
    // gutter), so its own bar follows the same per-density offset to land on the rail edge.
    { collapsed: false, density: "comfortable", class: { item: "before:-left-3" } },
    { indicator: true, density: "comfortable", class: { indicator: "before:-left-3" } },
    // Collapsed row/switcher geometry: placed last so it overrides the density padding and
    // the switcher-padding compounds above. Each becomes a centered 40px square (≥40px hit
    // area, polish #15). The row's text/badges are dropped in `SidebarItem` itself (not hidden
    // with CSS, `text-transparent` would also blank a `currentColor` icon), so flex centering
    // is all that's needed here. `active:scale-[0.96]` gives the icon button a press response
    // (polish #2).
    {
      collapsed: true,
      class: {
        // In the rail the active state is just the left accent bar, not a full chip: a 40px
        // chip would crowd the 48px rail and graze its border. The bar lives on the row's
        // `before` pseudo (the row is already `relative`): its 3×16 geometry, brand color,
        // and active fade are inherited from the base `item` recipe; only the offset changes.
        item: [
          // The row stays a 40px hit target, but its own background is dropped: the visible
          // hover/active chip is a smaller 32px surface painted on `::after` and centered
          // behind the icon, so the chip reads in proportion to the 18px glyph instead of
          // ballooning to the full tap target. `isolate` scopes the negative-z chip to the row.
          "relative isolate mx-auto size-10 justify-center gap-0 px-0 py-0 active:scale-[0.96]",
          "hover:bg-transparent data-[active=true]:bg-transparent",
          "after:absolute after:left-1/2 after:top-1/2 after:-z-10 after:size-8 after:-translate-x-1/2 after:-translate-y-1/2",
          "after:rounded-md after:transition-colors after:duration-fast after:ease-out after:content-['']",
          // The neutral chip lights up on hover and stays lit while active: the collapsed
          // echo of the expanded active row's `bg-accent` chip, scaled to the 32px icon surface.
          "hover:after:bg-accent data-[active=true]:after:bg-accent",
          // Active marker: the same 3×16 brand bar as the expanded row, here flush against
          // the rail's left edge: `-left-1` cancels the 4px `p-1` gutter so the bar squares
          // off where it meets that edge. Only the offset overrides the base recipe.
          "before:-left-1",
        ],
        switcher: "mx-auto size-10 justify-center gap-0 p-0 active:scale-[0.96]",
      },
    },
  ],
  defaultVariants: {
    density: "compact",
    variant: "default",
    collapsed: false,
    indicator: false,
    side: "left",
    floating: false,
    docked: false,
    tone: "brand",
  },
})

type SidebarSlots = ReturnType<typeof sidebarVariants>
// The resolved density rides along in context so a `SidebarSwitcher` can recompute its own
// slots for a per-instance `variant` (the top and bottom switchers can differ).
const [SidebarProvider, useSidebarContext] = createContext<{
  slots: SidebarSlots
  density: Density
  collapsed: boolean
  indicator: boolean
}>("Sidebar")

/**
 * Shell bridge. An app shell (the DS `Layout`, through `LayoutSidebar`) publishes the two things
 * it owns about the rail nested inside it: that the rail is `docked` on the shell canvas, and
 * whether the shell has it `collapsed`. A `Sidebar` reads them as *defaults*, so the docked
 * dashboard structure works with zero configuration:
 *
 *   <LayoutSidebar>
 *     <Sidebar>…</Sidebar>      // docked + collapse-aware, no props, no className overrides
 *   </LayoutSidebar>
 *
 * They stay defaults, never overrides: an explicit `docked`/`collapsed` prop on the `Sidebar`
 * still wins, so a rail can opt out of the shell it happens to sit in. `null` (no shell) means
 * a standalone rail, which keeps its own card surface and hairline.
 *
 * A plain context with a `null` default rather than the throwing `createContext` helper: a
 * `Sidebar` outside any shell is the ordinary case, not a usage error.
 */
export const SidebarShellContext = React.createContext<{
  docked?: boolean
  collapsed?: boolean
} | null>(null)

// Group-scoped context: tells a `SidebarGroupLabel` / `SidebarGroupContent` whether their parent
// `SidebarGroup` is collapsible, so the label becomes a Collapsible trigger and the content a
// Collapsible panel. A plain context with a default (not the throwing `createContext`) because
// these parts are valid in an ordinary, non-collapsible group too: `SidebarGroup` always
// provides it, so the default only guards a label/content used loose.
const NOT_COLLAPSIBLE = { collapsible: false }
const SidebarGroupContext = React.createContext<{ collapsible: boolean }>(NOT_COLLAPSIBLE)

export interface SidebarProps
  extends React.ComponentProps<"aside">,
    // `variant` is a per-switcher axis and `tone` a per-item one, not root axes; omit both here.
    Omit<VariantProps<typeof sidebarVariants>, "variant" | "tone"> {
  /**
   * Collapse the rail to an icon-only column. Labels hide, rows become centered icon chips,
   * and the width animates between the two states. Give each `SidebarItem` a `label` so it
   * gets a hover tooltip and an accessible name while collapsed.
   *
   * Inside a `Layout`, the shell owns this state (⌘B / `LayoutSidebarTrigger`) and the rail
   * inherits it; pass the prop to drive the rail yourself.
   * @default inherited from the shell, else false
   */
  collapsed?: boolean
  /**
   * Animate a single highlight that glides between rows on navigation, instead of each active
   * row painting its own static chip. `SidebarContent` measures the active `SidebarItem` and
   * slides a brand-tinted pill to it. Use it for routed navigation where the active row
   * changes; leave it off for menus or a collapsed rail. @default false
   */
  indicator?: boolean
  /**
   * Which edge the rail docks against: `left` for app navigation, `right` for an
   * inspector/detail panel. Flips the separating hairline to the inner edge. @default "left"
   */
  side?: VariantProps<typeof sidebarVariants>["side"]
  /**
   * Detach the rail into a floating (inset) card: a full outline, a rounded radius, and a
   * shadow instead of a single edge hairline. Pair with padding on the container so it floats
   * clear of the viewport edges. @default false
   */
  floating?: boolean
  /**
   * Sit the rail directly on the app canvas instead of on its own card: no fill, no separating
   * hairline, width surrendered to the shell column hosting it. The docked (inset) dashboard
   * shell, and the Koala house structure for app screens.
   *
   * Inherited from an enclosing `LayoutSidebar`, so you rarely pass it: set it explicitly only
   * to force the treatment outside a `Layout`, or `docked={false}` to opt a rail out of the
   * shell it sits in. @default inherited from the shell, else false
   */
  docked?: boolean
}

/**
 * Parts are exported individually (not as `Sidebar.Header` dot-notation) because namespaced
 * statics don't survive the RSC server→client boundary; only named exports do. Renders an
 * `<aside>` complementary landmark; pass `aria-label` to name it.
 */
export function Sidebar({
  className,
  density,
  collapsed,
  indicator = false,
  side = "left",
  floating = false,
  docked,
  ...props
}: SidebarProps) {
  const resolved = useDensity(density)
  // The shell (a `LayoutSidebar`) supplies the docked treatment and the collapse state it owns;
  // an explicit prop still wins, and with no shell both fall back to the standalone defaults.
  const shell = React.useContext(SidebarShellContext)
  const isDocked = docked ?? shell?.docked ?? false
  const isCollapsed = collapsed ?? shell?.collapsed ?? false
  // A collapsed rail has no room for a sliding pill (rows are centered icon squares), so the
  // indicator only takes effect while expanded.
  const indicatorOn = indicator && !isCollapsed
  const slots = sidebarVariants({
    density: resolved,
    collapsed: isCollapsed,
    indicator: indicatorOn,
    side,
    floating,
    docked: isDocked,
  })
  return (
    <SidebarProvider slots={slots} density={resolved} collapsed={isCollapsed} indicator={indicatorOn}>
      <aside
        data-slot="sidebar"
        data-collapsed={isCollapsed || undefined}
        data-docked={isDocked || undefined}
        className={slots.root({ className })}
        {...props}
      />
    </SidebarProvider>
  )
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarHeader")
  return <div data-slot="sidebar-header" className={slots.header({ className })} {...props} />
}

// The collapsible panels a row can be folded away inside: a `SidebarGroup collapsible` body and a
// `SidebarCollapsible` sub-list. Scoped to the panels by slot, because the trigger rows carry a
// Radix `data-state` of their own.
const FOLDED_PANEL =
  '[data-slot="sidebar-group-content"][data-state="closed"], [data-slot="sidebar-sub"][data-state="closed"]'

export function SidebarContent({ className, children, ...props }: React.ComponentProps<"div">) {
  const { slots, indicator } = useSidebarContext("SidebarContent")
  const ref = React.useRef<HTMLDivElement>(null)
  const [pill, setPill] = React.useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  // Measure the active row's box relative to the (scrollable, positioned) content so the pill
  // can be placed and slide to it. Adding scrollTop/Left keeps it pinned when the rail scrolls.
  // Named fn (not inlined into the effect) per the repo's set-state-in-effect lint rule.
  //
  // A row inside a folded panel doesn't count: the moment a collapsible group or sub-list starts
  // closing (Radix flips its `data-state` before the height tween), its rows are on their way out
  // of view, and a pill left on one would float over the rows sliding up beneath it. The first
  // active row still on show wins, so a folded `SidebarCollapsible` marked `active` catches the
  // pill as its child folds away, and with no row on show the pill simply goes.
  function syncPill() {
    const container = ref.current
    if (!container) return
    const active = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="sidebar-item"][data-active="true"]'),
    ).find((row) => !row.closest(FOLDED_PANEL))
    if (!active) {
      setPill(null)
      return
    }
    const c = container.getBoundingClientRect()
    const a = active.getBoundingClientRect()
    setPill({
      top: a.top - c.top + container.scrollTop,
      left: a.left - c.left + container.scrollLeft,
      width: a.width,
      height: a.height,
    })
  }

  // Re-measure whenever the active row changes (data-active toggles), rows are added/removed,
  // or the container resizes, driven by the DOM, so the pill follows routed navigation
  // without the Sidebar needing to know the router. useLayoutEffect places it before paint so
  // it never slides in from the origin on first render.
  React.useLayoutEffect(() => {
    if (!indicator) return
    const container = ref.current
    if (!container) return
    syncPill()
    const mo = new MutationObserver(syncPill)
    mo.observe(container, {
      subtree: true,
      attributes: true,
      // `data-state` too: folding a panel hides its active row without touching `data-active`.
      attributeFilter: ["data-active", "data-state"],
      childList: true,
    })
    const ro = new ResizeObserver(syncPill)
    ro.observe(container)
    return () => {
      mo.disconnect()
      ro.disconnect()
    }
  }, [indicator])

  return (
    <div ref={ref} data-slot="sidebar-content" className={slots.content({ className })} {...props}>
      {indicator && pill ? (
        <div
          aria-hidden
          data-slot="sidebar-indicator"
          className={slots.indicator()}
          style={{
            width: pill.width,
            height: pill.height,
            transform: `translate(${pill.left}px, ${pill.top}px)`,
          }}
        />
      ) : null}
      {children}
    </div>
  )
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarFooter")
  return <div data-slot="sidebar-footer" className={slots.footer({ className })} {...props} />
}

/**
 * Icon buttons beside the switcher, in the `SidebarHeader` or `SidebarFooter`: search and
 * notifications next to the workspace (the GitBook header), help or settings at the foot. Drop
 * it in after the switcher and the zone lays the two out as a row; fill it with ghost icon-only
 * `Button`s, which take the rail's muted ink at rest:
 *
 *   <SidebarHeader>
 *     <SidebarSwitcher … />
 *     <SidebarActions>
 *       <Button variant="ghost" iconOnly aria-label="Search"><MagnifyingGlass /></Button>
 *       <Button variant="ghost" iconOnly aria-label="Notifications"><Bell /></Button>
 *     </SidebarActions>
 *   </SidebarHeader>
 *
 * In the collapsed rail the buttons stack under the switcher's mark, so they stay in reach.
 */
export function SidebarActions({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarActions")
  return <div data-slot="sidebar-actions" className={slots.actions({ className })} {...props} />
}

export interface SidebarGroupProps extends React.ComponentProps<"nav"> {
  /**
   * Drop this section entirely while the rail is collapsed. Use it for secondary groups
   * (favorites, recents) whose rows lose their meaning once reduced to a bare glyph, so the
   * icon rail stays focused on primary navigation. @default false
   */
  hideWhenCollapsed?: boolean
  /**
   * Make the whole section collapsible: the `SidebarGroupLabel` becomes a toggle with a caret
   * and the rows (wrapped in `SidebarGroupContent`) expand/collapse beneath it. Auto-disabled
   * while the rail is collapsed, where the label has no room to show. @default false
   */
  collapsible?: boolean
  /** Start expanded (uncontrolled). Only meaningful with `collapsible`. @default true */
  defaultOpen?: boolean
  /** Open state (controlled). Only meaningful with `collapsible`. */
  open?: boolean
  /** Fires when the collapsible group toggles. */
  onOpenChange?: (open: boolean) => void
}

/** A clear section. Wraps a `<nav>` so each group is a discrete navigation landmark; name
 * it with `aria-label` (or let `SidebarGroupLabel` describe it). Pass `collapsible` to fold the
 * whole section under its label: wrap the rows in `SidebarGroupContent` so they become the
 * Collapsible panel. */
export function SidebarGroup({
  className,
  hideWhenCollapsed = false,
  collapsible = false,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
  ...props
}: SidebarGroupProps) {
  const { slots, collapsed } = useSidebarContext("SidebarGroup")
  if (collapsed && hideWhenCollapsed) return null
  // The label that toggles a collapsible group is `sr-only` in the icon rail, so there'd be no
  // visible affordance, so fall back to a plain (always-open) section there.
  const isCollapsible = collapsible && !collapsed

  const inner = (
    <SidebarGroupContext.Provider value={{ collapsible: isCollapsible }}>
      {children}
    </SidebarGroupContext.Provider>
  )

  if (!isCollapsible) {
    return (
      <nav data-slot="sidebar-group" className={slots.group({ className })} {...props}>
        {inner}
      </nav>
    )
  }

  return (
    <CollapsiblePrimitive.Root
      asChild
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
    >
      <nav data-slot="sidebar-group" className={slots.group({ className })} {...props}>
        {inner}
      </nav>
    </CollapsiblePrimitive.Root>
  )
}

/**
 * The section heading. In an ordinary group it's a small muted label. In a `collapsible` group
 * it renders as the Collapsible trigger (a full-width button with a caret that flips on open)
 * so the heading itself folds the section.
 */
export function SidebarGroupLabel({ className, children, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarGroupLabel")
  const { collapsible } = React.useContext(SidebarGroupContext)

  if (!collapsible) {
    return (
      <div data-slot="sidebar-group-label" className={slots.groupLabel({ className })} {...props}>
        {children}
      </div>
    )
  }

  return (
    <CollapsiblePrimitive.Trigger asChild>
      <button
        type="button"
        data-slot="sidebar-group-label"
        className={slots.groupLabel({
          className: [
            "group/grouplabel w-full cursor-pointer rounded-md outline-none transition-colors duration-fast ease-out",
            "hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-card",
            className,
          ],
        })}
        {...(props as React.ComponentProps<"button">)}
      >
        {children}
        <CaretRight weight="bold" data-slot="sidebar-group-caret" aria-hidden className={slots.groupCaret()} />
      </button>
    </CollapsiblePrimitive.Trigger>
  )
}

/**
 * The collapsible body of a `SidebarGroup collapsible`: wrap the section's rows in it so they
 * become the Collapsible panel that folds under the label. In a non-collapsible group it's a
 * plain row stack (and optional: you can drop rows straight into the group).
 */
export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarGroupContent")
  const { collapsible } = React.useContext(SidebarGroupContext)

  if (!collapsible) {
    return (
      <div data-slot="sidebar-group-content" className={slots.groupContent({ className })} {...props} />
    )
  }

  return (
    <CollapsiblePrimitive.Content asChild>
      <div data-slot="sidebar-group-content" className={slots.groupContent({ className })} {...props} />
    </CollapsiblePrimitive.Content>
  )
}

export interface SidebarItemProps extends React.ComponentProps<"button"> {
  /** Render the child element as the row (Radix Slot), e.g. an `<a>` or Next `<Link>`. */
  asChild?: boolean
  /** Mark this as the current page: fills the row and sets `aria-current="page"`. */
  active?: boolean
  /**
   * The row's label. Lay it out inline as `<Icon /> Label` for the expanded rail; pass it
   * here too so the collapsed (icon-only) rail can show it as a hover tooltip and use it as
   * the row's accessible name once the inline text is hidden.
   */
  label?: string
}

/**
 * A nav row. Default `<button>`; pass `asChild` to wrap a link. Lay the children out as
 * `<Icon /> Label`, with an optional trailing element (a `<Badge>` or count) pushed right
 * with `ml-auto`. When the sidebar is `collapsed`, the row shrinks to a centered icon chip
 * and, if you passed `label`, gains a hover tooltip and an accessible name.
 */
/** The leading element child (the icon/glyph), used to render a collapsed row icon-only. */
function leadingChild(children: React.ReactNode): React.ReactNode {
  const found = React.Children.toArray(children).find(React.isValidElement)
  return found ?? children
}

export function SidebarItem({
  className,
  asChild = false,
  active = false,
  label,
  children,
  ...props
}: SidebarItemProps) {
  const { slots, collapsed } = useSidebarContext("SidebarItem")
  const Comp = asChild ? Slot.Root : "button"

  // Collapsed → render the leading glyph only; flex centering does the rest. We strip the
  // label/badge in React rather than hiding them with CSS so a `currentColor` icon keeps its
  // color (a blanket `text-transparent` would blank it too). With `asChild`, keep the single
  // child element but reduce *its* children to the leading glyph.
  let content = children
  if (collapsed) {
    content =
      asChild && React.isValidElement<{ children?: React.ReactNode }>(children)
        ? React.cloneElement(children, undefined, leadingChild(children.props.children))
        : leadingChild(children)
  }

  const row = (
    <Comp
      data-slot="sidebar-item"
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      // Once collapsed the inline text is gone, so name the row from `label` instead.
      aria-label={collapsed && label ? label : undefined}
      // type only applies to the native button; Slot forwards nothing it doesn't own.
      type={asChild ? undefined : "button"}
      className={slots.item({ className })}
      {...props}
    >
      {content}
    </Comp>
  )
  // Collapsed + a label → a right-side tooltip so the icon-only row stays legible.
  if (collapsed && label) {
    return (
      <Tooltip content={label} placement="right">
        {row}
      </Tooltip>
    )
  }
  return row
}

export interface SidebarItemIconProps extends React.ComponentProps<"span"> {
  /**
   * The hue tint for the tile: a hue role rendered as a soft 10% wash behind a solid glyph (the
   * same soft/solid pair as Bento). Decorative hues: `brand`, `purple`, `pink`, `teal`, `orange`;
   * status hues: `green`, `blue`, `red`, `amber`. @default "brand"
   */
  tone?: VariantProps<typeof sidebarVariants>["tone"]
}

/**
 * A colored icon tile: the leading visual for a tinted-tile rail, where every page carries a soft
 * rounded square with its own hue-colored glyph (the Productboard/Linear "colored spaces" look).
 * Wrap a single Phosphor icon; `tone` sets the tint + glyph color and the square scales with the
 * rail's density. Drop it where a `SidebarItem` icon goes:
 *
 *   <SidebarItem asChild>
 *     <a href="/portfolio">
 *       <SidebarItemIcon tone="purple"><Cube /></SidebarItemIcon>
 *       Product Portfolio
 *     </a>
 *   </SidebarItem>
 *
 * It's decorative (the row's label names the row), so it's `aria-hidden`. In the collapsed icon
 * rail it becomes the centered chip: it's the row's leading element, so the collapsed row keeps it.
 * Density flows from the root through context (like `SidebarSwitcher`, the slots are recomputed
 * here so the tile can carry its own per-instance `tone`).
 */
export function SidebarItemIcon({ className, tone, ...props }: SidebarItemIconProps) {
  const { density } = useSidebarContext("SidebarItemIcon")
  const slots = sidebarVariants({ density, tone })
  return (
    <span
      data-slot="sidebar-item-icon"
      aria-hidden
      className={slots.itemIcon({ className })}
      {...props}
    />
  )
}

export interface SidebarCollapsibleProps {
  /** Leading glyph for the parent row (lay it out like a `SidebarItem` icon). */
  icon?: React.ReactNode
  /** The parent row's label. Used as the collapsed-rail tooltip when it's a plain string. */
  label: React.ReactNode
  /** Trailing content on the parent row (a count `Badge`), shown before the caret. */
  actions?: React.ReactNode
  /**
   * Light the parent row as current: use it when a child route is active so the section reads
   * as selected even while you're on one of its pages.
   */
  active?: boolean
  /** Start expanded (uncontrolled). @default false */
  defaultOpen?: boolean
  /** Open state (controlled). */
  open?: boolean
  /** Fires when the section toggles. */
  onOpenChange?: (open: boolean) => void
  /** Disable the parent row (and its toggle). */
  disabled?: boolean
  /** Extra classes for the parent (trigger) row. */
  className?: string
  /** The nested rows: ordinary `SidebarItem`s; their left accent bar is suppressed here. */
  children: React.ReactNode
}

/**
 * A nested, collapsible navigation section. The parent row toggles a sub-list of `SidebarItem`s
 * that slides open beneath it, indented under the label and traced by a hairline guide rail.
 * Built on Radix Collapsible (it owns the open/close a11y + the height tween); the caret flips
 * with the panel. A long sub-list can be split under `SidebarGroupLabel` sub-headings, which
 * render as plain labels here.
 *
 * In the collapsed icon rail there's no room to nest, so it falls back to a single icon row
 * (with the `label` as a hover tooltip) and the children are dropped.
 */
export function SidebarCollapsible({
  icon,
  label,
  actions,
  active = false,
  defaultOpen = false,
  open,
  onOpenChange,
  disabled = false,
  className,
  children,
}: SidebarCollapsibleProps) {
  const { slots, collapsed } = useSidebarContext("SidebarCollapsible")

  // Icon rail: collapse to a single icon row (no nesting). Reuse `SidebarItem` so the collapsed
  // geometry, press-scale, and tooltip all come for free.
  if (collapsed) {
    return (
      <SidebarItem
        active={active}
        disabled={disabled}
        label={typeof label === "string" ? label : undefined}
        className={className}
      >
        {icon}
        {label}
      </SidebarItem>
    )
  }

  return (
    <CollapsiblePrimitive.Root
      asChild
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      disabled={disabled}
    >
      <div data-slot="sidebar-collapsible" className="flex flex-col gap-0.5">
        <CollapsiblePrimitive.Trigger asChild>
          <button
            type="button"
            data-slot="sidebar-item"
            data-active={active || undefined}
            aria-current={active ? "page" : undefined}
            disabled={disabled}
            className={slots.item({ className: ["group/collapsible", className] })}
          >
            {icon}
            <span className="min-w-0 flex-1 truncate text-start">{label}</span>
            {actions}
            <span data-slot="sidebar-collapsible-caret" aria-hidden className={slots.subCaret()}>
              <CaretRight weight="bold" className="size-3.5" />
            </span>
          </button>
        </CollapsiblePrimitive.Trigger>
        <CollapsiblePrimitive.Content asChild>
          <div data-slot="sidebar-sub" className={slots.sub()}>
            {/* A `SidebarGroupLabel` in here heads a run of sub-rows, so it stays a plain label
                even when this section sits inside a collapsible group, whose toggle it isn't. */}
            <SidebarGroupContext.Provider value={NOT_COLLAPSIBLE}>{children}</SidebarGroupContext.Provider>
          </div>
        </CollapsiblePrimitive.Content>
      </div>
    </CollapsiblePrimitive.Root>
  )
}

export interface SidebarSwitcherProps
  // `title` is overridden below to take rich content, not the native string tooltip attr.
  extends Omit<React.ComponentProps<"button">, "title"> {
  /** Leading visual: an `Avatar`, a logo tile, or an icon. */
  leading?: React.ReactNode
  /** Primary line: the workspace or profile name. */
  title: React.ReactNode
  /** Secondary line: plan, email, or role. */
  subtitle?: React.ReactNode
  /** Show the trailing up/down caret affordance. @default true */
  caret?: boolean
  /**
   * Chrome treatment. `default` is the compact trigger (tighter gap, small muted caret, reduced
   * padding): the everyday switcher. `full` is the roomier identity row for a primary or
   * standalone switcher. @default "default"
   */
  variant?: VariantProps<typeof sidebarVariants>["variant"]
}

/**
 * The switcher trigger: an identity row used for both the workspace switcher (top) and the
 * profile switcher (bottom). Renders a real `<button>`, so it drops straight into a
 * `DropdownMenuTrigger asChild`; the menu's `data-state` keeps it lit while open.
 *
 * Slots are recomputed here (not read from the shared context) so each switcher can carry
 * its own `variant`; density still flows from the root through context.
 */
export function SidebarSwitcher({
  className,
  leading,
  title,
  subtitle,
  caret = true,
  variant,
  ...props
}: SidebarSwitcherProps) {
  const { density, collapsed } = useSidebarContext("SidebarSwitcher")
  const slots = sidebarVariants({ density, variant, collapsed })
  return (
    <button
      data-slot="sidebar-switcher"
      type="button"
      className={slots.switcher({ className })}
      {...props}
    >
      {leading}
      <span className={slots.switcherText()}>
        <span className={slots.switcherTitle()}>{title}</span>
        {subtitle ? <span className={slots.switcherSubtitle()}>{subtitle}</span> : null}
      </span>
      {caret ? <CaretUpDown weight="bold" data-slot="sidebar-switcher-caret" className={slots.switcherCaret()} /> : null}
    </button>
  )
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSidebarContext("SidebarSeparator")
  return (
    <div
      data-slot="sidebar-separator"
      role="separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}
