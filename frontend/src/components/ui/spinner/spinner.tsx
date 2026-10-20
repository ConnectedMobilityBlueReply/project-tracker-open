"use client"

// Spinner has no state of its own, but like Kbd it has to be embeddable anywhere, including slots a
// client component renders lazily (Tooltip content, a toast, a menu row). A server-only component
// placed in such a slot resolves to `undefined` on the client, so Spinner opts into the client graph.
import { CircleNotch, type IconProps } from "@phosphor-icons/react"

import { tv, type VariantProps } from "@/lib/tv"

/**
 * Spinner: the one loading glyph. A single-element component (like Badge and Kbd): one `tv` recipe,
 * color from `currentColor`, `className` merged last. See docs/ARCHITECTURE.md.
 *
 * Size follows the host by default. With no `size`, the glyph carries no `size-*` class, so the
 * host's `[&_svg:not([class*='size-'])]` rule sets it: 16px in a Button or an input, 20px in a menu
 * row, 14px in a Badge. Outside any host it is Phosphor's `1em`, so it scales with the text beside
 * it. Pass `size` to pin it.
 *
 * Announced as `role="status"` with an accessible name ("Loading" by default). When the host
 * already says it is busy (a Button with `aria-busy`, a row whose text reads "Loading more"), pass
 * `aria-hidden`: the role and the name are dropped, so the state is announced once, not twice.
 *
 * One glyph turning, never two crossfaded. Under reduced motion the turn stops and a still ring
 * remains, which still reads as "in progress".
 */
export const spinnerVariants = tv({
  base: "shrink-0 animate-spin motion-reduce:animate-none",
  variants: {
    // Pinned sizes for a spinner with no host rule to follow. xl is the overlay size (a video
    // buffering, a panel loading).
    size: {
      sm: "size-3.5",
      md: "size-4",
      lg: "size-5",
      xl: "size-10",
    },
  },
})

export interface SpinnerProps
  extends Omit<IconProps, "size" | "weight">,
    VariantProps<typeof spinnerVariants> {
  /** Accessible name while the spinner is announced. Ignored under `aria-hidden`. */
  label?: string
}

export function Spinner({ className, size, label = "Loading", ...props }: SpinnerProps) {
  const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true"

  return (
    <CircleNotch
      data-slot="spinner"
      weight="bold"
      role={hidden ? undefined : "status"}
      aria-label={hidden ? undefined : label}
      className={spinnerVariants({ size, className })}
      {...props}
    />
  )
}
