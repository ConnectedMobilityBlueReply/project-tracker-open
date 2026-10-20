import assert from 'node:assert/strict';
import test from 'node:test';

// Stub dell'ambiente DOM usato a runtime da api.ts (window.dispatchEvent).
globalThis.window ??= new EventTarget();

import {
  ApiError,
  changePassword,
  getMe,
  getPersons,
  getProjects,
  login,
  refresh,
  UNAUTHORIZED_EVENT,
} from '../api.ts';

const USER = {
  personId: 1,
  name: 'Mario Rossi',
  email: 'mario@example.com',
  appRole: 'pm',
  teamId: 1,
  teamName: 'Team A',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function countUnauthorizedEvents() {
  let count = 0;
  window.addEventListener(UNAUTHORIZED_EVENT, () => { count += 1; });
  return () => count;
}

test('end-to-end: 401 su endpoint protetto → refresh → retry, l\'utente non vede nulla', async () => {
  const calls = [];
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === '/api/auth/refresh') return jsonResponse({ status: 'AUTHENTICATED', user: USER });
    if (url === '/api/projects') {
      const attempt = calls.filter(u => u === '/api/projects').length;
      return attempt === 1
        ? jsonResponse({ error: 'SESSION_EXPIRED' }, 401)
        : jsonResponse([{ id: 1, name: 'P1' }]);
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const projects = await getProjects();
  assert.deepEqual(projects, [{ id: 1, name: 'P1' }]);
  assert.equal(calls.filter(u => u === '/api/auth/refresh').length, 1);
  assert.equal(calls.filter(u => u === '/api/projects').length, 2);
  assert.equal(unauthorized(), 0);
});

test('end-to-end: 401 concorrenti → un solo refresh, tutte le richieste ripetute', async () => {
  const calls = [];
  let refreshCount = 0;
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === '/api/auth/refresh') {
      refreshCount += 1;
      await new Promise(resolve => setTimeout(resolve, 15));
      return jsonResponse({ status: 'AUTHENTICATED', user: USER });
    }
    const attempt = calls.filter(u => u === url).length;
    if (url === '/api/projects') {
      return attempt === 1 ? jsonResponse({ error: 'SESSION_EXPIRED' }, 401) : jsonResponse([{ id: 1 }]);
    }
    if (url === '/api/persons') {
      return attempt === 1 ? jsonResponse({ error: 'SESSION_EXPIRED' }, 401) : jsonResponse([{ id: 9 }]);
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const [projects, persons] = await Promise.all([getProjects(), getPersons()]);
  assert.deepEqual(projects, [{ id: 1 }]);
  assert.deepEqual(persons, [{ id: 9 }]);
  assert.equal(refreshCount, 1);
  assert.equal(unauthorized(), 0);
});

test('SESSION_EXPIRED: esattamente un reset ad anonimo e nessun retry', async () => {
  const calls = [];
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url === '/api/auth/refresh') return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
    return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
  };

  await assert.rejects(
    getProjects(),
    (err) => err instanceof ApiError && err.code === 'SESSION_EXPIRED' && err.status === 401,
  );
  assert.equal(unauthorized(), 1);
  assert.deepEqual(calls, ['/api/projects', '/api/auth/refresh']);
});

test('refresh ok ma retry ancora 401: nessun loop, un solo reset', async () => {
  let refreshCount = 0;
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    if (url === '/api/auth/refresh') {
      refreshCount += 1;
      return jsonResponse({ status: 'AUTHENTICATED', user: USER });
    }
    return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
  };

  await assert.rejects(getProjects(), (err) => err instanceof ApiError && err.status === 401);
  assert.equal(refreshCount, 1); // nessun secondo refresh: il ciclo non ricorsiona
  assert.equal(unauthorized(), 1);
});

test('401 su /api/auth/me non innesca refresh né reset', async () => {
  let refreshCalls = 0;
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    if (url === '/api/auth/refresh') { refreshCalls += 1; return jsonResponse({ status: 'AUTHENTICATED', user: USER }); }
    if (url === '/api/auth/me') return jsonResponse({ error: 'UNAUTHENTICATED' }, 401);
    throw new Error(`URL inatteso: ${url}`);
  };

  await assert.rejects(
    getMe(),
    (err) => err instanceof ApiError && err.code === 'UNAUTHENTICATED',
  );
  assert.equal(refreshCalls, 0);
  assert.equal(unauthorized(), 0);
});

// timeout: se una regressione rendesse il refresh ricorsivo, il ciclo si
// auto-attenderebbe all'infinito — il test deve FALLIRE, non appendere la suite.
test('end-to-end: 401 su /api/auth/refresh non innesca mai un altro refresh', { timeout: 5000 }, async () => {
  let refreshCalls = 0;
  const unauthorized = countUnauthorizedEvents();

  globalThis.fetch = async (url) => {
    if (url === '/api/auth/refresh') {
      refreshCalls += 1;
      return jsonResponse({ error: 'SESSION_EXPIRED' }, 401);
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  await assert.rejects(
    refresh(),
    (err) => err instanceof ApiError && err.code === 'SESSION_EXPIRED' && err.status === 401,
  );
  assert.equal(refreshCalls, 1);   // nessuna ricorsione: un 401 di refresh non ne lancia un altro
  assert.equal(unauthorized(), 0); // nessun reset: SESSION_EXPIRED è gestito dal chiamante
});

test('login AUTHENTICATED → sessione autenticata', async () => {
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/auth/login');
    return jsonResponse({ status: 'AUTHENTICATED', user: USER });
  };
  const result = await login('mario@example.com', 'segreta');
  assert.equal(result.status, 'AUTHENTICATED');
  assert.equal(result.user.personId, 1);
});

test('login NEW_PASSWORD_REQUIRED → session esposta al chiamante', async () => {
  globalThis.fetch = async () => jsonResponse({ status: 'NEW_PASSWORD_REQUIRED', session: 'sessione-temporanea-1' });
  const result = await login('mario@example.com', 'temporanea');
  assert.equal(result.status, 'NEW_PASSWORD_REQUIRED');
  assert.equal(result.session, 'sessione-temporanea-1');
});

test('login INVALID_CREDENTIALS → ApiError con codice', async () => {
  globalThis.fetch = async () => jsonResponse({ error: 'INVALID_CREDENTIALS' }, 401);
  await assert.rejects(
    login('mario@example.com', 'sbagliata'),
    (err) => err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' && err.status === 401,
  );
});

test('change-password PASSWORD_POLICY → ApiError con messaggio del server', async () => {
  globalThis.fetch = async () => jsonResponse(
    { error: 'PASSWORD_POLICY', message: 'La password deve contenere almeno un simbolo.' },
    400,
  );
  await assert.rejects(
    changePassword('mario@example.com', 'sessione-temporanea-1', 'corta'),
    (err) => err instanceof ApiError
      && err.code === 'PASSWORD_POLICY'
      && err.message === 'La password deve contenere almeno un simbolo.'
      && err.status === 400,
  );
});
