"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * I due temi dell'app: `light` e `dark`, anche target della preferenza di sistema. Ciascuno è una
 * classe nel foglio di stile dei token (globals.css qui, koala.css in un progetto installato): tenere
 * allineate le due liste.
 */
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** What a visitor can pick: a fixed theme, or `"system"` to follow the OS light/dark preference. */
export type ThemeSetting = Theme | "system";

/**
 * One theme for the whole app, applied as a class on `<html>`. Wrap the root layout's `<body>`
 * contents in it; `koalaui init` installs this file. Read or set the theme with next-themes'
 * `useTheme()`.
 *
 * The theme deliberately lives on the document element rather than a scoped wrapper: every content
 * portal in the DS renders into `document.body`, so a scoped theme would leave each opened Dialog,
 * Select, DropdownMenu and Tooltip in the wrong one. A single band that must stay in one theme
 * takes the theme class itself (`<section className="dark">`).
 *
 * A first visit follows the OS (`defaultTheme="system"`): next-themes resolves
 * `prefers-color-scheme` to `light` or `dark` in its blocking script, so the class is right before
 * first paint, and keeps listening, so flipping the OS appearance re-skins an open tab. Picking a
 * theme (the site footer, the docs header) pins it in localStorage until the visitor picks System.
 *
 * `disableTransitionOnChange` stays on: with a page of live demos re-skinning at once, letting each
 * one animate its colors would read as a smear rather than a switch.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={[...THEMES]}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
