"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { CaretDown, Check, MagnifyingGlass } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { type VariantProps } from "@/lib/tv"
import { useControlSize, useDensity, type Density } from "@/lib/density"
import { useFieldContext } from "@/lib/field-context"
import { createContext } from "@/lib/create-context"
import { InputField, InputPrefix, InputRoot } from "@/components/ui/input/input"
import { selectVariants } from "./select"

/**
 * SelectSearch: a Select whose list you can type into. One value, same trigger, same panel,
 * plus a search field that filters the options as you go.
 *
 * Why it isn't a `SelectSearch` part dropped inside `SelectContent`: Radix Select's content owns
 * the keyboard (its type-ahead swallows every character), pulls focus onto the selected item, and
 * only ever exists as a portalled, focus-trapped overlay that `aria-hidden`s the rest of the page
 * and locks scrolling. None of that can host a text field, and none of it can render in the page
 * flow. So, exactly like `MultiSelect` (single-value Radix Select couldn't host checkboxes), this
 * is built on Radix Popover and dressed in `selectVariants` - the SAME recipe Select uses - so the
 * trigger, panel, rows, check, labels and separators can never drift from their Select twins.
 *
 * Two mounts, like Command / CommandDialog:
 * - default: the panel floats over the page on a Popover, anchored to the trigger.
 * - `inline`: the panel renders in the page flow under the trigger, for a picker that lives
 *   inside a form or a panel instead of over it. In flow it paints no fill and no shadow
 *   (fill is elevation), just the hairline.
 *
 * Keyboard: focus stays in the search field the whole time, so typing never stops. Arrows (and
 * Home/End) rove a highlight over the rows as a DOM attribute, Enter commits the active row, and
 * the row is announced through `aria-activedescendant`. The same DOM-attribute roving the Command
 * palette uses, which keeps the strict react-hooks lint out of it (no set-state-in-effect).
 *
 * Named parts, not dot-notation (RSC-safe). Cross-part state flows through a typed Context.
 */

// ─── Filtering ──────────────────────────────────────────────────────────────────

/** Scoring filter: 0 hides the row, any positive number keeps it. An empty query keeps all. */
export type SelectSearchFilter = (
  query: string,
  value: string,
  keywords?: string[],
) => number

const defaultFilter: SelectSearchFilter = (query, value, keywords) => {
  const q = query.trim().toLowerCase()
  if (!q) return 1
  const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase()
  return haystack.includes(q) ? 1 : 0
}

// ─── Roving DOM helpers ─────────────────────────────────────────────────────────
// Layout offsets (offsetTop/offsetHeight), never getBoundingClientRect: the panel is measured
// mid zoom-in, and a transformed ancestor hands back scaled rects.

