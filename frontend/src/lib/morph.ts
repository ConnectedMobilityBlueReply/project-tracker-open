import * as React from "react"

/**
 * The morphing box: a surface that animates to the size of whatever it is showing, instead of
 * jumping to it. Extracted from `Dock`, where the rail becomes the menu inside one box.
 *
 * The trick is that the box never measures itself, it measures an inner viewport that is free to
 * be its natural size. While the box is mid-transition at the OLD size, the viewport is already at
 * the new one, so a `ResizeObserver` on it reads where the box is going rather than where it is.
 * Writing that back as an inline width/height gives CSS two real numbers to tween between.
 *
 * DESTRUCTURE the result. Reading `morph.style` off the returned object trips this repo's strict
 * `react-hooks/refs` rule: the object holds a ref, so the linter treats any property read on it as
 * a ref access during render.
 *
 * @example
 * const { ref, style, ready, viewportClassName } = useMorphBox("height")
 *
 * <div data-morph-ready={ready ? "" : undefined} style={style} className={cn(morphBox)}>
 *   <div ref={ref} className={viewportClassName}>{view}</div>
 * </div>
 *
 * Three things to know before reaching for it:
 * - It animates LAYOUT (width/height), not transform, so it is cheap on a menu or a dialog and
 *   expensive on a full-page panel. A drawer should still move with `translate`.
 * - `overflow-hidden` is what makes the reveal read as one object, and it also clips focus rings
 *   and anything not portalled. Leave the box enough padding to hold a ring.
 * - Content that can grow without a ceiling turns the gesture back into a jump. Cap it and scroll.
 */
export type MorphAxis = "both" | "height" | "width"

/**
 * Base classes for the element that morphs. `data-morph-ready` is set only once a measurement
 * exists, so the box never animates in from zero on first paint: on load it is simply there.
 * Add your own `data-[morph-ready]:transition-[…]` to extend the property list (the Dock adds
 * `border-radius`); same variant prefix, so `tailwind-merge` keeps the last one.
 */
export const morphBox = [
  "relative overflow-hidden",
  "data-[morph-ready]:transition-[width,height] data-[morph-ready]:duration-base data-[morph-ready]:ease-out",
  "motion-reduce:transition-none",
]

export interface MorphBox<T extends HTMLElement> {
  /** Goes on the inner viewport, the element that is allowed to be its natural size. */
  ref: React.RefCallback<T>
  /** Inline width/height for the morphing box. `undefined` until the first measurement lands. */
  style: React.CSSProperties | undefined
  /** Whether a measurement exists yet. Feed it to `data-morph-ready` to arm the transition. */
  ready: boolean
  /** The viewport's sizing class: natural width when the width morphs, full width when it doesn't. */
  viewportClassName: string
}

/**
 * Measure an inner viewport and hand back the size its box should animate to.
 *
 * @param axis which dimensions the box owns. `"height"` is the common one for a surface whose
 * width is already decided (a dialog, a menu pinned to its trigger); `"both"` for a box that
 * changes shape entirely (the Dock's rail becoming a panel).
 */
export function useMorphBox<T extends HTMLElement = HTMLDivElement>(
  axis: MorphAxis = "both",
): MorphBox<T> {
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)

  /**
   * A callback ref, not a `useRef` plus a mount-time layout effect. The measured node very often
   * appears LATER than the component that owns the hook: a dialog's content, a menu's popper, a
   * panel behind a flag. An effect with `[]` deps runs once, finds `ref.current` still null, and
   * never observes anything, which leaves the box on `height: auto` and silently back to jumping.
   * A callback ref fires whenever the node arrives and again when it leaves.
   *
   * Layout box (offsetWidth/Height), never a rect, so a child's press-scale (a transform, not
   * layout) can never feed jitter back into the measurement.
   */
  const ref = React.useCallback((node: T | null) => {
    if (!node) return
    const measure = () => setSize({ width: node.offsetWidth, height: node.offsetHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    // React 19 calls this cleanup when the node detaches. Dropping the size with it means a
    // surface that closes and opens again starts from its own content instead of animating down
    // from whatever the last one happened to be.
    return () => {
      observer.disconnect()
      setSize(null)
    }
  }, [])

  const style = size
    ? {
        width: axis === "height" ? undefined : size.width,
        height: axis === "width" ? undefined : size.height,
      }
    : undefined

  return {
    ref,
    style,
    ready: size !== null,
    // A box that owns its width needs a viewport free to be wider than it currently is; one that
    // only owns its height needs a viewport that fills it, or the content would shrink-wrap.
    viewportClassName: axis === "height" ? "w-full" : "w-max",
  }
}
