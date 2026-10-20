"use client"

import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { createContext } from "@/lib/create-context"
import { tv, type VariantProps } from "@/lib/tv"

/**
 * Avatar: a multi-part component over Radix Avatar (which handles image load state and
 * fallback). Pattern: one `tv` recipe with `slots`, shared `size`/`shape` flowing to every
 * part through React Context. See docs/ARCHITECTURE.md §2.
 *
 * The shape lives on the root; Image/Fallback inherit it via `rounded-[inherit]` so a
 * `<img>` clips itself: no `overflow-hidden` on the root, leaving the corner free for
 * `Avatar.Status` to sit outside the silhouette.
 */
export const avatarVariants = tv({
  slots: {
    root: [
      // `isolate`: the root is its own stacking context, so the `z-10` on Status/Badge only
      // lifts them above this avatar's image, never above a neighbour. In an AvatarGroup the
      // next avatar then covers this one's corner mark the same way it covers the photo.
      "relative isolate inline-flex shrink-0 select-none items-center justify-center align-middle",
      "bg-muted",
      // polish: image outline, a hairline over the image edge so it
      // doesn't float against light surfaces.
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit]",
      "after:border after:border-foreground/10 after:content-['']",
    ],
    image: "size-full rounded-[inherit] object-cover",
    fallback:
      "flex size-full items-center justify-center rounded-[inherit] bg-muted font-medium uppercase text-muted-foreground",
    status: "absolute z-10 rounded-full ring-2 ring-background",
    // Corner overlay for a brand/app mark: a round `bg-background` coin that sits outside the
    // silhouette like `status`, but big enough to hold a logo. The ring carves it off the image
    // behind it; the descendant rules fit any dropped-in `<img>`/`<svg>` inside the coin.
    badge: [
      // radius is owned by `AvatarBadge`'s own `shape` prop (circle coin vs. rounded-square icon)
      "absolute z-10 flex items-center justify-center overflow-hidden",
      "border border-foreground/10 bg-background ring-2 ring-background",
      "[&>img]:size-full [&>img]:object-contain [&>svg]:size-full",
    ],
  },
  variants: {
    size: {
      xs: { root: "size-6 rounded-full text-xs", status: "size-1.5", badge: "size-3" },
      sm: { root: "size-8 rounded-full text-xs", status: "size-2", badge: "size-3.5" },
      md: { root: "size-10 rounded-full text-sm", status: "size-2.5", badge: "size-4" },
      lg: { root: "size-12 rounded-full text-base", status: "size-3", badge: "size-5" },
      xl: { root: "size-16 rounded-full text-lg", status: "size-3.5", badge: "size-6" },
    },
    shape: {
      circle: { root: "rounded-full" },
      square: { root: "rounded-lg" },
    },
    // Categorical tint: the same soft-bg/strong-fg recipe as the Badge categorical hues
    // (`bg-X/10 text-X` over a `border-X/20` hairline), derived from one token so it re-themes
    // across all four themes. The tint rides the *fallback* (`bg-X/10 text-X`) over an *opaque*
    // `bg-background` root, NOT a transparent tint on the root: an opaque base lets overlapping
    // avatars in an `AvatarGroup` fully occlude their neighbours, where a `/10` root would let
    // the avatar behind bleed through the seam. On the default surface this looks identical to a
    // 10% layer over the page. `default` keeps the neutral muted chip. Use it to distribute
    // initials across users/teams/tags; an image, when present, covers the tint.
    color: {
      default: {},
      brand: { root: "bg-background after:border-brand/20", fallback: "bg-brand/10 text-brand" },
      purple: { root: "bg-background after:border-purple/20", fallback: "bg-purple/10 text-purple" },
      pink: { root: "bg-background after:border-pink/20", fallback: "bg-pink/10 text-pink" },
      teal: { root: "bg-background after:border-teal/20", fallback: "bg-teal/10 text-teal" },
      orange: { root: "bg-background after:border-orange/20", fallback: "bg-orange/10 text-orange" },
    },
  },
  defaultVariants: {
    size: "md",
    shape: "circle",
    color: "default",
  },
})

type AvatarSlots = ReturnType<typeof avatarVariants>
type AvatarSize = NonNullable<VariantProps<typeof avatarVariants>["size"]>
// The resolved size rides along in context so `Avatar.Fallback` can decide how many initials
// fit the box (one on a small silhouette, two from md up) without being told.
const [AvatarProvider, useAvatarContext] = createContext<{
  slots: AvatarSlots
  size: AvatarSize
}>("Avatar")

