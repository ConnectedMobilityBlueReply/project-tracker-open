import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from './csv.ts';

const BOM = '﻿';

test('intestazioni dalle chiavi, separatore ; e righe CRLF', () => {
  assert.equal(toCsv([{ Nome: 'A', Giorni: 3 }, { Nome: 'B', Giorni: 0 }]), `${BOM}Nome;Giorni\r\nA;3\r\nB;0`);
});

test('decimali con la virgola per Excel in italiano', () => {
  assert.equal(toCsv([{ Giorni: 12.5 }]), `${BOM}Giorni\r\n12,5`);
});

test('virgolette, separatore e a capo vengono quotati', () => {
  assert.equal(toCsv([{ Nota: 'a;b' }, { Nota: 'dice "ok"' }, { Nota: 'riga\nnuova' }]),
    `${BOM}Nota\r\n"a;b"\r\n"dice ""ok"""\r\n"riga\nnuova"`);
});

test('testo che Excel leggerebbe come formula viene neutralizzato', () => {
  assert.equal(toCsv([{ Nome: '=HYPERLINK("x")' }, { Nome: '+1' }, { Nome: '-2' }, { Nome: '@a' }]),
    `${BOM}Nome\r\n"'=HYPERLINK(""x"")"\r\n'+1\r\n'-2\r\n'@a`);
});

test('virgola e tab quotati: niente formula se Excel usa la virgola come separatore', () => {
  assert.equal(toCsv([{ Nome: 'a,=1+1' }, { Nome: 'b\tc' }]), `${BOM}Nome\r\n"a,=1+1"\r\n"b\tc"`);
});

test('numeri negativi restano numeri, null e undefined diventano vuoti', () => {
  assert.equal(toCsv([{ Saldo: -2.5, A: null, B: undefined }]), `${BOM}Saldo;A;B\r\n-2,5;;`);
});

test('nessuna riga: solo BOM', () => {
  assert.equal(toCsv([]), BOM);
});
