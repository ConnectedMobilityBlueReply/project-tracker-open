import * as React from "react"
import { Slot } from "radix-ui"
import { X } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"

/**
 * Badge: a single-element component (like Button): one `tv` recipe, semantic tokens
 * only, `className` merged last. Status variants (success/warning/info/destructive) are
 * "soft": a tinted background (the status hue at /10) plus a darker, more legible text
 * counterpart (the `-strong` token, see globals.css) and no border, so the fill carries the
 * color and the text stays readable. They re-theme across all four themes. See docs/ARCHITECTURE.md.
 */
export const badgeVariants = tv({
  base: [
    "inline-flex items-center justify-center shrink-0 whitespace-nowrap",
    // Border always present but transparent: it reserves the hairline so the `outline` and
    // `dot` variants can paint a neutral stroke without shifting layout. Tinted (soft)
    // variants keep it transparent: a background fill already carries the color.
    "rounded-md border border-transparent font-medium",
    // A badge is the DS's count chip (tabs, nav rows, filters): tabular-nums so a live count
    // ticking 9 → 10 never nudges the row. Only digits change width; word labels are untouched.
    "tabular-nums",
    "transition duration-fast ease-out",
  ],
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      primary: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
      outline: "border-border text-foreground",
      success: "bg-success/10 text-success-strong",
      warning: "bg-warning/10 text-warning-strong",
      info: "bg-info/10 text-info-strong",
      destructive: "bg-destructive/10 text-destructive-strong",
      purple: "bg-purple/10 text-purple",
      pink: "bg-pink/10 text-pink",
      teal: "bg-teal/10 text-teal",
      orange: "bg-orange/10 text-orange",
      // ── Over media ──────────────────────────────────────────────────────────
      // The 12 tones above all assume a page ground. These two are for a chip sitting ON a
      // photo, where the ground is whatever the image happens to be. Both carry white text and
      // paint their hairline with the border the base already reserves, so neither shifts layout.
      // Pick by what is behind the chip, not by taste:
      //   overlay      a dark pill, for a bright or unscrimmed photo.
      //   overlayLight a frosted light pill, for a dark photo or one already under a scrim,
      //                where a dark pill would sink into the gradient instead of sitting on it.
      overlay: "border-white/15 bg-black/45 text-white",
      overlayLight: "border-white/25 bg-white/15 text-white backdrop-blur-md",    },
    size: {
      sm: "gap-1 px-1.5 py-0.5 text-xs [&>svg]:size-3",
      md: "gap-1.5 px-2 py-1 text-xs [&>svg]:size-3.5",
      lg: "gap-1.5 px-2.5 py-1 text-sm [&>svg]:size-4",
    },
    pill: {
      true: "rounded-full",
    },
    dot: {
      true: "",
    },
  },
  compoundVariants: [
    {
      dot: true,
      variant: ["default", "primary", "secondary", "success", "warning", "info", "destructive", "purple", "pink", "teal", "orange"],
      // dot variant: strip the variant fill and tinted border so only the dot carries the
      // color; the hairline falls back to the neutral stroke (like the `outline` variant), and
      // the label steps back to foreground while the root's text color stays the dot's.
      // Deliberately excludes the `overlay*` tones: over a photo the fill IS the chip, and a
      // foreground label would go black on the image.
      class: "border-border bg-transparent [&>[data-slot=badge-label]]:text-foreground",
    },
  ],
  defaultVariants: {
    variant: "default",
    size: "md",
  },
})

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  /** Render the child element as the badge (Radix Slot). Ignores `dot`/`onRemove`. */
  asChild?: boolean
  /**
   * Show a leading status dot in the current text color. Passing it as a boolean (even `false`)
   * keeps the dot's slot mounted, so flipping it animates: the dot grows in and the fill gives
   * way to the hairline, instead of the badge swapping treatments in one frame.
   */
  dot?: boolean
  /** When set, renders a trailing dismiss button that calls this handler. */
  onRemove?: () => void
  /** Accessible label for the dismiss button. */
  removeLabel?: string
}

export function Badge({
  className,
  variant,
  size,
  pill,
  asChild = false,
  dot,
  onRemove,
  removeLabel = "Remove",
  children,
  ...props
}: BadgeProps) {
  const classes = badgeVariants({ variant, size, pill, dot: !!dot, className })
  // A badge that never mentions `dot` renders no dot slot at all. One that passes it, `false`
  // included, is a badge whose dot can change, so the slot stays mounted to animate both ways.
  const dotSlot = dot !== undefined

  // asChild composes the styles onto a consumer element (e.g. a link); the dot/dismiss
  // affordances require our own element, so they're omitted in that mode.
  if (asChild) {
    return (
      <Slot.Root data-slot="badge" className={classes} {...props}>
        {children}
      </Slot.Root>
    )
  }

  return (
    <span data-slot="badge" className={classes} {...props}>
      {dotSlot && (
        <span
          aria-hidden
          data-slot="badge-dot"
          className={cn(
            "h-1.5 shrink-0 rounded-full bg-current",
            // Width, not just scale, so the label slides over as the dot makes room. Named
            // props only (`scale` is its own property in v4, not `transform`).
            "transition-[width,margin,scale,opacity] duration-base ease-out motion-reduce:transition-none",
            // Off: no width, and a negative end margin the size of the flex gap cancels the gap
            // it would still take, so an off badge measures exactly like one with no dot slot.
            dot ? "w-1.5" : ["w-0 scale-0 opacity-0", size === "sm" ? "-me-1" : "-me-1.5"],
          )}
        />
      )}
      {dotSlot ? (
        // The label's color is the recipe's call, not this file's: with a page-ground tone the
        // dot compound steps it back to foreground, while an `overlay*` tone keeps the root's white.
        // Its own color transition, so the swap tweens alongside the root's fill.
        <span data-slot="badge-label" className="transition-colors duration-fast ease-out">
          {children}
        </span>
      ) : (
        children
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          // polish: the visual is small, but `before` extends the
          // hit area beyond the glyph without enlarging the badge.
          className={cn(
            "relative -mr-0.5 grid size-3.5 shrink-0 place-items-center rounded-full",
            "text-current/60 transition-colors duration-fast ease-out",
            "hover:bg-current/15 hover:text-current",
            "outline-none focus-visible:ring-2 focus-visible:ring-current/40",
            "before:absolute before:-inset-1 before:content-['']",
            "[&>svg]:size-3 [&>svg]:pointer-events-none",
          )}
        >
          <X weight="bold" />
        </button>
      )}
    </span>
  )
}