/** `el`'s offset inside `container` (a positioned ancestor), summed up the offsetParent chain. */
function offsetWithin(el: HTMLElement, container: HTMLElement) {
  let top = 0
  let node: HTMLElement | null = el
  while (node && node !== container) {
    top += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return top
}

/**
 * Scroll ONLY the list so `el` clears its scroll-padding (the fade band). Unlike `scrollIntoView`,
 * this never scrolls the page, so an inline picker below the fold doesn't yank the document to
 * itself on mount or while arrowing. (Same math as the Command palette's `scrollIntoList`, kept
 * local so the Select family ships without the palette.)
 */
function scrollIntoList(list: HTMLElement, el: HTMLElement) {
  if (list.scrollHeight <= list.clientHeight) return
  const style = getComputedStyle(list)
  const padTop = parseFloat(style.scrollPaddingTop) || 0
  const padBottom = parseFloat(style.scrollPaddingBottom) || 0
  const top = offsetWithin(el, list)
  const bottom = top + el.offsetHeight
  if (top - padTop < list.scrollTop) list.scrollTop = top - padTop
  else if (bottom + padBottom > list.scrollTop + list.clientHeight)
    list.scrollTop = bottom + padBottom - list.clientHeight
}

// ─── Context ────────────────────────────────────────────────────────────────────

type SelectSlots = ReturnType<typeof selectVariants>

const [SelectSearchProvider, useSelectSearchContext] = createContext<{
  value: string
  label: React.ReactNode
  select: (value: string, label: React.ReactNode) => void
  open: boolean
  setOpen: (open: boolean) => void
  query: string
  setQuery: (query: string) => void
  filter: SelectSearchFilter
  inline: boolean
  density: Density
  slots: SelectSlots
  disabled: boolean
  inputId: string
  listId: string
  contentRef: React.RefObject<HTMLDivElement | null>
  listRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  getItems: () => HTMLElement[]
  setActive: (el: HTMLElement | null) => void
}>("SelectSearch")

// ─── SelectSearch (root) ────────────────────────────────────────────────────────

export interface SelectSearchProps
  // `panel` is not a consumer knob: `inline` picks it, so the trigger and the panel always agree.
  extends Omit<VariantProps<typeof selectVariants>, "panel"> {
  /** Controlled value. Pair with `onValueChange`. */
  value?: string
  /** Initial value when uncontrolled. */
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Controlled open state of the panel. */
  open?: boolean
  /** Panel state on mount when uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Render the panel in the page flow under the trigger instead of floating it on a Popover. */
  inline?: boolean
  /** Override the match function. Return 0 to hide a row, any positive number to keep it. */
  filter?: SelectSearchFilter
  /** Renders a hidden input so the value posts with a native form submit. */
  name?: string
  disabled?: boolean
  /** Only the `inline` root renders a node of its own; a floating one has nothing to style. */
  className?: string
  children?: React.ReactNode
}

export function SelectSearch({
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  inline = false,
  filter = defaultFilter,
  name,
  size,
  density,
  disabled,
  className,
  children,
}: SelectSearchProps) {
  const d = useDensity(density)
  // Trigger height comes from `size`; density only picks the DEFAULT size (compact → sm,
  // comfortable → md), so a bare SelectSearch stands level with the Select beside it.
  const slots = selectVariants({
    size: useControlSize(size, density),
    density: d,
    panel: inline ? "inline" : "floating",
  })
  const field = useFieldContext()

  // Controlled/uncontrolled value + open, hand-rolled to keep the lint-strict rules happy.
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "")
  const selected = isControlled ? value : internalValue

  const isOpenControlled = open !== undefined
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isOpen = isOpenControlled ? open : internalOpen

  const [query, setQuery] = React.useState("")
  // The label is captured at pick time (the rows only exist while the panel is open, so the
  // trigger can't look one up later). Seed a value from outside and the trigger has nothing to
  // draw yet: that's what `renderValue` on SelectSearchValue is for.
  const [label, setLabel] = React.useState<React.ReactNode>(null)

  const reactId = React.useId()
  const inputId = `${reactId}-input`
  const listId = `${reactId}-list`
  const contentRef = React.useRef<HTMLDivElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isOpenControlled) setInternalOpen(next)
      onOpenChange?.(next)
      // A panel that closed forgets what was typed into it: it reopens on the full list.
      if (!next) setQuery("")
    },
    [isOpenControlled, onOpenChange],
  )

  const select = React.useCallback(
    (next: string, nextLabel: React.ReactNode) => {
      if (!isControlled) setInternalValue(next)
      setLabel(nextLabel)
      onValueChange?.(next)
      // A floating panel commits and closes, like Select. An inline one stays where it is (it
      // isn't covering anything), keeping the query so the results don't jump under the cursor.
      if (!inline) setOpen(false)
    },
    [isControlled, onValueChange, inline, setOpen],
  )

  // Rows and the active highlight live in the DOM (data-attributes), not React state, so
  // re-renders never fight the highlight and there's no registry to keep in sync. Everything is
  // scoped to the LIST, not to the panel: Radix mounts a floating panel one commit after `open`
  // flips (Presence schedules it), so the panel's own ref is still empty when the rows first
  // appear, while the list that holds them is right there with them.
  const getItems = React.useCallback(
    () =>
      Array.from(
        listRef.current?.querySelectorAll<HTMLElement>(
          '[data-slot="select-search-item"]:not([data-disabled])',
        ) ?? [],
      ),
    [],
  )

  const setActive = React.useCallback((el: HTMLElement | null) => {
    const list = listRef.current
    if (!list) return
    for (const item of list.querySelectorAll<HTMLElement>(
      '[data-slot="select-search-item"][data-active]',
    )) {
      item.removeAttribute("data-active")
    }
    if (!el) {
      inputRef.current?.removeAttribute("aria-activedescendant")
      return
    }
    el.setAttribute("data-active", "true")
    inputRef.current?.setAttribute("aria-activedescendant", el.id)
    scrollIntoList(list, el)
  }, [])

  const body = (
    <>
      {children}
      {name ? <input type="hidden" name={name} value={selected} /> : null}
    </>
  )

  return (
    <SelectSearchProvider
      value={selected}
      label={label}
      select={select}
      open={isOpen}
      setOpen={setOpen}
      query={query}
      setQuery={setQuery}
      filter={filter}
      inline={inline}
      density={d}
      slots={slots}
      disabled={disabled ?? field?.disabled ?? false}
      inputId={inputId}
      listId={listId}
      contentRef={contentRef}
      listRef={listRef}
      inputRef={inputRef}
      getItems={getItems}
      setActive={setActive}
    >
      {inline ? (
        // The trigger and the panel are stacked siblings in flow, so the root owns the gap
        // between them (drop either part and nothing is left dangling).
        <div data-slot="select-search" className={cn("flex flex-col gap-2", className)}>
          {body}
        </div>
      ) : (
        <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
          {body}
        </PopoverPrimitive.Root>
      )}
    </SelectSearchProvider>
  )
}

