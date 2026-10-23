/*
 * Cloudflare Worker that serves Raman tensors of the Computational Raman
 * Database (M. Bagheri and H.-P. Komsa, Sci. Data 10, 80 (2023), CC BY 4.0)
 * with CORS headers, so the phonon website can fetch them from the browser.
 *
 * ramandb.oulu.fi does not send Access-Control-Allow-Origin, so browsers
 * refuse to hand its files to other sites. This worker only forwards the
 * per-material tensor files, GET /mp-<id> -> /figs/tensors_yaml/mp-<id>.yaml,
 * and keeps them in the Cloudflare cache so repeated views of a material do
 * not reach the Oulu server again. Any other path is rejected, so it cannot
 * be used as an open proxy.
 */

const UPSTREAM = 'https://ramandb.oulu.fi/figs/tensors_yaml/';
const CACHE_SECONDS = 7 * 24 * 3600;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export function getMaterialId(pathname) {
    let match = /^\/(mp-\d+)$/.exec(pathname);
    return match ? match[1] : null;
}

export default {
    async fetch(request, env, ctx) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }
        if (request.method !== 'GET') {
            return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
        }

        let materialId = getMaterialId(new URL(request.url).pathname);
        if (!materialId) {
            return new Response('Not found', { status: 404, headers: CORS_HEADERS });
        }

        let cache = typeof caches !== 'undefined' ? caches.default : null;
        let cacheKey = new Request(UPSTREAM + materialId + '.yaml');
        if (cache) {
            let cached = await cache.match(cacheKey);
            if (cached) {
                return cached;
            }
        }

        let upstream = await fetch(cacheKey);
        //materials missing from the database are a normal answer, cache them too
        let status = upstream.ok ? 200 : (upstream.status === 404 ? 404 : 502);
        let response = new Response(upstream.ok ? upstream.body : null, {
            status: status,
            headers: Object.assign({
                'Content-Type': 'text/yaml; charset=utf-8',
                'Cache-Control': 'public, max-age=' + CACHE_SECONDS,
            }, CORS_HEADERS),
        });
        if (cache && status !== 502) {
            ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }
        return response;
    },
};
