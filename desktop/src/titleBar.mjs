export const TITLE_BAR_HEIGHT = 40;
// Colori del tema light (--canvas / --foreground), usati prima che il renderer comunichi il tema attivo.
export const DEFAULT_TITLE_BAR_COLORS = { color: '#eeeeee', symbolColor: '#0a0a0a' };

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Il renderer è non fidato: passano solo hex #rrggbb, nient'altro arriva a setTitleBarOverlay.
export function sanitizeTitleBarColors(value) {
  if (!value || typeof value !== 'object') return null;
  const { color, symbolColor } = value;
  if (typeof color !== 'string' || typeof symbolColor !== 'string') return null;
  if (!HEX_COLOR.test(color) || !HEX_COLOR.test(symbolColor)) return null;
  return { color, symbolColor };
}
