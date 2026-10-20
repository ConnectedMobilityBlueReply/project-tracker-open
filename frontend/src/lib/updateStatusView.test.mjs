import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCheckedAt, updateStatusView } from './updateStatusView.ts';

const base = { version: null, percent: null, checkedAt: null, currentVersion: '1.1.0' };
const view = (status, extra = {}) => updateStatusView({ ...base, status, ...extra });

test('idle e up-to-date offrono il controllo', () => {
  assert.deepEqual(view('idle'), {
    message: 'Gli aggiornamenti vengono controllati automaticamente ogni 4 ore.',
    tone: 'neutral', action: 'check', actionLabel: 'Controlla aggiornamenti', busy: false, showProgress: false,
  });
  assert.deepEqual(view('up-to-date'), {
    message: "Hai l'ultima versione.",
    tone: 'success', action: 'check', actionLabel: 'Controlla aggiornamenti', busy: false, showProgress: false,
  });
});

test('checking mostra il controllo occupato', () => {
  assert.deepEqual(view('checking'), {
    message: 'Controllo in corso…',
    tone: 'neutral', action: 'check', actionLabel: 'Controlla aggiornamenti', busy: true, showProgress: false,
  });
});

test('downloading mostra la barra e nessuna azione', () => {
  assert.deepEqual(view('downloading', { version: '1.2.0', percent: 42 }), {
    message: 'Download versione 1.2.0…',
    tone: 'neutral', action: null, actionLabel: '', busy: false, showProgress: true,
  });
});

test('ready offre il riavvio', () => {
  assert.deepEqual(view('ready', { version: '1.2.0' }), {
    message: "Versione 1.2.0 pronta. Verrà installata alla chiusura dell'app.",
    tone: 'success', action: 'install', actionLabel: 'Riavvia e installa', busy: false, showProgress: false,
  });
});

test('error offre Riprova senza dettagli tecnici', () => {
  assert.deepEqual(view('error'), {
    message: 'Controllo non riuscito. Verifica la connessione e riprova.',
    tone: 'danger', action: 'check', actionLabel: 'Riprova', busy: false, showProgress: false,
  });
});

test('unsupported non offre azioni', () => {
  assert.deepEqual(view('unsupported'), {
    message: 'Aggiornamenti non disponibili in questa build.',
    tone: 'neutral', action: null, actionLabel: '', busy: false, showProgress: false,
  });
});

test('ultimo controllo: mai, oggi, altro giorno', () => {
  const now = new Date(2026, 9, 8, 16, 0);
  assert.equal(formatCheckedAt(null, now), 'mai');
  assert.equal(formatCheckedAt(new Date(2026, 9, 8, 9, 5).toISOString(), now), 'oggi alle 09:05');
  assert.equal(formatCheckedAt(new Date(2026, 9, 7, 23, 50).toISOString(), now), 'il 07/10 alle 23:50');
});
