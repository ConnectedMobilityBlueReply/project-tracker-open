import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const UI = join(SRC, 'components/ui');

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  }).filter(path => /\.(tsx?|mjs)$/.test(path) && !path.endsWith('.test.mjs'));
}

const FLAT_ALLOWED = new Set(['command-palette.tsx', 'table.tsx']);

test('in components/ui non restano primitive piatte shadcn', () => {
  const flat = readdirSync(UI).filter(name => name.endsWith('.tsx') && !FLAT_ALLOWED.has(name));
  assert.deepEqual(flat, []);
});

test('nessun import di base-ui, lucide o cva nel sorgente', () => {
  const offenders = walk(SRC).filter(path =>
    /from ['"](@base-ui\/react|lucide-react|class-variance-authority)/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders.map(path => path.replace(SRC, '')), []);
});

test('nessuna render prop base-ui sui trigger (si usa asChild)', () => {
  const offenders = walk(SRC).filter(path => /\brender=\{/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders.map(path => path.replace(SRC, '')), []);
});

test('il tema Koala è installato e Geist non è più importato', () => {
  assert.ok(existsSync(join(SRC, 'styles/koala.css')));
  assert.equal(/fontsource-variable\/geist/.test(readFileSync(join(SRC, 'main.tsx'), 'utf8')), false);
});

test('nessuna classe palette Tailwind numerata in pagine e componenti', () => {
  const offenders = walk(SRC)
    .filter(path => /\.(tsx|ts)$/.test(path) && !path.includes(`${join('components', 'ui')}`))
    .filter(path => /\b(bg|text|border|ring|from|to|via)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('nessun <svg> scritto a mano fuori da components/ui e GanttChart', () => {
  const offenders = walk(SRC)
    .filter(path => path.endsWith('.tsx'))
    .filter(path => !path.includes(join('components', 'ui')) && !path.endsWith('GanttChart.tsx'))
    .filter(path => /<svg[\s>]/.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