// ─── SelectSearchTrigger ────────────────────────────────────────────────────────

export type SelectSearchTriggerProps = Omit<React.ComponentProps<"button">, "type">

export function SelectSearchTrigger({
  className,
  children,
  id,
  onClick,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SelectSearchTriggerProps) {
  const { slots, inline, open, setOpen, listId, disabled } =
    useSelectSearchContext("SelectSearchTrigger")
  // Surrounding Field (if any) supplies the id + aria wiring; explicit props still win.
  const field = useFieldContext()

  const button = (
    // eslint-disable-next-line jsx-a11y/role-supports-aria-props -- see aria-invalid below
    <button
      type="button"
      data-slot="select-search-trigger"
      data-state={open ? "open" : "closed"}
      id={id ?? field?.id}
      disabled={disabled}
      // A button that discloses the panel, and nothing more: the combobox is the search field
      // inside it (CountrySelect puts the role here because its panel's field is a plain input).
      // Keeping the native button role is what lets the trigger take its accessible name from
      // the value it shows - `combobox` doesn't support name-from-content, so the label would
      // have to be repeated by hand on every instance, and be missing the day someone forgets.
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={listId}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      // The trigger IS the form control here (it holds the value and takes the Field's wiring),
      // so it carries the invalid state exactly like SelectTrigger does, and the shared recipe
      // turns it red off this attribute. ARIA reserves `aria-invalid` for roles that take a
      // value, which `button` formally isn't; the alternative is `role="combobox"`, and that
      // costs the trigger its name-from-content - a worse trade for something a consumer can
      // forget. The error text still reaches AT through `aria-describedby`.
      aria-invalid={field?.hasError || undefined}
      className={slots.trigger({ className })}
      onClick={(event) => {
        onClick?.(event)
        // The Popover trigger toggles itself; an inline panel has no primitive to do it.
        if (inline && !event.defaultPrevented) setOpen(!open)
      }}
      {...props}
    >
      {children}
      <CaretDown weight="bold" className={slots.chevron()} />
    </button>
  )

  if (inline) return button
  return <PopoverPrimitive.Trigger asChild>{button}</PopoverPrimitive.Trigger>
}

// ─── SelectSearchValue ──────────────────────────────────────────────────────────

export interface SelectSearchValueProps extends React.ComponentProps<"span"> {
  /** Shown while nothing is selected. */
  placeholder?: React.ReactNode
  /**
   * Draw the selected value yourself. Needed when the value is seeded from outside (a
   * `defaultValue`, a controlled value, a saved form): the option rows only exist while the
   * panel is open, so the trigger can only remember a label the user picked in this session.
   */
  renderValue?: (value: string) => React.ReactNode
}

export function SelectSearchValue({
  className,
  placeholder,
  renderValue,
  ...props
}: SelectSearchValueProps) {
  const { value, label, slots } = useSelectSearchContext("SelectSearchValue")
  const picked = value ? (renderValue?.(value) ?? label ?? value) : null
  return (
    <span
      data-slot="select-search-value"
      data-placeholder={picked ? undefined : ""}
      className={slots.searchValue({
        // Matches Select's trigger: the placeholder reads lighter than a chosen value.
        className: cn(!picked && "font-normal text-muted-foreground", className),
      })}
      {...props}
    >
      {picked ?? placeholder}
    </span>
  )
}

// ─── SelectSearchContent ────────────────────────────────────────────────────────

export type SelectSearchContentProps = React.ComponentProps<typeof PopoverPrimitive.Content>

export function SelectSearchContent({
  className,
  children,
  onKeyDown,
  // Popper + layer props are pulled out by name rather than spread blindly: `inline` renders a
  // plain div, and `collisionPadding` or `onEscapeKeyDown` on a <div> is a React warning.
  align = "start",
  sideOffset = 6,
  side,
  alignOffset,
  avoidCollisions,
  collisionBoundary,
  collisionPadding,
  arrowPadding,
  sticky,
  hideWhenDetached,
  forceMount,
  asChild,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: SelectSearchContentProps) {
  const {
    slots,
    inline,
    open,
    query,
    setQuery,
    contentRef,
    inputRef,
    getItems,
    setActive,
  } = useSelectSearchContext("SelectSearchContent")

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const items = getItems()
    if (event.key === "Enter") {
      const active = items.find((el) => el.getAttribute("data-active") === "true")
      if (active) {
        event.preventDefault()
        active.click()
      }
      return
    }
    if (event.key === "Escape" && inline) {
      // Nothing to dismiss in flow, so Escape empties the field instead (and only then).
      if (query) {
        event.preventDefault()
        setQuery("")
      }
      return
    }
    // Home/End belong to the caret while focus is in the search field.
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return
    if (items.length === 0) return
    event.preventDefault()
    const current = items.findIndex((el) => el.getAttribute("data-active") === "true")
    const next =
      event.key === "ArrowDown"
        ? current < items.length - 1
          ? current + 1
          : 0
        : current > 0
          ? current - 1
          : items.length - 1
    setActive(items[next] ?? null)
  }

  const panel = slots.content({
    className: cn(
      inline
        ? // In the page flow, so it paints no fill and no shadow (fill is elevation): the
          // hairline is the whole frame, and nested controls keep reading the real ground.
          "z-auto w-full bg-transparent shadow-none [--surface:inherit]"
        : // Exactly the trigger's width, like CountrySelect and MultiSelect: the open pair reads
          // as one control, and the search field can't jump wider than the field it drops from.
          // Size the trigger to its longest option, or long labels wrap onto a second line.
          "w-[var(--radix-popover-trigger-width)]",
      className,
    ),
  })

  if (inline) {
    if (!open) return null
    return (
      <div
        ref={contentRef}
        data-slot="select-search-content"
        data-state="open"
        className={panel}
        onKeyDown={handleKeyDown}
        {...(props as React.ComponentProps<"div">)}
      >
        {children}
      </div>
    )
  }

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={contentRef}
        data-slot="select-search-content"
        align={align}
        sideOffset={sideOffset}
        side={side}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionBoundary={collisionBoundary}
        collisionPadding={collisionPadding}
        arrowPadding={arrowPadding}
        sticky={sticky}
        hideWhenDetached={hideWhenDetached}
        forceMount={forceMount}
        asChild={asChild}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={onEscapeKeyDown}
        onPointerDownOutside={onPointerDownOutside}
        onFocusOutside={onFocusOutside}
        onInteractOutside={onInteractOutside}
        className={panel}
        onKeyDown={handleKeyDown}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (event.defaultPrevented) return
          // The search field takes the focus, not the first row. With no search field in the
          // panel, Radix's own focus handling stands.
          if (inputRef.current) {
            event.preventDefault()
            inputRef.current.focus()
          }
        }}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

