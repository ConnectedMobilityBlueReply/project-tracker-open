"use client"

import * as React from "react"
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui"
import { MagnifyingGlass } from "@phosphor-icons/react"

import { tv, type VariantProps } from "@/lib/tv"
import { useDensity, type Density } from "@/lib/density"
import { createContext } from "@/lib/create-context"
import { Kbd } from "@/components/ui/kbd"

/**
 * Command: a searchable command/action palette (the ⌘K menu). A filtered list of
 * selectable rows over a search field, with full keyboard control: arrows move a
 * highlight, Enter runs the active row, and the active row is announced to assistive
 * tech via `aria-activedescendant` (focus never leaves the input). `CommandDialog`
 * wraps it in a Radix Dialog so it gets a focus trap, scroll lock, Escape-to-close,
 * and enter/exit animations for free.
 *
 * No `cmdk` dependency: filtering is a pure-render decision per row (a non-matching
 * `CommandItem` renders nothing), so empty groups and the empty state collapse with
 * plain CSS (`:has`), and so does a now-orphaned `CommandSeparator` (the smart-divider
 * rules in globals.css), so a filtered list never strands a rule beside a vanished group
 * or over the empty state. The roving highlight is a DOM attribute toggled imperatively,
 * exactly the repo's "query DOM by data-attr, adjust state during render" patterns
 * (see EmojiPicker), which keeps the strict react-hooks lint happy.
 *
 * Named parts, not dot-notation (RSC-safe). Cross-part state flows through a typed
 * Context. See docs/ARCHITECTURE.md.
 */

// ─── Variants ───────────────────────────────────────────────────────────────────

