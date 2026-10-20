"use client"

import * as React from "react"

/**
 * The DS's canonical viewport gate. Fire a touch *before* the element is fully on screen (the -10%
 * bottom margin) and as soon as a tenth of it has crossed, so an entrance has already begun by the
 * time the reader's eye lands on it. Every in-view behavior in the system shares these numbers:
 * import them rather than re-typing the literals, so a retune moves the whole system at once.
 */
export const IN_VIEW_OPTIONS = {
  rootMargin: "0px 0px -10% 0px",
  threshold: 0.1,
} satisfies IntersectionObserverInit

export interface UseInViewOptions extends IntersectionObserverInit {
  /**
   * Arm the gate. When `false` the hook never observes and reports `true` immediately, which is how
   * a component whose entrance is *optional* (Stagger's `inView`, SectionHeader's `staggerTrigger`)
   * says "no gate, play on mount". @default true
   */
  enabled?: boolean
  /**
   * Stop observing after the first intersection. Pass `false` to keep reporting both directions, so
   * the caller can re-arm each time the element leaves and re-enters. @default true
   */
  once?: boolean
}

/**
 * useInView: the shared "has this scrolled into view yet" gate, returning `[ref, inView]`.
 *
 * Attach the returned callback ref to the element to watch. State is set only from the observer
 * callback, never synchronously in the effect body, so it stays clear of the repo's strict
 * react-hooks rules (`set-state-in-effect`).
 *
 * The hook deliberately does **not** accept a forwarded ref to merge: `react-hooks/immutability`
 * forbids mutating a value that was passed as an argument to a hook, so a component that also takes
 * `ref` composes the two itself in its own commit-phase callback (where `ref` is a plain prop).
 *
 * Reach for it for any *declarative* gate (hold an entrance until the reader arrives). An
 * imperative scroll behavior that drives the DOM directly, like `StatValue`'s count-up, should keep
 * its own observer and import `IN_VIEW_OPTIONS` instead: routing a per-frame animation through React
 * state would cost a render on every scroll crossing.
 *
 * Pass stable `threshold` / `rootMargin` values; an inline array literal would re-create the
 * observer on every render.
 */
export function useInView<T extends Element = HTMLDivElement>({
  enabled = true,
  once = true,
  root,
  rootMargin = IN_VIEW_OPTIONS.rootMargin,
  threshold = IN_VIEW_OPTIONS.threshold,
}: UseInViewOptions = {}): [React.RefCallback<T>, boolean] {
  const nodeRef = React.useRef<T | null>(null)
  // A disarmed gate reads as "already in view": the caller asked for no gate at all.
  const [inView, setInView] = React.useState(!enabled)
  // Latches the one-shot case in a ref rather than a dependency, so a `once: false` gate doesn't
  // tear down and rebuild its observer on every crossing.
  const doneRef = React.useRef(false)

  React.useEffect(() => {
    if (!enabled || doneRef.current) return
    const el = nodeRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) {
            doneRef.current = true
            observer.disconnect()
          }
        } else if (!once) {
          setInView(false)
        }
      },
      { root, rootMargin, threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, once, root, rootMargin, threshold])

  // A stable callback ref, so attaching it never churns the observed node between renders.
  return [React.useCallback((node: T | null) => void (nodeRef.current = node), []), inView]
}
