import * as React from "react"

import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"

/**
 * Skeleton: a loading placeholder that mirrors the shape of the content it stands in for.
 * Single-element like Badge: one `tv` recipe, semantic tokens only, `className` merged last.
 *
 * The fill is `bg-muted` so it re-themes across all four themes. Two animations are offered:
 * `pulse` (the default, Tailwind's built-in opacity breathe) and `shimmer` (a swept highlight
 * driven by the `--animate-shimmer` motion token). Both are decorative and stop under
 * `prefers-reduced-motion` (see globals.css).
 *
 * A11y: skeletons are decorative, so each rendered element is `aria-hidden` by default.
 * Announce loading once on the region instead (e.g. `<div aria-busy="true">…skeletons…</div>`)
 * rather than letting every placeholder shout at a screen reader.
 */
export const skeletonVariants = tv({
  base: [
    "block shrink-0 bg-muted",
    // `relative overflow-hidden` clips the shimmer overlay to the placeholder's rounded box.
    "relative overflow-hidden",
  ],
  variants: {
    variant: {
      // Concentric-friendly default; pair with explicit width/height via `className`.
      rectangle: "rounded-md",
      // Avatar/icon placeholder: square aspect so a single `size-*` reads as a circle.
      circle: "aspect-square rounded-full",
      // Text line: `1lh` matches the surrounding line-height exactly, so a text skeleton
      // occupies the same vertical space as the copy it replaces. Width defaults to full.
      text: "h-[1lh] w-full rounded-sm",
    },
    animation: {
      pulse: "animate-pulse",
      shimmer: [
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-foreground/10 after:to-transparent",
        // Promote only the swept overlay to its own layer: the transform runs continuously,
        // the one documented case for will-change (#15). Scoped to ::after, not the box.
        "after:[will-change:transform]",
      ],
      none: "",
    },
  },
  defaultVariants: {
    variant: "rectangle",
    animation: "pulse",
  },
})

export interface SkeletonProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof skeletonVariants> {
  /**
   * With `variant="text"`, render this many stacked lines (the last one shortened, the way
   * a real paragraph's final line wraps short). The `className` styles the group; line
   * spacing is handled internally. Ignored for other variants and for `lines <= 1`.
   */
  lines?: number
}

export function Skeleton({
  className,
  variant = "rectangle",
  animation,
  lines,
  ...props
}: SkeletonProps) {
  // Multi-line text block: a paragraph-shaped placeholder. The wrapper carries the
  // consumer's layout className; each line is an aria-hidden text skeleton.
  if (variant === "text" && lines && lines > 1) {
    return (
      <div className={cn("flex w-full flex-col gap-2.5", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            data-slot="skeleton"
            className={skeletonVariants({
              variant,
              animation,
              // Final line wraps short, like real running text.
              className: i === lines - 1 ? "w-3/5" : undefined,
            })}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={skeletonVariants({ variant, animation, className })}
      {...props}
    />
  )
}