export const commandVariants = tv({
  slots: {
    // The self-contained surface: works standalone (in a page or popover) and inside
    // CommandDialog, where the dialog content only positions + animates it.
    root: [
      "flex w-full flex-col overflow-hidden rounded-xl border border-border-soft bg-popover text-popover-foreground shadow-md",
      // Nested controls read this so they paint the panel surface, not a --background block.
      "[--surface:var(--popover)]",
    ],
    // A tall, icon-less search row: the field IS the palette's headline, so it gets the room and
    // its text sits on the same left edge as the rows below (see the density padding).
    inputWrapper: "flex shrink-0 items-center gap-3 border-b border-border",
    inputIcon: "size-[18px] shrink-0 text-muted-foreground [&_svg]:size-full",
    // The trailing "Esc" hint inside CommandDialog. A real close button (pointer users get a
    // target, keyboard users already have the key), kept out of the tab order; the `after:` inset
    // grows the 24px chip to a 40px hit area.
    escape: [
      "group/escape relative shrink-0 cursor-pointer rounded-[6px] outline-none",
      "after:absolute after:-inset-2 after:content-['']",
    ],
    input: [
      "flex-1 min-w-0 bg-transparent text-foreground placeholder:text-muted-foreground",
      "outline-none disabled:cursor-not-allowed",
    ],
    // `min-h-0` lets the viewport shrink inside a height-constrained dialog; `max-h-*`
    // caps it so a long list scrolls instead of growing the panel. `group/command-list`
    // drives the empty-state toggle below. `scroll-fade` softens the top/bottom edges into
    // the panel (the only scroll cue, since scrollbars are hidden site-wide); `scroll-py-10`
    // matches the fade depth so the roving highlight always parks the active row clear of
    // the fade, never half-dissolved under it. `relative` anchors the highlight pill.
    // The height is measured (inline px, see CommandList) and eased, so the panel glides
    // shut / open as the query trims or restores rows instead of snapping between sizes.
    list: [
      "group/command-list relative min-h-0 max-h-[var(--command-list-max,min(28rem,64vh))] overflow-y-auto overscroll-contain scroll-fade scroll-py-10",
      "transition-[height] duration-fast ease-out motion-reduce:transition-none",
    ],
    // ONE shared highlight that slides between rows (Raycast / Linear feel) instead of each row
    // cross-fading its own fill: arrowing or sweeping the pointer reads as a single object moving.
    // Positioned + sized imperatively by setActive (layout offsets, so the dialog's zoom-in can't
    // skew it); it jumps without easing when the rows themselves change (typing, mount).
    // Painted under the rows: it precedes them in the DOM and the rows are `relative`.
    highlight: [
      "pointer-events-none absolute left-0 top-0 rounded-md bg-accent opacity-0",
      "data-[visible=true]:opacity-100",
      "transition-[transform,height,width,opacity] duration-fast ease-out motion-reduce:transition-none",
    ],
    // Shown only when nothing matches: the named group has no command-item descendant.
    empty: [
      "py-12 text-center text-sm text-muted-foreground",
      "group-has-[[data-slot=command-item]]/command-list:hidden",
    ],
    // Collapses (heading and all) the instant every row inside it filters out.
    group: "not-has-[[data-slot=command-item]]:hidden",
    groupHeading: "select-none font-medium tracking-wide text-muted-foreground",
    item: [
      "relative flex cursor-pointer select-none items-center gap-2.5 font-medium text-foreground outline-none",
      // No fill and no color transition of its own: the sliding `highlight` pill paints the
      // active background, and the ink flips instantly so a held arrow key never lags behind.
      // Active state is a DOM attribute (data-active), toggled by the roving keyboard/hover.
      "data-[active=true]:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      // Leading icon reads at 20px (the text-label-row standard); explicitly-sized svgs
      // (e.g. a trailing <Kbd> glyph) keep their own size via the `:not([class*='size-'])` guard.
      "[&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
      "data-[active=true]:[&_svg]:text-accent-foreground",
    ],
    separator: "-mx-1 my-1 h-px bg-border",
    // Trailing key hint: drop <Kbd> children inside (reuse the DS Kbd, never hand-roll).
    shortcut: "ml-auto flex shrink-0 items-center gap-1 tabular-nums",

    // Dialog chrome (used by CommandDialog). A palette is summoned dozens of times a session
    // from the keyboard, so it runs on `duration-fast` (not the Dialog's `base`): it has to be
    // there by the time the first keystroke lands, and gone the instant a row is chosen.
    overlay: [
      "fixed inset-0 z-50 bg-black/50",
      "data-[state=open]:animate-in data-[state=open]:fade-in-0",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
      "duration-fast ease-out",
    ],
    positioner: [
      "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4",
      // Centered on screen, but as the FULL-height panel (search row + capped list + border),
      // then hung from that top edge. Plain `items-center` would re-center on every keystroke as
      // the list eases shorter, sliding the field you're typing into up and down; this way the
      // search field never moves and short result sets simply end higher.
      "[--command-list-max:min(28rem,64vh)]",
      "pt-[max(1rem,calc((100dvh-var(--command-list-max)-3.5rem-2px)/2))]",
      // Radix's Portal wraps each child in Presence, and this plain div is the node it watches:
      // with no animation of its own it unmounts at once and cuts the content's exit short. A
      // no-op `animate-out` (exit opacity stays 1) while the content is closing makes Presence
      // wait the same `duration-fast` the panel takes to leave.
      "has-[[data-slot=command-dialog][data-state=closed]]:animate-out duration-fast",
    ],
    dialog: [
      // `origin-top`: the panel hangs from its search field (see `positioner`), so it grows down
      // from the field (which stays put under the eye) rather than swelling from the middle.
      "relative w-full max-w-2xl origin-top outline-none",
      // Enter: a barely-there 97% scale. Exit: softer still (98%), mostly a fade.
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-97",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98",
      "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
      "duration-fast ease-out",
    ],
  },
  variants: {
    // Density tunes the search height and row padding (Koala's spacing axis); never color/radius.
    density: {
      comfortable: {
        // px-5 = list p-2 (8) + row px-3 (12): typed text lines up with the row icons below.
        inputWrapper: "h-14 px-5",
        input: "text-base",
        list: "p-2",
        // root rounded-xl (20px) − list p-2 (8px) = 12px → rounded-md keeps rows concentric.
        // The highlight pill copies the active row's radius, so a className override carries.
        item: "px-3 py-3 text-sm rounded-md",
        groupHeading: "px-3 pb-1.5 pt-2.5 text-xs",
      },
      compact: {
        // px-4 = list p-1.5 (6) + row px-2.5 (10).
        inputWrapper: "h-13 px-4",
        // 16px on touch so iOS doesn't zoom into the focused search (comfortable is already 16px).
        input: "text-sm pointer-coarse:text-base",
        list: "p-1.5",
        item: "px-2.5 py-2.5 text-sm rounded-md",
        groupHeading: "px-2.5 pb-1 pt-2 text-xs",
      },
    },
  },
  defaultVariants: { density: "comfortable" },
})

