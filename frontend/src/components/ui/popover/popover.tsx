"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { tv, type VariantProps } from "@/lib/tv"
import { useDensity } from "@/lib/density"

/**
 * Popover: the general-purpose floating surface over Radix Popover (focus management,
 * dismiss, collision-aware positioning). Where DropdownMenu is for action menus and
 * Tooltip for hover hints, Popover hosts arbitrary content: forms, pickers, info cards.
 *
 * Named parts, not dot-notation (RSC-safe). The content shell matches the rest of the DS
 * (`bg-popover`, soft border, layered shadow, fade + zoom + slide enter and a softer exit)
 * and exposes `--surface` so nested Inputs/Selects blend with the panel, not the page.
 * `density` tunes the content padding (and nothing else). See docs/ARCHITECTURE.md.
 */

export const popoverVariants = tv({
  slots: {
    // The soft edge is an inset ring, not a `border`: a border would push the padding box in by 1px
    // and throw every inset part below (media, footer) off the concentric corner by that pixel.
    content: [
      "z-50 w-72 rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-border-soft ring-inset outline-none",
      // Nested controls read this so they paint the panel surface, not a --background block.
      "[--surface:var(--popover)]",
      // Enter: fade + zoom + directional slide. Exit: fade + zoom only, and snappier, softer
      // than the enter (polish).
      "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      "data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2",
      "data-[state=open]:duration-fast data-[state=closed]:duration-[100ms] ease-out",
    ],
    // The arrow is filled with the panel color; the soft border doesn't trace it (kept simple,
    // matching how the rest of the DS treats popover arrows).
    arrow: "fill-popover",
    title: "text-base font-semibold leading-none tracking-tight text-foreground",
    description: "text-sm text-muted-foreground",
    // Inset parts (docs/ARCHITECTURE.md, "Inset media"): a picture or a footer never bleeds to the
    // panel's edges and never sits behind a divider line; it is a nested surface set in from the
    // edge. Both pull 8px into the padding at every density, so what's left is the inset: 8px of
    // the comfortable 16, 4px of the compact 12. The radius follows the inset down the ladder
    // (rounded-lg 16 − 8 = rounded-sm 8, 16 − 4 = rounded-md 12), which the density variant hands
    // over as `--popover-inset-radius` so a part needs no density of its own.
    //
    // Media: the frame owns its ratio (aspect-video, override with className), shows a muted fill
    // while the file loads, and draws its edge as an ::after ring OVER the picture, since an inset
    // ring on the img or its wrapper would paint under it. It pulls into the edge it opens or
    // closes the panel on. `showArrow` appends Radix's arrow (a bare styled <span>) after the
    // children, so "closes the panel" also means "followed only by that span".
    media: [
      "relative -mx-2 first:-mt-2 last:-mb-2 [&:has(+span[style]:last-child)]:-mb-2 aspect-video overflow-hidden rounded-(--popover-inset-radius) bg-muted",
      "[&>img]:size-full [&>img]:object-cover [&>video]:size-full [&>video]:object-cover",
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/10 dark:after:ring-white/10",
    ],
    // Footer: a muted well that closes the panel (the counts under a commit, the stats under a
    // profile), where a divider line and a row would otherwise go. It is always last, so it always
    // pulls into the bottom padding. Its 8px of padding puts the text back on the copy's line at
    // either density. It declares `--surface`, so a control inside paints the well, not the panel.
    footer:
      "-mx-2 mt-3 -mb-2 flex items-center gap-3 rounded-(--popover-inset-radius) bg-muted p-2 text-sm [--surface:var(--muted)]",
    close: [
      "absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md",
      "text-muted-foreground cursor-pointer transition-[background-color,color,scale] duration-fast ease-out",
      "hover:bg-accent hover:text-foreground active:scale-[0.96]",
      "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
      "[&_svg]:size-4 [&_svg]:shrink-0",
    ],
  },
  variants: {
    density: {
      comfortable: { content: "p-4 [--popover-inset-radius:var(--radius-sm)]" },
      compact: { content: "p-3 [--popover-inset-radius:var(--radius-md)]" },
    },
  },
  defaultVariants: { density: "comfortable" },
})

// ─── Root / Trigger / Anchor / Close (behavioral passthroughs) ──────────────────

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverAnchor = PopoverPrimitive.Anchor
export const PopoverClose = PopoverPrimitive.Close

// ─── Content ─────────────────────────────────────────────────────────────────────

export interface PopoverContentProps
  extends React.ComponentProps<typeof PopoverPrimitive.Content>,
    VariantProps<typeof popoverVariants> {
  /** Render a small pointer toward the trigger. @default false */
  showArrow?: boolean
}

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  density,
  showArrow = false,
  children,
  ...props
}: PopoverContentProps) {
  const slots = popoverVariants({ density: useDensity(density) })
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={slots.content({ className })}
        {...props}
      >
        {children}
        {showArrow && <PopoverPrimitive.Arrow className={slots.arrow()} width={12} height={6} />}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

// ─── Optional structured-content helpers ────────────────────────────────────────

/** A semantic title for the panel. Pair with `aria-labelledby` on the content if needed. */
export function PopoverTitle({ className, ...props }: React.ComponentProps<"h4">) {
  const { title } = popoverVariants()
  return <h4 data-slot="popover-title" className={title({ className })} {...props} />
}

/** Muted supporting copy under a `PopoverTitle`. */
export function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { description } = popoverVariants()
  return <p data-slot="popover-description" className={description({ className })} {...props} />
}

/**
 * A picture, video or screenshot set 8px in from the panel's edges (4px compact), with concentric
 * corners. Put it first or last; it pulls into that edge. Aspect-video by default.
 */
export function PopoverMedia({ className, ...props }: React.ComponentProps<"div">) {
  const { media } = popoverVariants()
  return <div data-slot="popover-media" className={media({ className })} {...props} />
}

/** A muted well that closes the panel, inset like the media. Always the last part. */
export function PopoverFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { footer } = popoverVariants()
  return <div data-slot="popover-footer" className={footer({ className })} {...props} />
}

/**
 * A styled close (×) button anchored to the panel's top-right. Wraps Radix `Popover.Close`,
 * so it dismisses the popover with no extra wiring. Pass your own icon as the child.
 */
export function PopoverCloseButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Close>) {
  const { close } = popoverVariants()
  return (
    <PopoverPrimitive.Close data-slot="popover-close" className={close({ className })} {...props}>
      {children}
    </PopoverPrimitive.Close>
  )
}
