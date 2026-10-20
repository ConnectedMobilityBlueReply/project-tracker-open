/**
 * Guardie degli overlay (schermo intero, dialog), come funzioni pure per poterle
 * testare con `node --test`: i componenti non hanno un renderer DOM.
 */

export interface EscapeContext {
  key: string;
  /** Un altro gestore (es. una cella che annulla la bozza) ha gia' consumato il tasto. */
  defaultPrevented: boolean;
  /** Il tasto arriva da dentro un popup di lista aperto (Select). */
  insideListbox: boolean;
  /** C'e' un dialog aperto: Esc spetta a lui. */
  hasOpenDialog: boolean;
}

/** Esc esce dallo schermo intero solo se nessun altro elemento lo sta gia' usando. */
export function shouldExitFullscreen(context: EscapeContext): boolean {
  return context.key === 'Escape'
    && !context.defaultPrevented
    && !context.insideListbox
    && !context.hasOpenDialog;
}