type CommandSlots = ReturnType<typeof commandVariants>

/** Scoring filter: 0 hides the row, any positive number keeps it. An empty query keeps all. */
export type CommandFilter = (search: string, value: string, keywords?: string[]) => number

const defaultFilter: CommandFilter = (search, value, keywords) => {
  const q = search.trim().toLowerCase()
  if (!q) return 1
  const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase()
  return haystack.includes(q) ? 1 : 0
}

// ─── Roving DOM helpers ─────────────────────────────────────────────────────────────
// Layout offsets (offsetTop/offsetHeight), never getBoundingClientRect: CommandDialog mounts
// mid zoom-in, and a transformed ancestor would hand back scaled rects and park the pill off-row.

/** `el`'s offset inside `container` (a positioned ancestor), summed up the offsetParent chain. */
function offsetWithin(el: HTMLElement, container: HTMLElement) {
  let top = 0
  let left = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    top += node.offsetTop
    left += node.offsetLeft
    node = node.offsetParent as HTMLElement | null
  }
  return { top, left }
}

/**
 * Scroll ONLY the list so `el` sits clear of its scroll-padding (the fade band). Unlike
 * `scrollIntoView`, this never scrolls the page or the dialog positioner, so an inline Command
 * below the fold doesn't yank the document to itself on mount or while arrowing.
 */
function scrollIntoList(list: HTMLElement, el: HTMLElement) {
  if (list.scrollHeight <= list.clientHeight) return
  const style = getComputedStyle(list)
  const padTop = parseFloat(style.scrollPaddingTop) || 0
  const padBottom = parseFloat(style.scrollPaddingBottom) || 0
  const { top } = offsetWithin(el, list)
  const bottom = top + el.offsetHeight
  if (top - padTop < list.scrollTop) list.scrollTop = top - padTop
  else if (bottom + padBottom > list.scrollTop + list.clientHeight)
    list.scrollTop = bottom + padBottom - list.clientHeight
}

/** Park the shared highlight pill on `el`; `instant` skips the glide for this one move. */
function moveHighlight(highlight: HTMLElement, list: HTMLElement, el: HTMLElement, instant: boolean) {
  const { top, left } = offsetWithin(el, list)
  // A hidden pill never glides in from wherever it last was: it appears on its row.
  const snap = instant || highlight.getAttribute("data-visible") !== "true"
  if (snap) highlight.style.transitionDuration = "0s"
  highlight.style.transform = `translate3d(${left}px, ${top}px, 0)`
  highlight.style.width = `${el.offsetWidth}px`
  highlight.style.height = `${el.offsetHeight}px`
  highlight.style.borderRadius = getComputedStyle(el).borderRadius
  highlight.setAttribute("data-visible", "true")
  if (snap) {
    // Commit the jump with transitions off, then hand the duration back to the recipe.
    void highlight.offsetWidth
    highlight.style.transitionDuration = ""
  }
}

/**
 * True under CommandDialog. Optional by design (a standalone Command has no dialog to close), so
 * it's a plain React context rather than the throwing `createContext` helper.
 */
const CommandDialogContext = React.createContext(false)

const [CommandProvider, useCommandContext] = createContext<{
  search: string
  setSearch: (value: string) => void
  filter: CommandFilter
  slots: CommandSlots
  inputId: string
  listId: string
  label?: string
  rootRef: React.RefObject<HTMLDivElement | null>
  setActive: (el: HTMLElement | null, instant?: boolean) => void
  onItemSelect: (value: string) => void
}>("Command")

// ─── Command (root) ───────────────────────────────────────────────────────────────

export interface CommandProps
  extends Omit<React.ComponentProps<"div">, "onSelect">,
    VariantProps<typeof commandVariants> {
  /** Controlled search query. */
  search?: string
  /** Uncontrolled initial query. */
  defaultSearch?: string
  /** Fires on every keystroke in the search field. */
  onSearchChange?: (search: string) => void
  /** Override the match function. Return 0 to hide a row, any positive number to keep it. */
  filter?: CommandFilter
  /** Fires when any row is chosen (after that row's own `onSelect`), e.g. to close a dialog. */
  onSelect?: (value: string) => void
  /** Accessible name for the result list. */
  label?: string
  density?: Density
}

