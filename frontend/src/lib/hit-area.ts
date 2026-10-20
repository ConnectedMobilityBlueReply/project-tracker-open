/**
 * Hit-area extenders (docs/ARCHITECTURE.md §5, "Minimum hit area").
 *
 * An invisible `before:` box, centered on the control, grows the target without growing the visual:
 * 40px on a fine pointer, the house minimum, and 44px on a coarse one, where a fingertip needs it
 * (Apple HIG, WCAG 2.5.5). The touch step keys on the pointer, not the width, so a desktop never
 * changes at any window size.
 *
 * Always `before:`, never `after:`: across the library `after:` already carries image outlines,
 * active underlines, the DatePicker "today" dot and row hairlines.
 *
 * Every constant shares one centered geometry, so the touch step only raises a size and never fights
 * an inset. A literal copy of these outside this file is a bug (test/contracts/hit-area.test.ts).
 */

const pseudo =
  "before:absolute before:left-1/2 before:top-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"

/** Icon-only controls: a 40x40 square on desktop, 44x44 on touch. */
export const hitBox = `relative ${pseudo} before:size-10 pointer-coarse:before:size-11`

/** Text controls: 40px tall on desktop at their own width; 44 tall and at least 44 wide on touch. */
export const hitX = `relative ${pseudo} before:h-10 before:w-full pointer-coarse:before:h-11 pointer-coarse:before:min-w-11`

/**
 * Vertical only: 40px tall on desktop, 44 on touch, never wider than the control. For tight rows of
 * small targets (rating stars, toolbar icons) where growing sideways would steal a neighbour's tap.
 */
export const hitY = `relative ${pseudo} before:h-10 before:w-full pointer-coarse:before:h-11`

/** Controls already 40px or larger on desktop: adds nothing there, grows to 44x44 on touch. */
export const hitCoarse = `relative ${pseudo} before:size-full pointer-coarse:before:min-h-11 pointer-coarse:before:min-w-11`

/**
 * `hitBox` for a control that is already positioned (`absolute`, `fixed`): the same box without
 * `relative`, which tailwind-merge would otherwise let override the control's own position. A
 * positioned element is already the containing block for its pseudo-element.
 */
export const hitBoxPositioned = `${pseudo} before:size-10 pointer-coarse:before:size-11`
