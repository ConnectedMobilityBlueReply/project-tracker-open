// URL dei file SVG vendorizzati (Vite), mai CDN a runtime.
/// <reference types="vite/client" />

const urls = import.meta.glob('../assets/project-icons/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function projectIconUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  return urls[`../assets/project-icons/${key}.svg`] ?? null;
}
