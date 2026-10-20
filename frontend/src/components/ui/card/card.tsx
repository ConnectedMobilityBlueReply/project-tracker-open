"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { createContext } from "@/lib/create-context"
import { useDensity } from "@/lib/density"
import { tv, type VariantProps } from "@/lib/tv"

/**
 * Card: the reference multi-part component. Pattern: one `tv` recipe with `slots`,
 * shared variants flowing to every part through React Context (never prop-drilled or
 * cloned). See docs/ARCHITECTURE.md §2.
 */
export const cardVariants = tv({
  slots: {
    // No fill here: only `elevated` paints one (see the variant axis below).
    // No border: the edge is a ring (box-shadow) set per variant, so it takes no layout and every
    // nested radius stays concentric with the card (docs/FOUNDATIONS.md, "Shadows over borders").
    root: "flex flex-col rounded-xl text-card-foreground",
    // Header is a grid so an optional Action sits top-right, optically aligned.
    //
    // An action opted into `wrap="narrow"` makes the header a size container, and every child spans
    // the full row once that container is under 24rem: the action drops under the title and
    // description instead of squeezing them. A header can't query its own width, so the header only
    // declares the container and the rules land on its children (their nearest `card-header`
    // container is this header). Opt-in, never automatic: a desktop card can be 130px of header
    // with a 16px icon action that must stay beside the title, and a container width alone can't
    // tell that card from a phone card with a wide segmented control.
    header: [
      "grid auto-rows-min items-start gap-1.5 [&:has([data-slot=card-action])]:grid-cols-[1fr_auto]",
      "[&:has(>[data-slot=card-action][data-wrap=narrow])]:@container/card-header @max-sm/card-header:[&>*]:col-span-full",
    ],
    title: "font-semibold leading-none",
    // `text-pretty` rides a zero-specificity `:where()` so it stays a default: the `text-wrap`
    // shorthand resets `text-wrap-mode`, so at full strength it beat a consumer's `truncate`.
    description: "text-sm text-muted-foreground [:where(&)]:text-pretty",
    // In a narrow header (see `header`) the action leaves the second column, follows the copy in
    // DOM order and starts flush left, 14px under the description (the gap's 6 plus 8).
    action:
      "col-start-2 row-span-2 row-start-1 self-start justify-self-end @max-sm/card-header:row-auto @max-sm/card-header:mt-2 @max-sm/card-header:justify-self-start",
    content: "",
    footer: "flex items-center",
    // Inset media (docs/ARCHITECTURE.md): a photo never bleeds to the card's edges. It sits 8px in
    // from the card, a tighter inset than the copy's padding, so it reads as a framed picture and
    // not a header band. Radius is the ladder's first rung: rounded-xl 20 − 8 = rounded-md 12
    // (docs/FOUNDATIONS.md). The frame owns a ratio (aspect-video, override with className) and a
    // muted fill that shows while the image loads. The edge is an ::after ring painted OVER the
    // image, since an inset ring on the img or the wrapper paints under the picture.
    media: [
      "relative mx-2 aspect-video overflow-hidden rounded-md bg-muted",
      "[&>img]:size-full [&>img]:object-cover [&>video]:size-full [&>video]:object-cover",
      "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-black/10 dark:after:ring-white/10",
    ],
  },
  variants: {
    // Fill is elevation (docs/FOUNDATIONS.md). A card in the page flow paints no fill: it is a
    // contour that takes whatever ground it sits on (the page, a muted band, a Dialog), so it
    // declares no `--surface` and the controls inside inherit that ground too. In light `--card`
    // IS `--background`, so a filled in-flow card only ever showed up in dark as a grey slab nobody
    // designed. Only `elevated` floats, and a shadow barely reads on near-black, so in dark the
    // lifted fill is what carries it; it declares `--surface` for the controls inside.
    // Shadows over borders: `default` is an `--edge` ring plus the xs lift (a whisper of depth in
    // light); `outline` is the bare ring at full `--border` strength; `elevated` is the lift alone.
    variant: {
      default: { root: "shadow-xs ring-1 ring-edge" },
      outline: { root: "shadow-none ring-1 ring-border" },
      elevated: { root: "bg-card shadow-lg [--surface:var(--card)]" },
    },
    // Density is Koala's cross-cutting spacing axis (see lib/density.tsx). For Card it
    // governs padding, gap, and title size. `compact` is the Koala default (16px
    // padding/gaps, 1rem title); `comfortable` is the spacious marketing alternative.
    // Media at either end of the card pulls into the card's vertical padding so its inset is 8px on
    // every side; the padding it cancels is the density's, and the 8px inset never moves with it.
    density: {
      compact: {
        root: "gap-4 py-4",
        header: "px-4",
        content: "px-4",
        footer: "px-4",
        title: "text-base",
        media: "first:-mt-2 last:-mb-2",
      },
      comfortable: {
        root: "gap-6 py-6",
        header: "px-6",
        content: "px-6",
        footer: "px-6",
        title: "text-lg",
        media: "first:-mt-4 last:-mb-4",
      },
    },
    // A card that IS the link or the button (a task on a board, a template in a gallery): pair it
    // with `asChild` around an `<a>` or `<button>`. Pointer, a hover that answers the pointer and a
    // focus ring; no press scale (feedback is the ring and the lift). Only the box-shadow moves, and
    // both the edge ring and the lift live in it, so it is the one property transitioned. How the
    // hover answers depends on the variant (compounds below): the edge darkens where there is one to
    // darken, since a lift alone barely reads on the dark themes.
    interactive: {
      true: {
        root: [
          "cursor-pointer text-left outline-none",
          "transition-[box-shadow] duration-fast ease-out motion-reduce:transition-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
      },
      false: {},
    },
  },
  // The edge answers in `foreground` at 20%, not `ring-border`: on the dark themes `--edge` already
  // IS `--border`, so a border-colored hover would not move at all there.
  compoundVariants: [
    { variant: "default", interactive: true, class: { root: "hover:shadow-md hover:ring-foreground/20" } },
    { variant: "outline", interactive: true, class: { root: "hover:shadow-sm hover:ring-foreground/20" } },
    { variant: "elevated", interactive: true, class: { root: "hover:shadow-xl" } },
  ],
  defaultVariants: {
    variant: "default",
    density: "compact",
    interactive: false,
  },
})

type CardSlots = ReturnType<typeof cardVariants>
const [CardProvider, useCardContext] = createContext<{ slots: CardSlots }>("Card")

export interface CardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
}

