import assert from 'node:assert/strict';
import test from 'node:test';
import { splitInputClassName } from './inputClassName.ts';

test('larghezza sul guscio e allineamento del testo sul campo', () => {
  assert.deepEqual(splitInputClassName('w-40 text-right'), { root: 'w-40', field: 'text-right' });
});

test('larghezza responsive e altezza vanno sul guscio', () => {
  assert.deepEqual(splitInputClassName('sm:w-64 h-9'), { root: 'sm:w-64 h-9', field: '' });
});

test('il campo centrato mantiene altezza e larghezza sul guscio', () => {
  assert.deepEqual(splitInputClassName('h-8 w-24 text-center'), { root: 'h-8 w-24', field: 'text-center' });
});

test('il controllo compatto di MieiTask mantiene tutto il chrome sul guscio', () => {
  assert.deepEqual(splitInputClassName('h-7 w-14 rounded border border-border px-1 text-center text-xs'), {
    root: 'h-7 w-14 rounded border border-border px-1',
    field: 'text-center text-xs',
  });
});

test('altezza minima e margini vanno sul guscio', () => {
  assert.deepEqual(splitInputClassName('min-h-9 mt-2 mx-auto'), { root: 'min-h-9 mt-2 mx-auto', field: '' });
});

test('margini negativi e larghezze importanti vanno sul guscio', () => {
  assert.deepEqual(splitInputClassName('-mt-2 !w-full'), { root: '-mt-2 !w-full', field: '' });
});

test('sfondo hover e larghezza minima vanno sul guscio', () => {
  assert.deepEqual(splitInputClassName('hover:bg-muted min-w-0'), { root: 'hover:bg-muted min-w-0', field: '' });
});

test('classi tipografiche con varianti e important restano sul campo', () => {
  assert.deepEqual(splitInputClassName('sm:hover:!text-right focus:font-medium text-muted-foreground text-xs!'), {
    root: '',
    field: 'sm:hover:!text-right focus:font-medium text-muted-foreground text-xs!',
  });
});

test('placeholder, selection e file restano sul campo anche con varianti', () => {
  const className = 'sm:placeholder:italic hover:selection:bg-primary focus:file:border-0';
  assert.deepEqual(splitInputClassName(className), { root: '', field: className });
});

test('tutte le altre classi tipografiche restano sul campo', () => {
  const className = 'tracking-tight leading-5 tabular-nums uppercase lowercase capitalize truncate caret-primary';
  assert.deepEqual(splitInputClassName(className), { root: '', field: className });
});

test('i due punti nei valori e nelle varianti arbitrarie non nascondono la tipografia', () => {
  const className = 'text-[color:var(--foreground)] [&:focus]:!text-center';
  assert.deepEqual(splitInputClassName(className), { root: '', field: className });
});

test('bordo, padding, sfondo e focus ring con varianti restano sul guscio', () => {
  const className = 'md:!px-2 focus:ring-2 border rounded bg-muted shadow-sm max-h-20 py-1';
  assert.deepEqual(splitInputClassName(className), { root: className, field: '' });
});

test('className assente produce due stringhe vuote', () => {
  assert.deepEqual(splitInputClassName(undefined), { root: '', field: '' });
});
