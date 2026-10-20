"use client"

import * as React from "react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"
import { ArrowLeft, CaretRight, Check } from "@phosphor-icons/react"

import { tv, type VariantProps } from "@/lib/tv"
import { cn } from "@/lib/utils"
import { useDensity } from "@/lib/density"
import { duration, easing, prefersReducedMotion } from "@/lib/motion"
import { Kbd } from "@/components/ui/kbd"
import { SwitchIndicator } from "@/components/ui/switch"

export const dropdownMenuVariants = tv({
  slots: {
    // The edge is an inset ring, not a border: a border spends 1px of layout, which would
    // push every row off the 12px inset and break the concentric corners.
    content: [
      "z-50 min-w-[8rem] overflow-hidden rounded-lg bg-popover ring-1 ring-inset ring-border [--surface:var(--popover)]",
      "text-popover-foreground shadow-lg",
      // Enter & exit: fade + directional slide only, no scale.
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
      "data-[side=bottom]:slide-out-to-top-2 data-[side=top]:slide-out-to-bottom-2",
      "data-[side=left]:slide-out-to-right-2 data-[side=right]:slide-out-to-left-2",
      "duration-base ease-out",
    ],
    item: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-medium outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
      // A described row (a navigation menu: title over a sentence) pins its leading icon to the
      // title's line instead of centering it on the whole block. The 20px icon and the 20px title
      // line share a box, so top alignment is also optical alignment.
      "has-[[data-slot=dropdown-menu-item-description]]:items-start",
    ],
    // Title + description column of a described row. `min-w-0` lets a long sentence wrap inside
    // the menu's width instead of pushing it wider.
    itemText: "flex min-w-0 flex-col gap-0.5",
    // The sentence under a row's title: same size as the title, set back by color and weight only,
    // so the row reads as one unit and the title keeps the hierarchy.
    itemDescription: "text-sm font-normal text-pretty text-muted-foreground",
    checkboxItem: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-medium outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    radioItem: [
      "relative flex cursor-pointer select-none items-center gap-2 text-sm font-medium outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    // `group` lets the caret nudge on sub-menu open.
    subTrigger: [
      "group flex cursor-pointer select-none items-center gap-2 text-sm font-medium outline-none",
      "transition-colors duration-fast ease-out",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
      "[&>svg]:text-muted-foreground [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    ],
    subContent: [
      "z-50 min-w-[8rem] overflow-hidden rounded-lg bg-popover ring-1 ring-inset ring-border [--surface:var(--popover)]",
      "text-popover-foreground shadow-lg",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
      "duration-base ease-out",
    ],
    // Brand-colored check: a selected checkbox/radio row reads as an on-brand confirmation
    // (matching Select + country-select), not a muted glyph. The leading icon stays muted.
    // right-2 lands the check on the same 12px line as the shortcut and sub caret.
    itemIndicator: "absolute right-2 flex size-4 items-center justify-center text-brand",
    label: "font-medium text-muted-foreground",
    // -mx-0.75, not -mx-1: the rule stops at the ring's inner edge instead of painting over
    // it. --border carries alpha on dark themes, so an overlap would brighten both ends.
    separator: "-mx-0.75 h-px bg-border",
    subCaret: "ml-auto size-4 text-muted-foreground",
    // `submenu="navigation"`: the box that animates the menu's height between layers. It bleeds
    // over the content's p-1 (-mx-1 px-1) so a separator's -mx-0.75 reaches the ring instead of
    // being clipped 4px short. `data-[ready]` withholds the tween until the first measurement,
    // so the menu never grows in from zero as it opens.
    navigationViewport: [
      "-mx-1 overflow-hidden px-1",
      "data-[ready]:transition-[height] data-[ready]:duration-base data-[ready]:ease-out",
      "motion-reduce:transition-none",
    ],
  },
  variants: {
    // 12px edge inset, both sides, both densities: content p-1 (4) + row px-2 (8). Leading
    // icon, label text, shortcut, sub caret and check all sit on that line. The padding also
    // sets the corner (rounded-lg 16 − p-1 4 = rounded-md 12: soft rows, not pills, which the user
    // preferred over 24/16 on 2026-09-19; a two-line row stays concentric), so it never moves with density;
    // density only tunes row height (36 vs 32). Checkable rows reserve pr-8 for the check:
    // right-2 (8) + size-4 (16) + gap (8).
    density: {
      comfortable: {
        content: "p-1",
        item: "px-2 py-2 rounded-md",
        checkboxItem: "px-2 pr-8 py-2 rounded-md",
        radioItem: "px-2 pr-8 py-2 rounded-md",
        subTrigger: "px-2 py-2 rounded-md",
        subContent: "p-1",
        label: "px-2 py-1.5 text-xs",
        separator: "my-1.5",
      },
      compact: {
        content: "p-1",
        item: "px-2 py-1.5 rounded-md",
        checkboxItem: "px-2 pr-8 py-1.5 rounded-md",
        radioItem: "px-2 pr-8 py-1.5 rounded-md",
        subTrigger: "px-2 py-1.5 rounded-md",
        subContent: "p-1",
        label: "px-2 py-1 text-xs",
        separator: "my-1",
      },
    },
    // Destructive (delete / log out) rows. The leading icon is colored to match the label,
    // not left muted, so a red row reads as one red unit; the hover background tints red to
    // match. `[&>svg]` overrides the base muted leading-icon rule via tailwind-merge while
    // never touching the check indicator (it isn't a direct svg child).
    variant: {
      default: {},
      destructive: {
        item: "text-destructive focus:bg-destructive/10 focus:text-destructive [&>svg]:text-destructive",
      },
    },
    // How a checkbox row shows its state: the brand check on the right, or a mini Switch on that
    // same line. The switch sits in the row's own padding (pr-2) instead of the check's reserved
    // pr-8, so it lands on the 12px edge line with the shortcut and the sub caret.
    indicator: {
      check: {},
      switch: { checkboxItem: "pr-2" },
    },
  },
  defaultVariants: { density: "comfortable", variant: "default", indicator: "check" },
})

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal

// ─── Navigation submenus ──────────────────────────────────────────────────────
// `submenu="navigation"` trades the flyout for a drill-down: a sub-menu opens IN PLACE, its rows
// replacing the menu's behind a Back row, and the surface resizes to fit. The same tree describes
// every layer; each part renders only while its own layer is the one on screen (the Dock's model,
// on the menu's anatomy). Plain React contexts rather than `createContext`: in the default nested
// mode there is no provider, and that absence is how a part knows to be a plain Radix part.

interface MenuNavigation {
  /** The open branch, one sub id per level. Empty = the menu's own rows. */
  path: string[]
  /** Enter `id`'s layer from `depth`, truncating any deeper branch. */
  openLayer: (depth: number, id: string) => void
  /** Leave the current layer for its parent. */
  back: () => void
}

const MenuNavigationContext = React.createContext<MenuNavigation | null>(null)
// The layer a part belongs to: 0 for the content's own rows, one deeper inside each sub.
const MenuLayerContext = React.createContext(0)
// The sub a trigger and its content belong to (navigation mode only).
const MenuSubContext = React.createContext<{ id: string; depth: number } | null>(null)

/** In navigation mode, true for a part whose layer is not the one on screen. */
function useOffLayer() {
  const navigation = React.useContext(MenuNavigationContext)
  const depth = React.useContext(MenuLayerContext)
  return navigation !== null && navigation.path.length !== depth
}

function isRtl(element: Element) {
  return getComputedStyle(element).direction === "rtl"
}

export interface DropdownMenuContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Content>,
    VariantProps<typeof dropdownMenuVariants> {
  /**
   * Where the menu is portalled. Defaults to the body, or to the element that is full screen when
   * the menu opens: the browser paints only that element's subtree over the page, so a menu left
   * on the body would open invisibly behind a full-screen player or file preview.
   */
  container?: HTMLElement | null
  /**
   * How a `DropdownMenuSub` opens. `nested` (the default) flies its menu out beside the row.
   * `navigation` drills in place: the sub's rows replace the menu's behind a Back row, and the
   * surface resizes to fit. Reach for it when a menu is deep, or has no room beside it.
   * @default "nested"
   */
  submenu?: "nested" | "navigation"
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  density,
  container,
  submenu = "nested",
  children,
  onKeyDown,
  onPointerDown,
  onEscapeKeyDown,
  onCloseAutoFocus,
  ...props
}: DropdownMenuContentProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  // Read as the menu opens (the content mounts on open); there is no full screen on the server.
  const fullscreen = typeof document === "undefined" ? null : (document.fullscreenElement as HTMLElement | null)

  const [path, setPath] = React.useState<string[]>([])
  // What drove the last layer change. A keyboard user has to land on a row of the new layer; a
  // pointer user must not get one lit up under a cursor that is somewhere else.
  const input = React.useRef<"keyboard" | "pointer">("pointer")
  const openLayer = React.useCallback((depth: number, id: string) => {
    setPath((current) => [...current.slice(0, depth), id])
  }, [])
  const back = React.useCallback(() => setPath((current) => current.slice(0, -1)), [])
  const navigation = React.useMemo(
    () => (submenu === "navigation" ? { path, openLayer, back } : null),
    [submenu, path, openLayer, back],
  )

  return (
    <DropdownMenuPrimitive.Portal container={container ?? fullscreen ?? undefined}>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-submenu={submenu}
        sideOffset={sideOffset}
        className={slots.content({ className })}
        onPointerDown={(event) => {
          input.current = "pointer"
          onPointerDown?.(event)
        }}
        onKeyDown={(event) => {
          input.current = "keyboard"
          onKeyDown?.(event)
          // The key that closes a flyout (ArrowLeft, ArrowRight in RTL) steps back one layer.
          if (event.defaultPrevented || !navigation || navigation.path.length === 0) return
          if (event.key === (isRtl(event.currentTarget) ? "ArrowRight" : "ArrowLeft")) {
            event.preventDefault()
            back()
          }
        }}
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event)
          // Escape undoes one decision at a time: back out of a layer before closing the menu.
          if (event.defaultPrevented || !navigation || navigation.path.length === 0) return
          event.preventDefault()
          input.current = "keyboard"
          back()
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event)
          // The menu has unmounted: the next open starts from its own rows, not the last branch.
          setPath([])
        }}
        {...props}
      >
        {navigation ? (
          <MenuNavigationContext.Provider value={navigation}>
            <MenuNavigationViewport className={slots.navigationViewport()} path={path} input={input}>
              {children}
            </MenuNavigationViewport>
          </MenuNavigationContext.Provider>
        ) : (
          children
        )}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

