"use client"

import * as React from "react"
import { Slot } from "radix-ui"

import { useButtonSize, type Density } from "@/lib/density"
import { cn } from "@/lib/utils"
import { tv, type VariantProps } from "@/lib/tv"
import { AnimatedLabel } from "@/components/ui/animated-label"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip, type TooltipProps } from "@/components/ui/tooltip/tooltip"
import { hitBox, hitCoarse, hitX } from "@/lib/hit-area"

// Every bundler (Next, Vite, webpack) replaces `process.env.NODE_ENV` at build time. Declared here so
// a project without Node's types, like a Vite app, still typechecks the dev-only warning below.
declare const process: { env: { NODE_ENV?: string } }

/**
 * Button: the reference single-element component. Pattern: one `tv` recipe, Radix
 * `Slot` for `asChild`, semantic tokens only, `className` merged last. See
 * docs/ARCHITECTURE.md.
 *
 * `"use client"` because Button reads the density context (lib/density.tsx) so a compact
 * app shell tightens its buttons with no per-instance props.
 */
// polish: where a size's visual height drops below the 40px hit target, a transparent
// pseudo-element extends the click area without changing the visual (lib/hit-area.ts): `hitX`
// for a text button, `hitBox` for a square icon-only one. On a touch screen every size grows its
// target to 44px (`hitCoarse` on md and lg), because a fingertip needs more than a cursor.

