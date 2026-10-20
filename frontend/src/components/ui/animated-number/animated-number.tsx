"use client"

import * as React from "react"

import { tv } from "@/lib/tv"

/**
 * AnimatedNumber: a figure that rolls when it changes, one character at a time. The value is split
 * into per-character cells; only the characters that actually changed roll (the old glyph lifts up
 * and out, the new rises from below), and they fire in sequence left → right, so "2,450" → "8,125"
 * sweeps across like a departure board instead of the whole block dissolving. Untouched characters
 * never lose a drop of opacity. Driven by the `number-roll-*` keyframes (globals.css, gated on the
 * motion query) with the stagger step coming from `--number-roll-stagger`.
 *
 * Drop it around any changing number: a cart line total, a Stat's value, a live counter.
 * `tabular-nums` keeps the width steady so neighbours never jump, and the whole thing holds still
 * under `prefers-reduced-motion`.
 *
 * Not multi-part in the public sense: it renders one `<span>` of cells it manages itself, so there
 * are no exported parts. Single `tv` recipe, no variants.
 */
export const animatedNumberVariants = tv({
  slots: {
    // The inline box. `whitespace-pre` so a space inside the value survives being split into its own
    // cell; align-bottom keeps the box seated on the text baseline of whatever sits beside it.
    root: "relative inline-block whitespace-pre align-bottom tabular-nums",
    // One character. The positioning context for its own little swap: no overflow clip, so the
    // glyphs travel on opacity rather than being sliced by a window edge.
    //
    // `tabular-nums` (on the root) is there to stop DIGITS changing width as they roll, but a font
    // applies it to every figure-adjacent glyph, and a comma or a period handed a digit's advance
    // leaves a hole either side of itself: "1,368" sets as "1 , 368". The wider the face, the worse
    // it reads. So the separators, the currency mark and any other non-digit get their natural
    // width back, while the digits keep theirs fixed. Nothing moves: a separator's own width is
    // constant, so only a change in the NUMBER of digits resizes the figure, as it always did.
    cell: "relative inline-block data-[digit=false]:[font-variant-numeric:normal]",
    // The value as one uninterrupted string for assistive tech, since the visible glyphs are split
    // into per-character cells (which a screen reader could otherwise spell out digit by digit).
    reader: "sr-only",
    // The visible (incoming) glyph, in normal flow so it sizes the cell.
    incoming: "block",
    // The outgoing glyph, taken out of flow so it can't widen the cell as it leaves. Anchored right
    // because numbers grow leftwards: when a digit count drops, the ghost still sits where it was.
    // It rests at opacity-0, so if the animation never runs (reduced-motion, or a build where the
    // class isn't live yet) it stays invisible instead of overlapping the incoming glyph.
    outgoing: "absolute top-0 right-0 block opacity-0 number-roll-out",
  },
})

/**
 * Ceiling on the stagger, in steps. Past this the step shrinks so a long value (a 12-digit counter)
 * still lands as one gesture instead of crawling across the screen.
 */
const MAX_STAGGER_STEPS = 6

/** A zero-width space, so a cell with no incoming character still has a line box to align against. */
const NO_GLYPH = "\u200B"

type Cell = {
  /** Position counted from the *right*, so a character keeps its identity as the value grows. */
  pos: number
  char: string
  /** The outgoing glyph. Only set when this position actually changed, i.e. only when it rolls. */
  prev: string | null
  /** Unitless stagger multiplier; the step itself is the `--number-roll-stagger` token. */
  step: number
}

const isText = (v: React.ReactNode): v is string | number =>
  typeof v === "string" || typeof v === "number"

/**
 * Pair the new value against the old one character by character, aligned from the right (the way a
 * number grows), and hand each changed position its place in the stagger. Returns null for values
 * that aren't plain text: those fall back to rolling as a single block.
 */