/**
 * Parts are exported individually (not as `Card.Header` dot-notation) because
 * namespaced statics don't survive the RSC server→client boundary; only named
 * exports do. Compose as `<Card><CardHeader>…`.
 */
export function Card({
  className,
  variant,
  density,
  interactive,
  asChild = false,
  ...props
}: CardProps) {
  // Density resolves prop > provider > "compact"; compute the slots once, every part
  // reads them from context.
  const slots = cardVariants({ variant, density: useDensity(density), interactive })
  const Comp = asChild ? Slot.Root : "div"
  return (
    <CardProvider slots={slots}>
      <Comp data-slot="card" className={slots.root({ className })} {...props} />
    </CardProvider>
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardHeader")
  return <div data-slot="card-header" className={slots.header({ className })} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardTitle")
  return <div data-slot="card-title" className={slots.title({ className })} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardDescription")
  return (
    <div data-slot="card-description" className={slots.description({ className })} {...props} />
  )
}

export interface CardActionProps extends React.ComponentProps<"div"> {
  /**
   * What the action does when the card is narrow. `"never"` keeps it top-right at every width.
   * `"narrow"` drops it under the title and description once the card header is under 24rem (a
   * phone-width card): measured on the header with a container query, so it follows the card, not
   * the viewport. Opt in when the action is wide (a segmented control, a select); an icon button
   * reads best beside the title at any width. The card needs its width from the layout (a grid
   * track, `w-full`, a `max-w`): the header stops sizing the card from its content. @default "never"
   */
  wrap?: "never" | "narrow"
}

export function CardAction({ className, wrap = "never", ...props }: CardActionProps) {
  const { slots } = useCardContext("CardAction")
  return (
    <div
      data-slot="card-action"
      data-wrap={wrap === "narrow" ? "narrow" : undefined}
      className={slots.action({ className })}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardContent")
  return <div data-slot="card-content" className={slots.content({ className })} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardFooter")
  return <div data-slot="card-footer" className={slots.footer({ className })} {...props} />
}

/**
 * The card's picture, inset from the edges with a concentric radius. Put an `<img>` or `<video>`
 * inside and it fills the frame; badges laid over it are `absolute` children, anchored to the
 * frame rather than the card (Badge's `overlay` tones are made for that ground).
 */
export function CardMedia({ className, ...props }: React.ComponentProps<"div">) {
  const { slots } = useCardContext("CardMedia")
  return <div data-slot="card-media" className={slots.media({ className })} {...props} />
}
