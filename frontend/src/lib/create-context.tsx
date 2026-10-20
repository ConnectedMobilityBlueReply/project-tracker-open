import * as React from "react"

/**
 * Typed context factory for compound components: the scalable alternative to
 * prop-drilling or cloning children (see docs/ARCHITECTURE.md). Shared state
 * (size, variant, open…) flows from a `Root` provider to its parts.
 *
 * @example
 * const [SelectProvider, useSelectContext] = createContext<{ size: Size }>("Select")
 * // in Root:     <SelectProvider size={size}>{children}</SelectProvider>
 * // in a part:   const { size } = useSelectContext("Select.Trigger")
 */
export function createContext<ContextValue>(rootComponentName: string) {
  const Context = React.createContext<ContextValue | null>(null)
  Context.displayName = `${rootComponentName}Context`

  function Provider({
    children,
    ...value
  }: ContextValue & { children: React.ReactNode }) {
    // Stabilize the value by its own fields so consumers don't re-render needlessly.
    const memo = React.useMemo(
      () => value as ContextValue,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(value as Record<string, unknown>),
    )
    return <Context.Provider value={memo}>{children}</Context.Provider>
  }

  function useContext(consumerName: string): ContextValue {
    const context = React.useContext(Context)
    if (context === null) {
      throw new Error(
        `\`${consumerName}\` must be used within \`${rootComponentName}.Root\``,
      )
    }
    return context
  }

  return [Provider, useContext] as const
}
