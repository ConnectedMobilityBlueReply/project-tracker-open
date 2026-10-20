"use client"

import * as React from "react"

import { tv, type VariantProps } from "@/lib/tv"

/**
 * AnimatedLabel: text that rolls when it changes state. The outgoing label lifts up and out while
 * the incoming one rises from below, and the box eases between the two label widths, so a control
 * whose copy flips (Next → Done, Show more → Show less, Weak → Strong) morphs instead of jumping.
 * The prose sibling of AnimatedNumber: same departure-board motion, but for words, which is why it
 * also has to deal with the width the way a figure never does.
 *
 * Because children are new React elements on every render, the component can't tell a real state
 * change from a re-render. `swapKey` is the signal: change it in step with the children and
 * nothing rolls until the meaning does.
 *
 * Not multi-part in the public sense: it renders one `<span>` with the layers it swaps itself, so
 * there are no exported parts. Backed by the `label-swap-*` keyframes (globals.css, gated on the
 * motion query) — under reduced motion the label simply swaps.
 */
export const animatedLabelVariants = tv({
  slots: {
    // Positioning context for the swap, and the box whose width is morphed. No overflow clip: the
    // layers dissolve on opacity rather than being sliced by a window edge (same call as the
    // number roll). `[gap:inherit]` carries a host's gap down, since `gap` doesn't inherit.
    root: "relative inline-flex items-center [gap:inherit] motion-safe:transition-[width] motion-safe:duration-base motion-safe:ease-out",
    // The current label, in flow, so it alone sizes the box. `shrink-0` keeps it at its natural
    // width while the box is pinned mid-morph: it overflows the narrower box evenly instead of
    // being squeezed, so it stays put optically.
    incoming: "inline-flex shrink-0 items-center [gap:inherit]",
    // The outgoing snapshot, out of flow so it can leave without widening anything. It rests at
    // opacity 0: if the animation never runs (reduced motion) it stays invisible rather than
    // overlapping the new label.
    outgoing: "label-swap-out absolute inset-0 flex items-center [gap:inherit] opacity-0",
    // The snapshot's own max-content box, so the width the label is morphing *from* can be read
    // straight off it, whatever the root has been pinned to.
    snapshot: "inline-flex w-max shrink-0 items-center [gap:inherit]",
  },
  variants: {
    /**
     * Where the label sits while the box is a different width than the label (mid-morph, and for
     * the outgoing layer throughout). `center` is right inside a button; left-aligned copy wants
     * `start`, or the text drifts sideways as the box eases.
     */
    align: {
      start: { root: "justify-start", outgoing: "justify-start" },
      center: { root: "justify-center", outgoing: "justify-center" },
      end: { root: "justify-end", outgoing: "justify-end" },
    },
  },
  defaultVariants: {
    align: "center",
  },
})

export interface AnimatedLabelProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof animatedLabelVariants> {
  /**
   * Identifies the label currently on screen. Change it in step with `children`
   * (`swapKey={expanded ? "less" : "more"}`) and the two roll past each other.
   */
  swapKey: React.Key
}

export function AnimatedLabel({
  swapKey,
  align,
  className,
  children,
  ...props
}: AnimatedLabelProps) {
  const slots = animatedLabelVariants({ align })

  // React's blessed "store the previous value" pattern, the same one AnimatedNumber uses: adjust
  // state *during render* (never in an effect, which the strict react-hooks lint forbids) so a
  // changed `swapKey` captures the label that was on screen as the outgoing layer and bumps `seq`,
  // the key that replays both rolls.
  const [state, setState] = React.useState<{
    key: React.Key
    node: React.ReactNode
    prev: React.ReactNode | null
    seq: number
  }>(() => ({ key: swapKey, node: children, prev: null, seq: 0 }))

  if (!Object.is(state.key, swapKey)) {
    setState((s) => ({ key: swapKey, node: children, prev: s.node, seq: s.seq + 1 }))
  }

  const rootRef = React.useRef<HTMLSpanElement>(null)
  const snapshotRef = React.useRef<HTMLSpanElement>(null)

  /**
   * The width is the part CSS can't do alone: a track can be collapsed to nothing, but nothing
   * expresses "ease from the old label's natural width to the new one's". So the swap measures
   * both and drives the box imperatively: pin the old width, flush it, hand over the new one, then
   * release back to `auto` on transitionend. Through the DOM node rather than state, since a width
   * in state would render a frame late (and set-state-in-effect is barred here anyway).
   */
  React.useLayoutEffect(() => {
    const el = rootRef.current
    const snapshot = snapshotRef.current
    // No snapshot means there's nothing to morph away from: first paint, or a swap that already
    // finished. Either way the box is free to size itself.
    if (!el || !snapshot) return

    // A pinned width means we're interrupting a morph that's still running, so the start value is
    // whatever is on screen right now — a fast there-and-back never jumps to the width it was
    // heading for. Otherwise it's the outgoing label's own natural width, read off the snapshot
    // rather than remembered: a cached number goes stale the moment anything else resizes the
    // label (a web font landing, a density change).
    //
    // Every measurement is `offsetWidth`, never a bounding rect: the click that triggers a swap
    // tends to leave its control mid press-scale, and a rect would report the label a few percent
    // narrow and pin the morph to a width it then snaps out of.
    const pinned = el.style.width !== ""
    const from = pinned ? el.offsetWidth : snapshot.offsetWidth
    if (pinned) el.style.width = ""
    // The outgoing layer is out of flow, so this is purely the incoming label's natural width.
    const to = el.offsetWidth

    // Nothing worth easing (two labels that happen to measure the same), and under reduced motion
    // the box simply resizes with the swap.
    if (Math.abs(from - to) < 1) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    el.style.width = `${from}px`
    // Reading layout flushes the start value; without it the two writes coalesce and nothing eases.
    el.getBoundingClientRect()
    el.style.width = `${to}px`

    // Release to `auto` once the morph lands, so the label is free to reflow (a font swap, a
    // density change, copy edited in place) instead of being held at a stale pixel width.
    const release = () => {
      el.style.width = ""
    }
    el.addEventListener("transitionend", release, { once: true })
    return () => el.removeEventListener("transitionend", release)
  }, [state.seq])

  return (
    <span ref={rootRef} data-slot="animated-label" className={slots.root({ className })} {...props}>
      {/* The enter is gated on seq > 0 so the very first paint doesn't roll (make-interfaces #13). */}
      <span
        key={`in-${state.seq}`}
        className={slots.incoming({ className: state.seq > 0 ? "label-swap-in" : undefined })}
      >
        {children}
      </span>
      {state.prev != null && (
        <span
          key={`out-${state.seq}`}
          aria-hidden
          className={slots.outgoing()}
          // Drop the outgoing layer the moment its roll finishes (an event handler, not an effect).
          // Only its own roll counts: animationend bubbles, and a label can carry an animated icon.
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget) setState((s) => ({ ...s, prev: null }))
          }}
        >
          <span ref={snapshotRef} className={slots.snapshot()}>
            {state.prev}
          </span>
        </span>
      )}
    </span>
  )
}