function splitCells(value: React.ReactNode, prev: React.ReactNode | null): Cell[] | null {
  if (!isText(value)) return null
  if (prev !== null && !isText(prev)) return null

  const next = Array.from(String(value))
  const old = prev === null ? null : Array.from(String(prev))
  const length = Math.max(next.length, old?.length ?? 0)

  const cells: Cell[] = []
  for (let pos = length - 1; pos >= 0; pos--) {
    const char = next[next.length - 1 - pos] ?? ""
    const before = old ? (old[old.length - 1 - pos] ?? "") : null
    cells.push({ pos, char, prev: before !== null && before !== char ? before : null, step: 0 })
  }

  // Only the changed cells take part in the stagger, and the first of them starts immediately: a
  // change to the last two digits shouldn't wait out the digits in front of it.
  const changed = cells.filter((c) => c.prev !== null)
  const spread = changed.length > 1 ? Math.min(1, MAX_STAGGER_STEPS / (changed.length - 1)) : 0
  changed.forEach((c, i) => {
    c.step = i * spread
  })

  return cells
}

const delayStyle = (step: number): React.CSSProperties => ({
  animationDelay: `calc(var(--number-roll-stagger) * ${step})`,
})

export interface AnimatedNumberProps extends React.ComponentProps<"span"> {
  /** The figure to show. Changing it rolls the old value up and out, the new in from below. */
  value: React.ReactNode
}

export function AnimatedNumber({ value, className, ...props }: AnimatedNumberProps) {
  const { root, cell, reader, incoming, outgoing } = animatedNumberVariants()

  // React's blessed "store the previous value" pattern: adjust state *during render* (never in an
  // effect, which the strict react-hooks lint forbids) so a changed `value` captures the old figure
  // as the outgoing glyphs and bumps `seq` — the key that remounts the layers to replay their rolls.
  const [state, setState] = React.useState<{
    value: React.ReactNode
    prev: React.ReactNode | null
    seq: number
  }>(() => ({ value, prev: null, seq: 0 }))

  if (!Object.is(state.value, value)) {
    setState((s) => ({ value, prev: s.value, seq: s.seq + 1 }))
  }

  // Clear the outgoing glyphs the moment the roll finishes (an event handler, not an effect). With
  // the stagger, that's when the *last* one lands, so only it carries the handler.
  const clearPrev = () => setState((s) => ({ ...s, prev: null }))

  const cells = splitCells(state.value, state.prev)
  const changedCells = cells?.filter((c) => c.prev !== null)
  const last = changedCells?.[changedCells.length - 1]

  return (
    <span data-slot="animated-number" className={root({ className })} {...props}>
      {cells && <span className={reader()}>{String(state.value)}</span>}
      {cells
        ? cells.map((c) => (
            <span key={c.pos} aria-hidden data-digit={/\d/.test(c.char)} className={cell()}>
              {/* The enter roll only runs on a character that changed, so everything else holds at
                  full strength (polish #5: stagger the parts that move, don't fade the whole). */}
              <span
                key={c.prev !== null ? `in-${state.seq}` : "in"}
                className={incoming({ className: c.prev !== null ? "number-roll-in" : undefined })}
                style={c.prev !== null ? delayStyle(c.step) : undefined}
              >
                {c.char === "" ? NO_GLYPH : c.char}
              </span>
              {c.prev !== null && (
                <span
                  key={`out-${state.seq}`}
                  aria-hidden
                  className={outgoing()}
                  style={delayStyle(c.step)}
                  onAnimationEnd={c === last ? clearPrev : undefined}
                >
                  {c.prev}
                </span>
              )}
            </span>
          ))
        : // Not plain text (an element, a fragment): roll it as one block, same motion.
          [
            <span
              key={`in-${state.seq}`}
              className={incoming({
                className: state.seq > 0 ? "number-roll-in" : undefined,
              })}
            >
              {state.value}
            </span>,
            state.prev != null && (
              <span key={`out-${state.seq}`} aria-hidden className={outgoing()} onAnimationEnd={clearPrev}>
                {state.prev}
              </span>
            ),
          ]}
    </span>
  )
}