/**
 * Navigation mode's stage: animates the menu's height between layers, slides the new layer in
 * from the side it came from, and puts focus somewhere sensible once the row that held it is gone.
 * It mounts with the content, so its measurement starts fresh on every open.
 */
function MenuNavigationViewport({
  className,
  path,
  input,
  children,
}: {
  className: string
  path: string[]
  input: React.RefObject<"keyboard" | "pointer">
  children: React.ReactNode
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState<number | null>(null)

  // Measured from an inner box that keeps its natural height while the clip around it tweens, so
  // every layer change writes where the menu is *going* and CSS eases between the two.
  React.useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setHeight(viewport.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const layer = path.join("/")
  const shown = React.useRef({ layer, path })
  React.useEffect(() => {
    const previous = shown.current
    if (previous.layer === layer) return
    shown.current = { layer, path }
    const viewport = viewportRef.current
    if (!viewport) return

    // In, or back out. WAAPI rather than a re-keyed CSS animation: re-keying would remount every
    // sub on the way, and a sub's identity is minted on mount.
    const forward = path.length > previous.path.length
    if (typeof viewport.animate === "function" && !prefersReducedMotion()) {
      const offset = (forward ? 8 : -8) * (isRtl(viewport) ? -1 : 1)
      viewport.animate(
        [
          { opacity: 0, transform: `translateX(${offset}px)` },
          { opacity: 1, transform: "none" },
        ],
        { duration: duration.base, easing: easing.out },
      )
    }

    if (input.current === "keyboard") {
      // Going in lands on the layer's first row (its Back row); coming back lands on the row
      // that opened the layer you just left, so you are where you were.
      const left = forward ? null : previous.path[previous.path.length - 1]
      const target =
        (left && viewport.querySelector<HTMLElement>(`[data-menu-sub="${CSS.escape(left)}"]`)) ||
        viewport.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
      target?.focus({ preventScroll: true })
    } else {
      // The focused row unmounted with its layer; hand focus to the menu itself so arrow keys and
      // typeahead keep working (a modal menu's focus trap does this too, a non-modal one does not).
      const content = viewport.closest<HTMLElement>('[data-slot="dropdown-menu-content"]')
      if (content && !content.contains(document.activeElement)) content.focus({ preventScroll: true })
    }
  }, [layer, path, input])

  return (
    <div
      data-slot="dropdown-menu-navigation"
      data-ready={height === null ? undefined : ""}
      style={height === null ? undefined : { height }}
      className={className}
    >
      <div ref={viewportRef}>{children}</div>
    </div>
  )
}

export type DropdownMenuSubProps = React.ComponentProps<typeof DropdownMenuPrimitive.Sub>

/**
 * A sub-menu: a `DropdownMenuSubTrigger` row plus the `DropdownMenuSubContent` it opens. How it
 * opens is the content's call (`submenu`): a flyout beside the row, or a layer that replaces the
 * rows in place. In navigation mode `open`/`onOpenChange` do not apply; the open branch belongs
 * to the menu.
 */
export function DropdownMenuSub(props: DropdownMenuSubProps) {
  const navigation = React.useContext(MenuNavigationContext)
  const depth = React.useContext(MenuLayerContext)
  // Minted on mount, which is safe here (the Dock's keyed layer could not use it): nothing
  // remounts an open sub, since layers swap by rendering null and the entrance runs on WAAPI.
  const id = React.useId()
  const sub = React.useMemo(() => ({ id, depth }), [id, depth])
  if (!navigation) return <DropdownMenuPrimitive.Sub {...props} />
  return <MenuSubContext.Provider value={sub}>{props.children}</MenuSubContext.Provider>
}

export interface DropdownMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item>,
    VariantProps<typeof dropdownMenuVariants> {
  /** Indent left to align text with icon-bearing siblings. */
  inset?: boolean
}

export function DropdownMenuItem({
  className,
  inset,
  density,
  variant,
  ...props
}: DropdownMenuItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density), variant })
  // Navigation mode: a row that is not on the layer on screen is not hidden, it is not mounted.
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset || undefined}
      className={slots.item({ className: cn(inset && "pl-9", className) })}
      {...props}
    />
  )
}