export const buttonVariants = tv({
  base: [
    // The pill (`rounded-pill`, globals.css): fully round at every radius preset, square only at
    // `None`. The label reads as an object, not boxed text. An icon-only button is the exception:
    // a square with the fields' corner (`rounded-md`, like Input, Select and Toggle), set with its
    // size in compoundVariants below, so it sits level with the controls beside it.
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-medium",
    // Specific transition (never `transition: all`, #14); `transition` covers colors + scale.
    "transition duration-fast ease-out",
    // polish: tactile scale-on-press. Disable via the `static` prop.
    "active:scale-[0.96]",
    "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    // Icons: default to a 1rem box unless the consumer sets their own `size-*`; never shrink
    // or swallow clicks.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  variants: {
    variant: {
      // The primary action carries the brand accent (--brand): every CTA across the library
      // (dialogs, forms, marketing) is brand-colored without per-call-site changes. The focus
      // ring is already brand (base), so a primary button reads as a brand halo on focus.
      // Contrast, stated plainly: the white label is 3.6:1 on the default orange, which clears
      // the 3:1 large-text floor but not the 4.5:1 AA floor for this 14px label (amber: 2.7:1).
      // The raw accent is kept as a brand decision; see `--brand-strong` in globals.css for the
      // darker step used where brand-colored text sits on white.
      primary: "bg-brand text-brand-foreground shadow-xs hover:bg-brand/90",
      secondary:
        "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      // The achromatic solid: an ink-colored fill with the page ground as its label, so it is black
      // on the light themes and flips to near-white on the dark ones (and inside an always-dark band).
      // For a strong action that must not compete with the brand CTA on the same screen ("See all
      // components" under a brand "Buy now"), where `secondary` would be too quiet.
      neutral: "bg-foreground text-background shadow-xs hover:bg-foreground/85",
      // `bg-transparent` (not `bg-background`) so the button blends with whatever surface
      // it sits on, whether page, card, or popover. With `bg-background` it rendered as a darker
      // filled rectangle on lighter surfaces (card/popover in dark themes).
      outline:
        "border border-border bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      // The destructive action is a SOFT fill, not a solid red slab: the hue at /10 behind the
      // darker `-strong` label, which is the same tinted recipe as a destructive Badge, a
      // negative Stat chip, or a Toast action (see docs/FOUNDATIONS.md). It reads unmistakably
      // red - a dim maroon on the dark themes, a pale pink on light - while staying quiet
      // enough to sit beside a `primary` CTA rather than drown it. Hover deepens the tint to
      // /20; both steps clear AA against the label in all four themes (worst case 4.66:1, on
      // the dark card). Reach for the solid red only where a tint cannot carry the weight, by
      // passing `className`.
      destructive:
        "bg-destructive/10 text-destructive-strong shadow-xs hover:bg-destructive/20 focus-visible:ring-destructive/40",
      // Quiet destructive: the same hue with no fill at rest at all. Where `destructive` is the
      // confirm CTA (a tinted pill you see coming), this is the low-emphasis delete affordance -
      // a remove-line trash in a list or cart - that only tints under the pointer.
      destructiveGhost:
        "text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40",
      link: "text-primary underline-offset-4 hover:underline",
    },
    // Three sizes: sm 32px, md 36px, lg 40px; label stays text-sm across
    // the scale. Horizontal padding tracks the height rhythm in lockstep: the heights step
    // 32→36→40 (+4 each), so the padding steps px-3→px-4→px-5 (12→16→20, +4 each) to match.
    // lg was px-6 (24px), which overshot the cadence by 4px a side and read chunky next to a
    // 40px height (a short CTA like "Book a demo" looked wider than its label warranted); px-5
    // keeps lg substantial without the extra width. Polish (optical over geometric): an icon
    // reads lighter than a text edge, so a button carrying a direct `<svg>` trims its
    // horizontal padding one step (`has-[>svg]:px-*`) to stay optically balanced.
    // Padding scale: px-3/2.5 (sm), px-4/3 (md), px-5/4 (lg), px-6/5 (xl).
    //
    // `xl` (44px) is the marketing CTA tier, button-only (see `ButtonSize` in lib/density.tsx): the
    // one step where the label grows too, to 16px, with a 20px glyph, because beside a 60-72px
    // display title a 14px label reads as fine print. It keeps the +4 cadence (44 / px-6).
    //
    // The second selector covers the cases where the children are boxed in a label wrapper
    // (`loading`, `swapKey`) instead of sitting directly in the button: without it, wrapping
    // would silently un-trim the padding and an icon button would grow 4px a side mid-swap.
    size: {
      sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 has-[>[data-slot=button-label]_svg]:px-2.5",
      md: "h-9 px-4 py-2 has-[>svg]:px-3 has-[>[data-slot=button-label]_svg]:px-3",
      lg: "h-10 px-5 has-[>svg]:px-4 has-[>[data-slot=button-label]_svg]:px-4",
      xl: "h-11 px-6 text-base has-[>svg]:px-5 has-[>[data-slot=button-label]_svg]:px-5 [&_svg:not([class*='size-'])]:size-5",
    },
    // Icon-only collapses the button to a square (width tracks height) and drops the
    // label padding/gap so the glyph optically centers. The squares live in
    // compoundVariants since the dimension depends on the active size.
    iconOnly: {
      true: "",
      false: "",
    },
    /**
     * The ground the button sits on. `default` reads the page tokens, which is right whenever the
     * button sits on `--background`, a card, or a popover.
     *
     * The other two are for a button placed on a filled band or over media, where the ordinary
     * accent/brand tokens disappear into the surface they are meant to contrast with:
     *   - `onMedia`   a fixed white family, for a `bg-brand` band, a photo, or a dark scrim. White
     *                 is not a token here on purpose: those grounds are saturated or dark in every
     *                 theme. On a brand band, lead with the white chip: its near-black label clears
     *                 AA on white with room to spare, where the outline and ghost labels are white
     *                 on the band itself (3.6:1 on the default orange, large-text AA only).
     *   - `onInverse` the token-flipping twin, for a `bg-foreground` band. That band inverts with
     *                 the theme, so the button has to invert with it rather than pin to white.
     *
     * Both re-point the focus ring: the base ring is `--brand` on a `--background` offset, which is
     * an invisible halo on a brand band. The offset goes transparent so the band shows through the
     * gap, which works over a photo too (a hardcoded band color would not).
     */
    tone: {
      default: "",
      onMedia: "focus-visible:ring-white focus-visible:ring-offset-transparent",
      onInverse: "focus-visible:ring-background focus-visible:ring-offset-transparent",
    },
  },
  compoundVariants: [
    // ── On-media tones ────────────────────────────────────────────────────────
    // A filled band inverts the figure/ground, so each variant needs its own answer: the solid
    // action becomes the light shape, the outline keeps its hairline but in the band's ink, and
    // the ghost keeps no chrome at all. `secondary` rides with `primary` — on a band the
    // primary/secondary distinction is carried by which button is solid, not by two fills. The
    // chip's label is near-black ink, never a brand color: the band around it already carries the
    // accent, and brand text on a white chip reads as a second, weaker accent. `neutral-950` is the
    // light theme's own `--foreground`, pinned because the chip is white in every theme.
    { tone: "onMedia", variant: ["primary", "secondary", "neutral"], className: "bg-white text-neutral-950 shadow-xs hover:bg-white/90" },
    { tone: "onMedia", variant: "outline", className: "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" },
    { tone: "onMedia", variant: "ghost", className: "text-white hover:bg-white/20 hover:text-white" },
    { tone: "onInverse", variant: ["primary", "secondary", "neutral"], className: "bg-background text-foreground shadow-xs hover:bg-background/90" },
    { tone: "onInverse", variant: "outline", className: "border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background" },
    { tone: "onInverse", variant: "ghost", className: "text-background hover:bg-background/20 hover:text-background" },
    // Icon-only: collapse to a square that tracks the size's height (sm 32 · md 36 · lg 40),
    // zeroing label padding/gap so the glyph optically centers. `has-[>svg]:px-0` overrides the
    // size's icon-padding step (an icon-only button always has a direct svg, so it would
    // otherwise inherit px-2.5/3/4). sm is under the 40px hit target, so it also carries a
    // centered box extender. The label-wrapper selector is re-stated here (and last) because
    // `:has(… [data-slot] svg)` outweighs `:has(>svg)` on specificity: without it a swapping or
    // loading icon-only button would take the text size's padding and stop being square.
    { size: "sm", iconOnly: true, className: `w-8 gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0 ${hitBox}` },
    { size: "md", iconOnly: true, className: "w-9 gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },
    { size: "lg", iconOnly: true, className: "w-10 gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },
    { size: "xl", iconOnly: true, className: "w-11 gap-0 rounded-md px-0 has-[>svg]:px-0 has-[>[data-slot=button-label]_svg]:px-0" },

    // sm text (32px) is under the 40px hit target, so it gets a vertical-only hit extender.
    { size: "sm", iconOnly: false, className: hitX },
    // md and lg already meet 40px on desktop; on touch they still grow their target to 44x44.
    { size: ["md", "lg"], className: hitCoarse },
  ],
  defaultVariants: {
    variant: "primary",
    size: "md",
    iconOnly: false,
    tone: "default",
  },
})

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /**
   * Spacing tier. Height comes from `size`, not density; this prop only sets the DEFAULT `size`
   * when none is given (compact → "sm", comfortable → "md"). Unlike the other controls, a Button
   * does NOT read ambient density (DensityProvider): an unsized button is "md" everywhere unless
   * this prop or a container (InputGroup, Form, HeroActions…) says otherwise. An explicit `size`
   * always wins.
   */
  density?: Density
  /** Render the child element as the button (Radix Slot), merging styles onto it. */
  asChild?: boolean
  /** Disable the tactile scale-on-press, e.g. where motion would distract. */
  static?: boolean
  /**
   * Show a spinner and mark the button busy (`aria-busy`) while an action is in flight.
   * The label is hidden but its space is reserved, so the button never reflows; the
   * button is also disabled so it can't be re-triggered. Ignored with `asChild` (the
   * rendered child owns its content). @default false
   */
  loading?: boolean
  /**
   * Identifies the label the button is currently showing, so a change to it *rolls* rather than
   * hard-cuts (see AnimatedLabel, which this hands the whole label to). Change it in step with
   * `children` (`swapKey={done ? "done" : "next"}`): the old label lifts up and out while the new
   * one rises from below, and the button eases between the two label widths instead of snapping.
   * For the state-flipping labels: Next → Done, Copy → Copied, Follow → Following. Ignored with
   * `asChild` (the child owns its content) and while `loading` (the spinner owns the label box).
   *
   * Reach for `<AnimatedLabel>` directly when only *part* of the button should roll, e.g. a label
   * beside an icon that rotates rather than swaps.
   */
  swapKey?: React.Key
  /**
   * Tooltip content for icon-only buttons. Defaults to `aria-label` when `iconOnly` is true.
   * Pass `false` to opt out (e.g. when wrapping with `<Tooltip>` explicitly for custom content).
   */
  tooltip?: React.ReactNode | false
  /** Tooltip placement. Only applies when `iconOnly` is true. @default "top" */
  tooltipPlacement?: TooltipProps["placement"]
}

export function Button({
  className,
  variant,
  size,
  iconOnly,
  tone,
  density,
  asChild = false,
  static: isStatic = false,
  loading = false,
  swapKey,
  tooltip,
  tooltipPlacement,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  // `loading` only drives the spinner overlay on a native button. With `asChild`, Slot
  // expects a single child, so a sibling spinner would break it; the child owns its content.
  const isLoading = loading && !asChild

  // Same reasoning for the label swap below: it needs its own box (Slot would collapse into the
  // child), and while loading the spinner already owns that box, so the swap stands down there.

  // a11y guard: an icon-only button has no visible text, so it needs an explicit accessible
  // name. Warn in development when one is missing (skipped for `asChild`, where the rendered
  // child owns its own labelling). Stripped from production builds.
  const ariaLabel = props["aria-label"]
  const ariaLabelledby = props["aria-labelledby"]
  React.useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      iconOnly &&
      !asChild &&
      !ariaLabel &&
      !ariaLabelledby
    ) {
      console.warn(
        "Button: an `iconOnly` button has no accessible name. Pass `aria-label` " +
          "(or `aria-labelledby`) so assistive tech can announce it.",
      )
    }
  }, [iconOnly, asChild, ariaLabel, ariaLabelledby])

  const button = (
    <Comp
      data-slot="button"
      // A hook for containers that give their icon-only buttons their own chip (Navbar).
      data-icon-only={iconOnly || undefined}
      // While loading the button is busy and non-interactive (disabled also neutralizes the
      // press scale and hover via the base `disabled:` rules). `isLoading` is false under
      // `asChild`, so this forwards a plain `disabled` there exactly as before.
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      data-loading={isLoading || undefined}
      className={buttonVariants({
        variant,
        tone,
        // Height comes from `size`. With none given: the `density` prop (compact → sm), then the
        // container's imposed tier, then `md`. Ambient density never shrinks a button.
        size: useButtonSize(size ?? undefined, density),
        iconOnly,
        // `static` neutralizes the press scale; `relative` anchors the loading spinner.
        // twMerge keeps this last.
        className: cn(isStatic && "active:scale-100", isLoading && "relative", className),
      })}
      {...props}
    >
      {isLoading ? (
        <>
          {/* Centered spinner; inset-0 + m-auto centers the fixed (size-4) glyph. */}
          <Spinner aria-hidden className="absolute inset-0 m-auto" />
          {/* Keep the label's box (visibility, not display) so width never reflows;
              `[gap:inherit]` mirrors the active size's icon/label gap. */}
          <span data-slot="button-label" className="inline-flex items-center [gap:inherit] invisible">
            {children}
          </span>
        </>
      ) : swapKey !== undefined && !asChild ? (
        // `data-slot` is overridden to the shared label-box name the recipe's padding selector
        // keys off, so a swapping button keeps the icon padding a plain one gets.
        <AnimatedLabel swapKey={swapKey} data-slot="button-label">
          {children}
        </AnimatedLabel>
      ) : (
        children
      )}
    </Comp>
  )

  // Auto-wrap icon-only buttons with a Tooltip. Content resolves: explicit `tooltip` prop >
  // `aria-label` > nothing (no wrap). Pass `tooltip={false}` to opt out when you're wrapping
  // with <Tooltip> explicitly (e.g. for rich/interactive content or custom placement).
  const tooltipContent = tooltip === false ? null : (tooltip ?? ariaLabel)
  if (iconOnly && !asChild && tooltipContent) {
    return (
      <Tooltip content={tooltipContent} placement={tooltipPlacement ?? "top"}>
        {button}
      </Tooltip>
    )
  }

  return button
}
