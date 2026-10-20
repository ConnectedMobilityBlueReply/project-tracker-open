import path from 'node:path';

export const APP_SCHEME = 'app';
export const APP_HOST = 'project-tracker';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

// Header che non devono arrivare al backend: Origin/Referer farebbero scattare il CORS di Spring
// (origin app:// non ammesso), i cookie li aggiunge net.fetch dal cookie jar della sessione.
const STRIPPED_REQUEST_HEADERS = ['origin', 'referer', 'cookie', 'host'];

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function resolveStaticPath(pathname, distDir) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const fullPath = path.resolve(distDir, relative);
  if (!fullPath.startsWith(distDir + path.sep)) return null;
  // ponytail: rotte SPA = path senza estensione; una rotta con un punto nel nome non è prevista
  return path.extname(fullPath) ? fullPath : path.join(distDir, 'index.html');
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}

export function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isAppUrl(url) {
  const parsed = parseUrl(url);
  return parsed !== null && parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST;
}

export function isSafeExternalUrl(url) {
  return parseUrl(url)?.protocol === 'https:';
}

export async function proxyApi(request, { apiOrigin, fetchImpl }) {
  const source = new URL(request.url);
  // URL elimina i segmenti . e ..: controlla anche il pathname originale.
  const rawPathname = request.url.match(/^[^:]+:\/\/[^/?#]*([^?#]*)/)?.[1] ?? source.pathname;
  const unsafePath = /\\|%(?:2f|5c)|(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i;
  if (unsafePath.test(rawPathname) || unsafePath.test(source.pathname)) {
    return Response.json({ error: 'INVALID_PATH' }, { status: 400 });
  }
  const target = new URL(source.pathname + source.search, apiOrigin);
  if (target.origin !== new URL(apiOrigin).origin || !isApiPath(target.pathname)) {
    return Response.json({ error: 'INVALID_PATH' }, { status: 400 });
  }

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream;
  try {
    upstream = await fetchImpl(target.href, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
  } catch {
    return Response.json({ error: 'UPSTREAM_UNREACHABLE' }, { status: 502 });
  }

  // I cookie di sessione restano nel cookie jar del main process: la pagina non deve mai vederli.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('set-cookie');
  // net.fetch ha già decodificato il body: questi header descrivono il body compresso.
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