// ─── SelectSearchInput ──────────────────────────────────────────────────────────

export interface SelectSearchInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "size"> {
  /** Class for the wrapper that insets the field; `inputClassName` styles the field itself. */
  className?: string
  inputClassName?: string
}

export function SelectSearchInput({
  className,
  inputClassName,
  placeholder = "Search…",
  "aria-label": ariaLabel = "Search options",
  ...props
}: SelectSearchInputProps) {
  const { slots, query, setQuery, inputId, listId, inputRef } =
    useSelectSearchContext("SelectSearchInput")
  return (
    <div className={slots.search({ className })}>
      {/* The canonical Input, never a hand-rolled field: the panel's search reads like every
          other control in the system. `size="sm"` belongs to the panel, not to the trigger's
          tier, so it stays put at either density (same call CountrySelect makes). */}
      <InputRoot size="sm">
        <InputPrefix>
          <MagnifyingGlass weight="bold" />
        </InputPrefix>
        <InputField
          ref={inputRef}
          id={inputId}
          data-slot="select-search-input"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          // The field IS the combobox: it filters a listbox that is already open, and it carries
          // the active row for assistive tech through `aria-activedescendant` (set imperatively
          // by the roving, so re-renders never fight it). Same wiring as the Command palette.
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-label={ariaLabel}
          aria-controls={listId}
          placeholder={placeholder}
          className={inputClassName}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          {...props}
        />
      </InputRoot>
    </div>
  )
}

