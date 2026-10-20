import * as React from "react"
import { Slot } from "radix-ui"
import { CaretRight, DotsThree } from "@phosphor-icons/react/ssr"

import { cn } from "@/lib/utils"
import { hitBox, hitY } from "@/lib/hit-area"

// Breadcrumb: a multi-part navigation landmark. No shared variants, so no
// Context or tv slots: each part is a thin wrapper that merges `className` last.

export function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      className={cn(className)}
      {...props}
    />
  )
}

export function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

export interface BreadcrumbLinkProps extends React.ComponentProps<"a"> {
  /** Merge styles onto the child element (e.g. Next.js Link) via Radix Slot. */
  asChild?: boolean
}

export function BreadcrumbLink({ asChild, className, ...props }: BreadcrumbLinkProps) {
  const Comp = asChild ? Slot.Root : "a"
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        // polish: visible element may be well below the 40px hit
        // target, so extend vertically with a pseudo-element that stays inert to layout.
        "relative rounded-sm",
        // polish: name exact properties, never `transition: all`.
        "transition-colors duration-fast ease-out hover:text-foreground",
        "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        hitY,
        className,
      )}
      {...props}
    />
  )
}

export function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("font-medium text-foreground", className)}
      {...props}
    />
  )
}

export function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      aria-hidden="true"
      className={cn("flex items-center [&>svg]:size-3.5", className)}
      {...props}
    >
      {children ?? <CaretRight weight="bold" />}
    </li>
  )
}

export function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      aria-label="More pages"
      className={cn(
        // Visual footprint is just the glyph (~16px) so the collapsed crumb sits tight
        // between its separators (a fixed 36px box read as an airy gap). The 40px tap
        // target is restored by a centered pseudo-element (polish).
        "relative flex items-center justify-center text-muted-foreground",
        hitBox,
        className,
      )}
      {...props}
    >
      <DotsThree aria-hidden weight="bold" className="size-4" />
    </span>
  )
}
