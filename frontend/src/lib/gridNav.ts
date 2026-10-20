export type NavKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter';

const DELTA: Record<NavKey, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  Enter: [1, 0],
};

/** Cella di destinazione, o null se il tasto porterebbe fuori dalla griglia. */
export function nextCell(
  pos: { row: number; col: number }, key: NavKey, size: { rows: number; cols: number },
): { row: number; col: number } | null {
  const [dr, dc] = DELTA[key];
  const row = pos.row + dr;
  const col = pos.col + dc;
  if (row < 0 || col < 0 || row >= size.rows || col >= size.cols) return null;
  return { row, col };
}
