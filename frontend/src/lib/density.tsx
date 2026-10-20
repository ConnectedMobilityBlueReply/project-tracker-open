"use client"

import * as React from "react"

/**
 * Density: Koala's cross-cutting spacing axis. Koala serves both application UI (tight,
 * information-dense) and marketing (generous), the way Tailwind serves both. `density`
 * is the knob that retunes padding, gaps, and control heights without touching color or
 * radius. `compact` is the Koala default (16px padding/gaps, smaller titles, shorter
 * controls); `comfortable` is the spacious marketing alternative.
 *
 * Unlike `lib/create-context.tsx` (which throws outside its provider), density has a
 * legitimate value with no provider, so the context carries a safe default.
 */
export type Density = "comfortable" | "compact"

const DensityContext = React.createContext<Density>("compact")
DensityContext.displayName = "DensityContext"

/**
 * Set the density for a subtree, e.g. wrap an app shell in `density="compact"` and every
 * nested Koala component tightens up, with no per-instance props. A `data-density`
 * attribute is stamped on the wrapper as a CSS/debug escape hatch. The wrapper is
 * `display: contents`, so it never introduces a box into the layout.
 */
export function DensityProvider({
  density,
  children,
}: {
  density: Density
  children: React.ReactNode
}) {
  return (
    <DensityContext.Provider value={density}>
      <div data-density={density} className="contents">
        {children}
      </div>
    </DensityContext.Provider>
  )
}

/**
 * Resolve the effective density. Precedence: explicit prop > nearest provider >
 * `"compact"`. Content/layout components (List, Card, tables, app-shell padding) call
 * `useDensity(props.density)` and feed the result into their `tv` recipe.
 */
export function useDensity(density?: Density): Density {
  const context = React.useContext(DensityContext)
  return density ?? context
}

/** The one height axis every form control shares: sm 32 · md 36 · lg 40px. */
export type ControlSize = "sm" | "md" | "lg"

/**
 * A Button's height axis: the control sizes plus `xl` (44px, 16px label), the marketing CTA tier a
 * hero or a landing section sets beside a 60-72px display title, where a 40px button reads small.
 * `xl` is button-only on purpose: no form wants a 44px field. A container may still impose it (a
 * hero's CTA row); a field inside that container resolves it to `lg`, the biggest field.
 */
export type ButtonSize = ControlSize | "xl"

/**
 * The control size a *container* imposes on the controls inside it. `Form` is the one that
 * sets it (a form's fields are bigger than the same control sitting in a toolbar), which is
 * why this is `null` by default: outside such a container, density picks the size as before.
 */
const ControlSizeContext = React.createContext<ButtonSize | null>(null)
ControlSizeContext.displayName = "ControlSizeContext"

/**
 * Impose a control size on a subtree. A control's own `size` prop still wins, so this is a
 * default, not an override.
 *
 * Renders **no element at all**, unlike `DensityProvider` above, which keeps a `display:contents`
 * wrapper for its `data-density` escape hatch. The asymmetry is deliberate: a container that
 * imposes a size is usually a bordered shell whose own recipe draws seams with direct-child
 * selectors (`InputGroup`'s `[&>*:not(:first-child)]:border-l`) or spaces children with
 * `space-y-*` / `divide-*`. A `display:contents` div generates no box but IS still a DOM child,
 * and those selectors match the DOM: a wrapper would silently kill the seams or the spacing.
 * Containers stamp `data-control-size` on their own root instead, which is a better debug anchor
 * anyway (it names the element that made the decision).
 */
export function ControlSizeProvider({
  size,
  children,
}: {
  size: ButtonSize
  children: React.ReactNode
}) {
  return <ControlSizeContext.Provider value={size}>{children}</ControlSizeContext.Provider>
}

/** A button-only `xl` imposed on a field resolves to the biggest field size. */
function toControlSize(size: ButtonSize): ControlSize {
  return size === "xl" ? "lg" : size
}

/** The control size imposed by the nearest container, or `null` outside one. */
export function useControlSizeContext(): ControlSize | null {
  const size = React.useContext(ControlSizeContext)
  return size ? toControlSize(size) : null
}

/**
 * Resolve a form control's size. In Koala, control HEIGHT comes from `size` alone, so any two
 * controls with the same size are the same height. Density does NOT tier-shift height; it only
 * picks the DEFAULT size when none is given (compact → "sm", comfortable → "md"), the way Ant
 * Design's `componentSize` and Chakra's theme default work.
 *
 * Precedence, most local first: explicit `size` > explicit `density` arg > the container's
 * imposed size (`ControlSizeProvider`, i.e. `Form`) > ambient density. Both props on the
 * control itself beat what it inherits, so a control is never surprised by its container.
 * So a bare control in a compact app shell is "sm", the same control inside a `Form` is "lg",
 * and an explicit `size="md"` is always md, anywhere. Button, Input, InputGroup, Select,
 * ButtonGroup, DatePicker and MultiSelect all call this.
 */
export function useControlSize(size?: ControlSize, density?: Density): ControlSize {
  const contextDensity = React.useContext(DensityContext)
  const contextSize = React.useContext(ControlSizeContext)
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return toControlSize(contextSize)
  return contextDensity === "compact" ? "sm" : "md"
}

/**
 * `useControlSize` for a Button: the same precedence, but an imposed `xl` is kept instead of
 * resolved to `lg`, since the button is the one control that has the tier.
 *
 * One difference at the bottom of the chain: ambient density does NOT shrink a Button. An unsized
 * button with no container imposing a tier is `md` (36px) everywhere, in a compact dashboard and
 * on a comfortable landing alike, so the product has one default button. Density still reaches it
 * where it is explicit: a `density` prop on the button itself, or a container that imposes its
 * fields' size (InputGroup, DataTableToolbar, ButtonGroup), which keeps a button level with the
 * inputs beside it.
 */
export function useButtonSize(size?: ButtonSize, density?: Density): ButtonSize {
  const contextSize = React.useContext(ControlSizeContext)
  if (size) return size
  if (density) return density === "compact" ? "sm" : "md"
  if (contextSize) return contextSize
  return "md"
}