export interface AvatarProps
  // Omit the native `color` attribute so our categorical `color` variant owns the prop.
  extends Omit<React.ComponentProps<typeof AvatarPrimitive.Root>, "color">,
    VariantProps<typeof avatarVariants> {}

export function AvatarRoot({ className, size, shape, color, ...props }: AvatarProps) {
  const slots = avatarVariants({ size, shape, color })
  return (
    <AvatarProvider slots={slots} size={size ?? "md"}>
      <AvatarPrimitive.Root
        data-slot="avatar"
        className={slots.root({ className })}
        {...props}
      />
    </AvatarProvider>
  )
}

export function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  const { slots } = useAvatarContext("Avatar.Image")
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={slots.image({ className })}
      {...props}
    />
  )
}

export interface AvatarFallbackProps
  extends React.ComponentProps<typeof AvatarPrimitive.Fallback> {
  /**
   * Cap how many initials render. Defaults to the avatar's size: a small box (`xs`/`sm`) shows a
   * single initial so the glyph never crowds the silhouette; `md` and up show two. Only trims
   * plain-string children; any other node renders verbatim.
   */
  maxInitials?: number
}

export function AvatarFallback({
  className,
  maxInitials,
  children,
  ...props
}: AvatarFallbackProps) {
  const { slots, size } = useAvatarContext("Avatar.Fallback")
  const cap = maxInitials ?? (size === "xs" || size === "sm" ? 1 : 2)
  const content = typeof children === "string" ? children.slice(0, cap) : children
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={slots.fallback({ className })}
      {...props}
    >
      {content}
    </AvatarPrimitive.Fallback>
  )
}

const statusColor = {
  online: "bg-success",
  away: "bg-warning",
  busy: "bg-destructive",
  offline: "bg-muted-foreground",
} as const

const statusPosition = {
  "bottom-right": "right-0 bottom-0",
  "top-right": "right-0 top-0",
  "bottom-left": "left-0 bottom-0",
  "top-left": "left-0 top-0",
} as const

export interface AvatarStatusProps extends React.ComponentProps<"span"> {
  /** Presence state: maps to a semantic status token. */
  variant?: keyof typeof statusColor
  /** Corner where the indicator appears. @default "bottom-right" */
  position?: keyof typeof statusPosition
}

export function AvatarStatus({
  className,
  variant = "online",
  position = "bottom-right",
  ...props
}: AvatarStatusProps) {
  const { slots } = useAvatarContext("Avatar.Status")
  return (
    <span
      data-slot="avatar-status"
      className={cn(slots.status(), statusColor[variant], statusPosition[position], className)}
      {...props}
    />
  )
}

// The coin's own shape, independent of the avatar's: a round badge for a brand coin, or a
// rounded-square for the classic app-icon look. `square` keeps a smaller radius than the avatar
// root so the nested mark stays concentric.
const badgeShape = {
  circle: "rounded-full",
  square: "rounded-md",
} as const

export interface AvatarBadgeProps extends React.ComponentProps<"span"> {
  /** Corner where the badge sits. @default "bottom-right" */
  position?: keyof typeof statusPosition
  /** Coin shape, independent of the avatar's. @default "circle" */
  shape?: keyof typeof badgeShape
}

/**
 * A corner overlay that holds a small brand/app mark, the same idea as `AvatarStatus` but for a
 * logo instead of a presence dot: drop an `<img>` or icon inside and it fits the coin. Use it to
 * tag an avatar with the platform a person came from, an org badge, or a verified mark.
 */
export function AvatarBadge({
  className,
  position = "bottom-right",
  shape = "circle",
  ...props
}: AvatarBadgeProps) {
  const { slots } = useAvatarContext("Avatar.Badge")
  return (
    <span
      data-slot="avatar-badge"
      className={cn(slots.badge(), badgeShape[shape], statusPosition[position], className)}
      {...props}
    />
  )
}

/** Compound API: `<Avatar>` (= `<Avatar.Root>`) with `.Image`, `.Fallback`, `.Status`, `.Badge`. */
export const Avatar = Object.assign(AvatarRoot, {
  Root: AvatarRoot,
  Image: AvatarImage,
  Fallback: AvatarFallback,
  Status: AvatarStatus,
  Badge: AvatarBadge,
})
