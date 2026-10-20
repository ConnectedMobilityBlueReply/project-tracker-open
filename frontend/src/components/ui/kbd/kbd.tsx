"use client"

// Kbd has no hooks/state of its own, but it's meant to live inside slots that client
// components render lazily on the client, most notably Tooltip `content` (Tippy renders
// it client-side) and menu shortcut rows. A server-only component placed in such a slot
// resolves to `undefined` on the client ("Element type is invalid"), so Kbd opts into the
// client graph to stay embeddable anywhere.
import * as React from "react"
import { Slot } from "radix-ui"

import { tv, type VariantProps } from "@/lib/tv"

/**
 * Kbd: a keyboard key indicator. A single-element component (like Badge): one `tv`
 * recipe, semantic tokens only, `className` merged last. Renders a native `<kbd>` so it
 * carries the right semantics for assistive tech and document outlines.
 *
 * The default variant is a flat gray chip: no border, no shadow, a translucent foreground
 * tint as the fill. Compose shortcuts by placing several side by side:
 * `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. See docs/ARCHITECTURE.md.
 */
export const kbdVariants = tv({
  base: [
    "inline-flex items-center justify-center shrink-0 whitespace-nowrap select-none",
    // Square-ish even for a single glyph: min-width tracks height so "K" and "Esc"
    // share a baseline. `font-mono` keeps multi-key rows mechanically aligned.
    // Radius is per-size (see below), not fixed on the base.
    "border font-mono font-medium tabular-nums",
    "transition duration-fast ease-out",
  ],
  variants: {
    variant: {
      // Gray chip: the default. Borderless (the border stays, transparent, so every variant
      // shares one box) and flat. The fill is a translucent foreground tint, not `bg-muted`:
      // `--accent` equals `--muted` in most themes, so a flat muted key would vanish on a
      // highlighted menu row. A tint composes over whatever it sits on (page, card, tooltip,
      // hovered row) and always reads one step darker.
      //
      // The one ground it can't compose over is the text Tooltip, an inverted chip whose fill IS
      // the foreground: a foreground tint vanishes there. So every variant carries a second set
      // of classes, scoped to `[data-slot=tooltip][data-variant=text]`, that swaps the roles and
      // builds the key from the chip's own ink (the page background) instead.
      default: [
        "border-transparent bg-foreground/8 text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background/15 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      // Alias of the default chip. It used to be the filled option when the default was an
      // outline cap; kept so existing call sites keep compiling and render the same gray key.
      soft: [
        "border-transparent bg-foreground/8 text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background/15 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      // Hairline cap over a transparent fill, for a key that should read lighter than the chip.
      outline: [
        "border-border bg-transparent text-muted-foreground",
        "[[data-slot=tooltip][data-variant=text]_&]:border-background/25 [[data-slot=tooltip][data-variant=text]_&]:text-background/80",
      ],
      // Inverted, high-contrast cap, for callouts and onboarding hints.
      solid: [
        "border-transparent bg-foreground text-background shadow-xs",
        "[[data-slot=tooltip][data-variant=text]_&]:bg-background [[data-slot=tooltip][data-variant=text]_&]:text-foreground",
      ],
      // No keycap at all, just the glyph as muted mono text. For inline ⌘K hints inside
      // buttons/inputs where a raised cap would read as a second, competing control.
      // The box sizing (height/min-width/padding) is stripped per size below.
      ghost: [
        "border-transparent bg-transparent text-muted-foreground shadow-none",
        "[[data-slot=tooltip][data-variant=text]_&]:text-background/70",
      ],
    },
    size: {
      // Radius scales with the cap: a constant 0.25x of the height (6px at the md default),
      // so the corner reads the same at every size. No token lands on 6px, hence the literals.
      sm: "h-5 min-w-5 gap-0.5 px-1 text-xs rounded-[5px] [&>svg]:size-3",
      md: "h-6 min-w-6 gap-1 px-1.5 text-xs rounded-[6px] [&>svg]:size-3.5",
      lg: "h-7 min-w-7 gap-1 px-2 text-sm rounded-[7px] [&>svg]:size-4",
    },
  },
  compoundVariants: [
    // Ghost is text, not a cap: drop the fixed height, min-width and padding at every size so
    // it flows inline like the surrounding label (the size's text/gap/svg scale still applies).
    {
      variant: "ghost",
      size: ["sm", "md", "lg"],
      class: "h-auto min-w-0 px-0",
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "md",
  },
})

export interface KbdProps
  extends React.ComponentProps<"kbd">,
    VariantProps<typeof kbdVariants> {
  /** Render the child element as the key (Radix Slot), e.g. to wrap a button. */
  asChild?: boolean
}

export function Kbd({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: KbdProps) {
  const Comp = asChild ? Slot.Root : "kbd"

  return (
    <Comp
      data-slot="kbd"
      className={kbdVariants({ variant, size, className })}
      {...props}
    />
  )
}
