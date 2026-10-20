import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = new URL('.', import.meta.url).pathname;

const COBALT_CLASS = /\b(?:bg|text|border|fill|stroke|ring|from|to|via|divide|outline|shadow)-(?:paper2?|ink2?|rule2?|shell|accent-(?:hover|ink)|danger)\b(?!-foreground)/;
const SOURCE_EXTENSION = /\.(?:css|js|jsx|mjs|ts|tsx)$/;
const LITERAL_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;

function sourceFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (SOURCE_EXTENSION.test(entry) && entry !== 'migration.test.mjs') out.push(full);
  }
  return out;
}

const files = sourceFiles()
  .map(f => ({ rel: relative(SRC, f), body: readFileSync(f, 'utf8') }));

test('nessun file importa @heroui', () => {
  const offenders = files
    .filter(f => f.body.includes('@heroui'))
    .map(f => f.rel);
  assert.deepEqual(offenders, [], `import @heroui trovati in: ${offenders.join(', ')}`);
});

test('nessun file usa utility Cobalt', () => {
  const offenders = files
    .filter(f => COBALT_CLASS.test(f.body))
    .map(f => f.rel);
  assert.deepEqual(offenders, [], `classi Cobalt trovate in: ${offenders.join(', ')}`);
});

test('nessun colore letterale fuori dai token', () => {
  const offenders = files
    .filter(f => /\.tsx?$/.test(f.rel) && LITERAL_COLOR.test(f.body))
    .map(f => f.rel);
  assert.deepEqual(offenders, [], `colori letterali trovati in: ${offenders.join(', ')} — usare i token di index.css`);
});
