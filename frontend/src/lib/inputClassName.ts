const TYPOGRAPHY = /^(?:text-|font-|placeholder|tracking-|leading-|tabular-nums$|uppercase$|lowercase$|capitalize$|truncate$|caret-|selection:|file:)/;
// Keep pseudo-element variants on the field; colons inside arbitrary values aren't prefixes.
const VARIANT_PREFIX = /^(?:(?!placeholder:|selection:|file:)(?:[^:[\]]|\[[^\]]*\])+:)*/;

/** Il guscio Koala possiede il box e il chrome: solo la tipografia va sul campo. */
export function splitInputClassName(className?: string): { root: string; field: string } {
  const root: string[] = [];
  const field: string[] = [];
  for (const token of (className ?? '').split(/\s+/).filter(Boolean)) {
    const bare = token.replace(/^!/, '').replace(VARIANT_PREFIX, '').replace(/^!|!$/g, '');
    (TYPOGRAPHY.test(bare) ? field : root).push(token);
  }
  return { root: root.join(' '), field: field.join(' ') };
}
