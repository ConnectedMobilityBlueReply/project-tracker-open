export type CsvValue = string | number | null | undefined;

// Excel in italiano: separatore ';', decimali con la virgola, BOM per leggere l'UTF-8.
const SEPARATOR = ';';
const BOM = '﻿';
// Testo che inizia così Excel lo interpreta come formula (CSV injection).
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvValue): string {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  // Anche ',' e tab: con Excel in un'altra lingua il separatore cambia e una
  // cella non quotata verrebbe spezzata, facendo iniziare la successiva con '='.
  return /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Intestazioni dalle chiavi della prima riga. */
export function toCsv(rows: readonly Record<string, CsvValue>[]): string {
  if (rows.length === 0) return BOM;
  const headers = Object.keys(rows[0]);
  const lines = [headers, ...rows.map(row => headers.map(header => row[header]))];
  return BOM + lines.map(line => line.map(cell).join(SEPARATOR)).join('\r\n');
}

export function downloadCsv(filename: string, rows: readonly Record<string, CsvValue>[]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revocare subito può annullare il download in alcuni browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