export function Command({
  search: searchProp,
  defaultSearch = "",
  onSearchChange,
  filter = defaultFilter,
  onSelect,
  label = "Commands",
  density,
  className,
  children,
  ...props
}: CommandProps) {
  const d = useDensity(density)
  const slots = commandVariants({ density: d })

  // Controlled/uncontrolled search, hand-rolled to satisfy the strict lint.
  const isControlled = searchProp !== undefined
  const [uncontrolled, setUncontrolled] = React.useState(defaultSearch)
  const search = isControlled ? searchProp : uncontrolled
  const setSearch = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next)
      onSearchChange?.(next)
    },
    [isControlled, onSearchChange],
  )

  const reactId = React.useId()
  const inputId = `${reactId}-input`
  const listId = `${reactId}-list`
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Items + the active highlight live in the DOM (data-attributes), not React state, so
  // re-renders never fight the highlight and there's no registry to keep in sync.
  const getItems = React.useCallback(
    () =>
      Array.from(
        rootRef.current?.querySelectorAll<HTMLElement>(
          '[data-slot="command-item"]:not([data-disabled])',
        ) ?? [],
      ),
    [],
  )

  const setActive = React.useCallback((el: HTMLElement | null, instant = false) => {
    const root = rootRef.current
    if (!root) return
    for (const item of root.querySelectorAll<HTMLElement>('[data-slot="command-item"][data-active]')) {
      item.removeAttribute("data-active")
      item.setAttribute("aria-selected", "false")
    }
    const input = root.querySelector<HTMLElement>('[data-slot="command-input"]')
    const highlight = root.querySelector<HTMLElement>('[data-slot="command-highlight"]')
    if (el) {
      el.setAttribute("data-active", "true")
      el.setAttribute("aria-selected", "true")
      input?.setAttribute("aria-activedescendant", el.id)
      const list = el.closest<HTMLElement>('[data-slot="command-list"]')
      if (list) scrollIntoList(list, el)
      if (highlight && list) moveHighlight(highlight, list, el, instant)
    } else {
      input?.removeAttribute("aria-activedescendant")
      highlight?.removeAttribute("data-visible")
    }
  }, [])

  // Whenever the query changes (rows added/removed), move the highlight to the first match.
  // `instant`: the rows under the pill just changed, so gliding from where the old first row
  // sat would read as lag, not motion. Pure DOM side effect (no setState), so it stays clear
  // of the set-state-in-effect rule.
  React.useLayoutEffect(() => {
    setActive(getItems()[0] ?? null, true)
  }, [search, getItems, setActive])

  const onItemSelect = React.useCallback(
    (value: string) => onSelect?.(value),
    [onSelect],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.defaultPrevented) return
    const items = getItems()
    if (e.key === "Enter") {
      const active = items.find((el) => el.getAttribute("data-active") === "true")
      if (active) {
        e.preventDefault()
        active.click()
      }
      return
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return
    if (items.length === 0) return
    e.preventDefault()
    const current = items.findIndex((el) => el.getAttribute("data-active") === "true")
    let next: number
    if (e.key === "Home") next = 0
    else if (e.key === "End") next = items.length - 1
    else if (e.key === "ArrowDown") next = current < items.length - 1 ? current + 1 : 0
    else next = current > 0 ? current - 1 : items.length - 1
    setActive(items[next] ?? null)
  }

  return (
    <CommandProvider
      search={search}
      setSearch={setSearch}
      filter={filter}
      slots={slots}
      inputId={inputId}
      listId={listId}
      label={label}
      rootRef={rootRef}
      setActive={setActive}
      onItemSelect={onItemSelect}
    >
      <div
        ref={rootRef}
        data-slot="command"
        className={slots.root({ className })}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </CommandProvider>
  )
}

// ─── CommandInput ───────────────────────────────────────────────────────────────

export interface CommandInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  /**
   * Leading glyph. Off by default: the palette leads with the typed text, aligned to the rows.
   * `true` shows the magnifying glass; pass a node for your own icon.
   */
  icon?: boolean | React.ReactNode
}

