"use client"

import * as React from "react"

import { tv, type VariantProps } from "@/lib/tv"
import { AvatarRoot, AvatarFallback } from "@/components/ui/avatar"
import { TooltipGroup } from "@/components/ui/tooltip"

/**
 * AvatarGroup: an overlapping stack of `Avatar`s with a `+N` overflow chip. The cluster
 * companion to Avatar, like BadgeGroup is to Badge: its own component, never a variant.
 *
 * The overlap (`-space-x-*` by size), the `ring-background` separation, and the hover lift all
 * live here as descendant utilities on the container (`[&>[data-slot=avatar]]:…`) so children
 * stay plain `Avatar`s: no cloning, no per-instance `ring`/`z` classes. See docs/ARCHITECTURE.md
 * (no `recursiveCloneChildren`).
 *
 * Pass the same `size` you give the children so the overflow chip matches. Cap the visible
 * count with `max`; the rest collapse into a chip. Use `total` when the real count is larger
 * than the avatars you render (e.g. a server count), and `renderOverflow` to swap the chip for
 * a richer affordance (a Tooltip listing the hidden people, a popover, a link).
 *
 * Tooltips are a singleton: the stack wraps its children in a `TooltipGroup` (no DOM node), so
 * any `Tooltip` on an avatar or on the overflow shares ONE bubble that glides across the stack
 * instead of each fading out and in.
 */
export const avatarGroupVariants = tv({
  base: [
    "flex items-center",
    // Separate each stacked avatar from its neighbour and the page surface.
    "[&>[data-slot=avatar]]:ring-2 [&>[data-slot=avatar]]:ring-background",
    // polish: lift the hovered avatar clear of the stack. Specific props only, never `all`.
    "[&>[data-slot=avatar]]:transition-transform [&>[data-slot=avatar]]:duration-fast [&>[data-slot=avatar]]:ease-out",
    "[&>[data-slot=avatar]:hover]:z-10 [&>[data-slot=avatar]:hover]:-translate-y-0.5",
  ],
  variants: {
    // Overlap tightens as the box grows so the stack reads as one cluster at any size.
    size: {
      xs: "-space-x-1.5",
      sm: "-space-x-2",
      md: "-space-x-2.5",
      lg: "-space-x-3.5",
      xl: "-space-x-4",
    },
  },
  defaultVariants: {
    size: "md",
  },
})

type AvatarGroupSize = NonNullable<VariantProps<typeof avatarGroupVariants>["size"]>

export interface AvatarGroupProps extends React.ComponentProps<"div"> {
  /** Box size for the overflow chip; pass the same value you set on the child avatars. @default "md" */
  size?: AvatarGroupSize
  /** Show at most this many avatars; the rest collapse into a `+N` chip. */
  max?: number
  /** Real total when it exceeds the rendered avatars (e.g. a server count) so `+N` reflects it. */
  total?: number
  /** Render a custom overflow affordance instead of the default chip (e.g. a Tooltip or link). */
  renderOverflow?: (overflow: number) => React.ReactNode
}

export function AvatarGroup({
  className,
  size = "md",
  max,
  total,
  renderOverflow,
  children,
  ...props
}: AvatarGroupProps) {
  const items = React.Children.toArray(children)
  const shown = max != null ? items.slice(0, max) : items
  // `total` lets the chip count people we never render; otherwise it's just the hidden children.
  const overflow = Math.max(0, (total ?? items.length) - shown.length)

  return (
    <div data-slot="avatar-group" className={avatarGroupVariants({ size, className })} {...props}>
      {/* One shared, gliding tooltip across the stack (Tippy singleton). */}
      <TooltipGroup>
        {shown}
        {overflow > 0 &&
          (renderOverflow ? (
            renderOverflow(overflow)
          ) : (
            <AvatarRoot size={size} aria-label={`${overflow} more`}>
              {/* maxInitials so the count isn't trimmed to a single glyph on xs/sm boxes. */}
              <AvatarFallback maxInitials={4} className="tabular-nums">
                {`+${overflow}`}
              </AvatarFallback>
            </AvatarRoot>
          ))}
      </TooltipGroup>
    </div>
  )
}