/**
 * The text column of a described row: put the title and a `DropdownMenuItemDescription` inside,
 * after the leading icon. Both parts are optional; a row without a description stays a plain
 * one-line item, so nothing changes for menus that never use them.
 *
 *   <DropdownMenuItem>
 *     <Megaphone />
 *     <DropdownMenuItemText>
 *       Changelog
 *       <DropdownMenuItemDescription>What shipped this month</DropdownMenuItemDescription>
 *     </DropdownMenuItemText>
 *   </DropdownMenuItem>
 */
export function DropdownMenuItemText({ className, ...props }: React.ComponentProps<"span">) {
  const slots = dropdownMenuVariants()
  return <span data-slot="dropdown-menu-item-text" className={slots.itemText({ className })} {...props} />
}

/** The muted sentence under a row's title. Place it inside `DropdownMenuItemText`. */
export function DropdownMenuItemDescription({ className, ...props }: React.ComponentProps<"span">) {
  const slots = dropdownMenuVariants()
  return (
    <span
      data-slot="dropdown-menu-item-description"
      className={slots.itemDescription({ className })}
      {...props}
    />
  )
}

export interface DropdownMenuCheckboxItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
    Omit<VariantProps<typeof dropdownMenuVariants>, "variant" | "indicator"> {
  /**
   * How the checked state reads. `check` (the default) is the brand check on the right; `switch`
   * is a mini Switch on the same line, for a setting that applies the moment it flips.
   */
  variant?: "check" | "switch"
  /**
   * Close the menu when the row is toggled. Defaults to `true` for `check` and `false` for
   * `switch`, whose whole point is watching it flip, often several in a row.
   */
  closeOnSelect?: boolean
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  density,
  variant = "check",
  closeOnSelect = variant !== "switch",
  onSelect,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density), indicator: variant })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={slots.checkboxItem({ className })}
      checked={checked}
      onSelect={(event) => {
        onSelect?.(event)
        // Radix closes the menu on select; keeping it open is opting out of that default.
        if (!closeOnSelect) event.preventDefault()
      }}
      {...props}
    >
      {variant === "switch" ? (
        <>
          {children}
          {/* The switch's drawing, not a second control: the row owns focus, the toggle and
              `aria-checked` (Radix renders it as a menuitemcheckbox), and a real Switch nested inside
              it would be an interactive control within an interactive row. */}
          <SwitchIndicator checked={checked === true} className="ml-auto" />
        </>
      ) : (
        <>
          <span className={slots.itemIndicator()}>
            <DropdownMenuPrimitive.ItemIndicator>
              <Check weight="bold" className="size-4" />
            </DropdownMenuPrimitive.ItemIndicator>
          </span>
          {children}
        </>
      )}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export interface DropdownMenuRadioItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
    VariantProps<typeof dropdownMenuVariants> {}