export function CommandInput({ className, placeholder = "Type a command or search…", icon = false, ...props }: CommandInputProps) {
  const { search, setSearch, slots, inputId, listId, label } = useCommandContext("CommandInput")
  const inDialog = React.useContext(CommandDialogContext)
  return (
    <div data-slot="command-input-wrapper" className={slots.inputWrapper()}>
      {icon === true ? (
        <MagnifyingGlass weight="bold" aria-hidden className={slots.inputIcon()} />
      ) : icon ? (
        <span aria-hidden className={slots.inputIcon()}>{icon}</span>
      ) : null}
      <input
        data-slot="command-input"
        id={inputId}
        role="combobox"
        // The accname algorithm doesn't count `placeholder`, so the combobox needs a real name.
        // Defaults to the palette label; override by passing your own aria-label via props.
        aria-label={label}
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={slots.input({ className })}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder}
        {...props}
      />
      {inDialog && (
        <DialogPrimitive.Close data-slot="command-escape" tabIndex={-1} aria-label="Close" className={slots.escape()}>
          <Kbd className="group-hover/escape:text-foreground">Esc</Kbd>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

// ─── CommandList ────────────────────────────────────────────────────────────────

/**
 * The scroll viewport for the rows. Also hosts the sliding highlight pill (so a Command needs a
 * CommandList for its active row to paint) and eases its own height to the rows' natural height.
 */
export function CommandList({ className, children, ...props }: React.ComponentProps<"div">) {
  const { slots, listId, label } = useCommandContext("CommandList")
  const listRef = React.useRef<HTMLDivElement>(null)
  const sizerRef = React.useRef<HTMLDivElement>(null)

  // Mirror the rows' natural height onto the list as an inline px height, which the recipe eases
  // (`transition-[height]`) and `max-h-*` still caps. The first write goes from `auto` to px, which
  // can't interpolate, so the panel never animates on mount. The same pass re-parks the highlight
  // instantly, covering row changes that don't come from the query (async results, late icons).
  React.useLayoutEffect(() => {
    const list = listRef.current
    const sizer = sizerRef.current
    if (!list || !sizer) return
    const sync = () => {
      const style = getComputedStyle(list)
      const chrome =
        (parseFloat(style.paddingTop) || 0) +
        (parseFloat(style.paddingBottom) || 0) +
        (parseFloat(style.borderTopWidth) || 0) +
        (parseFloat(style.borderBottomWidth) || 0)
      list.style.height = `${sizer.offsetHeight + chrome}px`
      const active = list.querySelector<HTMLElement>('[data-slot="command-item"][data-active="true"]')
      const highlight = list.querySelector<HTMLElement>(':scope > [data-slot="command-highlight"]')
      if (active && highlight) moveHighlight(highlight, list, active, true)
    }
    const observer = new ResizeObserver(sync)
    observer.observe(sizer)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={listRef}
      data-slot="command-list"
      id={listId}
      role="listbox"
      aria-label={label}
      className={slots.list({ className })}
      {...props}
    >
      <div data-slot="command-highlight" aria-hidden className={slots.highlight()} />
      <div ref={sizerRef} data-slot="command-list-sizer" role="presentation">
        {children}
      </div>
    </div>
  )
}

// ─── CommandEmpty ───────────────────────────────────────────────────────────────

export function CommandEmpty({ className, children = "No results found.", ...props }: React.ComponentProps<"div">) {
  const { slots } = useCommandContext("CommandEmpty")
  return (
    <div data-slot="command-empty" role="presentation" className={slots.empty({ className })} {...props}>
      {children}
    </div>
  )
}

// ─── CommandGroup ───────────────────────────────────────────────────────────────

export interface CommandGroupProps extends React.ComponentProps<"div"> {
  /** Section label shown above the rows (and used as the group's accessible name). */
  heading?: React.ReactNode
}

export function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  const { slots } = useCommandContext("CommandGroup")
  const headingId = React.useId()
  return (
    <div
      data-slot="command-group"
      role="group"
      aria-labelledby={heading ? headingId : undefined}
      className={slots.group({ className })}
      {...props}
    >
      {heading && (
        <div id={headingId} data-slot="command-group-heading" className={slots.groupHeading()}>
          {heading}
        </div>
      )}
      <div data-slot="command-group-items" role="presentation">
        {children}
      </div>
    </div>
  )
}

// ─── CommandItem ────────────────────────────────────────────────────────────────

export interface CommandItemProps extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** The row's searchable identity (matched against the query). Required. */
  value: string
  /** Extra terms to match on beyond the value (synonyms, ids, the page path…). */
  keywords?: string[]
  disabled?: boolean
  /** Fires when the row is chosen (click, Enter on the highlight). */
  onSelect?: (value: string) => void
}

export function CommandItem({
  className,
  value,
  keywords,
  disabled,
  onSelect,
  children,
  ...props
}: CommandItemProps) {
  const { search, filter, slots, setActive, onItemSelect } = useCommandContext("CommandItem")

  // Pure-render filtering: a non-matching row leaves the DOM entirely, so empty groups and
  // the empty state collapse via CSS and the keyboard walk only ever sees visible rows.
  if (filter(search, value, keywords) === 0) return null

  const id = `command-item-${value.replace(/\s+/g, "-").toLowerCase()}`

  function handleSelect() {
    if (disabled) return
    onSelect?.(value)
    onItemSelect(value)
  }

  return (
    <div
      id={id}
      role="option"
      data-slot="command-item"
      data-value={value}
      data-disabled={disabled || undefined}
      // Static baseline for a11y; the live highlight is the imperative `data-active` attribute
      // (CSS), and the active row's `aria-selected` is set imperatively in setActive, re-applied
      // by the layout effect whenever the query (and thus the visible rows) changes.
      aria-selected={false}
      aria-disabled={disabled || undefined}
      onClick={handleSelect}
      // Pointer (not enter) so a keyboard scroll under a still cursor doesn't hijack the highlight.
      onPointerMove={(e) => {
        if (!disabled) setActive(e.currentTarget)
      }}
      className={slots.item({ className })}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── CommandSeparator ───────────────────────────────────────────────────────────

// Auto-collapses when a filter strands it: the smart-divider rules in globals.css hide a
// `command-separator` that no longer sits between two row-bearing groups (leading, trailing,
// or beside a group that filtered empty), so the divider never floats over an empty state.
export function CommandSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCommandContext("CommandSeparator")
  return <div data-slot="command-separator" role="separator" className={slots.separator({ className })} {...props} />
}

// ─── CommandShortcut ────────────────────────────────────────────────────────────

export function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  const { slots } = useCommandContext("CommandShortcut")
  return <span data-slot="command-shortcut" className={slots.shortcut({ className })} {...props} />
}

// ─── CommandDialog ──────────────────────────────────────────────────────────────

export interface CommandDialogProps extends Omit<CommandProps, "className"> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Dialog title for assistive tech (visually hidden). */
  title?: string
  /** Dialog description for assistive tech (visually hidden). */
  description?: string
  /** Close the dialog after a row is chosen. @default true */
  closeOnSelect?: boolean
  /** Classes for the positioned dialog content (the Command keeps its own surface). */
  className?: string
}

/**
 * CommandDialog: the palette in a modal. Wraps Command in a Radix Dialog so it inherits the
 * focus trap, scroll lock, Escape-to-close, and enter/exit animation. Drive `open`/`onOpenChange`
 * from your own ⌘K key handler; rows close it on select by default.
 */
export function CommandDialog({
  open,
  defaultOpen,
  onOpenChange,
  title = "Command palette",
  description = "Search for a command to run.",
  closeOnSelect = true,
  onSelect,
  className,
  children,
  ...commandProps
}: CommandDialogProps) {
  const { density: slotsDensity } = commandProps
  const slots = commandVariants({ density: useDensity(slotsDensity) })

  return (
    <DialogPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={slots.overlay()} />
        <div className={slots.positioner()}>
          <DialogPrimitive.Content data-slot="command-dialog" className={slots.dialog({ className })}>
            <VisuallyHidden.Root>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
            </VisuallyHidden.Root>
            <CommandDialogContext.Provider value>
              <Command
                {...commandProps}
                onSelect={(value) => {
                  onSelect?.(value)
                  if (closeOnSelect) onOpenChange?.(false)
                }}
              >
                {children}
              </Command>
            </CommandDialogContext.Provider>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
