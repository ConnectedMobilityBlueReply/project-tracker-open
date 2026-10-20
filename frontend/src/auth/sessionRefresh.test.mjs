import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSessionRefresher,
  fetchWithSessionRefresh,
} from './sessionRefresh.ts';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('single-flight: richieste 401 concorrenti → una sola chiamata di refresh', async () => {
  let refreshCalls = 0;
  const refresh = createSessionRefresher({
    refresh: async () => { refreshCalls += 1; await delay(10); },
    onSessionExpired: () => {},
  });

  const results = await Promise.all([refresh(), refresh(), refresh()]);
  assert.equal(refreshCalls, 1);
  assert.deepEqual(results, [true, true, true]);
});

test('refresh fallito → onSessionExpired esattamente una volta per ciclo', async () => {
  let expired = 0;
  const refresh = createSessionRefresher({
    refresh: async () => { throw new Error('SESSION_EXPIRED'); },
    onSessionExpired: () => { expired += 1; },
  });

  const results = await Promise.all([refresh(), refresh(), refresh()]);
  assert.equal(expired, 1);
  assert.deepEqual(results, [false, false, false]);
});

test('dopo il completamento un nuovo ciclo può ripartire', async () => {
  let calls = 0;
  const refresh = createSessionRefresher({
    refresh: async () => { calls += 1; },
    onSessionExpired: () => {},
  });

  await refresh();
  await refresh();
  assert.equal(calls, 2);
});

test('un ciclo FALLITO rilascia lo slot: i cicli successivi ripartono davvero', async () => {
  let calls = 0;
  let expired = 0;
  const refresh = createSessionRefresher({
    refresh: async () => {
      calls += 1;
      // 1° e 3° ciclo falliscono: se lo slot restasse avvelenato dopo una
      // rejection, nessun refresh riuscirebbe mai più per la vita della pagina.
      if (calls % 2 === 1) throw new Error('SESSION_EXPIRED');
    },
    onSessionExpired: () => { expired += 1; },
  });

  assert.equal(await refresh(), false);
  assert.equal(await refresh(), true);
  assert.equal(await refresh(), false);
  assert.equal(calls, 3);   // il refresh è stato davvero rieseguito dopo i fallimenti
  assert.equal(expired, 2); // esattamente una segnalazione per ciclo fallito
});

test('401 non-auth: refresh ok → retry una volta, nessun loop', async () => {
  const calls = [];
  const response = await fetchWithSessionRefresh('/projects', undefined, {
    fetchImpl: async (url) => {
      calls.push(url);
      return calls.length === 1 ? jsonResponse({ error: 'X' }, 401) : jsonResponse([{ id: 1 }]);
    },
    isAuthUrl: (url) => url.startsWith('/auth/'),
    refresh: async () => true,
    onUnauthorized: () => { throw new Error('onUnauthorized non deve scattare'); },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/projects', '/projects']);
});

test('401 su /auth/login e /auth/refresh non attiva mai il refresh', async () => {
  // /auth/refresh è il caso critico: un 401 qui è SESSION_EXPIRED e NON deve
  // mai innescare un altro refresh, altrimenti loop infinito.
  for (const url of ['/auth/login', '/auth/refresh']) {
    const calls = [];
    const response = await fetchWithSessionRefresh(url, undefined, {
      fetchImpl: async (u) => {
        calls.push(u);
        return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
      },
      isAuthUrl: (u) => u.startsWith('/auth/'),
      refresh: async () => { throw new Error('il refresh non deve partire'); },
      onUnauthorized: () => { throw new Error('onUnauthorized non deve scattare'); },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(calls, [url]);
  }
});

test('refresh fallito: restituita la risposta 401 originale, nessun retry', async () => {
  const calls = [];
  const response = await fetchWithSessionRefresh('/projects', undefined, {
    fetchImpl: async (url) => { calls.push(url); return jsonResponse({ error: 'SESSION_EXPIRED' }, 401); },
    isAuthUrl: (url) => url.startsWith('/auth/'),
    refresh: async () => false,
    onUnauthorized: () => { throw new Error('onUnauthorized non deve scattare (lo fa il refresher)'); },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(calls, ['/projects']);
});

test('refresh ok ma retry ancora 401: onUnauthorized una volta, nessun ulteriore refresh', async () => {
  const calls = [];
  let unauthorized = 0;
  const response = await fetchWithSessionRefresh('/projects', undefined, {
    fetchImpl: async (url) => { calls.push(url); return jsonResponse({ error: 'X' }, 401); },
    isAuthUrl: (url) => url.startsWith('/auth/'),
    refresh: async () => true,
    onUnauthorized: () => { unauthorized += 1; },
  });

  assert.equal(response.status, 401);
  assert.equal(unauthorized, 1);
  assert.deepEqual(calls, ['/projects', '/projects']);
});

test('risposte non-401 passano senza toccare il refresh', async () => {
  const response = await fetchWithSessionRefresh('/projects', undefined, {
    fetchImpl: async () => jsonResponse([{ id: 1 }]),
    isAuthUrl: () => false,
    refresh: async () => { throw new Error('il refresh non deve partire'); },
    onUnauthorized: () => { throw new Error('non deve scattare'); },
  });
  assert.equal(response.status, 200);
});
