import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PAGES = new URL('../../../pages/', import.meta.url).pathname;
const COMPONENTS = new URL('../../', import.meta.url).pathname;

function sources() {
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? (entry.name === 'ui' ? [] : walk(join(dir, entry.name))) : [join(dir, entry.name)]);
  return [...walk(PAGES), ...walk(COMPONENTS)].filter(path => path.endsWith('.tsx'));
}

const hasEmptyItem = source => /<SelectItem[^>]*value=(""|''|\{(""|''|``)\})/.test(source);
const hasMultipleProp = source => /<Select\b(?:[^>]|=>)*?\bmultiple\b/.test(source);

test('nessun SelectItem con value stringa vuota (Radix lo rifiuta)', () => {
  assert.equal(hasEmptyItem('<SelectItem value="">x</SelectItem>'), true);
  assert.equal(hasEmptyItem("<SelectItem value=''>x</SelectItem>"), true);
  assert.equal(hasEmptyItem("<SelectItem value={''}>x</SelectItem>"), true);
  assert.equal(hasEmptyItem('<SelectItem value={""}>x</SelectItem>'), true);
  assert.equal(hasEmptyItem('<SelectItem value="a">x</SelectItem>'), false);
  const offenders = sources().filter(path => hasEmptyItem(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('nessun Select usa più la prop multiple (si usa MultiSelect)', () => {
  assert.equal(hasMultipleProp('<Select multiple value={v}>'), true);
  assert.equal(hasMultipleProp('<Select onValueChange={v => set(v)} multiple>'), true);
  assert.equal(hasMultipleProp('<Select onValueChange={v => set(v)}>'), false);
  assert.equal(hasMultipleProp('<SelectItem value="multiple">'), false);
  const offenders = sources().filter(path => hasMultipleProp(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});
