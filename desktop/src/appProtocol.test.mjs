import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  APP_ORIGIN, contentTypeFor, isApiPath, isAppUrl, isSafeExternalUrl, proxyApi, resolveStaticPath,
} from './appProtocol.mjs';

const DIST = path.resolve('/opt/pt/web');

test('la radice e le rotte SPA senza estensione servono index.html', () => {
  assert.equal(resolveStaticPath('/', DIST), path.join(DIST, 'index.html'));
  assert.equal(resolveStaticPath('/planning/table', DIST), path.join(DIST, 'index.html'));
});

test('gli asset con estensione puntano al file in dist', () => {
  assert.equal(resolveStaticPath('/assets/index-abc.js', DIST), path.join(DIST, 'assets', 'index-abc.js'));
  assert.equal(resolveStaticPath('/assets/missing.js', DIST), path.join(DIST, 'assets', 'missing.js'));
});

test('path traversal e percent-encoding malformato vengono rifiutati', () => {
  assert.equal(resolveStaticPath('/..%2f..%2fetc%2fpasswd', DIST), null);
  assert.equal(resolveStaticPath('/assets/../../secret.txt', DIST), null);
  assert.equal(resolveStaticPath('/%E0%A4%A', DIST), null);
});

test('content type per gli asset di vite', () => {
  assert.equal(contentTypeFor('/x/index.html'), 'text/html; charset=utf-8');
  assert.equal(contentTypeFor('/x/a.js'), 'text/javascript; charset=utf-8');
  assert.equal(contentTypeFor('/x/a.css'), 'text/css; charset=utf-8');
  assert.equal(contentTypeFor('/x/f.woff2'), 'font/woff2');
  assert.equal(contentTypeFor('/x/sconosciuto.bin'), null);
});

test('isApiPath riconosce solo /api e i suoi figli', () => {
  assert.equal(isApiPath('/api'), true);
  assert.equal(isApiPath('/api/auth/me'), true);
  assert.equal(isApiPath('/apix'), false);
  assert.equal(isApiPath('/planning'), false);
});

test('isAppUrl accetta solo app://project-tracker', () => {
  assert.equal(isAppUrl(`${APP_ORIGIN}/planning`), true);
  assert.equal(isAppUrl('app://altro/planning'), false);
  assert.equal(isAppUrl('https://project-tracker/'), false);
  assert.equal(isAppUrl('non un url'), false);
});

test('isSafeExternalUrl accetta solo https', () => {
  assert.equal(isSafeExternalUrl('https://example.com/doc'), true);
  assert.equal(isSafeExternalUrl('http://example.com'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
});

function fakeRequest({ url, method = 'GET', headers = {}, body = '' }) {
  return {
    url, method, headers: new Headers(headers),
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

test('proxyApi inoltra metodo, path, query e body al backend senza Origin, Referer e Cookie', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); };
  const req = fakeRequest({
    url: `${APP_ORIGIN}/api/wbs/planning?person_id=2`, method: 'POST', body: '{"a":1}',
    headers: { 'content-type': 'application/json', origin: APP_ORIGIN, referer: `${APP_ORIGIN}/x`, cookie: 'x=1' },
  });
  await proxyApi(req, { apiOrigin: 'https://api.example', fetchImpl });
  assert.equal(calls[0].url, 'https://api.example/api/wbs/planning?person_id=2');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(new TextDecoder().decode(calls[0].init.body), '{"a":1}');
  assert.equal(calls[0].init.headers.get('content-type'), 'application/json');
  assert.equal(calls[0].init.headers.get('origin'), null);
  assert.equal(calls[0].init.headers.get('referer'), null);
  assert.equal(calls[0].init.headers.get('cookie'), null);
});

for (const pathname of [
  '/api/%2e%2e/actuator/health',
  '/api/..%2factuator',
  '/api/foo%5cbar',
  '/api/a/../../actuator',
  '/api/foo\\bar',
  '/api/foo%2Fbar',
  '/api/a/../auth/me',
  '/api/%2E/auth/me',
  '/actuator/health',
  '//outside.example/api/auth/me',
]) {
  test(`proxyApi rifiuta il path non sicuro ${pathname} senza chiamare il backend`, async () => {
    const calls = [];
    const res = await proxyApi(fakeRequest({ url: `${APP_ORIGIN}${pathname}` }), {
      apiOrigin: 'https://api.example',
      fetchImpl: async (url) => { calls.push(url); return new Response('{}'); },
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'INVALID_PATH' });
    assert.equal(calls.length, 0);
  });
}

test('proxyApi rifiuta i separatori codificati anche dopo la normalizzazione URL', async () => {
  const calls = [];
  const res = await proxyApi(fakeRequest({ url: APP_ORIGIN + '/api/..%2\tfactuator' }), {
    apiOrigin: 'https://api.example',
    fetchImpl: async (url) => { calls.push(url); return new Response('{}'); },
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'INVALID_PATH' });
  assert.equal(calls.length, 0);
});

test('proxyApi risolve il path sotto /api e conserva la query codificata', async () => {
  const calls = [];
  const query = '?next=%2Fplanning%5Ctable&person_id=2&q=a+b';
  await proxyApi(fakeRequest({ url: `${APP_ORIGIN}/api/wbs/planning${query}` }), {
    apiOrigin: 'https://api.example/backend/',
    fetchImpl: async (url) => { calls.push(url); return new Response('{}'); },
  });
  assert.equal(calls[0], `https://api.example/api/wbs/planning${query}`);
});

test('proxyApi non manda body su GET', async () => {
  let seen;
  await proxyApi(fakeRequest({ url: `${APP_ORIGIN}/api/auth/me` }), {
    apiOrigin: 'https://api.example',
    fetchImpl: async (_url, init) => { seen = init; return new Response(null, { status: 204 }); },
  });
  assert.equal(seen.body, undefined);
});

test('proxyApi rimuove Set-Cookie dalla risposta verso la pagina e conserva lo status', async () => {
  const res = await proxyApi(fakeRequest({ url: `${APP_ORIGIN}/api/auth/login`, method: 'POST', body: '{}' }), {
    apiOrigin: 'https://api.example',
    fetchImpl: async () => new Response('{"ok":true}', {
      status: 401, headers: { 'set-cookie': 'pt_access=abc; HttpOnly', 'content-type': 'application/json' },
    }),
  });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(await res.text(), '{"ok":true}');
});

test('proxyApi rimuove encoding e lunghezza del body upstream già decodificato', async () => {
  const body = '{"ok":true}';
  const res = await proxyApi(fakeRequest({ url: `${APP_ORIGIN}/api/auth/me` }), {
    apiOrigin: 'https://api.example',
    fetchImpl: async () => new Response(body, {
      headers: { 'content-encoding': 'gzip', 'content-length': '123', 'content-type': 'application/json' },
    }),
  });
  assert.equal(res.headers.get('content-encoding'), null);
  assert.equal(res.headers.get('content-length'), null);
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(await res.text(), body);
});

test('proxyApi risponde 502 JSON se il backend non è raggiungibile', async () => {
  const res = await proxyApi(fakeRequest({ url: `${APP_ORIGIN}/api/auth/me` }), {
    apiOrigin: 'https://api.example',
    fetchImpl: async () => { throw new Error('net::ERR_INTERNET_DISCONNECTED'); },
  });
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'UPSTREAM_UNREACHABLE' });
});