// ─── SelectSearchList ───────────────────────────────────────────────────────────

export interface SelectSearchListProps extends React.ComponentProps<"div"> {
  /** Accessible name for the list of options. */
  label?: string
}

export function SelectSearchList({
  className,
  label = "Options",
  ...props
}: SelectSearchListProps) {
  const { slots, listId, listRef, value, query, getItems, setActive } =
    useSelectSearchContext("SelectSearchList")

  // Point the highlight at the selected row when the list appears on a clean query, and at the
  // first match on every keystroke after that. It lives here, not on the content, because the
  // list mounts in the same commit as the rows it holds (a floating panel mounts a commit after
  // `open` flips). Pure DOM side effect, no setState, so the strict lint stays out of it.
  React.useLayoutEffect(() => {
    const items = getItems()
    const preferred = query ? undefined : items.find((el) => el.dataset.value === value)
    setActive(preferred ?? items[0] ?? null)
  }, [query, value, getItems, setActive])

  return (
    <div
      ref={listRef}
      id={listId}
      data-slot="select-search-list"
      role="listbox"
      aria-label={label}
      className={slots.list({ className })}
      {...props}
    />
  )
}

// ─── SelectSearchItem ───────────────────────────────────────────────────────────

export interface SelectSearchItemProps
  extends Omit<React.ComponentProps<"div">, "onSelect"> {
  /** The value this row commits. */
  value: string
  /** What the search matches against. Defaults to `value`; give it the visible label. */
  textValue?: string
  /** Extra terms that should also match this row (a handle, a synonym, a code). */
  keywords?: string[]
  disabled?: boolean
  /** Fires before the row commits, e.g. to run a side effect. */
  onSelect?: (value: string) => void
}

export function SelectSearchItem({
  className,
  children,
  value,
  textValue,
  keywords,
  disabled,
  onSelect,
  onClick,
  onPointerMove,
  ...props
}: SelectSearchItemProps) {
  const {
    value: selected,
    select,
    query,
    filter,
    slots,
    setActive,
  } = useSelectSearchContext("SelectSearchItem")
  const id = React.useId()

  // Filtering is a pure-render decision per row: a row that doesn't match renders nothing, so
  // empty groups, the empty state and orphaned separators all collapse with plain CSS.
  if (filter(query, textValue ?? value, keywords) === 0) return null

  const isSelected = selected === value
  return (
    <div
      id={id}
      data-slot="select-search-item"
      data-value={value}
      data-disabled={disabled ? "" : undefined}
      data-state={isSelected ? "checked" : "unchecked"}
      role="option"
      aria-selected={isSelected}
      aria-disabled={disabled || undefined}
      className={slots.item({ className })}
      onPointerMove={(event) => {
        onPointerMove?.(event)
        // Pointer and keyboard share ONE highlight: sweeping the mouse moves the same mark the
        // arrows do, so the panel never shows two active rows.
        if (!disabled) setActive(event.currentTarget)
      }}
      onClick={(event) => {
        onClick?.(event)
        if (disabled || event.defaultPrevented) return
        onSelect?.(value)
        select(value, children)
      }}
      {...props}
    >
      <span className={slots.itemIndicator()}>
        {isSelected ? <Check weight="bold" className="size-4" /> : null}
      </span>
      <span>{children}</span>
    </div>
  )
}

// ─── SelectSearchGroup · Label · Separator · Empty ──────────────────────────────

export function SelectSearchGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="select-search-group"
      role="group"
      // Collapses (label and all) the instant every row inside it filters out.
      className={cn("not-has-[[data-slot=select-search-item]]:hidden", className)}
      {...props}
    />
  )
}

export function SelectSearchLabel({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSelectSearchContext("SelectSearchLabel")
  return <div data-slot="select-search-label" className={slots.label({ className })} {...props} />
}

export function SelectSearchSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useSelectSearchContext("SelectSearchSeparator")
  return (
    <div
      data-slot="select-search-separator"
      role="separator"
      className={slots.separator({ className })}
      {...props}
    />
  )
}

export function SelectSearchEmpty({
  className,
  children = "No results found.",
  ...props
}: React.ComponentProps<"div">) {
  const { slots } = useSelectSearchContext("SelectSearchEmpty")
  return (
    <div data-slot="select-search-empty" role="presentation" className={slots.empty({ className })} {...props}>
      {children}
    </div>
  )
}
