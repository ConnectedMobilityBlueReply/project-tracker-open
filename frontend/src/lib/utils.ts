import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge config extended for Koala's custom token scales, so conflicting
 * classes resolve correctly (e.g. `duration-fast` + `duration-base` → last wins).
 * Shared between `cn` (below) and `tv` (lib/tv.ts) so both merge identically.
 *
 * Standard scales (radius-*, shadow-*, color tokens) are already understood by
 * tailwind-merge; only our non-standard utilities need to be declared here.
 */
export const twMergeConfig = {
  extend: {
    classGroups: {
      "font-family": [{ font: ["heading"] }],
      // The knob-derived pill radius (`--radius-pill`, app/globals.css). tailwind-merge only knows
      // t-shirt radii, so without this a `rounded-pill` passed via className sat BESIDE a recipe's
      // `rounded-md` instead of replacing it, and CSS source order picked the winner.
      rounded: [{ rounded: ["pill"] }],
      "transition-duration": [{ duration: ["fast", "base", "slow"] }],
      // tw-animate-css's animation-fill-mode utilities. tailwind-merge reads `fill-mode-both` as a
      // fill COLOR, so beside an SVG's `fill-current` one of the two was dropped (a Chart funnel's
      // drop-off lost its hue and painted black). Their own group keeps both.
      "koala-animation-fill-mode": [{ "fill-mode": ["none", "forwards", "backwards", "both"] }],
      // The canonical section-heading size utility (app/globals.css). Joins the font-size group so
      // a `text-*` passed via className still overrides it (last wins), exactly as two text sizes
      // would dedupe.
      "font-size": ["section-heading"],
      // The canonical ring utilities (app/globals.css). One group so they dedupe like the
      // box-shadow they replace: when a control carries both (base brand ring + invalid
      // destructive ring on the same state), the later one (the error ring) wins.
      "koala-ring": ["brand-ring", "destructive-ring"],
      // The disclosure-caret transitions (app/globals.css). One group so the two beats are
      // mutually exclusive (both write transition-*): a `caret-turn-fast` passed after
      // `caret-turn` wins, exactly as two conflicting transitions should dedupe.
      "koala-caret": ["caret-turn", "caret-turn-fast"],
      // The fade edge-mask utilities (app/globals.css): the static `fade-*` family and its
      // scroll-aware `scroll-fade-*` sibling. One group so every variant is mutually exclusive
      // (each writes mask-image): a `fade-x` or `scroll-fade-t` passed after `fade` wins, exactly
      // as two conflicting mask utilities should dedupe.
      "koala-fade": [
        "fade",
        "fade-x",
        "fade-t",
        "fade-b",
        "fade-l",
        "fade-r",
        "scroll-fade",
        "scroll-fade-x",
        "scroll-fade-t",
        "scroll-fade-b",
        "scroll-fade-l",
        "scroll-fade-r",
      ],
      // The scroll-stage beats (app/globals.css), the engine behind the Hero's `HeroStage` parts.
      // One group because each is a ROLE on the stage and an element has exactly one: they all
      // write `animation-name` off the same timeline, so a `hero-stage-exit` passed after a
      // `hero-stage-enter` swaps the beat outright instead of stacking a second animation on it.
      // The track and the pin ride along: an element is one or the other, never both.
      "koala-hero-stage": [
        "hero-stage-track",
        "hero-stage-pin",
        "hero-stage-media",
        "hero-stage-exit",
        "hero-stage-letter",
        "hero-stage-enter",
      ],
    },
  },
}

const twMerge = extendTailwindMerge(twMergeConfig)

/** Conditionally join class names and resolve Tailwind conflicts (last wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
