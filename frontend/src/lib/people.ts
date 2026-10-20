export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

/** Toni categoriali dell'Avatar Koala (`color`). */
export const AVATAR_COLORS = ['brand', 'purple', 'pink', 'teal', 'orange'] as const;
export type AvatarColor = typeof AVATAR_COLORS[number];

/** Colore stabile per persona: stesso nome, stesso colore, su ogni pagina. */
export function avatarColorFor(key: string): AvatarColor {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