export function DropdownMenuRadioItem({
  className,
  children,
  density,
  ...props
}: DropdownMenuRadioItemProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={slots.radioItem({ className })}
      {...props}
    >
      {/* Selected items in a menu read clearest with a check (the native-menu convention,
          macOS/Linear), so radio and checkbox share one indicator. The exclusive-vs-toggle
          semantics still live in the role (`menuitemradio`) and the section grouping, not the glyph. */}
      <span className={slots.itemIndicator()}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Check weight="bold" className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

export interface DropdownMenuLabelProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Label>,
    VariantProps<typeof dropdownMenuVariants> {
  inset?: boolean
}

export function DropdownMenuLabel({
  className,
  inset,
  density,
  ...props
}: DropdownMenuLabelProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      className={slots.label({ className: cn(inset && "pl-9", className) })}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({
  className,
  density,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> &
  VariantProps<typeof dropdownMenuVariants>) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  if (useOffLayer()) return null
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}

/**
 * Right-aligned shortcut hint for a menu item. Renders the shared `Kbd` primitive
 * (default gray chip, whose translucent fill stays visible on the highlighted row) so
 * every keyboard key across the DS shares one treatment, rather than bespoke text styling.
 */
export function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<typeof Kbd>) {
  return (
    <Kbd
      data-slot="dropdown-menu-shortcut"
      size="sm"
      className={cn("ml-auto", className)}
      {...props}
    />
  )
}

export interface DropdownMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
    VariantProps<typeof dropdownMenuVariants> {
  inset?: boolean
}

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  density,
  ...props
}: DropdownMenuSubTriggerProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  const navigation = React.useContext(MenuNavigationContext)
  const sub = React.useContext(MenuSubContext)
  const offLayer = useOffLayer()

  if (navigation && sub) {
    if (offLayer) return null
    const { onKeyDown, ...rest } = props
    const open = () => navigation.openLayer(sub.depth, sub.id)
    // A plain item that changes the layer. Same row, same caret: only what pressing it does differs.
    return (
      <DropdownMenuPrimitive.Item
        data-slot="dropdown-menu-sub-trigger"
        data-menu-sub={sub.id}
        className={slots.subTrigger({ className: cn(inset && "pl-9", className) })}
        {...rest}
        onSelect={(event) => {
          // Stay open: this row moves you somewhere, it does not choose anything.
          event.preventDefault()
          open()
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          // The key that opens a flyout (ArrowRight, ArrowLeft in RTL) drills in.
          if (event.defaultPrevented) return
          if (event.key === (isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight")) {
            event.preventDefault()
            open()
          }
        }}
      >
        {children}
        <CaretRight weight="bold" className={slots.subCaret()} />
      </DropdownMenuPrimitive.Item>
    )
  }

  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      className={slots.subTrigger({ className: cn(inset && "pl-9", className) })}
      {...props}
    >
      {children}
      <CaretRight weight="bold" className={slots.subCaret()} />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

export interface DropdownMenuSubContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>,
    VariantProps<typeof dropdownMenuVariants> {
  /**
   * Navigation mode only: the label of the row that returns to the parent layer.
   * @default "Back"
   */
  backLabel?: string
}

export function DropdownMenuSubContent({
  className,
  density,
  backLabel = "Back",
  children,
  ...props
}: DropdownMenuSubContentProps) {
  const slots = dropdownMenuVariants({ density: useDensity(density) })
  const navigation = React.useContext(MenuNavigationContext)
  const sub = React.useContext(MenuSubContext)

  if (navigation && sub) {
    if (navigation.path[sub.depth] !== sub.id) return null
    // Open, but not necessarily on screen: a deeper sub may be open inside it. Only the layer
    // actually showing contributes its Back row, or every ancestor would stack one.
    const current = navigation.path.length === sub.depth + 1
    // No surface of its own (so no `className`): its rows take the menu's place, at its width.
    return (
      <MenuLayerContext.Provider value={sub.depth + 1}>
        {current && (
          <DropdownMenuPrimitive.Item
            data-slot="dropdown-menu-back"
            className={slots.item()}
            onSelect={(event) => {
              event.preventDefault()
              navigation.back()
            }}
          >
            <ArrowLeft weight="bold" />
            {backLabel}
          </DropdownMenuPrimitive.Item>
        )}
        {children}
      </MenuLayerContext.Provider>
    )
  }

  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={slots.subContent({ className })}
      {...props}
    >
      {children}
    </DropdownMenuPrimitive.SubContent>
  )
}
